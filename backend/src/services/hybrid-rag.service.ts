/**
 * Hybrid RAG Service
 * Cursor-style: grep/ripgrep first, then embeddings for ranking
 * 
 * Flow: Query → Grep → Filter → Embed → Rank → Return
 * 
 * Why hybrid?
 * - Grep is FAST (ms) - perfect for initial candidate selection
 * - Embeddings are SLOW but SMART - perfect for ranking
 * - Combined: best of both worlds
 */
import { spawn, execSync } from 'child_process';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface SearchResult {
  file: string;
  line: number;
  content: string;
  context?: string[];           // Surrounding lines for context
  keywordScore: number;
  semanticScore?: number;
  combinedScore: number;
  matchedKeywords?: string[];
}

export interface RAGConfig {
  maxKeywordResults: number;    // Max results from grep (default: 100)
  maxFinalResults: number;      // Max results to return (default: 10)
  keywordWeight: number;        // Weight for keyword score (0-1, default: 0.4)
  semanticWeight: number;       // Weight for semantic score (0-1, default: 0.6)
  minScore: number;             // Minimum combined score (default: 0.3)
  contextLines: number;         // Lines of context around match (default: 2)
  fileTypes?: string[];         // File extensions to search (e.g., ['.ts', '.md'])
  excludePatterns?: string[];   // Patterns to exclude
  useCache: boolean;            // Use embedding cache (default: true)
  embeddingModel: 'local' | 'openai';
}

export interface IndexStatus {
  totalFiles: number;
  indexedFiles: number;
  totalChunks: number;
  lastIndexed?: Date;
  indexSize: string;
  embeddingModel: string;
}

interface EmbeddingCache {
  [hash: string]: {
    embedding: number[];
    timestamp: number;
  };
}

// ============================================================================
// HybridRAGService
// ============================================================================

export class HybridRAGService {
  private defaultConfig: RAGConfig = {
    maxKeywordResults: 100,
    maxFinalResults: 10,
    keywordWeight: 0.4,
    semanticWeight: 0.6,
    minScore: 0.3,
    contextLines: 2,
    useCache: true,
    embeddingModel: 'local',
  };

  private embeddingCache: EmbeddingCache = {};
  private hasRipgrep: boolean;
  private openaiKey?: string;

  constructor(private pool: Pool) {
    // Check if ripgrep is available
    this.hasRipgrep = this.checkRipgrep();
    this.openaiKey = process.env.OPENAI_API_KEY;
    
    // Load embedding cache from DB on startup
    this.loadCacheFromDB().catch(console.error);
  }

  // ============================================================================
  // Main Search Function
  // ============================================================================

  /**
   * Hybrid search: grep first, then semantic ranking
   */
  async search(
    query: string, 
    paths: string[], 
    config?: Partial<RAGConfig>
  ): Promise<SearchResult[]> {
    const cfg = { ...this.defaultConfig, ...config };
    const startTime = Date.now();

    // Validate paths
    const validPaths = paths.filter(p => fs.existsSync(p));
    if (validPaths.length === 0) {
      console.warn('[HybridRAG] No valid paths provided');
      return [];
    }

    // Step 1: Fast keyword search with grep/ripgrep
    console.log(`[HybridRAG] Step 1: Grep search for "${query.substring(0, 50)}..."`);
    const keywordResults = await this.grepSearch(query, validPaths, cfg);
    
    if (keywordResults.length === 0) {
      console.log('[HybridRAG] No keyword matches found');
      return [];
    }
    console.log(`[HybridRAG] Found ${keywordResults.length} keyword matches`);

    // Step 2: Get query embedding
    console.log('[HybridRAG] Step 2: Computing embeddings');
    const queryEmbedding = await this.getEmbedding(query, cfg);

    // Step 3: Add semantic scores to results
    const resultsWithSemantics = await this.addSemanticScores(
      keywordResults, 
      queryEmbedding, 
      cfg
    );

    // Step 4: Combine scores and rank
    const ranked = this.rankResults(resultsWithSemantics, cfg);

    // Step 5: Filter and return top results
    const finalResults = ranked
      .filter(r => r.combinedScore >= cfg.minScore)
      .slice(0, cfg.maxFinalResults);

    const elapsed = Date.now() - startTime;
    console.log(`[HybridRAG] Search completed in ${elapsed}ms, returning ${finalResults.length} results`);

    // Log to audit
    await this.logSearch(query, paths, finalResults.length, elapsed);

    return finalResults;
  }

