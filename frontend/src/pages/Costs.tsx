import React, { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Badge } from '../components/ui/Badge';
import type { CostBreakdown, Tier } from '../types';

// Mock data
const budgetData = {
  totalBudget: 25000,
  spent: 12450,
  projected: 18200,
  remaining: 12550,
};

const tierBudgets: { tier: Tier; budget: number; spent: number; color: string }[] = [
  { tier: 'core', budget: 15000, spent: 8200, color: 'var(--rebel-purple)' },
  { tier: 'venture', budget: 7000, spent: 3100, color: 'var(--rebel-blue)' },
  { tier: 'personal', budget: 3000, spent: 1150, color: 'var(--rebel-gray-400)' },
];

const modelCosts: CostBreakdown[] = [
  { model: 'Claude 3.5 Sonnet', tier: 'core', amount: 5200, percentage: 41.8 },
  { model: 'GPT-4 Turbo', tier: 'core', amount: 3000, percentage: 24.1 },
  { model: 'Claude 3 Haiku', tier: 'venture', amount: 2100, percentage: 16.9 },
  { model: 'GPT-3.5 Turbo', tier: 'venture', amount: 1000, percentage: 8.0 },
  { model: 'Mixtral 8x7B', tier: 'personal', amount: 750, percentage: 6.0 },
  { model: 'Other', tier: 'personal', amount: 400, percentage: 3.2 },
];

const dailySpend = [
  { day: 'Mon', amount: 1823 },
  { day: 'Tue', amount: 1956 },
  { day: 'Wed', amount: 2134 },
  { day: 'Thu', amount: 1876 },
  { day: 'Fri', amount: 2098 },
  { day: 'Sat', amount: 1234 },
  { day: 'Sun', amount: 1329 },
];

export const Costs: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);
  const maxDailySpend = Math.max(...dailySpend.map(d => d.amount));
  const budgetPercentage = (budgetData.spent / budgetData.totalBudget) * 100;

  return (
    <div>
      <PageHeader
        title="Costs"
        subtitle="Budget tracking and model cost breakdown"
      />

      {/* Overview Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        <StatCard 
          label="Monthly Budget" 
          value={`€${budgetData.totalBudget.toLocaleString()}`} 
          icon="📊"
        />
        <StatCard 
          label="Spent This Month" 
          value={`€${budgetData.spent.toLocaleString()}`} 
          icon="💰"
          color={budgetPercentage > 80 ? 'warning' : 'default'}
        />
        <StatCard 
          label="Projected" 
          value={`€${budgetData.projected.toLocaleString()}`} 
          icon="📈"
          color={budgetData.projected > budgetData.totalBudget ? 'error' : 'success'}
        />
        <StatCard 
          label="Remaining" 
          value={`€${budgetData.remaining.toLocaleString()}`} 
          icon="✓"
          color="success"
        />
      </div>

      {/* Main Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        {/* Budget by Tier */}
        <Card padding="lg">
          <CardHeader title="Budget by Tier" subtitle="Monthly allocation" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {tierBudgets.map((item) => (
              <div key={item.tier}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--space-2)',
                }}>
                  <Badge variant="tier" tier={item.tier} />
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--rebel-gray-600)' }}>
                    €{item.spent.toLocaleString()} / €{item.budget.toLocaleString()}
                  </span>
                </div>
                <ProgressBar
                  value={item.spent}
                  max={item.budget}
                  size="md"
                  color={
                    (item.spent / item.budget) > 0.9 ? 'danger' :
                    (item.spent / item.budget) > 0.7 ? 'warning' : 'success'
                  }
                />
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 'var(--space-1)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--rebel-gray-400)',
                }}>
                  <span>{Math.round((item.spent / item.budget) * 100)}% used</span>
                  <span>€{(item.budget - item.spent).toLocaleString()} remaining</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Daily Spend */}
        <Card padding="lg">
          <CardHeader title="Daily Spend" subtitle="Last 7 days" />
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 'var(--space-3)',
            height: '180px',
            paddingTop: 'var(--space-4)',
          }}>
            {dailySpend.map((d) => (
              <div
                key={d.day}
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
                    height: `${(d.amount / maxDailySpend) * 100}%`,
                    background: 'linear-gradient(180deg, var(--rebel-red) 0%, var(--rebel-coral) 100%)',
                    borderRadius: 'var(--radius-sm)',
                    minHeight: '8px',
                    transition: 'height var(--transition-base)',
                  }}
                />
                <span style={{
                  marginTop: 'var(--space-2)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--rebel-gray-500)',
                }}>
                  {d.day}
                </span>
                <span style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--rebel-gray-400)',
                  fontWeight: 500,
                }}>
                  €{d.amount}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Model Cost Breakdown */}
      <Card padding="lg">
        <CardHeader 
          title="Cost by Model" 
          subtitle="Where your budget is going"
          action={
            <button
              onClick={() => setShowDetails(!showDetails)}
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--rebel-blue)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
          }
        />
        
        {/* Visual breakdown */}
        <div style={{
          display: 'flex',
          height: '32px',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          marginBottom: 'var(--space-4)',
        }}>
          {modelCosts.map((cost, index) => (
            <div
              key={cost.model}
              style={{
                width: `${cost.percentage}%`,
                backgroundColor: 
                  index === 0 ? 'var(--rebel-red)' :
                  index === 1 ? 'var(--rebel-coral)' :
                  index === 2 ? 'var(--rebel-blue)' :
                  index === 3 ? 'var(--rebel-teal)' :
                  index === 4 ? 'var(--rebel-gold)' : 'var(--rebel-gray-300)',
                transition: 'width var(--transition-base)',
              }}
              title={`${cost.model}: €${cost.amount}`}
            />
          ))}
        </div>

        {/* Legend / Details */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: showDetails ? '1fr' : 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: showDetails ? 'var(--space-2)' : 'var(--space-3)',
        }}>
          {modelCosts.map((cost, index) => (
            <div
              key={cost.model}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: showDetails ? 'var(--space-2) 0' : 0,
                borderBottom: showDetails ? '1px solid var(--rebel-gray-100)' : 'none',
              }}
            >
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 
                  index === 0 ? 'var(--rebel-red)' :
                  index === 1 ? 'var(--rebel-coral)' :
                  index === 2 ? 'var(--rebel-blue)' :
                  index === 3 ? 'var(--rebel-teal)' :
                  index === 4 ? 'var(--rebel-gold)' : 'var(--rebel-gray-300)',
              }} />
              <span style={{ 
                fontSize: 'var(--text-sm)', 
                color: 'var(--rebel-gray-700)',
                flex: 1,
              }}>
                {cost.model}
              </span>
              {showDetails && (
                <>
                  <Badge variant="tier" tier={cost.tier} />
                  <span style={{ 
                    fontSize: 'var(--text-sm)', 
                    fontWeight: 600,
                    color: 'var(--rebel-navy)',
                    minWidth: '80px',
                    textAlign: 'right',
                  }}>
                    €{cost.amount.toLocaleString()}
                  </span>
                </>
              )}
              <span style={{ 
                fontSize: 'var(--text-sm)', 
                color: 'var(--rebel-gray-400)',
                minWidth: showDetails ? '50px' : 'auto',
                textAlign: 'right',
              }}>
                {cost.percentage}%
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
