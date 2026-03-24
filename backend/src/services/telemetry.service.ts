/**
 * REBEL AI FACTORY - TELEMETRY SERVICE
 * 
 * Comprehensive agent telemetry with self-learning capabilities
 * Based on KB concepts:
 * - Building for Trillions of Agents
 * - Agent Orchestration (Cynefin routing)
 * - Coding Agent patterns (dense feedback, clear signals)
 * - Context Engineering Failure Modes
 */

import { Pool } from 'pg';

// ============================================
// TYPES
// ============================================

export interface AgentRun {
  id: string;
  agentId: string;
  tenantId: string;
  userId: string;
  
  // Timing
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  
  // Task info
  taskType: 'sprint' | 'chat' | 'analysis' | 'research' | 'review';
  taskDescription?: string;
  cynefinDomain?: 'clear' | 'complicated' | 'complex' | 'chaotic';
  
  // Tokens
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  
  // Outcome
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  success?: boolean;
  errorType?: string;
  errorMessage?: string;
  
  // Quality signals (from KB: dense textual feedback)
  qualityScore?: number; // 0-100
  userRating?: number; // 1-5
  hadRetries?: boolean;
  retryCount?: number;
  
  // Context health (from KB: context engineering failure modes)
  contextPoisoning?: boolean;
  contextDistraction?: boolean;
  contextSizeAtStart?: number;
  contextSizeAtEnd?: number;
  
  // Output artifacts
  artifactsCreated?: number;
  filesModified?: number;
  testsRun?: number;
  testsPassed?: number;
}

export interface PromptMetrics {
  promptId: string;
  tenantId?: string;
  
  usageCount: number;
  avgQualityScore: number;
  avgUserRating: number;
  successRate: number;
  avgDurationMs: number;
  avgTokens: number;
  
  // Per-model performance
  modelPerformance: Record<string, {
    usageCount: number;
    avgQualityScore: number;
    successRate: number;
  }>;
  
  // Trend (improving or degrading)
  trend: 'improving' | 'stable' | 'degrading';
  trendDelta: number;
}

export interface LearningInsight {
  id: string;
  level: 'individual' | 'venture' | 'rebel';
  type: 'pattern' | 'antipattern' | 'optimization' | 'drift_warning';
  
  title: string;
  description: string;
  evidence: string[];
  
  // Actionable
  suggestedAction?: string;
  autoApplicable: boolean;
  
  confidence: number; // 0-1
  impactEstimate: 'low' | 'medium' | 'high';
  
  // Status
  status: 'detected' | 'reviewed' | 'applied' | 'dismissed';
  appliedAt?: Date;
  
  createdAt: Date;
}

// ============================================
// TELEMETRY SERVICE
// ============================================

export class TelemetryService {
  constructor(private pool: Pool) {}

  // ==========================================
  // RECORDING
  // ==========================================
  
  async recordRunStart(run: Partial<AgentRun>): Promise<string> {
    const result = await this.pool.query(`
      INSERT INTO agent_runs (
        agent_id, tenant_id, user_id,
        task_type, task_description, cynefin_domain,
        status, started_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'running', NOW())
      RETURNING id
    `, [
      run.agentId, run.tenantId, run.userId,
      run.taskType, run.taskDescription, run.cynefinDomain
    ]);
    
    return result.rows[0].id;
  }

  async recordRunComplete(runId: string, metrics: Partial<AgentRun>): Promise<void> {
    await this.pool.query(`
      UPDATE agent_runs SET
        completed_at = NOW(),
        duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
        input_tokens = $2,
        output_tokens = $3,
        total_tokens = $4,
        status = $5,
        success = $6,
        error_type = $7,
        error_message = $8,
        quality_score = $9,
        artifacts_created = $10,
        files_modified = $11,
        tests_run = $12,
        tests_passed = $13,
        context_size_at_end = $14,
        had_retries = $15,
        retry_count = $16
      WHERE id = $1
    `, [
      runId,
      metrics.inputTokens, metrics.outputTokens, metrics.totalTokens,
      metrics.status, metrics.success,
      metrics.errorType, metrics.errorMessage,
      metrics.qualityScore,
      metrics.artifactsCreated, metrics.filesModified,
      metrics.testsRun, metrics.testsPassed,
      metrics.contextSizeAtEnd,
      metrics.hadRetries, metrics.retryCount
    ]);
    
    // Update agent stats
    await this.updateAgentStats(metrics.agentId!);
    
    // Update monthly aggregates
    await this.updateMonthlyAggregates(metrics);
    
    // Trigger learning analysis if significant
    if (metrics.success === false || (metrics.qualityScore && metrics.qualityScore < 50)) {
      await this.triggerLearningAnalysis(runId, 'failure');
    }
  }

