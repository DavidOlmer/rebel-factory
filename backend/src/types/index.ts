import { z } from 'zod';

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

// WebSocket message types
export interface WSMessage {
  type: 'agent_created' | 'agent_updated' | 'agent_deleted' | 'sprint_created' | 'sprint_updated';
  payload: unknown;
  timestamp: string;
}
