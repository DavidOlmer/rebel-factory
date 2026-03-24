/**
 * Trigram Index Service
 * Cursor-style fast regex search
 * 
 * Flow: Build index → Query decompose → Index lookup → ripgrep verify
 * 
 * Based on Cursor's blog post about their search architecture:
 * - Trigram index for fast candidate filtering
 * - Position masks track where trigrams occur (mod 8)
 * - Next-char bloom filters for additional pruning
 * - Final verification with ripgrep on candidates only
 */
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TrigramPosting {
  fileId: number;
  positionMask: number;  // 8-bit: positions mod 8
  nextCharMask: number;  // 8-bit bloom filter for following chars
}

interface TrigramIndex {
  trigrams: Map<string, TrigramPosting[]>;
  files: string[];  // fileId -> filepath
  lastUpdated: Date;
  rootPath: string;
}

export interface SearchResult {
  file: string;
  line: number;
  content: string;
  matchCount: number;
}

export interface IndexStats {
  files: number;
  trigrams: number;
  lastUpdated: Date | null;
  rootPath: string | null;
  indexSizeBytes: number;
}

export interface BuildProgress {
  phase: 'scanning' | 'indexing' | 'saving' | 'complete';
  filesFound: number;
  filesIndexed: number;
  trigramsFound: number;
}

export class TrigramIndexService {
  private index: TrigramIndex | null = null;
  private indexPath: string;
  private building: boolean = false;
  private buildProgress: BuildProgress | null = null;

  constructor(indexPath: string = '/tmp/trigram-index.json') {
    this.indexPath = indexPath;
  }

  /**
   * Build trigram index for a directory
   * Scans all files with given extensions and creates trigram postings
   */
  async buildIndex(
    rootPath: string, 
    extensions: string[] = ['.ts', '.js', '.tsx', '.jsx', '.py', '.md', '.json', '.yaml', '.yml']
  ): Promise<BuildProgress> {
    if (this.building) {
      throw new Error('Index build already in progress');
    }

    this.building = true;
    this.buildProgress = {
      phase: 'scanning',
      filesFound: 0,
      filesIndexed: 0,
      trigramsFound: 0,
    };

    try {
      console.log(`[Trigram] Building index for ${rootPath}...`);
      
      const index: TrigramIndex = {
        trigrams: new Map(),
        files: [],
        lastUpdated: new Date(),
        rootPath: path.resolve(rootPath),
      };

      // Phase 1: Find all files
      this.buildProgress.phase = 'scanning';
      const files = await this.findFiles(rootPath, extensions);
      this.buildProgress.filesFound = files.length;
      
      console.log(`[Trigram] Found ${files.length} files to index`);

      // Phase 2: Index each file
      this.buildProgress.phase = 'indexing';
      
      for (let fileId = 0; fileId < files.length; fileId++) {
        const filepath = files[fileId];
        index.files.push(filepath);
        
        try {
          const content = fs.readFileSync(filepath, 'utf-8');
          
          // Skip very large files (> 1MB)
          if (content.length > 1024 * 1024) {
            console.log(`[Trigram] Skipping large file: ${filepath}`);
            continue;
          }
          
          this.indexFileContent(content, fileId, index);
          this.buildProgress.filesIndexed++;
          this.buildProgress.trigramsFound = index.trigrams.size;
          
          // Log progress every 100 files
          if (fileId % 100 === 0 && fileId > 0) {
            console.log(`[Trigram] Indexed ${fileId}/${files.length} files...`);
          }
        } catch (e) {
          // Skip unreadable files silently
        }
      }

      // Phase 3: Save index
      this.buildProgress.phase = 'saving';
      this.index = index;
      await this.saveIndex();
      
      this.buildProgress.phase = 'complete';
      
      console.log(`[Trigram] Complete: ${files.length} files, ${index.trigrams.size} unique trigrams`);
      
      return this.buildProgress;
    } finally {
      this.building = false;
    }
  }

