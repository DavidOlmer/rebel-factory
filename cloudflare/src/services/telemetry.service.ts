{
  "code": "// telemetry-service.ts
import { AnalyticsEngine } from '@cloudflare/workers-analytics-engine';
import { D1Database } from '@cloudflare/d1';

interface Metrics {
  tokensIn: number;
  tokensOut: number;
  tokensTotal: number;
  durationMs: number;
  success: boolean;
  userRating: number;
  qualityScore: number;
}

interface AgentStats {
  runs: number;
  tokensIn: number;
  tokensOut: number;
  tokensTotal: number;
  durationMs: number;
  success: number;
  failure: number;
  userRating: number;
  qualityScore: number;
}

interface TenantCosts {
  total: number;
  models: { [model: string]: number };
}

const ANALYTICS_ENGINE_DATASET = 'telemetry';
const D1_DB = 'telemetry-db';

export default {
  async logRun(agentId: string, metrics: Metrics) {
    const db = await D1Database.get(D1_DB);
    await db.run(`INSERT INTO runs (agent_id, tokens_in, tokens_out, tokens_total, duration_ms, success, user_rating, quality_score)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)