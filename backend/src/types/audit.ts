/**
 * REBAA-27: Audit Logging Types
 * Type definitions for enterprise audit logging
 */
import { z } from 'zod';

// =============================================================================
// AUDIT ACTIONS
// =============================================================================

export const AuditActions = {
  // Agent actions
  AGENT_CREATE: 'agent.create',
  AGENT_UPDATE: 'agent.update',
  AGENT_DELETE: 'agent.delete',
  AGENT_SHARE: 'agent.share',
  AGENT_UNSHARE: 'agent.unshare',
  
  // Sprint actions
  SPRINT_CREATE: 'sprint.create',
  SPRINT_UPDATE: 'sprint.update',
  SPRINT_DELETE: 'sprint.delete',
  SPRINT_COMPLETE: 'sprint.complete',
  
  // User actions
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_REGISTER: 'user.register',
  USER_PASSWORD_CHANGE: 'user.password_change',
  
  // Settings actions
  SETTINGS_UPDATE: 'settings.update',
  
  // File actions
  FILE_UPLOAD: 'file.upload',
  FILE_DOWNLOAD: 'file.download',
  FILE_DELETE: 'file.delete',
  
  // Tenant actions
  TENANT_CREATE: 'tenant.create',
  TENANT_UPDATE: 'tenant.update',
  TENANT_DELETE: 'tenant.delete',
  
  // System actions
  SYSTEM_ERROR: 'system.error',
  API_REQUEST: 'api.request',
} as const;

export type AuditAction = typeof AuditActions[keyof typeof AuditActions];

// =============================================================================
// RESOURCE TYPES
// =============================================================================

export const ResourceTypes = {
  AGENT: 'agent',
  SPRINT: 'sprint',
  USER: 'user',
  TENANT: 'tenant',
  SETTINGS: 'settings',
  FILE: 'file',
  SYSTEM: 'system',
} as const;

export type ResourceType = typeof ResourceTypes[keyof typeof ResourceTypes];

// =============================================================================
// AUDIT ENTRY SCHEMAS
// =============================================================================

export const AuditEntrySchema = z.object({
  // Who
  userId: z.string().uuid().optional(),
  userEmail: z.string().email().optional(),
  tenantId: z.string().uuid().optional(),
  
  // What
  action: z.string().min(1).max(100),
  resourceType: z.string().min(1).max(100),
  resourceId: z.string().max(255).optional(),
  
  // Context
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  correlationId: z.string().uuid().optional(),
  requestMethod: z.string().max(10).optional(),
  requestPath: z.string().optional(),
  
  // State
  beforeState: z.record(z.unknown()).optional(),
  afterState: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  
  // Status
  success: z.boolean().default(true),
  errorMessage: z.string().optional(),
});

export const AuditFiltersSchema = z.object({
  // Time range
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  
  // User filters
  userId: z.string().uuid().optional(),
  userEmail: z.string().optional(),
  tenantId: z.string().uuid().optional(),
  
  // Action filters
  action: z.string().optional(),
  actions: z.array(z.string()).optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  
  // Status
  success: z.boolean().optional(),
  
  // Correlation
  correlationId: z.string().uuid().optional(),
  
  // Pagination
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
  
  // Ordering
  orderBy: z.enum(['timestamp', 'action', 'resource_type']).default('timestamp'),
  orderDir: z.enum(['asc', 'desc']).default('desc'),
});

export const AuditExportOptionsSchema = z.object({
  format: z.enum(['json', 'csv']),
  filters: AuditFiltersSchema.optional(),
  includeMetadata: z.boolean().default(true),
  maxRows: z.number().min(1).max(100000).default(10000),
});

// =============================================================================
// TYPESCRIPT TYPES
// =============================================================================

export type AuditEntry = z.infer<typeof AuditEntrySchema>;
export type AuditFilters = z.infer<typeof AuditFiltersSchema>;
export type AuditExportOptions = z.infer<typeof AuditExportOptionsSchema>;

export interface AuditLog {
  id: string;
  timestamp: Date;
  
  // Who
  userId: string | null;
  userEmail: string | null;
  tenantId: string | null;
  
  // What
  action: string;
  resourceType: string;
  resourceId: string | null;
  
  // Context
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string;
  requestMethod: string | null;
  requestPath: string | null;
  
  // State
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  
  // Status
  success: boolean;
  errorMessage: string | null;
  
  createdAt: Date;
}

export interface AuditSummary {
  action: string;
  resourceType: string;
  totalCount: number;
  successCount: number;
  failureCount: number;
  uniqueUsers: number;
}

export interface AuditQueryResult {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}
