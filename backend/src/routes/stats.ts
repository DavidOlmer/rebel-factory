/**
 * REBEL AI FACTORY - STATS ROUTES
 * REBAA-32: Dashboard statistics and metrics
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { extractUser } from '../middleware/auth';

const router = Router();

// ============================================
// DASHBOARD OVERVIEW STATS
// Real-time metrics for the main dashboard
// ============================================
router.get('/', extractUser, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    
    // Build tenant filter
    const tenantFilter = tenantId ? 'AND a.tenant_id = $1' : '';
    const tenantParams = tenantId ? [tenantId] : [];
    
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM agents a WHERE status = 'active' ${tenantFilter}) as active_agents,
        (SELECT COUNT(*) FROM agents a WHERE status = 'running' ${tenantFilter}) as running_agents,
        (SELECT COUNT(*) FROM agents a WHERE 1=1 ${tenantFilter}) as total_agents,
        (SELECT COUNT(*) FROM agent_runs r 
         JOIN agents a ON a.id = r.agent_id 
         WHERE r.started_at > NOW() - INTERVAL '1 day' ${tenantFilter}) as runs_today,
        (SELECT COUNT(*) FROM agent_runs r 
         JOIN agents a ON a.id = r.agent_id 
         WHERE r.started_at > NOW() - INTERVAL '7 days' ${tenantFilter}) as runs_this_week,
        (SELECT AVG(quality_score) FROM agent_runs r 
         JOIN agents a ON a.id = r.agent_id 
         WHERE r.started_at > NOW() - INTERVAL '7 days' 
           AND r.quality_score IS NOT NULL ${tenantFilter}) as avg_quality_7d,
        (SELECT AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) * 100 
         FROM agent_runs r 
         JOIN agents a ON a.id = r.agent_id 
         WHERE r.started_at > NOW() - INTERVAL '7 days' ${tenantFilter}) as success_rate_7d,
        (SELECT SUM(total_tokens) FROM agent_runs r 
         JOIN agents a ON a.id = r.agent_id 
         WHERE r.started_at > NOW() - INTERVAL '30 days' ${tenantFilter}) as tokens_30d
    `, tenantParams);
    
    // Calculate estimated cost (simplified pricing)
    const tokens = parseInt(stats.rows[0]?.tokens_30d || '0', 10);
    const estimatedCostUsd = (tokens / 1000000) * 3; // ~$3/1M tokens average
    
    res.json({
      activeAgents: parseInt(stats.rows[0]?.active_agents || '0', 10),
      runningAgents: parseInt(stats.rows[0]?.running_agents || '0', 10),
      totalAgents: parseInt(stats.rows[0]?.total_agents || '0', 10),
      runsToday: parseInt(stats.rows[0]?.runs_today || '0', 10),
      runsThisWeek: parseInt(stats.rows[0]?.runs_this_week || '0', 10),
      avgQuality7d: parseFloat(stats.rows[0]?.avg_quality_7d || '0').toFixed(1),
      successRate7d: parseFloat(stats.rows[0]?.success_rate_7d || '0').toFixed(1),
      tokens30d: tokens,
      monthlySpendUsd: estimatedCostUsd.toFixed(2),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ============================================
// DAILY TRENDS (last 30 days)
// ============================================
router.get('/trends', extractUser, async (req: Request, res: Response) => {
  try {
    const { tenantId, days = '30' } = req.query;
    const daysNum = Math.min(parseInt(days as string, 10), 90);
    
    const tenantFilter = tenantId ? 'AND a.tenant_id = $2' : '';
    const params = tenantId ? [daysNum, tenantId] : [daysNum];
    
    const result = await pool.query(`
      SELECT
        DATE(r.started_at) as date,
        COUNT(*) as runs,
        COUNT(*) FILTER (WHERE r.success = true) as successful_runs,
        COUNT(*) FILTER (WHERE r.success = false) as failed_runs,
        SUM(r.total_tokens) as total_tokens,
        AVG(r.quality_score) as avg_quality,
        AVG(r.duration_ms) as avg_duration_ms,
        COUNT(DISTINCT r.agent_id) as active_agents
      FROM agent_runs r
      JOIN agents a ON a.id = r.agent_id
      WHERE r.started_at > NOW() - INTERVAL '1 day' * $1
        ${tenantFilter}
      GROUP BY DATE(r.started_at)
      ORDER BY date DESC
    `, params);
    
    res.json({
      trends: result.rows.map(row => ({
        date: row.date,
        runs: parseInt(row.runs, 10),
        successfulRuns: parseInt(row.successful_runs, 10),
        failedRuns: parseInt(row.failed_runs, 10),
        totalTokens: parseInt(row.total_tokens || '0', 10),
        avgQuality: parseFloat(row.avg_quality || '0').toFixed(1),
        avgDurationMs: parseInt(row.avg_duration_ms || '0', 10),
        activeAgents: parseInt(row.active_agents, 10)
      })),
      days: daysNum
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// ============================================
// TOP AGENTS (by runs)
// ============================================
router.get('/top-agents', extractUser, async (req: Request, res: Response) => {
  try {
    const { tenantId, limit = '10', period = '7' } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10), 50);
    const periodDays = Math.min(parseInt(period as string, 10), 90);
    
    const tenantFilter = tenantId ? 'AND a.tenant_id = $3' : '';
    const params = tenantId ? [periodDays, limitNum, tenantId] : [periodDays, limitNum];
    
    const result = await pool.query(`
      SELECT 
        a.id,
        a.name,
        a.creature,
        a.emoji,
        a.tier,
        a.status,
        COUNT(r.id) as run_count,
        COUNT(r.id) FILTER (WHERE r.success = true) as successful_runs,
        AVG(r.quality_score) as avg_quality,
        SUM(r.total_tokens) as total_tokens,
        MAX(r.started_at) as last_run_at
      FROM agents a
      LEFT JOIN agent_runs r ON r.agent_id = a.id 
        AND r.started_at > NOW() - INTERVAL '1 day' * $1
      WHERE 1=1 ${tenantFilter}
      GROUP BY a.id, a.name, a.creature, a.emoji, a.tier, a.status
      ORDER BY run_count DESC
      LIMIT $2
    `, params);
    
    res.json({
      agents: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        creature: row.creature,
        emoji: row.emoji,
        tier: row.tier,
        status: row.status,
        runCount: parseInt(row.run_count, 10),
        successfulRuns: parseInt(row.successful_runs || '0', 10),
        successRate: row.run_count > 0 
          ? ((parseInt(row.successful_runs || '0', 10) / parseInt(row.run_count, 10)) * 100).toFixed(1)
          : '0.0',
        avgQuality: parseFloat(row.avg_quality || '0').toFixed(1),
        totalTokens: parseInt(row.total_tokens || '0', 10),
        lastRunAt: row.last_run_at
      })),
      period: periodDays
    });
  } catch (error) {
    console.error('Error fetching top agents:', error);
    res.status(500).json({ error: 'Failed to fetch top agents' });
  }
});

// ============================================
// TASK TYPE BREAKDOWN
// ============================================
router.get('/by-task-type', extractUser, async (req: Request, res: Response) => {
  try {
    const { tenantId, period = '30' } = req.query;
    const periodDays = Math.min(parseInt(period as string, 10), 90);
    
    const tenantFilter = tenantId ? 'AND a.tenant_id = $2' : '';
    const params = tenantId ? [periodDays, tenantId] : [periodDays];
    
    const result = await pool.query(`
      SELECT 
        r.task_type as "taskType",
        COUNT(*) as runs,
        COUNT(*) FILTER (WHERE r.success = true) as successful,
        AVG(r.quality_score) as avg_quality,
        AVG(r.duration_ms) as avg_duration_ms,
        SUM(r.total_tokens) as total_tokens
      FROM agent_runs r
      JOIN agents a ON a.id = r.agent_id
      WHERE r.started_at > NOW() - INTERVAL '1 day' * $1
        AND r.task_type IS NOT NULL
        ${tenantFilter}
      GROUP BY r.task_type
      ORDER BY runs DESC
    `, params);
    
    res.json({
      breakdown: result.rows.map(row => ({
        taskType: row.taskType,
        runs: parseInt(row.runs, 10),
        successful: parseInt(row.successful, 10),
        successRate: ((parseInt(row.successful, 10) / parseInt(row.runs, 10)) * 100).toFixed(1),
        avgQuality: parseFloat(row.avg_quality || '0').toFixed(1),
        avgDurationMs: parseInt(row.avg_duration_ms || '0', 10),
        totalTokens: parseInt(row.total_tokens || '0', 10)
      })),
      period: periodDays
    });
  } catch (error) {
    console.error('Error fetching task type breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch breakdown' });
  }
});

// ============================================
// TIER DISTRIBUTION
// ============================================
router.get('/by-tier', extractUser, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    
    const tenantFilter = tenantId ? 'WHERE tenant_id = $1' : '';
    const params = tenantId ? [tenantId] : [];
    
    const result = await pool.query(`
      SELECT 
        COALESCE(tier, 'personal') as tier,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'running') as running,
        COUNT(*) FILTER (WHERE status = 'idle') as idle,
        COUNT(*) FILTER (WHERE status = 'paused') as paused,
        COUNT(*) FILTER (WHERE status = 'archived') as archived
      FROM agents
      ${tenantFilter}
      GROUP BY COALESCE(tier, 'personal')
      ORDER BY 
        CASE COALESCE(tier, 'personal')
          WHEN 'core' THEN 1
          WHEN 'venture' THEN 2
          WHEN 'personal' THEN 3
        END
    `, params);
    
    res.json({
      tiers: result.rows.map(row => ({
        tier: row.tier,
        count: parseInt(row.count, 10),
        active: parseInt(row.active, 10),
        running: parseInt(row.running, 10),
        idle: parseInt(row.idle, 10),
        paused: parseInt(row.paused, 10),
        archived: parseInt(row.archived, 10)
      }))
    });
  } catch (error) {
    console.error('Error fetching tier distribution:', error);
    res.status(500).json({ error: 'Failed to fetch tier distribution' });
  }
});

// ============================================
// RECENT ERRORS
// ============================================
router.get('/errors', extractUser, async (req: Request, res: Response) => {
  try {
    const { tenantId, limit = '20' } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    
    const tenantFilter = tenantId ? 'AND a.tenant_id = $2' : '';
    const params = tenantId ? [limitNum, tenantId] : [limitNum];
    
    const result = await pool.query(`
      SELECT 
        r.id as run_id,
        r.agent_id,
        a.name as agent_name,
        a.emoji,
        r.error_type,
        r.error_message,
        r.task_type,
        r.started_at,
        r.completed_at
      FROM agent_runs r
      JOIN agents a ON a.id = r.agent_id
      WHERE r.success = false
        AND r.error_type IS NOT NULL
        ${tenantFilter}
      ORDER BY r.started_at DESC
      LIMIT $1
    `, params);
    
    res.json({
      errors: result.rows.map(row => ({
        runId: row.run_id,
        agentId: row.agent_id,
        agentName: row.agent_name,
        emoji: row.emoji,
        errorType: row.error_type,
        errorMessage: row.error_message,
        taskType: row.task_type,
        startedAt: row.started_at,
        completedAt: row.completed_at
      }))
    });
  } catch (error) {
    console.error('Error fetching recent errors:', error);
    res.status(500).json({ error: 'Failed to fetch errors' });
  }
});

export default router;
