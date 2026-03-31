import React, { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { ApprovalItem } from '../components/features/ApprovalItem';
import { Card, CardHeader } from '../components/ui/Card';
import type { Approval } from '../types';

// Mock data
const mockApprovals: Approval[] = [
  {
    id: '1',
    type: 'agent',
    title: 'Marketing Campaign Analyzer',
    description: 'New agent to analyze marketing campaign performance across all Rebel Group brands and generate optimization recommendations.',
    requestedBy: 'Sarah van Berg',
    requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    tier: 'venture',
    estimatedCost: 450,
  },
  {
    id: '2',
    type: 'budget',
    title: 'Core Tier Budget Increase',
    description: 'Request to increase Core tier monthly budget by €5,000 to accommodate new customer service scaling.',
    requestedBy: 'Marco de Vries',
    requestedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    tier: 'core',
    estimatedCost: 5000,
  },
  {
    id: '3',
    type: 'template',
    title: 'Event Ticketing Flow',
    description: 'New template for handling ticket inquiries and modifications for AFAS Live and Pathé events.',
    requestedBy: 'Lisa Jansen',
    requestedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    tier: 'venture',
    estimatedCost: 200,
  },
  {
    id: '4',
    type: 'prompt',
    title: 'Customer Intent Classifier v3.0',
    description: 'Major update to intent classification prompt with improved multi-language support and new categories.',
    requestedBy: 'Tom Bakker',
    requestedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    tier: 'core',
  },
  {
    id: '5',
    type: 'agent',
    title: 'Personal Research Assistant',
    description: 'Personal agent for executive team to research market trends and competitor analysis.',
    requestedBy: 'Eva de Groot',
    requestedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    tier: 'personal',
    estimatedCost: 150,
  },
];

const recentlyProcessed = [
  { title: 'Invoice Processor v2', action: 'approved', by: 'System', time: '1 day ago' },
  { title: 'Travel FAQ Bot', action: 'approved', by: 'David', time: '2 days ago' },
  { title: 'Budget Increase - Personal', action: 'rejected', by: 'Finance', time: '3 days ago' },
  { title: 'Content Writer Template', action: 'approved', by: 'System', time: '4 days ago' },
];

type FilterType = Approval['type'] | 'all';

export const Approvals: React.FC = () => {
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filteredApprovals = mockApprovals.filter((approval) => {
    if (filterType === 'all') return true;
    return approval.type === filterType;
  });

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setProcessingId(null);
    // In real app, would update state/refetch
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setProcessingId(null);
  };

  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle={`${mockApprovals.length} pending approval${mockApprovals.length !== 1 ? 's' : ''}`}
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: 'var(--space-4)',
      }}>
        {/* Main Approvals List */}
        <div>
          {/* Filters */}
          <div style={{
            display: 'flex',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-4)',
            flexWrap: 'wrap',
          }}>
            {[
              { value: 'all' as FilterType, label: 'All', icon: '📋' },
              { value: 'agent' as FilterType, label: 'Agents', icon: '🤖' },
              { value: 'template' as FilterType, label: 'Templates', icon: '📄' },
              { value: 'prompt' as FilterType, label: 'Prompts', icon: '💬' },
              { value: 'budget' as FilterType, label: 'Budget', icon: '💰' },
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
                <span>{filter.icon}</span>
                <span>{filter.label}</span>
              </button>
            ))}
          </div>

          {/* Approval Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {filteredApprovals.map((approval) => (
              <ApprovalItem
                key={approval.id}
                approval={approval}
                onApprove={() => handleApprove(approval.id)}
                onReject={() => handleReject(approval.id)}
                loading={processingId === approval.id}
              />
            ))}
          </div>

          {filteredApprovals.length === 0 && (
            <Card padding="lg">
              <div style={{
                textAlign: 'center',
                padding: 'var(--space-8)',
                color: 'var(--rebel-gray-500)',
              }}>
                <span style={{ fontSize: 'var(--text-3xl)', display: 'block', marginBottom: 'var(--space-4)' }}>✓</span>
                <p style={{ fontSize: 'var(--text-lg)', fontWeight: 500, color: 'var(--rebel-navy)' }}>
                  All caught up!
                </p>
                <p style={{ fontSize: 'var(--text-sm)' }}>
                  No pending approvals in this category
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Stats */}
          <Card padding="lg">
            <CardHeader title="This Week" />
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-4)',
            }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 700,
                  color: 'var(--rebel-cyan)',
                }}>
                  12
                </p>
                <p style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--rebel-gray-500)',
                }}>
                  Approved
                </p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 700,
                  color: 'var(--rebel-coral)',
                }}>
                  3
                </p>
                <p style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--rebel-gray-500)',
                }}>
                  Rejected
                </p>
              </div>
            </div>
            <div style={{
              marginTop: 'var(--space-4)',
              paddingTop: 'var(--space-4)',
              borderTop: '1px solid var(--rebel-gray-100)',
              textAlign: 'center',
            }}>
              <p style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 700,
                color: 'var(--rebel-navy)',
              }}>
                4.2h
              </p>
              <p style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--rebel-gray-500)',
              }}>
                Avg. response time
              </p>
            </div>
          </Card>

          {/* Recently Processed */}
          <Card padding="lg">
            <CardHeader title="Recently Processed" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentlyProcessed.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) 0',
                    borderBottom: index < recentlyProcessed.length - 1 
                      ? '1px solid var(--rebel-gray-100)' 
                      : 'none',
                  }}
                >
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: item.action === 'approved' 
                      ? 'var(--rebel-cyan)' 
                      : 'var(--rebel-coral)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 500,
                      color: 'var(--rebel-navy)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {item.title}
                    </p>
                    <p style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--rebel-gray-400)',
                    }}>
                      {item.action} by {item.by}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--rebel-gray-400)',
                    whiteSpace: 'nowrap',
                  }}>
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
