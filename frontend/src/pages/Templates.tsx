import React, { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { TemplateCard } from '../components/features/TemplateCard';
import type { Template, Category } from '../types';

// Mock data
const mockTemplates: Template[] = [
  {
    id: '1',
    name: 'Customer Service Agent',
    description: 'Complete setup for multi-brand customer support with escalation paths.',
    category: 'rebelgroup',
    tier: 'core',
    usageCount: 23,
    rating: 4.8,
    createdAt: '2026-02-15',
  },
  {
    id: '2',
    name: 'Travel Booking Flow',
    description: 'End-to-end booking automation for D-reizen and Prijsvrij.',
    category: 'travel',
    tier: 'venture',
    usageCount: 18,
    rating: 4.5,
    createdAt: '2026-02-20',
  },
  {
    id: '3',
    name: 'Event Promo Generator',
    description: 'Creates promotional content for AFAS Live and Pathé events.',
    category: 'entertainment',
    tier: 'venture',
    usageCount: 12,
    rating: 4.2,
    createdAt: '2026-03-01',
  },
  {
    id: '4',
    name: 'Invoice Processor',
    description: 'Extracts and validates invoice data for finance teams.',
    category: 'services',
    tier: 'core',
    usageCount: 31,
    rating: 4.9,
    createdAt: '2026-01-10',
  },
  {
    id: '5',
    name: 'Startup Evaluator',
    description: 'Analyzes startup pitches and generates investment memos.',
    category: 'innovation',
    tier: 'personal',
    usageCount: 7,
    rating: 4.1,
    createdAt: '2026-03-10',
  },
  {
    id: '6',
    name: 'Content Calendar Builder',
    description: 'Plans and generates social media content calendars.',
    category: 'entertainment',
    tier: 'venture',
    usageCount: 15,
    rating: 4.4,
    createdAt: '2026-02-28',
  },
];

type FilterCategory = Category | 'all';

const categoryTabs: { value: FilterCategory; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '📁' },
  { value: 'rebelgroup', label: 'Rebel Group', icon: '🔥' },
  { value: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { value: 'travel', label: 'Travel', icon: '✈️' },
  { value: 'services', label: 'Services', icon: '⚙️' },
  { value: 'innovation', label: 'Innovation', icon: '💡' },
];

export const Templates: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');

  const filteredTemplates = mockTemplates.filter((template) => {
    if (activeCategory === 'all') return true;
    return template.category === activeCategory;
  });

  return (
    <div>
      <PageHeader
        title="Templates"
        subtitle="Reusable agent configurations for Rebel Group sectors"
        action={{
          label: 'Create Template',
          icon: '+',
          onClick: () => {},
        }}
      />

      {/* Category Tabs */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-1)',
        marginBottom: 'var(--space-6)',
        borderBottom: '1px solid var(--rebel-gray-200)',
        overflowX: 'auto',
        paddingBottom: 'var(--space-1)',
      }}>
        {categoryTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveCategory(tab.value)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-3) var(--space-4)',
              fontSize: 'var(--text-sm)',
              fontWeight: activeCategory === tab.value ? 600 : 400,
              color: activeCategory === tab.value 
                ? 'var(--rebel-red)' 
                : 'var(--rebel-gray-600)',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeCategory === tab.value 
                ? '2px solid var(--rebel-red)' 
                : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all var(--transition-fast)',
              marginBottom: '-1px',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.value !== 'all' && (
              <span style={{
                fontSize: 'var(--text-xs)',
                backgroundColor: activeCategory === tab.value 
                  ? 'rgba(239, 64, 53, 0.1)' 
                  : 'var(--rebel-gray-100)',
                padding: '0.125rem 0.5rem',
                borderRadius: 'var(--radius-full)',
              }}>
                {mockTemplates.filter(t => t.category === tab.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 'var(--space-4)',
      }}>
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onClick={() => {}}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: 'var(--space-12)',
          color: 'var(--rebel-gray-500)',
        }}>
          <p style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>
            No templates in this category
          </p>
          <p style={{ fontSize: 'var(--text-sm)' }}>
            Create the first one!
          </p>
        </div>
      )}
    </div>
  );
};
