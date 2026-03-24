/**
 * RBAC Service - REBAA-26
 * Role management and permission checking service
 */

import { Pool } from 'pg';
import { Role, Permission, UserRole, PermissionCheck, getHighestRole, ROLE_HIERARCHY } from '../types/rbac';
import { 
  PERMISSIONS, 
  DEFAULT_ROLE, 
  roleHasPermission, 
  getPermissionsForRole,
  AZURE_GROUP_MAPPINGS 
} from '../config/permissions';

export class RBACService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // ===========================================================================
  // USER ROLE MANAGEMENT
  // ===========================================================================

  /**
   * Get user's role for a tenant
   */
  async getUserRole(userId: string, tenantId?: string): Promise<Role> {
    const query = tenantId
      ? `SELECT role FROM user_roles 
         WHERE user_id = $1 AND tenant_id = $2 
         AND (expires_at IS NULL OR expires_at > NOW())`
      : `SELECT role FROM user_roles 
         WHERE user_id = $1 
         AND (expires_at IS NULL OR expires_at > NOW())`;
    
    const params = tenantId ? [userId, tenantId] : [userId];
    
    try {
      const result = await this.pool.query(query, params);
      
      if (result.rows.length === 0) {
        return DEFAULT_ROLE;
      }

      // If user has multiple roles, return the highest
      const roles = result.rows.map(row => row.role as Role);
      return getHighestRole(roles);
    } catch (error) {
      console.error('Error getting user role:', error);
      return DEFAULT_ROLE;
    }
  }

  /**
   * Set user's role for a tenant
   */
  async setUserRole(
    userId: string, 
    role: Role, 
    tenantId: string,
    grantedBy?: string,
    expiresAt?: Date
  ): Promise<void> {
    const query = `
      INSERT INTO user_roles (user_id, role, tenant_id, granted_by, granted_at, expires_at)
      VALUES ($1, $2, $3, $4, NOW(), $5)
      ON CONFLICT (user_id, tenant_id) 
      DO UPDATE SET 
        role = EXCLUDED.role,
        granted_by = EXCLUDED.granted_by,
        granted_at = NOW(),
        expires_at = EXCLUDED.expires_at
    `;

    try {
      await this.pool.query(query, [userId, role, tenantId, grantedBy || null, expiresAt || null]);
    } catch (error) {
      console.error('Error setting user role:', error);
      throw new Error('Failed to set user role');
    }
  }

  /**
   * Remove user's role for a tenant
   */
  async removeUserRole(userId: string, tenantId: string): Promise<void> {
    const query = `DELETE FROM user_roles WHERE user_id = $1 AND tenant_id = $2`;

    try {
      await this.pool.query(query, [userId, tenantId]);
    } catch (error) {
      console.error('Error removing user role:', error);
      throw new Error('Failed to remove user role');
    }
  }

  /**
   * Get all roles for a user across tenants
   */
  async getAllUserRoles(userId: string): Promise<UserRole[]> {
    const query = `
      SELECT user_id, role, tenant_id, granted_by, granted_at, expires_at
      FROM user_roles
      WHERE user_id = $1
      AND (expires_at IS NULL OR expires_at > NOW())
    `;

    try {
      const result = await this.pool.query(query, [userId]);
      return result.rows.map(row => ({
        userId: row.user_id,
        role: row.role as Role,
        tenantId: row.tenant_id,
        grantedBy: row.granted_by,
        grantedAt: row.granted_at,
        expiresAt: row.expires_at
      }));
    } catch (error) {
      console.error('Error getting all user roles:', error);
      return [];
    }
  }

  // ===========================================================================
  // PERMISSION CHECKING
  // ===========================================================================

  /**
   * Check if user has a specific permission
   */
  async checkPermission(
    userId: string, 
    permission: Permission, 
    tenantId?: string
  ): Promise<boolean> {
    const role = await this.getUserRole(userId, tenantId);
    return roleHasPermission(role, permission);
  }

  /**
   * Check permission with detailed result
   */
  async checkPermissionDetailed(
    userId: string,
    permission: Permission,
    tenantId?: string
  ): Promise<PermissionCheck> {
    const role = await this.getUserRole(userId, tenantId);
    const allowed = roleHasPermission(role, permission);

    return {
      allowed,
      role,
      permission,
      reason: allowed 
        ? `Role ${role} has permission ${permission}` 
        : `Role ${role} does not have permission ${permission}`
    };
  }

  /**
   * Get all permissions for a user (based on their role)
   */
  async getPermissions(userId: string, tenantId?: string): Promise<Permission[]> {
    const role = await this.getUserRole(userId, tenantId);
    return getPermissionsForRole(role);
  }

  /**
   * Get permissions for a role (static lookup)
   */
  getPermissionsForRole(role: Role): Permission[] {
    return getPermissionsForRole(role);
  }

  // ===========================================================================
  // ROLE QUERIES
  // ===========================================================================

  /**
   * Get all users with a specific role in a tenant
   */
  async getUsersByRole(role: Role, tenantId: string): Promise<string[]> {
    const query = `
      SELECT user_id 
      FROM user_roles 
      WHERE role = $1 AND tenant_id = $2
      AND (expires_at IS NULL OR expires_at > NOW())
    `;

    try {
      const result = await this.pool.query(query, [role, tenantId]);
      return result.rows.map(row => row.user_id);
    } catch (error) {
      console.error('Error getting users by role:', error);
      return [];
    }
  }

  /**
   * Get all admins across all tenants
   */
  async getAllAdmins(): Promise<Array<{ userId: string; tenantId: string }>> {
    const query = `
      SELECT user_id, tenant_id 
      FROM user_roles 
      WHERE role = $1
      AND (expires_at IS NULL OR expires_at > NOW())
    `;

    try {
      const result = await this.pool.query(query, [Role.ADMIN]);
      return result.rows.map(row => ({
        userId: row.user_id,
        tenantId: row.tenant_id
      }));
    } catch (error) {
      console.error('Error getting all admins:', error);
      return [];
    }
  }

  /**
   * Count users by role in a tenant
   */
  async countUsersByRole(tenantId: string): Promise<Record<Role, number>> {
    const query = `
      SELECT role, COUNT(*) as count
      FROM user_roles
      WHERE tenant_id = $1
      AND (expires_at IS NULL OR expires_at > NOW())
      GROUP BY role
    `;

    const counts: Record<Role, number> = {
      [Role.ADMIN]: 0,
      [Role.VENTURE_LEAD]: 0,
      [Role.CONSULTANT]: 0,
      [Role.VIEWER]: 0
    };

    try {
      const result = await this.pool.query(query, [tenantId]);
      for (const row of result.rows) {
        counts[row.role as Role] = parseInt(row.count, 10);
      }
      return counts;
    } catch (error) {
      console.error('Error counting users by role:', error);
      return counts;
    }
  }

  // ===========================================================================
  // AZURE AD INTEGRATION
  // ===========================================================================

  /**
   * Sync user roles from Azure AD groups
   * Called after Azure AD login
   */
  async syncFromAzureGroups(
    userId: string, 
    azureGroups: string[], 
    tenantId: string
  ): Promise<Role> {
    // Map Azure groups to roles
    const mappedRoles = AZURE_GROUP_MAPPINGS
      .filter(mapping => azureGroups.includes(mapping.groupId))
      .map(mapping => mapping.role);

    // Get highest role (or default)
    const effectiveRole = mappedRoles.length > 0 
      ? getHighestRole(mappedRoles) 
      : DEFAULT_ROLE;

    // Update user's role in database
    await this.setUserRole(userId, effectiveRole, tenantId, 'azure_sync');

    return effectiveRole;
  }

  /**
   * Get Azure group mappings for display
   */
  getAzureGroupMappings(): typeof AZURE_GROUP_MAPPINGS {
    return AZURE_GROUP_MAPPINGS;
  }

  // ===========================================================================
  // ROLE HIERARCHY HELPERS
  // ===========================================================================

  /**
   * Check if user can manage another user's role
   * (Must have higher role to manage)
   */
  async canManageUserRole(
    managerUserId: string, 
    targetUserId: string, 
    tenantId: string
  ): Promise<boolean> {
    const managerRole = await this.getUserRole(managerUserId, tenantId);
    const targetRole = await this.getUserRole(targetUserId, tenantId);

    const managerIndex = ROLE_HIERARCHY.indexOf(managerRole);
    const targetIndex = ROLE_HIERARCHY.indexOf(targetRole);

    // Manager must have strictly higher role
    return managerIndex > targetIndex;
  }

  /**
   * Get roles that a user can assign to others
   */
  async getAssignableRoles(userId: string, tenantId: string): Promise<Role[]> {
    const userRole = await this.getUserRole(userId, tenantId);
    const userIndex = ROLE_HIERARCHY.indexOf(userRole);

    // Can only assign roles lower than own
    return ROLE_HIERARCHY.slice(0, userIndex) as Role[];
  }

  // ===========================================================================
  // DATABASE SCHEMA
  // ===========================================================================

  /**
   * Create user_roles table if not exists
   */
  async ensureSchema(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        tenant_id UUID NOT NULL,
        granted_by VARCHAR(255),
        granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE,
        PRIMARY KEY (user_id, tenant_id),
        CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
      CREATE INDEX IF NOT EXISTS idx_user_roles_tenant ON user_roles(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_user_roles_expires ON user_roles(expires_at) WHERE expires_at IS NOT NULL;
    `;

    try {
      await this.pool.query(query);
      console.log('✅ RBAC schema ensured');
    } catch (error) {
      console.error('Error ensuring RBAC schema:', error);
      throw error;
    }
  }
}

// Singleton instance factory
let instance: RBACService | null = null;

export function getRBACService(pool: Pool): RBACService {
  if (!instance) {
    instance = new RBACService(pool);
  }
  return instance;
}

export default RBACService;
