import React, { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { InsightAlert } from '../components/features/InsightAlert';
import { Card, CardHeader } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useApi } from '../hooks/useApi';
import type { Insight, AlertType } from '../types';

// === KB Feature Interfaces ===
interface ContextHealth {
  overallHealth: 'healthy' | 'warning' | 'critical';
  score: number;
  failureModes: {
    poisoning: { detected: boolean; severity: string };
    distraction: { detected: boolean; severity: string };
    confusion: { detected: boolean; severity: string };
    clash: { detected: boolean; severity: string };
  };
  recommendations: string[];
  lastChecked: string;
}

interface ExceptionPattern {
  pattern: string;
  occurrences: number;
  isHarmless: boolean;
  category: string;
}

interface ExceptionInsights {
  harmlessPercentage: number;
  topPatterns: ExceptionPattern[];
  capacityLiberated: string;
  totalExceptions: number;
  autoResolved: number;
}

interface ScoutResult {
  id: string;
  source: string;
  title: string;
  relevance: number;
  status: 'pending' | 'approved' | 'rejected';
  discoveredAt: string;
  topic: string;
}

interface ScoutData {
  results: ScoutResult[];
  totalDiscovered: number;
  pendingReview: number;
  lastRun: string;
}

// === Existing Interfaces ===
interface LearningPattern {
  pattern: string;
  description: string;
  confidence: number;
}

interface InsightsStats {
  insightsGenerated: number;
  actionTaken: number;
}

interface InsightsData {
  insights: Insight[];
  learningPatterns: LearningPattern[];
  stats: InsightsStats;
}

type FilterType = AlertType | 'all';
type TabType = 'insights' | 'context' | 'exceptions' | 'scout';

// === Health Status Badge Component ===
const HealthBadge: React.FC<{ status: 'healthy' | 'warning' | 'critical' | string }> = ({ status }) => {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    healthy: { bg: 'rgba(19, 191, 203, 0.15)', color: '#13BFCB', label: 'Healthy' },
    warning: { bg: 'rgba(206, 152, 78, 0.15)', color: '#CE984E', label: 'Warning' },
    critical: { bg: 'rgba(239, 64, 53, 0.15)', color: '#EF4035', label: 'Critical' },
    clear: { bg: 'rgba(19, 191, 203, 0.15)', color: '#13BFCB', label: 'Clear' },
    detected: { bg: 'rgba(239, 64, 53, 0.15)', color: '#EF4035', label: 'Detected' },
  };
  
  const style = styles[status] || styles.warning;
  
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.25rem 0.75rem',
      fontSize: '0.75rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.025em',
      borderRadius: '9999px',
      backgroundColor: style.bg,
      color: style.color,
    }}>
      {style.label}
    </span>
  );
};

// === Pattern Badge Component ===
const PatternBadge: React.FC<{ isHarmless: boolean }> = ({ isHarmless }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.625rem',
    fontSize: '0.7rem',
    fontWeight: 600,
    borderRadius: '9999px',
    backgroundColor: isHarmless ? 'rgba(19, 191, 203, 0.15)' : 'rgba(206, 152, 78, 0.15)',
    color: isHarmless ? '#13BFCB' : '#CE984E',
  }}>
    {isHarmless ? 'Auto-resolve' : 'Manual'}
  </span>
);

// === Tab Button Component ===
const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  count?: number;
}> = ({ active, onClick, icon, label, count }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.75rem 1rem',
      fontSize: '0.875rem',
      fontWeight: active ? 600 : 500,
      border: 'none',
      borderBottom: active ? '2px solid #152B4E' : '2px solid transparent',
      backgroundColor: 'transparent',
      color: active ? '#152B4E' : '#64748B',
      cursor: 'pointer',
      transition: 'all 0.2s',
    }}
  >
    <span>{icon}</span>
    {label}
    {count !== undefined && (
      <span style={{
        padding: '0.125rem 0.5rem',
        fontSize: '0.7rem',
        fontWeight: 600,
        borderRadius: '9999px',
        backgroundColor: active ? '#152B4E' : '#E2E8F0',
        color: active ? 'white' : '#64748B',
      }}>
        {count}
      </span>
    )}
  </button>
);

// === Loading Skeleton ===
const LoadingSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-6">
    <div className="h-16 bg-rebel-gray-200 rounded-lg mb-6" />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-rebel-gray-200 rounded-lg" />)}
      </div>
      <div className="h-96 bg-rebel-gray-200 rounded-lg" />
    </div>
  </div>
);

