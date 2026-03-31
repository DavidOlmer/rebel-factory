import { z } from 'zod';

// Re-export SharePoint types
export * from './sharepoint';

// Re-export Audit types (REBAA-27)
export * from './audit';

// =============================================================================
// TENANT SCHEMAS (REBAA-28)
// =============================================================================

export const TenantSettingsSchema = z.object({
  maxAgents: z.number().optional(),
  maxSprints: z.number().optional(),
  features: z.array(z.string()).optional(),
  branding: z.object({
    primaryColor: z.string().optional(),
    logo: z.string().url().optional(),
  }).optional(),
}).passthrough();

export const CreateTenantSchema = z.object({
  name: z.string().min(2).max(255),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  azureTenantId: z.string().max(100).optional(),
  settings: TenantSettingsSchema.optional(),
});

export const UpdateTenantSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/).optional(),
  azureTenantId: z.string().max(100).nullable().optional(),
  settings: TenantSettingsSchema.optional(),
  status: z.enum(['active', 'suspended', 'inactive']).optional(),
});

export const ShareAgentRequestSchema = z.object({
  agentId: z.string().uuid(),
  sharedWithTenantId: z.string().uuid(),
  permissions: z.enum(['read', 'execute', 'clone']).default('read'),
  sharedBy: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

// Tenant TypeScript types
export type TenantSettings = z.infer<typeof TenantSettingsSchema>;
export type CreateTenant = z.infer<typeof CreateTenantSchema>;
export type UpdateTenant = z.infer<typeof UpdateTenantSchema>;
export type ShareAgentRequest = z.infer<typeof ShareAgentRequestSchema>;

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  azureTenantId: string | null;
  settings: TenantSettings | null;
  status: 'active' | 'suspended' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface SharedAgent {
  agentId: string;
  sharedWithTenantId: string;
  permissions: 'read' | 'execute' | 'clone';
  sharedBy: string | null;
  sharedAt: Date;
  expiresAt: Date | null;
  // Joined fields (optional)
  agentName?: string;
  ownerTenantName?: string;
  sharedWithTenantName?: string;
  sharedWithTenantSlug?: string;
}

// Agent schemas
export const AgentTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  creature: z.string().min(1).max(50),
  emoji: z.string().max(10),
  systemPrompt: z.string().optional(),
  skills: z.array(z.string()).default([]),
  model: z.string().default('claude-sonnet-4-20250514'),
  config: z.record(z.unknown()).optional(),
});

export const CreateAgentSchema = AgentTemplateSchema.extend({
  templateId: z.string().uuid().optional(),
});

export const UpdateAgentSchema = AgentTemplateSchema.partial();

export const AgentIdSchema = z.object({
  id: z.string().uuid(),
});

// Sprint schemas
export const CreateSprintSchema = z.object({
  agentId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  tasks: z.array(z.object({
    title: z.string(),
    status: z.enum(['pending', 'in_progress', 'done']).default('pending'),
  })).default([]),
});

export const UpdateSprintSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'completed', 'cancelled']).optional(),
});

// TypeScript types
export type AgentTemplate = z.infer<typeof AgentTemplateSchema>;
export type CreateAgent = z.infer<typeof CreateAgentSchema>;
export type UpdateAgent = z.infer<typeof UpdateAgentSchema>;

export type CreateSprint = z.infer<typeof CreateSprintSchema>;
export type UpdateSprint = z.infer<typeof UpdateSprintSchema>;

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  creature: string;
  emoji: string;
  systemPrompt: string | null;
  skills: string[];
  model: string;
  config: Record<string, unknown> | null;
  tenantId?: string | null;
  templateId?: string | null;
  ownerId?: string | null;
  icon?: string | null;
  tier?: 'personal' | 'venture' | 'core';
  status?: 'idle' | 'running' | 'paused' | 'archived';
  temperature?: number | null;
  tools?: string[] | null;
  totalRuns?: number;
  totalTokensUsed?: number;
  avgRunDurationMs?: number;
  lastRunAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Sprint {
  id: string;
  agentId: string;
  title: string;
  description: string | null;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  tasks: { title: string; status: string }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AgentListFilter {
  tenantId?: string;
  tier?: 'personal' | 'venture' | 'core';
  status?: 'idle' | 'running' | 'paused' | 'archived';
  ownerId?: string;
}

export interface AgentRunInput {
  userId: string;
  taskType: 'sprint' | 'chat' | 'analysis' | 'research' | 'review';
  taskDescription?: string;
  tenantId?: string;
}

export interface AgentRunOutput {
  id: string;
  agentId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
}

// WebSocket message types
export interface WSMessage {
  type:
    | 'agent_created'
    | 'agent_updated'
    | 'agent_deleted'
    | 'sprint_created'
    | 'sprint_updated'
    | 'memory_added'
    | 'memory_consolidated'
    | 'batch_consolidation_complete'
    | 'pattern_deleted';
  payload: unknown;
  timestamp: string;
}
