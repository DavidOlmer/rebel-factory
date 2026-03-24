/**
 * REBEL AI FACTORY - OBSERVABILITY ROUTES
 * LLM traces, quality scoring, and dashboard metrics
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { extractUser } from '../middleware/auth';
import { ObservabilityService } from '../services/observability.service';
import { QualityGateService } from '../services/quality-gate.service';

const router = Router();
const observability = new ObservabilityService(pool);
const qualityGate = new QualityGateService(pool);

// ============================================
// TRACE ENDPOINTS
// ============================================

/**
 * POST /api/observability/traces
 * Start a new semantic trace
 */
router.post('/traces', extractUser, async (req: Request, res: Response) => {
  try {
    const { agentId, runId, query } = req.body;

    if (!agentId || !runId || !query) {
      return res.status(400).json({ error: 'Missing required fields: agentId, runId, query' });
    }

    const traceId = await observability.startTrace(agentId, runId, query);
    res.status(201).json({ traceId });
  } catch (error) {
    console.error('Error starting trace:', error);
    res.status(500).json({ error: 'Failed to start trace' });
  }
});

/**
 * POST /api/observability/traces/:id/steps
 * Add a step to an existing trace
 */
router.post('/traces/:id/steps', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type, content, metadata, durationMs, tokens } = req.body;

    if (!type || !content) {
      return res.status(400).json({ error: 'Missing required fields: type, content' });
    }

    await observability.addStep(id, { type, content, metadata, durationMs, tokens });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error adding step:', error);
    res.status(500).json({ error: 'Failed to add step' });
  }
});

/**
 * POST /api/observability/traces/:id/complete
 * Complete a trace with final output and metrics
 */
router.post('/traces/:id/complete', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { output, metrics } = req.body;

    if (!output || !metrics) {
      return res.status(400).json({ error: 'Missing required fields: output, metrics' });
    }

    await observability.complete(id, output, metrics);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error completing trace:', error);
    res.status(500).json({ error: 'Failed to complete trace' });
  }
});

/**
 * POST /api/observability/traces/:id/fail
 * Mark a trace as failed
 */
router.post('/traces/:id/fail', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error: errorMsg, metrics } = req.body;

    await observability.fail(id, errorMsg || 'Unknown error', metrics);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error failing trace:', error);
    res.status(500).json({ error: 'Failed to update trace' });
  }
});

/**
 * POST /api/observability/traces/:id/quality
 * Score a trace's quality
 */
router.post('/traces/:id/quality', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { correctness, relevance, hallucination, coherence, completeness } = req.body;

    await observability.scoreQuality(id, { 
      correctness, relevance, hallucination, coherence, completeness 
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error scoring quality:', error);
    res.status(500).json({ error: 'Failed to score quality' });
  }
});

/**
 * GET /api/observability/traces/:id
 * Get a single trace by ID
 */
router.get('/traces/:id', extractUser, async (req: Request, res: Response) => {
  try {
    const trace = await observability.getTrace(req.params.id);
    
    if (!trace) {
      return res.status(404).json({ error: 'Trace not found' });
    }

    res.json(trace);
  } catch (error) {
    console.error('Error fetching trace:', error);
    res.status(500).json({ error: 'Failed to fetch trace' });
  }
});

/**
 * GET /api/observability/traces/run/:runId
 * Get trace by run ID
 */
router.get('/traces/run/:runId', extractUser, async (req: Request, res: Response) => {
  try {
    const trace = await observability.getTraceByRun(req.params.runId);
    
    if (!trace) {
      return res.status(404).json({ error: 'Trace not found' });
    }

    res.json(trace);
  } catch (error) {
    console.error('Error fetching trace:', error);
    res.status(500).json({ error: 'Failed to fetch trace' });
  }
});

/**
 * GET /api/observability/traces
 * List traces with filtering
 */
