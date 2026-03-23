-- Multi-Tenant Schema for Rebel Factory
-- REBAA-28: Multi-Tenant Architecture

-- =============================================================================
-- TENANTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  azure_tenant_id VARCHAR(100),
  settings JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for slug lookup (subdomain routing)
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- Index for Azure AD tenant mapping
CREATE INDEX IF NOT EXISTS idx_tenants_azure ON tenants(azure_tenant_id) WHERE azure_tenant_id IS NOT NULL;

-- =============================================================================
-- ADD TENANT_ID TO EXISTING TABLES
-- =============================================================================

-- Add tenant_id to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);

-- Add tenant_id to sprints table  
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_sprints_tenant ON sprints(tenant_id);

-- =============================================================================
-- SHARED AGENTS (Cross-Tenant Sharing)
-- =============================================================================
CREATE TABLE IF NOT EXISTS shared_agents (
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  shared_with_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  permissions VARCHAR(20) DEFAULT 'read' CHECK (permissions IN ('read', 'execute', 'clone')),
  shared_by UUID, -- User ID who shared
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Optional expiration
  PRIMARY KEY (agent_id, shared_with_tenant_id)
);

-- Index for finding agents shared with a tenant
CREATE INDEX IF NOT EXISTS idx_shared_agents_tenant ON shared_agents(shared_with_tenant_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on tables (optional - can be enabled per-deployment)
-- ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (uncomment if using RLS)
-- CREATE POLICY tenant_isolation_agents ON agents
--   FOR ALL
--   USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get tenant by slug
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
$$ LANGUAGE plpgsql;

-- Function to get agents accessible by tenant (owned + shared)
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
  -- Owned agents
  SELECT a.id, a.name, a.tenant_id, FALSE as is_shared, 'owner'::VARCHAR as permissions
  FROM agents a
  WHERE a.tenant_id = p_tenant_id
  
  UNION ALL
  
  -- Shared agents
  SELECT a.id, a.name, a.tenant_id, TRUE as is_shared, sa.permissions
  FROM agents a
  JOIN shared_agents sa ON sa.agent_id = a.id
  WHERE sa.shared_with_tenant_id = p_tenant_id
    AND (sa.expires_at IS NULL OR sa.expires_at > NOW());
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- AUDIT LOG (Optional)
-- =============================================================================
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
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON tenant_audit_log(tenant_id, created_at DESC);
