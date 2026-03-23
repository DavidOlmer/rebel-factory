/**
 * Migration: Multi-Tenant Architecture
 * REBAA-28
 * 
 * Creates tenant infrastructure and adds tenant_id to existing tables
 */
import { pool } from '../client';

export const name = '001_multi_tenant';
export const description = 'Add multi-tenant support with tenant isolation and cross-tenant agent sharing';

export async function up(): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create tenants table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        azure_tenant_id VARCHAR(100),
        settings JSONB DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create indexes for tenants
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
      CREATE INDEX IF NOT EXISTS idx_tenants_azure ON tenants(azure_tenant_id) WHERE azure_tenant_id IS NOT NULL;
    `);

    // Add tenant_id to agents
    await client.query(`
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
      CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);
    `);

    // Add tenant_id to sprints
    await client.query(`
      ALTER TABLE sprints ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
      CREATE INDEX IF NOT EXISTS idx_sprints_tenant ON sprints(tenant_id);
    `);

    // Create shared_agents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shared_agents (
        agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        shared_with_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        permissions VARCHAR(20) DEFAULT 'read' CHECK (permissions IN ('read', 'execute', 'clone')),
        shared_by VARCHAR(100),
        shared_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        PRIMARY KEY (agent_id, shared_with_tenant_id)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_shared_agents_tenant ON shared_agents(shared_with_tenant_id);
    `);

    // Create audit log table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id),
        user_id VARCHAR(100),
        action VARCHAR(50) NOT NULL,
        resource_type VARCHAR(50),
        resource_id UUID,
        details JSONB,
        ip_address INET,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_tenant ON tenant_audit_log(tenant_id, created_at DESC);
    `);

    // Create helper functions
    await client.query(`
      CREATE OR REPLACE FUNCTION get_tenant_by_slug(p_slug VARCHAR)
      RETURNS TABLE (
        id UUID,
        name VARCHAR,
        slug VARCHAR,
        azure_tenant_id VARCHAR,
        settings JSONB,
        status VARCHAR,
        created_at TIMESTAMPTZ
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT t.id, t.name, t.slug, t.azure_tenant_id, t.settings, t.status, t.created_at
        FROM tenants t
        WHERE t.slug = p_slug AND t.status = 'active';
      END;
      $$ LANGUAGE plpgsql
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION get_accessible_agents(p_tenant_id UUID)
      RETURNS TABLE (
        id UUID,
        name VARCHAR,
        tenant_id UUID,
        is_shared BOOLEAN,
        permissions VARCHAR
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT a.id, a.name, a.tenant_id, FALSE as is_shared, 'owner'::VARCHAR as permissions
        FROM agents a
        WHERE a.tenant_id = p_tenant_id
        
        UNION ALL
        
        SELECT a.id, a.name, a.tenant_id, TRUE as is_shared, sa.permissions
        FROM agents a
        JOIN shared_agents sa ON sa.agent_id = a.id
        WHERE sa.shared_with_tenant_id = p_tenant_id
          AND (sa.expires_at IS NULL OR sa.expires_at > NOW());
      END;
      $$ LANGUAGE plpgsql
    `);

    // Record migration
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(
      `INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
      [name]
    );

    await client.query('COMMIT');
    console.log(`Migration ${name} completed successfully`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Migration ${name} failed:`, error);
    throw error;
  } finally {
    client.release();
  }
}

export async function down(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Drop functions
    await client.query('DROP FUNCTION IF EXISTS get_accessible_agents(UUID)');
    await client.query('DROP FUNCTION IF EXISTS get_tenant_by_slug(VARCHAR)');

    // Drop audit log
    await client.query('DROP TABLE IF EXISTS tenant_audit_log');

    // Drop shared_agents
    await client.query('DROP TABLE IF EXISTS shared_agents');

    // Remove tenant_id from sprints
    await client.query('DROP INDEX IF EXISTS idx_sprints_tenant');
    await client.query('ALTER TABLE sprints DROP COLUMN IF EXISTS tenant_id');

    // Remove tenant_id from agents
    await client.query('DROP INDEX IF EXISTS idx_agents_tenant');
    await client.query('ALTER TABLE agents DROP COLUMN IF EXISTS tenant_id');

    // Drop tenants table
    await client.query('DROP TABLE IF EXISTS tenants');

    // Remove migration record
    await client.query('DELETE FROM _migrations WHERE name = $1', [name]);

    await client.query('COMMIT');
    console.log(`Migration ${name} rolled back successfully`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Migration ${name} rollback failed:`, error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if executed directly
if (require.main === module) {
  const action = process.argv[2];
  
  if (action === 'up') {
    up().then(() => process.exit(0)).catch(() => process.exit(1));
  } else if (action === 'down') {
    down().then(() => process.exit(0)).catch(() => process.exit(1));
  } else {
    console.log('Usage: npx ts-node 001_multi_tenant.ts [up|down]');
    process.exit(1);
  }
}