  // ============================================================================
  // Grep/Ripgrep Search
  // ============================================================================

  /**
   * Fast grep/ripgrep search for initial candidate selection
   */
  private async grepSearch(
    query: string, 
    paths: string[], 
    config: RAGConfig
  ): Promise<SearchResult[]> {
    // Extract keywords from query (tokenization)
    const keywords = this.extractKeywords(query);
    
    if (keywords.length === 0) {
      return [];
    }

    // Build search pattern (OR of all keywords)
    const pattern = keywords.join('|');

    if (this.hasRipgrep) {
      return this.ripgrepSearch(pattern, keywords, paths, config);
    } else {
      return this.grepFallback(pattern, keywords, paths, config);
    }
  }

  /**
   * Ripgrep search (faster, more features)
   */
  private ripgrepSearch(
    pattern: string,
    keywords: string[],
    paths: string[],
    config: RAGConfig
  ): Promise<SearchResult[]> {
    return new Promise((resolve) => {
      const results: SearchResult[] = [];
      
      // Build ripgrep args
      const args = [
        '--ignore-case',
        '--line-number',
        '--no-heading',
        '--with-filename',
        `--max-count=${config.maxKeywordResults}`,
        `--context=${config.contextLines}`,
        '--color=never',
      ];

      // Add file type filters
      if (config.fileTypes?.length) {
        for (const ext of config.fileTypes) {
          args.push('--glob', `*${ext}`);
        }
      }

      // Add exclude patterns
      if (config.excludePatterns?.length) {
        for (const pat of config.excludePatterns) {
          args.push('--glob', `!${pat}`);
        }
      }

      // Common excludes
      args.push('--glob', '!node_modules/**');
      args.push('--glob', '!.git/**');
      args.push('--glob', '!dist/**');
      args.push('--glob', '!*.min.js');

      args.push(pattern, ...paths);

      const rg = spawn('rg', args);
      let output = '';
      let errorOutput = '';

      rg.stdout.on('data', (data) => { output += data.toString(); });
      rg.stderr.on('data', (data) => { errorOutput += data.toString(); });

      rg.on('close', (code) => {
        if (code !== 0 && code !== 1) { // 1 = no matches (ok)
          console.warn('[HybridRAG] ripgrep error:', errorOutput);
        }

        const parsed = this.parseRipgrepOutput(output, keywords, config);
        resolve(parsed);
      });

      rg.on('error', (err) => {
        console.error('[HybridRAG] ripgrep spawn error:', err);
        resolve([]);
      });
    });
  }

  /**
   * Parse ripgrep output with context
   */
  private parseRipgrepOutput(
    output: string, 
    keywords: string[],
    config: RAGConfig
  ): SearchResult[] {
    const results: SearchResult[] = [];
    const lines = output.split('\n').filter(Boolean);
    
    let currentFile = '';
    let currentContext: string[] = [];
    let currentMatch: SearchResult | null = null;

    for (const line of lines) {
      // Context separator
      if (line === '--') {
        if (currentMatch) {
          currentMatch.context = [...currentContext];
          results.push(currentMatch);
          currentMatch = null;
          currentContext = [];
        }
        continue;
      }

      // Parse: file:line:content or file-line-content (context)
      const matchLine = line.match(/^(.+?):(\d+):(.*)$/);
      const contextLine = line.match(/^(.+?)-(\d+)-(.*)$/);

      if (matchLine) {
        // This is a match line
        if (currentMatch) {
          currentMatch.context = [...currentContext];
          results.push(currentMatch);
          currentContext = [];
        }

        const [, file, lineNum, content] = matchLine;
        const keywordScore = this.calculateKeywordScore(content, keywords);
        const matchedKeywords = this.findMatchedKeywords(content, keywords);

        currentFile = file;
        currentMatch = {
          file,
          line: parseInt(lineNum),
          content: content.trim(),
          keywordScore,
          combinedScore: keywordScore,
          matchedKeywords,
        };
      } else if (contextLine) {
        // This is a context line
        const [, , , content] = contextLine;
        currentContext.push(content.trim());
      }
    }

    // Don't forget the last match
    if (currentMatch) {
      currentMatch.context = currentContext;
      results.push(currentMatch);
    }

    return results;
  }

