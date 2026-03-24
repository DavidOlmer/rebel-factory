/**
 * REBEL AI FACTORY - CONTEXT HEALTH SERVICE
 * 
 * Detects the 4 Context Engineering Failure Modes:
 * 1. Context Poisoning - Errors compounding, bad patterns propagating
 * 2. Context Distraction - Pattern lock-in, stuck in same approach
 * 3. Context Confusion - Wrong tool/method selection
 * 4. Context Clash - Contradictory instructions/behaviors
 * 
 * Based on KB: Context Engineering Failure Modes
 */

import { Pool } from 'pg';

// ============================================
// TYPES
// ============================================

export interface ContextHealthReport {
  agentId: string;
  timestamp: Date;
  overallHealth: 'healthy' | 'warning' | 'critical';
  score: number; // 0-100
  failureModes: {
    poisoning: FailureModeStatus;
    distraction: FailureModeStatus;
    confusion: FailureModeStatus;
    clash: FailureModeStatus;
  };
  recommendations: string[];
  metadata: {
    runsAnalyzed: number;
    analysisWindow: string;
    lastReset?: Date;
  };
}

export interface FailureModeStatus {
  detected: boolean;
  severity: 'none' | 'low' | 'medium' | 'high';
  evidence: string[];
  lastOccurrence?: Date;
  trend: 'improving' | 'stable' | 'worsening';
  metrics: Record<string, number>;
}

export interface AgentRun {
  id: string;
  agentId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  success?: boolean;
  errorType?: string;
  errorMessage?: string;
  toolsUsed?: string[];
  approachTaken?: string;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  metadata?: {
    toolSelectionConfidence?: number;
    contextSize?: number;
    retryCount?: number;
  };
}

interface PatternLockIn {
  locked: boolean;
  severity: 'none' | 'low' | 'medium' | 'high';
  patterns: string[];
}

export interface ContextResetResult {
  success: boolean;
  agentId: string;
  resetAt: Date;
  clearedRuns: number;
  previousHealth: 'healthy' | 'warning' | 'critical';
  action: 'soft_reset' | 'hard_reset';
}

// ============================================
// CONTEXT HEALTH SERVICE
// ============================================

export class ContextHealthService {
  constructor(private pool: Pool) {}

  /**
   * Analyze agent runs for context health issues
   */
  async analyzeAgent(agentId: string, runCount: number = 50): Promise<ContextHealthReport> {
    const runs = await this.getRecentRuns(agentId, runCount);
    
    const poisoning = this.detectPoisoning(runs);
    const distraction = this.detectDistraction(runs);
    const confusion = this.detectConfusion(runs);
    const clash = this.detectClash(runs);
    
    const score = this.calculateScore(poisoning, distraction, confusion, clash);
    const overallHealth = this.calculateOverallHealth(score);
    const recommendations = this.generateRecommendations(
      { poisoning, distraction, confusion, clash },
      runs
    );
    
    // Store health snapshot for trending
    await this.storeHealthSnapshot(agentId, {
      score,
      overallHealth,
      failureModes: { poisoning, distraction, confusion, clash }
    });
    
    return {
      agentId,
      timestamp: new Date(),
      overallHealth,
      score,
      failureModes: {
        poisoning,
        distraction,
        confusion,
        clash,
      },
      recommendations,
      metadata: {
        runsAnalyzed: runs.length,
        analysisWindow: runs.length > 0 
          ? `${runs[runs.length - 1]?.startedAt?.toISOString()} - ${runs[0]?.startedAt?.toISOString()}`
          : 'N/A',
        lastReset: await this.getLastResetTime(agentId),
      },
    };
  }

