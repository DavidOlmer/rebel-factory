/**
 * REBEL AI FACTORY - PROMPT LIBRARY SERVICE
 * 
 * Manages reusable prompts with:
 * - Variables/templates
 * - Usage tracking
 * - Performance metrics
 * - Version history
 */

import { Pool } from 'pg';

// ============================================
// TYPES
// ============================================

export interface Prompt {
  id: string;
  tenantId?: string; // NULL = global
  authorId: string;
  
  name: string;
  slug: string;
  description?: string;
  category: PromptCategory;
  
  content: string;
  variables: PromptVariable[];
  
  isPublic: boolean;
  usageCount: number;
  avgRating?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export type PromptCategory = 
  | 'analysis'
  | 'writing'
  | 'coding'
  | 'research'
  | 'review'
  | 'strategy'
  | 'data'
  | 'communication';

export interface PromptVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'text' | 'select';
  default?: string;
  options?: string[]; // For select type
  required: boolean;
}

export interface PromptVersion {
  id: string;
  promptId: string;
  version: number;
  content: string;
  variables: PromptVariable[];
  changedBy: string;
  changeNote?: string;
  createdAt: Date;
}

// ============================================
// PROMPT SERVICE
// ============================================

export class PromptService {
  constructor(private pool: Pool) {}

  // ==========================================
  // CRUD
  // ==========================================

  async create(prompt: Omit<Prompt, 'id' | 'usageCount' | 'avgRating' | 'createdAt' | 'updatedAt'>): Promise<string> {
    // Generate slug if not provided
    const slug = prompt.slug || this.generateSlug(prompt.name);
    
    const result = await this.pool.query(`
      INSERT INTO prompts (
        tenant_id, author_id, name, slug, description,
        category, content, variables, is_public
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      prompt.tenantId, prompt.authorId, prompt.name, slug,
      prompt.description, prompt.category, prompt.content,
      JSON.stringify(prompt.variables), prompt.isPublic
    ]);
    
    const promptId = result.rows[0].id;
    
    // Create initial version
    await this.createVersion(promptId, prompt.content, prompt.variables, prompt.authorId, 'Initial version');
    
    return promptId;
  }

  async get(promptId: string): Promise<Prompt | null> {
    const result = await this.pool.query(`
      SELECT * FROM prompts WHERE id = $1
    `, [promptId]);
    
    if (result.rows.length === 0) return null;
    return this.mapPrompt(result.rows[0]);
  }

  async getBySlug(slug: string, tenantId?: string): Promise<Prompt | null> {
    const result = await this.pool.query(`
      SELECT * FROM prompts 
      WHERE slug = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
      ORDER BY tenant_id NULLS LAST
      LIMIT 1
    `, [slug, tenantId]);
    
    if (result.rows.length === 0) return null;
    return this.mapPrompt(result.rows[0]);
  }

  async update(promptId: string, updates: Partial<Prompt>, userId: string, changeNote?: string): Promise<void> {
    const current = await this.get(promptId);
    if (!current) throw new Error('Prompt not found');
    
    // If content or variables changed, create new version
    if (updates.content || updates.variables) {
      await this.createVersion(
        promptId,
        updates.content || current.content,
        updates.variables || current.variables,
        userId,
        changeNote
      );
    }
    
    await this.pool.query(`
      UPDATE prompts SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        category = COALESCE($4, category),
        content = COALESCE($5, content),
        variables = COALESCE($6, variables),
        is_public = COALESCE($7, is_public),
        updated_at = NOW()
      WHERE id = $1
    `, [
      promptId,
      updates.name,
      updates.description,
      updates.category,
      updates.content,
      updates.variables ? JSON.stringify(updates.variables) : null,
      updates.isPublic
    ]);
  }

  async delete(promptId: string): Promise<void> {
    await this.pool.query(`DELETE FROM prompts WHERE id = $1`, [promptId]);
  }

  // ==========================================
  // LISTING
  // ==========================================

  async list(options: {
    tenantId?: string;
    category?: PromptCategory;
    search?: string;
    isPublic?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ prompts: Prompt[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    // Include tenant prompts + public prompts
    if (options.tenantId) {
      conditions.push(`(tenant_id = $${paramIndex} OR is_public = true)`);
      params.push(options.tenantId);
      paramIndex++;
    }
    
    if (options.category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(options.category);
      paramIndex++;
    }
    
    if (options.search) {
      conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${options.search}%`);
      paramIndex++;
    }
    
