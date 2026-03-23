/**
 * Tenant Service
 * REBAA-28: Multi-Tenant Architecture
 * 
 * Manages tenant CRUD operations and cross-tenant agent sharing
 */
import { query, queryOne, transaction } from '../db/client';
import type { PoolClient } from 'pg';
import type { 
  Tenant, 
  CreateTenant, 
  UpdateTenant, 
  SharedAgent,
  ShareAgentRequest,
} from '../types';

// =============================================================================
// TENANT CRUD
// =============================================================================

/**
 * Create a new tenant
 */
export async function createTenant(data: CreateTenant): Promise<Tenant> {
  const rows = await query<Tenant>(
    `INSERT INTO tenants (name, slug, azure_tenant_id, settings, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, slug, 
               azure_tenant_id as "azureTenantId",
               settings, status,
               created_at as "createdAt",
               updated_at as "updatedAt"`,
    [
      data.name,
      data.slug,
      data.azureTenantId || null,
      JSON.stringify(data.settings || {}),
      'active',
    ]
  );
  return rows[0];
}

/**
 * Get tenant by ID
 */
export async function getTenantById(id: string): Promise<Tenant | null> {
  return queryOne<Tenant>(
    `SELECT id, name, slug,
            azure_tenant_id as "azureTenantId",
            settings, status,
            created_at as "createdAt",
            updated_at as "updatedAt"
     FROM tenants
     WHERE id = $1`,
    [id]
  );
}

/**
 * Get tenant by slug
 */
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  return queryOne<Tenant>(
    `SELECT id, name, slug,
            azure_tenant_id as "azureTenantId",
            settings, status,
            created_at as "createdAt",
            updated_at as "updatedAt"
     FROM tenants
     WHERE slug = $1`,
    [slug]
  );
}

/**
 * Get tenant by Azure AD tenant ID
 */
export async function getTenantByAzureTenant(azureTenantId: string): Promise<Tenant | null> {
  return queryOne<Tenant>(
    `SELECT id, name, slug,
            azure_tenant_id as "azureTenantId",
            settings, status,
            created_at as "createdAt",
            updated_at as "updatedAt"
     FROM tenants
     WHERE azure_tenant_id = $1`,
    [azureTenantId]
  );
}

/**
 * List all tenants (admin only)
 */
export async function getAllTenants(includeInactive = false): Promise<Tenant[]> {
  const whereClause = includeInactive ? '' : "WHERE status = 'active'";
  return query<Tenant>(
    `SELECT id, name, slug,
            azure_tenant_id as "azureTenantId",
            settings, status,
            created_at as "createdAt",
            updated_at as "updatedAt"
     FROM tenants
     ${whereClause}
     ORDER BY name ASC`
  );
}

/**
 * Update tenant
 */
export async function updateTenant(id: string, data: UpdateTenant): Promise<Tenant | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramCount = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramCount++}`);
    values.push(data.name);
  }
  if (data.slug !== undefined) {
    fields.push(`slug = $${paramCount++}`);
    values.push(data.slug);
  }
  if (data.azureTenantId !== undefined) {
    fields.push(`azure_tenant_id = $${paramCount++}`);
    values.push(data.azureTenantId);
  }
  if (data.settings !== undefined) {
    fields.push(`settings = $${paramCount++}`);
    values.push(JSON.stringify(data.settings));
  }
  if (data.status !== undefined) {
    fields.push(`status = $${paramCount++}`);
    values.push(data.status);
  }

  if (fields.length === 0) {
    return getTenantById(id);
  }

  fields.push('updated_at = NOW()');
  values.push(id);

  const rows = await query<Tenant>(
    `UPDATE tenants SET ${fields.join(', ')}
     WHERE id = $${paramCount}
     RETURNING id, name, slug,
               azure_tenant_id as "azureTenantId",
               settings, status,
               created_at as "createdAt",
               updated_at as "updatedAt"`,
    values
  );
  return rows[0] || null;
}

/**
 * Delete tenant (soft delete by setting status to inactive)
 */
export async function deleteTenant(id: string): Promise<boolean> {
  const rows = await query(
    `UPDATE tenants SET status = 'inactive', updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [id]
  );
  return rows.length > 0;
}

/**
 * Hard delete tenant (use with caution - cascades to all tenant data)
 */
export async function hardDeleteTenant(id: string): Promise<boolean> {
  return transaction(async (client: PoolClient) => {
    // Delete shared agent references first
    await client.query(
      'DELETE FROM shared_agents WHERE shared_with_tenant_id = $1',
      [id]
    );
    
    // Delete agents owned by tenant
    await client.query(
      'DELETE FROM agents WHERE tenant_id = $1',
      [id]
    );
    
    // Delete tenant
    const result = await client.query(
      'DELETE FROM tenants WHERE id = $1 RETURNING id',
      [id]
    );
    
    return (result.rowCount ?? 0) > 0;
  });
}

// =============================================================================
// CROSS-TENANT AGENT SHARING
// =============================================================================

/**
 * Share an agent with another tenant
 */
