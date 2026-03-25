{
  "code": "// Import required libraries
import { D1Database } from '@cloudflare/workers-types/experimental';

// Define the memory consolidation service
export default {
  async consolidate(agentId: string, batchSize: number = 100) {
    // Fetch unconsolidated memories from D1
    const memories = await fetchUnconsolidatedMemories(agentId, batchSize);

    // Cluster memories by Jaccard similarity
    const clusters = clusterMemoriesByJaccardSimilarity(memories, 0.7);

    // Extract patterns from each cluster
    const patterns = await Promise.all(clusters.map(cluster => extractPatterns(cluster)));

    // Store patterns in D1
    await storePatterns(agentId, patterns);
  },

  async extractPatterns(cluster: string[]) {
    // Extract common words/tags from the cluster
    const commonWords = extractCommonWords(cluster);

    // Calculate confidence score
    const confidence = calculateConfidence(commonWords, cluster);

    // Create pattern object
    const pattern = {
      description: commonWords.join(', '),
      tags: commonWords,
      confidence,
      exampleCount: cluster.length,
    };

    return pattern;
  },

  async getPatterns(agentId: string