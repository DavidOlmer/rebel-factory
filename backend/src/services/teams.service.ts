/**
 * REBEL AI FACTORY - MICROSOFT TEAMS INTEGRATION
 * 
 * Sends notifications via Teams webhooks using Adaptive Cards
 */

import { Pool } from 'pg';

// ============================================
// TYPES
// ============================================

export interface TeamsChannel {
  id: string;
  tenantId: string;
  teamsChannelId: string;
  teamsTeamId: string;
  channelName: string;
  webhookUrl: string;
  notifyOn: NotificationType[];
}

export type NotificationType = 
  | 'agent_complete'
  | 'agent_failed'
  | 'approval_needed'
  | 'approval_decided'
  | 'daily_summary'
  | 'drift_warning'
  | 'budget_alert';

export interface TeamsNotification {
  id: string;
  channelId: string;
  type: NotificationType;
  title: string;
  body: string;
  cardJson?: AdaptiveCard;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  error?: string;
}

// Adaptive Card types (simplified)
interface AdaptiveCard {
  type: 'AdaptiveCard';
  version: '1.4';
  body: AdaptiveCardElement[];
  actions?: AdaptiveCardAction[];
}

interface AdaptiveCardElement {
  type: string;
  [key: string]: any;
}

interface AdaptiveCardAction {
  type: string;
  title: string;
  url?: string;
  data?: any;
}

// ============================================
// TEAMS SERVICE
// ============================================

export class TeamsService {
  constructor(private pool: Pool) {}

  // ==========================================
  // CHANNEL MANAGEMENT
  // ==========================================

