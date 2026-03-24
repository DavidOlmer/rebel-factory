/**
 * Authentication Routes
 * - Microsoft SSO via Azure AD / Entra ID
 * - OAuth 2.0 Authorization Code Flow with PKCE
 */
import { Router, Request, Response } from 'express';
import { CryptoProvider, AuthorizationCodeRequest, AuthorizationUrlRequest } from '@azure/msal-node';
import { getMsalClient, SCOPES, REDIRECT_URI, FRONTEND_URL, MicrosoftUser, SessionUser } from '../config/msal';
import { validateToken, generateToken, extractUser } from '../middleware/auth';
import jwt from 'jsonwebtoken';

const router = Router();

// JWT secret for dev tokens
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const cryptoProvider = new CryptoProvider();

// In-memory store for PKCE codes (use Redis in production)
const pkceStore = new Map<string, { verifier: string; challenge: string; state: string }>();

/**
 * GET /auth/login
 * Initiates Microsoft OAuth flow - redirects to Microsoft login
 */
router.get('/login', async (req: Request, res: Response) => {
  try {
    const msalClient = getMsalClient();
    
    // Generate PKCE codes for security
    const { verifier, challenge } = await cryptoProvider.generatePkceCodes();
    
    // Generate state for CSRF protection
    const state = cryptoProvider.createNewGuid();
    
    // Store PKCE data
    pkceStore.set(state, { verifier, challenge, state });
    
    // Clean up old entries (simple TTL)
    setTimeout(() => pkceStore.delete(state), 10 * 60 * 1000); // 10 min TTL
    
    const authUrlParams: AuthorizationUrlRequest = {
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
      state,
      prompt: 'select_account', // Allow account selection
    };
    
    // Optional: pass return URL
    const returnUrl = req.query.returnUrl as string;
    if (returnUrl) {
      authUrlParams.state = JSON.stringify({ state, returnUrl });
    }
    
    const authUrl = await msalClient.getAuthCodeUrl(authUrlParams);
    res.redirect(authUrl);
    
  } catch (error) {
    console.error('Login initiation failed:', error);
    res.status(500).json({ 
      error: 'Login failed',
      message: 'Could not initiate Microsoft login'
    });
  }
});

/**
 * GET /auth/callback
 * OAuth callback handler - exchanges code for tokens
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;
    
    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error, error_description);
      return res.redirect(`${FRONTEND_URL}/auth/error?error=${encodeURIComponent(error as string)}`);
    }
    
    if (!code || !state) {
      return res.redirect(`${FRONTEND_URL}/auth/error?error=missing_params`);
    }
    
    // Parse state (may contain returnUrl)
    let stateKey = state as string;
    let returnUrl = '/';
    
    try {
      const parsedState = JSON.parse(state as string);
      stateKey = parsedState.state;
      returnUrl = parsedState.returnUrl || '/';
    } catch {
      // State is plain string
    }
    
    // Retrieve PKCE verifier
    const pkceData = pkceStore.get(stateKey);
    if (!pkceData) {
      console.error('PKCE data not found for state:', stateKey);
      return res.redirect(`${FRONTEND_URL}/auth/error?error=invalid_state`);
    }
    
    pkceStore.delete(stateKey); // One-time use
    
    const msalClient = getMsalClient();
    
    const tokenRequest: AuthorizationCodeRequest = {
      code: code as string,
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
      codeVerifier: pkceData.verifier,
    };
    
    const tokenResponse = await msalClient.acquireTokenByCode(tokenRequest);
    
    if (!tokenResponse || !tokenResponse.account) {
      throw new Error('No token response received');
    }
    
    // Fetch user profile from Microsoft Graph
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${tokenResponse.accessToken}`,
      },
    });
    
    if (!graphResponse.ok) {
      throw new Error(`Graph API error: ${graphResponse.status}`);
    }
    
    const msUser: MicrosoftUser = await graphResponse.json();
    
    // Create session user
    const sessionUser: SessionUser = {
      id: msUser.userPrincipalName, // Use UPN as primary ID
      email: msUser.mail || msUser.userPrincipalName,
      name: msUser.displayName,
      roles: determineRoles(msUser), // Map roles based on user attributes
      azureId: msUser.id,
    };
    
    // Generate JWT
    const jwt = generateToken(sessionUser);
    
    // Set HTTP-only cookie
    res.cookie('auth_token', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
    
    // Redirect to frontend with token in URL (for SPA)
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${jwt}&returnUrl=${encodeURIComponent(returnUrl)}`);
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${FRONTEND_URL}/auth/error?error=callback_failed`);
  }
});

/**
 * GET /auth/logout
 * Clears session and optionally logs out from Microsoft
 */