  /**
   * Get recent runs for analysis
   */
  private async getRecentRuns(agentId: string, limit: number): Promise<AgentRun[]> {
    const result = await this.pool.query<AgentRun>(`
      SELECT 
        id,
        agent_id as "agentId",
        status,
        success,
        error_type as "errorType",
        error_message as "errorMessage",
        started_at as "startedAt",
        completed_at as "completedAt",
        duration_ms as "durationMs",
        COALESCE(
          ARRAY(SELECT jsonb_array_elements_text(metadata->'tools_used')),
          ARRAY[]::text[]
        ) as "toolsUsed",
        metadata->>'approach_taken' as "approachTaken",
        jsonb_build_object(
          'toolSelectionConfidence', (metadata->>'tool_selection_confidence')::numeric,
          'contextSize', (metadata->>'context_size')::int,
          'retryCount', retry_count
        ) as metadata
      FROM agent_runs
      WHERE agent_id = $1
      ORDER BY started_at DESC
      LIMIT $2
    `, [agentId, limit]);
    
    return result.rows;
  }

  // ============================================
  // FAILURE MODE DETECTION
  // ============================================

  /**
   * CONTEXT POISONING: Detect errors compounding and propagating
   * Signs: Same errors repeating, cascading failures, error rate increasing
   */
  private detectPoisoning(runs: AgentRun[]): FailureModeStatus {
    const errors = runs.filter(r => r.status === 'failed' || r.success === false);
    const errorMessages = errors.map(e => e.errorMessage || e.errorType || 'unknown');
    
    // Find repeated error patterns
    const repeatedErrors = this.findRepeatedPatterns(errorMessages, 3);
    
    // Check for cascading failures (consecutive failures)
    const cascades = this.detectCascadingFailures(runs);
    
    // Calculate error rate trend
    const errorRateTrend = this.calculateErrorRateTrend(runs);
    
    const detected = repeatedErrors.length > 0 || cascades.maxStreak >= 3;
    const severityScore = (repeatedErrors.length * 2) + (cascades.maxStreak * 1.5) + 
                         (errorRateTrend.increasing ? 3 : 0);
    
    return {
      detected,
      severity: severityScore > 10 ? 'high' : severityScore > 5 ? 'medium' : severityScore > 0 ? 'low' : 'none',
      evidence: [
        ...repeatedErrors.map(e => `Repeated error: "${e.pattern}" (${e.count}x)`),
        cascades.maxStreak >= 3 ? `Cascading failures: ${cascades.maxStreak} consecutive failures` : '',
        errorRateTrend.increasing ? `Error rate increasing: ${(errorRateTrend.recent * 100).toFixed(1)}% vs ${(errorRateTrend.historical * 100).toFixed(1)}%` : '',
      ].filter(Boolean),
      lastOccurrence: errors[0]?.startedAt,
      trend: errorRateTrend.increasing ? 'worsening' : errorRateTrend.decreasing ? 'improving' : 'stable',
      metrics: {
        totalErrors: errors.length,
        repeatedPatterns: repeatedErrors.length,
        maxCascade: cascades.maxStreak,
        errorRate: errors.length / (runs.length || 1),
      },
    };
  }

  /**
   * CONTEXT DISTRACTION: Detect pattern lock-in
   * Signs: Same tools used repeatedly even when failing, not adapting to feedback
   */
  private detectDistraction(runs: AgentRun[]): FailureModeStatus {
    // Check if agent keeps using same tools/patterns even when failing
    const toolUsage = runs.map(r => r.toolsUsed || []);
    const patternLockIn = this.detectPatternLockIn(runs, toolUsage);
    
    // Check for lack of adaptation
    const failedWithSameApproach = this.detectSameApproachFailures(runs);
    
    // Measure approach diversity
    const approachDiversity = this.measureApproachDiversity(runs);
    
    return {
      detected: patternLockIn.locked || failedWithSameApproach.count >= 3,
      severity: patternLockIn.severity,
      evidence: [
        ...patternLockIn.patterns,
        failedWithSameApproach.count >= 3 
          ? `Same approach used in ${failedWithSameApproach.count} failed runs` 
          : '',
        approachDiversity < 0.3 
          ? `Low approach diversity: ${(approachDiversity * 100).toFixed(0)}%` 
          : '',
      ].filter(Boolean),
      lastOccurrence: patternLockIn.locked ? runs[0]?.startedAt : undefined,
      trend: approachDiversity < 0.3 ? 'worsening' : 'stable',
      metrics: {
        approachDiversity,
        sameApproachFailures: failedWithSameApproach.count,
        patternRepeats: patternLockIn.patterns.length,
      },
    };
  }