  /**
   * Grep fallback (when ripgrep not available)
   */
  private async grepFallback(
    pattern: string,
    keywords: string[],
    paths: string[],
    config: RAGConfig
  ): Promise<SearchResult[]> {
    return new Promise((resolve) => {
      const results: SearchResult[] = [];

      // Build grep args
      const args = [
        '-r',                        // Recursive
        '-i',                        // Case insensitive
        '-n',                        // Line numbers
        '-E',                        // Extended regex
        `--include=*.ts`,            // TypeScript files
        `--include=*.js`,
        `--include=*.md`,
        `--include=*.json`,
        '--exclude-dir=node_modules',
        '--exclude-dir=.git',
        '--exclude-dir=dist',
        pattern,
        ...paths
      ];

      const grep = spawn('grep', args);
      let output = '';

      grep.stdout.on('data', (data) => { output += data.toString(); });

      grep.on('close', () => {
        const lines = output.split('\n').filter(Boolean).slice(0, config.maxKeywordResults);

        for (const line of lines) {
          // Parse: file:line:content
          const match = line.match(/^(.+?):(\d+):(.*)$/);
          if (match) {
            const [, file, lineNum, content] = match;
            const keywordScore = this.calculateKeywordScore(content, keywords);

            results.push({
              file,
              line: parseInt(lineNum),
              content: content.trim(),
              keywordScore,
              combinedScore: keywordScore,
              matchedKeywords: this.findMatchedKeywords(content, keywords),
            });
          }
        }

        resolve(results);
      });

      grep.on('error', () => resolve([]));
    });
  }

  // ============================================================================
  // Keyword Scoring
  // ============================================================================