  async recordUserRating(runId: string, rating: number, feedback?: string): Promise<void> {
    await this.pool.query(`
      UPDATE agent_runs SET 
        user_rating = $2,
        user_feedback = $3
      WHERE id = $1
    `, [runId, rating, feedback]);
    
    // Ratings below 3 trigger learning analysis
    if (rating < 3) {
      await this.triggerLearningAnalysis(runId, 'low_rating');
    }
  }

  // ==========================================
  // AGGREGATION
  // ==========================================

  private async updateAgentStats(agentId: string): Promise<void> {
    await this.pool.query(`
      UPDATE agents SET
        total_runs = (SELECT COUNT(*) FROM agent_runs WHERE agent_id = $1),
        total_tokens_used = (SELECT COALESCE(SUM(total_tokens), 0) FROM agent_runs WHERE agent_id = $1),
        avg_run_duration_ms = (SELECT AVG(duration_ms) FROM agent_runs WHERE agent_id = $1 AND status = 'completed'),
        last_run_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `, [agentId]);
  }

  private async updateMonthlyAggregates(metrics: Partial<AgentRun>): Promise<void> {
    const yearMonth = new Date().toISOString().slice(0, 7);
    
    await this.pool.query(`
      INSERT INTO token_usage_monthly (
        tenant_id, agent_id, user_id, year_month,
        total_input_tokens, total_output_tokens, total_tokens,
        run_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
      ON CONFLICT (tenant_id, agent_id, user_id, year_month)
      DO UPDATE SET
        total_input_tokens = token_usage_monthly.total_input_tokens + $5,
        total_output_tokens = token_usage_monthly.total_output_tokens + $6,
        total_tokens = token_usage_monthly.total_tokens + $7,
        run_count = token_usage_monthly.run_count + 1,
        updated_at = NOW()
    `, [
      metrics.tenantId, metrics.agentId, metrics.userId, yearMonth,
      metrics.inputTokens, metrics.outputTokens, metrics.totalTokens
    ]);
  }

  // ==========================================
  // QUERYING
  // ==========================================

  async getAgentMetrics(agentId: string, days: number = 30): Promise<any> {
    const result = await this.pool.query(`
      SELECT
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE success = true) as successful_runs,
        COUNT(*) FILTER (WHERE success = false) as failed_runs,
        AVG(duration_ms) as avg_duration_ms,
        SUM(total_tokens) as total_tokens,
        AVG(quality_score) as avg_quality_score,
        AVG(user_rating) as avg_user_rating,
        COUNT(*) FILTER (WHERE had_retries = true) as runs_with_retries
      FROM agent_runs
      WHERE agent_id = $1 AND started_at > NOW() - INTERVAL '1 day' * $2
    `, [agentId, days]);
    
    return result.rows[0];
  }

  async getPromptMetrics(promptId: string): Promise<PromptMetrics | null> {
    const result = await this.pool.query(`
      SELECT
        p.id as prompt_id,
        p.tenant_id,
        COUNT(r.id) as usage_count,
        AVG(r.quality_score) as avg_quality_score,
        AVG(r.user_rating) as avg_user_rating,
        AVG(CASE WHEN r.success THEN 1.0 ELSE 0.0 END) as success_rate,
        AVG(r.duration_ms) as avg_duration_ms,
        AVG(r.total_tokens) as avg_tokens
      FROM prompts p
      LEFT JOIN agent_runs r ON r.prompt_id = p.id
      WHERE p.id = $1
      GROUP BY p.id
    `, [promptId]);
    
    if (result.rows.length === 0) return null;
    
    return result.rows[0] as PromptMetrics;
  }

