/**
 * REBEL AI FACTORY - INSTITUTIONAL INTELLIGENCE SERVICE
 * 
 * 7 Pillars Framework for Enterprise AI Deployment:
 * 1. Coordination - Are agents synchronized and aligned?
 * 2. Signal - Can we distinguish good from bad output?
 * 3. Bias - Are AI decisions free from systematic errors?
 * 4. Memory - Is institutional knowledge being captured?
 * 5. Culture - Does AI align with organizational values?
 * 6. Workflow - Are human-AI handoffs smooth?
 * 7. Governance - Is AI use compliant and auditable?
 * 
 * Based on KB: Institutional Intelligence
 */

import { Pool } from 'pg';

// ============================================
// TYPES
// ============================================

export interface InstitutionalHealthReport {
  tenantId: string;
  timestamp: Date;
  overallScore: number; // 0-100
  pillars: {
    coordination: PillarScore;
    signal: PillarScore;
    bias: PillarScore;
    memory: PillarScore;
    culture: PillarScore;
    workflow: PillarScore;
    governance: PillarScore;
  };
  recommendations: Recommendation[];
  maturityLevel: MaturityLevel;
  trend: 'improving' | 'stable' | 'declining';
  metadata: {
    assessmentDuration: number;
    dataPointsAnalyzed: number;
    analysisWindow: string;
    lastAssessment?: Date;
  };
}

export interface PillarScore {
  name: string;
  description: string;
  score: number; // 0-100
  status: 'healthy' | 'warning' | 'critical';
  findings: Finding[];
  actions: Action[];
  metrics: PillarMetrics;
  subPillars?: SubPillar[];
}

export interface Finding {
  id: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  message: string;
  evidence: string[];
  detectedAt: Date;
}

export interface Action {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  effort: 'quick-win' | 'moderate' | 'major-initiative';
  impact: 'low' | 'medium' | 'high';
}

export interface SubPillar {
  name: string;
  score: number;
  status: 'healthy' | 'warning' | 'critical';
}

export interface PillarMetrics {
  [key: string]: number | string | boolean;
}

export interface Recommendation {
  pillar: string;
  priority: number; // 1-10, higher = more urgent
  title: string;
  description: string;
  expectedImpact: string;
  resources: string[];
}

export type MaturityLevel = 'emerging' | 'developing' | 'established' | 'optimized';

export interface AssessmentConfig {
  analysisWindowDays: number;
  includeHistoricalTrend: boolean;
  deepDive?: boolean;
}

// ============================================
// SERVICE
// ============================================

export class InstitutionalIntelligenceService {
  private readonly DEFAULT_WINDOW_DAYS = 7;

  constructor(private pool: Pool) {}

  // ============================================
  // MAIN ASSESSMENT
  // ============================================

  /**
   * Comprehensive institutional intelligence assessment
   */
  async assess(
    tenantId: string,
    config: Partial<AssessmentConfig> = {}
  ): Promise<InstitutionalHealthReport> {
    const startTime = Date.now();
    const windowDays = config.analysisWindowDays || this.DEFAULT_WINDOW_DAYS;

    // Assess all 7 pillars in parallel
    const [
      coordination,
      signal,
      bias,
      memory,
      culture,
      workflow,
      governance,
    ] = await Promise.all([
      this.assessCoordination(tenantId, windowDays),
      this.assessSignal(tenantId, windowDays),
      this.assessBias(tenantId, windowDays),
      this.assessMemory(tenantId, windowDays),
      this.assessCulture(tenantId, windowDays),
      this.assessWorkflow(tenantId, windowDays),
      this.assessGovernance(tenantId, windowDays),
    ]);

    const pillars = { coordination, signal, bias, memory, culture, workflow, governance };
    
    // Calculate overall score (weighted average)
    const weights = {
      coordination: 1.2,  // Critical for multi-agent
      signal: 1.5,        // Most important - quality visibility
      bias: 1.3,          // Risk mitigation
      memory: 1.0,        // Long-term value
      culture: 0.8,       // Soft factor
      workflow: 1.1,      // Operational efficiency
      governance: 1.4,    // Compliance critical
    };

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    const weightedScore = Object.entries(pillars).reduce((sum, [key, pillar]) => {
      return sum + (pillar.score * weights[key as keyof typeof weights]);
    }, 0);
    const overallScore = Math.round(weightedScore / totalWeight);

    // Get trend
    const trend = await this.calculateTrend(tenantId);

    // Generate recommendations
    const recommendations = this.generateRecommendations(pillars);

    // Get data points count
    const dataPointsResult = await this.pool.query(`
      SELECT COUNT(*) as count FROM agent_runs 
      WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${windowDays} days'
    `, [tenantId]);

    // Store assessment
    await this.storeAssessment(tenantId, overallScore, pillars);

    return {
      tenantId,
      timestamp: new Date(),
      overallScore,
      pillars,
      recommendations,
      maturityLevel: this.calculateMaturity(overallScore),
      trend,
      metadata: {
        assessmentDuration: Date.now() - startTime,
        dataPointsAnalyzed: parseInt(dataPointsResult.rows[0]?.count || '0'),
        analysisWindow: `${windowDays} days`,
        lastAssessment: await this.getLastAssessment(tenantId),
      },
    };
  }

  // ============================================
  // PILLAR 1: COORDINATION
  // ============================================

