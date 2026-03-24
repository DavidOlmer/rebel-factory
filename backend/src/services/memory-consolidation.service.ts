/**
 * REBEL AI FACTORY - MEMORY CONSOLIDATION SERVICE
 * 
 * Transforms raw episodic memories to semantic representations
 * Based on KB: Memory Consolidation
 * 
 * Benefits:
 * - 60% storage reduction through pattern extraction
 * - 22% better retrieval accuracy via semantic clustering
 * - Automatic nightly consolidation for high-volume agents
 */

import { Pool, PoolClient } from 'pg';
import { pool as defaultPool, transaction } from '../db/client';
import { randomUUID } from 'crypto';

// ============================================
// TYPES
// ============================================

export interface EpisodicMemory {
  id: string;
  agentId: string;
  content: string;
  embedding?: number[];
  timestamp: Date;
  metadata: Record<string, any>;
  consolidated: boolean;
  importance: number;
  source: string;
}

export interface ConsolidatedMemory {
  id: string;
  agentId: string;
  pattern: string;           // Extracted semantic pattern
  occurrences: number;       // How many times seen
  examples: string[];        // Sample instances (max 5)
  firstSeen: Date;
  lastSeen: Date;
  embedding?: number[];
  confidence: number;        // Pattern confidence score
  tags: string[];
  metadata: Record<string, any>;
}

export interface ConsolidationResult {
  beforeCount: number;
  afterCount: number;
  reductionPercent: number;
  patternsFound: number;
  clustersAnalyzed: number;
  durationMs: number;
}

export interface ConsolidationConfig {
  minClusterSize: number;      // Minimum memories to form cluster (default: 2)
  similarityThreshold: number; // 0-1, how similar memories must be (default: 0.7)
  maxExamples: number;         // Max examples to keep per pattern (default: 5)
  batchSize: number;           // Memories per batch (default: 100)
}

const DEFAULT_CONFIG: ConsolidationConfig = {
  minClusterSize: 2,
  similarityThreshold: 0.7,
  maxExamples: 5,
  batchSize: 100,
};

// ============================================
// SERVICE CLASS
// ============================================

export class MemoryConsolidationService {
  private pool: Pool;
  private config: ConsolidationConfig;

