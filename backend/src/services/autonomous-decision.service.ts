/**
 * Autonomous Agents - Decision matrix for when to act vs escalate
 * Based on KB: Autonomous Agents
 * 
 * Core principle: agents should know their boundaries and escalate appropriately
 */

export type DecisionType = 'act' | 'escalate' | 'confirm' | 'defer';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

interface DecisionContext {
  agentId: string;
  taskType: string;
  taskDescription?: string;
  estimatedImpact: RiskLevel;
  reversible: boolean;
  confidence: number;  // 0-100
  previousAttempts: number;
  timeConstraint?: Date;
  affectedResources?: string[];
  requiredCapabilities?: string[];
}

interface DecisionResult {
  decision: DecisionType;
  reasoning: string;
  requiredApprovals?: string[];
  suggestedAction?: string;
  timeoutMs?: number;
  alternativeActions?: string[];
}

interface DecisionHistory {
  timestamp: Date;
  context: DecisionContext;
  result: DecisionResult;
  outcome?: 'success' | 'failure' | 'pending';
}

interface AgentDecisionPolicy {
  agentId: string;
  maxRiskLevel: RiskLevel;
  requireConfirmationAbove: RiskLevel;
  maxRetries: number;
  minConfidence: number;
  allowedTaskTypes: string[];
  blockedTaskTypes: string[];
  customRules?: DecisionRule[];
}

interface DecisionRule {
  name: string;
  condition: (context: DecisionContext) => boolean;
  decision: DecisionType;
  reasoning: string;
}

export class AutonomousDecisionService {
  // Decision matrix: key = `${risk}-${reversible}-${confidenceLevel}`
  private decisionMatrix: Map<string, DecisionType> = new Map([
    // Low risk -> Generally act
    ['low-true-high', 'act'],
    ['low-false-high', 'act'],
    ['low-true-medium', 'act'],
    ['low-false-medium', 'confirm'],
    ['low-true-low', 'confirm'],
    ['low-false-low', 'confirm'],
    
    // Medium risk -> Confirm for irreversible or lower confidence
    ['medium-true-high', 'act'],
    ['medium-false-high', 'confirm'],
    ['medium-true-medium', 'confirm'],
    ['medium-false-medium', 'escalate'],
    ['medium-true-low', 'escalate'],
    ['medium-false-low', 'escalate'],
    
    // High risk -> Mostly escalate
    ['high-true-high', 'confirm'],
    ['high-false-high', 'escalate'],
    ['high-true-medium', 'escalate'],
    ['high-false-medium', 'escalate'],
    ['high-true-low', 'escalate'],
    ['high-false-low', 'escalate'],
    
    // Critical -> Always escalate
    ['critical-true-high', 'escalate'],
    ['critical-false-high', 'escalate'],
    ['critical-true-medium', 'escalate'],
    ['critical-false-medium', 'escalate'],
    ['critical-true-low', 'escalate'],
    ['critical-false-low', 'escalate'],
  ]);

  // Agent-specific policies
  private policies: Map<string, AgentDecisionPolicy> = new Map();

  // Decision history for learning
  private history: DecisionHistory[] = [];
  private maxHistorySize = 10000;

  // Built-in rules that always apply
  private globalRules: DecisionRule[] = [
    {
      name: 'max-retries',
      condition: (ctx) => ctx.previousAttempts >= 3,
      decision: 'escalate',
      reasoning: 'Maximum retry attempts reached',
    },
    {
      name: 'time-critical-low-confidence',
      condition: (ctx) => ctx.timeConstraint !== undefined && 
                          ctx.timeConstraint.getTime() - Date.now() < 60000 &&
                          ctx.confidence < 70,
      decision: 'escalate',
      reasoning: 'Time-critical task with insufficient confidence',
    },
    {
      name: 'critical-always-escalate',
      condition: (ctx) => ctx.estimatedImpact === 'critical',
      decision: 'escalate',
      reasoning: 'Critical impact always requires human oversight',
    },
    {
      name: 'production-write-high-risk',
      condition: (ctx) => ctx.taskType === 'production-write' || 
                          (ctx.affectedResources?.some(r => r.includes('production')) === true && ctx.reversible === false),
      decision: 'escalate',
      reasoning: 'Production writes require human approval',
    },
  ];

