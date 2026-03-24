/**
 * RBAC Routes - REBAA-26
 * Role management API endpoints
 */

import { Router, Request, Response } from 'express';
import { validateToken } from '../middleware/auth';
import { requireAdmin, requireVentureLead, canAccess, initRBAC } from '../middleware/rbac';
import { getRBACService } from '../services/rbac.service';
import { Role, ROLE_HIERARCHY } from '../types/rbac';
import { getPermissionsForRole, AZURE_GROUP_MAPPINGS } from '../config/permissions';
import { getPool } from '../db/client';

const router = Router();

// ===========================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ===========================================================================
router.use(validateToken);
router.use(initRBAC);

// ===========================================================================
// CURRENT USER ENDPOINTS
// ===========================================================================

/**
 * GET /rbac/me
 * Get current user's role and permissions
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const rbacService = getRBACService(pool);
    const tenantId = (req as any).tenantId;

    const role = await rbacService.getUserRole(req.user!.id, tenantId);
    const permissions = rbacService.getPermissionsForRole(role);

    res.json({
      userId: req.user!.id,
      role,
      permissions,
      roleHierarchy: ROLE_HIERARCHY,
      isAdmin: role === Role.ADMIN,
      isVentureLead: role === Role.ADMIN || role === Role.VENTURE_LEAD
    });
  } catch (error) {
    console.error('Error getting current user role:', error);
    res.status(500).json({ error: 'Failed to get user role' });
  }
});

/**
 * GET /rbac/me/permissions/:permission
 * Check if current user has a specific permission
 */
router.get('/me/permissions/:permission', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const rbacService = getRBACService(pool);
    const tenantId = (req as any).tenantId;
    const permission = req.params.permission;

    const result = await rbacService.checkPermissionDetailed(
      req.user!.id,
      permission as any,
      tenantId
    );

    res.json(result);
  } catch (error) {
    console.error('Error checking permission:', error);
    res.status(500).json({ error: 'Failed to check permission' });
  }
});

// ===========================================================================
// USER ROLE MANAGEMENT (Admin/Venture Lead only)
// ===========================================================================

/**
 * GET /rbac/users
 * List all users with roles in current tenant
 */
router.get('/users', requireVentureLead, async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const tenantId = (req as any).tenantId;

    const result = await pool.query(`
      SELECT user_id, role, granted_by, granted_at, expires_at
      FROM user_roles
      WHERE tenant_id = $1
      AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY granted_at DESC
    `, [tenantId]);

    res.json({
      users: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error listing user roles:', error);
    res.status(500).json({ error: 'Failed to list user roles' });
  }
});

/**
 * GET /rbac/users/:userId
 * Get a specific user's role
 */
router.get('/users/:userId', requireVentureLead, async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const rbacService = getRBACService(pool);
    const tenantId = (req as any).tenantId;
    const { userId } = req.params;

    const role = await rbacService.getUserRole(userId, tenantId);
    const permissions = rbacService.getPermissionsForRole(role);
    const allRoles = await rbacService.getAllUserRoles(userId);

    res.json({
      userId,
      role,
      permissions,
      allRoles
    });
  } catch (error) {
    console.error('Error getting user role:', error);
    res.status(500).json({ error: 'Failed to get user role' });
  }
});

/**
 * PUT /rbac/users/:userId/role
 * Set a user's role (Admin only)
 */
router.put('/users/:userId/role', requireAdmin, async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const rbacService = getRBACService(pool);
    const tenantId = (req as any).tenantId;
    const { userId } = req.params;
    const { role, expiresAt } = req.body;

    // Validate role
    if (!Object.values(Role).includes(role)) {
      res.status(400).json({ error: 'Invalid role', validRoles: Object.values(Role) });
      return;
    }

    // Prevent self-demotion for admins (safety)
    if (userId === req.user!.id && role !== Role.ADMIN) {
      res.status(400).json({ error: 'Cannot demote yourself' });
      return;
    }

    await rbacService.setUserRole(
      userId,
      role as Role,
      tenantId,
      req.user!.id,
      expiresAt ? new Date(expiresAt) : undefined
    );

    res.json({
      success: true,
      userId,
      role,
      grantedBy: req.user!.id
    });
  } catch (error) {
    console.error('Error setting user role:', error);
    res.status(500).json({ error: 'Failed to set user role' });
  }
});

/**
 * DELETE /rbac/users/:userId/role
 * Remove a user's role (Admin only)
 */