    if (options.isPublic !== undefined) {
      conditions.push(`is_public = $${paramIndex}`);
      params.push(options.isPublic);
      paramIndex++;
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM prompts ${whereClause}`,
      params
    );
    
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    
    const result = await this.pool.query(`
      SELECT * FROM prompts
      ${whereClause}
      ORDER BY usage_count DESC, name
      LIMIT ${limit} OFFSET ${offset}
    `, params);
    
    return {
      prompts: result.rows.map(row => this.mapPrompt(row)),
      total: parseInt(countResult.rows[0].count)
    };
  }

  async getPopular(tenantId?: string, limit: number = 10): Promise<Prompt[]> {
    const result = await this.pool.query(`
      SELECT * FROM prompts
      WHERE (tenant_id = $1 OR is_public = true OR tenant_id IS NULL)
      ORDER BY usage_count DESC
      LIMIT $2
    `, [tenantId, limit]);
    
    return result.rows.map(row => this.mapPrompt(row));
  }

  async getByCategory(category: PromptCategory, tenantId?: string): Promise<Prompt[]> {
    const result = await this.pool.query(`
      SELECT * FROM prompts
      WHERE category = $1 AND (tenant_id = $2 OR is_public = true OR tenant_id IS NULL)
      ORDER BY usage_count DESC
    `, [category, tenantId]);
    
    return result.rows.map(row => this.mapPrompt(row));
  }

  // ==========================================
  // USAGE & RATING
  // ==========================================

  async recordUsage(promptId: string): Promise<void> {
    await this.pool.query(`
      UPDATE prompts SET usage_count = usage_count + 1 WHERE id = $1
    `, [promptId]);
  }

  async rate(promptId: string, userId: string, rating: number): Promise<void> {
    // Store individual rating
    await this.pool.query(`
      INSERT INTO prompt_ratings (prompt_id, user_id, rating)
      VALUES ($1, $2, $3)
      ON CONFLICT (prompt_id, user_id) 
      DO UPDATE SET rating = $3, updated_at = NOW()
    `, [promptId, userId, rating]);
    
    // Update average
    await this.pool.query(`
      UPDATE prompts SET avg_rating = (
        SELECT AVG(rating) FROM prompt_ratings WHERE prompt_id = $1
      ) WHERE id = $1
    `, [promptId]);
  }

  // ==========================================
  // VERSIONING
  // ==========================================

  private async createVersion(
    promptId: string,
    content: string,
    variables: PromptVariable[],
    changedBy: string,
    changeNote?: string
  ): Promise<void> {
    // Get next version number
    const versionResult = await this.pool.query(`
      SELECT COALESCE(MAX(version), 0) + 1 as next_version
      FROM prompt_versions WHERE prompt_id = $1
    `, [promptId]);
    
    const version = versionResult.rows[0].next_version;
    
    await this.pool.query(`
      INSERT INTO prompt_versions (
        prompt_id, version, content, variables, changed_by, change_note
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [promptId, version, content, JSON.stringify(variables), changedBy, changeNote]);
  }

  async getVersions(promptId: string): Promise<PromptVersion[]> {
    const result = await this.pool.query(`
      SELECT * FROM prompt_versions
      WHERE prompt_id = $1
      ORDER BY version DESC
    `, [promptId]);
    
    return result.rows.map(row => ({
      id: row.id,
      promptId: row.prompt_id,
      version: row.version,
      content: row.content,
      variables: row.variables,
      changedBy: row.changed_by,
      changeNote: row.change_note,
      createdAt: row.created_at
    }));
  }

  async revertToVersion(promptId: string, version: number, userId: string): Promise<void> {
    const versionResult = await this.pool.query(`
      SELECT * FROM prompt_versions
      WHERE prompt_id = $1 AND version = $2
    `, [promptId, version]);
    
    if (versionResult.rows.length === 0) throw new Error('Version not found');
    
    const oldVersion = versionResult.rows[0];
    
    await this.update(
      promptId,
      { content: oldVersion.content, variables: oldVersion.variables },
      userId,
      `Reverted to version ${version}`
    );
  }

  // ==========================================
  // TEMPLATE RENDERING
  // ==========================================

  render(prompt: Prompt, values: Record<string, any>): string {
    let result = prompt.content;
    
    for (const variable of prompt.variables) {
      const value = values[variable.name] ?? variable.default ?? '';
      const pattern = new RegExp(`{{\\s*${variable.name}\\s*}}`, 'g');
      result = result.replace(pattern, String(value));
    }
    
    return result;
  }

  validateVariables(prompt: Prompt, values: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const variable of prompt.variables) {
      const value = values[variable.name];
      
      if (variable.required && (value === undefined || value === '')) {
        errors.push(`Missing required variable: ${variable.name}`);
        continue;
      }
      
      if (value !== undefined) {
        switch (variable.type) {
          case 'number':
            if (isNaN(Number(value))) {
              errors.push(`${variable.name} must be a number`);
            }
            break;
          case 'boolean':
            if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
              errors.push(`${variable.name} must be a boolean`);
            }
            break;
          case 'select':
            if (variable.options && !variable.options.includes(value)) {
              errors.push(`${variable.name} must be one of: ${variable.options.join(', ')}`);
            }
            break;
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private mapPrompt(row: any): Prompt {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      authorId: row.author_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      category: row.category,
      content: row.content,
      variables: row.variables || [],
      isPublic: row.is_public,
      usageCount: row.usage_count,
      avgRating: row.avg_rating,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
