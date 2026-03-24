/**
 * RAG Routes - Hybrid RAG API
 * 
 * Endpoints:
 * - POST /api/rag/search - Search with hybrid grep + embeddings
 * - GET /api/rag/index - Get index status
 * - POST /api/rag/index - Trigger indexing
 * - DELETE /api/rag/cache - Clear embedding cache
 */
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { getHybridRAGService, RAGConfig } from '../services/hybrid-rag.service';

const router = Router();

// ============================================================================
// Middleware - Get pool from app
// ============================================================================

function getPool(req: Request): Pool {
  return req.app.get('pool') as Pool;
}

// ============================================================================
// POST /api/rag/search - Hybrid search
// ============================================================================

interface SearchRequestBody {
  query: string;
  paths: string[];
  config?: Partial<RAGConfig>;
}

/**
 * @route POST /api/rag/search
 * @description Hybrid search: grep first, then semantic ranking
 * @body {query: string, paths: string[], config?: RAGConfig}
 */
router.post('/search', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { query, paths, config } = req.body as SearchRequestBody;

    // Validate input
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid query',
        details: 'Query must be a non-empty string',
      });
    }

    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid paths',
        details: 'Paths must be a non-empty array of directory/file paths',
      });
    }

    // Query length limit
    if (query.length > 1000) {
      return res.status(400).json({
        error: 'Query too long',
        details: 'Query must be at most 1000 characters',
      });
    }

    // Path limit
    if (paths.length > 10) {
      return res.status(400).json({
        error: 'Too many paths',
        details: 'Maximum 10 paths allowed per search',
      });
    }

    // Security: sanitize paths (no path traversal)
    const sanitizedPaths = paths.map(p => {
      // Remove any ../ attempts
      return p.replace(/\.\.\//g, '').replace(/\.\./g, '');
    });

    const pool = getPool(req);
    const ragService = getHybridRAGService(pool);

    // Perform search
    const results = await ragService.search(query, sanitizedPaths, config);

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      query,
      results,
      meta: {
        totalResults: results.length,
        durationMs: duration,
        paths: sanitizedPaths,
        config: {
          maxKeywordResults: config?.maxKeywordResults || 100,
          maxFinalResults: config?.maxFinalResults || 10,
          keywordWeight: config?.keywordWeight || 0.4,
          semanticWeight: config?.semanticWeight || 0.6,
        },
      },
    });

  } catch (error) {
    console.error('[RAG] Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// GET /api/rag/index - Get index status
// ============================================================================

/**
 * @route GET /api/rag/index
 * @description Get current index status
 * @query paths - Comma-separated paths to check
 */
router.get('/index', async (req: Request, res: Response) => {
  try {
    const pathsParam = req.query.paths as string;
    const paths = pathsParam ? pathsParam.split(',') : ['/home/clawd/clawd'];

    const pool = getPool(req);
    const ragService = getHybridRAGService(pool);

    const status = await ragService.getIndexStatus(paths);

    res.json({
      success: true,
      status,
    });

  } catch (error) {
    console.error('[RAG] Index status error:', error);
    res.status(500).json({
      error: 'Failed to get index status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// POST /api/rag/index - Trigger indexing
// ============================================================================

interface IndexRequestBody {
  paths: string[];
  force?: boolean;
}

/**
 * @route POST /api/rag/index
 * @description Trigger file indexing for semantic search
 * @body {paths: string[], force?: boolean}
 */
router.post('/index', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { paths, force } = req.body as IndexRequestBody;

    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid paths',
        details: 'Paths must be a non-empty array',
      });
    }

    // Security: sanitize paths
    const sanitizedPaths = paths.map(p => p.replace(/\.\.\//g, '').replace(/\.\./g, ''));

    const pool = getPool(req);
    const ragService = getHybridRAGService(pool);

    // Initialize tables if needed
    await ragService.initializeTables();

    // Perform indexing
    const result = await ragService.indexFiles(sanitizedPaths);

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      indexed: result.indexed,
      errors: result.errors,
      durationMs: duration,
      paths: sanitizedPaths,
    });

  } catch (error) {
    console.error('[RAG] Indexing error:', error);
    res.status(500).json({
      error: 'Indexing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// DELETE /api/rag/cache - Clear cache
// ============================================================================

/**
 * @route DELETE /api/rag/cache
 * @description Clear embedding cache (memory and DB)
 */
router.delete('/cache', async (req: Request, res: Response) => {
  try {
    const pool = getPool(req);

    // Clear DB cache
    await pool.query('TRUNCATE TABLE rag_embeddings');

    res.json({
      success: true,
      message: 'Cache cleared',
    });

  } catch (error) {
    console.error('[RAG] Cache clear error:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// GET /api/rag/history - Search history
// ============================================================================

/**
 * @route GET /api/rag/history
 * @description Get recent search history
 * @query limit - Max results (default: 50)
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const pool = getPool(req);

    const result = await pool.query(`
      SELECT query, paths, result_count, duration_ms, created_at
      FROM rag_search_log
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    res.json({
      success: true,
      history: result.rows,
      total: result.rows.length,
    });

  } catch (error) {
    // Table might not exist
    res.json({
      success: true,
      history: [],
      total: 0,
    });
  }
});

// ============================================================================
// POST /api/rag/explain - Explain search results
// ============================================================================

interface ExplainRequestBody {
  query: string;
  result: {
    file: string;
    line: number;
    content: string;
  };
}

/**
 * @route POST /api/rag/explain
 * @description Explain why a result matched
 */
router.post('/explain', async (req: Request, res: Response) => {
  try {
    const { query, result } = req.body as ExplainRequestBody;

    if (!query || !result) {
      return res.status(400).json({
        error: 'Missing query or result',
      });
    }

    // Extract keywords
    const stopwords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'for', 'to', 'in', 'of', 'and', 'or']);
    const keywords = query.toLowerCase()
      .split(/\s+/)
      .filter(k => k.length > 2 && !stopwords.has(k));

    // Find matches
    const contentLower = result.content.toLowerCase();
    const matches = keywords.filter(k => contentLower.includes(k));
    const exactMatches = matches.filter(k => 
      new RegExp(`\\b${k}\\b`, 'i').test(result.content)
    );

    res.json({
      success: true,
      explanation: {
        query,
        keywords,
        matchedKeywords: matches,
        exactMatches,
        matchRatio: keywords.length > 0 ? matches.length / keywords.length : 0,
        reasons: [
          matches.length > 0 ? `Matched ${matches.length}/${keywords.length} keywords: ${matches.join(', ')}` : 'No keyword matches',
          exactMatches.length > 0 ? `${exactMatches.length} exact word boundary matches` : 'No exact matches',
          `File: ${result.file}`,
          `Line: ${result.line}`,
        ],
      },
    });

  } catch (error) {
    console.error('[RAG] Explain error:', error);
    res.status(500).json({
      error: 'Failed to explain result',
    });
  }
});

export default router;