router.delete('/users/:userId/role', requireAdmin, async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const rbacService = getRBACService(pool);
    const tenantId = (req as any).tenantId;
    const { userId } = req.params;

    // Prevent self-removal
    if (userId === req.user!.id) {
      res.status(400).json({ error: 'Cannot remove your own role' });
      return;
    }

    await rbacService.removeUserRole(userId, tenantId);

    res.json({
      success: true,
      userId,
      message: 'Role removed'
    });
  } catch (error) {
    console.error('Error removing user role:', error);
    res.status(500).json({ error: 'Failed to remove user role' });
  }
});

// ===========================================================================
// ROLE STATISTICS
// ===========================================================================

/**
 * GET /rbac/stats
 * Get role statistics for current tenant
 */
router.get('/stats', requireVentureLead, async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const rbacService = getRBACService(pool);
    const tenantId = (req as any).tenantId;

    const counts = await rbacService.countUsersByRole(tenantId);

    res.json({
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      roleHierarchy: ROLE_HIERARCHY
    });
  } catch (error) {
    console.error('Error getting role stats:', error);
    res.status(500).json({ error: 'Failed to get role statistics' });
  }
});

// ===========================================================================
// ROLE AUDIT LOG
// ===========================================================================

/**
 * GET /rbac/audit
 * Get role change audit log
 */
router.get('/audit', canAccess('audit', 'read'), async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const tenantId = (req as any).tenantId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await pool.query(`
      SELECT id, user_id, old_role, new_role, action, changed_by, reason, created_at
      FROM role_audit_log
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [tenantId, limit, offset]);

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM role_audit_log WHERE tenant_id = $1',
      [tenantId]
    );

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      limit,
      offset
    });
  } catch (error) {
    console.error('Error getting role audit log:', error);
    res.status(500).json({ error: 'Failed to get role audit log' });
  }
});

// ===========================================================================
// AZURE AD GROUP MAPPINGS (Admin only)
// ===========================================================================

/**
 * GET /rbac/azure-groups
 * List Azure AD group mappings
 */
router.get('/azure-groups', requireAdmin, async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const tenantId = (req as any).tenantId;

    const result = await pool.query(`
      SELECT id, azure_group_id, azure_group_name, role, priority, is_active, created_at
      FROM azure_group_mappings
      WHERE tenant_id = $1
      ORDER BY priority DESC, created_at ASC
    `, [tenantId]);

    res.json({
      mappings: result.rows,
      defaultMappings: AZURE_GROUP_MAPPINGS
    });
  } catch (error) {
    console.error('Error getting Azure group mappings:', error);
    res.status(500).json({ error: 'Failed to get Azure group mappings' });
  }
});

/**
 * POST /rbac/azure-groups
 * Add Azure AD group mapping
 */
router.post('/azure-groups', requireAdmin, async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const tenantId = (req as any).tenantId;
    const { azureGroupId, azureGroupName, role, priority } = req.body;

    // Validate role
    if (!Object.values(Role).includes(role)) {
      res.status(400).json({ error: 'Invalid role', validRoles: Object.values(Role) });
      return;
    }

    const result = await pool.query(`
      INSERT INTO azure_group_mappings (tenant_id, azure_group_id, azure_group_name, role, priority)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (tenant_id, azure_group_id)
      DO UPDATE SET azure_group_name = EXCLUDED.azure_group_name, 
                    role = EXCLUDED.role, 
                    priority = EXCLUDED.priority,
                    updated_at = NOW()
      RETURNING *
    `, [tenantId, azureGroupId, azureGroupName, role, priority || 0]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding Azure group mapping:', error);
    res.status(500).json({ error: 'Failed to add Azure group mapping' });
  }
});

/**
 * DELETE /rbac/azure-groups/:id
 * Remove Azure AD group mapping
 */
router.delete('/azure-groups/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const result = await pool.query(`
      DELETE FROM azure_group_mappings
      WHERE id = $1 AND tenant_id = $2
      RETURNING id
    `, [id, tenantId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Group mapping not found' });
      return;
    }

    res.json({ success: true, deleted: id });
  } catch (error) {
    console.error('Error deleting Azure group mapping:', error);
    res.status(500).json({ error: 'Failed to delete Azure group mapping' });
  }
});

// ===========================================================================
// REFERENCE DATA
// ===========================================================================

/**
 * GET /rbac/roles
 * Get all available roles with their permissions
 */
router.get('/roles', (_req: Request, res: Response) => {
  const roles = Object.values(Role).map(role => ({
    role,
    permissions: getPermissionsForRole(role),
    hierarchyIndex: ROLE_HIERARCHY.indexOf(role)
  }));

  res.json({
    roles,
    hierarchy: ROLE_HIERARCHY
  });
});

export default router;
