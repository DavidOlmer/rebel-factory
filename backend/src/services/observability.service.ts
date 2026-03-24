/**
 * REBEL AI FACTORY - LLM OBSERVABILITY SERVICE
 * 
 * Semantic traces for AI agents with quality scoring
 * Based on KB concepts:
 * - Context Engineering (understanding agent decisions)
 * - Dense Feedback Loops (quality signals)
 * - Failure Mode Detection (hallucination, drift)
 */

import { Pool } from 'pg';

// ============================================
// TYPES
// ============================================

export interface SemanticTrace {
  id: string;
  agentId: string;
  runId: string;
  userQuery: string;
  steps: TraceStep[];
  finalOutput: string;
  metrics: TraceMetrics;
  quality: QualityScores;
  startedAt: Date;
  completedAt?: Date;
}

export interface TraceStep {
  timestamp: Date;
  type: 'thought' | 'tool_call' | 'tool_result' | 'decision' | 'output';
  content: string;
  metadata?: Record<string, unknown>;
  durationMs?: number;
  tokens?: number;
}

export interface TraceMetrics {
  latencyMs: number;
  tokens: number;
  cost: number;
  stepCount?: number;
  toolCalls?: number;
  retriesCount?: number;
}

export interface QualityScores {
  correctness?: number;   // 0-100: Did the agent answer correctly?
  relevance?: number;     // 0-100: Was the response relevant to the query?
  hallucination?: number; // 0-100: Confidence that output is grounded (higher = better)
  coherence?: number;     // 0-100: Is the reasoning chain coherent?
  completeness?: number;  // 0-100: Did the agent complete the task?
}

export interface DashboardMetrics {
  totalTraces: number;
  avgLatencyMs: number;
  avgQuality: number;
  totalCost: number;
  successRate: number;
  avgStepsPerTrace: number;
  tracesByAgent: Record<string, number>;
  qualityDistribution: { bucket: string; count: number }[];
}

export interface TraceFilter {
  agentId?: string;
  runId?: string;
  minQuality?: number;
  maxLatencyMs?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ============================================
// SERVICE
// ============================================

export class ObservabilityService {
  constructor(private pool: Pool) {}

  /**
   * Start a new semantic trace for an agent run
   */
  async startTrace(agentId: string, runId: string, query: string): Promise<string> {
    const result = await this.pool.query(
      `INSERT INTO semantic_traces (agent_id, run_id, user_query, started_at, steps)
       VALUES ($1, $2, $3, NOW(), '[]'::jsonb) RETURNING id`,
      [agentId, runId, query]
    );
    return result.rows[0].id;
  }

  /**
   * Add a step to an existing trace
   */
  async addStep(traceId: string, step: Omit<TraceStep, 'timestamp'>): Promise<void> {
    const stepWithTimestamp = {
      ...step,
      timestamp: new Date().toISOString()
    };
    
    await this.pool.query(
      `UPDATE semantic_traces 
       SET steps = steps || $2::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [traceId, JSON.stringify([stepWithTimestamp])]
    );
  }

  /**
   * Add multiple steps at once (batch operation)
   */
  async addSteps(traceId: string, steps: Omit<TraceStep, 'timestamp'>[]): Promise<void> {
    const stepsWithTimestamp = steps.map(step => ({
      ...step,
      timestamp: new Date().toISOString()
    }));
    
    await this.pool.query(
      `UPDATE semantic_traces 
       SET steps = steps || $2::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [traceId, JSON.stringify(stepsWithTimestamp)]
    );
  }

  /**
   * Complete a trace with final output and metrics
   */
  async complete(traceId: string, output: string, metrics: TraceMetrics): Promise<void> {
    await this.pool.query(
      `UPDATE semantic_traces 
       SET final_output = $2, 
           metrics = $3::jsonb, 
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [traceId, output, JSON.stringify(metrics)]
    );
  }

  /**
   * Mark a trace as failed
   */
  async fail(traceId: string, error: string, metrics?: Partial<TraceMetrics>): Promise<void> {
    await this.pool.query(
      `UPDATE semantic_traces 
       SET final_output = $2,
           metrics = COALESCE(metrics, '{}'::jsonb) || $3::jsonb,
           status = 'failed',
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [traceId, `ERROR: ${error}`, JSON.stringify(metrics || {})]
    );
  }

