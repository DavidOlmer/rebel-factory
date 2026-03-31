/**
 * REBAA-27: Enterprise Audit Service
 * Provides comprehensive audit logging, querying, and export capabilities
 */
import { query, queryOne, transaction } from '../db/client';
import type {
  AuditEntry,
  AuditFilters,
  AuditLog,
  AuditQueryResult,
  AuditSummary,
  AuditExportOptions,
} from '../types/audit';

// =============================================================================
// AUDIT LOGGING
// =============================================================================

/**
 * Log an audit entry
 */
export async function log(entry: AuditEntry): Promise<AuditLog> {
  const rows = await query<AuditLog>(
    `INSERT INTO audit_logs (
      user_id, user_email, tenant_id,
      action, resource_type, resource_id,
      ip_address, user_agent, correlation_id,
      request_method, request_path,
      before_state, after_state, metadata,
      success, error_message
    ) VALUES (
      $1, $2, $3,
      $4, $5, $6,
      $7::inet, $8, $9::uuid,
      $10, $11,
      $12::jsonb, $13::jsonb, $14::jsonb,
      $15, $16
    )
    RETURNING 
      id, timestamp,
      user_id as "userId", user_email as "userEmail", tenant_id as "tenantId",
      action, resource_type as "resourceType", resource_id as "resourceId",
      ip_address as "ipAddress", user_agent as "userAgent", 
      correlation_id as "correlationId",
      request_method as "requestMethod", request_path as "requestPath",
      before_state as "beforeState", after_state as "afterState", metadata,
      success, error_message as "errorMessage",
      created_at as "createdAt"`,
    [
      entry.userId || null,
      entry.userEmail || null,
      entry.tenantId || null,
      entry.action,
      entry.resourceType,
      entry.resourceId || null,
      entry.ipAddress || null,
      entry.userAgent || null,
      entry.correlationId || null,
      entry.requestMethod || null,
      entry.requestPath || null,
      entry.beforeState ? JSON.stringify(entry.beforeState) : null,
      entry.afterState ? JSON.stringify(entry.afterState) : null,
      entry.metadata ? JSON.stringify(entry.metadata) : '{}',
      entry.success ?? true,
      entry.errorMessage || null,
    ]
  );

  return rows[0];
}

/**
 * Batch log multiple audit entries (for bulk operations)
 */
export async function logBatch(entries: AuditEntry[]): Promise<AuditLog[]> {
  if (entries.length === 0) return [];

  return transaction(async (client) => {
    const results: AuditLog[] = [];
    
    for (const entry of entries) {
      const result = await client.query(
        `INSERT INTO audit_logs (
          user_id, user_email, tenant_id,
          action, resource_type, resource_id,
          ip_address, user_agent, correlation_id,
          request_method, request_path,
          before_state, after_state, metadata,
          success, error_message
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7::inet, $8, $9::uuid,
          $10, $11,
          $12::jsonb, $13::jsonb, $14::jsonb,
          $15, $16
        )
        RETURNING 
          id, timestamp,
          user_id as "userId", user_email as "userEmail", tenant_id as "tenantId",
          action, resource_type as "resourceType", resource_id as "resourceId",
          ip_address as "ipAddress", user_agent as "userAgent",
          correlation_id as "correlationId",
          request_method as "requestMethod", request_path as "requestPath",
          before_state as "beforeState", after_state as "afterState", metadata,
          success, error_message as "errorMessage",
          created_at as "createdAt"`,
        [
          entry.userId || null,
          entry.userEmail || null,
          entry.tenantId || null,
          entry.action,
          entry.resourceType,
          entry.resourceId || null,
          entry.ipAddress || null,
          entry.userAgent || null,
          entry.correlationId || null,
          entry.requestMethod || null,
          entry.requestPath || null,
          entry.beforeState ? JSON.stringify(entry.beforeState) : null,
          entry.afterState ? JSON.stringify(entry.afterState) : null,
          entry.metadata ? JSON.stringify(entry.metadata) : '{}',
          entry.success ?? true,
          entry.errorMessage || null,
        ]
      );
      results.push(result.rows[0]);
    }
    
    return results;
  });
}

// =============================================================================
// AUDIT QUERYING
// =============================================================================

/**
 * Query audit logs with filters
 */
