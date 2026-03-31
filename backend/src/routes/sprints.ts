import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CreateSprintSchema, UpdateSprintSchema } from '../types';
import * as sprintService from '../services/sprint.service';
import type { WSMessage } from '../types';

const UuidSchema = z.string().uuid();

export function createSprintRoutes(broadcast: (msg: WSMessage) => void): Router {
  const router = Router();

  // List all sprints (optionally filtered by agent)
  router.get('/', async (req: Request, res: Response) => {
    try {
      const agentId = req.query.agentId as string | undefined;
      
      if (agentId) {
        UuidSchema.parse(agentId);
      }
      
      const sprints = await sprintService.getAllSprints(agentId);
      res.json({ data: sprints, count: sprints.length });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid agent ID', details: error.errors });
      }
      console.error('Error listing sprints:', error);
      res.status(500).json({ error: 'Failed to list sprints' });
    }
  });

  // Get sprint by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = UuidSchema.parse(req.params.id);
      const sprint = await sprintService.getSprintById(id);
      
      if (!sprint) {
        return res.status(404).json({ error: 'Sprint not found' });
      }
      
      res.json({ data: sprint });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid sprint ID', details: error.errors });
      }
      console.error('Error getting sprint:', error);
      res.status(500).json({ error: 'Failed to get sprint' });
    }
  });

  // Create sprint
  router.post('/', async (req: Request, res: Response) => {
    try {
      const data = CreateSprintSchema.parse(req.body);
      const sprint = await sprintService.createSprint(data);
      
      broadcast({
        type: 'sprint_created',
        payload: sprint,
        timestamp: new Date().toISOString(),
      });
      
      res.status(201).json({ data: sprint });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Error creating sprint:', error);
      res.status(500).json({ error: 'Failed to create sprint' });
    }
  });

  // Update sprint
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const id = UuidSchema.parse(req.params.id);
      const data = UpdateSprintSchema.parse(req.body);
      
      const sprint = await sprintService.updateSprint(id, data);
      
      if (!sprint) {
        return res.status(404).json({ error: 'Sprint not found' });
      }
      
      broadcast({
        type: 'sprint_updated',
        payload: sprint,
        timestamp: new Date().toISOString(),
      });
      
      res.json({ data: sprint });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Error updating sprint:', error);
      res.status(500).json({ error: 'Failed to update sprint' });
    }
  });

  // Delete sprint
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = UuidSchema.parse(req.params.id);
      const deleted = await sprintService.deleteSprint(id);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Sprint not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid sprint ID', details: error.errors });
      }
      console.error('Error deleting sprint:', error);
      res.status(500).json({ error: 'Failed to delete sprint' });
    }
  });

  return router;
}

export default createSprintRoutes(() => {});
