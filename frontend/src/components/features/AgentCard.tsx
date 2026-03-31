import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ProgressBar } from '../ui/ProgressBar';
import type { Agent } from '../../types';

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onClick }) => {
  const qualityScore = agent.qualityScore ?? 0;
  const runCount = agent.runCount ?? 0;
  const costPerRun = agent.costPerRun ?? 0;

  const qualityColor =
    qualityScore >= 90 ? 'success' :
    qualityScore >= 70 ? 'default' :
    qualityScore >= 50 ? 'warning' : 'danger';

  return (
    <Card hoverable onClick={onClick}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 'var(--space-3)',
      }}>
        <div style={{ flex: 1 }}>
          <h3 style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--rebel-navy)',
            marginBottom: 'var(--space-1)',
          }}>
            {agent.name}
          </h3>
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--rebel-gray-500)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {agent.description ?? 'No description provided.'}
          </p>
        </div>
        <Badge variant="status" status={agent.status} />
      </div>

      <div style={{
        display: 'flex',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-4)',
        flexWrap: 'wrap',
      }}>
        <Badge variant="tier" tier={agent.tier} />
        <Badge variant="category" category={agent.category} />
      </div>

      <div style={{ marginBottom: 'var(--space-3)' }}>
        <ProgressBar
          value={qualityScore}
          max={100}
          label="Quality Score"
          showValue
          size="sm"
          color={qualityColor}
        />
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        paddingTop: 'var(--space-3)',
        borderTop: '1px solid var(--rebel-gray-100)',
        fontSize: 'var(--text-sm)',
      }}>
        <div>
          <span style={{ color: 'var(--rebel-gray-400)' }}>Runs: </span>
          <span style={{ fontWeight: 600, color: 'var(--rebel-navy)' }}>
            {runCount.toLocaleString()}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--rebel-gray-400)' }}>Cost/run: </span>
          <span style={{ fontWeight: 600, color: 'var(--rebel-navy)' }}>
            EUR {costPerRun.toFixed(3)}
          </span>
        </div>
      </div>
    </Card>
  );
};
