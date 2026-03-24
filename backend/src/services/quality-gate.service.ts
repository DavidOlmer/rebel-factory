/**
 * REBEL AI FACTORY - QUALITY GATE SERVICE
 * 
 * 4-Stage Review Process for AI-generated code/artifacts
 * Based on KB concepts:
 * - Coding Agent Best Practices (verification loops)
 * - Dense Feedback (clear quality signals)
 * - Institutional Intelligence (learning from past issues)
 */

import { Pool } from 'pg';

// ============================================
// TYPES
// ============================================

export type Stage = 'architecture' | 'code' | 'tests' | 'performance';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface GateIssue {
  severity: Severity;
  message: string;
  recommendation: string;
  location?: string;      // File or component location
  ruleId?: string;        // Rule that triggered this
  autoFixable?: boolean;  // Can be auto-remediated?
}

export interface GateResult {
  stage: Stage;
  passed: boolean;
  score: number;          // 0-100
  duration: number;       // ms
  issues: GateIssue[];
  metadata?: Record<string, unknown>;
}

export interface GateRunResult {
  runId: string;
  contentHash: string;
  startedAt: Date;
  completedAt: Date;
  overallPassed: boolean;
  overallScore: number;
  stages: GateResult[];
  blockingIssues: GateIssue[];
}

export interface GateConfig {
  skipStages?: Stage[];
  thresholds?: {
    architecture?: number;
    code?: number;
    tests?: number;
    performance?: number;
  };
  strictMode?: boolean;   // Fail on any issue
}

export interface ContentToReview {
  files?: FileChange[];
  hasTests?: boolean;
  testCoverage?: number;
  dependencies?: string[];
  complexity?: number;
  linesChanged?: number;
  description?: string;
}

export interface FileChange {
  path: string;
  type: 'add' | 'modify' | 'delete';
  content?: string;
  linesAdded?: number;
  linesRemoved?: number;
}

// ============================================
// SERVICE
// ============================================

export class QualityGateService {
  constructor(private pool?: Pool) {}

  /**
   * Run the complete 4-stage quality gate
   */
  async runGate(runId: string, content: ContentToReview, config?: GateConfig): Promise<GateRunResult> {
    const startTime = Date.now();
    const results: GateResult[] = [];
    const skipStages = config?.skipStages || [];

    // Stage 1: Architecture Review
    if (!skipStages.includes('architecture')) {
      results.push(await this.checkArchitecture(content, config));
    }

    // Stage 2: Code Quality Review
    if (!skipStages.includes('code')) {
      results.push(await this.checkCodeQuality(content, config));
    }

    // Stage 3: Test Coverage Review
    if (!skipStages.includes('tests')) {
      results.push(await this.checkTests(content, config));
    }

    // Stage 4: Performance Review
    if (!skipStages.includes('performance')) {
      results.push(await this.checkPerformance(content, config));
    }

    // Calculate overall results
    const overallScore = Math.round(
      results.reduce((sum, r) => sum + r.score, 0) / results.length
    );
    
    const blockingIssues = results
      .flatMap(r => r.issues)
      .filter(i => i.severity === 'critical' || i.severity === 'high');

    const overallPassed = config?.strictMode
      ? blockingIssues.length === 0 && results.every(r => r.passed)
      : blockingIssues.filter(i => i.severity === 'critical').length === 0;

    const result: GateRunResult = {
      runId,
      contentHash: this.hashContent(content),
      startedAt: new Date(startTime),
      completedAt: new Date(),
      overallPassed,
      overallScore,
      stages: results,
      blockingIssues
    };

    // Persist result if pool available
    if (this.pool) {
      await this.persistResult(result);
    }

    return result;
  }

