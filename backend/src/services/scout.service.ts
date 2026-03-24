/**
 * Scout System - Parallel research agents
 * Based on KB: Flow Next Scouts + Agent Orchestration
 */

import { Pool } from 'pg';

export type ScoutType = 
  | 'quality-scout'    // Code quality audit
  | 'security-scout'   // Security posture
  | 'drift-scout'      // Agent drift detection
  | 'cost-scout'       // Cost analysis
  | 'pattern-scout'    // Pattern discovery
  | 'performance-scout'; // Performance analysis

interface ScoutFinding {
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation?: string;
}

interface ScoutResult {
  scoutType: ScoutType;
  findings: ScoutFinding[];
  confidence: number;
  durationMs: number;
}

interface SynthesisReport {
  healthScore: number;
  criticalIssues: ScoutFinding[];
  recommendations: string[];
  scoutCoverage: ScoutType[];
  totalFindings: number;
}

export class ScoutService {
  constructor(private pool: Pool) {}

  // Fan-out: Run multiple scouts in parallel
  async runScouts(agentId: string, types: ScoutType[]): Promise<ScoutResult[]> {
    const start = Date.now();
    const results = await Promise.allSettled(
      types.map(type => this.runScout(agentId, type))
    );
    
    return results
      .filter((r): r is PromiseFulfilledResult<ScoutResult> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  // Fan-in: Synthesize findings
  synthesize(results: ScoutResult[]): SynthesisReport {
    const findings = results.flatMap(r => r.findings);
    const critical = findings.filter(f => f.severity === 'critical');
    
    return {
      healthScore: Math.max(0, 100 - critical.length * 25 - findings.length * 2),
      criticalIssues: critical,
      recommendations: [...new Set(findings.map(f => f.recommendation).filter(Boolean) as string[])],
      scoutCoverage: results.map(r => r.scoutType),
      totalFindings: findings.length,
    };
  }

  private async runScout(agentId: string, type: ScoutType): Promise<ScoutResult> {
    const start = Date.now();
    const findings: ScoutFinding[] = [];

    switch (type) {
      case 'quality-scout':
        findings.push(...await this.scoutQuality(agentId));
        break;
      case 'drift-scout':
        findings.push(...await this.scoutDrift(agentId));
        break;
      case 'cost-scout':
        findings.push(...await this.scoutCost(agentId));
        break;
    }

    return { scoutType: type, findings, confidence: 0.85, durationMs: Date.now() - start };
  }

  private async scoutQuality(agentId: string): Promise<ScoutFinding[]> {
    const result = await this.pool.query(`
      SELECT AVG(quality_score) as avg, MIN(quality_score) as min
      FROM agent_runs WHERE agent_id = $1 AND quality_score IS NOT NULL
    `, [agentId]);
    
    const findings: ScoutFinding[] = [];
    if (result.rows[0]?.avg < 70) {
      findings.push({
        category: 'quality',
        severity: 'high',
        title: 'Low average quality score',
        description: `Average quality: ${result.rows[0].avg?.toFixed(1)}%`,
        recommendation: 'Review agent prompts and training data',
      });
    }
    return findings;
  }

  private async scoutDrift(agentId: string): Promise<ScoutFinding[]> {
    // Check for quality decline over time
    const result = await this.pool.query(`
      SELECT 
        AVG(CASE WHEN started_at > NOW() - INTERVAL '7 days' THEN quality_score END) as recent,
        AVG(CASE WHEN started_at < NOW() - INTERVAL '7 days' THEN quality_score END) as older
      FROM agent_runs WHERE agent_id = $1
    `, [agentId]);
    
    const findings: ScoutFinding[] = [];
    const { recent, older } = result.rows[0];
    if (recent && older && recent < older - 5) {
      findings.push({
        category: 'drift',
        severity: 'high',
        title: 'Quality drift detected',
        description: `Quality dropped from ${older?.toFixed(1)}% to ${recent?.toFixed(1)}%`,
        recommendation: 'Investigate recent changes, consider context reset',
      });
    }
    return findings;
  }

  private async scoutCost(agentId: string): Promise<ScoutFinding[]> {
    const result = await this.pool.query(`
      SELECT SUM(cost) as total, COUNT(*) as runs
      FROM agent_runs WHERE agent_id = $1 AND started_at > NOW() - INTERVAL '30 days'
    `, [agentId]);
    
    const findings: ScoutFinding[] = [];
    const costPerRun = result.rows[0].total / result.rows[0].runs;
    if (costPerRun > 0.50) {
      findings.push({
        category: 'cost',
        severity: 'medium',
        title: 'High cost per run',
        description: `Average: €${costPerRun.toFixed(2)} per run`,
        recommendation: 'Consider using smaller model or optimizing prompts',
      });
    }
    return findings;
  }
}
