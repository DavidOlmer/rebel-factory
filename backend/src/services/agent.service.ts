import { query, queryOne } from '../db/client';
import type { Agent, CreateAgent, UpdateAgent, ValidationResult } from '../types';

export async function createAgent(data: CreateAgent): Promise<Agent> {
  const rows = await query<Agent>(
    `INSERT INTO agents (name, description, creature, emoji, system_prompt, skills, model, config)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, name, description, creature, emoji, 
               system_prompt as "systemPrompt", skills, model, config,
               created_at as "createdAt", updated_at as "updatedAt"`,
    [
      data.name,
      data.description || null,
      data.creature,
      data.emoji,
      data.systemPrompt || null,
      data.skills,
      data.model,
      data.config ? JSON.stringify(data.config) : null,
    ]
  );
  return rows[0];
}

export async function getAllAgents(): Promise<Agent[]> {
  return query<Agent>(
    `SELECT id, name, description, creature, emoji,
            system_prompt as "systemPrompt", skills, model, config,
            created_at as "createdAt", updated_at as "updatedAt"
     FROM agents
     ORDER BY created_at DESC`
  );
}

export async function getAgentById(id: string): Promise<Agent | null> {
  return queryOne<Agent>(
    `SELECT id, name, description, creature, emoji,
            system_prompt as "systemPrompt", skills, model, config,
            created_at as "createdAt", updated_at as "updatedAt"
     FROM agents
     WHERE id = $1`,
    [id]
  );
}

export async function updateAgent(id: string, data: UpdateAgent): Promise<Agent | null> {
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
    return getAgentById(id);
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const rows = await query<Agent>(
    `UPDATE agents SET ${fields.join(', ')}
     WHERE id = $${paramCount}
     RETURNING id, name, description, creature, emoji,
               system_prompt as "systemPrompt", skills, model, config,
               created_at as "createdAt", updated_at as "updatedAt"`,
    values
  );
  return rows[0] || null;
}

export async function deleteAgent(id: string): Promise<boolean> {
  const rows = await query(
    'DELETE FROM agents WHERE id = $1 RETURNING id',
    [id]
  );
  return rows.length > 0;
}

export function validateTemplate(data: CreateAgent): ValidationResult {
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