  /**
   * Stage 1: Architecture Review
   * Checks structural patterns, separation of concerns, dependency direction
   */
  private async checkArchitecture(content: ContentToReview, config?: GateConfig): Promise<GateResult> {
    const startTime = Date.now();
    const issues: GateIssue[] = [];
    const threshold = config?.thresholds?.architecture ?? 70;

    // Check 1: Change scope
    const fileCount = content.files?.length || 0;
    if (fileCount > 15) {
      issues.push({
        severity: 'high',
        message: `Large change scope: ${fileCount} files modified`,
        recommendation: 'Consider splitting into smaller, focused changes',
        ruleId: 'ARCH-001'
      });
    } else if (fileCount > 10) {
      issues.push({
        severity: 'medium',
        message: `Moderate change scope: ${fileCount} files modified`,
        recommendation: 'Review if all changes are necessary for this PR',
        ruleId: 'ARCH-001'
      });
    }

    // Check 2: Cross-cutting changes
    const directories = new Set(content.files?.map(f => f.path.split('/')[0]) || []);
    if (directories.size > 5) {
      issues.push({
        severity: 'medium',
        message: `Changes span ${directories.size} top-level directories`,
        recommendation: 'Ensure changes follow architectural boundaries',
        ruleId: 'ARCH-002'
      });
    }

    // Check 3: Circular dependency risk
    const hasCircularRisk = this.detectCircularDependencyRisk(content);
    if (hasCircularRisk) {
      issues.push({
        severity: 'high',
        message: 'Potential circular dependency detected',
        recommendation: 'Refactor to use dependency injection or event-based communication',
        ruleId: 'ARCH-003'
      });
    }

    // Check 4: Layer violations
    const layerViolations = this.detectLayerViolations(content);
    issues.push(...layerViolations);

    // Calculate score
    const deductions = issues.reduce((sum, issue) => {
      const weights = { critical: 40, high: 25, medium: 15, low: 5, info: 0 };
      return sum + weights[issue.severity];
    }, 0);
    const score = Math.max(0, 100 - deductions);

    return {
      stage: 'architecture',
      passed: score >= threshold && !issues.some(i => i.severity === 'critical'),
      score,
      duration: Date.now() - startTime,
      issues,
      metadata: { fileCount, directoryCount: directories.size }
    };
  }

  /**
   * Stage 2: Code Quality Review
   * Checks code style, complexity, best practices
   */
  private async checkCodeQuality(content: ContentToReview, config?: GateConfig): Promise<GateResult> {
    const startTime = Date.now();
    const issues: GateIssue[] = [];
    const threshold = config?.thresholds?.code ?? 70;

    // Check 1: Complexity
    if (content.complexity && content.complexity > 20) {
      issues.push({
        severity: 'high',
        message: `High cyclomatic complexity: ${content.complexity}`,
        recommendation: 'Break down complex functions into smaller units',
        ruleId: 'CODE-001'
      });
    } else if (content.complexity && content.complexity > 10) {
      issues.push({
        severity: 'medium',
        message: `Moderate complexity: ${content.complexity}`,
        recommendation: 'Consider simplifying logic where possible',
        ruleId: 'CODE-001'
      });
    }

    // Check 2: Lines changed
    const linesChanged = content.linesChanged || 
      content.files?.reduce((sum, f) => sum + (f.linesAdded || 0) + (f.linesRemoved || 0), 0) || 0;
    
    if (linesChanged > 500) {
      issues.push({
        severity: 'medium',
        message: `Large diff: ${linesChanged} lines changed`,
        recommendation: 'Consider breaking into smaller commits',
        ruleId: 'CODE-002'
      });
    }

    // Check 3: File-level checks
    for (const file of content.files || []) {
      // Check for large files
      if (file.linesAdded && file.linesAdded > 300) {
        issues.push({
          severity: 'low',
          message: `Large file addition: ${file.path}`,
          recommendation: 'Consider splitting into multiple modules',
          location: file.path,
          ruleId: 'CODE-003'
        });
      }

      // Check for potential security issues
      const securityIssues = this.checkSecurityPatterns(file);
      issues.push(...securityIssues);

      // Check for code smells
      const codeSmells = this.checkCodeSmells(file);
      issues.push(...codeSmells);
    }

    // Calculate score
    const deductions = issues.reduce((sum, issue) => {
      const weights = { critical: 40, high: 25, medium: 15, low: 5, info: 0 };
      return sum + weights[issue.severity];
    }, 0);
    const score = Math.max(0, 100 - deductions);

    return {
      stage: 'code',
      passed: score >= threshold && !issues.some(i => i.severity === 'critical'),
      score,
      duration: Date.now() - startTime,
      issues,
      metadata: { linesChanged, complexity: content.complexity }
    };
  }

