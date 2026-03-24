/**
 * REBEL AI FACTORY - TEMPLATE ROUTES
 * REBAA-21: Agent Template Management
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { validateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();

// ============================================
// LIST TEMPLATES
// Public - with optional category filter
// ============================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM agent_templates WHERE 1=1';
    const params: any[] = [];
    
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    
    query += ' ORDER BY usage_count DESC, name';
    const result = await pool.query(query, params);
    res.json({ templates: result.rows });
  } catch (error) {
    console.error('Error listing templates:', error);
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

// ============================================
// GET TEMPLATE BY ID
// Public read
// ============================================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM agent_templates WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Error getting template:', error);
    res.status(500).json({ error: 'Failed to get template' });
  }
});

// ============================================
// CREATE TEMPLATE
// Requires authentication
// ============================================
router.post('/', validateToken, async (req: Request, res: Response) => {
  try {
    const { name, description, category, system_prompt, variables, config } = req.body;
    
    if (!name || !category) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        message: 'name and category are required' 
      });
    }
    
    const result = await pool.query(
      `INSERT INTO agent_templates (name, description, category, system_prompt, variables, config)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        name, 
        description || null, 
        category, 
        system_prompt || null, 
        JSON.stringify(variables || []), 
        JSON.stringify(config || {})
      ]
    );
    
    res.status(201).json({ template: result.rows[0] });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// ============================================
// UPDATE TEMPLATE
// Requires authentication
// ============================================
router.put('/:id', validateToken, async (req: Request, res: Response) => {
  try {
    const { name, description, category, system_prompt, variables, config } = req.body;
    
    // Check if template exists
    const existing = await pool.query(
      'SELECT id FROM agent_templates WHERE id = $1',
      [req.params.id]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const result = await pool.query(
      `UPDATE agent_templates 
       SET name=$1, description=$2, category=$3, system_prompt=$4, variables=$5, config=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [
        name, 
        description, 
        category, 
        system_prompt, 
        JSON.stringify(variables || []),
        JSON.stringify(config || {}),
        req.params.id
      ]
    );
    
    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// ============================================
// INCREMENT USAGE COUNT
// Called when template is used to create agent
// ============================================
router.post('/:id/use', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `UPDATE agent_templates 
       SET usage_count = usage_count + 1 
       WHERE id = $1 
       RETURNING id, usage_count`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ success: true, usage_count: result.rows[0].usage_count });
  } catch (error) {
    console.error('Error incrementing template usage:', error);
    res.status(500).json({ error: 'Failed to update usage count' });
  }
});

// ============================================
// DELETE TEMPLATE
// Requires authentication + templates:delete permission
// ============================================
router.delete('/:id', 
  validateToken, 
  requirePermission('templates:delete' as any),
  async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        'DELETE FROM agent_templates WHERE id = $1 RETURNING id',
        [req.params.id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({ error: 'Failed to delete template' });
    }
  }
);

export default router;
