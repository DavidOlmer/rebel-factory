/**
 * Auth Middleware Exports
 * Re-exports from middleware/auth.ts plus additional helpers
 */
import { Request, Response, NextFunction } from 'express';
import { 
  validateToken, 
  extractUser, 
  requireRole, 
  requireAdmin, 
  requireMember,
  generateToken,
  decodeToken 
} from '../middleware/auth';

// Re-export all middleware functions
export {
  validateToken,
  extractUser,
  requireRole,
  requireAdmin,
  requireMember,
  generateToken,
  decodeToken,
};

/**
 * Create configurable auth middleware
 * Allows custom token extraction and validation
 */
export function createAuthMiddleware(options: {
  tokenExtractor?: (req: Request) => string | null;
  onUnauthorized?: (req: Request, res: Response) => void;
  optional?: boolean;
} = {}) {
  const {
    tokenExtractor,
    onUnauthorized,
    optional = false,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Use custom extractor or default
    const token = tokenExtractor?.(req) ?? extractTokenFromRequest(req);

    if (!token) {
      if (optional) {
        next();
        return;
      }
      
      if (onUnauthorized) {
        onUnauthorized(req, res);
        return;
      }
      
      res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided'
      });
      return;
    }

    // Validate and attach user
    try {
      const decoded = decodeToken(token);
      if (!decoded) {
        throw new Error('Invalid token');
      }
      req.user = decoded;
      next();
    } catch (error) {
      if (optional) {
        next();
        return;
      }
      
      res.status(401).json({ 
        error: 'Invalid token',
        message: 'Token verification failed'
      });
    }
  };
}

/**
 * Extract token from request (header or cookie)
 */
function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.auth_token;
  
  return authHeader?.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : cookieToken || null;
}

/**
 * Verify sector/tenant access
 * Checks if user has access to the requested sector/tenant
 */
export function verifySectorAccess(sectorParam: string = 'sectorId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Authentication required',
        message: 'No user context'
      });
      return;
    }

    const requestedSector = req.params[sectorParam] || req.query.sector || req.body?.sectorId;
    
    if (!requestedSector) {
      // No sector specified - allow (will use default)
      next();
      return;
    }

    // Admins can access any sector
    if (req.user.roles?.includes('admin')) {
      next();
      return;
    }

    // Check if user's tenant matches the requested sector
    const userTenant = (req.user as any).tenantId;
    
    if (userTenant && userTenant !== requestedSector) {
      res.status(403).json({ 
        error: 'Forbidden',
        message: 'Access to this sector is not allowed'
      });
      return;
    }

    next();
  };
}

/**
 * Rate limiting per user
 * Simple in-memory rate limiter (use Redis for production)
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimitUser(options: {
  windowMs?: number;
  maxRequests?: number;
} = {}) {
  const { windowMs = 60000, maxRequests = 100 } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user?.id || req.ip || 'anonymous';
    const now = Date.now();

    let record = rateLimitStore.get(userId);

    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
      rateLimitStore.set(userId, record);
    }

    record.count++;

    if (record.count > maxRequests) {
      res.status(429).json({ 
        error: 'Too many requests',
        retryAfter: Math.ceil((record.resetAt - now) / 1000)
      });
      return;
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    next();
  };
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Every minute