router.get('/logout', (req: Request, res: Response) => {
  // Clear cookie
  res.clearCookie('auth_token');
  
  const fullLogout = req.query.full === 'true';
  
  if (fullLogout) {
    // Redirect to Microsoft logout
    const logoutUrl = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(FRONTEND_URL)}`;
    res.redirect(logoutUrl);
  } else {
    // Just clear local session
    res.redirect(`${FRONTEND_URL}/auth/logged-out`);
  }
});

/**
 * POST /auth/logout (API version)
 * Clears session via API call
 */
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('auth_token');
  res.json({ success: true, message: 'Logged out' });
});

/**
 * GET /auth/me
 * Returns current user info
 */
router.get('/me', extractUser, (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ 
      authenticated: false,
      user: null
    });
  }
  
  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      roles: req.user.roles,
    }
  });
});

/**
 * GET /auth/check
 * Quick auth status check
 */
router.get('/check', extractUser, (req: Request, res: Response) => {
  res.json({ 
    authenticated: !!req.user,
    expires: req.user ? getTokenExpiry(req) : null
  });
});

/**
 * POST /auth/refresh
 * Refresh token (extend session)
 */
router.post('/refresh', validateToken, (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No user context' });
  }
  
  // Generate new token with same user data
  const newToken = generateToken(req.user);
  
  res.cookie('auth_token', newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });
  
  res.json({ 
    success: true, 
    token: newToken,
    expiresIn: '24h'
  });
});

/**
 * POST /auth/dev-login
 * Development-only login bypass for testing
 * Enable with: DEV_AUTH_BYPASS=true
 */
router.post('/dev-login', async (req: Request, res: Response) => {
  if (process.env.DEV_AUTH_BYPASS !== 'true') {
    return res.status(403).json({ 
      error: 'Dev login disabled',
      message: 'Set DEV_AUTH_BYPASS=true to enable'
    });
  }
  
  const { 
    email = 'dev@rebelai.nl', 
    name = 'Dev User', 
    role = 'admin' 
  } = req.body;
  
  const sessionUser: SessionUser = {
    id: email,
    email,
    name,
    roles: [role, 'member', 'rebel'],
    azureId: 'dev-user-' + Date.now(),
  };
  
  const token = jwt.sign(sessionUser, JWT_SECRET, { expiresIn: '24h' });
  
  // Set cookie
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: false, // Dev mode
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });
  
  res.json({ 
    token, 
    user: {
      id: sessionUser.id,
      email: sessionUser.email,
      name: sessionUser.name,
      roles: sessionUser.roles,
    },
    message: 'Dev login successful (not for production!)'
  });
});

/**
 * GET /auth/dev-status
 * Check if dev auth is enabled
 */
router.get('/dev-status', (_req: Request, res: Response) => {
  res.json({
    devAuthEnabled: process.env.DEV_AUTH_BYPASS === 'true',
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * Determine user roles based on Microsoft user attributes
 * Customize this based on your Azure AD group memberships
 */
function determineRoles(user: MicrosoftUser): string[] {
  const roles: string[] = ['member']; // Default role
  
  // Example: Admin role based on department or job title
  const adminIndicators = ['IT', 'Engineering', 'Admin'];
  if (user.department && adminIndicators.some(ind => user.department?.includes(ind))) {
    roles.push('admin');
  }
  
  // Example: Role based on email domain
  if (user.mail?.endsWith('@rebelai.nl') || user.userPrincipalName?.endsWith('@rebelai.nl')) {
    roles.push('rebel'); // Internal user
  }
  
  // TODO: Fetch actual group memberships from Graph API for production use
  // const groups = await fetchUserGroups(accessToken);
  // map groups to roles
  
  return roles;
}

/**
 * Get token expiry from request
 */
function getTokenExpiry(req: Request): string | null {
  try {
    const token = req.headers.authorization?.slice(7) || req.cookies?.auth_token;
    if (!token) return null;
    
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return new Date(payload.exp * 1000).toISOString();
  } catch {
    return null;
  }
}

export default router;
