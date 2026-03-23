/**
 * RBAC Middleware - REBAA-26
 * Role-Based Access Control middleware for Express
 */

import { Request, Response, NextFunction } from 'express';
import { Role, Permission, Resource, Action, RBACContext, getHighestRole } from '../types/rbac';
import { 
  PERMISSIONS, 
  AZURE_GROUP_MAPPINGS, 
  DEFAULT_ROLE, 
  roleHasPermission,
  getPermissionsForRole 
} from '../config/permissions';
import { SessionUser } from '../config/msal';

// Extend Express Request with RBAC context
declare global {
  namespace Express {
    interface Request {
      rbac?: RBACContext;
    }
  }
}

/**
 * Map Azure AD group IDs to application roles
 * @param groups - Array of Azure AD group IDs from user claims
 * @returns Array of mapped roles
 */
export function mapAzureGroups(groups: string[]): Role[] {
  if (!groups || groups.length === 0) {
    return [DEFAULT_ROLE];
  }

  const mappedRoles = AZURE_GROUP_MAPPINGS
    .filter(mapping => groups.includes(mapping.groupId))
    .map(mapping => mapping.role);

  return mappedRoles.length > 0 ? mappedRoles : [DEFAULT_ROLE];
}

/**
 * Check if user can access a resource with given action
 * @param resource - Resource type (agents, sprints, etc.)
 * @param action - Action to perform (create, read, update, delete, etc.)
 */
export function canAccess(resource: Resource, action: Action) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const permission = `${resource}:${action}` as Permission;
    
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'No user context available'
      });
      return;
    }

    // Get user's effective role
    const userRoles = (req.user.roles || []).map(r => r as Role);
    const effectiveRole = getHighestRole(userRoles.length > 0 ? userRoles : [DEFAULT_ROLE]);

    // Check permission
    if (!roleHasPermission(effectiveRole, permission)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Permission denied: ${permission}`,
        required: permission,
        userRole: effectiveRole
      });
      return;
    }

    // Attach RBAC context to request
    req.rbac = {
      userId: req.user.id,
      role: effectiveRole,
      permissions: getPermissionsForRole(effectiveRole),
      tenantId: (req as any).tenantId || '',
      isAdmin: effectiveRole === Role.ADMIN,
      isVentureLead: effectiveRole === Role.ADMIN || effectiveRole === Role.VENTURE_LEAD
    };

    next();
  };
}

/**
 * Require one of the specified roles
 * @param roles - Allowed roles
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'No user context available'
      });
      return;
    }

    const userRoles = (req.user.roles || []).map(r => r as Role);
    const effectiveRole = getHighestRole(userRoles.length > 0 ? userRoles : [DEFAULT_ROLE]);
    
    const hasRequiredRole = roles.some(role => {
      // Admin has access to everything
      if (effectiveRole === Role.ADMIN) return true;
      // Check exact role match
      return effectiveRole === role;
    });

    if (!hasRequiredRole) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Required role: ${roles.join(' or ')}`,
        userRole: effectiveRole
      });
      return;
    }

    // Attach RBAC context
    req.rbac = {
      userId: req.user.id,
      role: effectiveRole,
      permissions: getPermissionsForRole(effectiveRole),
      tenantId: (req as any).tenantId || '',
      isAdmin: effectiveRole === Role.ADMIN,
      isVentureLead: effectiveRole === Role.ADMIN || effectiveRole === Role.VENTURE_LEAD
    };

    next();
  };
}

/**
 * Require specific permission(s)
 * @param permissions - Required permissions (user needs at least one)
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'No user context available'
      });
      return;
    }

    const userRoles = (req.user.roles || []).map(r => r as Role);
    const effectiveRole = getHighestRole(userRoles.length > 0 ? userRoles : [DEFAULT_ROLE]);

    const hasPermission = permissions.some(perm => roleHasPermission(effectiveRole, perm));

    if (!hasPermission) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Required permission: ${permissions.join(' or ')}`,
        userRole: effectiveRole
      });
      return;
    }

    req.rbac = {
      userId: req.user.id,
      role: effectiveRole,
      permissions: getPermissionsForRole(effectiveRole),
      tenantId: (req as any).tenantId || '',
      isAdmin: effectiveRole === Role.ADMIN,
      isVentureLead: effectiveRole === Role.ADMIN || effectiveRole === Role.VENTURE_LEAD
    };

    next();
  };
}

/**
 * Initialize RBAC context for request (attach without enforcing)
 * Use this when you want RBAC info available but don't want to block
 */
export function initRBAC(req: Request, _res: Response, next: NextFunction): void {
  if (req.user) {
    const userRoles = (req.user.roles || []).map(r => r as Role);
    const effectiveRole = getHighestRole(userRoles.length > 0 ? userRoles : [DEFAULT_ROLE]);

    req.rbac = {
      userId: req.user.id,
      role: effectiveRole,
      permissions: getPermissionsForRole(effectiveRole),
      tenantId: (req as any).tenantId || '',
      isAdmin: effectiveRole === Role.ADMIN,
      isVentureLead: effectiveRole === Role.ADMIN || effectiveRole === Role.VENTURE_LEAD
    };
  }
  next();
}

/**
 * Resource ownership check middleware factory
 * Verifies user owns or has access to the resource
 */
export function requireOwnership(
  getOwnerId: (req: Request) => Promise<string | null>
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user || !req.rbac) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'No user context available'
      });
      return;
    }

    // Admins and venture leads can access any resource
    if (req.rbac.isAdmin || req.rbac.isVentureLead) {
      next();
      return;
    }

    try {
      const ownerId = await getOwnerId(req);
      
      if (ownerId !== req.user.id) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this resource'
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        error: 'Internal error',
        message: 'Failed to verify resource ownership'
      });
    }
  };
}

// =============================================================================
// CONVENIENCE MIDDLEWARE
// =============================================================================

/** Require admin role */
export const requireAdmin = requireRole(Role.ADMIN);

/** Require venture lead or admin role */
export const requireVentureLead = requireRole(Role.VENTURE_LEAD, Role.ADMIN);

/** Require consultant or higher role */
export const requireConsultant = requireRole(Role.CONSULTANT, Role.VENTURE_LEAD, Role.ADMIN);

/** Require at least viewer role (any authenticated user) */
export const requireViewer = requireRole(Role.VIEWER, Role.CONSULTANT, Role.VENTURE_LEAD, Role.ADMIN);

// =============================================================================
// PERMISSION-BASED CONVENIENCE MIDDLEWARE
// =============================================================================

/** Can create agents */
export const canCreateAgents = canAccess('agents', 'create');

/** Can delete agents */
export const canDeleteAgents = canAccess('agents', 'delete');

/** Can promote agents */
export const canPromoteAgents = canAccess('agents', 'promote');

/** Can manage tenants */
export const canManageTenants = canAccess('tenants', 'manage');

/** Can manage users */
export const canManageUsers = canAccess('users', 'manage');

/** Can view audit logs */
export const canViewAudit = canAccess('audit', 'read');
