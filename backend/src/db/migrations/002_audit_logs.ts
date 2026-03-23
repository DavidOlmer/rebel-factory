/**
 * REBAA-27: Enterprise Audit Logging Migration
 * Creates comprehensive audit_logs table with indexes
 */
import { Pool } from 'pg';

export const migrationId = '002_audit_logs';
export const description = 'REBAA-27: Enterprise audit logging';

export async function up(pool: Pool): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create audit_logs table
    await client.query(`
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
      )
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, timestamp DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_user_email ON audit_logs(user_email, timestamp DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id, timestamp DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_resource_type ON audit_logs(resource_type, timestamp DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, timestamp DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_correlation ON audit_logs(correlation_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_tenant_action ON audit_logs(tenant_id, action, timestamp DESC)
    `);

    // Create helper functions
    await client.query(`
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
      $$ LANGUAGE plpgsql
    `);

    await client.query(`
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
      $$ LANGUAGE plpgsql
    `);

    // Add table comments
    await client.query(`
      COMMENT ON TABLE audit_logs IS 'Enterprise audit trail for all system actions (REBAA-27)'
    `);
    await client.query(`
      COMMENT ON COLUMN audit_logs.correlation_id IS 'Links related audit entries across a request chain'
    `);
    await client.query(`
      COMMENT ON COLUMN audit_logs.before_state IS 'Resource state before the action (for updates/deletes)'
    `);
    await client.query(`
      COMMENT ON COLUMN audit_logs.after_state IS 'Resource state after the action (for creates/updates)'
    `);

    await client.query('COMMIT');
    console.log('[Migration] 002_audit_logs: UP completed');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function down(pool: Pool): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Drop helper functions
    await client.query('DROP FUNCTION IF EXISTS get_audit_summary');
    await client.query('DROP FUNCTION IF EXISTS archive_old_audit_logs');

    // Drop indexes (will be dropped with table, but explicit for clarity)
    await client.query('DROP INDEX IF EXISTS idx_audit_tenant_action');
    await client.query('DROP INDEX IF EXISTS idx_audit_correlation');
    await client.query('DROP INDEX IF EXISTS idx_audit_action');
    await client.query('DROP INDEX IF EXISTS idx_audit_resource_type');
    await client.query('DROP INDEX IF EXISTS idx_audit_resource');
    await client.query('DROP INDEX IF EXISTS idx_audit_tenant');
    await client.query('DROP INDEX IF EXISTS idx_audit_user_email');
    await client.query('DROP INDEX IF EXISTS idx_audit_user');
    await client.query('DROP INDEX IF EXISTS idx_audit_created_at');
    await client.query('DROP INDEX IF EXISTS idx_audit_timestamp');

    // Drop table
    await client.query('DROP TABLE IF EXISTS audit_logs');

    await client.query('COMMIT');
    console.log('[Migration] 002_audit_logs: DOWN completed');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