  async getTenantMetrics(tenantId: string, yearMonth?: string): Promise<any> {
    const month = yearMonth || new Date().toISOString().slice(0, 7);
    
    const result = await this.pool.query(`
      SELECT
        SUM(total_tokens) as total_tokens,
        SUM(total_input_tokens) as total_input_tokens,
        SUM(total_output_tokens) as total_output_tokens,
        SUM(run_count) as total_runs,
        COUNT(DISTINCT agent_id) as active_agents,
        COUNT(DISTINCT user_id) as active_users
      FROM token_usage_monthly
      WHERE tenant_id = $1 AND year_month = $2
    `, [tenantId, month]);
    
    // Get cost
    const costResult = await this.pool.query(`
      SELECT
        SUM(
          (total_input_tokens / 1000000.0 * mp.input_price_per_1m) +
          (total_output_tokens / 1000000.0 * mp.output_price_per_1m)
        ) as total_cost_usd
      FROM token_usage_monthly tum
      JOIN agents a ON a.id = tum.agent_id
      JOIN model_pricing mp ON mp.model = COALESCE(a.model, 'claude-sonnet-4-20250514')
      WHERE tum.tenant_id = $1 AND tum.year_month = $2
    `, [tenantId, month]);
    
    return {
      ...result.rows[0],
      totalCostUsd: costResult.rows[0]?.total_cost_usd || 0
    };
  }

  // ==========================================
  // SELF-LEARNING SYSTEM
  // ==========================================

  /**
   * Trigger learning analysis for a run
   * Based on KB: dense textual feedback, clear success/failure signals
   */
  async triggerLearningAnalysis(runId: string, trigger: string): Promise<void> {
    // Queue for async processing
    await this.pool.query(`
      INSERT INTO learning_queue (run_id, trigger, status, created_at)
      VALUES ($1, $2, 'pending', NOW())
    `, [runId, trigger]);
  }

  /**
   * Analyze patterns across runs to generate insights
   * Operates at three levels: individual, venture, rebel-wide
   */
  async generateLearningInsights(level: 'individual' | 'venture' | 'rebel', scopeId?: string): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    
    // 1. Detect failure patterns
    const failurePatterns = await this.detectFailurePatterns(level, scopeId);
    insights.push(...failurePatterns);
    
    // 2. Detect drift (agents deviating from expected behavior)
    const driftWarnings = await this.detectAgentDrift(level, scopeId);
    insights.push(...driftWarnings);
    
    // 3. Identify optimization opportunities
    const optimizations = await this.identifyOptimizations(level, scopeId);
    insights.push(...optimizations);
    
    // 4. Find successful patterns to promote
    const patterns = await this.findSuccessPatterns(level, scopeId);
    insights.push(...patterns);
    
    // Store insights
    for (const insight of insights) {
      await this.storeInsight(insight);
    }
    
