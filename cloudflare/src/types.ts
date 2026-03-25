export interface Env {
  AI: Ai;
  DB: D1Database;
  STORAGE: R2Bucket;
  CACHE: KVNamespace;
  SESSION_AGENT: DurableObjectNamespace;
  JOB_QUEUE: Queue;
  // Auth
  AZURE_CLIENT_ID?: string;
  AZURE_TENANT_ID?: string;
  AZURE_CLIENT_SECRET?: string;
  JWT_SECRET?: string;
  // LLM keys
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  // Encryption
  ENCRYPTION_KEY?: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  tenantId: string;
  azureId?: string;
}

export type AgentTier = "personal" | "venture" | "core";
export type AgentStatus = "draft" | "active" | "archived";
export type Role = "admin" | "venture_lead" | "consultant" | "viewer";

export interface Agent {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  system_prompt: string;
  model: string;
  tier: AgentTier;
  status: AgentStatus;
  owner_id: string;
  config: string; // JSON
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  azure_tenant_id: string;
  settings: string; // JSON
  status: "active" | "suspended" | "inactive";
  created_at: string;
  updated_at: string;
}
