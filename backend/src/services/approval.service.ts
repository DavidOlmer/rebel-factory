/**
 * REBEL AI FACTORY - APPROVAL FLOWS SERVICE
 * 
 * Handles approval workflows for:
 * - Agent promotion (personal → venture → core)
 * - Template publishing
 * - High-cost runs
 * - Role changes
 */

import { Pool } from 'pg';
import { TeamsService } from './teams.service';

// ============================================
// TYPES
// ============================================

export interface ApprovalRequest {
  id: string;
  tenantId: string;
  
  requestType: ApprovalType;
  resourceType: 'agent' | 'template' | 'run' | 'user';
  resourceId: string;
  
  title: string;
  description: string;
  metadata: Record<string, any>;
  
  requesterId: string;
  requesterName?: string;
  
  requiredApprovers: ApproverSpec[];
  currentStep: number;
  
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  
  createdAt: Date;
  updatedAt: Date;
}

export type ApprovalType = 
  | 'agent_promotion'
  | 'template_publish'
  | 'high_cost_run'
  | 'role_change'
  | 'budget_increase';

export interface ApproverSpec {
  type: 'role' | 'user';
  role?: string; // venture_lead, admin
  userId?: string;
}

export interface ApprovalDecision {
  id: string;
  requestId: string;
  approverId: string;
  approverName?: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  step: number;
  createdAt: Date;
}

// ============================================
// APPROVAL SERVICE
// ============================================

export class ApprovalService {
  constructor(
    private pool: Pool,
    private teamsService?: TeamsService
  ) {}

  // ==========================================
  // REQUEST MANAGEMENT
  // ==========================================

  async createRequest(request: Omit<ApprovalRequest, 'id' | 'currentStep' | 'status' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const result = await this.pool.query(`
      INSERT INTO approval_requests (
        tenant_id, request_type, resource_type, resource_id,
        title, description, metadata,
        requester_id, required_approvers, current_step, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 'pending')
      RETURNING id
    `, [
      request.tenantId, request.requestType, request.resourceType, request.resourceId,
      request.title, request.description, JSON.stringify(request.metadata),
      request.requesterId, JSON.stringify(request.requiredApprovers)
    ]);
    
    const requestId = result.rows[0].id;
    
    // Notify approvers
    await this.notifyApprovers(requestId, request);
    
    // Log in audit
    await this.pool.query(`
      INSERT INTO audit_logs (
        tenant_id, user_id, action, resource_type, resource_id, metadata
      ) VALUES ($1, $2, 'approval.requested', $3, $4, $5)
    `, [
      request.tenantId, request.requesterId, 
      request.resourceType, request.resourceId,
      JSON.stringify({ requestId, requestType: request.requestType })
    ]);
    
    return requestId;
  }

  async decide(
    requestId: string, 
    approverId: string, 
    decision: 'approved' | 'rejected',
    comment?: string
  ): Promise<void> {
    // Get request
    const request = await this.getRequest(requestId);
    if (!request) throw new Error('Request not found');
    if (request.status !== 'pending') throw new Error('Request already decided');
    
    // Verify approver is authorized
    const isAuthorized = await this.isAuthorizedApprover(request, approverId);
    if (!isAuthorized) throw new Error('Not authorized to approve');
    
    // Record decision
    await this.pool.query(`
      INSERT INTO approval_decisions (
        request_id, approver_id, decision, comment, step
      ) VALUES ($1, $2, $3, $4, $5)
    `, [requestId, approverId, decision, comment, request.currentStep]);
    
    if (decision === 'rejected') {
      // Rejection ends the flow
      await this.pool.query(`
        UPDATE approval_requests 
        SET status = 'rejected', updated_at = NOW()
        WHERE id = $1
      `, [requestId]);
      
      await this.onRejected(request, approverId, comment);
    } else {
      // Check if more approvals needed
      const nextStep = request.currentStep + 1;
      if (nextStep >= request.requiredApprovers.length) {
        // All approved
        await this.pool.query(`
          UPDATE approval_requests 
          SET status = 'approved', current_step = $2, updated_at = NOW()
          WHERE id = $1
        `, [requestId, nextStep]);
        
        await this.onApproved(request);
      } else {
        // Move to next step
        await this.pool.query(`
          UPDATE approval_requests 
          SET current_step = $2, updated_at = NOW()
          WHERE id = $1
        `, [requestId, nextStep]);
        
        // Notify next approvers
        await this.notifyApprovers(requestId, request as any);
      }
    }
    
    // Notify requester
    await this.notifyRequester(request, decision, comment);
  }

  async cancel(requestId: string, userId: string): Promise<void> {
    const request = await this.getRequest(requestId);
    if (!request) throw new Error('Request not found');
    if (request.requesterId !== userId) throw new Error('Only requester can cancel');
    
    await this.pool.query(`
      UPDATE approval_requests 
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1
    `, [requestId]);
  }