  constructor(pool?: Pool, config?: Partial<ConsolidationConfig>) {
    this.pool = pool || defaultPool;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================
  // MAIN CONSOLIDATION
  // ============================================

  /**
   * Run consolidation for an agent
   * Clusters similar memories and extracts semantic patterns
   */
  async consolidate(agentId: string): Promise<ConsolidationResult> {
    const startTime = Date.now();
    
    // Get all unconsolidated episodic memories
    const memories = await this.getEpisodicMemories(agentId);
    const beforeCount = memories.length;

    if (beforeCount === 0) {
      return {
        beforeCount: 0,
        afterCount: 0,
        reductionPercent: 0,
        patternsFound: 0,
        clustersAnalyzed: 0,
        durationMs: Date.now() - startTime,
      };
    }

    // Cluster similar memories using content similarity
    const clusters = this.clusterMemories(memories);
    const clustersAnalyzed = clusters.length;

    // Extract patterns from clusters with sufficient size
    const patterns: ConsolidatedMemory[] = [];
    for (const cluster of clusters) {
      if (cluster.length >= this.config.minClusterSize) {
        const pattern = this.extractPattern(cluster);
        patterns.push(pattern);
      }
    }

    // Store in transaction
    await transaction(async (client: PoolClient) => {
      // Store consolidated patterns
      for (const pattern of patterns) {
        await this.storePattern(client, pattern);
      }

      // Mark original memories as consolidated
      if (memories.length > 0) {
        await this.markConsolidated(client, memories.map(m => m.id));
      }
    });

    const reductionPercent = beforeCount > 0 
      ? Math.round(((beforeCount - patterns.length) / beforeCount) * 100)
      : 0;

    return {
      beforeCount,
      afterCount: patterns.length,
      reductionPercent,
      patternsFound: patterns.length,
      clustersAnalyzed,
      durationMs: Date.now() - startTime,
    };
  }

  // ============================================
  // MEMORY RETRIEVAL
  // ============================================

  /**
   * Get unconsolidated episodic memories for an agent
   */
  private async getEpisodicMemories(agentId: string): Promise<EpisodicMemory[]> {
    const result = await this.pool.query<any>(`
      SELECT 
        id,
        agent_id as "agentId",
        content,
        embedding,
        timestamp,
        metadata,
        consolidated,
        COALESCE(importance, 0.5) as importance,
        COALESCE(source, 'unknown') as source
      FROM episodic_memories
      WHERE agent_id = $1 
        AND consolidated = false
      ORDER BY timestamp ASC
      LIMIT $2
    `, [agentId, this.config.batchSize]);

    return result.rows.map(row => ({
      ...row,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata || {},
    }));
  }

  /**
   * Retrieve consolidated patterns with query matching
   */
  async retrieve(
    agentId: string, 
    query: string, 
    limit: number = 5
  ): Promise<ConsolidatedMemory[]> {
    const result = await this.pool.query<any>(`
      SELECT 
        id,
        agent_id as "agentId",
        pattern,
        occurrences,
        examples,
        first_seen as "firstSeen",
        last_seen as "lastSeen",
        embedding,
        confidence,
        tags,
        metadata
      FROM consolidated_memories
      WHERE agent_id = $1
        AND (
          pattern ILIKE $2
          OR EXISTS (
            SELECT 1 FROM unnest(examples) AS ex 
            WHERE ex ILIKE $2
          )
          OR EXISTS (
            SELECT 1 FROM unnest(tags) AS t 
            WHERE t ILIKE $2
          )
        )
      ORDER BY 
        occurrences DESC, 
        confidence DESC,
        last_seen DESC
      LIMIT $3
    `, [agentId, `%${query}%`, limit]);

    return result.rows.map(row => ({
      ...row,
      firstSeen: new Date(row.firstSeen),
      lastSeen: new Date(row.lastSeen),
      examples: row.examples || [],
      tags: row.tags || [],
      metadata: row.metadata || {},
    }));
  }

  /**
   * Get all consolidated patterns for an agent
   */
  async getPatterns(
    agentId: string,
    options: { 
      limit?: number; 
      offset?: number; 
      minOccurrences?: number;
    } = {}
  ): Promise<{ patterns: ConsolidatedMemory[]; total: number }> {
    const { limit = 50, offset = 0, minOccurrences = 1 } = options;

    const countResult = await this.pool.query<{ count: string }>(`
      SELECT COUNT(*) as count
      FROM consolidated_memories
      WHERE agent_id = $1 AND occurrences >= $2
    `, [agentId, minOccurrences]);

    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    const result = await this.pool.query<any>(`
      SELECT 
        id,
        agent_id as "agentId",
        pattern,
        occurrences,
        examples,
        first_seen as "firstSeen",
        last_seen as "lastSeen",
        embedding,
        confidence,
        tags,
        metadata
      FROM consolidated_memories
      WHERE agent_id = $1 AND occurrences >= $2
      ORDER BY occurrences DESC, last_seen DESC
      LIMIT $3 OFFSET $4
    `, [agentId, minOccurrences, limit, offset]);

    return {
      patterns: result.rows.map(row => ({
        ...row,
        firstSeen: new Date(row.firstSeen),
        lastSeen: new Date(row.lastSeen),
        examples: row.examples || [],
        tags: row.tags || [],
        metadata: row.metadata || {},
      })),
      total,
    };
  }

  // ============================================
  // CLUSTERING ALGORITHM
  // ============================================

  /**
   * Cluster similar memories using normalized content keys
   * Uses simple but effective string normalization for grouping
   */
  private clusterMemories(memories: EpisodicMemory[]): EpisodicMemory[][] {
    const clusters: Map<string, EpisodicMemory[]> = new Map();
    
    for (const memory of memories) {
      const key = this.normalizeForClustering(memory.content);
      
      // Try to find existing similar cluster
      let foundCluster = false;
      for (const [existingKey, cluster] of Array.from(clusters.entries())) {
        if (this.calculateSimilarity(key, existingKey) >= this.config.similarityThreshold) {
          cluster.push(memory);
          foundCluster = true;
          break;
        }
      }
      
      // Create new cluster if no match found
      if (!foundCluster) {
        clusters.set(key, [memory]);
      }
    }

    return Array.from(clusters.values());
  }

  /**
   * Normalize content for clustering
   * Removes noise, extracts key phrases
   */
  private normalizeForClustering(content: string): string {
    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')           // Remove punctuation
      .replace(/\b(the|a|an|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|must|shall|can|need|dare|ought|used|to|of|in|for|on|with|at|by|from|as|into|through|during|before|after|above|below|between|under|again|further|then|once|here|there|when|where|why|how|all|each|few|more|most|other|some|such|no|nor|not|only|own|same|so|than|too|very|just|also|now|and|but|or|if)\b/g, ' ')  // Remove stop words
      .replace(/\d+/g, '#')               // Normalize numbers
      .replace(/\s+/g, ' ')               // Collapse whitespace
      .trim()
      .slice(0, 100);                     // Limit length for comparison
  }

  /**
   * Calculate Jaccard similarity between normalized strings
   */
  private calculateSimilarity(a: string, b: string): number {
    const wordsA = a.split(' ').filter(w => w.length > 2);
    const wordsB = b.split(' ').filter(w => w.length > 2);
    const setA = new Set(wordsA);
    const setB = new Set(wordsB);
    
    if (setA.size === 0 || setB.size === 0) return 0;
    
    const intersection = new Set(Array.from(setA).filter(x => setB.has(x)));
    const union = new Set(Array.from(setA).concat(Array.from(setB)));
    
    return intersection.size / union.size;
  }

  // ============================================
  // PATTERN EXTRACTION
  // ============================================

  /**
   * Extract common pattern from a cluster of memories
   */
  private extractPattern(cluster: EpisodicMemory[]): ConsolidatedMemory {
    const contents = cluster.map(m => m.content);
    const commonPattern = this.findCommonPattern(contents);
    const tags = this.extractTags(contents);
    
    // Calculate confidence based on cluster consistency
    const avgSimilarity = this.calculateClusterConsistency(contents);
    const confidence = Math.min(0.5 + (cluster.length * 0.05) + (avgSimilarity * 0.3), 1);

    // Get representative examples
    const examples = this.selectExamples(contents, this.config.maxExamples);

    // Merge metadata from all memories
    const mergedMetadata = this.mergeMetadata(cluster);

    return {
      id: randomUUID(),
      agentId: cluster[0].agentId,
      pattern: commonPattern,
      occurrences: cluster.length,
      examples,
      firstSeen: new Date(Math.min(...cluster.map(m => m.timestamp.getTime()))),
      lastSeen: new Date(Math.max(...cluster.map(m => m.timestamp.getTime()))),
      confidence,
      tags,
      metadata: mergedMetadata,
    };
  }

  /**
   * Find common pattern across multiple contents
   * Uses word frequency to identify key themes
   */
  private findCommonPattern(contents: string[]): string {
    // Word frequency analysis
    const wordFreq: Map<string, number> = new Map();
    
    for (const content of contents) {
      const words = this.normalizeForClustering(content).split(' ')
        .filter(w => w.length > 2);
      
      const seen = new Set<string>();
      for (const word of words) {
        if (!seen.has(word)) {
          wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
          seen.add(word);
        }
      }
    }

    // Get words that appear in majority of contents
    const threshold = Math.ceil(contents.length * 0.5);
    const commonWords = Array.from(wordFreq.entries())
      .filter(([_, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    if (commonWords.length === 0) {
      // Fallback: use first content as pattern
      return contents[0].slice(0, 200);
    }

    // Build pattern from common words
    return commonWords.join(' ');
  }

  /**
   * Extract tags from content
   */
  private extractTags(contents: string[]): string[] {
    const tagCandidates: Map<string, number> = new Map();
    
    for (const content of contents) {
      // Extract hashtags if present
      const hashtags = content.match(/#\w+/g) || [];
      for (const tag of hashtags) {
        tagCandidates.set(tag.toLowerCase(), (tagCandidates.get(tag.toLowerCase()) || 0) + 1);
      }

      // Extract potential category words (capitalized words)
      const categories = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) || [];
      for (const cat of categories) {
        const normalized = cat.toLowerCase();
        if (normalized.length > 3) {
          tagCandidates.set(normalized, (tagCandidates.get(normalized) || 0) + 1);
        }
      }
    }

    // Return most frequent tags
    return Array.from(tagCandidates.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
  }

  /**
   * Select diverse representative examples
   */
  private selectExamples(contents: string[], maxCount: number): string[] {
    if (contents.length <= maxCount) {
      return contents;
    }

    // Take first, last, and evenly distributed middle examples
    const step = Math.floor(contents.length / maxCount);
    const selected: string[] = [contents[0]];
    
    for (let i = 1; i < maxCount - 1; i++) {
      selected.push(contents[i * step]);
    }
    
    selected.push(contents[contents.length - 1]);
    return selected;
  }

  /**
   * Calculate how consistent/similar items in cluster are
   */
  private calculateClusterConsistency(contents: string[]): number {
    if (contents.length < 2) return 1;

    let totalSimilarity = 0;
    let comparisons = 0;

    const normalized = contents.map(c => this.normalizeForClustering(c));
    
    for (let i = 0; i < normalized.length; i++) {
      for (let j = i + 1; j < normalized.length; j++) {
        totalSimilarity += this.calculateSimilarity(normalized[i], normalized[j]);
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  /**
   * Merge metadata from cluster members
   */
  private mergeMetadata(cluster: EpisodicMemory[]): Record<string, any> {
    const merged: Record<string, any> = {
      sourceMemoryCount: cluster.length,
      sources: Array.from(new Set(cluster.map(m => m.source))),
      avgImportance: cluster.reduce((sum, m) => sum + m.importance, 0) / cluster.length,
    };

    // Collect unique metadata keys
    for (const memory of cluster) {
      for (const [key, value] of Object.entries(memory.metadata || {})) {
        if (!(key in merged)) {
          merged[key] = value;
        }
      }
    }

    return merged;
  }

  // ============================================
  // STORAGE
  // ============================================

  /**
   * Store a consolidated pattern
   */
  private async storePattern(client: PoolClient, pattern: ConsolidatedMemory): Promise<void> {
    // Check for existing similar pattern
    const existing = await client.query<any>(`
      SELECT id, occurrences, examples
      FROM consolidated_memories
      WHERE agent_id = $1 AND pattern = $2
    `, [pattern.agentId, pattern.pattern]);

    if (existing.rows.length > 0) {
      // Update existing pattern
      const existingPattern = existing.rows[0];
      const allExamples = (existingPattern.examples || []).concat(pattern.examples);
      const mergedExamples = Array.from(new Set(allExamples))
        .slice(0, this.config.maxExamples);

      await client.query(`
        UPDATE consolidated_memories
        SET 
          occurrences = occurrences + $1,
          examples = $2,
          last_seen = $3,
          confidence = GREATEST(confidence, $4),
          tags = $5,
          metadata = metadata || $6,
          updated_at = NOW()
        WHERE id = $7
      `, [
        pattern.occurrences,
        mergedExamples,
        pattern.lastSeen,
        pattern.confidence,
        pattern.tags,
        JSON.stringify(pattern.metadata),
        existingPattern.id,
      ]);
    } else {
      // Insert new pattern
      await client.query(`
        INSERT INTO consolidated_memories (
          id, agent_id, pattern, occurrences, examples,
          first_seen, last_seen, embedding, confidence, tags, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
      `, [
        pattern.id,
        pattern.agentId,
        pattern.pattern,
        pattern.occurrences,
        pattern.examples,
        pattern.firstSeen,
        pattern.lastSeen,
        pattern.embedding || null,
        pattern.confidence,
        pattern.tags,
        JSON.stringify(pattern.metadata),
      ]);
    }
  }

  /**
   * Mark memories as consolidated
   */
  private async markConsolidated(client: PoolClient, memoryIds: string[]): Promise<void> {
    if (memoryIds.length === 0) return;

    await client.query(`
      UPDATE episodic_memories
      SET consolidated = true, updated_at = NOW()
      WHERE id = ANY($1)
    `, [memoryIds]);
  }

  // ============================================
  // SCHEDULED CONSOLIDATION
  // ============================================

  /**
   * Run consolidation for all agents with high memory counts
   * Intended for nightly batch processing
   */
  async scheduleConsolidation(threshold: number = 100): Promise<{
    agentsProcessed: number;
    totalMemoriesConsolidated: number;
    totalPatternsCreated: number;
    results: Array<{ agentId: string; result: ConsolidationResult }>;
  }> {
    // Find agents with unconsolidated memories above threshold
    const agents = await this.pool.query<{ agent_id: string; memory_count: string }>(`
      SELECT agent_id, COUNT(*) as memory_count
      FROM episodic_memories
      WHERE consolidated = false
      GROUP BY agent_id
      HAVING COUNT(*) >= $1
      ORDER BY COUNT(*) DESC
    `, [threshold]);

    const results: Array<{ agentId: string; result: ConsolidationResult }> = [];
    let totalMemoriesConsolidated = 0;
    let totalPatternsCreated = 0;

    for (const agent of agents.rows) {
      try {
        const result = await this.consolidate(agent.agent_id);
        results.push({ agentId: agent.agent_id, result });
        totalMemoriesConsolidated += result.beforeCount;
        totalPatternsCreated += result.patternsFound;
      } catch (error) {
        console.error(`Consolidation failed for agent ${agent.agent_id}:`, error);
        results.push({
          agentId: agent.agent_id,
          result: {
            beforeCount: 0,
            afterCount: 0,
            reductionPercent: 0,
            patternsFound: 0,
            clustersAnalyzed: 0,
            durationMs: 0,
          },
        });
      }
    }

    return {
      agentsProcessed: agents.rows.length,
      totalMemoriesConsolidated,
      totalPatternsCreated,
      results,
    };
  }

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * Get memory statistics for an agent
   */
  async getStats(agentId: string): Promise<{
    episodicCount: number;
    consolidatedCount: number;
    unconsolidatedCount: number;
    totalOccurrences: number;
    avgConfidence: number;
    topPatterns: Array<{ pattern: string; occurrences: number }>;
  }> {
    const [episodic, consolidated, unconsolidated, stats, topPatterns] = await Promise.all([
      this.pool.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM episodic_memories WHERE agent_id = $1',
        [agentId]
      ),
      this.pool.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM consolidated_memories WHERE agent_id = $1',
        [agentId]
      ),
      this.pool.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM episodic_memories WHERE agent_id = $1 AND consolidated = false',
        [agentId]
      ),
      this.pool.query<{ total_occurrences: string; avg_confidence: string }>(
        'SELECT COALESCE(SUM(occurrences), 0) as total_occurrences, COALESCE(AVG(confidence), 0) as avg_confidence FROM consolidated_memories WHERE agent_id = $1',
        [agentId]
      ),
      this.pool.query<{ pattern: string; occurrences: number }>(
        'SELECT pattern, occurrences FROM consolidated_memories WHERE agent_id = $1 ORDER BY occurrences DESC LIMIT 5',
        [agentId]
      ),
    ]);

    return {
      episodicCount: parseInt(episodic.rows[0]?.count || '0', 10),
      consolidatedCount: parseInt(consolidated.rows[0]?.count || '0', 10),
      unconsolidatedCount: parseInt(unconsolidated.rows[0]?.count || '0', 10),
      totalOccurrences: parseInt(stats.rows[0]?.total_occurrences || '0', 10),
      avgConfidence: parseFloat(stats.rows[0]?.avg_confidence || '0'),
      topPatterns: topPatterns.rows,
    };
  }

  // ============================================
  // EPISODIC MEMORY CRUD
  // ============================================

  /**
   * Add a new episodic memory
   */
  async addEpisodicMemory(memory: Omit<EpisodicMemory, 'id' | 'consolidated'>): Promise<EpisodicMemory> {
    const id = randomUUID();
    
    await this.pool.query(`
      INSERT INTO episodic_memories (
        id, agent_id, content, embedding, timestamp, metadata, importance, source, consolidated
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, false
      )
    `, [
      id,
      memory.agentId,
      memory.content,
      memory.embedding || null,
      memory.timestamp,
      JSON.stringify(memory.metadata || {}),
      memory.importance || 0.5,
      memory.source || 'unknown',
    ]);

    return {
      id,
      ...memory,
      consolidated: false,
      importance: memory.importance || 0.5,
      source: memory.source || 'unknown',
    };
  }

  /**
   * Delete a consolidated pattern
   */
  async deletePattern(patternId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM consolidated_memories WHERE id = $1',
      [patternId]
    );
    return (result.rowCount || 0) > 0;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const memoryConsolidationService = new MemoryConsolidationService();
