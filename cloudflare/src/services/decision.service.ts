{
  "code": "// decision-service.ts
import { Decision, Policy } from './types';
import { D1Database } from 'cloudflare:workers';

const DECISIONS_TABLE = 'decisions';
const POLICIES_TABLE = 'policies';

export default {
  async evaluateDecision(action: string, context: any, agentPolicy: Policy): Promise<Decision> {
    const { max_risk_level, required_approvals, allowed_tasks, min_confidence } = agentPolicy;
    const { risk, reversibility, confidence } = context;

    if (!allowed_tasks.includes(action)) {
      throw new Error(`Action '${action}' not allowed for this agent`);
    }

    const decisionMatrix: { [key: string]: string } = {
      'low_reversible_high_confidence': 'act',
      'low_reversible_medium_confidence': 'confirm',
      'low_reversible_low_confidence': 'defer',
      'medium_reversible_high_confidence': 'act',
      'medium_reversible_medium_confidence': 'confirm',
      'medium_reversible_low_confidence': 'escalate',
      'high_reversible_high_confidence': 'confirm',
      'high_reversible_medium_confidence': '