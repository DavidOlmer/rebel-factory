import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { Approval } from '../../types';

interface ApprovalItemProps {
  approval: Approval;
  onApprove: () => void;
  onReject: () => void;
  loading?: boolean;
}

const typeIcons: Record<Approval['type'], string> = {
  agent: 'AI',
  template: 'TPL',
  prompt: 'PRM',
  budget: 'EUR',
  agent_promotion: 'UP',
  template_publish: 'PUB',
};

const typeLabels: Record<Approval['type'], string> = {
  agent: 'New Agent',
  template: 'New Template',
  prompt: 'Prompt Update',
  budget: 'Budget Request',
  agent_promotion: 'Agent Promotion',
  template_publish: 'Template Publish',
};

export const ApprovalItem: React.FC<ApprovalItemProps> = ({
  approval,
  onApprove,
  onReject,
  loading = false,
}) => {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown time';

    const date = new Date(dateStr);
    return date.toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card padding="md">
      <div style={{
        display: 'flex',
        gap: 'var(--space-4)',
        alignItems: 'flex-start',
      }}>
        <div style={{
          width: '2.5rem',
          height: '2.5rem',
          backgroundColor: 'var(--rebel-gray-100)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'var(--text-sm)',
          fontWeight: 700,
          flexShrink: 0,
        }}>
          {typeIcons[approval.type]}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 'var(--space-2)',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
          }}>
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-1)',
              }}>
                <span style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--rebel-gray-400)',
                }}>
                  {typeLabels[approval.type]}
                </span>
                {approval.tier && <Badge variant="tier" tier={approval.tier} />}
              </div>
              <h3 style={{
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                color: 'var(--rebel-navy)',
              }}>
                {approval.title}
              </h3>
            </div>

            {approval.estimatedCost !== undefined && (
              <div style={{
                textAlign: 'right',
                flexShrink: 0,
              }}>
                <span style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--rebel-gray-400)',
                  display: 'block',
                }}>
                  Est. cost
                </span>
                <span style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 600,
                  color: 'var(--rebel-navy)',
                }}>
                  EUR {approval.estimatedCost.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--rebel-gray-600)',
            marginBottom: 'var(--space-3)',
          }}>
            {approval.description ?? 'No description provided.'}
          </p>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}>
            <div style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--rebel-gray-400)',
            }}>
              Requested by <span style={{ color: 'var(--rebel-gray-600)' }}>{approval.requestedBy ?? 'Unknown requester'}</span>
              {' • '}
              {formatDate(approval.requestedAt)}
            </div>

            <div style={{
              display: 'flex',
              gap: 'var(--space-2)',
            }}>
              <Button
                size="sm"
                variant="ghost"
                onClick={onReject}
                disabled={loading}
              >
                Reject
              </Button>
              <Button
                size="sm"
                onClick={onApprove}
                loading={loading}
              >
                Approve
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
