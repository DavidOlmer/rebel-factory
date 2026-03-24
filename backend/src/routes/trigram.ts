/**
 * Trigram Index Routes
 * 
 * API endpoints for Cursor-style fast regex search:
 * - POST /api/trigram/index - Build index for a path
 * - GET /api/trigram/search - Search with trigram index
 * - GET /api/trigram/stats - Index statistics
 * - POST /api/trigram/update - Update single file in index
 * - GET /api/trigram/top-trigrams - Get most common trigrams (debug)
 */
import { Router, Request, Response } from 'express';
import { getTrigramIndexService } from '../services/trigram-index.service';
import { validateToken } from '../middleware/auth';

const router = Router();

// Get or create the service instance
const getService = () => getTrigramIndexService('/tmp/rebel-trigram-index.json');

/**
 * POST /api/trigram/index
 * Build trigram index for a directory
 * 
 * Body:
 *   path: string - Root path to index
 *   extensions?: string[] - File extensions to include (default: common code files)
 */
router.post('/index', validateToken, async (req: Request, res: Response) => {
  try {
    const { path: rootPath, extensions } = req.body;
    
    if (!rootPath || typeof rootPath !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'path is required and must be a string',
      });
    }

    // Validate path exists
    const fs = await import('fs');
    if (!fs.existsSync(rootPath)) {
      return res.status(400).json({
        success: false,
        error: `Path does not exist: ${rootPath}`,
      });
    }

    const service = getService();
    
    // Start indexing (async, but we wait for completion)
    console.log(`[Trigram API] Starting index build for: ${rootPath}`);
    const startTime = Date.now();
    
    const progress = await service.buildIndex(
      rootPath,
      extensions || undefined
    );
    
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      progress,
      stats: service.getStats(),
      durationMs: duration,
    });
  } catch (error) {
    console.error('[Trigram API] Index build error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/trigram/search
 * Search using trigram index
 * 
 * Query params:
 *   q: string - Search pattern (regex supported)
 *   limit?: number - Max results (default: 50, max: 500)
 */
router.get('/search', validateToken, async (req: Request, res: Response) => {
  try {
    const { q, limit } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'q (query) parameter is required',
      });
    }

    const maxResults = Math.min(
      Math.max(1, parseInt(String(limit) || '50', 10)),
      500
    );

    const service = getService();
    
    // Check if index exists
    if (!service.hasIndex()) {
      return res.status(400).json({
        success: false,
        error: 'No index available. POST to /api/trigram/index first.',
      });
    }

    const startTime = Date.now();
    const results = await service.search(q, maxResults);
    const duration = Date.now() - startTime;

    res.json({
      success: true,
      query: q,
      count: results.length,
      results,
      durationMs: duration,
    });
  } catch (error) {
    console.error('[Trigram API] Search error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/trigram/stats
 * Get index statistics
 */
router.get('/stats', validateToken, async (req: Request, res: Response) => {
  try {
    const service = getService();
    const stats = service.getStats();
    const progress = service.getBuildProgress();
    
    res.json({
      success: true,
      stats: {
        ...stats,
        indexSizeMB: (stats.indexSizeBytes / 1024 / 1024).toFixed(2),
        hasIndex: service.hasIndex(),
      },
      buildProgress: progress,
    });
  } catch (error) {
    console.error('[Trigram API] Stats error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/trigram/update
 * Update a single file in the index (incremental)
 * 
 * Body:
 *   file: string - Path to file to update
 */
router.post('/update', validateToken, async (req: Request, res: Response) => {
  try {
    const { file } = req.body;
    
    if (!file || typeof file !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'file path is required',
      });
    }

    const service = getService();
    
    if (!service.hasIndex()) {
      return res.status(400).json({
        success: false,
        error: 'No index available. POST to /api/trigram/index first.',
      });
    }

    const startTime = Date.now();
    await service.updateFile(file);
    const duration = Date.now() - startTime;

    res.json({
      success: true,
      file,
      durationMs: duration,
    });
  } catch (error) {
    console.error('[Trigram API] Update error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/trigram/reload
 * Reload index from disk
 */
router.post('/reload', validateToken, async (req: Request, res: Response) => {
  try {
    const service = getService();
    await service.reloadIndex();
    
    res.json({
      success: true,
      stats: service.getStats(),
    });
  } catch (error) {
    console.error('[Trigram API] Reload error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/trigram/top-trigrams
 * Get most common trigrams (for debugging/analysis)
 * 
 * Query params:
 *   limit?: number - Number of trigrams to return (default: 20, max: 100)
 */
router.get('/top-trigrams', validateToken, async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const maxTrigrams = Math.min(
      Math.max(1, parseInt(String(limit) || '20', 10)),
      100
    );

    const service = getService();
    
    if (!service.hasIndex()) {
      return res.status(400).json({
        success: false,
        error: 'No index available.',
      });
    }

    const topTrigrams = service.getTopTrigrams(maxTrigrams);

    res.json({
      success: true,
      count: topTrigrams.length,
      trigrams: topTrigrams,
    });
  } catch (error) {
    console.error('[Trigram API] Top trigrams error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