router.get('/traces', extractUser, async (req: Request, res: Response) => {
  try {
    const { 
      agentId, runId, minQuality, maxLatencyMs,
      startDate, endDate, limit, offset 
    } = req.query;

    const result = await observability.listTraces({
      agentId: agentId as string,
      runId: runId as string,
      minQuality: minQuality ? parseInt(minQuality as string, 10) : undefined,
      maxLatencyMs: maxLatencyMs ? parseInt(maxLatencyMs as string, 10) : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0
    });

    res.json(result);
  } catch (error) {
    console.error('Error listing traces:', error);
    res.status(500).json({ error: 'Failed to list traces' });
  }
});

// ============================================
// DASHBOARD ENDPOINTS
// ============================================

/**
 * GET /api/observability/dashboard
 * Get dashboard metrics
 */
router.get('/dashboard', extractUser, async (req: Request, res: Response) => {
  try {
    const { hours = '24', agentId } = req.query;
    const hoursNum = Math.min(parseInt(hours as string, 10), 168); // Max 1 week

    const dashboard = await observability.getDashboard(hoursNum, agentId as string);
    res.json(dashboard);
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

/**
 * GET /api/observability/trends
 * Get quality trends over time
 */
router.get('/trends', extractUser, async (req: Request, res: Response) => {
  try {
    const { days = '7', agentId } = req.query;
    const daysNum = Math.min(parseInt(days as string, 10), 30);

    const trends = await observability.getQualityTrends(daysNum, agentId as string);
    res.json(trends);
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

/**
 * GET /api/observability/low-quality
 * Get traces with low quality for review
 */
router.get('/low-quality', extractUser, async (req: Request, res: Response) => {
  try {
    const { threshold = '50', limit = '20' } = req.query;
    
    const traces = await observability.getLowQualityTraces(
      parseInt(threshold as string, 10),
      parseInt(limit as string, 10)
    );

    res.json(traces);
  } catch (error) {
    console.error('Error fetching low quality traces:', error);
    res.status(500).json({ error: 'Failed to fetch traces' });
  }
});

/**
 * GET /api/observability/agents/:agentId/traces
 * Get recent traces for an agent
 */
router.get('/agents/:agentId/traces', extractUser, async (req: Request, res: Response) => {
  try {
    const { limit = '10' } = req.query;
    
    const traces = await observability.getAgentTraces(
      req.params.agentId,
      parseInt(limit as string, 10)
    );

    res.json(traces);
  } catch (error) {
    console.error('Error fetching agent traces:', error);
    res.status(500).json({ error: 'Failed to fetch traces' });
  }
});

// ============================================
// QUALITY GATE ENDPOINTS
// ============================================

/**
 * POST /api/observability/quality-gate/run
 * Run the quality gate on content
 */
router.post('/quality-gate/run', extractUser, async (req: Request, res: Response) => {
  try {
    const { runId, content, config } = req.body;

    if (!runId || !content) {
      return res.status(400).json({ error: 'Missing required fields: runId, content' });
    }

    const result = await qualityGate.runGate(runId, content, config);
    res.json(result);
  } catch (error) {
    console.error('Error running quality gate:', error);
    res.status(500).json({ error: 'Failed to run quality gate' });
  }
});

/**
 * GET /api/observability/quality-gate/history
 * Get quality gate run history
 */
router.get('/quality-gate/history', extractUser, async (req: Request, res: Response) => {
  try {
    const { limit = '20' } = req.query;
    
    const history = await qualityGate.getHistory(parseInt(limit as string, 10));
    res.json(history);
  } catch (error) {
    console.error('Error fetching quality gate history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/**
 * GET /api/observability/quality-gate/stats
 * Get quality gate statistics
 */
router.get('/quality-gate/stats', extractUser, async (req: Request, res: Response) => {
  try {
    const { days = '7' } = req.query;
    
    const stats = await qualityGate.getStats(parseInt(days as string, 10));
    res.json(stats);
  } catch (error) {
    console.error('Error fetching quality gate stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
