/**
 * REBEL AI FACTORY - EXCEPTION ROUTES
 * 
 * API endpoints for Exception Pattern Discovery (DIRA)
 * 
 * Endpoints:
 * - GET /api/exceptions/patterns - List discovered patterns
 * - GET /api/exceptions/patterns/:id - Get single pattern
 * - PATCH /api/exceptions/patterns/:id - Update pattern classification
 * - DELETE /api/exceptions/patterns/:id - Deactivate pattern
 * - GET /api/exceptions/insights - Get DIRA insights
 * - POST /api/exceptions/:id/resolve - Auto-resolve exception
 * - POST /api/exceptions/discover - Trigger pattern discovery
 * - GET /api/exceptions/stats - Get pattern statistics
 */

import { Router, Request, Response } from 'express';
import { 
  exceptionDiscoveryService, 
  ExceptionCategory,
  ExceptionPattern 
} from '../services/exception-discovery.service';
import { extractUser } from '../middleware/auth';

const router = Router();

// ============================================
// GET /api/exceptions/patterns - List discovered patterns
// ============================================
router.get('/patterns', extractUser, async (req: Request, res: Response) => {
  try {
    const { tenantId, category, isHarmless, severity, limit = '50', offset = '0' } = req.query;

    let patterns = await exceptionDiscoveryService.getStoredPatterns(
      tenantId as string | undefined
    );

    // Filter by category
    if (category) {
      patterns = patterns.filter(p => p.category === category);
    }

    // Filter by harmless status
    if (isHarmless !== undefined) {
      const harmless = isHarmless === 'true';
      patterns = patterns.filter(p => p.isHarmless === harmless);
    }

    // Filter by severity
    if (severity) {
      patterns = patterns.filter(p => p.severity === severity);
    }

    // Pagination
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offsetNum = parseInt(offset as string, 10);
    const total = patterns.length;
    patterns = patterns.slice(offsetNum, offsetNum + limitNum);

    res.json({
      patterns: patterns.map(formatPatternResponse),
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + patterns.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching patterns:', error);
    res.status(500).json({ 
      error: 'Failed to fetch exception patterns',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// GET /api/exceptions/patterns/:id - Get single pattern
// ============================================
router.get('/patterns/:id', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const patterns = await exceptionDiscoveryService.getStoredPatterns();
    const pattern = patterns.find(p => p.id === id);

    if (!pattern) {
      return res.status(404).json({ error: 'Pattern not found' });
    }

    res.json({ pattern: formatPatternResponse(pattern) });
  } catch (error) {
    console.error('Error fetching pattern:', error);
    res.status(500).json({ 
      error: 'Failed to fetch pattern',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// PATCH /api/exceptions/patterns/:id - Update pattern
// ============================================
router.patch('/patterns/:id', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { category, isHarmless, autoResolution, severity } = req.body;

    // Validate category if provided
    if (category && !isValidCategory(category)) {
      return res.status(400).json({ 
        error: 'Invalid category',
        validCategories: getValidCategories(),
      });
    }

    // Validate severity if provided
    if (severity && !['low', 'medium', 'high', 'critical'].includes(severity)) {
      return res.status(400).json({ 
        error: 'Invalid severity',
        validSeverities: ['low', 'medium', 'high', 'critical'],
      });
    }

    const updated = await exceptionDiscoveryService.updatePattern(id, {
      category,
      isHarmless,
      autoResolution,
      severity,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Pattern not found' });
    }

    res.json({ 
      pattern: formatPatternResponse(updated),
      message: 'Pattern updated successfully',
    });
  } catch (error) {
    console.error('Error updating pattern:', error);
    res.status(500).json({ 
      error: 'Failed to update pattern',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// DELETE /api/exceptions/patterns/:id - Deactivate pattern
// ============================================
router.delete('/patterns/:id', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const success = await exceptionDiscoveryService.deactivatePattern(id);

    if (!success) {
      return res.status(404).json({ error: 'Pattern not found' });
    }

    res.json({ 
      message: 'Pattern deactivated successfully',
      patternId: id,
    });
  } catch (error) {
    console.error('Error deactivating pattern:', error);
    res.status(500).json({ 
      error: 'Failed to deactivate pattern',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// GET /api/exceptions/insights - Get DIRA insights
// ============================================
router.get('/insights', extractUser, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;

    const insights = await exceptionDiscoveryService.getInsights(
      tenantId as string | undefined
    );

    res.json({
      insights: {
        ...insights,
        topPatterns: insights.topPatterns.map(formatPatternResponse),
        trendAnalysis: {
          increasingPatterns: insights.trendAnalysis.increasingPatterns.map(formatPatternResponse),
          decreasingPatterns: insights.trendAnalysis.decreasingPatterns.map(formatPatternResponse),
          newPatterns: insights.trendAnalysis.newPatterns.map(formatPatternResponse),
        },
      },
      dira: {
        hypothesis: '70%+ of exceptions are known, harmless patterns',
        validated: insights.harmlessPercentage >= 70,
        automationPotential: `${insights.harmlessPercentage}%`,
      },
    });
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ 
      error: 'Failed to fetch exception insights',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// POST /api/exceptions/:id/resolve - Auto-resolve exception
// ============================================
router.post('/:id/resolve', extractUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await exceptionDiscoveryService.autoResolve(id);

    if (!result.success) {
      return res.status(400).json({
        error: 'Auto-resolution failed',
        result,
      });
    }

    res.json({
      message: 'Exception auto-resolved successfully',
      result,
    });
  } catch (error) {
    console.error('Error auto-resolving exception:', error);
    res.status(500).json({ 
      error: 'Failed to auto-resolve exception',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// POST /api/exceptions/discover - Trigger pattern discovery
// ============================================
router.post('/discover', extractUser, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.body;

    const patterns = await exceptionDiscoveryService.discoverPatterns(tenantId);

    res.json({
      message: `Discovered ${patterns.length} exception patterns`,
      patternsDiscovered: patterns.length,
      patterns: patterns.slice(0, 20).map(formatPatternResponse),
      hasMore: patterns.length > 20,
    });
  } catch (error) {
    console.error('Error discovering patterns:', error);
    res.status(500).json({ 
      error: 'Failed to discover patterns',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// GET /api/exceptions/stats - Get pattern statistics
// ============================================
router.get('/stats', extractUser, async (req: Request, res: Response) => {
  try {
    const stats = await exceptionDiscoveryService.getPatternStats();

    res.json({
      stats,
      health: {
        status: stats.successRate >= 80 ? 'healthy' : stats.successRate >= 50 ? 'degraded' : 'unhealthy',
        autoResolutionEfficiency: `${stats.successRate}%`,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch pattern statistics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// POST /api/exceptions/check - Check if error is harmless
// ============================================
router.post('/check', extractUser, async (req: Request, res: Response) => {
  try {
    const { error, tenantId } = req.body;

    if (!error) {
      return res.status(400).json({ error: 'Error message is required' });
    }

    const result = await exceptionDiscoveryService.isHarmlessPattern(error, tenantId);

    res.json({
      error,
      ...result,
      pattern: result.pattern ? formatPatternResponse(result.pattern) : undefined,
    });
  } catch (error) {
    console.error('Error checking pattern:', error);
    res.status(500).json({ 
      error: 'Failed to check error pattern',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// HELPERS
// ============================================

function formatPatternResponse(pattern: ExceptionPattern) {
  return {
    id: pattern.id,
    tenantId: pattern.tenantId,
    pattern: pattern.pattern,
    patternType: pattern.patternType,
    category: pattern.category,
    categoryLabel: formatCategory(pattern.category),
    severity: pattern.severity,
    severityLabel: formatSeverity(pattern.severity),
    frequency: pattern.frequency,
    frequencyLabel: `${pattern.frequency}/day`,
    isHarmless: pattern.isHarmless,
    autoResolution: pattern.autoResolution,
    autoResolutionType: pattern.autoResolutionType,
    firstSeen: pattern.firstSeen.toISOString(),
    lastSeen: pattern.lastSeen.toISOString(),
    occurrences: pattern.occurrences,
    exampleErrors: pattern.exampleErrors,
    affectedAgents: pattern.affectedAgents,
    affectedAgentsCount: pattern.affectedAgents.length,
    metadata: pattern.metadata,
    createdAt: pattern.createdAt.toISOString(),
    updatedAt: pattern.updatedAt.toISOString(),
  };
}

function formatCategory(category: ExceptionCategory): string {
  const labels: Record<ExceptionCategory, string> = {
    rate_limit: '⏱️ Rate Limit',
    timeout: '⏰ Timeout',
    auth_expired: '🔑 Auth Expired',
    auth_invalid: '🚫 Auth Invalid',
    input_validation: '📝 Input Validation',
    resource_not_found: '🔍 Not Found',
    resource_conflict: '⚔️ Conflict',
    external_service: '🔗 External Service',
    network_error: '🌐 Network Error',
    context_overflow: '📚 Context Overflow',
    model_error: '🤖 Model Error',
    permission_denied: '🚷 Permission Denied',
    quota_exceeded: '📊 Quota Exceeded',
    temporary_failure: '⚡ Temporary Failure',
    unknown: '❓ Unknown',
  };
  return labels[category] || category;
}

function formatSeverity(severity: string): string {
  const labels: Record<string, string> = {
    low: '🟢 Low',
    medium: '🟡 Medium',
    high: '🟠 High',
    critical: '🔴 Critical',
  };
  return labels[severity] || severity;
}

function isValidCategory(category: string): category is ExceptionCategory {
  return getValidCategories().includes(category as ExceptionCategory);
}

function getValidCategories(): ExceptionCategory[] {
  return [
    'rate_limit',
    'timeout',
    'auth_expired',
    'auth_invalid',
    'input_validation',
    'resource_not_found',
    'resource_conflict',
    'external_service',
    'network_error',
    'context_overflow',
    'model_error',
    'permission_denied',
    'quota_exceeded',
    'temporary_failure',
    'unknown',
  ];
}

export default router;
