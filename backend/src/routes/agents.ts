/**
 * REBEL AI FACTORY - AGENT ROUTES
 * REBAA-32: Full CRUD with authentication and RBAC
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CreateAgentSchema, UpdateAgentSchema, AgentIdSchema } from '../types';
import { AgentService } from '../services/agent.service';
import { validateToken, extractUser } from '../middleware/auth';
import { requirePermission, canAccess } from '../middleware/rbac';
import { pool } from '../db/client';
import type { WSMessage } from '../types';

const agentService = new AgentService(pool);

export function createAgentRoutes(broadcast: (msg: WSMessage) => void): Router {
  const router = Router();

  // ============================================
  // LIST AGENTS
  // Public listing with optional filters
  // ============================================
  router.get('/', extractUser, async (req: Request, res: Response) => {
    try {
      const { tenantId, tier, status, ownerId } = req.query;
      
      const agents = await agentService.list({
        tenantId: tenantId as string | undefined,
        tier: tier as 'personal' | 'venture' | 'core' | undefined,
        status: status as 'idle' | 'running' | 'paused' | 'archived' | undefined,
        ownerId: ownerId as string | undefined,
      });
      
      res.json({ agents, count: agents.length });
    } catch (error) {
      console.error('Error listing agents:', error);
      res.status(500).json({ error: 'Failed to list agents' });
    }
  });

  // ============================================
  // CREATE AGENT
  // Requires authentication
  // ============================================
  router.post('/', validateToken, async (req: Request, res: Response) => {
    try {
      const data = CreateAgentSchema.parse(req.body);
      
      const agent = await agentService.create({
        ...data,
        ownerId: req.user!.id,
        tenantId: (req as any).tenantId || undefined,
      });
      
      broadcast({
        type: 'agent_created',
        payload: agent,
        timestamp: new Date().toISOString(),
      });
      
      res.status(201).json({ agent });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Error creating agent:', error);
      res.status(500).json({ error: 'Failed to create agent' });
    }
  });

  // ============================================
  // GET AGENT BY ID
  // Public read
  // ============================================
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = AgentIdSchema.parse({ id: req.params.id });
      const agent = await agentService.get(id);
      
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      res.json({ agent });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid agent ID', details: error.errors });
      }
      console.error('Error getting agent:', error);
      res.status(500).json({ error: 'Failed to get agent' });
    }
  });

  // ============================================
  // UPDATE AGENT
  // Requires authentication
  // ============================================
  router.put('/:id', validateToken, async (req: Request, res: Response) => {
    try {
      const { id } = AgentIdSchema.parse({ id: req.params.id });
      const data = UpdateAgentSchema.parse(req.body);
      
      // Check if agent exists
      const existing = await agentService.get(id);
      if (!existing) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      // TODO: Add ownership check (user must own agent or be admin)
      
      const agent = await agentService.update(id, data);
      
      broadcast({
        type: 'agent_updated',
        payload: agent,
        timestamp: new Date().toISOString(),
      });
      
      res.json({ agent });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Error updating agent:', error);
      res.status(500).json({ error: 'Failed to update agent' });
    }
  });

  // ============================================
  // DELETE AGENT
  // Requires authentication + agents:delete permission
  // ============================================
  router.delete('/:id', 
    validateToken, 
    requirePermission('agents:delete' as any),
    async (req: Request, res: Response) => {
      try {
        const { id } = AgentIdSchema.parse({ id: req.params.id });
        
        // Check if agent exists
        const existing = await agentService.get(id);
        if (!existing) {
          return res.status(404).json({ error: 'Agent not found' });
        }
        
        await agentService.delete(id);
        
        broadcast({
          type: 'agent_deleted',
          payload: { id },
          timestamp: new Date().toISOString(),
        });
        
        res.status(204).send();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: 'Invalid agent ID', details: error.errors });
        }
        console.error('Error deleting agent:', error);
        res.status(500).json({ error: 'Failed to delete agent' });
      }
    }
  );

  // ============================================
  // START AGENT RUN
  // Requires authentication, records telemetry
  // ============================================
  router.post('/:id/run', validateToken, async (req: Request, res: Response) => {
    try {
      const { id } = AgentIdSchema.parse({ id: req.params.id });
      const { taskType, taskDescription } = req.body;
      
      if (!taskType) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          message: 'taskType is required' 
        });
      }
      
      const validTaskTypes = ['sprint', 'chat', 'analysis', 'research', 'review'];
      if (!validTaskTypes.includes(taskType)) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          message: `taskType must be one of: ${validTaskTypes.join(', ')}` 
        });
      }
      
      const run = await agentService.startRun(id, {
        taskType,
        taskDescription,
        userId: req.user!.id,
        tenantId: (req as any).tenantId,
      });
      
      res.json({ run });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      console.error('Error starting agent run:', error);
      res.status(500).json({ error: 'Failed to start agent run' });
    }
  });

  // ============================================
  // GET AGENT RUN HISTORY
  // Public read with pagination
  // ============================================
  router.get('/:id/runs', async (req: Request, res: Response) => {
    try {
      const { id } = AgentIdSchema.parse({ id: req.params.id });
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      
      // Check if agent exists
      const agent = await agentService.get(id);
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      const { runs, total } = await agentService.getRuns(id, { limit, offset });
      
      res.json({
        runs,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + runs.length < total
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid agent ID', details: error.errors });
      }
      console.error('Error getting agent runs:', error);
      res.status(500).json({ error: 'Failed to get agent runs' });
    }
  });

  // ============================================
  // VALIDATE AGENT TEMPLATE
  // ============================================
  router.post('/:id/validate', async (req: Request, res: Response) => {
    try {
      const { id } = AgentIdSchema.parse({ id: req.params.id });
      const agent = await agentService.get(id);
      
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      const result = agentService.validate({
        name: agent.name,
        creature: agent.creature,
        emoji: agent.emoji,
        description: agent.description || undefined,
        systemPrompt: agent.systemPrompt || undefined,
        skills: agent.skills,
        model: agent.model,
        config: agent.config || undefined,
      });
      
      res.json({ data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid agent ID', details: error.errors });
      }
      console.error('Error validating agent:', error);
      res.status(500).json({ error: 'Failed to validate agent' });
    }
  });

  // ============================================
  // GET AGENT STATS
  // Aggregated statistics for an agent
  // ============================================
  router.get('/:id/stats', async (req: Request, res: Response) => {
    try {
      const { id } = AgentIdSchema.parse({ id: req.params.id });
      
      // Check if agent exists
      const agent = await agentService.get(id);
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      const stats = await pool.query(`
        SELECT 
          COUNT(*)::int as total_runs,
          COALESCE(AVG(CASE WHEN success THEN 100 ELSE 0 END), 0)::numeric(5,2) as success_rate,
          COALESCE(AVG(quality_score), 0)::numeric(5,2) as avg_quality,
          COALESCE(SUM(cost), 0)::numeric(10,4) as total_cost,
          COALESCE(SUM(input_tokens + output_tokens), 0)::bigint as total_tokens,
          MIN(started_at) as first_run,
          MAX(started_at) as last_run
        FROM agent_runs
        WHERE agent_id = $1
      `, [id]);
      
      res.json({ 
        agent_id: id,
        stats: stats.rows[0] 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid agent ID', details: error.errors });
      }
      console.error('Error getting agent stats:', error);
      res.status(500).json({ error: 'Failed to get agent stats' });
    }
  });

  return router;
}
