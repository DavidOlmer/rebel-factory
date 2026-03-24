/**
 * Sandbox Routes - Agent sandboxing API
 */

import { Router, Request, Response } from 'express';
import { sandboxService, SandboxConfig } from '../services/sandbox.service';
import { validateToken } from '../middleware/auth';

const router = Router();

// Create sandbox for agent
router.post('/', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId, ...config } = req.body;
    
    if (!agentId) {
      return res.status(400).json({ error: 'agentId is required' });
    }

    // Check if sandbox already exists
    if (sandboxService.getSandbox(agentId)) {
      return res.status(409).json({ error: 'Sandbox already exists for this agent' });
    }

    const sandbox = sandboxService.createSandbox(agentId, config);
    res.status(201).json(sandbox);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get sandbox config
router.get('/:agentId', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const sandbox = sandboxService.getSandbox(agentId);
    
    if (!sandbox) {
      return res.status(404).json({ error: 'Sandbox not found' });
    }

    res.json(sandbox);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List all sandboxes
router.get('/', validateToken, async (req: Request, res: Response) => {
  try {
    const sandboxes = sandboxService.listSandboxes();
    res.json(sandboxes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update sandbox config
router.patch('/:agentId', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const config = req.body;

    const updated = sandboxService.updateSandbox(agentId, config);
    
    if (!updated) {
      return res.status(404).json({ error: 'Sandbox not found' });
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete sandbox
router.delete('/:agentId', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const deleted = sandboxService.destroySandbox(agentId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Sandbox not found' });
    }

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Execute code in sandbox
router.post('/:agentId/execute', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'code is required' });
    }

    const result = await sandboxService.execute(agentId, code);
    res.json(result);
  } catch (error: any) {
    if (error.message === 'No sandbox configured for agent') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Check tool permission
router.get('/:agentId/tools/:tool', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId, tool } = req.params;
    const allowed = sandboxService.isToolAllowed(agentId, tool);
    res.json({ tool, allowed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check network access
router.get('/:agentId/network/:level', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId, level } = req.params;
    
    if (level !== 'internal' && level !== 'external') {
      return res.status(400).json({ error: 'level must be "internal" or "external"' });
    }

    const allowed = sandboxService.canAccessNetwork(agentId, level);
    res.json({ level, allowed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check filesystem access
router.get('/:agentId/filesystem/:operation', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId, operation } = req.params;
    
    if (operation !== 'read' && operation !== 'write') {
      return res.status(400).json({ error: 'operation must be "read" or "write"' });
    }

    const allowed = sandboxService.canAccessFilesystem(agentId, operation);
    res.json({ operation, allowed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
