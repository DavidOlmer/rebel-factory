import { query, queryOne } from '../db/client';
import type { Sprint, CreateSprint, UpdateSprint } from '../types';

export async function createSprint(data: CreateSprint): Promise<Sprint> {
  const rows = await query<Sprint>(
    `INSERT INTO sprints (agent_id, title, description, tasks)
     VALUES ($1, $2, $3, $4)
     RETURNING id, agent_id as "agentId", title, description, status, tasks,
               created_at as "createdAt", updated_at as "updatedAt"`,
    [
      data.agentId,
      data.title,
      data.description || null,
      JSON.stringify(data.tasks),
    ]
  );
  return rows[0];
}

export async function getAllSprints(agentId?: string): Promise<Sprint[]> {
  if (agentId) {
    return query<Sprint>(
      `SELECT id, agent_id as "agentId", title, description, status, tasks,
              created_at as "createdAt", updated_at as "updatedAt"
       FROM sprints
       WHERE agent_id = $1
       ORDER BY created_at DESC`,
      [agentId]
    );
  }
  
  return query<Sprint>(
    `SELECT id, agent_id as "agentId", title, description, status, tasks,
            created_at as "createdAt", updated_at as "updatedAt"
     FROM sprints
     ORDER BY created_at DESC`
  );
}

export async function getSprintById(id: string): Promise<Sprint | null> {
  return queryOne<Sprint>(
    `SELECT id, agent_id as "agentId", title, description, status, tasks,
            created_at as "createdAt", updated_at as "updatedAt"
     FROM sprints
     WHERE id = $1`,
    [id]
  );
}

export async function updateSprint(id: string, data: UpdateSprint): Promise<Sprint | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramCount = 1;

  if (data.title !== undefined) {
    fields.push(`title = $${paramCount++}`);
    values.push(data.title);
  }
  if (data.description !== undefined) {
    fields.push(`description = $${paramCount++}`);
    values.push(data.description);
  }
  if (data.status !== undefined) {
    fields.push(`status = $${paramCount++}`);
    values.push(data.status);
  }

  if (fields.length === 0) {
    return getSprintById(id);
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const rows = await query<Sprint>(
    `UPDATE sprints SET ${fields.join(', ')}
     WHERE id = $${paramCount}
     RETURNING id, agent_id as "agentId", title, description, status, tasks,
               created_at as "createdAt", updated_at as "updatedAt"`,
    values
  );
  return rows[0] || null;
}

export async function deleteSprint(id: string): Promise<boolean> {
  const rows = await query(
    'DELETE FROM sprints WHERE id = $1 RETURNING id',
    [id]
  );
  return rows.length > 0;
}

export async function getSprintsByAgent(agentId: string): Promise<Sprint[]> {
  return getAllSprints(agentId);
}