  /**
   * CONTEXT CONFUSION: Detect wrong tool/method selection
   * Signs: Low tool selection confidence, frequent tool switches mid-task, mismatched tool-task pairs
   */
  private detectConfusion(runs: AgentRun[]): FailureModeStatus {
    // Check for low tool selection confidence
    const toolMismatches = runs.filter(r => 
      r.metadata?.toolSelectionConfidence !== undefined && 
      r.metadata.toolSelectionConfidence < 0.5
    );
    
    // Check for high retry counts (sign of wrong initial approach)
    const highRetryRuns = runs.filter(r => 
      (r.metadata?.retryCount || 0) >= 3
    );
    
    // Detect tool thrashing (switching tools rapidly)
    const toolThrashing = this.detectToolThrashing(runs);
    
    const confusionRate = toolMismatches.length / (runs.length || 1);
    
    return {
      detected: confusionRate > 0.2 || toolThrashing.thrashing || highRetryRuns.length >= 3,
      severity: confusionRate > 0.4 || highRetryRuns.length >= 5 ? 'high' : 
                confusionRate > 0.2 || highRetryRuns.length >= 3 ? 'medium' : 
                confusionRate > 0.1 ? 'low' : 'none',
      evidence: [
        confusionRate > 0.1 
          ? `${(confusionRate * 100).toFixed(0)}% of runs had low tool selection confidence` 
          : '',
        highRetryRuns.length >= 3 
          ? `${highRetryRuns.length} runs required 3+ retries` 
          : '',
        toolThrashing.thrashing 
          ? `Tool thrashing detected: ${toolThrashing.description}` 
          : '',
      ].filter(Boolean),
      lastOccurrence: toolMismatches[0]?.startedAt,
      trend: this.calculateConfusionTrend(runs),
      metrics: {
        lowConfidenceRuns: toolMismatches.length,
        highRetryRuns: highRetryRuns.length,
        avgToolSwitches: toolThrashing.avgSwitches,
        confusionRate,
      },
    };
  }

