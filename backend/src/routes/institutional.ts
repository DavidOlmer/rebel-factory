/**
 * REBEL AI FACTORY - INSTITUTIONAL INTELLIGENCE ROUTES
 * 
 * API endpoints for 7 Pillars assessment and monitoring
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { 
  createInstitutionalIntelligenceService,
  AssessmentConfig,
} from '../services/institutional-intelligence.service';
import { SessionUser } from '../config/msal';

// ============================================
// TYPES
// ============================================

// Extend Express Request to include user and tenant
interface AuthenticatedRequest extends Request {
  user?: SessionUser;
  tenantId?: string; // Set by tenant middleware
}

interface AssessQueryParams {
  windowDays?: string;
  deepDive?: string;
  includeHistory?: string;
}

// Helper to check if user has a role
function hasRole(user: SessionUser | undefined, ...roles: string[]): boolean {
  if (!user?.roles) return false;
  return user.roles.some(r => roles.includes(r));
}

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Verify user has access to tenant
 */
const requireTenantAccess = (req: Request, res: Response, next: NextFunction) => {
  const { tenantId } = req.params;
  const userTenantId = (req as AuthenticatedRequest).tenantId;
  const user = req.user as SessionUser | undefined;

  // Admin can access any tenant
  if (hasRole(user, 'admin')) {
    return next();
  }

  // User must belong to requested tenant
  if (userTenantId !== tenantId) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'You do not have access to this tenant',
    });
  }

  next();
};

/**
 * Require analyst or admin role for assessments
 */
const requireAnalystRole = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as SessionUser | undefined;
  
  if (!hasRole(user, 'admin', 'analyst', 'manager')) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: 'Analyst role or higher required',
    });
  }

  next();
};

// ============================================
// ROUTES
// ============================================

