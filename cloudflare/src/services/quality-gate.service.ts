{
  "code": "// quality-gate-service.ts
import { D1Database } from '@cloudflare/workers-types/experimental';

interface ReviewResult {
  score: number;
  deductions: { type: 'critical' | 'high' | 'medium' | 'low'; description: string }[];
}

interface QualityGateService {
  async runQualityGate(code: string, stage: 'architecture' | 'codeQuality' | 'tests' | 'performance'): Promise<ReviewResult>;
  async runFullReview(code: string): Promise<{ [stage: string]: ReviewResult }>;
  async getReviewHistory(agentId: string): Promise<{ [stage: string]: ReviewResult }[]>;
}

export default class QualityGateService implements QualityGateService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async runQualityGate(code: string, stage: 'architecture' | 'codeQuality' | 'tests' | 'performance'): Promise<ReviewResult> {
    let score = 100;
    const deductions: { type: 'critical' | 'high' | 'medium' | 'low'; description: string }[] = [];

    switch (stage