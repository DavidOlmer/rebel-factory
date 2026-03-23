-- REBAA-27: Enterprise Audit Logging Schema
-- Comprehensive audit trail for compliance and security

-- =============================================================================
-- AUDIT LOGS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  -- Who performed the action
  user_id UUID,
  user_email VARCHAR(255),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  
  -- What action was performed
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255),
  
  -- Request context
  ip_address INET,
  user_agent TEXT,
  correlation_id UUID DEFAULT gen_random_uuid(),
  request_method VARCHAR(10),
  request_path TEXT,
  
  -- State tracking
  before_state JSONB,
  after_state JSONB,
  metadata JSONB DEFAULT '{}',
  
  -- Status
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  
  -- Indexing timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR EFFICIENT QUERYING
-- =============================================================================

-- Time-based queries (most common)
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);

-- User activity tracking
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_email ON audit_logs(user_email, timestamp DESC);

-- Tenant isolation
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id, timestamp DESC);

-- Resource lookups
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource_type ON audit_logs(resource_type, timestamp DESC);

-- Action filtering
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, timestamp DESC);

-- Correlation tracking (for request chains)
CREATE INDEX IF NOT EXISTS idx_audit_correlation ON audit_logs(correlation_id);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_audit_tenant_action ON audit_logs(tenant_id, action, timestamp DESC);

-- =============================================================================
-- RETENTION POLICY (Optional - uncomment to enable)
-- =============================================================================

-- Partition by month for easier data management (PostgreSQL 10+)
-- Note: Requires table to be created as partitioned table
-- 
-- CREATE TABLE audit_logs (
--   ...
-- ) PARTITION BY RANGE (timestamp);
--
-- CREATE TABLE audit_logs_2026_03 PARTITION OF audit_logs
--   FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to archive old audit logs
CREATE OR REPLACE FUNCTION archive_old_audit_logs(retention_days INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM audit_logs
  WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get audit summary by action
CREATE OR REPLACE FUNCTION get_audit_summary(
  p_tenant_id UUID DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  action VARCHAR,
  resource_type VARCHAR,
  total_count BIGINT,
  success_count BIGINT,
  failure_count BIGINT,
  unique_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.action,
    al.resource_type,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE al.success = true) as success_count,
    COUNT(*) FILTER (WHERE al.success = false) as failure_count,
    COUNT(DISTINCT al.user_id) as unique_users
  FROM audit_logs al
  WHERE al.timestamp BETWEEN p_start_date AND p_end_date
    AND (p_tenant_id IS NULL OR al.tenant_id = p_tenant_id)
  GROUP BY al.action, al.resource_type
  ORDER BY total_count DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE audit_logs IS 'Enterprise audit trail for all system actions';
COMMENT ON COLUMN audit_logs.correlation_id IS 'Links related audit entries across a request chain';
COMMENT ON COLUMN audit_logs.before_state IS 'Resource state before the action (for updates/deletes)';
COMMENT ON COLUMN audit_logs.after_state IS 'Resource state after the action (for creates/updates)';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context-specific data';