  /**
   * Extract meaningful keywords from query
   */
  private extractKeywords(query: string): string[] {
    // Stopwords to exclude
    const stopwords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'shall',
      'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in',
      'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
      'through', 'during', 'before', 'after', 'above', 'below',
      'between', 'under', 'again', 'further', 'then', 'once',
      'here', 'there', 'when', 'where', 'why', 'how', 'all',
      'each', 'few', 'more', 'most', 'other', 'some', 'such',
      'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
      'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because',
      'until', 'while', 'this', 'that', 'these', 'those', 'what',
      'which', 'who', 'whom', 'find', 'show', 'get', 'search',
    ]);

    return query
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')     // Remove punctuation except hyphens
      .split(/\s+/)
      .filter(k => k.length > 2 && !stopwords.has(k))
      .slice(0, 10);                  // Max 10 keywords
  }

  /**
   * Calculate keyword match score (0-1)
   */
  private calculateKeywordScore(content: string, keywords: string[]): number {
    if (keywords.length === 0) return 0;

    const lower = content.toLowerCase();
    let totalWeight = 0;

    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        // Exact word boundary match = 1.0
        if (new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'i').test(content)) {
          totalWeight += 1.0;
        } 
        // Partial match = 0.5
        else {
          totalWeight += 0.5;
        }
      }
    }

    // Normalize to 0-1
    return Math.min(1, totalWeight / keywords.length);
  }

  /**
   * Find which keywords matched
   */
  private findMatchedKeywords(content: string, keywords: string[]): string[] {
    const lower = content.toLowerCase();
    return keywords.filter(k => lower.includes(k));
  }

  // ============================================================================
  // Embedding Functions
  // ============================================================================

  /**
   * Get embedding for text (with caching)
   */
  private async getEmbedding(text: string, config: RAGConfig): Promise<number[]> {
    // Generate cache key
    const cacheKey = crypto.createHash('md5').update(text).digest('hex');

    // Check cache
    if (config.useCache && this.embeddingCache[cacheKey]) {
      return this.embeddingCache[cacheKey].embedding;
    }

    // Generate embedding
    let embedding: number[];
    
    if (config.embeddingModel === 'openai' && this.openaiKey) {
      embedding = await this.getOpenAIEmbedding(text);
    } else {
      embedding = this.getLocalEmbedding(text);
    }

    // Cache it
    if (config.useCache) {
      this.embeddingCache[cacheKey] = {
        embedding,
        timestamp: Date.now(),
      };
    }

    return embedding;
  }

  /**
   * OpenAI embeddings (text-embedding-3-small)
   */
  private async getOpenAIEmbedding(text: string): Promise<number[]> {
    if (!this.openaiKey) {
      return this.getLocalEmbedding(text);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.substring(0, 8000), // Max input length
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json() as { data: Array<{ embedding: number[] }> };
      return data.data[0].embedding;
    } catch (error) {
      console.error('[HybridRAG] OpenAI embedding error:', error);
      return this.getLocalEmbedding(text);
    }
  }

  /**
   * Local embedding (TF-IDF inspired hashing)
   * Not as good as neural embeddings but works offline
   */
  private getLocalEmbedding(text: string): number[] {
    const dimension = 384;
    const embedding = new Array(dimension).fill(0);
    
    // Tokenize
    const tokens = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 1);

    // Generate pseudo-embedding using hashing
    for (const token of tokens) {
      const hash = this.hashString(token);
      
      // Distribute token influence across multiple dimensions
      for (let i = 0; i < 8; i++) {
        const idx = Math.abs((hash + i * 31) % dimension);
        const sign = ((hash >> i) & 1) === 0 ? 1 : -1;
        embedding[idx] += sign * (1.0 / Math.sqrt(tokens.length));
      }
    }

    // Normalize to unit vector
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < dimension; i++) {
        embedding[i] /= norm;
      }
    }

    return embedding;
  }

  /**
   * Add semantic scores to grep results
   */
  private async addSemanticScores(
    results: SearchResult[], 
    queryEmbedding: number[],
    config: RAGConfig
  ): Promise<SearchResult[]> {
    // Batch process for efficiency
    const batchSize = 20;
    
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (result) => {
        // Combine content with context for better semantic understanding
        const fullText = result.context 
          ? [...result.context, result.content].join(' ')
          : result.content;
          
        const contentEmbedding = await this.getEmbedding(fullText, config);
        result.semanticScore = this.cosineSimilarity(queryEmbedding, contentEmbedding);
      }));
    }

    return results;
  }

  // ============================================================================
  // Ranking
  // ============================================================================

  /**
   * Combine keyword and semantic scores, then rank
   */
  private rankResults(results: SearchResult[], config: RAGConfig): SearchResult[] {
    for (const result of results) {
      const kw = result.keywordScore * config.keywordWeight;
      const sem = (result.semanticScore || 0) * config.semanticWeight;
      
      // Boost for more matched keywords
      const keywordBoost = result.matchedKeywords 
        ? Math.min(0.1, result.matchedKeywords.length * 0.02)
        : 0;

      result.combinedScore = kw + sem + keywordBoost;
    }

    // Sort by combined score descending
    return results.sort((a, b) => b.combinedScore - a.combinedScore);
  }

  // ============================================================================
  // Index Management
  // ============================================================================

  /**
   * Get index status
   */
  async getIndexStatus(paths: string[]): Promise<IndexStatus> {
    let totalFiles = 0;
    let indexedFiles = 0;

    for (const basePath of paths) {
      if (!fs.existsSync(basePath)) continue;

      // Count files
      try {
        const output = execSync(
          `find "${basePath}" -type f \\( -name "*.ts" -o -name "*.js" -o -name "*.md" \\) | wc -l`,
          { encoding: 'utf-8' }
        );
        totalFiles += parseInt(output.trim()) || 0;
      } catch {
        // Ignore errors
      }
    }

    // Check DB for indexed chunks
    try {
      const result = await this.pool.query(`
        SELECT COUNT(*) as count FROM rag_embeddings WHERE 1=1
      `);
      indexedFiles = parseInt(result.rows[0]?.count || '0');
    } catch {
      // Table might not exist yet
    }

    // Get last indexed time
    let lastIndexed: Date | undefined;
    try {
      const result = await this.pool.query(`
        SELECT MAX(created_at) as last FROM rag_embeddings
      `);
      if (result.rows[0]?.last) {
        lastIndexed = new Date(result.rows[0].last);
      }
    } catch {
      // Ignore
    }

    return {
      totalFiles,
      indexedFiles,
      totalChunks: Object.keys(this.embeddingCache).length,
      lastIndexed,
      indexSize: this.formatBytes(JSON.stringify(this.embeddingCache).length),
      embeddingModel: this.openaiKey ? 'openai' : 'local',
    };
  }

  /**
   * Index files for faster semantic search
   */
  async indexFiles(paths: string[]): Promise<{ indexed: number; errors: number }> {
    let indexed = 0;
    let errors = 0;

    for (const basePath of paths) {
      if (!fs.existsSync(basePath)) continue;

      // Get all files
      const files = this.getFilesRecursive(basePath, ['.ts', '.js', '.md']);

      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          const chunks = this.chunkContent(content, file);

          for (const chunk of chunks) {
            const embedding = await this.getEmbedding(chunk.content, this.defaultConfig);
            
            // Store in DB
            await this.pool.query(`
              INSERT INTO rag_embeddings (file_path, chunk_index, content, embedding)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (file_path, chunk_index) 
              DO UPDATE SET content = $3, embedding = $4, updated_at = NOW()
            `, [file, chunk.index, chunk.content, JSON.stringify(embedding)]);

            indexed++;
          }
        } catch (err) {
          console.error(`[HybridRAG] Error indexing ${file}:`, err);
          errors++;
        }
      }
    }

    return { indexed, errors };
  }

  /**
   * Chunk file content for embedding
   */
  private chunkContent(content: string, filePath: string): Array<{ index: number; content: string }> {
    const chunks: Array<{ index: number; content: string }> = [];
    const lines = content.split('\n');
    const chunkSize = 50; // lines per chunk
    const overlap = 10;   // overlap for context

    for (let i = 0; i < lines.length; i += (chunkSize - overlap)) {
      const chunkLines = lines.slice(i, i + chunkSize);
      if (chunkLines.length > 5) { // Skip tiny chunks
        chunks.push({
          index: Math.floor(i / (chunkSize - overlap)),
          content: chunkLines.join('\n'),
        });
      }
    }

    return chunks;
  }

  // ============================================================================
  // Database & Cache
  // ============================================================================

  /**
   * Initialize DB tables
   */
  async initializeTables(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS rag_embeddings (
        id SERIAL PRIMARY KEY,
        file_path TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(file_path, chunk_index)
      );

      CREATE INDEX IF NOT EXISTS idx_rag_embeddings_file ON rag_embeddings(file_path);
      
      CREATE TABLE IF NOT EXISTS rag_search_log (
        id SERIAL PRIMARY KEY,
        query TEXT NOT NULL,
        paths TEXT[] NOT NULL,
        result_count INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
  }

  /**
   * Load embedding cache from DB
   */
  private async loadCacheFromDB(): Promise<void> {
    try {
      const result = await this.pool.query(`
        SELECT file_path, chunk_index, content, embedding 
        FROM rag_embeddings 
        ORDER BY updated_at DESC 
        LIMIT 1000
      `);

      for (const row of result.rows) {
        const cacheKey = crypto.createHash('md5').update(row.content).digest('hex');
        this.embeddingCache[cacheKey] = {
          embedding: row.embedding,
          timestamp: Date.now(),
        };
      }

      console.log(`[HybridRAG] Loaded ${result.rows.length} embeddings from cache`);
    } catch {
      // Table might not exist yet
    }
  }

  /**
   * Log search for analytics
   */
  private async logSearch(
    query: string, 
    paths: string[], 
    resultCount: number, 
    durationMs: number
  ): Promise<void> {
    try {
      await this.pool.query(`
        INSERT INTO rag_search_log (query, paths, result_count, duration_ms)
        VALUES ($1, $2, $3, $4)
      `, [query, paths, resultCount, durationMs]);
    } catch {
      // Ignore logging errors
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private checkRipgrep(): boolean {
    try {
      execSync('which rg', { encoding: 'utf-8' });
      return true;
    } catch {
      console.log('[HybridRAG] ripgrep not found, using grep fallback');
      return false;
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return hash >>> 0;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  private getFilesRecursive(dir: string, extensions: string[]): string[] {
    const files: string[] = [];
    
    const walk = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip common ignored directories
          if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
            walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    };

    walk(dir);
    return files;
  }
}

// ============================================================================
// Export singleton factory
// ============================================================================

let ragService: HybridRAGService | null = null;

export function getHybridRAGService(pool: Pool): HybridRAGService {
  if (!ragService) {
    ragService = new HybridRAGService(pool);
  }
  return ragService;
}