  /**
   * CONTEXT CLASH: Detect contradictory behaviors
   * Signs: Oscillating approaches, conflicting actions, inconsistent outputs
   */
  private detectClash(runs: AgentRun[]): FailureModeStatus {
    // Check for oscillating behavior (A → B → A → B)
    const approaches = runs.map(r => r.approachTaken).filter(Boolean) as string[];
    const oscillations = this.detectOscillations(approaches);
    
    // Check for contradictory outcomes on similar tasks
    const contradictions = this.detectContradictoryOutcomes(runs);
    
    // Measure behavior consistency
    const consistency = this.measureBehaviorConsistency(runs);
    
    return {
      detected: oscillations > 3 || contradictions.count >= 2,
      severity: oscillations > 6 || contradictions.count >= 4 ? 'high' : 
                oscillations > 3 || contradictions.count >= 2 ? 'medium' : 
                oscillations > 1 ? 'low' : 'none',
      evidence: [
        oscillations > 1 
          ? `${oscillations} approach oscillations detected` 
          : '',
        contradictions.count >= 2 
          ? `${contradictions.count} contradictory outcomes on similar tasks` 
          : '',
        consistency < 0.6 
          ? `Low behavior consistency: ${(consistency * 100).toFixed(0)}%` 
          : '',
        ...contradictions.examples.slice(0, 2),
      ].filter(Boolean),
      lastOccurrence: oscillations > 0 ? runs[0]?.startedAt : undefined,
      trend: consistency < 0.5 ? 'worsening' : 'stable',
      metrics: {
        oscillations,
        contradictions: contradictions.count,
        behaviorConsistency: consistency,
      },
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private findRepeatedPatterns(items: string[], threshold: number): Array<{ pattern: string; count: number }> {
    const counts = new Map<string, number>();
    
    for (const item of items) {
      // Normalize error messages for comparison
      const normalized = this.normalizeErrorMessage(item);
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
    
    return Array.from(counts.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count);
  }

  private normalizeErrorMessage(msg: string): string {
    // Remove timestamps, IDs, specific values to find patterns
    return msg
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, '<timestamp>')
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
      .replace(/\d+/g, '<n>')
      .trim()
      .toLowerCase();
  }

  private detectCascadingFailures(runs: AgentRun[]): { maxStreak: number; streaks: number[] } {
    let currentStreak = 0;
    let maxStreak = 0;
    const streaks: number[] = [];
    
    for (const run of runs) {
      if (run.status === 'failed' || run.success === false) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        if (currentStreak > 0) streaks.push(currentStreak);
        currentStreak = 0;
      }
    }
    if (currentStreak > 0) streaks.push(currentStreak);
    
    return { maxStreak, streaks };
  }

  private calculateErrorRateTrend(runs: AgentRun[]): { recent: number; historical: number; increasing: boolean; decreasing: boolean } {
    if (runs.length < 10) {
      return { recent: 0, historical: 0, increasing: false, decreasing: false };
    }
    
    const midpoint = Math.floor(runs.length / 2);
    const recentRuns = runs.slice(0, midpoint);
    const historicalRuns = runs.slice(midpoint);
    
    const recentErrors = recentRuns.filter(r => r.status === 'failed' || r.success === false).length;
    const historicalErrors = historicalRuns.filter(r => r.status === 'failed' || r.success === false).length;
    
    const recent = recentErrors / recentRuns.length;
    const historical = historicalErrors / historicalRuns.length;
    
    return {
      recent,
      historical,
      increasing: recent > historical * 1.2,
      decreasing: recent < historical * 0.8,
    };
  }

  private detectPatternLockIn(runs: AgentRun[], toolUsage: string[][]): PatternLockIn {
    const failedRuns = runs.filter(r => r.status === 'failed' || r.success === false);
    
    if (failedRuns.length < 3) {
      return { locked: false, severity: 'none', patterns: [] };
    }
    
    // Check if same tools are used in consecutive failures
    const failedToolSets = failedRuns.map(r => (r.toolsUsed || []).sort().join(','));
    const repeatedToolSets = this.findRepeatedPatterns(failedToolSets, 3);
    
    const locked = repeatedToolSets.length > 0;
    const severity = repeatedToolSets.length > 2 ? 'high' : 
                     repeatedToolSets.length > 0 ? 'medium' : 'none';
    
    return {
      locked,
      severity,
      patterns: repeatedToolSets.map(({ pattern, count }) => 
        `Same tools [${pattern || 'none'}] used in ${count} failed runs`
      ),
    };
  }

  private detectSameApproachFailures(runs: AgentRun[]): { count: number; approach?: string } {
    const failedRuns = runs.filter(r => r.status === 'failed' || r.success === false);
    const approaches = failedRuns.map(r => r.approachTaken).filter(Boolean);
    
    if (approaches.length < 3) return { count: 0 };
    
    const counts = new Map<string, number>();
    for (const approach of approaches) {
      counts.set(approach as string, (counts.get(approach as string) || 0) + 1);
    }
    
    const maxEntry = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    
    return {
      count: maxEntry?.[1] || 0,
      approach: maxEntry?.[0],
    };
  }

  private measureApproachDiversity(runs: AgentRun[]): number {
    const approaches = runs.map(r => r.approachTaken).filter(Boolean);
    if (approaches.length === 0) return 1;
    
    const uniqueApproaches = new Set(approaches);
    return uniqueApproaches.size / approaches.length;
  }

  private detectToolThrashing(runs: AgentRun[]): { thrashing: boolean; avgSwitches: number; description: string } {
    // This would require per-run tool sequence data
    // For now, approximate by comparing consecutive runs
    let totalSwitches = 0;
    
    for (let i = 1; i < runs.length; i++) {
      const prevTools = new Set(runs[i - 1].toolsUsed || []);
      const currTools = new Set(runs[i].toolsUsed || []);
      
      // Count tools changed between runs
      const diff = new Set([...prevTools, ...currTools].filter(
        t => !prevTools.has(t) || !currTools.has(t)
      ));
      totalSwitches += diff.size;
    }
    
    const avgSwitches = runs.length > 1 ? totalSwitches / (runs.length - 1) : 0;
    
    return {
      thrashing: avgSwitches > 3,
      avgSwitches,
      description: avgSwitches > 3 ? `Avg ${avgSwitches.toFixed(1)} tool changes per run` : '',
    };
  }

  private calculateConfusionTrend(runs: AgentRun[]): 'improving' | 'stable' | 'worsening' {
    if (runs.length < 10) return 'stable';
    
    const recentRuns = runs.slice(0, 5);
    const olderRuns = runs.slice(5, 10);
    
    const recentConfusion = recentRuns.filter(r => 
      (r.metadata?.toolSelectionConfidence || 1) < 0.5
    ).length / recentRuns.length;
    
    const olderConfusion = olderRuns.filter(r => 
      (r.metadata?.toolSelectionConfidence || 1) < 0.5
    ).length / olderRuns.length;
    
    if (recentConfusion > olderConfusion * 1.5) return 'worsening';
    if (recentConfusion < olderConfusion * 0.5) return 'improving';
    return 'stable';
  }

  private detectOscillations(approaches: string[]): number {
    if (approaches.length < 4) return 0;
    
    let oscillations = 0;
    
    for (let i = 2; i < approaches.length; i++) {
      // Pattern: A → B → A (oscillation)
      if (approaches[i] === approaches[i - 2] && approaches[i] !== approaches[i - 1]) {
        oscillations++;
      }
    }
    
    return oscillations;
  }

  private detectContradictoryOutcomes(runs: AgentRun[]): { count: number; examples: string[] } {
    // Group runs by approach, check for mixed success/failure on same approach
    const byApproach = new Map<string, AgentRun[]>();
    
    for (const run of runs) {
      if (run.approachTaken) {
        const existing = byApproach.get(run.approachTaken) || [];
        existing.push(run);
        byApproach.set(run.approachTaken, existing);
      }
    }
    
    let contradictions = 0;
    const examples: string[] = [];
    
    for (const [approach, approachRuns] of byApproach) {
      const successes = approachRuns.filter(r => r.success === true).length;
      const failures = approachRuns.filter(r => r.success === false).length;
      
      // Both success and failure with same approach = contradiction
      if (successes > 0 && failures > 0) {
        contradictions++;
        examples.push(`"${approach}": ${successes} success, ${failures} failures`);
      }
    }
    
    return { count: contradictions, examples };
  }

  private measureBehaviorConsistency(runs: AgentRun[]): number {
    const recentRuns = runs.slice(0, 10);
    if (recentRuns.length < 5) return 1;
    
    // Measure consistency of outcomes for similar inputs
    const approaches = recentRuns.map(r => r.approachTaken).filter(Boolean);
    const outcomes = recentRuns.map(r => r.success);
    
    let consistent = 0;
    let total = 0;
    
    for (let i = 0; i < approaches.length; i++) {
      for (let j = i + 1; j < approaches.length; j++) {
        if (approaches[i] === approaches[j]) {
          total++;
          if (outcomes[i] === outcomes[j]) consistent++;
        }
      }
    }
    
    return total > 0 ? consistent / total : 1;
  }

  // ============================================
  // SCORING & RECOMMENDATIONS
  // ============================================

  private calculateScore(
    poisoning: FailureModeStatus,
    distraction: FailureModeStatus,
    confusion: FailureModeStatus,
    clash: FailureModeStatus
  ): number {
    const severityScores = { none: 0, low: 15, medium: 30, high: 50 };
    
    const penalties = [
      severityScores[poisoning.severity],
      severityScores[distraction.severity],
      severityScores[confusion.severity],
      severityScores[clash.severity],
    ];
    
    const totalPenalty = penalties.reduce((a, b) => a + b, 0);
    return Math.max(0, Math.min(100, 100 - totalPenalty));
  }

  private calculateOverallHealth(score: number): 'healthy' | 'warning' | 'critical' {
    if (score >= 70) return 'healthy';
    if (score >= 40) return 'warning';
    return 'critical';
  }

  private generateRecommendations(
    failureModes: {
      poisoning: FailureModeStatus;
      distraction: FailureModeStatus;
      confusion: FailureModeStatus;
      clash: FailureModeStatus;
    },
    runs: AgentRun[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Context Poisoning recommendations
    if (failureModes.poisoning.detected) {
      if (failureModes.poisoning.severity === 'high') {
        recommendations.push('🚨 CRITICAL: Clear agent context immediately (hard reset)');
        recommendations.push('Review and fix root cause errors before resuming');
      } else {
        recommendations.push('Consider soft context reset to clear accumulated errors');
        recommendations.push('Add explicit error acknowledgment to break error cascade');
      }
    }
    
    // Context Distraction recommendations
    if (failureModes.distraction.detected) {
      recommendations.push('Rotate to different agent or approach for fresh perspective');
      recommendations.push('Break current task into smaller, independent chunks');
      if (failureModes.distraction.severity === 'high') {
        recommendations.push('Consider using a different model with different reasoning patterns');
      }
    }
    
    // Context Confusion recommendations
    if (failureModes.confusion.detected) {
      recommendations.push('Review tool descriptions for clarity and specificity');
      recommendations.push('Add explicit tool selection guidance to system prompt');
      if (failureModes.confusion.metrics.highRetryRuns > 3) {
        recommendations.push('Consider adding a "planning" step before tool selection');
      }
    }
    
    // Context Clash recommendations
    if (failureModes.clash.detected) {
      recommendations.push('Audit system prompt for contradictory instructions');
      recommendations.push('Check for conflicting multi-agent orchestration rules');
      if (failureModes.clash.metrics.oscillations > 5) {
        recommendations.push('Add explicit "commit to approach" guidance');
      }
    }
    
    // General recommendations based on overall patterns
    const successRate = runs.filter(r => r.success === true).length / (runs.length || 1);
    if (successRate < 0.5) {
      recommendations.push('Success rate below 50% - consider task complexity reduction');
    }
    
    return recommendations;
  }

  // ============================================
  // CONTEXT RESET
  // ============================================

  /**
   * Reset agent context to clear poisoning
   */
  async resetContext(agentId: string, action: 'soft_reset' | 'hard_reset'): Promise<ContextResetResult> {
    // Get current health before reset
    const currentHealth = await this.analyzeAgent(agentId, 20);
    
    let clearedRuns = 0;
    
    if (action === 'hard_reset') {
      // Hard reset: Mark all recent failed runs as "cleared" so they don't poison future analysis
      const result = await this.pool.query(`
        UPDATE agent_runs 
        SET metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{context_cleared}',
          'true'::jsonb
        )
        WHERE agent_id = $1 
          AND success = false
          AND started_at > NOW() - INTERVAL '7 days'
        RETURNING id
      `, [agentId]);
      clearedRuns = result.rowCount || 0;
      
      // Reset agent status
      await this.pool.query(`
        UPDATE agents 
        SET status = 'idle', 
            updated_at = NOW()
        WHERE id = $1
      `, [agentId]);
    }
    
    // Record the reset event
    await this.pool.query(`
      INSERT INTO context_health_events (
        agent_id, event_type, action, metadata, created_at
      ) VALUES ($1, 'context_reset', $2, $3, NOW())
    `, [
      agentId,
      action,
      JSON.stringify({
        previousHealth: currentHealth.overallHealth,
        previousScore: currentHealth.score,
        clearedRuns,
      }),
    ]);
    
    return {
      success: true,
      agentId,
      resetAt: new Date(),
      clearedRuns,
      previousHealth: currentHealth.overallHealth,
      action,
    };
  }

  /**
   * Get last context reset time
   */
  private async getLastResetTime(agentId: string): Promise<Date | undefined> {
    try {
      const result = await this.pool.query(`
        SELECT created_at 
        FROM context_health_events
        WHERE agent_id = $1 AND event_type = 'context_reset'
        ORDER BY created_at DESC
        LIMIT 1
      `, [agentId]);
      
      return result.rows[0]?.created_at;
    } catch {
      // Table might not exist yet
      return undefined;
    }
  }

  /**
   * Store health snapshot for trending
   */
  private async storeHealthSnapshot(
    agentId: string, 
    data: { score: number; overallHealth: string; failureModes: any }
  ): Promise<void> {
    try {
      await this.pool.query(`
        INSERT INTO context_health_snapshots (
          agent_id, score, overall_health, failure_modes, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `, [
        agentId,
        data.score,
        data.overallHealth,
        JSON.stringify(data.failureModes),
      ]);
    } catch {
      // Table might not exist yet - that's fine
    }
  }

  // ============================================
  // TRENDING & HISTORY
  // ============================================

  /**
   * Get context health history for trending
   */
  async getHealthHistory(agentId: string, days: number = 30): Promise<Array<{
    date: Date;
    score: number;
    overallHealth: string;
  }>> {
    try {
      const result = await this.pool.query(`
        SELECT 
          DATE(created_at) as date,
          AVG(score) as score,
          MODE() WITHIN GROUP (ORDER BY overall_health) as overall_health
        FROM context_health_snapshots
        WHERE agent_id = $1 
          AND created_at > NOW() - INTERVAL '1 day' * $2
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `, [agentId, days]);
      
      return result.rows;
    } catch {
      return [];
    }
  }

  /**
   * Get system-wide context health overview
   */
  async getSystemOverview(): Promise<{
    totalAgents: number;
    healthDistribution: Record<string, number>;
    avgScore: number;
    criticalAgents: Array<{ id: string; name: string; score: number }>;
  }> {
    try {
      const [distribution, critical] = await Promise.all([
        this.pool.query(`
          WITH latest AS (
            SELECT DISTINCT ON (agent_id) agent_id, score, overall_health
            FROM context_health_snapshots
            ORDER BY agent_id, created_at DESC
          )
          SELECT 
            COUNT(*) as total,
            AVG(score) as avg_score,
            COUNT(*) FILTER (WHERE overall_health = 'healthy') as healthy,
            COUNT(*) FILTER (WHERE overall_health = 'warning') as warning,
            COUNT(*) FILTER (WHERE overall_health = 'critical') as critical
          FROM latest
        `),
        this.pool.query(`
          WITH latest AS (
            SELECT DISTINCT ON (agent_id) agent_id, score, overall_health
            FROM context_health_snapshots
            ORDER BY agent_id, created_at DESC
          )
          SELECT l.agent_id as id, a.name, l.score
          FROM latest l
          JOIN agents a ON a.id = l.agent_id
          WHERE l.overall_health = 'critical'
          ORDER BY l.score ASC
          LIMIT 10
        `),
      ]);
      
      const dist = distribution.rows[0] || {};
      
      return {
        totalAgents: parseInt(dist.total || '0'),
        healthDistribution: {
          healthy: parseInt(dist.healthy || '0'),
          warning: parseInt(dist.warning || '0'),
          critical: parseInt(dist.critical || '0'),
        },
        avgScore: parseFloat(dist.avg_score || '100'),
        criticalAgents: critical.rows,
      };
    } catch {
      return {
        totalAgents: 0,
        healthDistribution: { healthy: 0, warning: 0, critical: 0 },
        avgScore: 100,
        criticalAgents: [],
      };
    }
  }
}
