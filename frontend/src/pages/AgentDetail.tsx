import React, { useState } from 'react';
import { useApi, apiPost } from '../hooks/useApi';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { useNavigation } from '../App';
import type { Agent, AgentRun, AgentStats, Tier, Status } from '../types';

interface AgentDetailProps {
  agentId: string;
}

// Loading skeleton component
const LoadingSkeleton: React.FC = () => (
  <div style={{ padding: 'var(--space-6)' }}>
    <div style={{ 
      height: '2rem', 
      width: '200px', 
      backgroundColor: 'var(--rebel-gray-200)',
      borderRadius: 'var(--radius-md)',
      marginBottom: 'var(--space-4)',
      animation: 'pulse 1.5s infinite',
    }} />
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(4, 1fr)', 
      gap: 'var(--space-4)',
      marginBottom: 'var(--space-6)',
    }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{
          height: '100px',
          backgroundColor: 'var(--rebel-gray-100)',
          borderRadius: 'var(--radius-lg)',
          animation: 'pulse 1.5s infinite',
        }} />
      ))}
    </div>
  </div>
);

// Run status badge component
const RunStatusBadge: React.FC<{ status: AgentRun['status'] }> = ({ status }) => {
  const statusConfig: Record<AgentRun['status'], { color: string; bg: string }> = {
    pending: { color: 'var(--rebel-gold)', bg: 'rgba(206, 152, 78, 0.1)' },
    running: { color: 'var(--rebel-blue)', bg: 'rgba(49, 103, 177, 0.1)' },
    completed: { color: 'var(--rebel-cyan)', bg: 'rgba(19, 191, 203, 0.1)' },
    failed: { color: 'var(--rebel-red)', bg: 'rgba(239, 64, 53, 0.1)' },
    cancelled: { color: 'var(--rebel-gray-500)', bg: 'var(--rebel-gray-100)' },
  };

  const config = statusConfig[status];

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.25rem 0.625rem',
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.025em',
      borderRadius: 'var(--radius-full)',
      backgroundColor: config.bg,
      color: config.color,
    }}>
      {status}
    </span>
  );
};

