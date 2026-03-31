/**
 * Authentication Middleware
 * - JWT validation
 * - Role-based access control
 * - User extraction
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, SessionUser } from '../config/msal';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

/**
 * Extract user from JWT token (optional auth)
 * Populates req.user if valid token present, continues regardless
 */
export function extractUser(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.auth_token;
  
  const token = authHeader?.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : cookieToken;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as SessionUser;
      req.user = decoded;
    } catch (error) {
      // Invalid token - continue without user
      console.debug('Invalid token in request:', (error as Error).message);
    }
  }
  
  next();
}

/**
 * Validate JWT token (required auth)
 * Returns 401 if no valid token present
 */
export function validateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.auth_token;
  
  const token = authHeader?.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : cookieToken;

  if (!token) {
    res.status(401).json({ 
      error: 'Authentication required',
      message: 'No token provided'
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionUser;
    req.user = decoded;
    next();
  } catch (error) {
    if ((error as jwt.JsonWebTokenError).name === 'TokenExpiredError') {
      res.status(401).json({ 
        error: 'Token expired',
        message: 'Please log in again'
      });
      return;
    }
    
    res.status(401).json({ 
      error: 'Invalid token',
      message: 'Token verification failed'
    });
  }
}

/**
 * Require specific role(s)
 * Must be used after validateToken middleware
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Authentication required',
        message: 'No user context'
      });
      return;
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      res.status(403).json({ 
        error: 'Forbidden',
        message: `Required role: ${allowedRoles.join(' or ')}`
      });
      return;
    }

    next();
  };
}

/**
 * Require admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * Require member or admin role
 */
export const requireMember = requireRole('member', 'admin');

/**
 * Generate JWT token for user
 */
export function generateToken(user: SessionUser, expiresIn: string = '24h'): string {
  return jwt.sign(
    user as object,
    JWT_SECRET as jwt.Secret,
    { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] }
  );
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token: string): SessionUser | null {
  try {
    return jwt.decode(token) as SessionUser;
  } catch {
    return null;
  }
}
