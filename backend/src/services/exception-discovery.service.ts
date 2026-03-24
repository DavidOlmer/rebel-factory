/**
 * REBEL AI FACTORY - EXCEPTION DISCOVERY SERVICE
 * 
 * Deep Industry Research Agents (DIRAs) ontdekken dat 70%+ van exceptions
 * bekende, harmless patterns zijn. Deze service analyseert, clustert en
 * auto-resolvet exception patterns.
 * 
 * KB Concept: DIRAs - Exception Pattern Discovery
 * - Cluster similar errors to find recurring patterns
 * - Classify patterns as harmless vs critical
 * - Auto-resolve harmless patterns without human intervention
 * - Liberate capacity by eliminating repetitive exception handling
 */

import { pool, query, queryOne, transaction } from '../db/client';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// TYPES
// ============================================

export interface ExceptionPattern {
  id: string;
  tenantId?: string;
  pattern: string;           // Regex or string pattern
  patternType: 'exact' | 'regex' | 'fuzzy';
  category: ExceptionCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  frequency: number;         // How often this occurs per day
  isHarmless: boolean;       // Can be auto-resolved
  autoResolution?: string;   // How to auto-fix (JSON action config)
  autoResolutionType?: 'retry' | 'ignore' | 'escalate' | 'notify' | 'custom';
  firstSeen: Date;
  lastSeen: Date;
  occurrences: number;
  exampleErrors: string[];   // Sample error messages
  affectedAgents: string[];  // Agent IDs that hit this pattern
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type ExceptionCategory =
  | 'rate_limit'
  | 'timeout'
  | 'auth_expired'
  | 'auth_invalid'
  | 'input_validation'
  | 'resource_not_found'
  | 'resource_conflict'
  | 'external_service'
  | 'network_error'
  | 'context_overflow'
  | 'model_error'
  | 'permission_denied'
  | 'quota_exceeded'
  | 'temporary_failure'
  | 'unknown';

export interface ErrorRecord {
  id: string;
  message: string;
  code?: string;
  agentId: string;
  tenantId?: string;
  runId?: string;
  timestamp: Date;
  stackTrace?: string;
  httpStatus?: number;
  metadata?: Record<string, unknown>;
}

export interface ExceptionCluster {
  normalizedPattern: string;
  errors: ErrorRecord[];
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  agentIds: Set<string>;
}

export interface PatternMatch {
  isHarmless: boolean;
  pattern?: ExceptionPattern;
  autoResolution?: string;
  confidence: number;
}

export interface ExceptionInsights {
  totalExceptions: number;
  harmlessPercentage: number;
  criticalCount: number;
  topPatterns: ExceptionPattern[];
  capacityLiberated: string;
  recommendations: string[];
  trendAnalysis: {
    increasingPatterns: ExceptionPattern[];
    decreasingPatterns: ExceptionPattern[];
    newPatterns: ExceptionPattern[];
  };
  categoryBreakdown: Record<ExceptionCategory, number>;
}

export interface AutoResolutionResult {
  success: boolean;
  action: string;
  runId: string;
  patternId?: string;
  details?: string;
}

// ============================================
// CATEGORY CLASSIFICATION RULES
// ============================================

const CATEGORY_RULES: Array<{
  category: ExceptionCategory;
  patterns: RegExp[];
  isHarmless: boolean;
  defaultResolution: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}> = [
  {
    category: 'rate_limit',
    patterns: [
      /rate limit/i,
      /too many requests/i,
      /429/i,
      /throttl/i,
      /quota exceeded.*per.*minute/i,
    ],
    isHarmless: true,
    defaultResolution: JSON.stringify({ type: 'retry', delayMs: 60000, maxRetries: 3 }),
    severity: 'low',
  },
  {
    category: 'timeout',
    patterns: [
      /timeout/i,
      /timed out/i,
      /ETIMEDOUT/i,
      /request took too long/i,
      /gateway timeout/i,
      /504/i,
    ],
    isHarmless: true,
    defaultResolution: JSON.stringify({ type: 'retry', delayMs: 5000, maxRetries: 2 }),
    severity: 'low',
  },
  {
    category: 'auth_expired',
    patterns: [
      /token expired/i,
      /session expired/i,
      /refresh.*token/i,
      /401.*expired/i,
    ],
    isHarmless: true,
    defaultResolution: JSON.stringify({ type: 'custom', action: 'refresh_token' }),
    severity: 'medium',
  },
  {
    category: 'auth_invalid',
    patterns: [
      /invalid.*token/i,
      /unauthorized/i,
      /401/i,
      /authentication failed/i,
      /invalid credentials/i,
    ],
    isHarmless: false,
    defaultResolution: JSON.stringify({ type: 'escalate', notify: 'security' }),
    severity: 'high',
  },
  {
    category: 'input_validation',
    patterns: [
      /invalid input/i,
      /validation.*failed/i,
      /missing.*required/i,
      /bad request/i,
      /400/i,
      /malformed/i,
    ],
    isHarmless: true,
    defaultResolution: JSON.stringify({ type: 'ignore', reason: 'user_input_error' }),
    severity: 'low',
  },
  {
    category: 'resource_not_found',
    patterns: [
      /not found/i,
      /404/i,
      /does not exist/i,
      /no such/i,
      /missing resource/i,
    ],
    isHarmless: true,
    defaultResolution: JSON.stringify({ type: 'ignore', reason: 'resource_deleted' }),
    severity: 'low',
  },
  {
    category: 'context_overflow',
    patterns: [
      /context.*too long/i,
      /token limit/i,
      /maximum.*tokens/i,
      /context.*overflow/i,
      /input too large/i,
    ],
    isHarmless: false,
    defaultResolution: JSON.stringify({ type: 'custom', action: 'truncate_context' }),
    severity: 'medium',
  },
  {
    category: 'model_error',
    patterns: [
      /model.*error/i,
      /inference failed/i,
      /completion failed/i,
      /anthropic.*error/i,
      /openai.*error/i,
    ],
    isHarmless: false,
    defaultResolution: JSON.stringify({ type: 'escalate', notify: 'engineering' }),
    severity: 'high',
  },
  {
    category: 'temporary_failure',
    patterns: [
      /temporary/i,
      /try again/i,
      /503/i,
      /service unavailable/i,
      /overloaded/i,
    ],
    isHarmless: true,
    defaultResolution: JSON.stringify({ type: 'retry', delayMs: 30000, maxRetries: 5 }),
    severity: 'low',
  },
  {
    category: 'network_error',
    patterns: [
      /ECONNREFUSED/i,
      /ECONNRESET/i,
      /ENOTFOUND/i,
      /network error/i,
      /connection refused/i,
      /dns.*fail/i,
    ],
    isHarmless: true,
    defaultResolution: JSON.stringify({ type: 'retry', delayMs: 10000, maxRetries: 3 }),
    severity: 'medium',
  },
  {
    category: 'quota_exceeded',
    patterns: [
      /quota.*exceeded/i,
      /limit.*reached/i,
      /billing/i,
      /credits.*exhausted/i,
    ],
    isHarmless: false,
    defaultResolution: JSON.stringify({ type: 'escalate', notify: 'admin' }),
    severity: 'critical',
  },
  {
    category: 'external_service',
    patterns: [
      /external.*service/i,
      /third.*party/i,
      /upstream/i,
      /502/i,
      /bad gateway/i,
    ],
    isHarmless: true,
    defaultResolution: JSON.stringify({ type: 'retry', delayMs: 15000, maxRetries: 2 }),
    severity: 'medium',
  },
];

// ============================================
// EXCEPTION DISCOVERY SERVICE
// ============================================

export class ExceptionDiscoveryService {
  private patternCache: Map<string, ExceptionPattern[]> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate: number = 0;