  /**
   * Main decision function
   */
  decide(context: DecisionContext): DecisionResult {
    // Check global rules first
    for (const rule of this.globalRules) {
      if (rule.condition(context)) {
        const result: DecisionResult = {
          decision: rule.decision,
          reasoning: `[${rule.name}] ${rule.reasoning}`,
          requiredApprovals: rule.decision === 'escalate' ? ['human'] : undefined,
        };
        this.recordDecision(context, result);
        return result;
      }
    }

    // Check agent-specific policy
    const policy = this.policies.get(context.agentId);
    if (policy) {
      const policyResult = this.applyPolicy(context, policy);
      if (policyResult) {
        this.recordDecision(context, policyResult);
        return policyResult;
      }
    }

    // Use decision matrix
    const confidenceLevel = this.getConfidenceLevel(context.confidence);
    const key = `${context.estimatedImpact}-${context.reversible}-${confidenceLevel}`;
    
    const decision = this.decisionMatrix.get(key) || 'escalate';
    
    const result: DecisionResult = {
      decision,
      reasoning: this.generateReasoning(context, decision),
      requiredApprovals: this.getRequiredApprovals(decision, context),
      suggestedAction: this.suggestAction(context, decision),
      alternativeActions: this.getAlternatives(context, decision),
    };

    this.recordDecision(context, result);
    return result;
  }

  /**
   * Batch decision for multiple contexts
   */
  decideBatch(contexts: DecisionContext[]): DecisionResult[] {
    return contexts.map(ctx => this.decide(ctx));
  }

  /**
   * Check if agent should continue execution
   */
  shouldContinue(context: DecisionContext): { continue: boolean; reason: string } {
    // Stop conditions
    if (context.previousAttempts >= 3) {
      return { continue: false, reason: 'Maximum retry attempts exceeded' };
    }
    
    if (context.estimatedImpact === 'critical') {
      return { continue: false, reason: 'Critical impact requires escalation' };
    }
    
    if (context.confidence < 30) {
      return { continue: false, reason: 'Confidence too low to proceed' };
    }

    // Check time constraint
    if (context.timeConstraint) {
      const remaining = context.timeConstraint.getTime() - Date.now();
      if (remaining < 0) {
        return { continue: false, reason: 'Time constraint exceeded' };
      }
    }

    // Check policy
    const policy = this.policies.get(context.agentId);
    if (policy) {
      const riskOrder: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
      if (riskOrder.indexOf(context.estimatedImpact) > riskOrder.indexOf(policy.maxRiskLevel)) {
        return { continue: false, reason: `Risk level exceeds agent's maximum: ${policy.maxRiskLevel}` };
      }
      if (context.confidence < policy.minConfidence) {
        return { continue: false, reason: `Confidence below agent's minimum: ${policy.minConfidence}%` };
      }
    }
    
    return { continue: true, reason: 'All checks passed' };
  }

  /**
   * Register agent policy
   */
  setPolicy(policy: AgentDecisionPolicy): void {
    this.policies.set(policy.agentId, policy);
  }

  /**
   * Get agent policy
   */
  getPolicy(agentId: string): AgentDecisionPolicy | undefined {
    return this.policies.get(agentId);
  }

  /**
   * Remove agent policy
   */
  removePolicy(agentId: string): boolean {
    return this.policies.delete(agentId);
  }

  /**
   * List all policies
   */
  listPolicies(): AgentDecisionPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Add custom decision rule
   */
  addGlobalRule(rule: DecisionRule): void {
    this.globalRules.push(rule);
  }

  /**
   * Get decision history
   */
  getHistory(agentId?: string, limit: number = 100): DecisionHistory[] {
    let filtered = this.history;
    if (agentId) {
      filtered = this.history.filter(h => h.context.agentId === agentId);
    }
    return filtered.slice(-limit);
  }

  /**
   * Record outcome of a decision
   */
  recordOutcome(agentId: string, timestamp: Date, outcome: 'success' | 'failure'): void {
    const entry = this.history.find(
      h => h.context.agentId === agentId && 
           h.timestamp.getTime() === timestamp.getTime()
    );
    if (entry) {
      entry.outcome = outcome;
    }
  }

  /**
   * Get decision statistics
   */
  getStats(agentId?: string): {
    total: number;
    byDecision: Record<DecisionType, number>;
    byOutcome: Record<string, number>;
    avgConfidence: number;
  } {
    let entries = agentId 
      ? this.history.filter(h => h.context.agentId === agentId)
      : this.history;

    const byDecision: Record<DecisionType, number> = { act: 0, escalate: 0, confirm: 0, defer: 0 };
    const byOutcome: Record<string, number> = { success: 0, failure: 0, pending: 0 };
    let totalConfidence = 0;

    for (const entry of entries) {
      byDecision[entry.result.decision]++;
      byOutcome[entry.outcome || 'pending']++;
      totalConfidence += entry.context.confidence;
    }

    return {
      total: entries.length,
      byDecision,
      byOutcome,
      avgConfidence: entries.length > 0 ? totalConfidence / entries.length : 0,
    };
  }

  // Private helpers

  private getConfidenceLevel(confidence: number): ConfidenceLevel {
    if (confidence >= 80) return 'high';
    if (confidence >= 50) return 'medium';
    return 'low';
  }

