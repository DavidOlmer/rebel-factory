import React, { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { AgentCard } from '../components/features/AgentCard';
import { useApi } from '../hooks/useApi';
import { useNavigation } from '../App';
import type { Agent, Tier, Status } from '../types';

type FilterTier = Tier | 'all';
type FilterStatus = Status | 'all';

// Loading skeleton
const LoadingSkeleton: React.FC = () => (
  <div className="animate-pulse">
    <div className="flex gap-6 mb-6 flex-wrap">
      <div className="h-8 w-48 bg-rebel-gray-200 rounded" />
      <div className="h-8 w-48 bg-rebel-gray-200 rounded" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-48 bg-rebel-gray-200 rounded-lg" />
      ))}
    </div>
  </div>
);

// Error state
const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="text-rebel-red text-4xl mb-4">⚠️</div>
    <p className="text-rebel-red font-medium mb-2">Error loading agents</p>
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

// Filter button component
const FilterButton: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-sm font-normal border rounded-md cursor-pointer transition-all ${
      active 
        ? 'bg-rebel-navy text-white border-rebel-navy font-semibold' 
        : 'bg-transparent text-rebel-gray-600 border-rebel-gray-200 hover:bg-rebel-gray-50'
    }`}
  >
    {label}
  </button>
);

export const Agents: React.FC = () => {
  const { navigate } = useNavigation();
  const { data: agents, loading, error, refetch } = useApi<Agent[]>('/agents');
  const [filterTier, setFilterTier] = useState<FilterTier>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Agents"
          subtitle="Loading agents..."
          action={{
            label: 'New Agent',
            icon: '+',
            onClick: () => navigate('/agents/new'),
          }}
        />
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader
          title="Agents"
          subtitle="Error loading agents"
          action={{
            label: 'New Agent',
            icon: '+',
            onClick: () => navigate('/agents/new'),
          }}
        />
        <ErrorState message={error.message} onRetry={refetch} />
      </div>
    );
  }

  const filteredAgents = (agents || []).filter((agent) => {
    if (filterTier !== 'all' && agent.tier !== filterTier) return false;
    if (filterStatus !== 'all' && agent.status !== filterStatus) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Agents"
        subtitle={`${filteredAgents.length} agents in your factory`}
        action={{
          label: 'New Agent',
          icon: '+',
          onClick: () => navigate('/agents/new'),
        }}
      />

      {/* Filters */}
      <div className="flex gap-6 mb-6 flex-wrap">
        <div>
          <span className="block text-xs font-bold uppercase tracking-wider text-rebel-gray-500 mb-2">
            Tier
          </span>
          <div className="flex gap-2">
            <FilterButton label="All" active={filterTier === 'all'} onClick={() => setFilterTier('all')} />
            <FilterButton label="Core" active={filterTier === 'core'} onClick={() => setFilterTier('core')} />
            <FilterButton label="Venture" active={filterTier === 'venture'} onClick={() => setFilterTier('venture')} />
            <FilterButton label="Personal" active={filterTier === 'personal'} onClick={() => setFilterTier('personal')} />
          </div>
        </div>

        <div>
          <span className="block text-xs font-bold uppercase tracking-wider text-rebel-gray-500 mb-2">
            Status
          </span>
          <div className="flex gap-2">
            <FilterButton label="All" active={filterStatus === 'all'} onClick={() => setFilterStatus('all')} />
            <FilterButton label="Active" active={filterStatus === 'active'} onClick={() => setFilterStatus('active')} />
            <FilterButton label="Pending" active={filterStatus === 'pending'} onClick={() => setFilterStatus('pending')} />
            <FilterButton label="Inactive" active={filterStatus === 'inactive'} onClick={() => setFilterStatus('inactive')} />
          </div>
        </div>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <div className="text-center py-12 text-rebel-gray-500">
          <p className="text-lg mb-2">
            No agents found
          </p>
          <p className="text-sm">
            Try adjusting your filters
          </p>
        </div>
      )}
    </div>
  );
};
