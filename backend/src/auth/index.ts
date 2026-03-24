/**
 * Auth Module - Barrel Export
 * 
 * Central export for all authentication functionality
 */

// Entra ID / Azure AD Provider
export { 
  EntraAuthProvider, 
  getEntraProvider,
  DEFAULT_SCOPES,
  SHAREPOINT_SCOPES,
  mapMicrosoftUserToAppUser,
  type MicrosoftUserProfile,
} from './entra';

// Middleware
export { 
  createAuthMiddleware, 
  verifySectorAccess,
  rateLimitUser,
} from './middleware';

// Core middleware (from middleware/auth.ts)
export { 
  validateToken, 
  extractUser, 
  requireRole,
  requireAdmin,
  requireMember,
  generateToken,
  decodeToken,
} from '../middleware/auth';

// Types
export type { SessionUser } from '../config/msal';