  private applyPolicy(context: DecisionContext, policy: AgentDecisionPolicy): DecisionResult | null {
    // Check blocked task types
    if (policy.blockedTaskTypes.includes(context.taskType)) {
      return {
        decision: 'escalate',
        reasoning: `Task type '${context.taskType}' is blocked by agent policy`,
        requiredApprovals: ['human'],
      };
    }

    // Check allowed task types (if specified)
    if (policy.allowedTaskTypes.length > 0 && !policy.allowedTaskTypes.includes(context.taskType)) {
      return {
        decision: 'escalate',
        reasoning: `Task type '${context.taskType}' is not in allowed list`,
        requiredApprovals: ['human'],
      };
    }

    // Check risk level
    const riskOrder: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
    if (riskOrder.indexOf(context.estimatedImpact) > riskOrder.indexOf(policy.maxRiskLevel)) {
      return {
        decision: 'escalate',
        reasoning: `Risk level '${context.estimatedImpact}' exceeds agent's maximum '${policy.maxRiskLevel}'`,
        requiredApprovals: ['human'],
      };
    }

    // Check if confirmation required
    if (riskOrder.indexOf(context.estimatedImpact) >= riskOrder.indexOf(policy.requireConfirmationAbove)) {
      return {
        decision: 'confirm',
        reasoning: `Risk level '${context.estimatedImpact}' requires confirmation per policy`,
      };
    }

    // Check confidence
    if (context.confidence < policy.minConfidence) {
      return {
        decision: 'escalate',
        reasoning: `Confidence ${context.confidence}% below policy minimum ${policy.minConfidence}%`,
        requiredApprovals: ['human'],
      };
    }

    // Check custom rules
    for (const rule of policy.customRules || []) {
      if (rule.condition(context)) {
        return {
          decision: rule.decision,
          reasoning: `[custom:${rule.name}] ${rule.reasoning}`,
          requiredApprovals: rule.decision === 'escalate' ? ['human'] : undefined,
        };
      }
    }

    return null; // No policy override, use matrix
  }

  private generateReasoning(context: DecisionContext, decision: DecisionType): string {
    const parts: string[] = [];
    
    parts.push(`Risk: ${context.estimatedImpact}`);
    parts.push(`Reversible: ${context.reversible ? 'yes' : 'no'}`);
    parts.push(`Confidence: ${context.confidence}%`);
    
    if (context.previousAttempts > 0) {
      parts.push(`Attempts: ${context.previousAttempts}`);
    }

    const details = parts.join(', ');

    switch (decision) {
      case 'act':
        return `Proceeding autonomously (${details})`;
      case 'confirm':
        return `Requesting confirmation (${details})`;
      case 'escalate':
        return `Escalating to human (${details})`;
      case 'defer':
        return `Deferring action (${details})`;
      default:
        return `Unknown decision (${details})`;
    }
  }

  private getRequiredApprovals(decision: DecisionType, context: DecisionContext): string[] | undefined {
    if (decision !== 'escalate' && decision !== 'confirm') return undefined;

    const approvers: string[] = [];
    
    if (context.estimatedImpact === 'critical') {
      approvers.push('senior-engineer', 'human');
    } else if (context.estimatedImpact === 'high') {
      approvers.push('human');
    } else {
      approvers.push('human');
    }

    return approvers;
  }

  private suggestAction(context: DecisionContext, decision: DecisionType): string | undefined {
    switch (decision) {
      case 'escalate':
        if (context.confidence < 50) {
          return 'Gather more information before retry';
        }
        if (context.previousAttempts >= 3) {
          return 'Review approach and consider alternative solution';
        }
        return 'Request human review and guidance';
      
      case 'confirm':
        return `Confirm action: ${context.taskDescription || context.taskType}`;
      
      case 'defer':
        return 'Wait for additional context or resources';
      
      default:
        return undefined;
    }
  }

  private getAlternatives(context: DecisionContext, decision: DecisionType): string[] | undefined {
    if (decision === 'act') return undefined;

    const alternatives: string[] = [];
    
    if (!context.reversible) {
      alternatives.push('Try a reversible alternative first');
    }
    
    if (context.confidence < 80) {
      alternatives.push('Run additional validation to increase confidence');
    }
    
    if (context.estimatedImpact !== 'low') {
      alternatives.push('Break into smaller, lower-risk subtasks');
    }

    return alternatives.length > 0 ? alternatives : undefined;
  }

  private recordDecision(context: DecisionContext, result: DecisionResult): void {
    const entry: DecisionHistory = {
      timestamp: new Date(),
      context: { ...context },
      result: { ...result },
      outcome: 'pending',
    };

    this.history.push(entry);

    // Trim history if needed
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }
}

// Singleton instance
export const autonomousDecisionService = new AutonomousDecisionService();
