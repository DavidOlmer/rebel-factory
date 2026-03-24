/**
 * Autonomous Decision Routes
 * API for agent decision-making and policy management
 */

import { Router, Request, Response } from 'express';
import { 
  autonomousDecisionService, 
  DecisionType, 
  RiskLevel 
} from '../services/autonomous-decision.service';
import { validateToken } from '../middleware/auth';

const router = Router();

/**
 * POST /decide
 * Make a decision for a given context
 */
router.post('/decide', validateToken, async (req: Request, res: Response) => {
  try {
    const { 
      agentId, 
      taskType, 
      taskDescription,
      estimatedImpact, 
      reversible, 
      confidence,
      previousAttempts,
      timeConstraint,
      affectedResources,
      requiredCapabilities,
    } = req.body;

    // Validate required fields
    if (!agentId || !taskType || !estimatedImpact || reversible === undefined || confidence === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: agentId, taskType, estimatedImpact, reversible, confidence' 
      });
    }

    // Validate enums
    const validRiskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
    if (!validRiskLevels.includes(estimatedImpact)) {
      return res.status(400).json({ 
        error: `Invalid estimatedImpact. Must be one of: ${validRiskLevels.join(', ')}` 
      });
    }

    // Validate confidence range
    if (confidence < 0 || confidence > 100) {
      return res.status(400).json({ error: 'confidence must be between 0 and 100' });
    }

    const context = {
      agentId,
      taskType,
      taskDescription,
      estimatedImpact: estimatedImpact as RiskLevel,
      reversible: Boolean(reversible),
      confidence: Number(confidence),
      previousAttempts: previousAttempts || 0,
      timeConstraint: timeConstraint ? new Date(timeConstraint) : undefined,
      affectedResources,
      requiredCapabilities,
    };

    const result = autonomousDecisionService.decide(context);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /decide/batch
 * Make decisions for multiple contexts
 */
router.post('/decide/batch', validateToken, async (req: Request, res: Response) => {
  try {
    const { contexts } = req.body;

    if (!Array.isArray(contexts) || contexts.length === 0) {
      return res.status(400).json({ error: 'contexts must be a non-empty array' });
    }

    if (contexts.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 contexts per batch' });
    }

    const validRiskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
    
    const parsedContexts = contexts.map((ctx: any, index: number) => {
      if (!ctx.agentId || !ctx.taskType || !ctx.estimatedImpact || ctx.reversible === undefined || ctx.confidence === undefined) {
        throw new Error(`Context ${index}: Missing required fields`);
      }
      if (!validRiskLevels.includes(ctx.estimatedImpact)) {
        throw new Error(`Context ${index}: Invalid estimatedImpact`);
      }
      
      return {
        agentId: ctx.agentId,
        taskType: ctx.taskType,
        taskDescription: ctx.taskDescription,
        estimatedImpact: ctx.estimatedImpact as RiskLevel,
        reversible: Boolean(ctx.reversible),
        confidence: Number(ctx.confidence),
        previousAttempts: ctx.previousAttempts || 0,
        timeConstraint: ctx.timeConstraint ? new Date(ctx.timeConstraint) : undefined,
        affectedResources: ctx.affectedResources,
        requiredCapabilities: ctx.requiredCapabilities,
      };
    });

    const results = autonomousDecisionService.decideBatch(parsedContexts);
    res.json({ results });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /should-continue
 * Check if agent should continue execution
 */
router.post('/should-continue', validateToken, async (req: Request, res: Response) => {
  try {
    const { 
      agentId, 
      taskType, 
      estimatedImpact, 
      reversible, 
      confidence,
      previousAttempts,
      timeConstraint,
    } = req.body;

    if (!agentId) {
      return res.status(400).json({ error: 'agentId is required' });
    }

    const context = {
      agentId,
      taskType: taskType || 'unknown',
      estimatedImpact: estimatedImpact || 'medium' as RiskLevel,
      reversible: reversible ?? true,
      confidence: confidence ?? 50,
      previousAttempts: previousAttempts || 0,
      timeConstraint: timeConstraint ? new Date(timeConstraint) : undefined,
    };

    const result = autonomousDecisionService.shouldContinue(context);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /policies
 * List all agent policies
 */
router.get('/policies', validateToken, async (req: Request, res: Response) => {
  try {
    const policies = autonomousDecisionService.listPolicies();
    res.json({ policies });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /policies/:agentId
 * Get policy for specific agent
 */
router.get('/policies/:agentId', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const policy = autonomousDecisionService.getPolicy(agentId);
    
    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    res.json(policy);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /policies
 * Create or update agent policy
 */
router.post('/policies', validateToken, async (req: Request, res: Response) => {
  try {
    const {
      agentId,
      maxRiskLevel,
      requireConfirmationAbove,
      maxRetries,
      minConfidence,
      allowedTaskTypes,
      blockedTaskTypes,
    } = req.body;

    if (!agentId) {
      return res.status(400).json({ error: 'agentId is required' });
    }

    const validRiskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
    
    if (maxRiskLevel && !validRiskLevels.includes(maxRiskLevel)) {
      return res.status(400).json({ error: 'Invalid maxRiskLevel' });
    }

    if (requireConfirmationAbove && !validRiskLevels.includes(requireConfirmationAbove)) {
      return res.status(400).json({ error: 'Invalid requireConfirmationAbove' });
    }

    const policy = {
      agentId,
      maxRiskLevel: maxRiskLevel || 'medium' as RiskLevel,
      requireConfirmationAbove: requireConfirmationAbove || 'high' as RiskLevel,
      maxRetries: maxRetries ?? 3,
      minConfidence: minConfidence ?? 50,
      allowedTaskTypes: allowedTaskTypes || [],
      blockedTaskTypes: blockedTaskTypes || [],
    };

    autonomousDecisionService.setPolicy(policy);
    res.status(201).json(policy);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /policies/:agentId
 * Remove agent policy
 */
router.delete('/policies/:agentId', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const deleted = autonomousDecisionService.removePolicy(agentId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /history
 * Get decision history
 */
router.get('/history', validateToken, async (req: Request, res: Response) => {
  try {
    const agentId = req.query.agentId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;

    const history = autonomousDecisionService.getHistory(agentId, limit);
    res.json({ history });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /history/:agentId/outcome
 * Record outcome of a decision
 */
router.post('/history/:agentId/outcome', validateToken, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { timestamp, outcome } = req.body;

    if (!timestamp || !outcome) {
      return res.status(400).json({ error: 'timestamp and outcome are required' });
    }

    if (!['success', 'failure'].includes(outcome)) {
      return res.status(400).json({ error: 'outcome must be "success" or "failure"' });
    }

    autonomousDecisionService.recordOutcome(agentId, new Date(timestamp), outcome);
    res.json({ recorded: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /stats
 * Get decision statistics
 */
router.get('/stats', validateToken, async (req: Request, res: Response) => {
  try {
    const agentId = req.query.agentId as string | undefined;
    const stats = autonomousDecisionService.getStats(agentId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
