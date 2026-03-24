/**
 * REBEL AI FACTORY - PROMPT LIBRARY ROUTES
 * REBAA-33: Prompt Library with versioning, ratings, and templates
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { extractUser } from '../middleware/auth';

const router = Router();

// ============================================
// GET /api/prompts - List prompts
// Supports filtering by category, search, tenant
// ============================================
router.get('/', extractUser, async (req: Request, res: Response) => {
  try {
    const { category, search, tenantId, sort = 'popular', limit = '50', offset = '0' } = req.query;
    
    const params: unknown[] = [];
    let query = `
      SELECT 
        p.*,
        COALESCE(p.rating, 0) as rating,
        COALESCE(p.usage_count, 0) as usage_count,
        COALESCE(p.version, 1) as version,
        u.name as created_by_name
      FROM prompts p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;
    
    if (tenantId) {
      params.push(tenantId);
      query += ` AND p.tenant_id = $${params.length}`;
    }
    
    if (category) {
      params.push(category);
      query += ` AND p.category = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.name ILIKE $${params.length} OR p.content ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
    }
    
    // Sorting options
    switch (sort) {
      case 'popular':
        query += ` ORDER BY p.usage_count DESC, p.rating DESC NULLS LAST`;
        break;
      case 'rated':
        query += ` ORDER BY p.rating DESC NULLS LAST, p.usage_count DESC`;
        break;
      case 'newest':
        query += ` ORDER BY p.created_at DESC`;
        break;
      case 'name':
        query += ` ORDER BY p.name ASC`;
        break;
      default:
        query += ` ORDER BY p.usage_count DESC`;
    }
    
    params.push(parseInt(limit as string, 10));
    query += ` LIMIT $${params.length}`;
    
    params.push(parseInt(offset as string, 10));
    query += ` OFFSET $${params.length}`;
    
    const result = await pool.query(query, params);
    
    // Get categories with counts
    const categoryParams = tenantId ? [tenantId] : [];
    const categoryFilter = tenantId ? 'WHERE tenant_id = $1' : '';
    const categoriesResult = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM prompts
      ${categoryFilter}
      GROUP BY category
      ORDER BY count DESC
    `, categoryParams);
    
    res.json({
      prompts: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        content: row.content,
        category: row.category,
        variables: row.variables || [],
        tags: row.tags || [],
        version: parseInt(row.version, 10),
        rating: parseFloat(row.rating || '0').toFixed(1),
        ratingCount: parseInt(row.rating_count || '0', 10),
        usageCount: parseInt(row.usage_count, 10),
        createdBy: row.created_by,
        createdByName: row.created_by_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isTemplate: row.is_template || false,
        isPublic: row.is_public || false
      })),
      categories: categoriesResult.rows.map(r => ({
        name: r.category,
        count: parseInt(r.count, 10)
      })),
      total: result.rowCount
    });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// ============================================
// GET /api/prompts/:id - Get single prompt
// ============================================
router.get('/:id', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        p.*,
        u.name as created_by_name,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'version', pv.version,
            'content', pv.content,
            'created_at', pv.created_at,
            'created_by', pv.created_by
          ) ORDER BY pv.version DESC)
          FROM prompt_versions pv WHERE pv.prompt_id = p.id),
          '[]'
        ) as versions
      FROM prompts p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    const prompt = result.rows[0];
    
    res.json({
      prompt: {
        id: prompt.id,
        name: prompt.name,
        description: prompt.description,
        content: prompt.content,
        category: prompt.category,
        variables: prompt.variables || [],
        tags: prompt.tags || [],
        version: parseInt(prompt.version || '1', 10),
        rating: parseFloat(prompt.rating || '0').toFixed(1),
        ratingCount: parseInt(prompt.rating_count || '0', 10),
        usageCount: parseInt(prompt.usage_count || '0', 10),
        createdBy: prompt.created_by,
        createdByName: prompt.created_by_name,
        createdAt: prompt.created_at,
        updatedAt: prompt.updated_at,
        isTemplate: prompt.is_template || false,
        isPublic: prompt.is_public || false,
        versions: prompt.versions
      }
    });
  } catch (error) {
    console.error('Error fetching prompt:', error);
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
});

// ============================================
// POST /api/prompts - Create new prompt
// ============================================
router.post('/', extractUser, async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      content, 
      description,
      category, 
      variables, 
      tags,
      isTemplate,
      isPublic,
      tenantId 
    } = req.body;
    
    if (!name || !content) {
      return res.status(400).json({ error: 'Name and content are required' });
    }
    
    const userId = (req as any).user?.id;
    
    const result = await pool.query(`
      INSERT INTO prompts (
        name, 
        content, 
        description,
        category, 
        variables, 
        tags,
        is_template,
        is_public,
        tenant_id,
        created_by,
        version,
        usage_count,
        rating,
        rating_count
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, 0, 0, 0) 
      RETURNING *
    `, [
      name, 
      content, 
      description || null,
      category || 'general', 
      JSON.stringify(variables || []),
      tags || [],
      isTemplate || false,
      isPublic || false,
      tenantId || null,
      userId || null
    ]);
    
    // Also create initial version record
    await pool.query(`
      INSERT INTO prompt_versions (prompt_id, version, content, created_by)
      VALUES ($1, 1, $2, $3)
    `, [result.rows[0].id, content, userId]);
    
    res.status(201).json({ 
      prompt: {
        ...result.rows[0],
        variables: result.rows[0].variables || [],
        usageCount: 0,
        rating: '0.0',
        ratingCount: 0
      }
    });
  } catch (error) {
    console.error('Error creating prompt:', error);
    res.status(500).json({ error: 'Failed to create prompt' });
  }
});

// ============================================
// PUT /api/prompts/:id - Update prompt (creates new version)
// ============================================
router.put('/:id', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      content, 
      description,
      category, 
      variables, 
      tags,
      isTemplate,
      isPublic
    } = req.body;
    
    const userId = (req as any).user?.id;
    
    // Get current version
    const current = await pool.query(`SELECT version, content FROM prompts WHERE id = $1`, [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    const currentVersion = parseInt(current.rows[0].version || '1', 10);
    const contentChanged = current.rows[0].content !== content;
    const newVersion = contentChanged ? currentVersion + 1 : currentVersion;
    
    // If content changed, save old version
    if (contentChanged) {
      await pool.query(`
        INSERT INTO prompt_versions (prompt_id, version, content, created_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (prompt_id, version) DO NOTHING
      `, [id, newVersion, content, userId]);
    }
    
    const result = await pool.query(`
      UPDATE prompts 
      SET 
        name = COALESCE($1, name),
        content = COALESCE($2, content),
        description = COALESCE($3, description),
        category = COALESCE($4, category),
        variables = COALESCE($5, variables),
        tags = COALESCE($6, tags),
        is_template = COALESCE($7, is_template),
        is_public = COALESCE($8, is_public),
        version = $9,
        updated_at = NOW()
      WHERE id = $10
      RETURNING *
    `, [
      name,
      content,
      description,
      category,
      variables ? JSON.stringify(variables) : null,
      tags,
      isTemplate,
      isPublic,
      newVersion,
      id
    ]);
    
    res.json({ 
      prompt: result.rows[0],
      versionBumped: contentChanged
    });
  } catch (error) {
    console.error('Error updating prompt:', error);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

// ============================================
// DELETE /api/prompts/:id - Delete prompt
// ============================================
router.delete('/:id', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Delete versions first (FK constraint)
    await pool.query(`DELETE FROM prompt_versions WHERE prompt_id = $1`, [id]);
    
    const result = await pool.query(`DELETE FROM prompts WHERE id = $1 RETURNING id`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    res.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Error deleting prompt:', error);
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
});

// ============================================
// POST /api/prompts/:id/rate - Rate a prompt
// ============================================
router.post('/:id/rate', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    const userId = (req as any).user?.id;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    // Upsert user rating
    await pool.query(`
      INSERT INTO prompt_ratings (prompt_id, user_id, rating)
      VALUES ($1, $2, $3)
      ON CONFLICT (prompt_id, user_id) 
      DO UPDATE SET rating = $3, updated_at = NOW()
    `, [id, userId || 'anonymous', rating]);
    
    // Recalculate average rating
    const avgResult = await pool.query(`
      SELECT AVG(rating) as avg_rating, COUNT(*) as count
      FROM prompt_ratings
      WHERE prompt_id = $1
    `, [id]);
    
    const avgRating = parseFloat(avgResult.rows[0].avg_rating || '0');
    const ratingCount = parseInt(avgResult.rows[0].count || '0', 10);
    
    await pool.query(`
      UPDATE prompts 
      SET rating = $1, rating_count = $2, updated_at = NOW()
      WHERE id = $3
    `, [avgRating, ratingCount, id]);
    
    res.json({ 
      success: true,
      rating: avgRating.toFixed(1),
      ratingCount
    });
  } catch (error) {
    console.error('Error rating prompt:', error);
    res.status(500).json({ error: 'Failed to rate prompt' });
  }
});

// ============================================
// POST /api/prompts/:id/use - Track prompt usage
// ============================================
router.post('/:id/use', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { agentId, runId, renderedContent } = req.body;
    const userId = (req as any).user?.id;
    
    // Increment usage count
    await pool.query(`
      UPDATE prompts 
      SET usage_count = COALESCE(usage_count, 0) + 1 
      WHERE id = $1
    `, [id]);
    
    // Log usage for analytics (optional tracking table)
    await pool.query(`
      INSERT INTO prompt_usage_log (prompt_id, user_id, agent_id, run_id, rendered_content)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, userId, agentId || null, runId || null, renderedContent || null]).catch(() => {
      // Table might not exist yet, that's ok
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking prompt usage:', error);
    res.status(500).json({ error: 'Failed to track usage' });
  }
});

// ============================================
// POST /api/prompts/:id/render - Render prompt with variables
// ============================================
router.post('/:id/render', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { variables } = req.body;
    
    const result = await pool.query(`SELECT content, variables FROM prompts WHERE id = $1`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    let content = result.rows[0].content;
    const promptVariables = result.rows[0].variables || [];
    
    // Replace variables in content
    // Format: {{variable_name}} or {variable_name}
    if (variables && typeof variables === 'object') {
      for (const [key, value] of Object.entries(variables)) {
        const patterns = [
          new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'),
          new RegExp(`\\{\\s*${key}\\s*\\}`, 'g')
        ];
        for (const pattern of patterns) {
          content = content.replace(pattern, String(value));
        }
      }
    }
    
    // Check for missing required variables
    const missingVars: string[] = [];
    for (const v of promptVariables) {
      const varName = typeof v === 'string' ? v : v.name;
      if (!variables || !(varName in variables)) {
        const pattern = new RegExp(`\\{\\{?\\s*${varName}\\s*\\}?\\}`, 'g');
        if (pattern.test(content)) {
          missingVars.push(varName);
        }
      }
    }
    
    res.json({
      rendered: content,
      missingVariables: missingVars,
      variablesUsed: Object.keys(variables || {})
    });
  } catch (error) {
    console.error('Error rendering prompt:', error);
    res.status(500).json({ error: 'Failed to render prompt' });
  }
});

// ============================================
// GET /api/prompts/:id/versions - Get version history
// ============================================
router.get('/:id/versions', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        pv.*,
        u.name as created_by_name
      FROM prompt_versions pv
      LEFT JOIN users u ON pv.created_by = u.id
      WHERE pv.prompt_id = $1
      ORDER BY pv.version DESC
    `, [id]);
    
    res.json({
      versions: result.rows.map(row => ({
        version: row.version,
        content: row.content,
        createdBy: row.created_by,
        createdByName: row.created_by_name,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching prompt versions:', error);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

// ============================================
// POST /api/prompts/:id/revert - Revert to specific version
// ============================================
router.post('/:id/revert', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { version } = req.body;
    const userId = (req as any).user?.id;
    
    if (!version) {
      return res.status(400).json({ error: 'Version number required' });
    }
    
    // Get the version content
    const versionResult = await pool.query(`
      SELECT content FROM prompt_versions 
      WHERE prompt_id = $1 AND version = $2
    `, [id, version]);
    
    if (versionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Version not found' });
    }
    
    const content = versionResult.rows[0].content;
    
    // Get current version number
    const current = await pool.query(`SELECT version FROM prompts WHERE id = $1`, [id]);
    const newVersion = parseInt(current.rows[0].version || '1', 10) + 1;
    
    // Save current as new version and update prompt
    await pool.query(`
      INSERT INTO prompt_versions (prompt_id, version, content, created_by)
      VALUES ($1, $2, $3, $4)
    `, [id, newVersion, content, userId]);
    
    const result = await pool.query(`
      UPDATE prompts 
      SET content = $1, version = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [content, newVersion, id]);
    
    res.json({ 
      prompt: result.rows[0],
      revertedTo: version,
      newVersion
    });
  } catch (error) {
    console.error('Error reverting prompt:', error);
    res.status(500).json({ error: 'Failed to revert prompt' });
  }
});

// ============================================
// POST /api/prompts/:id/duplicate - Clone a prompt
// ============================================
router.post('/:id/duplicate', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name: newName } = req.body;
    const userId = (req as any).user?.id;
    
    const original = await pool.query(`SELECT * FROM prompts WHERE id = $1`, [id]);
    
    if (original.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    const prompt = original.rows[0];
    const duplicateName = newName || `${prompt.name} (copy)`;
    
    const result = await pool.query(`
      INSERT INTO prompts (
        name, content, description, category, variables, tags,
        is_template, is_public, tenant_id, created_by,
        version, usage_count, rating, rating_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, 0, 0, 0)
      RETURNING *
    `, [
      duplicateName,
      prompt.content,
      prompt.description,
      prompt.category,
      prompt.variables,
      prompt.tags,
      prompt.is_template,
      false, // duplicates start as private
      prompt.tenant_id,
      userId
    ]);
    
    res.status(201).json({ 
      prompt: result.rows[0],
      duplicatedFrom: id
    });
  } catch (error) {
    console.error('Error duplicating prompt:', error);
    res.status(500).json({ error: 'Failed to duplicate prompt' });
  }
});

export default router;