export async function queryLogs(filters: Partial<AuditFilters> = {}): Promise<AuditQueryResult> {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let paramIndex = 1;

  // Time range filters
  if (filters.startDate) {
    conditions.push(`timestamp >= $${paramIndex++}`);
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push(`timestamp <= $${paramIndex++}`);
    params.push(filters.endDate);
  }

  // User filters
  if (filters.userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(filters.userId);
  }
  if (filters.userEmail) {
    conditions.push(`user_email ILIKE $${paramIndex++}`);
    params.push(`%${filters.userEmail}%`);
  }
  if (filters.tenantId) {
    conditions.push(`tenant_id = $${paramIndex++}`);
    params.push(filters.tenantId);
  }

  // Action filters
  if (filters.action) {
    conditions.push(`action = $${paramIndex++}`);
    params.push(filters.action);
  }
  if (filters.actions && filters.actions.length > 0) {
    conditions.push(`action = ANY($${paramIndex++})`);
    params.push(filters.actions);
  }
  if (filters.resourceType) {
    conditions.push(`resource_type = $${paramIndex++}`);
    params.push(filters.resourceType);
  }
  if (filters.resourceId) {
    conditions.push(`resource_id = $${paramIndex++}`);
    params.push(filters.resourceId);
  }

  // Status filter
  if (filters.success !== undefined) {
    conditions.push(`success = $${paramIndex++}`);
    params.push(filters.success);
  }

  // Correlation filter
  if (filters.correlationId) {
    conditions.push(`correlation_id = $${paramIndex++}`);
    params.push(filters.correlationId);
  }

  const whereClause = conditions.join(' AND ');
  const orderColumn = {
    timestamp: 'timestamp',
    action: 'action',
    resource_type: 'resource_type',
  }[filters.orderBy || 'timestamp'];
  const orderDir = filters.orderDir || 'desc';
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM audit_logs WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count || '0', 10);

  // Get logs
  const logs = await query<AuditLog>(
    `SELECT 
      id, timestamp,
      user_id as "userId", user_email as "userEmail", tenant_id as "tenantId",
      action, resource_type as "resourceType", resource_id as "resourceId",
      ip_address as "ipAddress", user_agent as "userAgent",
      correlation_id as "correlationId",
      request_method as "requestMethod", request_path as "requestPath",
      before_state as "beforeState", after_state as "afterState", metadata,
      success, error_message as "errorMessage",
      created_at as "createdAt"
    FROM audit_logs
    WHERE ${whereClause}
    ORDER BY ${orderColumn} ${orderDir}
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  return {
    logs,
    total,
    limit,
    offset,
  };
}

/**
 * Get a single audit log by ID
 */
export async function getById(id: string): Promise<AuditLog | null> {
  return queryOne<AuditLog>(
    `SELECT 
      id, timestamp,
      user_id as "userId", user_email as "userEmail", tenant_id as "tenantId",
      action, resource_type as "resourceType", resource_id as "resourceId",
      ip_address as "ipAddress", user_agent as "userAgent",
      correlation_id as "correlationId",
      request_method as "requestMethod", request_path as "requestPath",
      before_state as "beforeState", after_state as "afterState", metadata,
      success, error_message as "errorMessage",
      created_at as "createdAt"
    FROM audit_logs
    WHERE id = $1`,
    [id]
  );
}

/**
 * Get audit logs for a specific resource
 */
export async function getResourceHistory(
  resourceType: string,
  resourceId: string,
  limit = 50
): Promise<AuditLog[]> {
  return query<AuditLog>(
    `SELECT 
      id, timestamp,
      user_id as "userId", user_email as "userEmail", tenant_id as "tenantId",
      action, resource_type as "resourceType", resource_id as "resourceId",
      ip_address as "ipAddress", user_agent as "userAgent",
      correlation_id as "correlationId",
      request_method as "requestMethod", request_path as "requestPath",
      before_state as "beforeState", after_state as "afterState", metadata,
      success, error_message as "errorMessage",
      created_at as "createdAt"
    FROM audit_logs
    WHERE resource_type = $1 AND resource_id = $2
    ORDER BY timestamp DESC
    LIMIT $3`,
    [resourceType, resourceId, limit]
  );
}

/**
 * Get audit summary statistics
 */
export async function getSummary(
  tenantId?: string,
  startDate?: string,
  endDate?: string
): Promise<AuditSummary[]> {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (tenantId) {
    conditions.push(`tenant_id = $${paramIndex++}`);
    params.push(tenantId);
  }
  if (startDate) {
    conditions.push(`timestamp >= $${paramIndex++}`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`timestamp <= $${paramIndex++}`);
    params.push(endDate);
  }

  return query<AuditSummary>(
    `SELECT 
      action,
      resource_type as "resourceType",
      COUNT(*) as "totalCount",
      COUNT(*) FILTER (WHERE success = true) as "successCount",
      COUNT(*) FILTER (WHERE success = false) as "failureCount",
      COUNT(DISTINCT user_id) as "uniqueUsers"
    FROM audit_logs
    WHERE ${conditions.join(' AND ')}
    GROUP BY action, resource_type
    ORDER BY "totalCount" DESC`,
    params
  );
}

// =============================================================================
// AUDIT EXPORT
// =============================================================================

/**
 * Export audit logs to JSON or CSV format
 */
export async function exportLogs(options: AuditExportOptions): Promise<Buffer> {
  const { format, includeMetadata = true, maxRows = 10000 } = options;
  const filters: Partial<AuditFilters> = options.filters ?? {};

  // Override limit with maxRows
  const result = await queryLogs({
    ...filters,
    limit: maxRows,
    offset: 0,
    orderBy: filters.orderBy ?? 'timestamp',
    orderDir: filters.orderDir ?? 'desc',
  });

  if (format === 'json') {
    return exportToJson(result.logs, includeMetadata);
  } else {
    return exportToCsv(result.logs, includeMetadata);
  }
}

function exportToJson(logs: AuditLog[], includeMetadata: boolean): Buffer {
  const data = logs.map((log) => {
    const entry: Record<string, unknown> = {
      id: log.id,
      timestamp: log.timestamp,
      userId: log.userId,
      userEmail: log.userEmail,
      tenantId: log.tenantId,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      ipAddress: log.ipAddress,
      success: log.success,
      errorMessage: log.errorMessage,
    };

    if (includeMetadata) {
      entry.userAgent = log.userAgent;
      entry.correlationId = log.correlationId;
      entry.requestMethod = log.requestMethod;
      entry.requestPath = log.requestPath;
      entry.beforeState = log.beforeState;
      entry.afterState = log.afterState;
      entry.metadata = log.metadata;
    }

    return entry;
  });

  return Buffer.from(JSON.stringify(data, null, 2));
}

function exportToCsv(logs: AuditLog[], includeMetadata: boolean): Buffer {
  const baseHeaders = [
    'id',
    'timestamp',
    'userId',
    'userEmail',
    'tenantId',
    'action',
    'resourceType',
    'resourceId',
    'ipAddress',
    'success',
    'errorMessage',
  ];

  const metadataHeaders = [
    'userAgent',
    'correlationId',
    'requestMethod',
    'requestPath',
    'beforeState',
    'afterState',
    'metadata',
  ];

  const headers = includeMetadata
    ? [...baseHeaders, ...metadataHeaders]
    : baseHeaders;

  const escapeCSV = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    // Escape double quotes and wrap in quotes if contains comma, newline, or quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = logs.map((log) => {
    const baseValues = [
      log.id,
      log.timestamp,
      log.userId,
      log.userEmail,
      log.tenantId,
      log.action,
      log.resourceType,
      log.resourceId,
      log.ipAddress,
      log.success,
      log.errorMessage,
    ];

    const metadataValues = [
      log.userAgent,
      log.correlationId,
      log.requestMethod,
      log.requestPath,
      log.beforeState,
      log.afterState,
      log.metadata,
    ];

    const values = includeMetadata
      ? [...baseValues, ...metadataValues]
      : baseValues;

    return values.map(escapeCSV).join(',');
  });

  return Buffer.from([headers.join(','), ...rows].join('\n'));
}

// =============================================================================
// CLEANUP / MAINTENANCE
// =============================================================================

/**
 * Delete old audit logs (for retention policy)
 */
export async function deleteOldLogs(retentionDays: number): Promise<number> {
  const result = await query<{ count: number }>(
    `WITH deleted AS (
      DELETE FROM audit_logs
      WHERE timestamp < NOW() - ($1 || ' days')::INTERVAL
      RETURNING id
    )
    SELECT COUNT(*) as count FROM deleted`,
    [retentionDays]
  );

  return result[0]?.count || 0;
}

// =============================================================================
// AUDIT SERVICE OBJECT
// =============================================================================

export const AuditService = {
  log,
  logBatch,
  query: queryLogs,
  getById,
  getResourceHistory,
  getSummary,
  export: exportLogs,
  deleteOldLogs,
};

export default AuditService;