  // ==========================================
  // QUERIES
  // ==========================================

  async getRequest(requestId: string): Promise<ApprovalRequest | null> {
    const result = await this.pool.query(`
      SELECT 
        ar.*,
        u.name as requester_name
      FROM approval_requests ar
      LEFT JOIN users u ON u.id = ar.requester_id
      WHERE ar.id = $1
    `, [requestId]);
    
    if (result.rows.length === 0) return null;
    
    return this.mapRequest(result.rows[0]);
  }

  async getPendingForUser(userId: string, tenantId?: string): Promise<ApprovalRequest[]> {
    // Get user's role
    const userResult = await this.pool.query(`
      SELECT role, tenant_id FROM users WHERE id = $1
    `, [userId]);
    
    if (userResult.rows.length === 0) return [];
    
    const user = userResult.rows[0];
    const role = user.role;
    const userTenant = user.tenant_id;
    
    // Find requests where user can approve current step
    const result = await this.pool.query(`
      SELECT 
        ar.*,
        u.name as requester_name
      FROM approval_requests ar
      LEFT JOIN users u ON u.id = ar.requester_id
      WHERE ar.status = 'pending'
        AND ($2::uuid IS NULL OR ar.tenant_id = $2)
        AND (
          -- User is specifically listed
          ar.required_approvers->ar.current_step->>'userId' = $1
          -- Or user has required role
          OR (
            ar.required_approvers->ar.current_step->>'type' = 'role'
            AND ar.required_approvers->ar.current_step->>'role' = $3
          )
        )
      ORDER BY ar.created_at DESC
    `, [userId, tenantId || userTenant, role]);
    
    return result.rows.map(row => this.mapRequest(row));
  }

  async getRequestsForTenant(tenantId: string, status?: string): Promise<ApprovalRequest[]> {
    const result = await this.pool.query(`
      SELECT 
        ar.*,
        u.name as requester_name
      FROM approval_requests ar
      LEFT JOIN users u ON u.id = ar.requester_id
      WHERE ar.tenant_id = $1
        AND ($2::varchar IS NULL OR ar.status = $2)
      ORDER BY ar.created_at DESC
      LIMIT 100
    `, [tenantId, status]);
    
    return result.rows.map(row => this.mapRequest(row));
  }

  async getDecisions(requestId: string): Promise<ApprovalDecision[]> {
    const result = await this.pool.query(`
      SELECT 
        ad.*,
        u.name as approver_name
      FROM approval_decisions ad
      LEFT JOIN users u ON u.id = ad.approver_id
      WHERE ad.request_id = $1
      ORDER BY ad.step, ad.created_at
    `, [requestId]);
    
    return result.rows.map(row => ({
      id: row.id,
      requestId: row.request_id,
      approverId: row.approver_id,
      approverName: row.approver_name,
      decision: row.decision,
      comment: row.comment,
      step: row.step,
      createdAt: row.created_at
    }));
  }

  // ==========================================
  // APPROVAL ACTIONS
  // ==========================================

  private async onApproved(request: ApprovalRequest): Promise<void> {
    switch (request.requestType) {
      case 'agent_promotion':
        await this.handleAgentPromotion(request);
        break;
      case 'template_publish':
        await this.handleTemplatePublish(request);
        break;
      case 'role_change':
        await this.handleRoleChange(request);
        break;
      case 'budget_increase':
        await this.handleBudgetIncrease(request);
        break;
    }
  }

  private async onRejected(request: ApprovalRequest, approverId: string, comment?: string): Promise<void> {
    // Log rejection
    await this.pool.query(`
      INSERT INTO audit_logs (
        tenant_id, user_id, action, resource_type, resource_id, metadata
      ) VALUES ($1, $2, 'approval.rejected', $3, $4, $5)
    `, [
      request.tenantId, approverId,
      request.resourceType, request.resourceId,
      JSON.stringify({ requestId: request.id, comment })
    ]);
  }

  private async handleAgentPromotion(request: ApprovalRequest): Promise<void> {
    const newTier = request.metadata.targetTier;
    
    await this.pool.query(`
      UPDATE agents 
      SET tier = $2, updated_at = NOW()
      WHERE id = $1
    `, [request.resourceId, newTier]);
    
    // Log promotion
    await this.pool.query(`
      INSERT INTO audit_logs (
        tenant_id, user_id, action, resource_type, resource_id, metadata
      ) VALUES ($1, $2, 'agent.promoted', 'agent', $3, $4)
    `, [
      request.tenantId, request.requesterId, request.resourceId,
      JSON.stringify({ newTier, requestId: request.id })
    ]);
  }

  private async handleTemplatePublish(request: ApprovalRequest): Promise<void> {
    await this.pool.query(`
      UPDATE agent_templates 
      SET is_public = true, updated_at = NOW()
      WHERE id = $1
    `, [request.resourceId]);
  }

