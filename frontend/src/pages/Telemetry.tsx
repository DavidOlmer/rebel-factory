import React, { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Badge } from '../components/ui/Badge';

// Mock data
const metrics = {
  totalRuns: 45678,
  successRate: 96.4,
  avgLatency: 1.23,
  avgQuality: 92.7,
};

const tierPerformance = [
  { tier: 'core' as const, runs: 28450, successRate: 98.2, avgQuality: 95.1 },
  { tier: 'venture' as const, runs: 14320, successRate: 94.8, avgQuality: 91.3 },
  { tier: 'personal' as const, runs: 2908, successRate: 92.1, avgQuality: 87.6 },
];

const topAgents = [
  { name: 'Customer Support Bot', runs: 8234, successRate: 99.1, trend: 'up' },
  { name: 'Booking Assistant', runs: 5621, successRate: 97.8, trend: 'up' },
  { name: 'Invoice Processor', runs: 4312, successRate: 99.4, trend: 'stable' },
  { name: 'Content Generator', runs: 3456, successRate: 93.2, trend: 'down' },
  { name: 'Report Builder', runs: 2189, successRate: 96.7, trend: 'up' },
];

const hourlyData = [
  { hour: '00', runs: 120 }, { hour: '01', runs: 80 }, { hour: '02', runs: 45 },
  { hour: '03', runs: 32 }, { hour: '04', runs: 28 }, { hour: '05', runs: 42 },
  { hour: '06', runs: 89 }, { hour: '07', runs: 156 }, { hour: '08', runs: 234 },
  { hour: '09', runs: 312 }, { hour: '10', runs: 378 }, { hour: '11', runs: 401 },
  { hour: '12', runs: 345 }, { hour: '13', runs: 367 }, { hour: '14', runs: 389 },
  { hour: '15', runs: 412 }, { hour: '16', runs: 356 }, { hour: '17', runs: 289 },
  { hour: '18', runs: 234 }, { hour: '19', runs: 198 }, { hour: '20', runs: 167 },
  { hour: '21', runs: 145 }, { hour: '22', runs: 134 }, { hour: '23', runs: 126 },
];

export const Telemetry: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const maxRuns = Math.max(...hourlyData.map(d => d.runs));

  return (
    <div>
      <PageHeader
        title="Telemetry"
        subtitle="Performance metrics and quality monitoring"
      />

      {/* Time Range Selector */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-6)',
      }}>
        {(['24h', '7d', '30d'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              fontSize: 'var(--text-sm)',
              fontWeight: timeRange === range ? 600 : 400,
              backgroundColor: timeRange === range ? 'var(--rebel-navy)' : 'transparent',
              color: timeRange === range ? 'var(--rebel-white)' : 'var(--rebel-gray-600)',
              border: '1px solid var(--rebel-gray-200)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            {range}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        <StatCard label="Total Runs" value={metrics.totalRuns.toLocaleString()} icon="⚡" />
        <StatCard label="Success Rate" value={`${metrics.successRate}%`} icon="✓" color="success" />
        <StatCard label="Avg Latency" value={`${metrics.avgLatency}s`} icon="⏱️" />
        <StatCard label="Avg Quality" value={`${metrics.avgQuality}%`} icon="✨" />
      </div>

      {/* Charts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        {/* Hourly Activity Chart */}
        <Card padding="lg">
          <CardHeader title="Hourly Activity" subtitle="Runs per hour (today)" />
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '2px',
            height: '150px',
            paddingTop: 'var(--space-4)',
          }}>
            {hourlyData.map((d) => (
              <div
                key={d.hour}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  justifyContent: 'flex-end',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: `${(d.runs / maxRuns) * 100}%`,
                    backgroundColor: 'var(--rebel-red)',
                    borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                    minHeight: '4px',
                    transition: 'height var(--transition-base)',
                  }}
                  title={`${d.runs} runs`}
                />
              </div>
            ))}
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 'var(--space-2)',
            fontSize: 'var(--text-xs)',
            color: 'var(--rebel-gray-400)',
          }}>
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
        </Card>

        {/* Tier Performance */}
        <Card padding="lg">
          <CardHeader title="By Tier" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {tierPerformance.map((tier) => (
              <div key={tier.tier}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--space-2)',
                }}>
                  <Badge variant="tier" tier={tier.tier} />
                  <span style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--rebel-gray-600)',
                  }}>
                    {tier.runs.toLocaleString()} runs
                  </span>
                </div>
                <ProgressBar
                  value={tier.successRate}
                  max={100}
                  size="sm"
                  color="success"
                />
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 'var(--space-1)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--rebel-gray-400)',
                }}>
                  <span>Success: {tier.successRate}%</span>
                  <span>Quality: {tier.avgQuality}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Top Agents Table */}
      <Card padding="lg">
        <CardHeader title="Top Performing Agents" />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid var(--rebel-gray-200)',
                textAlign: 'left',
              }}>
                <th style={{ padding: 'var(--space-3)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--rebel-gray-600)' }}>Agent</th>
                <th style={{ padding: 'var(--space-3)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--rebel-gray-600)' }}>Runs</th>
                <th style={{ padding: 'var(--space-3)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--rebel-gray-600)' }}>Success Rate</th>
                <th style={{ padding: 'var(--space-3)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--rebel-gray-600)' }}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {topAgents.map((agent, index) => (
                <tr
                  key={agent.name}
                  style={{
                    borderBottom: index < topAgents.length - 1 ? '1px solid var(--rebel-gray-100)' : 'none',
                  }}
                >
                  <td style={{ padding: 'var(--space-3)', fontWeight: 500 }}>{agent.name}</td>
                  <td style={{ padding: 'var(--space-3)', color: 'var(--rebel-gray-600)' }}>{agent.runs.toLocaleString()}</td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ 
                      color: agent.successRate >= 98 ? 'var(--rebel-cyan)' : 
                             agent.successRate >= 95 ? 'var(--rebel-lime)' : 'var(--rebel-gold)' 
                    }}>
                      {agent.successRate}%
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{
                      color: agent.trend === 'up' ? 'var(--rebel-lime)' :
                             agent.trend === 'down' ? 'var(--rebel-coral)' : 'var(--rebel-gray-400)',
                    }}>
                      {agent.trend === 'up' ? '↑' : agent.trend === 'down' ? '↓' : '→'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