  /**
   * Score a trace's quality (can be called post-hoc)
   */
  async scoreQuality(traceId: string, quality: Partial<QualityScores>): Promise<void> {
    await this.pool.query(
      `UPDATE semantic_traces 
       SET quality = COALESCE(quality, '{}'::jsonb) || $2::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [traceId, JSON.stringify(quality)]
    );
  }

  /**
   * Get a single trace by ID
   */
  async getTrace(traceId: string): Promise<SemanticTrace | null> {
    const result = await this.pool.query(
      `SELECT * FROM semantic_traces WHERE id = $1`,
      [traceId]
    );
    
    if (result.rows.length === 0) return null;
    
    return this.mapRowToTrace(result.rows[0]);
  }

  /**
   * Get a trace by run ID
   */
  async getTraceByRun(runId: string): Promise<SemanticTrace | null> {
    const result = await this.pool.query(
      `SELECT * FROM semantic_traces WHERE run_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [runId]
    );
    
    if (result.rows.length === 0) return null;
    
    return this.mapRowToTrace(result.rows[0]);
  }

  /**
   * List traces with filtering
   */
  async listTraces(filter: TraceFilter): Promise<{ traces: SemanticTrace[]; total: number }> {
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filter.agentId) {
      conditions.push(`agent_id = $${paramIndex++}`);
      params.push(filter.agentId);
    }

    if (filter.runId) {
      conditions.push(`run_id = $${paramIndex++}`);
      params.push(filter.runId);
    }

    if (filter.minQuality !== undefined) {
      conditions.push(`(quality->>'correctness')::int >= $${paramIndex++}`);
      params.push(filter.minQuality);
    }

    if (filter.maxLatencyMs !== undefined) {
      conditions.push(`(metrics->>'latencyMs')::int <= $${paramIndex++}`);
      params.push(filter.maxLatencyMs);
    }

    if (filter.startDate) {
      conditions.push(`started_at >= $${paramIndex++}`);
      params.push(filter.startDate);
    }