export function createInstitutionalRoutes(pool: Pool): Router {
  const router = Router();
  const service = createInstitutionalIntelligenceService(pool);

  /**
   * GET /api/institutional/assess/:tenantId
   * 
   * Full 7 Pillars assessment for a tenant
   * 
   * Query params:
   * - windowDays: Analysis window (default 7)
   * - deepDive: Include detailed sub-pillar analysis (default false)
   * - includeHistory: Include trend data (default false)
   */
  router.get(
    '/assess/:tenantId',
    requireTenantAccess,
    requireAnalystRole,
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req.params;
        const { windowDays, deepDive, includeHistory } = req.query as AssessQueryParams;

        const config: Partial<AssessmentConfig> = {
          analysisWindowDays: windowDays ? parseInt(windowDays) : 7,
          deepDive: deepDive === 'true',
          includeHistoricalTrend: includeHistory === 'true',
        };

        const report = await service.assess(tenantId, config);

        // Optionally include history
        let history = null;
        if (includeHistory === 'true') {
          history = await service.getHistory(tenantId, config.analysisWindowDays || 30);
        }

        res.json({
          success: true,
          data: {
            report,
            history,
          },
        });
      } catch (error) {
        console.error('Assessment error:', error);
        res.status(500).json({
          success: false,
          error: 'Assessment failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/institutional/quick/:tenantId
   * 
   * Quick health check - returns cached score if available
   */
  router.get(
    '/quick/:tenantId',
    requireTenantAccess,
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req.params;
        const result = await service.quickCheck(tenantId);

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        console.error('Quick check error:', error);
        res.status(500).json({
          success: false,
          error: 'Quick check failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/institutional/history/:tenantId
   * 
   * Historical assessment data for trend charts
   * 
   * Query params:
   * - days: Number of days to look back (default 30)
   */
  router.get(
    '/history/:tenantId',
    requireTenantAccess,
    requireAnalystRole,
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req.params;
        const { days } = req.query;
        
        const history = await service.getHistory(
          tenantId, 
          days ? parseInt(days as string) : 30
        );

        res.json({
          success: true,
          data: history,
        });
      } catch (error) {
        console.error('History error:', error);
        res.status(500).json({
          success: false,
          error: 'History retrieval failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/institutional/pillar/:tenantId/:pillar
   * 
   * Detailed assessment of a single pillar
   */
  router.get(
    '/pillar/:tenantId/:pillar',
    requireTenantAccess,
    requireAnalystRole,
    async (req: Request, res: Response) => {
      try {
        const { tenantId, pillar } = req.params;
        const validPillars = ['coordination', 'signal', 'bias', 'memory', 'culture', 'workflow', 'governance'];

        if (!validPillars.includes(pillar)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid pillar',
            message: `Valid pillars: ${validPillars.join(', ')}`,
          });
        }

        // Get full assessment and extract specific pillar
        const report = await service.assess(tenantId);
        const pillarData = report.pillars[pillar as keyof typeof report.pillars];

        res.json({
          success: true,
          data: {
            pillar: pillarData,
            relatedRecommendations: report.recommendations.filter(r => 
              r.pillar.toLowerCase() === pillar
            ),
            overallContext: {
              tenantScore: report.overallScore,
              maturityLevel: report.maturityLevel,
            },
          },
        });
      } catch (error) {
        console.error('Pillar assessment error:', error);
        res.status(500).json({
          success: false,
          error: 'Pillar assessment failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/institutional/recommendations/:tenantId
   * 
   * Prioritized recommendations for improvement
   */
  router.get(
    '/recommendations/:tenantId',
    requireTenantAccess,
    requireAnalystRole,
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req.params;
        const { limit } = req.query;

        const report = await service.assess(tenantId);
        const recommendations = limit 
          ? report.recommendations.slice(0, parseInt(limit as string))
          : report.recommendations;

        res.json({
          success: true,
          data: {
            recommendations,
            summary: {
              criticalPillars: Object.entries(report.pillars)
                .filter(([, p]) => p.status === 'critical')
                .map(([name]) => name),
              warningPillars: Object.entries(report.pillars)
                .filter(([, p]) => p.status === 'warning')
                .map(([name]) => name),
              overallScore: report.overallScore,
              maturityLevel: report.maturityLevel,
            },
          },
        });
      } catch (error) {
        console.error('Recommendations error:', error);
        res.status(500).json({
          success: false,
          error: 'Recommendations retrieval failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * POST /api/institutional/benchmark/:tenantId
   * 
   * Compare tenant against industry benchmarks
   */
  router.post(
    '/benchmark/:tenantId',
    requireTenantAccess,
    requireAnalystRole,
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req.params;
        const { industry, companySize } = req.body;

        // Get tenant assessment
        const report = await service.assess(tenantId);

        // Industry benchmarks (would come from a benchmarks table in production)
        const benchmarks: Record<string, Record<string, number>> = {
          'technology': {
            coordination: 72,
            signal: 68,
            bias: 65,
            memory: 58,
            culture: 71,
            workflow: 74,
            governance: 69,
          },
          'finance': {
            coordination: 68,
            signal: 75,
            bias: 72,
            memory: 62,
            culture: 68,
            workflow: 70,
            governance: 82,
          },
          'healthcare': {
            coordination: 65,
            signal: 70,
            bias: 78,
            memory: 55,
            culture: 72,
            workflow: 66,
            governance: 85,
          },
          'default': {
            coordination: 65,
            signal: 65,
            bias: 65,
            memory: 55,
            culture: 65,
            workflow: 65,
            governance: 70,
          },
        };

        const industryBenchmark = benchmarks[industry] || benchmarks['default'];

        // Calculate comparison
        const comparison = Object.entries(report.pillars).map(([key, pillar]) => {
          const benchmark = industryBenchmark[key] || 60;
          const diff = pillar.score - benchmark;
          return {
            pillar: pillar.name,
            score: pillar.score,
            benchmark,
            difference: diff,
            position: diff > 10 ? 'leader' : diff > 0 ? 'above-average' : diff > -10 ? 'average' : 'below-average',
          };
        });

        // Overall position
        const overallBenchmark = Object.values(industryBenchmark).reduce((a, b) => a + b, 0) / 7;
        const overallDiff = report.overallScore - overallBenchmark;

        res.json({
          success: true,
          data: {
            tenantScore: report.overallScore,
            industryBenchmark: Math.round(overallBenchmark),
            difference: Math.round(overallDiff),
            position: overallDiff > 10 ? 'industry-leader' : overallDiff > 0 ? 'above-average' : overallDiff > -10 ? 'average' : 'needs-improvement',
            pillarComparison: comparison,
            industry: industry || 'default',
          },
        });
      } catch (error) {
        console.error('Benchmark error:', error);
        res.status(500).json({
          success: false,
          error: 'Benchmark comparison failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/institutional/summary
   * 
   * Multi-tenant summary for admin dashboard
   */
  router.get(
    '/summary',
    async (req: Request, res: Response) => {
      // Admin only
      const user = req.user as SessionUser | undefined;
      if (!hasRole(user, 'admin')) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required',
        });
      }

      try {
        // Get latest assessment for each tenant
        const result = await pool.query(`
          SELECT DISTINCT ON (tenant_id)
            tenant_id,
            score,
            pillars,
            created_at
          FROM institutional_assessments
          ORDER BY tenant_id, created_at DESC
        `);

        const summary = result.rows.map(row => {
          const pillars = row.pillars as Record<string, { score: number; status: string }>;
          const criticalCount = Object.values(pillars).filter(p => p.status === 'critical').length;
          const warningCount = Object.values(pillars).filter(p => p.status === 'warning').length;

          return {
            tenantId: row.tenant_id,
            score: row.score,
            status: row.score >= 70 ? 'healthy' : row.score >= 40 ? 'warning' : 'critical',
            criticalPillars: criticalCount,
            warningPillars: warningCount,
            lastAssessed: row.created_at,
          };
        });

        // Aggregate stats
        const scores = summary.map(s => s.score);
        const avgScore = scores.length > 0 
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;

        res.json({
          success: true,
          data: {
            tenants: summary,
            aggregate: {
              totalTenants: summary.length,
              averageScore: avgScore,
              criticalTenants: summary.filter(s => s.status === 'critical').length,
              warningTenants: summary.filter(s => s.status === 'warning').length,
              healthyTenants: summary.filter(s => s.status === 'healthy').length,
            },
          },
        });
      } catch (error) {
        console.error('Summary error:', error);
        res.status(500).json({
          success: false,
          error: 'Summary retrieval failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/institutional/export/:tenantId
   * 
   * Export assessment report in various formats
   */
  router.get(
    '/export/:tenantId',
    requireTenantAccess,
    requireAnalystRole,
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req.params;
        const { format = 'json' } = req.query;

        const report = await service.assess(tenantId);
        const history = await service.getHistory(tenantId, 30);

        if (format === 'csv') {
          // CSV export
          const csvLines = [
            'Pillar,Score,Status,Findings,Actions',
            ...Object.values(report.pillars).map(p => 
              `"${p.name}",${p.score},"${p.status}","${p.findings.map(f => f.message).join('; ')}","${p.actions.map(a => a.title).join('; ')}"`
            ),
          ];

          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="institutional-assessment-${tenantId}.csv"`);
          return res.send(csvLines.join('\n'));
        }

        // JSON export (default)
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="institutional-assessment-${tenantId}.json"`);
        res.json({
          exportDate: new Date().toISOString(),
          tenantId,
          report,
          history,
        });
      } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({
          success: false,
          error: 'Export failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  return router;
}

export default createInstitutionalRoutes;