  // ============================================
  // PATTERN DISCOVERY
  // ============================================

  /**
   * Analyze exceptions and discover patterns
   * Main entry point for DIRA pattern discovery
   */
  async discoverPatterns(tenantId?: string): Promise<ExceptionPattern[]> {
    // Get all failed runs from the last 30 days
    const failures = await this.getFailedRuns(tenantId);
    
    if (failures.length === 0) {
      return [];
    }

    // Extract error records
    const errors: ErrorRecord[] = failures.map(f => ({
      id: f.id,
      message: f.error_message || 'Unknown error',
      code: f.error_code,
      agentId: f.agent_id,
      tenantId: f.tenant_id,
      runId: f.id,
      timestamp: new Date(f.created_at),
      httpStatus: f.http_status,
      metadata: f.metadata,
    }));

    // Cluster similar errors
    const clusters = this.clusterErrors(errors);

    // Classify each cluster into a pattern
    const patterns: ExceptionPattern[] = [];
    for (const cluster of clusters) {
      const pattern = await this.classifyCluster(cluster, tenantId);
      patterns.push(pattern);
    }

    // Store patterns for future auto-resolution
    await this.storePatterns(patterns);

    // Update cache
    const cacheKey = tenantId || 'global';
    this.patternCache.set(cacheKey, patterns);
    this.lastCacheUpdate = Date.now();

    return patterns;
  }