    if (filter.endDate) {
      conditions.push(`started_at <= $${paramIndex++}`);
      params.push(filter.endDate);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM semantic_traces WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const limit = filter.limit || 50;
    const offset = filter.offset || 0;
    params.push(limit, offset);

    const result = await this.pool.query(
      `SELECT * FROM semantic_traces 
       WHERE ${whereClause}
       ORDER BY started_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return {
      traces: result.rows.map(row => this.mapRowToTrace(row)),
      total
    };
  }

  /**
   * Get dashboard metrics for last N hours
   */
  async getDashboard(hours: number = 24, agentId?: string): Promise<DashboardMetrics> {
    const agentFilter = agentId ? `AND agent_id = $2` : '';
    const params: unknown[] = [hours];
    if (agentId) params.push(agentId);

    // Main aggregates
    const mainResult = await this.pool.query(`
      SELECT 
        COUNT(*)::int as total_traces,
        AVG((metrics->>'latencyMs')::numeric)::int as avg_latency,
        AVG(
          COALESCE((quality->>'correctness')::numeric, 0) +
          COALESCE((quality->>'relevance')::numeric, 0) +
          COALESCE((quality->>'coherence')::numeric, 0)
        ) / 3 as avg_quality,
        SUM((metrics->>'cost')::numeric) as total_cost,
        COUNT(*) FILTER (WHERE status != 'failed')::float / NULLIF(COUNT(*), 0) * 100 as success_rate,
        AVG(jsonb_array_length(steps))::numeric as avg_steps
      FROM semantic_traces
      WHERE started_at > NOW() - INTERVAL '1 hour' * $1
      ${agentFilter}
    `, params);

    // Traces by agent
    const agentResult = await this.pool.query(`
      SELECT agent_id, COUNT(*)::int as count
      FROM semantic_traces
      WHERE started_at > NOW() - INTERVAL '1 hour' * $1
      ${agentFilter}
      GROUP BY agent_id
    `, params);

    // Quality distribution
    const qualityResult = await this.pool.query(`
      SELECT 
        CASE 
          WHEN (quality->>'correctness')::int >= 90 THEN 'excellent'
          WHEN (quality->>'correctness')::int >= 70 THEN 'good'
          WHEN (quality->>'correctness')::int >= 50 THEN 'fair'
          ELSE 'poor'
        END as bucket,
        COUNT(*)::int as count
      FROM semantic_traces
      WHERE started_at > NOW() - INTERVAL '1 hour' * $1
        AND quality->>'correctness' IS NOT NULL
      ${agentFilter}
      GROUP BY bucket
      ORDER BY 
        CASE bucket
          WHEN 'excellent' THEN 1
          WHEN 'good' THEN 2
          WHEN 'fair' THEN 3
          ELSE 4
        END
    `, params);

    const main = mainResult.rows[0];
    const tracesByAgent: Record<string, number> = {};
    agentResult.rows.forEach(row => {
      tracesByAgent[row.agent_id] = row.count;
    });

    return {
      totalTraces: main.total_traces || 0,
      avgLatencyMs: main.avg_latency || 0,
      avgQuality: Math.round(main.avg_quality || 0),
      totalCost: parseFloat(main.total_cost) || 0,
      successRate: Math.round(main.success_rate || 0),
      avgStepsPerTrace: Math.round(main.avg_steps || 0),
      tracesByAgent,
      qualityDistribution: qualityResult.rows
    };
  }

  /**
   * Get traces with low quality scores for review
   */
  async getLowQualityTraces(threshold: number = 50, limit: number = 20): Promise<SemanticTrace[]> {
    const result = await this.pool.query(`
      SELECT * FROM semantic_traces
      WHERE (quality->>'correctness')::int < $1
         OR (quality->>'hallucination')::int < $1
      ORDER BY started_at DESC
      LIMIT $2
    `, [threshold, limit]);

    return result.rows.map(row => this.mapRowToTrace(row));
  }

  /**
   * Get recent traces for an agent
   */
  async getAgentTraces(agentId: string, limit: number = 10): Promise<SemanticTrace[]> {
    const result = await this.pool.query(`
      SELECT * FROM semantic_traces
      WHERE agent_id = $1
      ORDER BY started_at DESC
      LIMIT $2
    `, [agentId, limit]);

    return result.rows.map(row => this.mapRowToTrace(row));
  }

  /**
   * Calculate quality trends over time
   */
  async getQualityTrends(days: number = 7, agentId?: string): Promise<{
    date: string;
    avgCorrectness: number;
    avgRelevance: number;
    avgHallucination: number;
    traceCount: number;
  }[]> {
    const agentFilter = agentId ? `AND agent_id = $2` : '';
    const params: unknown[] = [days];
    if (agentId) params.push(agentId);

    const result = await this.pool.query(`
      SELECT 
        DATE(started_at) as date,
        AVG((quality->>'correctness')::numeric)::int as avg_correctness,
        AVG((quality->>'relevance')::numeric)::int as avg_relevance,
        AVG((quality->>'hallucination')::numeric)::int as avg_hallucination,
        COUNT(*)::int as trace_count
      FROM semantic_traces
      WHERE started_at > NOW() - INTERVAL '1 day' * $1
        AND quality IS NOT NULL
      ${agentFilter}
      GROUP BY DATE(started_at)
      ORDER BY date DESC
    `, params);

    return result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      avgCorrectness: row.avg_correctness || 0,
      avgRelevance: row.avg_relevance || 0,
      avgHallucination: row.avg_hallucination || 0,
      traceCount: row.trace_count
    }));
  }

  /**
   * Helper to map DB row to SemanticTrace
   */
  private mapRowToTrace(row: any): SemanticTrace {
    return {
      id: row.id,
      agentId: row.agent_id,
      runId: row.run_id,
      userQuery: row.user_query,
      steps: row.steps || [],
      finalOutput: row.final_output || '',
      metrics: row.metrics || { latencyMs: 0, tokens: 0, cost: 0 },
      quality: row.quality || {},
      startedAt: row.started_at,
      completedAt: row.completed_at
    };
  }
}
