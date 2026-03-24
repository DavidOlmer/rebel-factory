/**
 * REBEL AI FACTORY - CONTEXT HEALTH ROUTES
 * 
 * API endpoints for Context Health monitoring based on
 * the 4 Context Engineering Failure Modes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ContextHealthService } from '../services/context-health.service';
import { validateToken, extractUser } from '../middleware/auth';
import { pool } from '../db/client';

const contextHealthService = new ContextHealthService(pool);

const router = Router();

// ============================================
// SCHEMAS
// ============================================

const AgentIdSchema = z.object({
  id: z.string().uuid(),
});

const ResetContextSchema = z.object({
  action: z.enum(['soft_reset', 'hard_reset']).default('soft_reset'),
});

const HistoryQuerySchema = z.object({
  days: z.coerce.number().min(1).max(90).default(30),
});

// ============================================
// GET /api/agents/:id/context-health
// Get context health report for an agent
// ============================================
router.get('/agents/:id/context-health', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = AgentIdSchema.parse({ id: req.params.id });
    const runCount = Math.min(parseInt(req.query.runs as string) || 50, 200);
    
    const report = await contextHealthService.analyzeAgent(id, runCount);
    
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: error.errors,
      });
    }
    console.error('[ContextHealth] Error analyzing agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze agent context health',
    });
  }
});

// ============================================
// POST /api/agents/:id/context-health/reset
// Reset poisoned context
// ============================================
router.post('/agents/:id/context-health/reset', validateToken, async (req: Request, res: Response) => {
  try {
    const { id } = AgentIdSchema.parse({ id: req.params.id });
    const { action } = ResetContextSchema.parse(req.body);
    
    // Verify agent exists
    const agentCheck = await pool.query('SELECT id, name FROM agents WHERE id = $1', [id]);
    if (agentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }
    
    const result = await contextHealthService.resetContext(id, action);
    
    // Log the reset action
    console.log(`[ContextHealth] Context reset for agent ${id}: ${action} by user ${req.user?.id}`);
    
    res.json({
      success: true,
      data: result,
      message: action === 'hard_reset' 
        ? `Hard reset completed. Cleared ${result.clearedRuns} failed runs.`
        : 'Soft reset completed. Agent ready for fresh start.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: error.errors,
      });
    }
    console.error('[ContextHealth] Error resetting context:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset agent context',
    });
  }
});

// ============================================
// GET /api/agents/:id/context-health/history
// Get context health history for trending
// ============================================
router.get('/agents/:id/context-health/history', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = AgentIdSchema.parse({ id: req.params.id });
    const { days } = HistoryQuerySchema.parse(req.query);
    
    const history = await contextHealthService.getHealthHistory(id, days);
    
    res.json({
      success: true,
      data: {
        agentId: id,
        days,
        history,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: error.errors,
      });
    }
    console.error('[ContextHealth] Error getting health history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get context health history',
    });
  }
});

// ============================================
// GET /api/context-health/overview
// Get system-wide context health overview
// ============================================
router.get('/context-health/overview', extractUser, async (req: Request, res: Response) => {
  try {
    const overview = await contextHealthService.getSystemOverview();
    
    res.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    console.error('[ContextHealth] Error getting system overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get context health overview',
    });
  }
});

// ============================================
// GET /api/context-health/failure-modes
// Get documentation about failure modes
// ============================================
router.get('/context-health/failure-modes', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      failureModes: [
        {
          id: 'poisoning',
          name: 'Context Poisoning',
          emoji: '☠️',
          description: 'Errors compounding and propagating through the context window',
          signs: [
            'Same errors repeating multiple times',
            'Cascading failures (consecutive failed runs)',
            'Error rate increasing over time',
          ],
          remediation: [
            'Clear agent context (hard reset)',
            'Fix root cause errors before continuing',
            'Add explicit error acknowledgment',
          ],
        },
        {
          id: 'distraction',
          name: 'Context Distraction',
          emoji: '🎯',
          description: 'Agent locked into a pattern, unable to adapt',
          signs: [
            'Same tools/approach used repeatedly despite failures',
            'Low approach diversity',
            'Not adapting to feedback',
          ],
          remediation: [
            'Rotate to different agent/approach',
            'Break task into smaller chunks',
            'Try different model',
          ],
        },
        {
          id: 'confusion',
          name: 'Context Confusion',
          emoji: '😵',
          description: 'Wrong tool or method selection due to unclear context',
          signs: [
            'Low tool selection confidence scores',
            'High retry counts',
            'Rapid tool switching (thrashing)',
          ],
          remediation: [
            'Clarify tool descriptions',
            'Add explicit tool selection guidance',
            'Add planning step before execution',
          ],
        },
        {
          id: 'clash',
          name: 'Context Clash',
          emoji: '⚔️',
          description: 'Contradictory instructions causing oscillating behavior',
          signs: [
            'Oscillating between approaches (A→B→A→B)',
            'Contradictory outcomes on similar tasks',
            'Inconsistent behavior',
          ],
          remediation: [
            'Audit system prompt for contradictions',
            'Check multi-agent orchestration rules',
            'Add "commit to approach" guidance',
          ],
        },
      ],
    },
  });
});

export default router;
