import React from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { InsightAlert } from '../components/features/InsightAlert';
import type { Insight } from '../types';

// Mock data
const stats = [
  { label: 'Active Agents', value: 47, trend: 12, trendLabel: 'vs last month', icon: '🤖' },
  { label: 'Total Runs Today', value: '1,284', trend: 8, trendLabel: 'vs yesterday', icon: '⚡' },
  { label: 'Avg Quality Score', value: '94.2%', trend: 2.1, trendLabel: 'vs last week', icon: '✨' },
  { label: 'Monthly Spend', value: '€12,450', trend: -5, trendLabel: 'under budget', icon: '💰' },
];

const insights: Insight[] = [
  {
    id: '1',
    type: 'warning',
    title: 'Quality Drift Detected',
    message: 'Agent "Customer Support Bot" showing 8% quality decrease over past 3 days.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    actionRequired: true,
  },
  {
    id: '2',
    type: 'success',
    title: 'New Pattern Identified',
    message: 'High success rate pattern discovered for travel booking queries.',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    actionRequired: false,
  },
];

const recentActivity = [
  { agent: 'Booking Assistant', action: 'Completed 156 runs', time: '10 min ago', status: 'success' },
  { agent: 'Report Generator', action: 'Failed 2 runs', time: '25 min ago', status: 'error' },
  { agent: 'Data Analyst', action: 'Deployed v2.1', time: '1 hour ago', status: 'info' },
  { agent: 'Content Writer', action: 'Completed 89 runs', time: '2 hours ago', status: 'success' },
];

export const Dashboard: React.FC = () => {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your AI Factory performance"
      />

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            trend={stat.trend}
            trendLabel={stat.trendLabel}
            icon={stat.icon}
          />
        ))}
      </div>

      {/* Main Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: 'var(--space-4)',
      }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Insights */}
          <Card padding="lg">
            <CardHeader title="Active Insights" subtitle="Requires attention" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {insights.map((insight) => (
                <InsightAlert
                  key={insight.id}
                  insight={insight}
                  onDismiss={() => {}}
                  onAction={() => {}}
                />
              ))}
            </div>
          </Card>

          {/* Budget Overview */}
          <Card padding="lg">
            <CardHeader title="Budget Overview" subtitle="March 2026" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <ProgressBar
                label="Core Tier"
                value={8200}
                max={15000}
                showValue
                color="gradient"
              />
              <ProgressBar
                label="Venture Tier"
                value={3100}
                max={5000}
                showValue
                color="default"
              />
              <ProgressBar
                label="Personal Tier"
                value={1150}
                max={2000}
                showValue
                color="success"
              />
            </div>
          </Card>
        </div>

        {/* Right Column - Recent Activity */}
        <Card padding="lg">
          <CardHeader title="Recent Activity" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentActivity.map((item, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3) 0',
                  borderBottom: index < recentActivity.length - 1 
                    ? '1px solid var(--rebel-gray-100)' 
                    : 'none',
                }}
              >
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 
                    item.status === 'success' ? 'var(--rebel-cyan)' :
                    item.status === 'error' ? 'var(--rebel-red)' :
                    'var(--rebel-blue)',
                }} />
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    color: 'var(--rebel-navy)',
                  }}>
                    {item.agent}
                  </p>
                  <p style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--rebel-gray-500)',
                  }}>
                    {item.action}
                  </p>
                </div>
                <span style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--rebel-gray-400)',
                }}>
                  {item.time}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
