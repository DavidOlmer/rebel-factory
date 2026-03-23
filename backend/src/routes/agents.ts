import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CreateAgentSchema, UpdateAgentSchema, AgentIdSchema } from '../types';
import * as agentService from '../services/agent.service';
import type { WSMessage } from '../types';

export function createAgentRoutes(broadcast: (msg: WSMessage) => void): Router {
  const router = Router();

  // List all agents
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const agents = await agentService.getAllAgents();
      res.json({ data: agents, count: agents.length });
    } catch (error) {
      console.error('Error listing agents:', error);
      res.status(500).json({ error: 'Failed to list agents' });
    }
  });

  // Get agent by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = AgentIdSchema.parse({ id: req.params.id });
      const agent = await agentService.getAgentById(id);
      
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      res.json({ data: agent });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid agent ID', details: error.errors });
      }
      console.error('Error getting agent:', error);
      res.status(500).json({ error: 'Failed to get agent' });
    }
  });

  // Create agent
  router.post('/', async (req: Request, res: Response) => {
    try {
      const data = CreateAgentSchema.parse(req.body);
      const agent = await agentService.createAgent(data);
      
      broadcast({
        type: 'agent_created',
        payload: agent,
        timestamp: new Date().toISOString(),
      });
      
      res.status(201).json({ data: agent });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Error creating agent:', error);
      res.status(500).json({ error: 'Failed to create agent' });
    }
  });

  // Update agent
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = AgentIdSchema.parse({ id: req.params.id });
      const data = UpdateAgentSchema.parse(req.body);
      
      const agent = await agentService.updateAgent(id, data);
      
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      broadcast({
        type: 'agent_updated',
        payload: agent,
        timestamp: new Date().toISOString(),
      });
      
      res.json({ data: agent });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Error updating agent:', error);
      res.status(500).json({ error: 'Failed to update agent' });
    }
  });

  // Delete agent
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = AgentIdSchema.parse({ id: req.params.id });
      const deleted = await agentService.deleteAgent(id);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
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
  });

  // Validate template
  router.post('/:id/validate', async (req: Request, res: Response) => {
    try {
      const { id } = AgentIdSchema.parse({ id: req.params.id });
      const agent = await agentService.getAgentById(id);
      
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      const result = agentService.validateTemplate({
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

  return router;
}
