import React, { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { PromptCard } from '../components/features/PromptCard';
import type { Prompt } from '../types';

// Mock data
const mockPrompts: Prompt[] = [
  {
    id: '1',
    name: 'Customer Intent Classifier',
    content: 'You are analyzing a customer message. Classify the intent into one of the following categories: booking_inquiry, complaint, general_question, feedback, cancellation, modification. Consider the tone and urgency...',
    category: 'rebelgroup',
    usageCount: 4521,
    rating: 4.7,
    version: '2.3',
  },
  {
    id: '2',
    name: 'Travel Package Recommender',
    content: 'Based on the customer preferences provided, recommend 3 travel packages. Consider: budget range, preferred destinations, travel dates, party size, accommodation preferences, activity interests...',
    category: 'travel',
    usageCount: 2341,
    rating: 4.5,
    version: '1.8',
  },
  {
    id: '3',
    name: 'Event Description Writer',
    content: 'Write an engaging event description for the following show/movie. Tone should be exciting but professional. Include: headline hook, main description (100 words), key highlights, call to action...',
    category: 'entertainment',
    usageCount: 1876,
    rating: 4.3,
    version: '3.1',
  },
  {
    id: '4',
    name: 'Invoice Data Extractor',
    content: 'Extract the following fields from the invoice text: invoice_number, date, vendor_name, total_amount, line_items, vat_amount, payment_terms. Return as structured JSON...',
    category: 'services',
    usageCount: 3214,
    rating: 4.9,
    version: '2.0',
  },
  {
    id: '5',
    name: 'Startup Pitch Analyzer',
    content: 'Analyze the following startup pitch deck summary. Evaluate: market opportunity (1-10), team strength (1-10), business model viability (1-10), competitive advantage (1-10). Provide brief reasoning...',
    category: 'innovation',
    usageCount: 567,
    rating: 4.2,
    version: '1.2',
  },
  {
    id: '6',
    name: 'Complaint Response Generator',
    content: 'Draft a professional response to the customer complaint. Acknowledge the issue, apologize sincerely, explain next steps, offer appropriate compensation if warranted. Maintain brand voice...',
    category: 'rebelgroup',
    usageCount: 2987,
    rating: 4.6,
    version: '2.5',
  },
];

export const Prompts: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'usage' | 'name'>('rating');

  const filteredPrompts = mockPrompts
    .filter((prompt) => {
      if (!searchQuery) return true;
      return (
        prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prompt.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'usage':
          return b.usageCount - a.usageCount;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

  return (
    <div>
      <PageHeader
        title="Prompts"
        subtitle="Prompt library with versioning and quality ratings"
        action={{
          label: 'New Prompt',
          icon: '+',
          onClick: () => {},
        }}
      />

      {/* Search and Sort */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
        flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          <input
            type="text"
            placeholder="Search prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: 'var(--space-3) var(--space-4)',
              fontSize: 'var(--text-sm)',
              border: '1px solid var(--rebel-gray-200)',
              borderRadius: 'var(--radius-md)',
              outline: 'none',
              transition: 'border-color var(--transition-fast)',
            }}
          />
        </div>

        {/* Sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--rebel-gray-500)',
          }}>
            Sort by:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--text-sm)',
              border: '1px solid var(--rebel-gray-200)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--rebel-white)',
              cursor: 'pointer',
            }}
          >
            <option value="rating">Highest Rated</option>
            <option value="usage">Most Used</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-6)',
        marginBottom: 'var(--space-6)',
        padding: 'var(--space-4)',
        backgroundColor: 'var(--rebel-gray-50)',
        borderRadius: 'var(--radius-lg)',
      }}>
        <div>
          <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--rebel-navy)' }}>
            {mockPrompts.length}
          </span>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--rebel-gray-500)', marginLeft: 'var(--space-2)' }}>
            Total Prompts
          </span>
        </div>
        <div style={{ borderLeft: '1px solid var(--rebel-gray-200)', paddingLeft: 'var(--space-6)' }}>
          <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--rebel-navy)' }}>
            {mockPrompts.reduce((sum, p) => sum + p.usageCount, 0).toLocaleString()}
          </span>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--rebel-gray-500)', marginLeft: 'var(--space-2)' }}>
            Total Uses
          </span>
        </div>
        <div style={{ borderLeft: '1px solid var(--rebel-gray-200)', paddingLeft: 'var(--space-6)' }}>
          <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--rebel-gold)' }}>
            {(mockPrompts.reduce((sum, p) => sum + p.rating, 0) / mockPrompts.length).toFixed(1)}
          </span>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--rebel-gray-500)', marginLeft: 'var(--space-2)' }}>
            Avg Rating
          </span>
        </div>
      </div>

      {/* Prompts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 'var(--space-4)',
      }}>
        {filteredPrompts.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            onClick={() => {}}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredPrompts.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: 'var(--space-12)',
          color: 'var(--rebel-gray-500)',
        }}>
          <p style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>
            No prompts found
          </p>
          <p style={{ fontSize: 'var(--text-sm)' }}>
            Try adjusting your search
          </p>
        </div>
      )}
    </div>
  );
};