export const AgentDetail: React.FC<AgentDetailProps> = ({ agentId }) => {
  const { navigate } = useNavigation();
  const [startingRun, setStartingRun] = useState(false);
  
  // API calls
  const { data: agent, loading: agentLoading, refetch: refetchAgent } = useApi<Agent>(`/agents/${agentId}`);
  const { data: runsData, loading: runsLoading, refetch: refetchRuns } = useApi<{ runs: AgentRun[] }>(`/agents/${agentId}/runs?limit=10`);
  const { data: stats, loading: statsLoading } = useApi<AgentStats>(`/agents/${agentId}/stats`);

  const loading = agentLoading || runsLoading || statsLoading;
  const runs = runsData?.runs || [];

  // Start a new run
  const handleStartRun = async () => {
    setStartingRun(true);
    try {
      await apiPost(`/agents/${agentId}/runs`, { task_type: 'default' });
      await refetchRuns();
      await refetchAgent();
    } catch (error) {
      console.error('Failed to start run:', error);
    } finally {
      setStartingRun(false);
    }
  };

  // Format duration
  const formatDuration = (ms?: number): string => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Format relative time
  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) return <LoadingSkeleton />;

  if (!agent) {
    return (
      <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--rebel-gray-500)' }}>Agent not found</h2>
        <Button variant="ghost" onClick={() => navigate('/agents')} style={{ marginTop: 'var(--space-4)' }}>
          ← Back to Agents
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      {/* Back button */}
      <button
        onClick={() => navigate('/agents')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          background: 'none',
          border: 'none',
          color: 'var(--rebel-gray-500)',
          cursor: 'pointer',
          fontSize: 'var(--text-sm)',
          marginBottom: 'var(--space-4)',
          padding: 0,
        }}
      >
        ← Back to Agents
      </button>

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 'var(--space-6)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {agent.emoji && (
              <span style={{ fontSize: '2rem' }}>{agent.emoji}</span>
            )}
            <h1 style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 700,
              fontFamily: 'var(--font-headline)',
              color: 'var(--rebel-navy)',
              margin: 0,
            }}>
              {agent.name}
            </h1>
          </div>
          {agent.description && (
            <p style={{
              color: 'var(--rebel-gray-600)',
              marginTop: 'var(--space-2)',
              fontSize: 'var(--text-base)',
            }}>
              {agent.description}
            </p>
          )}
          {agent.creature && (
            <p style={{
              color: 'var(--rebel-gray-400)',
              marginTop: 'var(--space-1)',
              fontSize: 'var(--text-sm)',
              fontStyle: 'italic',
            }}>
              {agent.creature}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Badge variant="tier" tier={agent.tier as Tier} />
          <Badge variant="status" status={agent.status as Status} />
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        <StatCard
          label="Total Runs"
          value={stats?.total_runs ?? agent.totalRuns ?? 0}
          trend={stats?.runs_this_week}
          trendLabel="this week"
          icon="⚡"
        />
        <StatCard
          label="Success Rate"
          value={`${stats?.success_rate ?? 0}%`}
          icon="✅"
          color={stats?.success_rate && stats.success_rate >= 90 ? 'success' : 'default'}
        />
        <StatCard
          label="Avg Quality"
          value={`${stats?.avg_quality ?? agent.avgQuality ?? 0}%`}
          trend={stats?.quality_trend}
          trendLabel="vs last week"
          icon="✨"
        />
        <StatCard
          label="Total Cost"
          value={`€${(stats?.total_cost ?? 0).toFixed(2)}`}
          icon="💰"
        />
      </div>

      {/* Quality Score Card */}
      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <CardHeader title="Quality Score" />
        <div style={{ marginTop: 'var(--space-2)' }}>
          <ProgressBar
            value={agent.qualityScore ?? stats?.avg_quality ?? 0}
            max={100}
            showValue
            size="lg"
            color={
              (agent.qualityScore ?? 0) >= 90 ? 'success' :
              (agent.qualityScore ?? 0) >= 70 ? 'warning' : 'danger'
            }
          />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 'var(--space-3)',
          fontSize: 'var(--text-sm)',
          color: 'var(--rebel-gray-500)',
        }}>
          <span>Model: {agent.model || 'claude-3-opus'}</span>
          <span>Last run: {agent.lastRun ? formatTime(agent.lastRun) : 'Never'}</span>
        </div>
      </Card>

      {/* Skills */}
      {agent.skills && agent.skills.length > 0 && (
        <Card style={{ marginBottom: 'var(--space-6)' }}>
          <CardHeader title="Skills" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {agent.skills.map(skill => (
              <span
                key={skill}
                style={{
                  padding: '0.375rem 0.75rem',
                  backgroundColor: 'var(--rebel-gray-100)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--rebel-gray-700)',
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Runs */}
      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <CardHeader 
          title="Recent Runs" 
          subtitle={`${runs.length} of ${stats?.total_runs ?? 0} total`}
        />
        {runs.length === 0 ? (
          <p style={{ 
            color: 'var(--rebel-gray-400)', 
            textAlign: 'center',
            padding: 'var(--space-6)',
          }}>
            No runs yet. Start a run to see activity.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{
                  textAlign: 'left',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--rebel-gray-500)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  <th style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 600 }}>Task</th>
                  <th style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 600 }}>Quality</th>
                  <th style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 600 }}>Duration</th>
                  <th style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 600 }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, index) => (
                  <tr
                    key={run.id}
                    style={{
                      borderTop: index > 0 ? '1px solid var(--rebel-gray-100)' : 'none',
                    }}
                  >
                    <td style={{
                      padding: 'var(--space-3)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--rebel-gray-700)',
                    }}>
                      {run.task_type}
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <RunStatusBadge status={run.status} />
                    </td>
                    <td style={{
                      padding: 'var(--space-3)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      color: run.quality_score 
                        ? run.quality_score >= 90 ? 'var(--rebel-cyan)' 
                        : run.quality_score >= 70 ? 'var(--rebel-gold)'
                        : 'var(--rebel-coral)'
                        : 'var(--rebel-gray-400)',
                    }}>
                      {run.quality_score ? `${run.quality_score}%` : '-'}
                    </td>
                    <td style={{
                      padding: 'var(--space-3)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--rebel-gray-600)',
                      fontFamily: 'var(--font-mono, monospace)',
                    }}>
                      {formatDuration(run.duration_ms)}
                    </td>
                    <td style={{
                      padding: 'var(--space-3)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--rebel-gray-500)',
                    }}>
                      {formatTime(run.started_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-3)',
        marginTop: 'var(--space-6)',
      }}>
        <Button
          variant="primary"
          onClick={handleStartRun}
          loading={startingRun}
          disabled={agent.status !== 'active' && agent.status !== 'idle'}
          icon={<span>▶️</span>}
        >
          Start Run
        </Button>
        <Button
          variant="secondary"
          onClick={() => navigate(`/agents/${agentId}/edit`)}
          icon={<span>✏️</span>}
        >
          Edit
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate(`/agents/${agentId}/history`)}
          icon={<span>📊</span>}
        >
          Full History
        </Button>
      </div>

      {/* Agent Metadata Footer */}
      <div style={{
        marginTop: 'var(--space-8)',
        padding: 'var(--space-4)',
        backgroundColor: 'var(--rebel-gray-50)',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--text-xs)',
        color: 'var(--rebel-gray-500)',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>ID: {agent.id}</span>
        {agent.createdAt && (
          <span>Created: {new Date(agent.createdAt).toLocaleDateString()}</span>
        )}
        {agent.updatedAt && (
          <span>Updated: {new Date(agent.updatedAt).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
};

export default AgentDetail;