  async registerChannel(channel: Omit<TeamsChannel, 'id'>): Promise<string> {
    const result = await this.pool.query(`
      INSERT INTO teams_channels (
        tenant_id, teams_channel_id, teams_team_id,
        channel_name, webhook_url, notify_on
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      channel.tenantId, channel.teamsChannelId, channel.teamsTeamId,
      channel.channelName, channel.webhookUrl, JSON.stringify(channel.notifyOn)
    ]);
    
    return result.rows[0].id;
  }

  async getChannelsForTenant(tenantId: string): Promise<TeamsChannel[]> {
    const result = await this.pool.query(`
      SELECT * FROM teams_channels WHERE tenant_id = $1
    `, [tenantId]);
    
    return result.rows;
  }

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  async notify(
    tenantId: string, 
    type: NotificationType, 
    data: any
  ): Promise<void> {
    // Find channels that want this notification type
    const channels = await this.pool.query(`
      SELECT * FROM teams_channels
      WHERE tenant_id = $1 AND notify_on ? $2
    `, [tenantId, type]);
    
    for (const channel of channels.rows) {
      const card = this.buildCard(type, data);
      await this.sendToChannel(channel, type, card);
    }
  }

  private async sendToChannel(
    channel: TeamsChannel,
    type: NotificationType,
    card: AdaptiveCard
  ): Promise<void> {
    // Store notification
    const notifResult = await this.pool.query(`
      INSERT INTO teams_notifications (
        channel_id, notification_type, title, body, card_json, status
      ) VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING id
    `, [
      channel.id, type, card.body[0]?.text || type, 
      JSON.stringify(card.body), JSON.stringify(card)
    ]);
    
    const notifId = notifResult.rows[0].id;
    
    try {
      // Send via webhook
      const response = await fetch(channel.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'message',
          attachments: [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: card
          }]
        })
      });
      
      if (response.ok) {
        await this.pool.query(`
          UPDATE teams_notifications 
          SET status = 'sent', sent_at = NOW()
          WHERE id = $1
        `, [notifId]);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error: any) {
      await this.pool.query(`
        UPDATE teams_notifications 
        SET status = 'failed', error = $2
        WHERE id = $1
      `, [notifId, error.message]);
    }
  }

  // ==========================================
  // CARD BUILDERS
  // ==========================================

  private buildCard(type: NotificationType, data: any): AdaptiveCard {
    switch (type) {
      case 'agent_complete':
        return this.buildAgentCompleteCard(data);
      case 'agent_failed':
        return this.buildAgentFailedCard(data);
      case 'approval_needed':
        return this.buildApprovalCard(data);
      case 'approval_decided':
        return this.buildApprovalDecidedCard(data);
      case 'daily_summary':
        return this.buildDailySummaryCard(data);
      case 'drift_warning':
        return this.buildDriftWarningCard(data);
      case 'budget_alert':
        return this.buildBudgetAlertCard(data);
      default:
        return this.buildGenericCard(type, data);
    }
  }

  private buildAgentCompleteCard(data: any): AdaptiveCard {
    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `✅ Agent Complete: ${data.agentName}`,
          weight: 'bolder',
          size: 'medium'
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Task', value: data.taskDescription || 'N/A' },
            { title: 'Duration', value: `${Math.round(data.durationMs / 1000)}s` },
            { title: 'Tokens', value: data.totalTokens?.toLocaleString() || '0' },
            { title: 'Quality', value: `${data.qualityScore || 'N/A'}/100` }
          ]
        }
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: 'View Details',
          url: `${process.env.FRONTEND_URL}/runs/${data.runId}`
        }
      ]
    };
  }

  private buildAgentFailedCard(data: any): AdaptiveCard {
    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `❌ Agent Failed: ${data.agentName}`,
          weight: 'bolder',
          size: 'medium',
          color: 'attention'
        },
        {
          type: 'TextBlock',
          text: data.errorMessage || 'Unknown error',
          wrap: true
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Error Type', value: data.errorType || 'Unknown' },
            { title: 'Task', value: data.taskDescription || 'N/A' },
            { title: 'Retries', value: String(data.retryCount || 0) }
          ]
        }
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: 'Investigate',
          url: `${process.env.FRONTEND_URL}/runs/${data.runId}`
        }
      ]
    };
  }

  private buildApprovalCard(data: any): AdaptiveCard {
    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `🔔 Approval Needed`,
          weight: 'bolder',
          size: 'medium'
        },
        {
          type: 'TextBlock',
          text: data.title,
          wrap: true
        },
        {
          type: 'TextBlock',
          text: data.description,
          wrap: true,
          size: 'small'
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Requested by', value: data.requesterName },
            { title: 'Type', value: data.requestType }
          ]
        }
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: 'Review & Decide',
          url: `${process.env.FRONTEND_URL}/approvals/${data.requestId}`
        }
      ]
    };
  }

  private buildApprovalDecidedCard(data: any): AdaptiveCard {
    const approved = data.decision === 'approved';
    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `${approved ? '✅' : '❌'} Approval ${data.decision}`,
          weight: 'bolder',
          size: 'medium',
          color: approved ? 'good' : 'attention'
        },
        {
          type: 'TextBlock',
          text: data.title,
          wrap: true
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Decided by', value: data.approverName },
            { title: 'Comment', value: data.comment || 'None' }
          ]
        }
      ]
    };
  }

  private buildDailySummaryCard(data: any): AdaptiveCard {
    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `📊 Daily Summary - ${data.date}`,
          weight: 'bolder',
          size: 'medium'
        },
        {
          type: 'ColumnSet',
          columns: [
            {
              type: 'Column',
              items: [
                { type: 'TextBlock', text: 'Runs', size: 'small' },
                { type: 'TextBlock', text: String(data.totalRuns), weight: 'bolder', size: 'extraLarge' }
              ]
            },
            {
              type: 'Column',
              items: [
                { type: 'TextBlock', text: 'Success', size: 'small' },
                { type: 'TextBlock', text: `${data.successRate}%`, weight: 'bolder', size: 'extraLarge', color: 'good' }
              ]
            },
            {
              type: 'Column',
              items: [
                { type: 'TextBlock', text: 'Tokens', size: 'small' },
                { type: 'TextBlock', text: `${Math.round(data.totalTokens / 1000000)}M`, weight: 'bolder', size: 'extraLarge' }
              ]
            }
          ]
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Top Agent', value: data.topAgent },
            { title: 'Cost', value: `$${data.totalCost.toFixed(2)}` }
          ]
        }
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: 'View Dashboard',
          url: `${process.env.FRONTEND_URL}/dashboard`
        }
      ]
    };
  }

  private buildDriftWarningCard(data: any): AdaptiveCard {
    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `⚠️ Performance Drift Detected`,
          weight: 'bolder',
          size: 'medium',
          color: 'warning'
        },
        {
          type: 'TextBlock',
          text: `Agent "${data.agentName}" is underperforming`,
          wrap: true
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Quality', value: `${data.baselineQuality} → ${data.currentQuality}` },
            { title: 'Success Rate', value: `${data.baselineSuccess}% → ${data.currentSuccess}%` },
            { title: 'Confidence', value: `${Math.round(data.confidence * 100)}%` }
          ]
        }
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: 'Investigate',
          url: `${process.env.FRONTEND_URL}/agents/${data.agentId}/insights`
        }
      ]
    };
  }

  private buildBudgetAlertCard(data: any): AdaptiveCard {
    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `💰 Budget Alert`,
          weight: 'bolder',
          size: 'medium',
          color: 'attention'
        },
        {
          type: 'TextBlock',
          text: `Token budget ${data.percentUsed}% used`,
          wrap: true
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Used', value: `${Math.round(data.used / 1000000)}M tokens` },
            { title: 'Budget', value: `${Math.round(data.budget / 1000000)}M tokens` },
            { title: 'Days Left', value: String(data.daysLeft) }
          ]
        }
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: 'View Usage',
          url: `${process.env.FRONTEND_URL}/admin/analytics`
        }
      ]
    };
  }

  private buildGenericCard(type: string, data: any): AdaptiveCard {
    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `Notification: ${type}`,
          weight: 'bolder'
        },
        {
          type: 'TextBlock',
          text: JSON.stringify(data, null, 2),
          wrap: true,
          fontType: 'monospace'
        }
      ]
    };
  }

  // ==========================================
  // SCHEDULED NOTIFICATIONS
  // ==========================================

  async sendDailySummaries(): Promise<void> {
    // Get all tenants with teams channels
    const tenants = await this.pool.query(`
      SELECT DISTINCT tenant_id FROM teams_channels
      WHERE notify_on ? 'daily_summary'
    `);
    
    for (const tenant of tenants.rows) {
      const summary = await this.generateDailySummary(tenant.tenant_id);
      await this.notify(tenant.tenant_id, 'daily_summary', summary);
    }
  }

  private async generateDailySummary(tenantId: string): Promise<any> {
    const result = await this.pool.query(`
      SELECT
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE success = true) as successful_runs,
        SUM(total_tokens) as total_tokens,
        AVG(quality_score) as avg_quality
      FROM agent_runs
      WHERE tenant_id = $1 
        AND started_at > NOW() - INTERVAL '24 hours'
    `, [tenantId]);
    
    const topAgent = await this.pool.query(`
      SELECT a.name, COUNT(*) as runs
      FROM agent_runs r
      JOIN agents a ON a.id = r.agent_id
      WHERE r.tenant_id = $1 
        AND r.started_at > NOW() - INTERVAL '24 hours'
      GROUP BY a.id, a.name
      ORDER BY runs DESC
      LIMIT 1
    `, [tenantId]);
    
    const stats = result.rows[0];
    const successRate = stats.total_runs > 0 
      ? Math.round((stats.successful_runs / stats.total_runs) * 100) 
      : 0;
    
    return {
      date: new Date().toISOString().slice(0, 10),
      totalRuns: parseInt(stats.total_runs) || 0,
      successRate,
      totalTokens: parseInt(stats.total_tokens) || 0,
      avgQuality: Math.round(stats.avg_quality) || 0,
      topAgent: topAgent.rows[0]?.name || 'N/A',
      totalCost: (parseInt(stats.total_tokens) || 0) / 1000000 * 3 // Rough estimate
    };
  }
}
