/**
 * REBAA-27: Audit API Routes
 * Endpoints for querying and exporting audit logs
 */
import { Router, Request, Response } from 'express';
import { AuditService } from '../services/audit.service';
import { AuditFiltersSchema, AuditExportOptionsSchema } from '../types/audit';
import { validateToken, requireRole } from '../middleware/auth';

const router = Router();

// All audit routes require authentication and admin role
router.use(validateToken);
router.use(requireRole('admin', 'auditor'));

/**
 * GET /api/audit
 * Query audit logs with filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const parseResult = AuditFiltersSchema.safeParse({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      userId: req.query.userId,
      userEmail: req.query.userEmail,
      tenantId: req.query.tenantId || req.user?.tenantId,
      action: req.query.action,
      actions: req.query.actions
        ? (req.query.actions as string).split(',')
        : undefined,
      resourceType: req.query.resourceType,
      resourceId: req.query.resourceId,
      success:
        req.query.success !== undefined
          ? req.query.success === 'true'
          : undefined,
      correlationId: req.query.correlationId,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      orderBy: req.query.orderBy as 'timestamp' | 'action' | 'resource_type',
      orderDir: req.query.orderDir as 'asc' | 'desc',
    });

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid filters',
        details: parseResult.error.issues,
      });
    }

    const result = await AuditService.query(parseResult.data);
    res.json(result);
  } catch (error) {
    console.error('[Audit] Query failed:', error);
    res.status(500).json({ error: 'Failed to query audit logs' });
  }
});

/**
 * GET /api/audit/summary
 * Get audit summary statistics
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const tenantId = (req.query.tenantId as string) || req.user?.tenantId;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const summary = await AuditService.getSummary(tenantId, startDate, endDate);
    res.json({ summary });
  } catch (error) {
    console.error('[Audit] Summary failed:', error);
    res.status(500).json({ error: 'Failed to get audit summary' });
  }
});

/**
 * GET /api/audit/:id
 * Get a single audit log entry
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const log = await AuditService.getById(id);

    if (!log) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    // Check tenant access (unless admin with no tenant restriction)
    if (req.user?.tenantId && log.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(log);
  } catch (error) {
    console.error('[Audit] Get by ID failed:', error);
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

/**
 * GET /api/audit/resource/:type/:id
 * Get audit history for a specific resource
 */
router.get('/resource/:type/:id', async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 50;

    const logs = await AuditService.getResourceHistory(type, id, limit);
    res.json({ logs, resourceType: type, resourceId: id });
  } catch (error) {
    console.error('[Audit] Resource history failed:', error);
    res.status(500).json({ error: 'Failed to get resource history' });
  }
});

/**
 * POST /api/audit/export
 * Export audit logs to JSON or CSV
 */
router.post('/export', async (req: Request, res: Response) => {
  try {
    // Merge tenant restriction into filters
    const filters = {
      ...req.body.filters,
      tenantId: req.body.filters?.tenantId || req.user?.tenantId,
    };

    const parseResult = AuditExportOptionsSchema.safeParse({
      format: req.body.format,
      filters,
      includeMetadata: req.body.includeMetadata,
      maxRows: req.body.maxRows,
    });

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid export options',
        details: parseResult.error.issues,
      });
    }

    const buffer = await AuditService.export(parseResult.data);
    const format = parseResult.data.format;
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `audit-export-${timestamp}.${format}`;

    res.setHeader(
      'Content-Type',
      format === 'json' ? 'application/json' : 'text/csv'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('[Audit] Export failed:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

/**
 * GET /api/audit/correlation/:id
 * Get all logs related to a correlation ID (request chain)
 */
router.get('/correlation/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await AuditService.query({
      correlationId: id,
      limit: 100,
      orderBy: 'timestamp',
      orderDir: 'asc',
    });

    res.json({
      correlationId: id,
      logs: result.logs,
      total: result.total,
    });
  } catch (error) {
    console.error('[Audit] Correlation query failed:', error);
    res.status(500).json({ error: 'Failed to get correlated logs' });
  }
});

/**
 * DELETE /api/audit/cleanup
 * Delete old audit logs (admin only, for retention policy)
 */
router.delete('/cleanup', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const retentionDays = req.body.retentionDays || 365;

    if (retentionDays < 30) {
      return res.status(400).json({
        error: 'Retention period must be at least 30 days',
      });
    }

    const deletedCount = await AuditService.deleteOldLogs(retentionDays);
    res.json({
      message: `Deleted ${deletedCount} audit logs older than ${retentionDays} days`,
      deletedCount,
    });
  } catch (error) {
    console.error('[Audit] Cleanup failed:', error);
    res.status(500).json({ error: 'Failed to cleanup audit logs' });
  }
});

export default router;
