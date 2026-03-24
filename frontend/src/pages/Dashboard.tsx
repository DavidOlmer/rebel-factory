import React from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { InsightAlert } from '../components/features/InsightAlert';
import { useApi } from '../hooks/useApi';
import type { Insight } from '../types';

interface DashboardStats {
  activeAgents: number;
  activeAgentsTrend: number;
  totalRunsToday: number;
  totalRunsTrend: number;
  avgQualityScore: number;
  qualityTrend: number;
  monthlySpend: number;
  spendTrend: number;
}

interface BudgetOverview {
  coreTier: { used: number; limit: number };
  ventureTier: { used: number; limit: number };
  personalTier: { used: number; limit: number };
}

interface RecentActivity {
  agent: string;
  action: string;
  time: string;
  status: 'success' | 'error' | 'info';
}

interface DashboardData {
  stats: DashboardStats;
  insights: Insight[];
  budget: BudgetOverview;
  recentActivity: RecentActivity[];
}

// Loading skeleton component
const LoadingSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-32 bg-rebel-gray-200 rounded-lg" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 h-64 bg-rebel-gray-200 rounded-lg" />
      <div className="h-64 bg-rebel-gray-200 rounded-lg" />
    </div>
  </div>
);

// Error component
const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="text-rebel-red text-4xl mb-4">⚠️</div>
    <p className="text-rebel-red font-medium mb-2">Error loading dashboard</p>
    <p className="text-rebel-gray-500 text-sm mb-4">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-rebel-navy text-white rounded-md hover:opacity-90 transition-opacity"
      >
        Try Again
      </button>
    )}
  </div>
);

export const Dashboard: React.FC = () => {
  const { data, loading, error, refetch } = useApi<DashboardData>('/dashboard');

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          subtitle="Overview of your AI Factory performance"
        />
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          subtitle="Overview of your AI Factory performance"
        />
        <ErrorState message={error.message} onRetry={refetch} />
      </div>
    );
  }

  const stats = data?.stats ? [
    { label: 'Active Agents', value: data.stats.activeAgents, trend: data.stats.activeAgentsTrend, trendLabel: 'vs last month', icon: '🤖' },
    { label: 'Total Runs Today', value: data.stats.totalRunsToday.toLocaleString(), trend: data.stats.totalRunsTrend, trendLabel: 'vs yesterday', icon: '⚡' },
    { label: 'Avg Quality Score', value: `${data.stats.avgQualityScore}%`, trend: data.stats.qualityTrend, trendLabel: 'vs last week', icon: '✨' },
    { label: 'Monthly Spend', value: `€${data.stats.monthlySpend.toLocaleString()}`, trend: data.stats.spendTrend, trendLabel: 'under budget', icon: '💰' },
  ] : [];

  const insights = data?.insights || [];
  const budget = data?.budget;
  const recentActivity = data?.recentActivity || [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your AI Factory performance"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Insights */}
          <Card padding="lg">
            <CardHeader title="Active Insights" subtitle="Requires attention" />
            <div className="flex flex-col gap-3">
              {insights.length > 0 ? (
                insights.map((insight) => (
                  <InsightAlert
                    key={insight.id}
                    insight={insight}
                    onDismiss={() => {}}
                    onAction={() => {}}
                  />
                ))
              ) : (
                <p className="text-rebel-gray-500 text-sm py-4 text-center">
                  No active insights
                </p>
              )}
            </div>
          </Card>

          {/* Budget Overview */}
          {budget && (
            <Card padding="lg">
              <CardHeader title="Budget Overview" subtitle="March 2026" />
              <div className="flex flex-col gap-4">
                <ProgressBar
                  label="Core Tier"
                  value={budget.coreTier.used}
                  max={budget.coreTier.limit}
                  showValue
                  color="gradient"
                />
                <ProgressBar
                  label="Venture Tier"
                  value={budget.ventureTier.used}
                  max={budget.ventureTier.limit}
                  showValue
                  color="default"
                />
                <ProgressBar
                  label="Personal Tier"
                  value={budget.personalTier.used}
                  max={budget.personalTier.limit}
                  showValue
                  color="success"
                />
              </div>
            </Card>
          )}
        </div>

        {/* Right Column - Recent Activity */}
        <Card padding="lg">
          <CardHeader title="Recent Activity" />
          <div className="flex flex-col">
            {recentActivity.map((item, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 py-3 ${
                  index < recentActivity.length - 1 ? 'border-b border-rebel-gray-100' : ''
                }`}
              >
                <div 
                  className={`w-2 h-2 rounded-full ${
                    item.status === 'success' ? 'bg-rebel-cyan' :
                    item.status === 'error' ? 'bg-rebel-red' :
                    'bg-rebel-blue'
                  }`}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-rebel-navy">
                    {item.agent}
                  </p>
                  <p className="text-xs text-rebel-gray-500">
                    {item.action}
                  </p>
                </div>
                <span className="text-xs text-rebel-gray-400">
                  {item.time}
                </span>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <p className="text-rebel-gray-500 text-sm py-4 text-center">
                No recent activity
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