  /**
   * Are agents synchronized and aligned?
   * Checks for: conflicting outputs, race conditions, task overlap, handoff failures
   */
  private async assessCoordination(tenantId: string, windowDays: number): Promise<PillarScore> {
    const findings: Finding[] = [];
    const actions: Action[] = [];

    // 1.1 Check conflicting agent outputs on same task
    const conflictsResult = await this.pool.query(`
      SELECT 
        a1.task_id,
        COUNT(DISTINCT a1.agent_id) as agent_count,
        COUNT(*) FILTER (WHERE a1.output_hash != a2.output_hash) as conflict_count
      FROM agent_runs a1
      LEFT JOIN agent_runs a2 ON a1.task_id = a2.task_id AND a1.id != a2.id
      WHERE a1.tenant_id = $1
      AND a1.created_at > NOW() - INTERVAL '${windowDays} days'
      AND a1.task_id IS NOT NULL
      GROUP BY a1.task_id
      HAVING COUNT(DISTINCT a1.agent_id) > 1
    `, [tenantId]);

    const conflicts = conflictsResult.rows.filter(r => parseInt(r.conflict_count) > 0);
    const conflictCount = conflicts.length;

    if (conflictCount > 0) {
      findings.push({
        id: 'coord-001',
        severity: conflictCount > 5 ? 'high' : 'medium',
        message: `${conflictCount} tasks had conflicting agent outputs`,
        evidence: conflicts.slice(0, 3).map(c => `Task ${c.task_id}: ${c.conflict_count} conflicts`),
        detectedAt: new Date(),
      });
      actions.push({
        id: 'act-coord-001',
        priority: 'high',
        title: 'Implement Agent Coordination Layer',
        description: 'Add orchestration to prevent multiple agents from producing conflicting results on the same task',
        effort: 'moderate',
        impact: 'high',
      });
    }

    // 1.2 Check for race conditions (parallel runs completing out of order)
    const raceResult = await this.pool.query(`
      SELECT COUNT(*) as race_count
      FROM agent_runs a1
      JOIN agent_runs a2 ON a1.task_id = a2.task_id 
        AND a1.agent_id = a2.agent_id
        AND a1.id != a2.id
      WHERE a1.tenant_id = $1
      AND a1.created_at > NOW() - INTERVAL '${windowDays} days'
      AND a1.started_at > a2.started_at
      AND a1.completed_at < a2.completed_at
    `, [tenantId]);

    const raceCount = parseInt(raceResult.rows[0]?.race_count || '0');
    if (raceCount > 0) {
      findings.push({
        id: 'coord-002',
        severity: 'medium',
        message: `${raceCount} potential race conditions detected`,
        evidence: ['Later-started runs completed before earlier ones'],
        detectedAt: new Date(),
      });
    }

    // 1.3 Check handoff success rate
    const handoffResult = await this.pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE next_run_status = 'completed') as successful_handoffs,
        COUNT(*) as total_handoffs
      FROM (
        SELECT 
          a1.id,
          LEAD(a1.status) OVER (PARTITION BY a1.task_id ORDER BY a1.created_at) as next_run_status
        FROM agent_runs a1
        WHERE a1.tenant_id = $1
        AND a1.created_at > NOW() - INTERVAL '${windowDays} days'
        AND a1.status = 'completed'
      ) handoffs
      WHERE next_run_status IS NOT NULL
    `, [tenantId]);

    const { successful_handoffs, total_handoffs } = handoffResult.rows[0] || {};
    const handoffSuccessRate = total_handoffs > 0 
      ? (parseInt(successful_handoffs) / parseInt(total_handoffs)) * 100 
      : 100;

    if (handoffSuccessRate < 90) {
      findings.push({
        id: 'coord-003',
        severity: handoffSuccessRate < 70 ? 'high' : 'medium',
        message: `Agent handoff success rate: ${handoffSuccessRate.toFixed(1)}%`,
        evidence: [`${total_handoffs - successful_handoffs} failed handoffs out of ${total_handoffs}`],
        detectedAt: new Date(),
      });
      actions.push({
        id: 'act-coord-002',
        priority: 'medium',
        title: 'Improve Handoff Protocol',
        description: 'Add validation checks between agent transitions to ensure context is properly passed',
        effort: 'moderate',
        impact: 'medium',
      });
    }

    // Calculate coordination score
    const conflictPenalty = Math.min(30, conflictCount * 6);
    const racePenalty = Math.min(20, raceCount * 4);
    const handoffBonus = handoffSuccessRate * 0.5;
    const coordinationScore = Math.max(0, Math.min(100, 50 + handoffBonus - conflictPenalty - racePenalty));

    return {
      name: 'Coordination',
      description: 'Agent synchronization and alignment across tasks',
      score: Math.round(coordinationScore),
      status: coordinationScore >= 70 ? 'healthy' : coordinationScore >= 40 ? 'warning' : 'critical',
      findings,
      actions,
      metrics: {
        conflictCount,
        raceConditions: raceCount,
        handoffSuccessRate: handoffSuccessRate.toFixed(1) + '%',
        multiAgentTasks: conflictsResult.rows.length,
      },
      subPillars: [
        { name: 'Conflict Resolution', score: Math.max(0, 100 - conflictCount * 10), status: conflictCount > 5 ? 'critical' : conflictCount > 2 ? 'warning' : 'healthy' },
        { name: 'Race Prevention', score: Math.max(0, 100 - raceCount * 5), status: raceCount > 10 ? 'critical' : raceCount > 3 ? 'warning' : 'healthy' },
        { name: 'Handoff Quality', score: Math.round(handoffSuccessRate), status: handoffSuccessRate >= 90 ? 'healthy' : handoffSuccessRate >= 70 ? 'warning' : 'critical' },
      ],
    };
  }

  // ============================================
  // PILLAR 2: SIGNAL
  // ============================================

  /**
   * Can we distinguish good from bad output?
   * Checks for: quality review coverage, feedback loops, metric tracking
   */
  private async assessSignal(tenantId: string, windowDays: number): Promise<PillarScore> {
    const findings: Finding[] = [];
    const actions: Action[] = [];

    // 2.1 Quality review coverage
    const reviewResult = await this.pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE quality_score IS NOT NULL) as reviewed,
        COUNT(*) FILTER (WHERE quality_score IS NOT NULL AND quality_score >= 80) as high_quality,
        COUNT(*) FILTER (WHERE quality_score IS NOT NULL AND quality_score < 50) as low_quality,
        COUNT(*) as total
      FROM agent_runs
      WHERE tenant_id = $1 
      AND created_at > NOW() - INTERVAL '${windowDays} days'
      AND status = 'completed'
    `, [tenantId]);

    const { reviewed, high_quality, low_quality, total } = reviewResult.rows[0] || { reviewed: 0, total: 0, high_quality: 0, low_quality: 0 };
    const reviewCoverage = total > 0 ? (parseInt(reviewed) / parseInt(total)) * 100 : 0;

    if (reviewCoverage < 80) {
      findings.push({
        id: 'signal-001',
        severity: reviewCoverage < 50 ? 'high' : 'medium',
        message: `Only ${reviewCoverage.toFixed(0)}% of agent outputs are quality reviewed`,
        evidence: [`${total - reviewed} outputs have no quality score`],
        detectedAt: new Date(),
      });
      actions.push({
        id: 'act-signal-001',
        priority: 'high',
        title: 'Increase Quality Review Coverage',
        description: 'Implement automated quality scoring or expand human review capacity',
        effort: 'moderate',
        impact: 'high',
      });
    }

    // 2.2 Feedback loop existence
    const feedbackResult = await this.pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE feedback IS NOT NULL OR user_rating IS NOT NULL) as with_feedback,
        COUNT(*) as total
      FROM agent_runs
      WHERE tenant_id = $1 
      AND created_at > NOW() - INTERVAL '${windowDays} days'
      AND status = 'completed'
    `, [tenantId]);

    const { with_feedback, total: feedbackTotal } = feedbackResult.rows[0] || {};
    const feedbackRate = feedbackTotal > 0 ? (parseInt(with_feedback) / parseInt(feedbackTotal)) * 100 : 0;

    if (feedbackRate < 30) {
      findings.push({
        id: 'signal-002',
        severity: 'medium',
        message: `Low feedback collection: ${feedbackRate.toFixed(0)}% of outputs have user feedback`,
        evidence: ['Limited learning signal from end users'],
        detectedAt: new Date(),
      });
      actions.push({
        id: 'act-signal-002',
        priority: 'medium',
        title: 'Implement Feedback Collection',
        description: 'Add lightweight feedback mechanisms (thumbs up/down, quick ratings)',
        effort: 'quick-win',
        impact: 'high',
      });
    }

    // 2.3 Metric tracking completeness
    const metricsResult = await this.pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE latency_ms IS NOT NULL) as has_latency,
        COUNT(*) FILTER (WHERE token_count IS NOT NULL) as has_tokens,
        COUNT(*) FILTER (WHERE cost IS NOT NULL) as has_cost,
        COUNT(*) as total
      FROM agent_runs
      WHERE tenant_id = $1 
      AND created_at > NOW() - INTERVAL '${windowDays} days'
    `, [tenantId]);

    const metrics = metricsResult.rows[0] || {};
    const metricsTotal = parseInt(metrics.total) || 1;
    const metricCoverage = (
      (parseInt(metrics.has_latency) / metricsTotal) +
      (parseInt(metrics.has_tokens) / metricsTotal) +
      (parseInt(metrics.has_cost) / metricsTotal)
    ) / 3 * 100;

    // Calculate signal score
    const signalScore = (reviewCoverage * 0.4) + (feedbackRate * 0.3) + (metricCoverage * 0.3);

    return {
      name: 'Signal',
      description: 'Ability to measure and distinguish output quality',
      score: Math.round(signalScore),
      status: signalScore >= 70 ? 'healthy' : signalScore >= 40 ? 'warning' : 'critical',
      findings,
      actions,
      metrics: {
        reviewCoverage: reviewCoverage.toFixed(1) + '%',
        feedbackRate: feedbackRate.toFixed(1) + '%',
        highQualityRate: total > 0 ? ((parseInt(high_quality) / parseInt(total)) * 100).toFixed(1) + '%' : 'N/A',
        lowQualityRate: total > 0 ? ((parseInt(low_quality) / parseInt(total)) * 100).toFixed(1) + '%' : 'N/A',
        metricCoverage: metricCoverage.toFixed(1) + '%',
      },
      subPillars: [
        { name: 'Quality Reviews', score: Math.round(reviewCoverage), status: reviewCoverage >= 80 ? 'healthy' : reviewCoverage >= 50 ? 'warning' : 'critical' },
        { name: 'Feedback Loops', score: Math.round(feedbackRate), status: feedbackRate >= 30 ? 'healthy' : feedbackRate >= 10 ? 'warning' : 'critical' },
        { name: 'Metric Tracking', score: Math.round(metricCoverage), status: metricCoverage >= 80 ? 'healthy' : metricCoverage >= 50 ? 'warning' : 'critical' },
      ],
    };
  }

  // ============================================
  // PILLAR 3: BIAS
  // ============================================

  /**
   * Are AI decisions free from systematic errors?
   * Checks for: output distribution, group fairness, decision consistency
   */
  private async assessBias(tenantId: string, windowDays: number): Promise<PillarScore> {
    const findings: Finding[] = [];
    const actions: Action[] = [];

    // 3.1 Output distribution analysis (look for skewed decisions)
    const distributionResult = await this.pool.query(`
      SELECT 
        agent_id,
        decision_type,
        COUNT(*) as count,
        AVG(quality_score) as avg_quality
      FROM agent_runs
      WHERE tenant_id = $1 
      AND created_at > NOW() - INTERVAL '${windowDays} days'
      AND decision_type IS NOT NULL
      GROUP BY agent_id, decision_type
      ORDER BY agent_id, count DESC
    `, [tenantId]);

    // Check for extreme decision skew (>90% one direction)
    const agentDecisions = new Map<string, { total: number; decisions: Map<string, number> }>();
    for (const row of distributionResult.rows) {
      if (!agentDecisions.has(row.agent_id)) {
        agentDecisions.set(row.agent_id, { total: 0, decisions: new Map() });
      }
      const agent = agentDecisions.get(row.agent_id)!;
      agent.total += parseInt(row.count);
      agent.decisions.set(row.decision_type, parseInt(row.count));
    }

    let skewedAgents = 0;
    for (const [agentId, data] of agentDecisions) {
      for (const [decision, count] of data.decisions) {
        const percentage = (count / data.total) * 100;
        if (percentage > 90 && data.total > 10) {
          skewedAgents++;
          findings.push({
            id: `bias-skew-${agentId}`,
            severity: 'medium',
            message: `Agent ${agentId} shows decision skew: ${percentage.toFixed(0)}% "${decision}"`,
            evidence: [`${count} of ${data.total} decisions are "${decision}"`],
            detectedAt: new Date(),
          });
        }
      }
    }

    // 3.2 Check for consistency (same input → same output)
    const consistencyResult = await this.pool.query(`
      SELECT 
        input_hash,
        COUNT(DISTINCT output_hash) as output_variations,
        COUNT(*) as occurrences
      FROM agent_runs
      WHERE tenant_id = $1 
      AND created_at > NOW() - INTERVAL '${windowDays} days'
      AND input_hash IS NOT NULL
      GROUP BY input_hash
      HAVING COUNT(*) > 1
    `, [tenantId]);

    const inconsistentInputs = consistencyResult.rows.filter(r => parseInt(r.output_variations) > 1);
    const consistencyRate = consistencyResult.rows.length > 0
      ? ((consistencyResult.rows.length - inconsistentInputs.length) / consistencyResult.rows.length) * 100
      : 100;

    if (inconsistentInputs.length > 0) {
      findings.push({
        id: 'bias-002',
        severity: inconsistentInputs.length > 10 ? 'high' : 'medium',
        message: `${inconsistentInputs.length} inputs produced inconsistent outputs`,
        evidence: ['Same inputs yielding different outputs indicates potential bias drift'],
        detectedAt: new Date(),
      });
    }

    // 3.3 Check for approval rate disparities across categories
    const approvalResult = await this.pool.query(`
      SELECT 
        category,
        COUNT(*) FILTER (WHERE approval_status = 'approved') as approved,
        COUNT(*) FILTER (WHERE approval_status = 'rejected') as rejected,
        COUNT(*) as total
      FROM agent_runs
      WHERE tenant_id = $1 
      AND created_at > NOW() - INTERVAL '${windowDays} days'
      AND category IS NOT NULL
      AND approval_status IS NOT NULL
      GROUP BY category
      HAVING COUNT(*) >= 5
    `, [tenantId]);

    const approvalRates = approvalResult.rows.map(r => ({
      category: r.category,
      rate: parseInt(r.approved) / parseInt(r.total) * 100,
    }));

    if (approvalRates.length >= 2) {
      const maxRate = Math.max(...approvalRates.map(r => r.rate));
      const minRate = Math.min(...approvalRates.map(r => r.rate));
      const disparity = maxRate - minRate;

      if (disparity > 30) {
        findings.push({
          id: 'bias-003',
          severity: disparity > 50 ? 'high' : 'medium',
          message: `${disparity.toFixed(0)}% approval rate disparity across categories`,
          evidence: approvalRates.map(r => `${r.category}: ${r.rate.toFixed(0)}%`),
          detectedAt: new Date(),
        });
        actions.push({
          id: 'act-bias-001',
          priority: 'high',
          title: 'Investigate Category Bias',
          description: 'Review prompts and training data for category-specific bias patterns',
          effort: 'moderate',
          impact: 'high',
        });
      }
    }

    // Calculate bias score
    const skewPenalty = Math.min(30, skewedAgents * 10);
    const consistencyBonus = consistencyRate * 0.4;
    const disparityPenalty = approvalRates.length >= 2 
      ? Math.min(30, (Math.max(...approvalRates.map(r => r.rate)) - Math.min(...approvalRates.map(r => r.rate))) * 0.5)
      : 0;
    
    const biasScore = Math.max(0, Math.min(100, 60 + consistencyBonus - skewPenalty - disparityPenalty));

    return {
      name: 'Bias',
      description: 'Systematic error detection and fairness monitoring',
      score: Math.round(biasScore),
      status: biasScore >= 70 ? 'healthy' : biasScore >= 40 ? 'warning' : 'critical',
      findings,
      actions,
      metrics: {
        consistencyRate: consistencyRate.toFixed(1) + '%',
        skewedAgents,
        categoryDisparity: approvalRates.length >= 2 
          ? (Math.max(...approvalRates.map(r => r.rate)) - Math.min(...approvalRates.map(r => r.rate))).toFixed(1) + '%'
          : 'N/A',
        inconsistentInputs: inconsistentInputs.length,
      },
      subPillars: [
        { name: 'Decision Distribution', score: Math.max(0, 100 - skewedAgents * 15), status: skewedAgents > 3 ? 'critical' : skewedAgents > 1 ? 'warning' : 'healthy' },
        { name: 'Output Consistency', score: Math.round(consistencyRate), status: consistencyRate >= 90 ? 'healthy' : consistencyRate >= 70 ? 'warning' : 'critical' },
        { name: 'Category Fairness', score: Math.round(100 - disparityPenalty), status: disparityPenalty > 20 ? 'critical' : disparityPenalty > 10 ? 'warning' : 'healthy' },
      ],
    };
  }

  // ============================================
  // PILLAR 4: MEMORY
  // ============================================

  /**
   * Is institutional knowledge being captured?
   * Checks for: knowledge base growth, context reuse, pattern learning
   */
  private async assessMemory(tenantId: string, windowDays: number): Promise<PillarScore> {
    const findings: Finding[] = [];
    const actions: Action[] = [];

    // 4.1 Knowledge base growth
    const kbResult = await this.pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '${windowDays} days') as new_entries,
        COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '${windowDays} days') as updated_entries,
        COUNT(*) as total_entries
      FROM knowledge_base
      WHERE tenant_id = $1
    `, [tenantId]);

    const { new_entries, updated_entries, total_entries } = kbResult.rows[0] || { new_entries: 0, updated_entries: 0, total_entries: 0 };
    const kbGrowthRate = parseInt(new_entries) + parseInt(updated_entries);

    if (kbGrowthRate === 0 && parseInt(total_entries) > 0) {
      findings.push({
        id: 'memory-001',
        severity: 'medium',
        message: 'Knowledge base stagnant: no new entries or updates',
        evidence: [`Last ${windowDays} days: 0 additions, 0 updates`],
        detectedAt: new Date(),
      });
      actions.push({
        id: 'act-memory-001',
        priority: 'medium',
        title: 'Enable Knowledge Capture',
        description: 'Configure agents to extract and store reusable patterns and learnings',
        effort: 'moderate',
        impact: 'high',
      });
    }

    // 4.2 Context reuse (how often is stored context used)
    const reuseResult = await this.pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE context_source = 'knowledge_base') as kb_sourced,
        COUNT(*) FILTER (WHERE context_source = 'previous_run') as run_sourced,
        COUNT(*) FILTER (WHERE context_source IS NULL) as no_context,
        COUNT(*) as total
      FROM agent_runs
      WHERE tenant_id = $1 
      AND created_at > NOW() - INTERVAL '${windowDays} days'
    `, [tenantId]);

    const reuse = reuseResult.rows[0] || {};
    const contextReuseRate = reuse.total > 0 
      ? ((parseInt(reuse.kb_sourced || 0) + parseInt(reuse.run_sourced || 0)) / parseInt(reuse.total)) * 100
      : 0;

    if (contextReuseRate < 30 && parseInt(total_entries) > 10) {
      findings.push({
        id: 'memory-002',
        severity: 'low',
        message: `Low knowledge reuse: only ${contextReuseRate.toFixed(0)}% of runs use stored context`,
        evidence: ['Available knowledge is not being leveraged'],
        detectedAt: new Date(),
      });
    }

    // 4.3 Pattern learning (check if repeated similar tasks improve)
    const learningResult = await this.pool.query(`
      SELECT 
        task_type,
        DATE_TRUNC('week', created_at) as week,
        AVG(quality_score) as avg_quality,
        AVG(latency_ms) as avg_latency
      FROM agent_runs
      WHERE tenant_id = $1 
      AND created_at > NOW() - INTERVAL '${windowDays * 4} days'
      AND quality_score IS NOT NULL
      GROUP BY task_type, DATE_TRUNC('week', created_at)
      ORDER BY task_type, week
    `, [tenantId]);

    // Check for improvement trends
    let improvingTasks = 0;
    let totalTasks = 0;
    const taskTrends = new Map<string, number[]>();
    
    for (const row of learningResult.rows) {
      if (!taskTrends.has(row.task_type)) {
        taskTrends.set(row.task_type, []);
      }
      taskTrends.get(row.task_type)!.push(parseFloat(row.avg_quality));
    }

    for (const [task, scores] of taskTrends) {
      if (scores.length >= 2) {
        totalTasks++;
        if (scores[scores.length - 1] > scores[0]) {
          improvingTasks++;
        }
      }
    }

    const learningRate = totalTasks > 0 ? (improvingTasks / totalTasks) * 100 : 50;

    // Calculate memory score
    const kbScore = Math.min(100, parseInt(total_entries) > 0 
      ? 50 + (kbGrowthRate * 5) + (parseInt(total_entries) / 10)
      : 20);
    const reuseScore = contextReuseRate;
    const learningScore = learningRate;

    const memoryScore = (kbScore * 0.3) + (reuseScore * 0.3) + (learningScore * 0.4);

    return {
      name: 'Memory',
      description: 'Institutional knowledge capture and retention',
      score: Math.round(memoryScore),
      status: memoryScore >= 60 ? 'healthy' : memoryScore >= 35 ? 'warning' : 'critical',
      findings,
      actions,
      metrics: {
        kbEntries: parseInt(total_entries),
        newEntries: parseInt(new_entries),
        updatedEntries: parseInt(updated_entries),
        contextReuseRate: contextReuseRate.toFixed(1) + '%',
        learningRate: learningRate.toFixed(1) + '%',
        improvingTasks,
        totalTrackedTasks: totalTasks,
      },
      subPillars: [
        { name: 'Knowledge Base', score: Math.round(kbScore), status: kbScore >= 60 ? 'healthy' : kbScore >= 30 ? 'warning' : 'critical' },
        { name: 'Context Reuse', score: Math.round(reuseScore), status: reuseScore >= 50 ? 'healthy' : reuseScore >= 20 ? 'warning' : 'critical' },
        { name: 'Pattern Learning', score: Math.round(learningScore), status: learningScore >= 60 ? 'healthy' : learningScore >= 40 ? 'warning' : 'critical' },
      ],
    };
  }

  // ============================================
  // PILLAR 5: CULTURE
  // ============================================

  /**
   * Does AI align with organizational values?
   * Checks for: tone consistency, policy compliance, value alignment
   */
  private async assessCulture(tenantId: string, windowDays: number): Promise<PillarScore> {
    const findings: Finding[] = [];
    const actions: Action[] = [];

    // 5.1 Check for policy violations
    const violationsResult = await this.pool.query(`
      SELECT 
        violation_type,
        COUNT(*) as count,
        MAX(created_at) as last_occurrence
      FROM policy_violations
      WHERE tenant_id = $1 
      AND created_at > NOW() - INTERVAL '${windowDays} days'
      GROUP BY violation_type
      ORDER BY count DESC
    `, [tenantId]);

    const totalViolations = violationsResult.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
    
    if (totalViolations > 0) {
      findings.push({
        id: 'culture-001',
        severity: totalViolations > 10 ? 'high' : totalViolations > 5 ? 'medium' : 'low',
        message: `${totalViolations} policy violations detected`,
        evidence: violationsResult.rows.slice(0, 3).map(r => `${r.violation_type}: ${r.count} occurrences`),
        detectedAt: new Date(),
      });
      actions.push({
        id: 'act-culture-001',
        priority: totalViolations > 10 ? 'urgent' : 'high',
        title: 'Address Policy Violations',
        description: 'Review and update agent prompts to prevent recurring policy violations',
        effort: 'moderate',
        impact: 'high',
      });
    }

    // 5.2 Tone consistency (sentiment variance)
    const toneResult = await this.pool.query(`
      SELECT 
        agent_id,
        STDDEV(sentiment_score) as sentiment_variance,
        AVG(sentiment_score) as avg_sentiment
      FROM agent_runs
      WHERE tenant_id = $1 
      AND created_at > NOW() - INTERVAL '${windowDays} days'
      AND sentiment_score IS NOT NULL
      GROUP BY agent_id
      HAVING COUNT(*) >= 5
    `, [tenantId]);

    const inconsistentToneAgents = toneResult.rows.filter(r => parseFloat(r.sentiment_variance) > 0.3);
    if (inconsistentToneAgents.length > 0) {
      findings.push({
        id: 'culture-002',
        severity: 'low',
        message: `${inconsistentToneAgents.length} agents show inconsistent tone`,
        evidence: inconsistentToneAgents.map(a => `Agent ${a.agent_id}: variance ${parseFloat(a.sentiment_variance).toFixed(2)}`),
        detectedAt: new Date(),
      });
    }

    // 5.3 Brand voice compliance
    const brandResult = await this.pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE brand_score >= 80) as compliant,
        COUNT(*) FILTER (WHERE brand_score IS NOT NULL) as total_scored
      FROM agent_runs
      WHERE tenant_id = $1 
      AND created_at > NOW() - INTERVAL '${windowDays} days'
    `, [tenantId]);

    const { compliant, total_scored } = brandResult.rows[0] || {};
    const brandCompliance = parseInt(total_scored) > 0 
      ? (parseInt(compliant) / parseInt(total_scored)) * 100 
      : 50; // Assume neutral if no scoring

    // 5.4 User satisfaction (proxy for cultural fit)
    const satisfactionResult = await this.pool.query(`
      SELECT 
        AVG(user_rating) as avg_rating,
        COUNT(*) as rated_count
      FROM agent_runs
      WHERE tenant_id = $1 
      AND created_at > NOW() - INTERVAL '${windowDays} days'
      AND user_rating IS NOT NULL
    `, [tenantId]);

    const avgRating = parseFloat(satisfactionResult.rows[0]?.avg_rating || '3') / 5 * 100;

    // Calculate culture score
    const violationPenalty = Math.min(40, totalViolations * 4);
    const tonePenalty = Math.min(15, inconsistentToneAgents.length * 5);
    
    const cultureScore = Math.max(0, Math.min(100,
      (brandCompliance * 0.3) + 
      (avgRating * 0.3) + 
      (40 - violationPenalty) + 
      (15 - tonePenalty)
    ));

    return {
      name: 'Culture',
      description: 'Alignment with organizational values and brand',
      score: Math.round(cultureScore),
      status: cultureScore >= 70 ? 'healthy' : cultureScore >= 45 ? 'warning' : 'critical',
      findings,
      actions,
      metrics: {
        policyViolations: totalViolations,
        inconsistentToneAgents: inconsistentToneAgents.length,
        brandCompliance: brandCompliance.toFixed(1) + '%',
        userSatisfaction: avgRating.toFixed(1) + '%',
      },
      subPillars: [
        { name: 'Policy Compliance', score: Math.max(0, 100 - violationPenalty), status: totalViolations > 10 ? 'critical' : totalViolations > 3 ? 'warning' : 'healthy' },
        { name: 'Tone Consistency', score: Math.max(0, 100 - tonePenalty * 2), status: inconsistentToneAgents.length > 3 ? 'critical' : inconsistentToneAgents.length > 1 ? 'warning' : 'healthy' },
        { name: 'Brand Voice', score: Math.round(brandCompliance), status: brandCompliance >= 80 ? 'healthy' : brandCompliance >= 60 ? 'warning' : 'critical' },
        { name: 'User Satisfaction', score: Math.round(avgRating), status: avgRating >= 70 ? 'healthy' : avgRating >= 50 ? 'warning' : 'critical' },
      ],
    };
  }

  // ============================================
  // PILLAR 6: WORKFLOW
  // ============================================

  /**
   * Are human-AI handoffs smooth?
   * Checks for: approval bottlenecks, cycle time, escalation patterns
   */
  private async assessWorkflow(tenantId: string, windowDays: number): Promise<PillarScore> {
    const findings: Finding[] = [];
    const actions: Action[] = [];

    // 6.1 Approval queue health
    const queueResult = await this.pool.query(`
      SELECT 
        COUNT(*) as pending_count,
        AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600) as avg_wait_hours
      FROM agent_runs
      WHERE tenant_id = $1 
      AND approval_status = 'pending'
    `, [tenantId]);

    const { pending_count, avg_wait_hours } = queueResult.rows[0] || {};
    const pendingCount = parseInt(pending_count || '0');
    const avgWaitHours = parseFloat(avg_wait_hours || '0');

    if (pendingCount > 20) {
      findings.push({
        id: 'workflow-001',
        severity: pendingCount > 50 ? 'critical' : 'high',
        message: `Approval bottleneck: ${pendingCount} items pending`,
        evidence: [`Average wait time: ${avgWaitHours.toFixed(1)} hours`],
        detectedAt: new Date(),
      });
      actions.push({
        id: 'act-workflow-001',
        priority: 'urgent',
        title: 'Clear Approval Backlog',
        description: 'Add approvers or implement auto-approval for low-risk items',
        effort: 'quick-win',
        impact: 'high',
      });
    }

    // 6.2 End-to-end cycle time
    const cycleResult = await this.pool.query(`
      SELECT 
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cycle_time_hours) as median_cycle,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY cycle_time_hours) as p95_cycle,
        AVG(cycle_time_hours) as avg_cycle
      FROM (
        SELECT 
          EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600 as cycle_time_hours
        FROM agent_runs
        WHERE tenant_id = $1 
        AND created_at > NOW() - INTERVAL '${windowDays} days'
        AND completed_at IS NOT NULL
      ) cycles
    `, [tenantId]);

    const { median_cycle, p95_cycle, avg_cycle } = cycleResult.rows[0] || {};
    const medianCycle = parseFloat(median_cycle || '0');
    const p95Cycle = parseFloat(p95_cycle || '0');

    if (p95Cycle > 24) {
      findings.push({
        id: 'workflow-002',
        severity: p95Cycle > 72 ? 'high' : 'medium',
        message: `Slow cycle times: P95 is ${p95Cycle.toFixed(1)} hours`,
        evidence: [`Median: ${medianCycle.toFixed(1)}h, P95: ${p95Cycle.toFixed(1)}h`],
        detectedAt: new Date(),
      });
    }

    // 6.3 Escalation rate
    const escalationResult = await this.pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE escalated = true) as escalated,
        COUNT(*) as total
      FROM agent_runs
      WHERE tenant_id = $1 
      AND created_at > NOW() - INTERVAL '${windowDays} days'
    `, [tenantId]);

    const { escalated, total: escTotal } = escalationResult.rows[0] || {};
    const escalationRate = parseInt(escTotal) > 0 
      ? (parseInt(escalated || '0') / parseInt(escTotal)) * 100 
      : 0;

    if (escalationRate > 15) {
      findings.push({
        id: 'workflow-003',
        severity: escalationRate > 30 ? 'high' : 'medium',
        message: `High escalation rate: ${escalationRate.toFixed(0)}% of runs escalated`,
        evidence: ['Frequent human intervention required'],
        detectedAt: new Date(),
      });
      actions.push({
        id: 'act-workflow-002',
        priority: 'medium',
        title: 'Reduce Escalations',
        description: 'Analyze escalation patterns and enhance agent capabilities for common cases',
        effort: 'major-initiative',
        impact: 'high',
      });
    }

    // 6.4 Auto-completion rate
    const autoResult = await this.pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE approval_status = 'auto_approved') as auto_approved,
        COUNT(*) FILTER (WHERE approval_status IN ('approved', 'auto_approved')) as all_approved
      FROM agent_runs
      WHERE tenant_id = $1 
      AND created_at > NOW() - INTERVAL '${windowDays} days'
    `, [tenantId]);

    const { auto_approved, all_approved } = autoResult.rows[0] || {};
    const autoApprovalRate = parseInt(all_approved) > 0 
      ? (parseInt(auto_approved || '0') / parseInt(all_approved)) * 100 
      : 0;

    // Calculate workflow score
    const queuePenalty = Math.min(25, pendingCount * 0.5);
    const cyclePenalty = Math.min(25, p95Cycle > 24 ? (p95Cycle - 24) * 0.5 : 0);
    const escalationPenalty = Math.min(25, escalationRate * 0.8);
    const autoBonus = autoApprovalRate * 0.25;

    const workflowScore = Math.max(0, Math.min(100,
      75 - queuePenalty - cyclePenalty - escalationPenalty + autoBonus
    ));

    return {
      name: 'Workflow',
      description: 'Human-AI collaboration and handoff efficiency',
      score: Math.round(workflowScore),
      status: workflowScore >= 65 ? 'healthy' : workflowScore >= 40 ? 'warning' : 'critical',
      findings,
      actions,
      metrics: {
        pendingApprovals: pendingCount,
        avgWaitHours: avgWaitHours.toFixed(1),
        medianCycleHours: medianCycle.toFixed(1),
        p95CycleHours: p95Cycle.toFixed(1),
        escalationRate: escalationRate.toFixed(1) + '%',
        autoApprovalRate: autoApprovalRate.toFixed(1) + '%',
      },
      subPillars: [
        { name: 'Queue Health', score: Math.max(0, 100 - queuePenalty * 2), status: pendingCount > 50 ? 'critical' : pendingCount > 20 ? 'warning' : 'healthy' },
        { name: 'Cycle Time', score: Math.max(0, 100 - cyclePenalty * 2), status: p95Cycle > 72 ? 'critical' : p95Cycle > 24 ? 'warning' : 'healthy' },
        { name: 'Escalation Control', score: Math.max(0, 100 - escalationPenalty * 2), status: escalationRate > 30 ? 'critical' : escalationRate > 15 ? 'warning' : 'healthy' },
        { name: 'Automation Level', score: Math.round(autoApprovalRate), status: autoApprovalRate >= 50 ? 'healthy' : autoApprovalRate >= 20 ? 'warning' : 'critical' },
      ],
    };
  }

  // ============================================
  // PILLAR 7: GOVERNANCE
  // ============================================

  /**
   * Is AI use compliant and auditable?
   * Checks for: audit trail completeness, access controls, compliance coverage
   */
  private async assessGovernance(tenantId: string, windowDays: number): Promise<PillarScore> {
    const findings: Finding[] = [];
    const actions: Action[] = [];

    // 7.1 Audit trail completeness
    const auditResult = await this.pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE actor_id IS NOT NULL) as has_actor,
        COUNT(*) FILTER (WHERE action IS NOT NULL) as has_action,
        COUNT(*) FILTER (WHERE resource_id IS NOT NULL) as has_resource,
        COUNT(*) FILTER (WHERE ip_address IS NOT NULL) as has_ip,
        COUNT(*) as total
      FROM audit_logs
      WHERE tenant_id = $1 
      AND created_at > NOW() - INTERVAL '${windowDays} days'
    `, [tenantId]);

    const audit = auditResult.rows[0] || {};
    const auditTotal = parseInt(audit.total) || 1;
    const auditCompleteness = (
      (parseInt(audit.has_actor || 0) / auditTotal) +
      (parseInt(audit.has_action || 0) / auditTotal) +
      (parseInt(audit.has_resource || 0) / auditTotal) +
      (parseInt(audit.has_ip || 0) / auditTotal)
    ) / 4 * 100;

    if (auditCompleteness < 90) {
      findings.push({
        id: 'gov-001',
        severity: auditCompleteness < 70 ? 'high' : 'medium',
        message: `Audit trail ${auditCompleteness.toFixed(0)}% complete`,
        evidence: ['Missing fields reduce traceability and compliance'],
        detectedAt: new Date(),
      });
      actions.push({
        id: 'act-gov-001',
        priority: 'high',
        title: 'Complete Audit Logging',
        description: 'Ensure all agent operations log actor, action, resource, and source IP',
        effort: 'moderate',
        impact: 'high',
      });
    }

    // 7.2 RBAC coverage
    const rbacResult = await this.pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE role_verified = true) as role_checked,
        COUNT(*) FILTER (WHERE permission_verified = true) as perm_checked,
        COUNT(*) as total
      FROM agent_runs
      WHERE tenant_id = $1 
      AND created_at > NOW() - INTERVAL '${windowDays} days'
    `, [tenantId]);

    const rbac = rbacResult.rows[0] || {};
    const rbacTotal = parseInt(rbac.total) || 1;
    const rbacCoverage = (
      (parseInt(rbac.role_checked || 0) / rbacTotal) +
      (parseInt(rbac.perm_checked || 0) / rbacTotal)
    ) / 2 * 100;

    if (rbacCoverage < 95) {
      findings.push({
        id: 'gov-002',
        severity: rbacCoverage < 80 ? 'critical' : 'high',
        message: `RBAC coverage: ${rbacCoverage.toFixed(0)}% of operations verified`,
        evidence: ['Unauthorized access risk without full RBAC enforcement'],
        detectedAt: new Date(),
      });
      actions.push({
        id: 'act-gov-002',
        priority: 'urgent',
        title: 'Enforce RBAC on All Operations',
        description: 'Implement middleware to verify roles and permissions on every agent call',
        effort: 'moderate',
        impact: 'high',
      });
    }

    // 7.3 Data retention compliance
    const retentionResult = await this.pool.query(`
      SELECT 
        MIN(created_at) as oldest_record,
        COUNT(*) FILTER (WHERE pii_detected = true AND anonymized = false) as exposed_pii
      FROM agent_runs
      WHERE tenant_id = $1
    `, [tenantId]);

    const { oldest_record, exposed_pii } = retentionResult.rows[0] || {};
    const exposedPii = parseInt(exposed_pii || '0');

    if (exposedPii > 0) {
      findings.push({
        id: 'gov-003',
        severity: 'critical',
        message: `${exposedPii} records contain exposed PII`,
        evidence: ['GDPR/CCPA compliance risk'],
        detectedAt: new Date(),
      });
      actions.push({
        id: 'act-gov-003',
        priority: 'urgent',
        title: 'Anonymize Exposed PII',
        description: 'Run data cleanup job to anonymize or delete PII in agent records',
        effort: 'quick-win',
        impact: 'high',
      });
    }

    // 7.4 Model governance (versioning, explainability)
    const modelResult = await this.pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE model_version IS NOT NULL) as has_version,
        COUNT(*) FILTER (WHERE prompt_version IS NOT NULL) as has_prompt_version,
        COUNT(*) FILTER (WHERE explanation IS NOT NULL OR reasoning IS NOT NULL) as has_explanation,
        COUNT(*) as total
      FROM agent_runs
      WHERE tenant_id = $1 
      AND created_at > NOW() - INTERVAL '${windowDays} days'
    `, [tenantId]);

    const model = modelResult.rows[0] || {};
    const modelTotal = parseInt(model.total) || 1;
    const modelGovernance = (
      (parseInt(model.has_version || 0) / modelTotal) +
      (parseInt(model.has_prompt_version || 0) / modelTotal) +
      (parseInt(model.has_explanation || 0) / modelTotal)
    ) / 3 * 100;

    if (modelGovernance < 80) {
      findings.push({
        id: 'gov-004',
        severity: 'medium',
        message: `Model governance ${modelGovernance.toFixed(0)}%: missing versioning or explainability`,
        evidence: ['Difficult to audit which model/prompt produced outputs'],
        detectedAt: new Date(),
      });
    }

    // Calculate governance score
    const piiPenalty = Math.min(30, exposedPii * 5);
    const rbacPenalty = rbacCoverage < 100 ? (100 - rbacCoverage) * 0.5 : 0;

    const governanceScore = Math.max(0, Math.min(100,
      (auditCompleteness * 0.25) +
      (rbacCoverage * 0.3) +
      (modelGovernance * 0.15) +
      (30 - piiPenalty)
    ));

    return {
      name: 'Governance',
      description: 'Compliance, auditability, and risk management',
      score: Math.round(governanceScore),
      status: governanceScore >= 75 ? 'healthy' : governanceScore >= 50 ? 'warning' : 'critical',
      findings,
      actions,
      metrics: {
        auditCompleteness: auditCompleteness.toFixed(1) + '%',
        rbacCoverage: rbacCoverage.toFixed(1) + '%',
        exposedPiiRecords: exposedPii,
        modelGovernance: modelGovernance.toFixed(1) + '%',
        totalAuditLogs: parseInt(audit.total),
      },
      subPillars: [
        { name: 'Audit Trail', score: Math.round(auditCompleteness), status: auditCompleteness >= 90 ? 'healthy' : auditCompleteness >= 70 ? 'warning' : 'critical' },
        { name: 'Access Control', score: Math.round(rbacCoverage), status: rbacCoverage >= 95 ? 'healthy' : rbacCoverage >= 80 ? 'warning' : 'critical' },
        { name: 'Data Protection', score: Math.max(0, 100 - piiPenalty * 2), status: exposedPii > 10 ? 'critical' : exposedPii > 0 ? 'warning' : 'healthy' },
        { name: 'Model Governance', score: Math.round(modelGovernance), status: modelGovernance >= 80 ? 'healthy' : modelGovernance >= 50 ? 'warning' : 'critical' },
      ],
    };
  }

  // ============================================
  // HELPERS
  // ============================================

  private generateRecommendations(pillars: Record<string, PillarScore>): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Sort pillars by score (worst first)
    const sortedPillars = Object.entries(pillars)
      .sort(([, a], [, b]) => a.score - b.score);

    for (const [pillarKey, pillar] of sortedPillars) {
      if (pillar.status === 'critical' || pillar.status === 'warning') {
        for (const action of pillar.actions.slice(0, 2)) {
          recommendations.push({
            pillar: pillar.name,
            priority: action.priority === 'urgent' ? 10 : action.priority === 'high' ? 8 : action.priority === 'medium' ? 5 : 3,
            title: action.title,
            description: action.description,
            expectedImpact: `Improve ${pillar.name} pillar from ${pillar.score}% toward target`,
            resources: this.getResourcesForAction(pillarKey, action.id),
          });
        }
      }
    }

    // Sort by priority and limit
    return recommendations
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10);
  }

  private getResourcesForAction(pillar: string, actionId: string): string[] {
    const resourceMap: Record<string, string[]> = {
      'act-coord-001': ['docs/multi-agent-orchestration.md', 'examples/coordination-layer.ts'],
      'act-coord-002': ['docs/handoff-protocols.md'],
      'act-signal-001': ['docs/quality-scoring.md', 'services/auto-review.ts'],
      'act-signal-002': ['components/feedback-widget.tsx'],
      'act-bias-001': ['docs/bias-detection.md', 'tools/bias-audit.py'],
      'act-memory-001': ['docs/knowledge-capture.md'],
      'act-culture-001': ['docs/policy-enforcement.md'],
      'act-workflow-001': ['docs/auto-approval-rules.md'],
      'act-workflow-002': ['docs/escalation-patterns.md'],
      'act-gov-001': ['docs/audit-logging.md'],
      'act-gov-002': ['middleware/rbac.ts'],
      'act-gov-003': ['scripts/pii-cleanup.sql'],
    };
    return resourceMap[actionId] || [];
  }

  private calculateMaturity(score: number): MaturityLevel {
    if (score >= 80) return 'optimized';
    if (score >= 60) return 'established';
    if (score >= 40) return 'developing';
    return 'emerging';
  }

  private async calculateTrend(tenantId: string): Promise<'improving' | 'stable' | 'declining'> {
    const trendResult = await this.pool.query(`
      SELECT score, created_at
      FROM institutional_assessments
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [tenantId]);

    if (trendResult.rows.length < 2) return 'stable';

    const scores = trendResult.rows.map(r => r.score);
    const recent = scores.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
    const older = scores.slice(-2).reduce((a, b) => a + b, 0) / 2;

    if (recent > older + 5) return 'improving';
    if (recent < older - 5) return 'declining';
    return 'stable';
  }

  private async storeAssessment(
    tenantId: string,
    score: number,
    pillars: Record<string, PillarScore>
  ): Promise<void> {
    await this.pool.query(`
      INSERT INTO institutional_assessments (tenant_id, score, pillars, created_at)
      VALUES ($1, $2, $3, NOW())
    `, [tenantId, score, JSON.stringify(pillars)]);
  }

  private async getLastAssessment(tenantId: string): Promise<Date | undefined> {
    const result = await this.pool.query(`
      SELECT created_at FROM institutional_assessments
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [tenantId]);
    return result.rows[0]?.created_at;
  }

  // ============================================
  // QUICK CHECKS (for dashboards)
  // ============================================

  /**
   * Fast health check - just the overall score
   */
  async quickCheck(tenantId: string): Promise<{ score: number; status: string; maturity: MaturityLevel }> {
    const cached = await this.pool.query(`
      SELECT score, pillars FROM institutional_assessments
      WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 1
    `, [tenantId]);

    if (cached.rows.length > 0) {
      const score = cached.rows[0].score;
      return {
        score,
        status: score >= 70 ? 'healthy' : score >= 40 ? 'warning' : 'critical',
        maturity: this.calculateMaturity(score),
      };
    }

    // No recent cache, do full assessment
    const report = await this.assess(tenantId);
    return {
      score: report.overallScore,
      status: report.overallScore >= 70 ? 'healthy' : report.overallScore >= 40 ? 'warning' : 'critical',
      maturity: report.maturityLevel,
    };
  }

  /**
   * Get historical trend data for charts
   */
  async getHistory(tenantId: string, days: number = 30): Promise<Array<{ date: Date; score: number; pillars: Record<string, number> }>> {
    const result = await this.pool.query(`
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        AVG(score) as score,
        pillars
      FROM institutional_assessments
      WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
      GROUP BY DATE_TRUNC('day', created_at), pillars
      ORDER BY date
    `, [tenantId]);

    return result.rows.map(r => ({
      date: r.date,
      score: Math.round(r.score),
      pillars: Object.fromEntries(
        Object.entries(r.pillars as Record<string, PillarScore>)
          .map(([key, pillar]) => [key, pillar.score])
      ),
    }));
  }
}

// ============================================
// FACTORY
// ============================================

export function createInstitutionalIntelligenceService(pool: Pool): InstitutionalIntelligenceService {
  return new InstitutionalIntelligenceService(pool);
}
