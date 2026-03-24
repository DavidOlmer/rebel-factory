/**
 * REBEL AI FACTORY - TELEMETRY ROUTES
 * REBAA-34: Agent telemetry, learning insights, and performance metrics
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { extractUser } from '../middleware/auth';

const router = Router();

// ============================================
// GET /api/telemetry/insights - Get learning insights
// Recent patterns, anomalies, and recommendations
// ============================================
router.get('/insights', extractUser, async (req: Request, res: Response) => {
  try {
    const { tenantId, agentId, days = '7', limit = '20' } = req.query;
    const daysNum = Math.min(parseInt(days as string, 10), 30);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    
    let query = `
      SELECT 
        li.*,
        a.name as agent_name,
        a.emoji as agent_emoji
      FROM learning_insights li
      LEFT JOIN agents a ON li.agent_id = a.id
      WHERE li.created_at > NOW() - INTERVAL '1 day' * $1
    `;
    const params: unknown[] = [daysNum];
    
    if (tenantId) {
      params.push(tenantId);
      query += ` AND li.tenant_id = $${params.length}`;
    }
    
    if (agentId) {
      params.push(agentId);
      query += ` AND li.agent_id = $${params.length}`;
    }
    
    params.push(limitNum);
    query += ` ORDER BY li.created_at DESC LIMIT $${params.length}`;
    
    const result = await pool.query(query, params);
    
    res.json({
      insights: result.rows.map(row => ({
        id: row.id,
        agentId: row.agent_id,
        agentName: row.agent_name,
        agentEmoji: row.agent_emoji,
        type: row.insight_type,
        severity: row.severity,
        title: row.title,
        description: row.description,
        data: row.data,
        recommendation: row.recommendation,
        status: row.status,
        acknowledgedBy: row.acknowledged_by,
        acknowledgedAt: row.acknowledged_at,
        createdAt: row.created_at
      })),
      period: daysNum
    });
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

// ============================================
// GET /api/telemetry/metrics - Get aggregated metrics
// Daily/hourly aggregates for dashboards
// ============================================
router.get('/metrics', extractUser, async (req: Request, res: Response) => {
  try {
    const { tenantId, agentId, days = '30', granularity = 'day' } = req.query;
    const daysNum = Math.min(parseInt(days as string, 10), 90);
    
    // Determine date truncation based on granularity
    const dateTrunc = granularity === 'hour' ? 'hour' : 'day';
    
    let query = `
      SELECT 
        DATE_TRUNC('${dateTrunc}', r.started_at) as period,
        COUNT(*) as runs,
        COUNT(*) FILTER (WHERE r.success = true) as successful_runs,
        COUNT(*) FILTER (WHERE r.success = false) as failed_runs,
        AVG(r.quality_score) FILTER (WHERE r.quality_score IS NOT NULL) as avg_quality,
        AVG(r.duration_ms) as avg_duration_ms,
        MIN(r.duration_ms) as min_duration_ms,
        MAX(r.duration_ms) as max_duration_ms,
        SUM(COALESCE(r.input_tokens, 0)) as input_tokens,
        SUM(COALESCE(r.output_tokens, 0)) as output_tokens,
        SUM(COALESCE(r.input_tokens, 0) + COALESCE(r.output_tokens, 0)) as total_tokens,
        SUM(COALESCE(r.cost, 0)) as total_cost,
        COUNT(DISTINCT r.agent_id) as unique_agents,
        COUNT(DISTINCT r.task_type) as unique_task_types
      FROM agent_runs r
      JOIN agents a ON a.id = r.agent_id
      WHERE r.started_at > NOW() - INTERVAL '1 day' * $1
    `;
    const params: unknown[] = [daysNum];
    
    if (tenantId) {
      params.push(tenantId);
      query += ` AND a.tenant_id = $${params.length}`;
    }
    
    if (agentId) {
      params.push(agentId);
      query += ` AND r.agent_id = $${params.length}`;
    }
    
    query += ` GROUP BY DATE_TRUNC('${dateTrunc}', r.started_at) ORDER BY period DESC`;
    
    const result = await pool.query(query, params);
    
    res.json({
      metrics: result.rows.map(row => ({
        period: row.period,
        runs: parseInt(row.runs, 10),
        successfulRuns: parseInt(row.successful_runs, 10),
        failedRuns: parseInt(row.failed_runs, 10),
        successRate: row.runs > 0 
          ? ((parseInt(row.successful_runs, 10) / parseInt(row.runs, 10)) * 100).toFixed(1)
          : '0.0',
        avgQuality: parseFloat(row.avg_quality || '0').toFixed(2),
        avgDurationMs: parseInt(row.avg_duration_ms || '0', 10),
        minDurationMs: parseInt(row.min_duration_ms || '0', 10),
        maxDurationMs: parseInt(row.max_duration_ms || '0', 10),
        inputTokens: parseInt(row.input_tokens || '0', 10),
        outputTokens: parseInt(row.output_tokens || '0', 10),
        totalTokens: parseInt(row.total_tokens || '0', 10),
        totalCost: parseFloat(row.total_cost || '0').toFixed(4),
        uniqueAgents: parseInt(row.unique_agents, 10),
        uniqueTaskTypes: parseInt(row.unique_task_types, 10)
      })),
      granularity,
      days: daysNum
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// ============================================
// GET /api/telemetry/costs - Cost breakdown
// By agent, model, task type
// ============================================
router.get('/costs', extractUser, async (req: Request, res: Response) => {
  try {
    const { tenantId, days = '30', groupBy = 'agent' } = req.query;
    const daysNum = Math.min(parseInt(days as string, 10), 90);
    
    let groupColumn: string;
    let selectColumn: string;
    
    switch (groupBy) {
      case 'model':
        groupColumn = 'r.model';
        selectColumn = 'r.model as name';
        break;
      case 'task':
        groupColumn = 'r.task_type';
        selectColumn = 'COALESCE(r.task_type, \'unknown\') as name';
        break;
      case 'agent':
      default:
        groupColumn = 'a.id, a.name, a.emoji';
        selectColumn = 'a.name as name, a.emoji as emoji, a.id as agent_id';
    }
    
    const params: unknown[] = [daysNum];
    let tenantFilter = '';
    
    if (tenantId) {
      params.push(tenantId);
      tenantFilter = ` AND a.tenant_id = $${params.length}`;
    }
    
    const result = await pool.query(`
      SELECT 
        ${selectColumn},
        COUNT(*) as runs,
        SUM(COALESCE(r.input_tokens, 0)) as input_tokens,
        SUM(COALESCE(r.output_tokens, 0)) as output_tokens,
        SUM(COALESCE(r.input_tokens, 0) + COALESCE(r.output_tokens, 0)) as total_tokens,
        SUM(COALESCE(r.cost, 0)) as total_cost,
        AVG(COALESCE(r.cost, 0)) as avg_cost_per_run
      FROM agent_runs r
      JOIN agents a ON a.id = r.agent_id
      WHERE r.started_at > NOW() - INTERVAL '1 day' * $1
        ${tenantFilter}
      GROUP BY ${groupColumn}
      ORDER BY total_cost DESC
      LIMIT 50
    `, params);
    
    // Get total cost for percentage calculation
    const totalResult = await pool.query(`
      SELECT SUM(COALESCE(r.cost, 0)) as total_cost
      FROM agent_runs r
      JOIN agents a ON a.id = r.agent_id
      WHERE r.started_at > NOW() - INTERVAL '1 day' * $1
        ${tenantFilter}
    `, params);
    
    const grandTotal = parseFloat(totalResult.rows[0]?.total_cost || '0');
    
    res.json({
      costs: result.rows.map(row => ({
        name: row.name,
        emoji: row.emoji,
        agentId: row.agent_id,
        runs: parseInt(row.runs, 10),
        inputTokens: parseInt(row.input_tokens || '0', 10),
        outputTokens: parseInt(row.output_tokens || '0', 10),
        totalTokens: parseInt(row.total_tokens || '0', 10),
        totalCost: parseFloat(row.total_cost || '0').toFixed(4),
        avgCostPerRun: parseFloat(row.avg_cost_per_run || '0').toFixed(6),
        percentage: grandTotal > 0 
          ? ((parseFloat(row.total_cost || '0') / grandTotal) * 100).toFixed(1)
          : '0.0'
      })),
      grandTotal: grandTotal.toFixed(2),
      groupBy,
      days: daysNum
    });
  } catch (error) {
    console.error('Error fetching costs:', error);
    res.status(500).json({ error: 'Failed to fetch costs' });
  }
});

// ============================================
// GET /api/telemetry/performance - Performance metrics by agent
// ============================================
router.get('/performance', extractUser, async (req: Request, res: Response) => {
  try {
    const { tenantId, days = '7' } = req.query;
    const daysNum = Math.min(parseInt(days as string, 10), 30);
    
    const params: unknown[] = [daysNum];
    let tenantFilter = '';
    
    if (tenantId) {
      params.push(tenantId);
      tenantFilter = ` AND a.tenant_id = $${params.length}`;
    }
    
    const result = await pool.query(`
      SELECT 
        a.id,
        a.name,
        a.emoji,
        a.tier,
        COUNT(r.id) as total_runs,
        COUNT(r.id) FILTER (WHERE r.success = true) as successful_runs,
        AVG(r.quality_score) FILTER (WHERE r.quality_score IS NOT NULL) as avg_quality,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY r.duration_ms) as p50_duration,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY r.duration_ms) as p95_duration,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY r.duration_ms) as p99_duration,
        AVG(r.duration_ms) as avg_duration,
        SUM(COALESCE(r.cost, 0)) as total_cost,
        AVG(COALESCE(r.input_tokens, 0) + COALESCE(r.output_tokens, 0)) as avg_tokens_per_run,
        MAX(r.started_at) as last_run_at
      FROM agents a
      LEFT JOIN agent_runs r ON r.agent_id = a.id 
        AND r.started_at > NOW() - INTERVAL '1 day' * $1
      WHERE 1=1 ${tenantFilter}
      GROUP BY a.id, a.name, a.emoji, a.tier
      HAVING COUNT(r.id) > 0
      ORDER BY total_runs DESC
    `, params);
    
    res.json({
      agents: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        emoji: row.emoji,
        tier: row.tier,
        totalRuns: parseInt(row.total_runs, 10),
        successfulRuns: parseInt(row.successful_runs, 10),
        successRate: row.total_runs > 0
          ? ((parseInt(row.successful_runs, 10) / parseInt(row.total_runs, 10)) * 100).toFixed(1)
          : '0.0',
        avgQuality: parseFloat(row.avg_quality || '0').toFixed(2),
        p50DurationMs: parseInt(row.p50_duration || '0', 10),
        p95DurationMs: parseInt(row.p95_duration || '0', 10),
        p99DurationMs: parseInt(row.p99_duration || '0', 10),
        avgDurationMs: parseInt(row.avg_duration || '0', 10),
        totalCost: parseFloat(row.total_cost || '0').toFixed(4),
        avgTokensPerRun: parseInt(row.avg_tokens_per_run || '0', 10),
        lastRunAt: row.last_run_at
      })),
      days: daysNum
    });
  } catch (error) {
    console.error('Error fetching performance:', error);
    res.status(500).json({ error: 'Failed to fetch performance' });
  }
});

// ============================================
// GET /api/telemetry/quality - Quality metrics over time
// ============================================
router.get('/quality', extractUser, async (req: Request, res: Response) => {
  try {
    const { tenantId, agentId, days = '14' } = req.query;
    const daysNum = Math.min(parseInt(days as string, 10), 60);
    
    const params: unknown[] = [daysNum];
    let filters = '';
    
    if (tenantId) {
      params.push(tenantId);
      filters += ` AND a.tenant_id = $${params.length}`;
    }
    
    if (agentId) {
      params.push(agentId);
      filters += ` AND r.agent_id = $${params.length}`;
    }
    
    const result = await pool.query(`
      SELECT 
        DATE(r.started_at) as date,
        COUNT(*) as runs,
        AVG(r.quality_score) FILTER (WHERE r.quality_score IS NOT NULL) as avg_quality,
        MIN(r.quality_score) FILTER (WHERE r.quality_score IS NOT NULL) as min_quality,
        MAX(r.quality_score) FILTER (WHERE r.quality_score IS NOT NULL) as max_quality,
        STDDEV(r.quality_score) FILTER (WHERE r.quality_score IS NOT NULL) as quality_stddev,
        COUNT(*) FILTER (WHERE r.quality_score >= 0.8) as high_quality_runs,
        COUNT(*) FILTER (WHERE r.quality_score < 0.5) as low_quality_runs
      FROM agent_runs r
      JOIN agents a ON a.id = r.agent_id
      WHERE r.started_at > NOW() - INTERVAL '1 day' * $1
        AND r.quality_score IS NOT NULL
        ${filters}
      GROUP BY DATE(r.started_at)
      ORDER BY date DESC
    `, params);
    
    res.json({
      quality: result.rows.map(row => ({
        date: row.date,
        runs: parseInt(row.runs, 10),
        avgQuality: parseFloat(row.avg_quality || '0').toFixed(3),
        minQuality: parseFloat(row.min_quality || '0').toFixed(3),
        maxQuality: parseFloat(row.max_quality || '0').toFixed(3),
        qualityStddev: parseFloat(row.quality_stddev || '0').toFixed(3),
        highQualityRuns: parseInt(row.high_quality_runs, 10),
        lowQualityRuns: parseInt(row.low_quality_runs, 10)
      })),
      days: daysNum
    });
  } catch (error) {
    console.error('Error fetching quality metrics:', error);
    res.status(500).json({ error: 'Failed to fetch quality metrics' });
  }
});

// ============================================
// POST /api/telemetry/insights/:id/acknowledge - Acknowledge insight
// ============================================
router.post('/insights/:id/acknowledge', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    const result = await pool.query(`
      UPDATE learning_insights 
      SET 
        status = 'acknowledged',
        acknowledged_by = $1,
        acknowledged_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [userId || 'system', id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Insight not found' });
    }
    
    res.json({ success: true, insight: result.rows[0] });
  } catch (error) {
    console.error('Error acknowledging insight:', error);
    res.status(500).json({ error: 'Failed to acknowledge insight' });
  }
});

// ============================================
// POST /api/telemetry/insights/:id/dismiss - Dismiss insight
// ============================================
router.post('/insights/:id/dismiss', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user?.id;
    
    const result = await pool.query(`
      UPDATE learning_insights 
      SET 
        status = 'dismissed',
        dismissed_by = $1,
        dismissed_at = NOW(),
        dismiss_reason = $2
      WHERE id = $3
      RETURNING *
    `, [userId || 'system', reason || null, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Insight not found' });
    }
    
    res.json({ success: true, insight: result.rows[0] });
  } catch (error) {
    console.error('Error dismissing insight:', error);
    res.status(500).json({ error: 'Failed to dismiss insight' });
  }
});

// ============================================
// GET /api/telemetry/runs - Recent runs with details
// ============================================
router.get('/runs', extractUser, async (req: Request, res: Response) => {
  try {
    const { tenantId, agentId, status, limit = '50', offset = '0' } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10), 200);
    const offsetNum = parseInt(offset as string, 10);
    
    const params: unknown[] = [];
    let query = `
      SELECT 
        r.*,
        a.name as agent_name,
        a.emoji as agent_emoji,
        a.tier as agent_tier
      FROM agent_runs r
      JOIN agents a ON r.agent_id = a.id
      WHERE 1=1
    `;
    
    if (tenantId) {
      params.push(tenantId);
      query += ` AND a.tenant_id = $${params.length}`;
    }
    
    if (agentId) {
      params.push(agentId);
      query += ` AND r.agent_id = $${params.length}`;
    }
    
    if (status === 'success') {
      query += ` AND r.success = true`;
    } else if (status === 'failed') {
      query += ` AND r.success = false`;
    }
    
    params.push(limitNum);
    params.push(offsetNum);
    query += ` ORDER BY r.started_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const result = await pool.query(query, params);
    
    res.json({
      runs: result.rows.map(row => ({
        id: row.id,
        agentId: row.agent_id,
        agentName: row.agent_name,
        agentEmoji: row.agent_emoji,
        agentTier: row.agent_tier,
        taskType: row.task_type,
        success: row.success,
        qualityScore: row.quality_score ? parseFloat(row.quality_score).toFixed(2) : null,
        durationMs: row.duration_ms,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        totalTokens: (row.input_tokens || 0) + (row.output_tokens || 0),
        cost: row.cost ? parseFloat(row.cost).toFixed(6) : null,
        model: row.model,
        errorType: row.error_type,
        errorMessage: row.error_message,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        metadata: row.metadata
      })),
      limit: limitNum,
      offset: offsetNum
    });
  } catch (error) {
    console.error('Error fetching runs:', error);
    res.status(500).json({ error: 'Failed to fetch runs' });
  }
});

// ============================================
// GET /api/telemetry/runs/:id - Get single run details
// ============================================
router.get('/runs/:id', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        r.*,
        a.name as agent_name,
        a.emoji as agent_emoji,
        a.tier as agent_tier,
        a.creature as agent_creature
      FROM agent_runs r
      JOIN agents a ON r.agent_id = a.id
      WHERE r.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    const row = result.rows[0];
    
    res.json({
      run: {
        id: row.id,
        agentId: row.agent_id,
        agentName: row.agent_name,
        agentEmoji: row.agent_emoji,
        agentTier: row.agent_tier,
        agentCreature: row.agent_creature,
        taskType: row.task_type,
        taskDescription: row.task_description,
        success: row.success,
        qualityScore: row.quality_score ? parseFloat(row.quality_score).toFixed(2) : null,
        durationMs: row.duration_ms,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        totalTokens: (row.input_tokens || 0) + (row.output_tokens || 0),
        cost: row.cost ? parseFloat(row.cost).toFixed(6) : null,
        model: row.model,
        errorType: row.error_type,
        errorMessage: row.error_message,
        errorStack: row.error_stack,
        input: row.input,
        output: row.output,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        metadata: row.metadata
      }
    });
  } catch (error) {
    console.error('Error fetching run:', error);
    res.status(500).json({ error: 'Failed to fetch run' });
  }
});

// ============================================
// GET /api/telemetry/anomalies - Detect anomalies
// ============================================
router.get('/anomalies', extractUser, async (req: Request, res: Response) => {
  try {
    const { tenantId, days = '7' } = req.query;
    const daysNum = Math.min(parseInt(days as string, 10), 30);
    
    const params: unknown[] = [daysNum];
    let tenantFilter = '';
    
    if (tenantId) {
      params.push(tenantId);
      tenantFilter = ` AND a.tenant_id = $${params.length}`;
    }
    
    // Find agents with unusual patterns
    const result = await pool.query(`
      WITH agent_stats AS (
        SELECT 
          a.id,
          a.name,
          a.emoji,
          AVG(r.quality_score) as avg_quality,
          STDDEV(r.quality_score) as quality_stddev,
          AVG(r.duration_ms) as avg_duration,
          STDDEV(r.duration_ms) as duration_stddev,
          COUNT(*) FILTER (WHERE r.success = false) as recent_failures,
          COUNT(*) as total_runs
        FROM agents a
        JOIN agent_runs r ON r.agent_id = a.id
        WHERE r.started_at > NOW() - INTERVAL '1 day' * $1
          ${tenantFilter}
        GROUP BY a.id, a.name, a.emoji
        HAVING COUNT(*) >= 5
      )
      SELECT 
        *,
        CASE 
          WHEN recent_failures::float / total_runs > 0.3 THEN 'high_failure_rate'
          WHEN quality_stddev > 0.3 THEN 'inconsistent_quality'
          WHEN duration_stddev > avg_duration THEN 'inconsistent_duration'
          ELSE NULL
        END as anomaly_type
      FROM agent_stats
      WHERE 
        recent_failures::float / total_runs > 0.3
        OR quality_stddev > 0.3
        OR duration_stddev > avg_duration
      ORDER BY recent_failures DESC
    `, params);
    
    res.json({
      anomalies: result.rows.map(row => ({
        agentId: row.id,
        agentName: row.name,
        agentEmoji: row.emoji,
        anomalyType: row.anomaly_type,
        avgQuality: parseFloat(row.avg_quality || '0').toFixed(2),
        qualityStddev: parseFloat(row.quality_stddev || '0').toFixed(2),
        avgDurationMs: parseInt(row.avg_duration || '0', 10),
        durationStddev: parseInt(row.duration_stddev || '0', 10),
        recentFailures: parseInt(row.recent_failures, 10),
        totalRuns: parseInt(row.total_runs, 10),
        failureRate: ((parseInt(row.recent_failures, 10) / parseInt(row.total_runs, 10)) * 100).toFixed(1)
      })),
      days: daysNum
    });
  } catch (error) {
    console.error('Error fetching anomalies:', error);
    res.status(500).json({ error: 'Failed to fetch anomalies' });
  }
});

export default router;
