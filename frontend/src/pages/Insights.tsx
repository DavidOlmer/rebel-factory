import React, { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { InsightAlert } from '../components/features/InsightAlert';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import type { Insight, AlertType } from '../types';

// Mock data
const mockInsights: Insight[] = [
  {
    id: '1',
    type: 'warning',
    title: 'Quality Drift Detected',
    message: 'Agent "Customer Support Bot" showing 8% quality decrease over past 3 days. Review recent prompt changes or input patterns.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    actionRequired: true,
  },
  {
    id: '2',
    type: 'error',
    title: 'Budget Alert: Core Tier',
    message: 'Core tier spending is at 85% of monthly allocation with 12 days remaining. Consider reviewing high-cost agents.',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    actionRequired: true,
  },
  {
    id: '3',
    type: 'success',
    title: 'New Pattern Identified',
    message: 'High success rate pattern discovered for travel booking queries. Template "Travel Flow v2" achieving 99.2% success.',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    actionRequired: false,
  },
  {
    id: '4',
    type: 'info',
    title: 'Model Performance Update',
    message: 'Claude 3.5 Sonnet showing 12% faster response times after provider infrastructure update.',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    actionRequired: false,
  },
  {
    id: '5',
    type: 'warning',
    title: 'Unusual Traffic Pattern',
    message: 'Agent "Report Builder" received 300% more requests than usual. Verify this is expected or check for loops.',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    actionRequired: true,
  },
  {
    id: '6',
    type: 'success',
    title: 'Prompt Optimization Success',
    message: 'Recent updates to "Invoice Processor" prompt reduced token usage by 23% while maintaining quality.',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    actionRequired: false,
  },
];

const learningPatterns = [
  {
    pattern: 'Time-of-day optimization',
    description: 'Batch jobs perform 15% better when scheduled between 02:00-05:00 UTC',
    confidence: 94,
  },
  {
    pattern: 'Prompt length correlation',
    description: 'System prompts under 500 tokens show higher consistency scores',
    confidence: 87,
  },
  {
    pattern: 'Model selection by task',
    description: 'Creative tasks perform better on Claude, analytical on GPT-4',
    confidence: 82,
  },
];

type FilterType = AlertType | 'all';

export const Insights: React.FC = () => {
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showArchived, setShowArchived] = useState(false);

  const filteredInsights = mockInsights.filter((insight) => {
    if (filterType === 'all') return true;
    return insight.type === filterType;
  });

  const actionRequired = mockInsights.filter(i => i.actionRequired).length;

  return (
    <div>
      <PageHeader
        title="Insights"
        subtitle="AI-powered learnings and alerts from your factory"
      />

      {/* Summary Banner */}
      {actionRequired > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-4)',
          backgroundColor: 'rgba(239, 64, 53, 0.08)',
          border: '1px solid rgba(239, 64, 53, 0.2)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--space-6)',
        }}>
          <span style={{ fontSize: 'var(--text-xl)' }}>⚠️</span>
          <div>
            <p style={{ fontWeight: 600, color: 'var(--rebel-navy)' }}>
              {actionRequired} insight{actionRequired > 1 ? 's' : ''} requiring attention
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--rebel-gray-600)' }}>
              Review and take action on critical items below
            </p>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: 'var(--space-4)',
      }}>
        {/* Insights List */}
        <div>
          {/* Filters */}
          <div style={{
            display: 'flex',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-4)',
            flexWrap: 'wrap',
          }}>
            {[
              { value: 'all' as FilterType, label: 'All', count: mockInsights.length },
              { value: 'warning' as FilterType, label: 'Warnings', count: mockInsights.filter(i => i.type === 'warning').length },
              { value: 'error' as FilterType, label: 'Errors', count: mockInsights.filter(i => i.type === 'error').length },
              { value: 'success' as FilterType, label: 'Successes', count: mockInsights.filter(i => i.type === 'success').length },
              { value: 'info' as FilterType, label: 'Info', count: mockInsights.filter(i => i.type === 'info').length },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setFilterType(filter.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-3)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: filterType === filter.value ? 600 : 400,
                  backgroundColor: filterType === filter.value ? 'var(--rebel-navy)' : 'transparent',
                  color: filterType === filter.value ? 'var(--rebel-white)' : 'var(--rebel-gray-600)',
                  border: '1px solid var(--rebel-gray-200)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {filter.label}
                <span style={{
                  fontSize: 'var(--text-xs)',
                  backgroundColor: filterType === filter.value 
                    ? 'rgba(255,255,255,0.2)' 
                    : 'var(--rebel-gray-100)',
                  padding: '0.125rem 0.375rem',
                  borderRadius: 'var(--radius-full)',
                }}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>

          {/* Insights */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {filteredInsights.map((insight) => (
              <InsightAlert
                key={insight.id}
                insight={insight}
                onDismiss={() => {}}
                onAction={() => {}}
              />
            ))}
          </div>

          {filteredInsights.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: 'var(--space-8)',
              color: 'var(--rebel-gray-500)',
            }}>
              <p>No insights in this category</p>
            </div>
          )}
        </div>

        {/* Learning Patterns Sidebar */}
        <Card padding="lg">
          <CardHeader title="Learning Patterns" subtitle="AI-discovered optimizations" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {learningPatterns.map((pattern, index) => (
              <div
                key={index}
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--rebel-gray-50)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 'var(--space-2)',
                }}>
                  <h4 style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    color: 'var(--rebel-navy)',
                  }}>
                    {pattern.pattern}
                  </h4>
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: pattern.confidence >= 90 
                      ? 'var(--rebel-cyan)' 
                      : 'var(--rebel-blue)',
                  }}>
                    {pattern.confidence}%
                  </span>
                </div>
                <p style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--rebel-gray-600)',
                  lineHeight: 1.5,
                }}>
                  {pattern.description}
                </p>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div style={{
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-4)',
            borderTop: '1px solid var(--rebel-gray-200)',
          }}>
            <p style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--rebel-gray-500)',
              marginBottom: 'var(--space-3)',
            }}>
              This Month
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-3)',
            }}>
              <div>
                <p style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--rebel-navy)' }}>47</p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--rebel-gray-500)' }}>Insights generated</p>
              </div>
              <div>
                <p style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--rebel-cyan)' }}>89%</p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--rebel-gray-500)' }}>Action taken</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