  /**
   * Extract and index all trigrams from file content
   * Creates posting with position mask and next-char bloom filter
   */
  private indexFileContent(content: string, fileId: number, index: TrigramIndex): void {
    const lower = content.toLowerCase();
    
    for (let i = 0; i < lower.length - 2; i++) {
      const trigram = lower.substring(i, i + 3);
      
      // Skip trigrams with newlines or tabs
      if (trigram.includes('\n') || trigram.includes('\t') || trigram.includes('\r')) {
        continue;
      }
      
      // Calculate position mask (which positions mod 8)
      // This helps filter false positives when pattern position matters
      const posMask = 1 << (i % 8);
      
      // Calculate next-char bloom filter
      // Helps filter when we know what char should follow
      const nextChar = i + 3 < lower.length ? lower.charCodeAt(i + 3) : 0;
      const nextMask = nextChar ? (1 << (nextChar % 8)) : 0;
      
      // Add to index
      if (!index.trigrams.has(trigram)) {
        index.trigrams.set(trigram, []);
      }
      
      const postings = index.trigrams.get(trigram)!;
      const existing = postings.find(p => p.fileId === fileId);
      
      if (existing) {
        // Merge masks for existing posting
        existing.positionMask |= posMask;
        existing.nextCharMask |= nextMask;
      } else {
        postings.push({ fileId, positionMask: posMask, nextCharMask: nextMask });
      }
    }
  }

  /**
   * Search using regex pattern
   * Decomposes pattern to trigrams, looks up candidates, verifies with ripgrep
   */
  async search(pattern: string, maxResults: number = 50): Promise<SearchResult[]> {
    if (!this.index) {
      await this.loadIndex();
      if (!this.index) {
        throw new Error('No index available. Run buildIndex first.');
      }
    }

    const startTime = Date.now();

    // Step 1: Extract trigrams from pattern
    const trigrams = this.extractTrigrams(pattern);
    
    if (trigrams.length === 0) {
      // No trigrams extractable (e.g., pattern too short or all special chars)
      // Fall back to full search
      console.log(`[Trigram] Pattern "${pattern}": no trigrams, falling back to full search`);
      return this.fullSearch(pattern, maxResults);
    }

    // Step 2: Find candidate files (intersection of posting lists)
    const candidates = this.findCandidates(trigrams);
    
    const filterTime = Date.now() - startTime;
    console.log(`[Trigram] Pattern "${pattern}": ${trigrams.length} trigrams, ${candidates.length}/${this.index.files.length} candidates (${filterTime}ms filter)`);

    if (candidates.length === 0) {
      return [];
    }

    // Step 3: Verify with ripgrep on candidates only
    const results = await this.verifyWithRipgrep(pattern, candidates, maxResults);
    
    const totalTime = Date.now() - startTime;
    console.log(`[Trigram] Found ${results.length} matches in ${totalTime}ms`);
    
    return results;
  }

  /**
   * Extract literal trigrams from search pattern
   * Removes regex special characters first
   */
  private extractTrigrams(pattern: string): string[] {
    // Remove regex special chars for trigram extraction
    // Keep alphanumeric, spaces (will filter), and common chars
    const literal = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '')
      .toLowerCase();
    
    const trigrams: string[] = [];
    
    for (let i = 0; i < literal.length - 2; i++) {
      const tri = literal.substring(i, i + 3);
      
      // Skip trigrams with spaces (they're less useful)
      if (tri.includes(' ')) continue;
      
      if (tri.length === 3) {
        trigrams.push(tri);
      }
    }
    
