{
  "code": "
// health-monitoring-service.ts
import { Context } from 'cloudflare:workers';

interface HealthCheck {
  agentId: string;
  successRate: number;
  errorDiversity: number;
  decisionConsistency: number;
  healthScore: number;
  failureMode: string | null;
}

interface Run {
  success: boolean;
  error: string | null;
}

export default {
  async assessHealth(agentId: string, recentRuns: Run[]) {
    const successRate = recentRuns.filter(run => run.success).length / recentRuns.length;
    const errorDiversity = new Set(recentRuns.filter(run => !run.success).map(run => run.error)).size;
    const decisionConsistency = recentRuns.filter((run, index, self) => index === self.findIndex(r => r.error === run.error)).length / recentRuns.length;

    const healthScore = this.calculateHealthScore(successRate, errorDiversity, decisionConsistency);

    const symptoms = recentRuns.map(run => run.error);
    const failureMode = this.detectFailureMode(symptoms);

    const healthCheck: HealthCheck = {
      agentId,
      successRate,
      errorDiversity,
      decision