// === Context Health Section ===
const ContextHealthSection: React.FC<{ health: ContextHealth | undefined }> = ({ health }) => {
  const failureModeIcons: Record<string, string> = {
    poisoning: '☠️',
    distraction: '🎯',
    confusion: '😵',
    clash: '⚡',
  };

  return (
    <div className="space-y-4">
      <Card padding="lg">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#152B4E', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🧠 Context Health Monitor
            <HealthBadge status={health?.overallHealth || 'warning'} />
          </h2>
          {health?.lastChecked && (
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
              Last checked: {new Date(health.lastChecked).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <ProgressBar 
            value={health?.score || 0} 
            max={100}
            label="Context Health Score"
            showValue
            size="lg"
            color={health?.score && health.score >= 80 ? 'success' : health?.score && health.score >= 50 ? 'warning' : 'danger'}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {(['poisoning', 'distraction', 'confusion', 'clash'] as const).map(mode => (
            <div key={mode} style={{
              textAlign: 'center',
              padding: '1rem',
              backgroundColor: '#F8FAFC',
              borderRadius: '0.5rem',
              border: health?.failureModes[mode]?.detected ? '1px solid rgba(239, 64, 53, 0.3)' : '1px solid transparent',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
                {failureModeIcons[mode]}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', textTransform: 'capitalize', marginBottom: '0.5rem' }}>
                {mode}
              </div>
              <HealthBadge status={health?.failureModes[mode]?.detected ? 'detected' : 'clear'} />
              {health?.failureModes[mode]?.detected && (
                <div style={{ fontSize: '0.65rem', color: '#EF4035', marginTop: '0.25rem' }}>
                  {health.failureModes[mode].severity}
                </div>
              )}
            </div>
          ))}
        </div>

        {health?.recommendations && health.recommendations.length > 0 && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            backgroundColor: 'rgba(206, 152, 78, 0.1)',
            borderRadius: '0.5rem',
            borderLeft: '3px solid #CE984E',
          }}>
            <div style={{ fontWeight: 600, color: '#CE984E', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              💡 Recommendations
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#7C5A2E' }}>
              {health.recommendations.map((rec, i) => (
                <li key={i} style={{ marginBottom: '0.25rem' }}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
};

// === Exception Patterns Section (DIRA) ===
const ExceptionPatternsSection: React.FC<{ exceptions: ExceptionInsights | undefined }> = ({ exceptions }) => (
  <div className="space-y-4">
    <Card padding="lg">
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#152B4E', marginBottom: '1rem' }}>
        🔍 Exception Pattern Discovery
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '3rem', fontWeight: 700, color: '#13BFCB' }}>
          {exceptions?.harmlessPercentage || 0}%
        </div>
        <div style={{ color: '#64748B' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
            of exceptions are harmless patterns
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
            {exceptions?.capacityLiberated || '0 hours/month'} capacity liberated
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '1rem', backgroundColor: '#F8FAFC', borderRadius: '0.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#152B4E' }}>
            {exceptions?.totalExceptions || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Total Exceptions</div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: 'rgba(19, 191, 203, 0.1)', borderRadius: '0.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#13BFCB' }}>
            {exceptions?.autoResolved || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Auto-resolved</div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: 'rgba(206, 152, 78, 0.1)', borderRadius: '0.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#CE984E' }}>
            {(exceptions?.totalExceptions || 0) - (exceptions?.autoResolved || 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Manual Review</div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#152B4E', marginBottom: '0.75rem' }}>
          Top Patterns
        </h3>
        <div className="space-y-2">
          {exceptions?.topPatterns?.slice(0, 5).map((p, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem',
              backgroundColor: '#F8FAFC',
              borderRadius: '0.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <code style={{
                  fontSize: '0.8rem',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: '#E2E8F0',
                  borderRadius: '0.25rem',
                  fontFamily: 'monospace',
                }}>
                  {p.pattern}
                </code>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{p.category}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500 }}>
                  {p.occurrences}x
                </span>
                <PatternBadge isHarmless={p.isHarmless} />
              </div>
            </div>
          )) || (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
              No patterns discovered yet
            </div>
          )}
        </div>
      </div>
    </Card>
  </div>
);

// === Scout Results Section ===
const ScoutResultsSection: React.FC<{ scout: ScoutData | undefined }> = ({ scout }) => {
  const statusColors: Record<string, { bg: string; color: string }> = {
    pending: { bg: 'rgba(206, 152, 78, 0.15)', color: '#CE984E' },
    approved: { bg: 'rgba(19, 191, 203, 0.15)', color: '#13BFCB' },
    rejected: { bg: 'rgba(239, 64, 53, 0.15)', color: '#EF4035' },
  };

  return (
    <div className="space-y-4">
      <Card padding="lg">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#152B4E' }}>
            🔭 KB Scout Results
          </h2>
          {scout?.lastRun && (
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
              Last scan: {new Date(scout.lastRun).toLocaleDateString()}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem', backgroundColor: '#F8FAFC', borderRadius: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#152B4E' }}>
              {scout?.totalDiscovered || 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Total Discovered</div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: 'rgba(206, 152, 78, 0.1)', borderRadius: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#CE984E' }}>
              {scout?.pendingReview || 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Pending Review</div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#152B4E', marginBottom: '0.75rem' }}>
            Recent Discoveries
          </h3>
          <div className="space-y-3">
            {scout?.results?.slice(0, 6).map((result) => (
              <div key={result.id} style={{
                padding: '0.875rem',
                backgroundColor: '#F8FAFC',
                borderRadius: '0.5rem',
                borderLeft: `3px solid ${statusColors[result.status]?.color || '#94A3B8'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, color: '#152B4E', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                      {result.title}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: '#94A3B8' }}>
                      <span>📍 {result.source}</span>
                      <span>📂 {result.topic}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '2rem',
                      height: '1.25rem',
                      backgroundColor: '#E2E8F0',
                      borderRadius: '0.25rem',
                      overflow: 'hidden',
                      position: 'relative',
                    }}>
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${result.relevance}%`,
                        backgroundColor: result.relevance >= 80 ? '#13BFCB' : result.relevance >= 50 ? '#CE984E' : '#EF4035',
                      }} />
                    </div>
                    <span style={{
                      padding: '0.125rem 0.5rem',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      borderRadius: '9999px',
                      backgroundColor: statusColors[result.status]?.bg,
                      color: statusColors[result.status]?.color,
                      textTransform: 'uppercase',
                    }}>
                      {result.status}
                    </span>
                  </div>
                </div>
              </div>
            )) || (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                No discoveries yet - run KB Scout to find new content
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

// === Existing Insights Section ===
const InsightsListSection: React.FC<{
  insights: Insight[];
  learningPatterns: LearningPattern[];
  stats: InsightsStats;
  filterType: FilterType;
  onFilterChange: (filter: FilterType) => void;
}> = ({ insights, learningPatterns, stats, filterType, onFilterChange }) => {
  const filteredInsights = insights.filter((insight) => {
    if (filterType === 'all') return true;
    return insight.type === filterType;
  });

  const filterCounts = {
    all: insights.length,
    warning: insights.filter(i => i.type === 'warning').length,
    error: insights.filter(i => i.type === 'error').length,
    success: insights.filter(i => i.type === 'success').length,
    info: insights.filter(i => i.type === 'info').length,
    drift_warning: insights.filter(i => i.type === 'drift_warning').length,
    pattern: insights.filter(i => i.type === 'pattern').length,
    optimization: insights.filter(i => i.type === 'optimization').length,
    anomaly: insights.filter(i => i.type === 'anomaly').length,
  } satisfies Record<FilterType, number>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { value: 'all' as FilterType, label: 'All' },
            { value: 'warning' as FilterType, label: 'Warnings' },
            { value: 'error' as FilterType, label: 'Errors' },
            { value: 'success' as FilterType, label: 'Successes' },
            { value: 'info' as FilterType, label: 'Info' },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => onFilterChange(filter.value)}
              className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-md cursor-pointer transition-all ${
                filterType === filter.value
                  ? 'bg-rebel-navy text-white border-rebel-navy font-semibold'
                  : 'bg-transparent text-rebel-gray-600 border-rebel-gray-200 hover:bg-rebel-gray-50'
              }`}
            >
              {filter.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                filterType === filter.value ? 'bg-white/20' : 'bg-rebel-gray-100'
              }`}>
                {filterCounts[filter.value]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
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
          <div className="text-center py-8 text-rebel-gray-500">
            <p>No insights in this category</p>
          </div>
        )}
      </div>

      <Card padding="lg">
        <CardHeader title="Learning Patterns" subtitle="AI-discovered optimizations" />
        <div className="flex flex-col gap-4">
          {learningPatterns.map((pattern, index) => (
            <div key={index} className="p-3 bg-rebel-gray-50 rounded-md">
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-sm font-semibold text-rebel-navy">
                  {pattern.pattern}
                </h4>
                <span className={`text-xs font-semibold ${
                  pattern.confidence >= 90 ? 'text-rebel-cyan' : 'text-rebel-blue'
                }`}>
                  {pattern.confidence}%
                </span>
              </div>
              <p className="text-sm text-rebel-gray-600 leading-relaxed">
                {pattern.description}
              </p>
            </div>
          ))}
          {learningPatterns.length === 0 && (
            <p className="text-center py-4 text-rebel-gray-500 text-sm">
              No patterns discovered yet
            </p>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-rebel-gray-200">
          <p className="text-xs font-bold uppercase tracking-wider text-rebel-gray-500 mb-3">
            This Month
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xl font-bold text-rebel-navy">{stats.insightsGenerated}</p>
              <p className="text-xs text-rebel-gray-500">Insights generated</p>
            </div>
            <div>
              <p className="text-xl font-bold text-rebel-cyan">{stats.actionTaken}%</p>
              <p className="text-xs text-rebel-gray-500">Action taken</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

// === Main Component ===
export const Insights: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('insights');
  const [filterType, setFilterType] = useState<FilterType>('all');

  // Fetch all data
  const { data, loading, error, refetch } = useApi<InsightsData>('/insights');
  const { data: health } = useApi<ContextHealth>('/context-health/summary');
  const { data: exceptions } = useApi<ExceptionInsights>('/exceptions/insights');
  const { data: scout } = useApi<ScoutData>('/kb/scout/results');

  if (loading) {
    return (
      <div>
        <PageHeader title="Insights & Learning" subtitle="AI-powered intelligence from your factory and knowledge base" />
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Insights & Learning" subtitle="AI-powered intelligence from your factory and knowledge base" />
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-rebel-red text-4xl mb-4">⚠️</div>
          <p className="text-rebel-red font-medium mb-2">Error loading insights</p>
          <p className="text-rebel-gray-500 text-sm mb-4">{error.message}</p>
          <button onClick={refetch} className="px-4 py-2 bg-rebel-navy text-white rounded-md hover:opacity-90">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const allInsights = data?.insights || [];
  const learningPatterns = data?.learningPatterns || [];
  const stats = data?.stats || { insightsGenerated: 0, actionTaken: 0 };
  const actionRequired = allInsights.filter(i => i.actionRequired).length;

  return (
    <div>
      <PageHeader 
        title="Insights & Learning" 
        subtitle="AI-powered intelligence from your factory and knowledge base" 
      />

      {/* Action Required Banner */}
      {actionRequired > 0 && (
        <div className="flex items-center gap-3 p-4 bg-rebel-red/10 border border-rebel-red/20 rounded-lg mb-6">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold text-rebel-navy">
              {actionRequired} insight{actionRequired > 1 ? 's' : ''} requiring attention
            </p>
            <p className="text-sm text-rebel-gray-600">
              Review and take action on critical items below
            </p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #E2E8F0',
        marginBottom: '1.5rem',
        overflowX: 'auto',
      }}>
        <TabButton
          active={activeTab === 'insights'}
          onClick={() => setActiveTab('insights')}
          icon="💡"
          label="Insights"
          count={allInsights.length}
        />
        <TabButton
          active={activeTab === 'context'}
          onClick={() => setActiveTab('context')}
          icon="🧠"
          label="Context Health"
        />
        <TabButton
          active={activeTab === 'exceptions'}
          onClick={() => setActiveTab('exceptions')}
          icon="🔍"
          label="Exception Patterns"
          count={exceptions?.topPatterns?.length}
        />
        <TabButton
          active={activeTab === 'scout'}
          onClick={() => setActiveTab('scout')}
          icon="🔭"
          label="KB Scout"
          count={scout?.pendingReview}
        />
      </div>

      {/* Tab Content */}
      {activeTab === 'insights' && (
        <InsightsListSection
          insights={allInsights}
          learningPatterns={learningPatterns}
          stats={stats}
          filterType={filterType}
          onFilterChange={setFilterType}
        />
      )}

      {activeTab === 'context' && (
        <ContextHealthSection health={health ?? undefined} />
      )}

      {activeTab === 'exceptions' && (
        <ExceptionPatternsSection exceptions={exceptions ?? undefined} />
      )}

      {activeTab === 'scout' && (
        <ScoutResultsSection scout={scout ?? undefined} />
      )}
    </div>
  );
};