  /**
   * Cluster similar errors together using normalized patterns
   */
  private clusterErrors(errors: ErrorRecord[]): ExceptionCluster[] {
    const clusterMap: Map<string, ExceptionCluster> = new Map();

    for (const error of errors) {
      const normalizedKey = this.normalizeError(error.message);
      
      if (!clusterMap.has(normalizedKey)) {
        clusterMap.set(normalizedKey, {
          normalizedPattern: normalizedKey,
          errors: [],
          count: 0,
          firstSeen: error.timestamp,
          lastSeen: error.timestamp,
          agentIds: new Set(),
        });
      }

      const cluster = clusterMap.get(normalizedKey)!;
      cluster.errors.push(error);
      cluster.count++;
      cluster.agentIds.add(error.agentId);
      
      if (error.timestamp < cluster.firstSeen) {
        cluster.firstSeen = error.timestamp;
      }
      if (error.timestamp > cluster.lastSeen) {
        cluster.lastSeen = error.timestamp;
      }
    }

    // Only return clusters with 2+ occurrences (patterns, not one-offs)
    return Array.from(clusterMap.values())
      .filter(c => c.count >= 2)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Normalize an error message by removing variable parts
   * This allows grouping similar errors together
   */
  private normalizeError(message: string): string {
    if (!message) return 'empty_error';
    
    return message
      // UUIDs
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{UUID}')
      // ISO timestamps
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '{TIMESTAMP}')
      // Unix timestamps (13 digits for ms, 10 for seconds)
      .replace(/\b\d{10,13}\b/g, '{EPOCH}')
      // IP addresses
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '{IP}')
      // File paths
      .replace(/\/[\w\-\.\/]+\.(ts|js|json|md)/g, '{PATH}')
      // Numbers
      .replace(/\b\d+\b/g, '{N}')
      // Email addresses
      .replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '{EMAIL}')
      // URLs
      .replace(/https?:\/\/[^\s]+/g, '{URL}')
      // Lowercase for consistency
      .toLowerCase()
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Classify a cluster into an exception pattern with category and resolution
   */
  private async classifyCluster(
    cluster: ExceptionCluster,
    tenantId?: string
  ): Promise<ExceptionPattern> {
    // Check existing patterns first
    const existingPattern = await this.findMatchingStoredPattern(
      cluster.errors[0].message
    );
    
    if (existingPattern) {
      // Update existing pattern
      return this.updateExistingPattern(existingPattern, cluster);
    }

    // Classify based on rules
    const classification = this.classifyByRules(cluster.errors[0].message);
    
    // Generate regex pattern from normalized key
    const regexPattern = this.generateRegexFromNormalized(cluster.normalizedPattern);

    const pattern: ExceptionPattern = {
      id: uuidv4(),
      tenantId,
      pattern: regexPattern,
      patternType: 'regex',
      category: classification.category,
      severity: classification.severity,
      frequency: this.calculateFrequency(cluster),
      isHarmless: classification.isHarmless,
      autoResolution: classification.defaultResolution,
      autoResolutionType: this.extractResolutionType(classification.defaultResolution),
      firstSeen: cluster.firstSeen,
      lastSeen: cluster.lastSeen,
      occurrences: cluster.count,
      exampleErrors: cluster.errors.slice(0, 5).map(e => e.message),
      affectedAgents: Array.from(cluster.agentIds),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return pattern;
  }

  /**
   * Classify error message using predefined rules
   */
  private classifyByRules(message: string): {
    category: ExceptionCategory;
    isHarmless: boolean;
    defaultResolution: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  } {
    for (const rule of CATEGORY_RULES) {
      for (const pattern of rule.patterns) {
        if (pattern.test(message)) {
          return {
            category: rule.category,
            isHarmless: rule.isHarmless,
            defaultResolution: rule.defaultResolution,
            severity: rule.severity,
          };
        }
      }
    }

    // Default: unknown category, not harmless
    return {
      category: 'unknown',
      isHarmless: false,
      defaultResolution: JSON.stringify({ type: 'escalate', notify: 'engineering' }),
      severity: 'medium',
    };
  }

  /**
   * Generate a regex pattern from a normalized error key
   */
  private generateRegexFromNormalized(normalized: string): string {
    // Escape special regex characters
    let regex = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Replace placeholders with regex patterns
    regex = regex
      .replace(/\{uuid\}/gi, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
      .replace(/\{timestamp\}/gi, '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}')
      .replace(/\{epoch\}/gi, '\\d{10,13}')
      .replace(/\{ip\}/gi, '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}')
      .replace(/\{path\}/gi, '/[\\w\\-\\./]+\\.(ts|js|json|md)')
      .replace(/\{n\}/gi, '\\d+')
      .replace(/\{email\}/gi, '[\\w\\.-]+@[\\w\\.-]+\\.\\w+')
      .replace(/\{url\}/gi, 'https?://[^\\s]+');

    return regex;
  }

  /**
   * Calculate frequency (occurrences per day)
   */
  private calculateFrequency(cluster: ExceptionCluster): number {
    const daysDiff = Math.max(
      1,
      (cluster.lastSeen.getTime() - cluster.firstSeen.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.round((cluster.count / daysDiff) * 100) / 100;
  }

  /**
   * Extract resolution type from JSON config
   */
  private extractResolutionType(
    resolution: string
  ): 'retry' | 'ignore' | 'escalate' | 'notify' | 'custom' {
    try {
      const config = JSON.parse(resolution);
      return config.type || 'escalate';
    } catch {
      return 'escalate';
    }
  }

  /**
   * Update an existing pattern with new cluster data
   */
  private updateExistingPattern(
    existing: ExceptionPattern,
    cluster: ExceptionCluster
  ): ExceptionPattern {
    return {
      ...existing,
      lastSeen: cluster.lastSeen > existing.lastSeen ? cluster.lastSeen : existing.lastSeen,
      occurrences: existing.occurrences + cluster.count,
      frequency: this.calculateFrequency({
        ...cluster,
        count: existing.occurrences + cluster.count,
        firstSeen: existing.firstSeen < cluster.firstSeen ? existing.firstSeen : cluster.firstSeen,
      }),
      affectedAgents: [...new Set([...existing.affectedAgents, ...cluster.agentIds])],
      updatedAt: new Date(),
    };
  }

  // ============================================
  // PATTERN MATCHING & AUTO-RESOLUTION
  // ============================================

  /**
   * Check if an error matches a known harmless pattern
   */
  async isHarmlessPattern(error: string, tenantId?: string): Promise<PatternMatch> {
    const patterns = await this.getStoredPatterns(tenantId);

    for (const pattern of patterns) {
      const match = this.matchesPattern(error, pattern);
      if (match.matches) {
        return {
          isHarmless: pattern.isHarmless,
          pattern,
          autoResolution: pattern.autoResolution,
          confidence: match.confidence,
        };
      }
    }

    return { isHarmless: false, confidence: 0 };
  }

  /**
   * Check if an error matches a specific pattern
   */
  private matchesPattern(
    error: string,
    pattern: ExceptionPattern
  ): { matches: boolean; confidence: number } {
    try {
      if (pattern.patternType === 'exact') {
        const matches = error.toLowerCase() === pattern.pattern.toLowerCase();
        return { matches, confidence: matches ? 1.0 : 0 };
      }

      if (pattern.patternType === 'regex') {
        const regex = new RegExp(pattern.pattern, 'i');
        const matches = regex.test(error);
        return { matches, confidence: matches ? 0.9 : 0 };
      }

      // Fuzzy matching using normalized comparison
      const normalizedError = this.normalizeError(error);
      const normalizedPattern = this.normalizeError(pattern.exampleErrors[0] || '');
      const similarity = this.calculateSimilarity(normalizedError, normalizedPattern);
      
      return {
        matches: similarity > 0.8,
        confidence: similarity,
      };
    } catch {
      return { matches: false, confidence: 0 };
    }
  }

  /**
   * Simple Jaccard similarity for fuzzy matching
   */
  private calculateSimilarity(a: string, b: string): number {
    const setA = new Set(a.split(' '));
    const setB = new Set(b.split(' '));
    
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    
    return intersection.size / union.size;
  }

  /**
   * Auto-resolve a failed run if it matches a harmless pattern
   */
  async autoResolve(runId: string): Promise<AutoResolutionResult> {
    const run = await this.getRun(runId);
    
    if (!run || !run.error_message) {
      return {
        success: false,
        action: 'none',
        runId,
        details: 'No error message found',
      };
    }

    const { isHarmless, pattern, autoResolution } = await this.isHarmlessPattern(
      run.error_message,
      run.tenant_id
    );

    if (!isHarmless || !autoResolution) {
      return {
        success: false,
        action: 'escalate',
        runId,
        details: 'Pattern not harmless or no auto-resolution configured',
      };
    }

    // Apply auto-resolution
    const resolution = await this.applyResolution(runId, autoResolution, run);

    // Log the auto-resolution
    await this.logAutoResolution(runId, pattern?.id, autoResolution, resolution);

    return {
      success: resolution.success,
      action: resolution.action,
      runId,
      patternId: pattern?.id,
      details: resolution.details,
    };
  }

  /**
   * Apply a resolution action to a failed run
   */
  private async applyResolution(
    runId: string,
    autoResolution: string,
    run: any
  ): Promise<{ success: boolean; action: string; details: string }> {
    try {
      const config = JSON.parse(autoResolution);

      switch (config.type) {
        case 'retry':
          // Mark for retry with delay
          await query(
            `UPDATE agent_runs 
             SET status = 'pending_retry',
                 metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                 updated_at = NOW()
             WHERE id = $1`,
            [
              runId,
              JSON.stringify({
                retryConfig: {
                  delayMs: config.delayMs || 5000,
                  maxRetries: config.maxRetries || 3,
                  scheduledAt: new Date(Date.now() + (config.delayMs || 5000)),
                },
              }),
            ]
          );
          return {
            success: true,
            action: 'retry',
            details: `Scheduled retry in ${config.delayMs}ms`,
          };

        case 'ignore':
          // Mark as resolved (ignored)
          await query(
            `UPDATE agent_runs 
             SET status = 'resolved_auto',
                 metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                 updated_at = NOW()
             WHERE id = $1`,
            [
              runId,
              JSON.stringify({
                autoResolved: true,
                resolution: 'ignored',
                reason: config.reason || 'harmless_pattern',
              }),
            ]
          );
          return {
            success: true,
            action: 'ignore',
            details: `Resolved as ignorable: ${config.reason}`,
          };

        case 'escalate':
          // Create escalation record
          await query(
            `INSERT INTO exception_escalations (run_id, pattern_id, notify_target, status, created_at)
             VALUES ($1, $2, $3, 'pending', NOW())
             ON CONFLICT DO NOTHING`,
            [runId, run.pattern_id, config.notify || 'engineering']
          );
          return {
            success: true,
            action: 'escalate',
            details: `Escalated to ${config.notify}`,
          };

        case 'notify':
          // Log notification (actual notification handled elsewhere)
          return {
            success: true,
            action: 'notify',
            details: `Notification queued for ${config.channel}`,
          };

        case 'custom':
          // Custom actions would be handled by specific handlers
          return {
            success: true,
            action: `custom:${config.action}`,
            details: `Custom action ${config.action} triggered`,
          };

        default:
          return {
            success: false,
            action: 'unknown',
            details: `Unknown resolution type: ${config.type}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        action: 'error',
        details: `Failed to apply resolution: ${error}`,
      };
    }
  }

  /**
   * Log an auto-resolution for audit trail
   */
  private async logAutoResolution(
    runId: string,
    patternId: string | undefined,
    resolution: string,
    result: { success: boolean; action: string; details: string }
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO exception_resolution_log 
         (run_id, pattern_id, resolution_config, action_taken, success, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          runId,
          patternId,
          resolution,
          result.action,
          result.success,
          result.details,
        ]
      );
    } catch (error) {
      console.error('Failed to log auto-resolution:', error);
    }
  }

  // ============================================
  // INSIGHTS & ANALYTICS
  // ============================================

  /**
   * Get comprehensive exception insights (DIRA style)
   */
  async getInsights(tenantId?: string): Promise<ExceptionInsights> {
    const patterns = await this.discoverPatterns(tenantId);
    
    if (patterns.length === 0) {
      return {
        totalExceptions: 0,
        harmlessPercentage: 0,
        criticalCount: 0,
        topPatterns: [],
        capacityLiberated: '0% - no exceptions analyzed',
        recommendations: ['No exception data available for analysis'],
        trendAnalysis: {
          increasingPatterns: [],
          decreasingPatterns: [],
          newPatterns: [],
        },
        categoryBreakdown: this.initCategoryBreakdown(),
      };
    }

    const harmlessPatterns = patterns.filter(p => p.isHarmless);
    const criticalPatterns = patterns.filter(p => p.severity === 'critical');

    const totalOccurrences = patterns.reduce((sum, p) => sum + p.occurrences, 0);
    const harmlessOccurrences = harmlessPatterns.reduce((sum, p) => sum + p.occurrences, 0);
    const criticalOccurrences = criticalPatterns.reduce((sum, p) => sum + p.occurrences, 0);

    const harmlessPercentage = Math.round((harmlessOccurrences / totalOccurrences) * 100);

    // Trend analysis (last 7 days vs previous 7 days)
    const trendAnalysis = await this.analyzeTrends(patterns);

    // Category breakdown
    const categoryBreakdown = this.calculateCategoryBreakdown(patterns);

    return {
      totalExceptions: totalOccurrences,
      harmlessPercentage,
      criticalCount: criticalOccurrences,
      topPatterns: patterns.slice(0, 10),
      capacityLiberated: this.formatCapacityLiberated(harmlessPercentage),
      recommendations: this.generateRecommendations(patterns, harmlessPercentage),
      trendAnalysis,
      categoryBreakdown,
    };
  }

  /**
   * Format capacity liberated message
   */
  private formatCapacityLiberated(harmlessPercentage: number): string {
    if (harmlessPercentage >= 70) {
      return `${harmlessPercentage}% of exception handling can be automated - DIRA validated! 🎯`;
    } else if (harmlessPercentage >= 50) {
      return `${harmlessPercentage}% of exception handling can be automated - good progress`;
    } else if (harmlessPercentage >= 25) {
      return `${harmlessPercentage}% automatable - more pattern discovery needed`;
    }
    return `${harmlessPercentage}% automatable - focus on reducing critical exceptions`;
  }

  /**
   * Analyze trends in exception patterns
   */
  private async analyzeTrends(patterns: ExceptionPattern[]): Promise<{
    increasingPatterns: ExceptionPattern[];
    decreasingPatterns: ExceptionPattern[];
    newPatterns: ExceptionPattern[];
  }> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Get historical data for comparison
    const recentCounts = await this.getPatternCounts(sevenDaysAgo, now);
    const previousCounts = await this.getPatternCounts(fourteenDaysAgo, sevenDaysAgo);

    const increasing: ExceptionPattern[] = [];
    const decreasing: ExceptionPattern[] = [];
    const newPatterns: ExceptionPattern[] = [];

    for (const pattern of patterns) {
      const recent = recentCounts.get(pattern.id) || 0;
      const previous = previousCounts.get(pattern.id) || 0;

      if (previous === 0 && recent > 0) {
        newPatterns.push(pattern);
      } else if (recent > previous * 1.5) {
        increasing.push(pattern);
      } else if (recent < previous * 0.5) {
        decreasing.push(pattern);
      }
    }

    return {
      increasingPatterns: increasing.slice(0, 5),
      decreasingPatterns: decreasing.slice(0, 5),
      newPatterns: newPatterns.slice(0, 5),
    };
  }

  /**
   * Get pattern counts for a time range
   */
  private async getPatternCounts(
    start: Date,
    end: Date
  ): Promise<Map<string, number>> {
    const result = await query<{ pattern_id: string; count: string }>(
      `SELECT pattern_id, COUNT(*) as count
       FROM exception_resolution_log
       WHERE created_at BETWEEN $1 AND $2
       GROUP BY pattern_id`,
      [start, end]
    );

    const counts = new Map<string, number>();
    for (const row of result) {
      counts.set(row.pattern_id, parseInt(row.count, 10));
    }
    return counts;
  }

  /**
   * Initialize empty category breakdown
   */
  private initCategoryBreakdown(): Record<ExceptionCategory, number> {
    return {
      rate_limit: 0,
      timeout: 0,
      auth_expired: 0,
      auth_invalid: 0,
      input_validation: 0,
      resource_not_found: 0,
      resource_conflict: 0,
      external_service: 0,
      network_error: 0,
      context_overflow: 0,
      model_error: 0,
      permission_denied: 0,
      quota_exceeded: 0,
      temporary_failure: 0,
      unknown: 0,
    };
  }

  /**
   * Calculate category breakdown from patterns
   */
  private calculateCategoryBreakdown(
    patterns: ExceptionPattern[]
  ): Record<ExceptionCategory, number> {
    const breakdown = this.initCategoryBreakdown();
    
    for (const pattern of patterns) {
      breakdown[pattern.category] += pattern.occurrences;
    }
    
    return breakdown;
  }

  /**
   * Generate recommendations based on pattern analysis
   */
  private generateRecommendations(
    patterns: ExceptionPattern[],
    harmlessPercentage: number
  ): string[] {
    const recommendations: string[] = [];

    // High-level recommendations
    if (harmlessPercentage >= 70) {
      recommendations.push(
        '✅ DIRA hypothesis validated: 70%+ exceptions are automatable'
      );
    }

    // Category-specific recommendations
    const rateLimitPatterns = patterns.filter(p => p.category === 'rate_limit');
    if (rateLimitPatterns.length > 0) {
      const totalRateLimits = rateLimitPatterns.reduce((s, p) => s + p.occurrences, 0);
      if (totalRateLimits > 100) {
        recommendations.push(
          `⚠️ High rate limit errors (${totalRateLimits}): Consider implementing request queuing or upgrading API limits`
        );
      }
    }

    const timeoutPatterns = patterns.filter(p => p.category === 'timeout');
    if (timeoutPatterns.length > 0) {
      recommendations.push(
        '💡 Timeout patterns detected: Review long-running operations and consider async processing'
      );
    }

    const authPatterns = patterns.filter(p => p.category === 'auth_expired');
    if (authPatterns.length > 0) {
      recommendations.push(
        '🔑 Auth expiry patterns found: Implement proactive token refresh before expiry'
      );
    }

    const criticalPatterns = patterns.filter(p => p.severity === 'critical');
    if (criticalPatterns.length > 0) {
      recommendations.push(
        `🚨 ${criticalPatterns.length} critical patterns need immediate attention`
      );
    }

    const unknownPatterns = patterns.filter(p => p.category === 'unknown');
    if (unknownPatterns.length > 0) {
      recommendations.push(
        `🔍 ${unknownPatterns.length} unclassified patterns: Review and add to classification rules`
      );
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('No specific recommendations - exception handling is healthy');
    }

    return recommendations;
  }

  // ============================================
  // DATABASE OPERATIONS
  // ============================================

  /**
   * Get failed runs from the database
   */
  private async getFailedRuns(tenantId?: string): Promise<any[]> {
    let queryText = `
      SELECT 
        id, agent_id, tenant_id, status, 
        error_message, error_code, http_status,
        metadata, created_at, updated_at
      FROM agent_runs
      WHERE status IN ('failed', 'error')
        AND created_at > NOW() - INTERVAL '30 days'
    `;
    const params: unknown[] = [];

    if (tenantId) {
      params.push(tenantId);
      queryText += ` AND tenant_id = $${params.length}`;
    }

    queryText += ' ORDER BY created_at DESC LIMIT 10000';

    return query(queryText, params);
  }

  /**
   * Get a single run by ID
   */
  private async getRun(runId: string): Promise<any | null> {
    return queryOne(
      `SELECT * FROM agent_runs WHERE id = $1`,
      [runId]
    );
  }

  /**
   * Find an existing stored pattern that matches an error
   */
  private async findMatchingStoredPattern(
    error: string
  ): Promise<ExceptionPattern | null> {
    const patterns = await query<any>(
      `SELECT * FROM exception_patterns WHERE is_active = true ORDER BY occurrences DESC`
    );

    for (const row of patterns) {
      const pattern = this.rowToPattern(row);
      const match = this.matchesPattern(error, pattern);
      if (match.matches && match.confidence > 0.8) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Get all stored patterns
   */
  async getStoredPatterns(tenantId?: string): Promise<ExceptionPattern[]> {
    // Check cache first
    const cacheKey = tenantId || 'global';
    if (
      this.patternCache.has(cacheKey) &&
      Date.now() - this.lastCacheUpdate < this.cacheExpiry
    ) {
      return this.patternCache.get(cacheKey)!;
    }

    let queryText = `
      SELECT * FROM exception_patterns 
      WHERE is_active = true
    `;
    const params: unknown[] = [];

    if (tenantId) {
      params.push(tenantId);
      queryText += ` AND (tenant_id = $${params.length} OR tenant_id IS NULL)`;
    }

    queryText += ' ORDER BY occurrences DESC';

    const rows = await query<any>(queryText, params);
    const patterns = rows.map(row => this.rowToPattern(row));

    // Update cache
    this.patternCache.set(cacheKey, patterns);
    this.lastCacheUpdate = Date.now();

    return patterns;
  }

  /**
   * Store discovered patterns in the database
   */
  private async storePatterns(patterns: ExceptionPattern[]): Promise<void> {
    for (const pattern of patterns) {
      await query(
        `INSERT INTO exception_patterns (
          id, tenant_id, pattern, pattern_type, category, severity,
          frequency, is_harmless, auto_resolution, auto_resolution_type,
          first_seen, last_seen, occurrences, example_errors, affected_agents,
          metadata, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          frequency = EXCLUDED.frequency,
          last_seen = EXCLUDED.last_seen,
          occurrences = EXCLUDED.occurrences,
          affected_agents = EXCLUDED.affected_agents,
          updated_at = NOW()`,
        [
          pattern.id,
          pattern.tenantId,
          pattern.pattern,
          pattern.patternType,
          pattern.category,
          pattern.severity,
          pattern.frequency,
          pattern.isHarmless,
          pattern.autoResolution,
          pattern.autoResolutionType,
          pattern.firstSeen,
          pattern.lastSeen,
          pattern.occurrences,
          JSON.stringify(pattern.exampleErrors),
          JSON.stringify(pattern.affectedAgents),
          pattern.metadata ? JSON.stringify(pattern.metadata) : null,
        ]
      );
    }
  }

  /**
   * Convert a database row to an ExceptionPattern
   */
  private rowToPattern(row: any): ExceptionPattern {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      pattern: row.pattern,
      patternType: row.pattern_type,
      category: row.category,
      severity: row.severity,
      frequency: parseFloat(row.frequency),
      isHarmless: row.is_harmless,
      autoResolution: row.auto_resolution,
      autoResolutionType: row.auto_resolution_type,
      firstSeen: new Date(row.first_seen),
      lastSeen: new Date(row.last_seen),
      occurrences: parseInt(row.occurrences, 10),
      exampleErrors: typeof row.example_errors === 'string' 
        ? JSON.parse(row.example_errors) 
        : row.example_errors || [],
      affectedAgents: typeof row.affected_agents === 'string'
        ? JSON.parse(row.affected_agents)
        : row.affected_agents || [],
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  // ============================================
  // PATTERN MANAGEMENT
  // ============================================

  /**
   * Update a pattern's classification
   */
  async updatePattern(
    patternId: string,
    updates: Partial<Pick<ExceptionPattern, 'category' | 'isHarmless' | 'autoResolution' | 'severity'>>
  ): Promise<ExceptionPattern | null> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];

    if (updates.category !== undefined) {
      params.push(updates.category);
      setClauses.push(`category = $${params.length}`);
    }
    if (updates.isHarmless !== undefined) {
      params.push(updates.isHarmless);
      setClauses.push(`is_harmless = $${params.length}`);
    }
    if (updates.autoResolution !== undefined) {
      params.push(updates.autoResolution);
      setClauses.push(`auto_resolution = $${params.length}`);
    }
    if (updates.severity !== undefined) {
      params.push(updates.severity);
      setClauses.push(`severity = $${params.length}`);
    }

    params.push(patternId);

    const result = await query<any>(
      `UPDATE exception_patterns 
       SET ${setClauses.join(', ')}
       WHERE id = $${params.length}
       RETURNING *`,
      params
    );

    // Clear cache
    this.patternCache.clear();

    return result[0] ? this.rowToPattern(result[0]) : null;
  }

  /**
   * Deactivate a pattern
   */
  async deactivatePattern(patternId: string): Promise<boolean> {
    const result = await query(
      `UPDATE exception_patterns SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [patternId]
    );
    
    this.patternCache.clear();
    return true;
  }

  /**
   * Get pattern statistics
   */
  async getPatternStats(): Promise<{
    totalPatterns: number;
    activePatterns: number;
    harmlessPatterns: number;
    totalAutoResolutions: number;
    successRate: number;
  }> {
    const [patternStats] = await query<any>(`
      SELECT 
        COUNT(*) as total_patterns,
        COUNT(*) FILTER (WHERE is_active = true) as active_patterns,
        COUNT(*) FILTER (WHERE is_harmless = true AND is_active = true) as harmless_patterns
      FROM exception_patterns
    `);

    const [resolutionStats] = await query<any>(`
      SELECT 
        COUNT(*) as total_resolutions,
        COUNT(*) FILTER (WHERE success = true) as successful_resolutions
      FROM exception_resolution_log
      WHERE created_at > NOW() - INTERVAL '30 days'
    `);

    const totalResolutions = parseInt(resolutionStats?.total_resolutions || '0', 10);
    const successfulResolutions = parseInt(resolutionStats?.successful_resolutions || '0', 10);

    return {
      totalPatterns: parseInt(patternStats?.total_patterns || '0', 10),
      activePatterns: parseInt(patternStats?.active_patterns || '0', 10),
      harmlessPatterns: parseInt(patternStats?.harmless_patterns || '0', 10),
      totalAutoResolutions: totalResolutions,
      successRate: totalResolutions > 0 
        ? Math.round((successfulResolutions / totalResolutions) * 100) 
        : 0,
    };
  }
}

// Export singleton instance
export const exceptionDiscoveryService = new ExceptionDiscoveryService();
