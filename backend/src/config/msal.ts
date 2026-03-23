/**
 * MSAL Configuration for Azure AD / Entra ID
 */
import { ConfidentialClientApplication, Configuration, LogLevel } from '@azure/msal-node';

// Validate required environment variables
const requiredEnvVars = ['AZURE_CLIENT_ID', 'AZURE_TENANT_ID', 'AZURE_CLIENT_SECRET'] as const;
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`⚠️  Missing environment variable: ${envVar}`);
  }
}

// MSAL configuration
const msalConfig: Configuration = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET || '',
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error('[MSAL]', message);
            break;
          case LogLevel.Warning:
            console.warn('[MSAL]', message);
            break;
          case LogLevel.Info:
            console.info('[MSAL]', message);
            break;
          case LogLevel.Verbose:
            console.debug('[MSAL]', message);
            break;
        }
      },
      piiLoggingEnabled: false,
      logLevel: process.env.NODE_ENV === 'development' ? LogLevel.Info : LogLevel.Warning,
    },
  },
};

// OAuth scopes
export const SCOPES = ['openid', 'profile', 'email', 'User.Read'];

// Redirect URI - configurable via env
export const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3300/auth/callback';
export const POST_LOGOUT_REDIRECT_URI = process.env.POST_LOGOUT_REDIRECT_URI || 'http://localhost:3000';
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// JWT settings
export const JWT_SECRET = process.env.JWT_SECRET || 'rebel-factory-dev-secret-change-in-prod';
export const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

// Create MSAL client instance
let msalClient: ConfidentialClientApplication | null = null;

export function getMsalClient(): ConfidentialClientApplication {
  if (!msalClient) {
    if (!process.env.AZURE_CLIENT_ID) {
      throw new Error('AZURE_CLIENT_ID is required for MSAL initialization');
    }
    msalClient = new ConfidentialClientApplication(msalConfig);
  }
  return msalClient;
}

// User info type from Microsoft Graph
export interface MicrosoftUser {
  id: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  mail?: string;
  userPrincipalName: string;
  jobTitle?: string;
  department?: string;
}

// Session user type (stored in JWT)
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  azureId: string;
}

export default msalConfig;
