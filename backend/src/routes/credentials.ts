/**
 * Credentials Routes - Agent credential isolation API
 */

import { Router, Request, Response } from 'express';
import { credentialIsolationService } from '../services/credential-isolation.service';
import { validateToken } from '../middleware/auth';

const router = Router();

// Store credential for agent
router.post('/:agentId', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { name, value, expiresIn, allowedOperations } = req.body;

    if (!name || !value) {
      return res.status(400).json({ error: 'name and value are required' });
    }

    await credentialIsolationService.storeCredential(agentId, name, value, {
      expiresIn,
      allowedOperations,
    });

    res.status(201).json({ 
      message: 'Credential stored',
      name,
      agentId,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get credential (requires operation)
router.get('/:agentId/:name', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId, name } = req.params;
    const { operation = 'read' } = req.query;

    const value = await credentialIsolationService.getCredential(
      agentId, 
      name, 
      operation as string
    );

    if (value === null) {
      return res.status(404).json({ 
        error: 'Credential not found or access denied' 
      });
    }

    res.json({ name, value });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List credentials for agent (without values)
router.get('/:agentId', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const credentials = credentialIsolationService.listCredentials(agentId);
    res.json(credentials);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check if credential exists
router.head('/:agentId/:name', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId, name } = req.params;
    const exists = credentialIsolationService.hasCredential(agentId, name);
    
    if (exists) {
      res.status(200).send();
    } else {
      res.status(404).send();
    }
  } catch (error: any) {
    res.status(500).send();
  }
});

// Delete specific credential
router.delete('/:agentId/:name', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId, name } = req.params;
    const deleted = credentialIsolationService.deleteCredential(agentId, name);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Rotate all credentials for agent
router.post('/:agentId/rotate', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    await credentialIsolationService.rotateCredentials(agentId);
    res.json({ message: 'All credentials rotated', agentId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get access log for agent
router.get('/:agentId/log', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { limit } = req.query;
    
    const log = credentialIsolationService.getAccessLog(
      agentId,
      limit ? parseInt(limit as string) : undefined
    );
    
    res.json(log);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Clear access log for agent
router.delete('/:agentId/log', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    credentialIsolationService.clearAccessLog(agentId);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Remove all credentials and data for agent
router.delete('/:agentId', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const removed = credentialIsolationService.removeAgent(agentId);
    
    if (!removed) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List all agents with credentials (admin)
router.get('/', validateToken, async (req: Request, res: Response) => {
  try {
    const agents = credentialIsolationService.listAgents();
    res.json(agents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