    return insights;
  }

  private async detectFailurePatterns(level: string, scopeId?: string): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    
    // Query for repeated failures
    const whereClause = level === 'individual' ? 'agent_id = $1' :
                        level === 'venture' ? 'tenant_id = $1' : '1=1';
    const params = scopeId ? [scopeId] : [];
    
    const result = await this.pool.query(`
      SELECT 
        error_type,
        COUNT(*) as count,
        array_agg(DISTINCT agent_id) as affected_agents,
        array_agg(id ORDER BY started_at DESC LIMIT 5) as recent_runs
      FROM agent_runs
      WHERE success = false 
        AND started_at > NOW() - INTERVAL '7 days'
        ${scopeId ? `AND ${whereClause}` : ''}
      GROUP BY error_type
      HAVING COUNT(*) >= 3
      ORDER BY count DESC
    `, params);
    
    for (const row of result.rows) {
      insights.push({
        id: `fp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        level: level as any,
        type: 'antipattern',
        title: `Recurring failure: ${row.error_type}`,
        description: `${row.count} failures of type "${row.error_type}" in last 7 days across ${row.affected_agents.length} agent(s)`,
        evidence: row.recent_runs,
        suggestedAction: `Review error handling for ${row.error_type}. Consider adding specific handling or guard rails.`,
        autoApplicable: false,
        confidence: Math.min(0.9, 0.5 + (row.count / 20)),
        impactEstimate: row.count > 10 ? 'high' : row.count > 5 ? 'medium' : 'low',
        status: 'detected',
        createdAt: new Date()
      });
    }
    
    return insights;
  }

  private async detectAgentDrift(level: string, scopeId?: string): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    
    // Compare recent performance to historical baseline
    const result = await this.pool.query(`
      WITH recent AS (
        SELECT agent_id,
          AVG(quality_score) as recent_quality,
          AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) as recent_success_rate,
          COUNT(*) as recent_runs
        FROM agent_runs
        WHERE started_at > NOW() - INTERVAL '3 days'
        GROUP BY agent_id
        HAVING COUNT(*) >= 5
      ),
      baseline AS (
        SELECT agent_id,
          AVG(quality_score) as baseline_quality,
          AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) as baseline_success_rate
        FROM agent_runs
        WHERE started_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '3 days'
        GROUP BY agent_id
        HAVING COUNT(*) >= 10
      )
      SELECT 
        r.agent_id,
        a.name as agent_name,
        r.recent_quality,
        b.baseline_quality,
        r.recent_success_rate,
        b.baseline_success_rate,
        r.recent_runs
      FROM recent r
      JOIN baseline b ON r.agent_id = b.agent_id
      JOIN agents a ON a.id = r.agent_id
      WHERE (b.baseline_quality - r.recent_quality) > 15
         OR (b.baseline_success_rate - r.recent_success_rate) > 0.2
    `);
    
    for (const row of result.rows) {
      const qualityDrop = row.baseline_quality - row.recent_quality;
      const successDrop = row.baseline_success_rate - row.recent_success_rate;
      
      insights.push({
        id: `drift-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        level: level as any,
        type: 'drift_warning',
        title: `Performance drift: ${row.agent_name}`,
        description: `Agent showing ${qualityDrop > 15 ? 'quality' : 'success rate'} degradation. ` +
                    `Quality: ${row.baseline_quality?.toFixed(1)} → ${row.recent_quality?.toFixed(1)}. ` +
                    `Success: ${(row.baseline_success_rate * 100).toFixed(0)}% → ${(row.recent_success_rate * 100).toFixed(0)}%`,
        evidence: [`Based on ${row.recent_runs} recent runs vs 30-day baseline`],
        suggestedAction: 'Review recent prompt changes, check for context poisoning, consider prompt refresh',
        autoApplicable: false,
        confidence: 0.8,
        impactEstimate: qualityDrop > 25 || successDrop > 0.3 ? 'high' : 'medium',
        status: 'detected',
        createdAt: new Date()
      });
    }
    
    return insights;
  }

  private async identifyOptimizations(level: string, scopeId?: string): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    
    // Find agents/prompts with high token usage but low quality
    const result = await this.pool.query(`
      SELECT 
        a.id as agent_id,
        a.name as agent_name,
        AVG(r.total_tokens) as avg_tokens,
        AVG(r.quality_score) as avg_quality,
        COUNT(*) as run_count
      FROM agents a
      JOIN agent_runs r ON r.agent_id = a.id
      WHERE r.started_at > NOW() - INTERVAL '7 days'
      GROUP BY a.id, a.name
      HAVING AVG(r.total_tokens) > 50000 AND AVG(r.quality_score) < 70
    `);
    
    for (const row of result.rows) {
      insights.push({
        id: `opt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        level: level as any,
        type: 'optimization',
        title: `Inefficient agent: ${row.agent_name}`,
        description: `High token usage (avg ${Math.round(row.avg_tokens / 1000)}k) with below-average quality (${row.avg_quality?.toFixed(0)}). ` +
                    `Potential for prompt optimization or model downgrade.`,
        evidence: [`Based on ${row.run_count} runs in last 7 days`],
        suggestedAction: 'Review system prompt for verbosity, consider using claude-3-5-haiku for simpler tasks',
        autoApplicable: false,
        confidence: 0.7,
        impactEstimate: 'medium',
        status: 'detected',
        createdAt: new Date()
      });
    }
    
    return insights;
  }

  private async findSuccessPatterns(level: string, scopeId?: string): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    
    // Find consistently high-performing agents/prompts
    const result = await this.pool.query(`
      SELECT 
        a.id as agent_id,
        a.name as agent_name,
        a.tier,
        AVG(r.quality_score) as avg_quality,
        AVG(r.user_rating) as avg_rating,
        AVG(CASE WHEN r.success THEN 1.0 ELSE 0.0 END) as success_rate,
        COUNT(*) as run_count
      FROM agents a
      JOIN agent_runs r ON r.agent_id = a.id
      WHERE r.started_at > NOW() - INTERVAL '14 days'
        AND a.tier = 'personal'
      GROUP BY a.id, a.name, a.tier
      HAVING COUNT(*) >= 10 
        AND AVG(r.quality_score) > 85
        AND AVG(CASE WHEN r.success THEN 1.0 ELSE 0.0 END) > 0.95
    `);
    
    for (const row of result.rows) {
      insights.push({
        id: `pat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        level: level as any,
        type: 'pattern',
        title: `High performer: ${row.agent_name}`,
        description: `Personal agent with exceptional metrics (quality: ${row.avg_quality?.toFixed(0)}, ` +
                    `success: ${(row.success_rate * 100).toFixed(0)}%). Consider promotion to venture tier.`,
        evidence: [`Based on ${row.run_count} runs with consistent high performance`],
        suggestedAction: 'Initiate promotion review. Extract reusable patterns for other agents.',
        autoApplicable: true, // Could auto-create promotion request
        confidence: 0.9,
        impactEstimate: 'high',
        status: 'detected',
        createdAt: new Date()
      });
    }
    
    return insights;
  }

  private async storeInsight(insight: LearningInsight): Promise<void> {
    await this.pool.query(`
      INSERT INTO learning_insights (
        id, level, type, title, description, evidence,
        suggested_action, auto_applicable, confidence,
        impact_estimate, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      insight.id, insight.level, insight.type, insight.title,
      insight.description, JSON.stringify(insight.evidence),
      insight.suggestedAction, insight.autoApplicable, insight.confidence,
      insight.impactEstimate, insight.status, insight.createdAt
    ]);
  }

  // ==========================================
  // SCOUT TELEMETRY
  // ==========================================

  /**
   * Record scout run metrics for telemetry
   */
  async recordScoutRun(agentId: string, results: any[], durationMs: number): Promise<void> {
    const successCount = results.filter((r: any) => !r.error).length;
    const totalFindings = results.reduce((sum: number, r: any) => sum + (r.findings?.length || 0), 0);
    const criticalFindings = results.reduce((sum: number, r: any) => 
      sum + (r.findings?.filter((f: any) => f.severity === 'critical')?.length || 0), 0);
    
    await this.pool.query(`
      INSERT INTO token_usage (
        agent_id,
        model,
        input_tokens,
        output_tokens,
        task_type,
        created_at
      ) VALUES ($1, 'scout-system', 0, 0, 'scout', NOW())
    `, [agentId]);
    
    // Update agent stats with scout info
    await this.pool.query(`
      UPDATE agents SET
        last_run_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `, [agentId]);
    
    // Log if critical findings were found
    if (criticalFindings > 0) {
      console.warn(`[Scout] Agent ${agentId}: ${criticalFindings} critical findings detected`);
    }
  }

  // ==========================================
  // DASHBOARDS
  // ==========================================

  async getRebelWideDashboard(): Promise<any> {
    const [overview, topAgents, trends, insights] = await Promise.all([
      this.pool.query(`
        SELECT
          COUNT(DISTINCT tenant_id) as total_tenants,
          COUNT(DISTINCT agent_id) as total_agents,
          SUM(total_tokens) as total_tokens_all_time,
          SUM(run_count) as total_runs_all_time
        FROM token_usage_monthly
      `),
      this.pool.query(`
        SELECT 
          a.name, a.icon, a.tenant_id, t.name as tenant_name,
          SUM(r.total_tokens) as total_tokens,
          COUNT(r.id) as run_count,
          AVG(r.quality_score) as avg_quality
        FROM agents a
        JOIN agent_runs r ON r.agent_id = a.id
        JOIN tenants t ON t.id = a.tenant_id
        WHERE r.started_at > NOW() - INTERVAL '30 days'
        GROUP BY a.id, a.name, a.icon, a.tenant_id, t.name
        ORDER BY run_count DESC
        LIMIT 10
      `),
      this.pool.query(`
        SELECT
          DATE(started_at) as date,
          COUNT(*) as runs,
          SUM(total_tokens) as tokens,
          AVG(quality_score) as avg_quality
        FROM agent_runs
        WHERE started_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(started_at)
        ORDER BY date
      `),
      this.pool.query(`
        SELECT * FROM learning_insights
        WHERE status = 'detected'
          AND level = 'rebel'
        ORDER BY created_at DESC
        LIMIT 10
      `)
    ]);
    
    return {
      overview: overview.rows[0],
      topAgents: topAgents.rows,
      trends: trends.rows,
      insights: insights.rows
    };
  }
}