    // Deduplicate and return
    return [...new Set(trigrams)];
  }

  /**
   * Find files that contain ALL trigrams
   * Intersects posting lists for each trigram
   */
  private findCandidates(trigrams: string[]): string[] {
    if (!this.index) return [];
    
    // Get posting lists for each trigram
    const postingLists = trigrams
      .map(t => this.index!.trigrams.get(t) || [])
      .filter(p => p.length > 0);
    
    if (postingLists.length === 0) return [];
    
    // Sort by posting list size (smallest first for efficient intersection)
    postingLists.sort((a, b) => a.length - b.length);
    
    // Start with smallest posting list
    let candidates = new Set(postingLists[0].map(p => p.fileId));
    
    // Intersect with remaining lists
    for (let i = 1; i < postingLists.length; i++) {
      const fileIds = new Set(postingLists[i].map(p => p.fileId));
      candidates = new Set([...candidates].filter(id => fileIds.has(id)));
      
      // Early exit if no candidates left
      if (candidates.size === 0) break;
    }
    
    // Convert to file paths
    return [...candidates].map(id => this.index!.files[id]).filter(Boolean);
  }

  /**
   * Verify matches with ripgrep
   * Only runs on candidate files, making it fast
   */
  private async verifyWithRipgrep(
    pattern: string, 
    files: string[], 
    maxResults: number
  ): Promise<SearchResult[]> {
    if (files.length === 0) return [];
    
    return new Promise((resolve) => {
      const results: SearchResult[] = [];
      
      // Build ripgrep args
      const args = [
        '--ignore-case',
        '--line-number',
        '--no-heading',
        '--max-count', String(Math.min(maxResults * 2, 1000)), // Get extra for dedup
        '--color', 'never',
        pattern,
        ...files.slice(0, 1000) // Limit files to avoid arg length issues
      ];
      
      const rg = spawn('rg', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      
      rg.stdout.on('data', (data) => { 
        stdout += data.toString(); 
      });
      
      rg.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      rg.on('close', (code) => {
        if (stderr && code !== 0 && code !== 1) {
          console.error(`[Trigram] ripgrep error: ${stderr}`);
        }
        
        const lines = stdout.split('\n').filter(Boolean);
        
        for (const line of lines) {
          // Parse ripgrep output: filepath:linenum:content
          const match = line.match(/^(.+?):(\d+):(.*)$/);
          if (match) {
            results.push({
              file: match[1],
              line: parseInt(match[2], 10),
              content: match[3].trim().substring(0, 500), // Limit content length
              matchCount: 1,
            });
          }
          
          if (results.length >= maxResults) break;
        }
        
        resolve(results.slice(0, maxResults));
      });

      rg.on('error', (err) => {
        console.error(`[Trigram] ripgrep spawn error: ${err.message}`);
        resolve([]);
      });
      
      // Timeout after 30s
      setTimeout(() => {
        rg.kill('SIGTERM');
      }, 30000);
    });
  }

  /**
   * Fallback full search when no trigrams can be extracted
   */
  private async fullSearch(pattern: string, maxResults: number): Promise<SearchResult[]> {
    if (!this.index) return [];
    return this.verifyWithRipgrep(pattern, this.index.files, maxResults);
  }

  /**
   * Find files in directory matching extensions
   * Skips hidden dirs, node_modules, etc.
   */
  private async findFiles(dir: string, extensions: string[]): Promise<string[]> {
    const files: string[] = [];
    const ignoreDirs = new Set([
      'node_modules', '.git', '.next', 'dist', 'build', 
      '__pycache__', '.venv', 'venv', 'coverage', '.turbo'
    ]);
    
    const walk = (currentDir: string, depth: number = 0) => {
      // Limit depth to avoid infinite recursion
      if (depth > 20) return;
      
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          // Skip hidden files/dirs and ignored dirs
          if (entry.name.startsWith('.')) continue;
          if (ignoreDirs.has(entry.name)) continue;
          
          const fullPath = path.join(currentDir, entry.name);
          
          if (entry.isDirectory()) {
            walk(fullPath, depth + 1);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (e) {
        // Permission denied or other fs error, skip
      }
    };
    
    walk(path.resolve(dir));
    return files;
  }

  /**
   * Save index to disk as JSON
   */
  private async saveIndex(): Promise<void> {
    if (!this.index) return;
    
    // Convert Map to object for JSON serialization
    const trigramObj: Record<string, TrigramPosting[]> = {};
    for (const [key, value] of this.index.trigrams) {
      trigramObj[key] = value;
    }
    
    const data = {
      version: 1,
      files: this.index.files,
      trigrams: trigramObj,
      lastUpdated: this.index.lastUpdated.toISOString(),
      rootPath: this.index.rootPath,
    };
    
    const json = JSON.stringify(data);
    fs.writeFileSync(this.indexPath, json);
    
    console.log(`[Trigram] Saved index to ${this.indexPath} (${(json.length / 1024 / 1024).toFixed(2)} MB)`);
  }

  /**
   * Load index from disk
   */
  private async loadIndex(): Promise<void> {
    try {
      if (!fs.existsSync(this.indexPath)) {
        this.index = null;
        return;
      }
      
      const json = fs.readFileSync(this.indexPath, 'utf-8');
      const data = JSON.parse(json);
      
      // Convert object back to Map
      const trigrams = new Map<string, TrigramPosting[]>();
      for (const [key, value] of Object.entries(data.trigrams)) {
        trigrams.set(key, value as TrigramPosting[]);
      }
      
      this.index = {
        files: data.files,
        trigrams,
        lastUpdated: new Date(data.lastUpdated),
        rootPath: data.rootPath || '',
      };
      
      console.log(`[Trigram] Loaded index: ${this.index.files.length} files, ${this.index.trigrams.size} trigrams`);
    } catch (e) {
      console.error(`[Trigram] Failed to load index: ${e}`);
      this.index = null;
    }
  }

  /**
   * Force reload index from disk
   */
  async reloadIndex(): Promise<void> {
    this.index = null;
    await this.loadIndex();
  }

  /**
   * Check if index exists
   */
  hasIndex(): boolean {
    return this.index !== null || fs.existsSync(this.indexPath);
  }

  /**
   * Get build progress (if building)
   */
  getBuildProgress(): BuildProgress | null {
    return this.buildProgress;
  }

  /**
   * Get index statistics
   */
  getStats(): IndexStats {
    let indexSizeBytes = 0;
    try {
      if (fs.existsSync(this.indexPath)) {
        indexSizeBytes = fs.statSync(this.indexPath).size;
      }
    } catch (e) {}
    
    return {
      files: this.index?.files.length || 0,
      trigrams: this.index?.trigrams.size || 0,
      lastUpdated: this.index?.lastUpdated || null,
      rootPath: this.index?.rootPath || null,
      indexSizeBytes,
    };
  }

  /**
   * Incremental update: add or update a single file
   */
  async updateFile(filepath: string): Promise<void> {
    if (!this.index) {
      await this.loadIndex();
      if (!this.index) {
        throw new Error('No index available');
      }
    }

    const resolvedPath = path.resolve(filepath);
    let fileId = this.index.files.indexOf(resolvedPath);
    
    // Remove old postings if file exists in index
    if (fileId !== -1) {
      for (const postings of this.index.trigrams.values()) {
        const idx = postings.findIndex(p => p.fileId === fileId);
        if (idx !== -1) {
          postings.splice(idx, 1);
        }
      }
    } else {
      // New file
      fileId = this.index.files.length;
      this.index.files.push(resolvedPath);
    }

    // Add new postings
    try {
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      this.indexFileContent(content, fileId, this.index);
      this.index.lastUpdated = new Date();
      await this.saveIndex();
    } catch (e) {
      // File might be deleted, that's ok
    }
  }

  /**
   * Get top trigrams by frequency (for debugging)
   */
  getTopTrigrams(limit: number = 20): Array<{ trigram: string; count: number }> {
    if (!this.index) return [];
    
    const entries = [...this.index.trigrams.entries()]
      .map(([trigram, postings]) => ({ trigram, count: postings.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
    
    return entries;
  }
}

// Singleton instance for the application
let instance: TrigramIndexService | null = null;

export function getTrigramIndexService(indexPath?: string): TrigramIndexService {
  if (!instance) {
    instance = new TrigramIndexService(indexPath);
  }
  return instance;
}

export default TrigramIndexService;