export async function shareAgent(request: ShareAgentRequest): Promise<SharedAgent> {
  const rows = await query<SharedAgent>(
    `INSERT INTO shared_agents (agent_id, shared_with_tenant_id, permissions, shared_by, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (agent_id, shared_with_tenant_id) 
     DO UPDATE SET permissions = $3, expires_at = $5
     RETURNING agent_id as "agentId",
               shared_with_tenant_id as "sharedWithTenantId",
               permissions,
               shared_by as "sharedBy",
               shared_at as "sharedAt",
               expires_at as "expiresAt"`,
    [
      request.agentId,
      request.sharedWithTenantId,
      request.permissions || 'read',
      request.sharedBy || null,
      request.expiresAt || null,
    ]
  );
  return rows[0];
}

/**
 * Revoke agent sharing
 */
export async function revokeAgentShare(agentId: string, sharedWithTenantId: string): Promise<boolean> {
  const rows = await query(
    `DELETE FROM shared_agents 
     WHERE agent_id = $1 AND shared_with_tenant_id = $2
     RETURNING agent_id`,
    [agentId, sharedWithTenantId]
  );
  return rows.length > 0;
}

/**
 * Get all agents shared with a tenant
 */
export async function getAgentsSharedWithTenant(tenantId: string): Promise<SharedAgent[]> {
  return query<SharedAgent>(
    `SELECT sa.agent_id as "agentId",
            sa.shared_with_tenant_id as "sharedWithTenantId",
            sa.permissions,
            sa.shared_by as "sharedBy",
            sa.shared_at as "sharedAt",
            sa.expires_at as "expiresAt",
            a.name as "agentName",
            t.name as "ownerTenantName"
     FROM shared_agents sa
     JOIN agents a ON a.id = sa.agent_id
     JOIN tenants t ON t.id = a.tenant_id
     WHERE sa.shared_with_tenant_id = $1
       AND (sa.expires_at IS NULL OR sa.expires_at > NOW())`,
    [tenantId]
  );
}

/**
 * Get all tenants an agent is shared with
 */
export async function getAgentShares(agentId: string): Promise<SharedAgent[]> {
  return query<SharedAgent>(
    `SELECT sa.agent_id as "agentId",
            sa.shared_with_tenant_id as "sharedWithTenantId",
            sa.permissions,
            sa.shared_by as "sharedBy",
            sa.shared_at as "sharedAt",
            sa.expires_at as "expiresAt",
            t.name as "sharedWithTenantName",
            t.slug as "sharedWithTenantSlug"
     FROM shared_agents sa
     JOIN tenants t ON t.id = sa.shared_with_tenant_id
     WHERE sa.agent_id = $1`,
    [agentId]
  );
}

/**
 * Check if a tenant has access to an agent (owned or shared)
 */
export async function canAccessAgent(tenantId: string, agentId: string): Promise<{ hasAccess: boolean; permissions: string }> {
  // Check if owned
  const owned = await queryOne<{ id: string }>(
    'SELECT id FROM agents WHERE id = $1 AND tenant_id = $2',
    [agentId, tenantId]
  );
  
  if (owned) {
    return { hasAccess: true, permissions: 'owner' };
  }

  // Check if shared
  const shared = await queryOne<{ permissions: string }>(
    `SELECT permissions FROM shared_agents 
     WHERE agent_id = $1 AND shared_with_tenant_id = $2
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [agentId, tenantId]
  );

  if (shared) {
    return { hasAccess: true, permissions: shared.permissions };
  }

  return { hasAccess: false, permissions: 'none' };
}

// =============================================================================
// TENANT SETTINGS HELPERS
// =============================================================================

/**
 * Get a specific tenant setting
 */
export async function getTenantSetting<T = unknown>(tenantId: string, key: string): Promise<T | null> {
  const tenant = await getTenantById(tenantId);
  if (!tenant || !tenant.settings) return null;
  return (tenant.settings as Record<string, T>)[key] ?? null;
}

/**
 * Update a specific tenant setting
 */
export async function setTenantSetting(tenantId: string, key: string, value: unknown): Promise<void> {
  await query(
    `UPDATE tenants 
     SET settings = settings || $1::jsonb,
         updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify({ [key]: value }), tenantId]
  );
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Check if slug is available
 */
export async function isSlugAvailable(slug: string, excludeTenantId?: string): Promise<boolean> {
  const whereClause = excludeTenantId 
    ? 'WHERE slug = $1 AND id != $2'
    : 'WHERE slug = $1';
  const params = excludeTenantId ? [slug, excludeTenantId] : [slug];
  
  const rows = await query(
    `SELECT id FROM tenants ${whereClause}`,
    params
  );
  return rows.length === 0;
}

/**
 * Validate tenant slug format
 */
export function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug || slug.length < 2) {
    return { valid: false, error: 'Slug must be at least 2 characters' };
  }
  if (slug.length > 50) {
    return { valid: false, error: 'Slug must be 50 characters or less' };
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length > 1) {
    return { valid: false, error: 'Slug must be lowercase alphanumeric with hyphens, cannot start/end with hyphen' };
  }
  if (/--/.test(slug)) {
    return { valid: false, error: 'Slug cannot contain consecutive hyphens' };
  }
  
  // Reserved slugs
  const reserved = ['www', 'api', 'admin', 'app', 'dashboard', 'login', 'auth', 'static'];
  if (reserved.includes(slug)) {
    return { valid: false, error: `Slug "${slug}" is reserved` };
  }
  
  return { valid: true };
}
