{
  "code": "import { Hono } from 'hono';
import { Vectorize } from '@cloudflare/vectorize';
import { Ai } from '@cloudflare/ai';

const app = new Hono();
const ai = new Ai();
const vectorize = new Vectorize();

// Define the weights for keyword and semantic scores
const KEYWORD_WEIGHT = 0.4;
const SEMANTIC_WEIGHT = 0.6;
const SCORE_THRESHOLD = 0.3;

// Initialize the D1 database and Vectorize index
const d1 = await D1.get('DATABASE_NAME');
const trigramIndex = await d1.prepare('CREATE TABLE IF NOT EXISTS trigram_index (id TEXT, content TEXT)').run();
const vectorizeIndex = await vectorize.createIndex('index-name', {
  dimensions: 768,
});

// Function to generate trigrams for a given string
function generateTrigrams(str: string): string[] {
  const trigrams: string[] = [];
  for (let i = 0; i < str.length - 2; i++) {
    trigrams.push(str.substring(i, i + 3));
  }
  return trigrams;
}

// Function to search for documents
async function search(query: string