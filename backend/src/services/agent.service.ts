/**
 * REBEL AI FACTORY - AGENT SERVICE
 * REBAA-32: Full CRUD operations with v2 schema support and telemetry
 */

import { Pool } from 'pg';
import { query, queryOne, pool as defaultPool } from '../db/client';
import type { Agent, CreateAgent, UpdateAgent, ValidationResult, AgentListFilter, AgentRunInput, AgentRunOutput } from '../types';
import { TelemetryService } from './telemetry.service';

// ============================================
// CLASS-BASED SERVICE (for DI and testing)
// ============================================

export class AgentService {
  private pool: Pool;
  private telemetry: TelemetryService;

  constructor(pool?: Pool) {
    this.pool = pool || defaultPool;
    this.telemetry = new TelemetryService(this.pool);
  }

  /**
   * List agents with optional filtering
   */
  async list(filter: AgentListFilter = {}): Promise<Agent[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filter.tenantId) {
      conditions.push(`tenant_id = $${paramIndex++}`);
      params.push(filter.tenantId);
    }
    if (filter.tier) {
      conditions.push(`tier = $${paramIndex++}`);
      params.push(filter.tier);
    }
    if (filter.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filter.status);
    }
    if (filter.ownerId) {
      conditions.push(`owner_id = $${paramIndex++}`);
      params.push(filter.ownerId);
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';

    const result = await this.pool.query<Agent>(`
      SELECT 
        id, name, description, 
        COALESCE(creature, 'agent') as creature,
        COALESCE(emoji, '🤖') as emoji,
        system_prompt as "systemPrompt", 
        COALESCE(skills, '{}') as skills, 
        model, config,
        tenant_id as "tenantId",
        template_id as "templateId",
        owner_id as "ownerId",
        icon,
        COALESCE(tier, 'personal') as tier,
        COALESCE(status, 'idle') as status,
        temperature,
        tools,
        total_runs as "totalRuns",
        total_tokens_used as "totalTokensUsed",
        avg_run_duration_ms as "avgRunDurationMs",
        last_run_at as "lastRunAt",
        created_at as "createdAt", 
        updated_at as "updatedAt"
      FROM agents
      ${whereClause}
      ORDER BY created_at DESC
    `, params);

    return result.rows;
  }

  /**
   * Get agent by ID
   */
  async get(id: string): Promise<Agent | null> {
    const result = await this.pool.query<Agent>(`
      SELECT 
        id, name, description, 
        COALESCE(creature, 'agent') as creature,
        COALESCE(emoji, '🤖') as emoji,
        system_prompt as "systemPrompt", 
        COALESCE(skills, '{}') as skills, 
        model, config,
        tenant_id as "tenantId",
        template_id as "templateId",
        owner_id as "ownerId",
        icon,
        COALESCE(tier, 'personal') as tier,
        COALESCE(status, 'idle') as status,
        temperature,
        tools,
        total_runs as "totalRuns",
        total_tokens_used as "totalTokensUsed",
        avg_run_duration_ms as "avgRunDurationMs",
        last_run_at as "lastRunAt",
        created_at as "createdAt", 
        updated_at as "updatedAt"
      FROM agents
      WHERE id = $1
    `, [id]);

    return result.rows[0] || null;
  }

  /**
   * Create new agent
   */
  async create(data: CreateAgent & { ownerId?: string; tenantId?: string }): Promise<Agent> {
    const result = await this.pool.query<Agent>(`
      INSERT INTO agents (
        name, description, creature, emoji, system_prompt, 
        skills, model, config, template_id,
        owner_id, tenant_id, tier, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING 
        id, name, description, creature, emoji,
        system_prompt as "systemPrompt", skills, model, config,
        tenant_id as "tenantId",
        template_id as "templateId",
        owner_id as "ownerId",
        icon,
        tier,
        status,
        created_at as "createdAt", 
        updated_at as "updatedAt"
    `, [
      data.name,
      data.description || null,
      data.creature,
      data.emoji,
      data.systemPrompt || null,
      data.skills || [],
      data.model || 'claude-sonnet-4-20250514',
      data.config ? JSON.stringify(data.config) : null,
      data.templateId || null,
      data.ownerId || null,
      data.tenantId || null,
      'personal', // new agents start as personal tier
      'idle'      // default status
    ]);

    return result.rows[0];
  }

  /**
   * Update agent
   */
  async update(id: string, data: UpdateAgent): Promise<Agent | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(data.description);
    }
    if (data.creature !== undefined) {
      fields.push(`creature = $${paramCount++}`);
      values.push(data.creature);
    }
    if (data.emoji !== undefined) {
      fields.push(`emoji = $${paramCount++}`);
      values.push(data.emoji);
    }
    if (data.systemPrompt !== undefined) {
      fields.push(`system_prompt = $${paramCount++}`);
      values.push(data.systemPrompt);
    }
    if (data.skills !== undefined) {
      fields.push(`skills = $${paramCount++}`);
      values.push(data.skills);
    }
    if (data.model !== undefined) {
      fields.push(`model = $${paramCount++}`);
      values.push(data.model);
    }
    if (data.config !== undefined) {
      fields.push(`config = $${paramCount++}`);
      values.push(JSON.stringify(data.config));
    }

    if (fields.length === 0) {
      return this.get(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.pool.query<Agent>(`
      UPDATE agents SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING 
        id, name, description, creature, emoji,
        system_prompt as "systemPrompt", skills, model, config,
        tenant_id as "tenantId",
        template_id as "templateId",
        owner_id as "ownerId",
        icon,
        tier,
        status,
        total_runs as "totalRuns",
        total_tokens_used as "totalTokensUsed",
        created_at as "createdAt", 
        updated_at as "updatedAt"
    `, values);

    return result.rows[0] || null;
  }

  /**
   * Delete agent
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM agents WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Start an agent run with telemetry recording
   */
  async startRun(agentId: string, input: AgentRunInput): Promise<AgentRunOutput> {
    const agent = await this.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Update agent status to running
    await this.pool.query(
      'UPDATE agents SET status = $1, updated_at = NOW() WHERE id = $2',
      ['running', agentId]
    );

    // Record run start in telemetry
    const runId = await this.telemetry.recordRunStart({
      agentId,
      tenantId: agent.tenantId || input.tenantId,
      userId: input.userId,
      taskType: input.taskType,
      taskDescription: input.taskDescription,
    });

    return {
      id: runId,
      agentId,
      status: 'running',
      startedAt: new Date(),
    };
  }

  /**
   * Get run history for an agent
   */
  async getRuns(agentId: string, options: { limit?: number; offset?: number } = {}): Promise<{
    runs: any[];
    total: number;
  }> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const [runsResult, countResult] = await Promise.all([
      this.pool.query(`
        SELECT 
          id,
          agent_id as "agentId",
          tenant_id as "tenantId",
          user_id as "userId",
          task_type as "taskType",
          task_description as "taskDescription",
          cynefin_domain as "cynefinDomain",
          status,
          success,
          error_type as "errorType",
          error_message as "errorMessage",
          input_tokens as "inputTokens",
          output_tokens as "outputTokens",
          total_tokens as "totalTokens",
          duration_ms as "durationMs",
          quality_score as "qualityScore",
          user_rating as "userRating",
          had_retries as "hadRetries",
          retry_count as "retryCount",
          artifacts_created as "artifactsCreated",
          files_modified as "filesModified",
          tests_run as "testsRun",
          tests_passed as "testsPassed",
          started_at as "startedAt",
          completed_at as "completedAt"
        FROM agent_runs
        WHERE agent_id = $1
        ORDER BY started_at DESC
        LIMIT $2 OFFSET $3
      `, [agentId, limit, offset]),
      this.pool.query(
        'SELECT COUNT(*) as total FROM agent_runs WHERE agent_id = $1',
        [agentId]
      )
    ]);

    return {
      runs: runsResult.rows,
      total: parseInt(countResult.rows[0].total, 10)
    };
  }

  /**
   * Validate agent template/config
   */
  validate(data: CreateAgent): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!data.name || data.name.trim().length === 0) {
      errors.push('Name is required');
    }
    if (!data.creature || data.creature.trim().length === 0) {
      errors.push('Creature type is required');
    }
    if (!data.emoji || data.emoji.trim().length === 0) {
      errors.push('Emoji is required');
    }

    // Warnings
    if (!data.systemPrompt) {
      warnings.push('No system prompt defined - agent may lack direction');
    }
    if (!data.skills || data.skills.length === 0) {
      warnings.push('No skills defined - agent capabilities may be limited');
    }
    if (data.name && data.name.length > 50) {
      warnings.push('Name is quite long - consider shortening');
    }

    // Validate emoji
    if (data.emoji && data.emoji.length > 10) {
      errors.push('Emoji should be a single emoji character');
    }

    // Validate model
    const validModels = [
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514', 
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'gpt-4-turbo',
      'gpt-4o',
    ];
    if (data.model && !validModels.includes(data.model)) {
      warnings.push(`Unknown model: ${data.model}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// ============================================
// LEGACY FUNCTION EXPORTS (backwards compat)
// ============================================

const defaultService = new AgentService();

export async function createAgent(data: CreateAgent): Promise<Agent> {
  return defaultService.create(data);
}

export async function getAllAgents(): Promise<Agent[]> {
  return defaultService.list();
}

export async function getAgentById(id: string): Promise<Agent | null> {
  return defaultService.get(id);
}

export async function updateAgent(id: string, data: UpdateAgent): Promise<Agent | null> {
  return defaultService.update(id, data);
}

export async function deleteAgent(id: string): Promise<boolean> {
  return defaultService.delete(id);
}

export function validateTemplate(data: CreateAgent): ValidationResult {
  return defaultService.validate(data);
}
