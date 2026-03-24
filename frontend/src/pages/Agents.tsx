import React, { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { AgentCard } from '../components/features/AgentCard';
import { Button } from '../components/ui/Button';
import type { Agent, Tier, Category, Status } from '../types';

// Mock data
const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'Customer Support Bot',
    description: 'Handles customer inquiries across all Rebel Group brands with multi-language support.',
    tier: 'core',
    category: 'rebelgroup',
    status: 'active',
    qualityScore: 94,
    runCount: 15420,
    costPerRun: 0.023,
  },
  {
    id: '2',
    name: 'Booking Assistant',
    description: 'Automates travel booking workflows for D-reizen and Prijsvrij Vakanties.',
    tier: 'venture',
    category: 'travel',
    status: 'active',
    qualityScore: 91,
    runCount: 8932,
    costPerRun: 0.045,
  },
  {
    id: '3',
    name: 'Content Generator',
    description: 'Creates marketing content for entertainment venues and promotions.',
    tier: 'venture',
    category: 'entertainment',
    status: 'pending',
    qualityScore: 78,
    runCount: 2341,
    costPerRun: 0.067,
  },
  {
    id: '4',
    name: 'Financial Analyst',
    description: 'Processes financial reports and generates executive summaries.',
    tier: 'core',
    category: 'services',
    status: 'active',
    qualityScore: 97,
    runCount: 1256,
    costPerRun: 0.089,
  },
  {
    id: '5',
    name: 'Innovation Scout',
    description: 'Monitors tech trends and identifies investment opportunities.',
    tier: 'personal',
    category: 'innovation',
    status: 'active',
    qualityScore: 85,
    runCount: 567,
    costPerRun: 0.112,
  },
  {
    id: '6',
    name: 'Email Responder',
    description: 'Draft email responses for common customer inquiries.',
    tier: 'personal',
    category: 'services',
    status: 'inactive',
    qualityScore: 62,
    runCount: 3421,
    costPerRun: 0.015,
  },
];

type FilterTier = Tier | 'all';
type FilterStatus = Status | 'all';

export const Agents: React.FC = () => {
  const [filterTier, setFilterTier] = useState<FilterTier>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const filteredAgents = mockAgents.filter((agent) => {
    if (filterTier !== 'all' && agent.tier !== filterTier) return false;
    if (filterStatus !== 'all' && agent.status !== filterStatus) return false;
    return true;
  });

  const FilterButton: React.FC<{
    label: string;
    active: boolean;
    onClick: () => void;
  }> = ({ label, active, onClick }) => (
    <button
      onClick={onClick}
      style={{
        padding: '0.375rem 0.75rem',
        fontSize: 'var(--text-sm)',
        fontWeight: active ? 600 : 400,
        backgroundColor: active ? 'var(--rebel-navy)' : 'transparent',
        color: active ? 'var(--rebel-white)' : 'var(--rebel-gray-600)',
        border: '1px solid var(--rebel-gray-200)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Agents"
        subtitle={`${filteredAgents.length} agents in your factory`}
        action={{
          label: 'New Agent',
          icon: '+',
          onClick: () => {},
        }}
      />

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-6)',
        marginBottom: 'var(--space-6)',
        flexWrap: 'wrap',
      }}>
        <div>
          <span style={{
            display: 'block',
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--rebel-gray-500)',
            marginBottom: 'var(--space-2)',
          }}>
            Tier
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <FilterButton label="All" active={filterTier === 'all'} onClick={() => setFilterTier('all')} />
            <FilterButton label="Core" active={filterTier === 'core'} onClick={() => setFilterTier('core')} />
            <FilterButton label="Venture" active={filterTier === 'venture'} onClick={() => setFilterTier('venture')} />
            <FilterButton label="Personal" active={filterTier === 'personal'} onClick={() => setFilterTier('personal')} />
          </div>
        </div>

        <div>
          <span style={{
            display: 'block',
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--rebel-gray-500)',
            marginBottom: 'var(--space-2)',
          }}>
            Status
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <FilterButton label="All" active={filterStatus === 'all'} onClick={() => setFilterStatus('all')} />
            <FilterButton label="Active" active={filterStatus === 'active'} onClick={() => setFilterStatus('active')} />
            <FilterButton label="Pending" active={filterStatus === 'pending'} onClick={() => setFilterStatus('pending')} />
            <FilterButton label="Inactive" active={filterStatus === 'inactive'} onClick={() => setFilterStatus('inactive')} />
          </div>
        </div>
      </div>

      {/* Agent Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 'var(--space-4)',
      }}>
        {filteredAgents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onClick={() => {}}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredAgents.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: 'var(--space-12)',
          color: 'var(--rebel-gray-500)',
        }}>
          <p style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>
            No agents found
          </p>
          <p style={{ fontSize: 'var(--text-sm)' }}>
            Try adjusting your filters
          </p>
        </div>
      )}
    </div>
  );
};
