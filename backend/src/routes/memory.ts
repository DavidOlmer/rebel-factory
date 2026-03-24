/**
 * REBEL AI FACTORY - MEMORY ROUTES
 * 
 * REST API endpoints for memory consolidation system
 * Supports episodic memory storage, consolidation, and pattern retrieval
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { MemoryConsolidationService } from '../services/memory-consolidation.service';
import { validateToken, extractUser } from '../middleware/auth';
import { pool } from '../db/client';
import type { WSMessage } from '../types';

// ============================================
// SCHEMAS
// ============================================

const AgentIdSchema = z.object({
  agentId: z.string().uuid(),
});

const PatternIdSchema = z.object({
  patternId: z.string().uuid(),
});

const AddMemorySchema = z.object({
  content: z.string().min(1).max(10000),
  embedding: z.array(z.number()).optional(),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
  importance: z.number().min(0).max(1).optional(),
  source: z.string().max(100).optional(),
});

const RetrieveSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(100).optional(),
});

const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  minOccurrences: z.coerce.number().int().min(1).optional(),
});

const ConsolidationConfigSchema = z.object({
  minClusterSize: z.number().int().min(2).max(50).optional(),
  similarityThreshold: z.number().min(0.1).max(1).optional(),
  maxExamples: z.number().int().min(1).max(20).optional(),
  batchSize: z.number().int().min(10).max(1000).optional(),
});

// ============================================
// SERVICE INSTANCE
// ============================================

const memoryService = new MemoryConsolidationService(pool);

// ============================================
// ROUTE FACTORY
// ============================================

export function createMemoryRoutes(broadcast: (msg: WSMessage) => void): Router {
  const router = Router();

  // ============================================
  // EPISODIC MEMORIES
  // ============================================

  /**
   * POST /memory/:agentId/episodic
   * Add a new episodic memory for an agent
   */
  router.post('/:agentId/episodic', validateToken, async (req: Request, res: Response) => {
    try {
      const { agentId } = AgentIdSchema.parse({ agentId: req.params.agentId });
      const data = AddMemorySchema.parse(req.body);

      const memory = await memoryService.addEpisodicMemory({
        agentId,
        content: data.content,
        embedding: data.embedding,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        metadata: data.metadata || {},
        importance: data.importance || 0.5,
        source: data.source || 'api',
      });

      broadcast({
        type: 'memory_added',
        payload: { agentId, memoryId: memory.id },
        timestamp: new Date().toISOString(),
      });

      res.status(201).json({ memory });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Error adding memory:', error);
      res.status(500).json({ error: 'Failed to add memory' });
    }
  });

  // ============================================
  // CONSOLIDATION
  // ============================================

  /**
   * POST /memory/:agentId/consolidate
   * Run consolidation for an agent's memories
   */
  router.post('/:agentId/consolidate', validateToken, async (req: Request, res: Response) => {
    try {
      const { agentId } = AgentIdSchema.parse({ agentId: req.params.agentId });
      const config = ConsolidationConfigSchema.parse(req.body);

      // Create service with custom config if provided
      const service = Object.keys(config).length > 0
        ? new MemoryConsolidationService(pool, config)
        : memoryService;

      const result = await service.consolidate(agentId);

      broadcast({
        type: 'memory_consolidated',
        payload: { agentId, ...result },
        timestamp: new Date().toISOString(),
      });

      res.json({ result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Error consolidating memories:', error);
      res.status(500).json({ error: 'Failed to consolidate memories' });
    }
  });

  /**
   * POST /memory/consolidate-all
   * Run scheduled consolidation for all agents above threshold
   */
  router.post('/consolidate-all', validateToken, async (req: Request, res: Response) => {
    try {
      const threshold = z.coerce.number().int().min(10).optional()
        .parse(req.query.threshold) || 100;

      const result = await memoryService.scheduleConsolidation(threshold);

      broadcast({
        type: 'batch_consolidation_complete',
        payload: result,
        timestamp: new Date().toISOString(),
      });

      res.json({ result });
    } catch (error) {
      console.error('Error running batch consolidation:', error);
      res.status(500).json({ error: 'Failed to run batch consolidation' });
    }
  });

  // ============================================
  // PATTERN RETRIEVAL
  // ============================================

  /**
   * GET /memory/:agentId/patterns
   * Get consolidated patterns for an agent
   */
  router.get('/:agentId/patterns', extractUser, async (req: Request, res: Response) => {
    try {
      const { agentId } = AgentIdSchema.parse({ agentId: req.params.agentId });
      const { limit, offset, minOccurrences } = PaginationSchema.parse(req.query);

      const { patterns, total } = await memoryService.getPatterns(agentId, {
        limit,
        offset,
        minOccurrences,
      });

      res.json({ patterns, total, limit: limit || 50, offset: offset || 0 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Error fetching patterns:', error);
      res.status(500).json({ error: 'Failed to fetch patterns' });
    }
  });

  /**
   * POST /memory/:agentId/retrieve
   * Semantic search across consolidated patterns
   */
  router.post('/:agentId/retrieve', extractUser, async (req: Request, res: Response) => {
    try {
      const { agentId } = AgentIdSchema.parse({ agentId: req.params.agentId });
      const { query, limit } = RetrieveSchema.parse(req.body);

      const patterns = await memoryService.retrieve(agentId, query, limit);

      res.json({ patterns, count: patterns.length });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Error retrieving patterns:', error);
      res.status(500).json({ error: 'Failed to retrieve patterns' });
    }
  });

  /**
   * DELETE /memory/:agentId/patterns/:patternId
   * Delete a consolidated pattern
   */
  router.delete('/:agentId/patterns/:patternId', validateToken, async (req: Request, res: Response) => {
    try {
      const { agentId } = AgentIdSchema.parse({ agentId: req.params.agentId });
      const { patternId } = PatternIdSchema.parse({ patternId: req.params.patternId });

      const deleted = await memoryService.deletePattern(patternId);

      if (!deleted) {
        return res.status(404).json({ error: 'Pattern not found' });
      }

      broadcast({
        type: 'pattern_deleted',
        payload: { agentId, patternId },
        timestamp: new Date().toISOString(),
      });

      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Error deleting pattern:', error);
      res.status(500).json({ error: 'Failed to delete pattern' });
    }
  });

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * GET /memory/:agentId/stats
   * Get memory statistics for an agent
   */
  router.get('/:agentId/stats', extractUser, async (req: Request, res: Response) => {
    try {
      const { agentId } = AgentIdSchema.parse({ agentId: req.params.agentId });

      const stats = await memoryService.getStats(agentId);

      // Calculate additional metrics
      const storageReduction = stats.episodicCount > 0 
        ? Math.round((1 - stats.consolidatedCount / (stats.episodicCount - stats.unconsolidatedCount || 1)) * 100)
        : 0;

      res.json({ 
        stats: {
          ...stats,
          storageReduction: Math.max(0, storageReduction),
          consolidationRate: stats.episodicCount > 0 
            ? Math.round(((stats.episodicCount - stats.unconsolidatedCount) / stats.episodicCount) * 100)
            : 0,
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  /**
   * GET /memory/overview
   * Get system-wide memory overview
   */
  router.get('/overview', extractUser, async (req: Request, res: Response) => {
    try {
      // System-wide stats
      const [episodic, consolidated, pendingAgents] = await Promise.all([
        pool.query<{ count: string }>('SELECT COUNT(*) as count FROM episodic_memories'),
        pool.query<{ count: string }>('SELECT COUNT(*) as count FROM consolidated_memories'),
        pool.query<{ count: string }>(`
          SELECT COUNT(DISTINCT agent_id) as count 
          FROM episodic_memories 
          WHERE consolidated = false
        `),
      ]);

      res.json({
        overview: {
          totalEpisodicMemories: parseInt(episodic.rows[0]?.count || '0', 10),
          totalConsolidatedPatterns: parseInt(consolidated.rows[0]?.count || '0', 10),
          agentsPendingConsolidation: parseInt(pendingAgents.rows[0]?.count || '0', 10),
        }
      });
    } catch (error) {
      console.error('Error fetching overview:', error);
      res.status(500).json({ error: 'Failed to fetch overview' });
    }
  });

  return router;
}

// ============================================
// DEFAULT EXPORT (for simpler imports)
// ============================================

export const memoryRouter = createMemoryRoutes(() => {});