  /**
   * Stage 3: Test Review
   * Checks test coverage, test quality
   */
  private async checkTests(content: ContentToReview, config?: GateConfig): Promise<GateResult> {
    const startTime = Date.now();
    const issues: GateIssue[] = [];
    const threshold = config?.thresholds?.tests ?? 70;

    // Check 1: Tests included
    if (!content.hasTests) {
      issues.push({
        severity: 'high',
        message: 'No tests included in this change',
        recommendation: 'Add unit tests for new functionality',
        ruleId: 'TEST-001'
      });
    }

    // Check 2: Test coverage
    if (content.testCoverage !== undefined) {
      if (content.testCoverage < 50) {
        issues.push({
          severity: 'high',
          message: `Low test coverage: ${content.testCoverage}%`,
          recommendation: 'Increase test coverage to at least 70%',
          ruleId: 'TEST-002'
        });
      } else if (content.testCoverage < 70) {
        issues.push({
          severity: 'medium',
          message: `Moderate test coverage: ${content.testCoverage}%`,
          recommendation: 'Consider adding more edge case tests',
          ruleId: 'TEST-002'
        });
      }
    }

    // Check 3: Test file presence for new files
    const newFiles = content.files?.filter(f => f.type === 'add') || [];
    const testFiles = newFiles.filter(f => 
      f.path.includes('.test.') || 
      f.path.includes('.spec.') ||
      f.path.includes('__tests__')
    );
    
    const nonTestNewFiles = newFiles.filter(f => 
      !f.path.includes('.test.') && 
      !f.path.includes('.spec.') &&
      !f.path.includes('__tests__') &&
      (f.path.endsWith('.ts') || f.path.endsWith('.tsx') || f.path.endsWith('.js'))
    );

    if (nonTestNewFiles.length > 0 && testFiles.length === 0) {
      issues.push({
        severity: 'medium',
        message: `${nonTestNewFiles.length} new source files without corresponding test files`,
        recommendation: 'Add test files for new source files',
        ruleId: 'TEST-003'
      });
    }

    // Calculate score
    let score = 100;
    if (!content.hasTests) score -= 30;
    if (content.testCoverage !== undefined) {
      score = Math.min(score, content.testCoverage);
    }
    const deductions = issues
      .filter(i => !['TEST-001', 'TEST-002'].includes(i.ruleId || ''))
      .reduce((sum, issue) => {
        const weights = { critical: 40, high: 25, medium: 15, low: 5, info: 0 };
        return sum + weights[issue.severity];
      }, 0);
    score = Math.max(0, score - deductions);

    return {
      stage: 'tests',
      passed: score >= threshold && content.hasTests !== false,
      score,
      duration: Date.now() - startTime,
      issues,
      metadata: { 
        hasTests: content.hasTests, 
        testCoverage: content.testCoverage,
        newSourceFiles: nonTestNewFiles.length,
        newTestFiles: testFiles.length
      }
    };
  }