  private async handleRoleChange(request: ApprovalRequest): Promise<void> {
    const newRole = request.metadata.newRole;
    
    await this.pool.query(`
      UPDATE users 
      SET role = $2, updated_at = NOW()
      WHERE id = $1
    `, [request.resourceId, newRole]);
  }

  private async handleBudgetIncrease(request: ApprovalRequest): Promise<void> {
    const newBudget = request.metadata.newBudget;
    
    await this.pool.query(`
      UPDATE tenants 
      SET token_budget_monthly = $2, updated_at = NOW()
      WHERE id = $1
    `, [request.resourceId, newBudget]);
  }

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  private async notifyApprovers(requestId: string, request: any): Promise<void> {
    if (!this.teamsService) return;
    
    await this.teamsService.notify(request.tenantId, 'approval_needed', {
      requestId,
      title: request.title,
      description: request.description,
      requestType: request.requestType,
      requesterName: request.requesterName
    });
  }

  private async notifyRequester(request: ApprovalRequest, decision: string, comment?: string): Promise<void> {
    if (!this.teamsService) return;
    
    // Get approver name
    const approverResult = await this.pool.query(`
      SELECT u.name FROM approval_decisions ad
      JOIN users u ON u.id = ad.approver_id
      WHERE ad.request_id = $1
      ORDER BY ad.created_at DESC LIMIT 1
    `, [request.id]);
    
    await this.teamsService.notify(request.tenantId, 'approval_decided', {
      requestId: request.id,
      title: request.title,
      decision,
      comment,
      approverName: approverResult.rows[0]?.name || 'Unknown'
    });
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private async isAuthorizedApprover(request: ApprovalRequest, userId: string): Promise<boolean> {
    const currentSpec = request.requiredApprovers[request.currentStep];
    if (!currentSpec) return false;
    
    if (currentSpec.type === 'user') {
      return currentSpec.userId === userId;
    }
    
    if (currentSpec.type === 'role') {
      const userResult = await this.pool.query(`
        SELECT role FROM users WHERE id = $1
      `, [userId]);
      
      if (userResult.rows.length === 0) return false;
      return userResult.rows[0].role === currentSpec.role;
    }
    
    return false;
  }

  private mapRequest(row: any): ApprovalRequest {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      requestType: row.request_type,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      title: row.title,
      description: row.description,
      metadata: row.metadata || {},
      requesterId: row.requester_id,
      requesterName: row.requester_name,
      requiredApprovers: row.required_approvers || [],
      currentStep: row.current_step,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // ==========================================
  // CONVENIENCE METHODS
  // ==========================================

  /**
   * Request agent promotion
   */
  async requestAgentPromotion(
    agentId: string, 
    targetTier: 'venture' | 'core',
    requesterId: string,
    justification: string
  ): Promise<string> {
    // Get agent info
    const agentResult = await this.pool.query(`
      SELECT a.*, t.name as tenant_name 
      FROM agents a 
      JOIN tenants t ON t.id = a.tenant_id
      WHERE a.id = $1
    `, [agentId]);
    
    if (agentResult.rows.length === 0) throw new Error('Agent not found');
    
    const agent = agentResult.rows[0];
    
    // Define approvers based on target tier
    const approvers: ApproverSpec[] = targetTier === 'core'
      ? [{ type: 'role', role: 'venture_lead' }, { type: 'role', role: 'admin' }]
      : [{ type: 'role', role: 'venture_lead' }];
    
    return this.createRequest({
      tenantId: agent.tenant_id,
      requestType: 'agent_promotion',
      resourceType: 'agent',
      resourceId: agentId,
      title: `Promote "${agent.name}" to ${targetTier}`,
      description: justification,
      metadata: {
        agentName: agent.name,
        currentTier: agent.tier,
        targetTier,
        tenantName: agent.tenant_name
      },
      requesterId,
      requiredApprovers: approvers
    });
  }

  /**
   * Request template publishing (make public)
   */
  async requestTemplatePublish(
    templateId: string,
    requesterId: string,
    justification: string
  ): Promise<string> {
    const templateResult = await this.pool.query(`
      SELECT * FROM agent_templates WHERE id = $1
    `, [templateId]);
    
    if (templateResult.rows.length === 0) throw new Error('Template not found');
    
    const template = templateResult.rows[0];
    
    return this.createRequest({
      tenantId: template.tenant_id || 'global',
      requestType: 'template_publish',
      resourceType: 'template',
      resourceId: templateId,
      title: `Publish template "${template.name}"`,
      description: justification,
      metadata: {
        templateName: template.name,
        category: template.category
      },
      requesterId,
      requiredApprovers: [{ type: 'role', role: 'admin' }]
    });
  }
}