  /**
   * Stage 4: Performance Review
   * Checks for performance anti-patterns
   */
  private async checkPerformance(content: ContentToReview, config?: GateConfig): Promise<GateResult> {
    const startTime = Date.now();
    const issues: GateIssue[] = [];
    const threshold = config?.thresholds?.performance ?? 70;

    for (const file of content.files || []) {
      const perfIssues = this.checkPerformancePatterns(file);
      issues.push(...perfIssues);
    }

    // Check for new dependencies
    if (content.dependencies && content.dependencies.length > 0) {
      for (const dep of content.dependencies) {
        if (this.isHeavyDependency(dep)) {
          issues.push({
            severity: 'medium',
            message: `New heavy dependency: ${dep}`,
            recommendation: 'Evaluate bundle size impact and consider alternatives',
            ruleId: 'PERF-003'
          });
        }
      }
    }

    // Calculate score
    const deductions = issues.reduce((sum, issue) => {
      const weights = { critical: 40, high: 25, medium: 15, low: 5, info: 0 };
      return sum + weights[issue.severity];
    }, 0);
    const score = Math.max(0, 100 - deductions);

    return {
      stage: 'performance',
      passed: score >= threshold && !issues.some(i => i.severity === 'critical'),
      score,
      duration: Date.now() - startTime,
      issues,
      metadata: { newDependencies: content.dependencies?.length || 0 }
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private detectCircularDependencyRisk(content: ContentToReview): boolean {
    // Simplified check - in real impl would use import analysis
    const imports = new Map<string, string[]>();
    
    for (const file of content.files || []) {
      if (file.content) {
        const importMatches = file.content.match(/from ['"]\.\.?\/[^'"]+['"]/g) || [];
        imports.set(file.path, importMatches.map(m => m.replace(/from ['"]|['"]/g, '')));
      }
    }

    // Check for A -> B -> A patterns (simplified)
    for (const [file, deps] of imports) {
      for (const dep of deps) {
        const depImports = imports.get(dep) || [];
        if (depImports.some(d => d.includes(file.split('/').pop()?.replace(/\.ts$/, '') || ''))) {
          return true;
        }
      }
    }

    return false;
  }

  private detectLayerViolations(content: ContentToReview): GateIssue[] {
    const issues: GateIssue[] = [];
    
    // Define layer hierarchy (lower can't import higher)
    const layers = ['routes', 'services', 'db', 'types', 'config'];
    
    for (const file of content.files || []) {
      const fileLayer = layers.findIndex(l => file.path.includes(`/${l}/`));
      if (fileLayer === -1 || !file.content) continue;

      for (let i = 0; i < fileLayer; i++) {
        if (file.content.includes(`from '`) && file.content.includes(`/${layers[i]}/`)) {
          issues.push({
            severity: 'medium',
            message: `Layer violation: ${layers[fileLayer]} imports from ${layers[i]}`,
            recommendation: `${layers[fileLayer]} should not depend on ${layers[i]}`,
            location: file.path,
            ruleId: 'ARCH-004'
          });
        }
      }
    }

    return issues;
  }

  private checkSecurityPatterns(file: FileChange): GateIssue[] {
    const issues: GateIssue[] = [];
    if (!file.content) return issues;

    const patterns = [
      { pattern: /eval\s*\(/g, message: 'Use of eval() detected', severity: 'critical' as Severity },
      { pattern: /innerHTML\s*=/g, message: 'Direct innerHTML assignment', severity: 'high' as Severity },
      { pattern: /password\s*=\s*['"][^'"]+['"]/gi, message: 'Hardcoded password detected', severity: 'critical' as Severity },
      { pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/gi, message: 'Hardcoded API key detected', severity: 'critical' as Severity },
      { pattern: /dangerouslySetInnerHTML/g, message: 'Use of dangerouslySetInnerHTML', severity: 'medium' as Severity },
    ];

    for (const { pattern, message, severity } of patterns) {
      if (pattern.test(file.content)) {
        issues.push({
          severity,
          message,
          recommendation: 'Review and fix security concern',
          location: file.path,
          ruleId: 'SEC-001'
        });
      }
    }

    return issues;
  }

  private checkCodeSmells(file: FileChange): GateIssue[] {
    const issues: GateIssue[] = [];
    if (!file.content) return issues;

    // Check for console.log (should use proper logging)
    if (/console\.(log|warn|error)\(/g.test(file.content)) {
      issues.push({
        severity: 'low',
        message: 'Console statements found',
        recommendation: 'Use proper logging service instead',
        location: file.path,
        ruleId: 'CODE-004',
        autoFixable: true
      });
    }

    // Check for TODO/FIXME
    const todoCount = (file.content.match(/\/\/\s*(TODO|FIXME|HACK)/gi) || []).length;
    if (todoCount > 3) {
      issues.push({
        severity: 'info',
        message: `${todoCount} TODO/FIXME comments found`,
        recommendation: 'Consider addressing before merge',
        location: file.path,
        ruleId: 'CODE-005'
      });
    }

    // Check for any type usage
    const anyCount = (file.content.match(/:\s*any\b/g) || []).length;
    if (anyCount > 5) {
      issues.push({
        severity: 'medium',
        message: `${anyCount} uses of 'any' type`,
        recommendation: 'Add proper TypeScript types',
        location: file.path,
        ruleId: 'CODE-006'
      });
    }

    return issues;
  }

  private checkPerformancePatterns(file: FileChange): GateIssue[] {
    const issues: GateIssue[] = [];
    if (!file.content) return issues;

    // Check for N+1 query patterns
    if (/for\s*\([^)]+\)\s*\{[^}]*await\s+.*query/gs.test(file.content)) {
      issues.push({
        severity: 'high',
        message: 'Potential N+1 query pattern detected',
        recommendation: 'Consider batching queries or using JOIN',
        location: file.path,
        ruleId: 'PERF-001'
      });
    }

    // Check for synchronous file operations
    if (/fs\.(readFileSync|writeFileSync|existsSync)/g.test(file.content)) {
      issues.push({
        severity: 'medium',
        message: 'Synchronous file operation detected',
        recommendation: 'Use async file operations',
        location: file.path,
        ruleId: 'PERF-002'
      });
    }

    return issues;
  }

  private isHeavyDependency(dep: string): boolean {
    const heavyDeps = ['moment', 'lodash', 'jquery', 'rxjs', 'bluebird'];
    return heavyDeps.some(h => dep.toLowerCase().includes(h));
  }

  private hashContent(content: ContentToReview): string {
    const str = JSON.stringify(content.files?.map(f => f.path).sort() || []);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return hash.toString(16);
  }

  private async persistResult(result: GateRunResult): Promise<void> {
    if (!this.pool) return;

    try {
      await this.pool.query(`
        INSERT INTO quality_gate_runs (
          run_id, content_hash, started_at, completed_at,
          overall_passed, overall_score, stages, blocking_issues
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        result.runId,
        result.contentHash,
        result.startedAt,
        result.completedAt,
        result.overallPassed,
        result.overallScore,
        JSON.stringify(result.stages),
        JSON.stringify(result.blockingIssues)
      ]);
    } catch (error) {
      console.error('Failed to persist quality gate result:', error);
    }
  }

  // ============================================
  // QUERY METHODS
  // ============================================

  /**
   * Get history of gate runs
   */
  async getHistory(limit: number = 20): Promise<GateRunResult[]> {
    if (!this.pool) return [];

    const result = await this.pool.query(`
      SELECT * FROM quality_gate_runs
      ORDER BY completed_at DESC
      LIMIT $1
    `, [limit]);

    return result.rows.map(row => ({
      runId: row.run_id,
      contentHash: row.content_hash,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      overallPassed: row.overall_passed,
      overallScore: row.overall_score,
      stages: row.stages,
      blockingIssues: row.blocking_issues
    }));
  }

  /**
   * Get pass rate statistics
   */
  async getStats(days: number = 7): Promise<{
    totalRuns: number;
    passRate: number;
    avgScore: number;
    stageStats: Record<Stage, { passRate: number; avgScore: number }>;
  }> {
    if (!this.pool) {
      return {
        totalRuns: 0,
        passRate: 0,
        avgScore: 0,
        stageStats: {} as Record<Stage, { passRate: number; avgScore: number }>
      };
    }

    const result = await this.pool.query(`
      SELECT 
        COUNT(*)::int as total_runs,
        AVG(CASE WHEN overall_passed THEN 1 ELSE 0 END) * 100 as pass_rate,
        AVG(overall_score) as avg_score
      FROM quality_gate_runs
      WHERE completed_at > NOW() - INTERVAL '1 day' * $1
    `, [days]);

    const stageResult = await this.pool.query(`
      SELECT 
        stage->>'stage' as stage_name,
        AVG(CASE WHEN (stage->>'passed')::boolean THEN 1 ELSE 0 END) * 100 as pass_rate,
        AVG((stage->>'score')::numeric) as avg_score
      FROM quality_gate_runs, jsonb_array_elements(stages) as stage
      WHERE completed_at > NOW() - INTERVAL '1 day' * $1
      GROUP BY stage->>'stage'
    `, [days]);

    const stageStats: Record<string, { passRate: number; avgScore: number }> = {};
    stageResult.rows.forEach(row => {
      stageStats[row.stage_name] = {
        passRate: Math.round(row.pass_rate || 0),
        avgScore: Math.round(row.avg_score || 0)
      };
    });

    return {
      totalRuns: result.rows[0]?.total_runs || 0,
      passRate: Math.round(result.rows[0]?.pass_rate || 0),
      avgScore: Math.round(result.rows[0]?.avg_score || 0),
      stageStats: stageStats as Record<Stage, { passRate: number; avgScore: number }>
    };
  }
}
