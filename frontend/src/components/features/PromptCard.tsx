import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import type { Prompt } from '../../types';

interface PromptCardProps {
  prompt: Prompt;
  onClick?: () => void;
}

export const PromptCard: React.FC<PromptCardProps> = ({ prompt, onClick }) => {
  return (
    <Card hoverable onClick={onClick}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 'var(--space-2)',
      }}>
        <h3 style={{
          fontSize: 'var(--text-base)',
          fontWeight: 600,
          color: 'var(--rebel-navy)',
          flex: 1,
        }}>
          {prompt.name}
        </h3>
        <span style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--rebel-gray-400)',
          padding: '0.125rem 0.5rem',
          backgroundColor: 'var(--rebel-gray-100)',
          borderRadius: 'var(--radius-sm)',
        }}>
          v{prompt.version}
        </span>
      </div>

      {/* Preview */}
      <div style={{
        backgroundColor: 'var(--rebel-gray-50)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3)',
        marginBottom: 'var(--space-3)',
        fontFamily: 'monospace',
        fontSize: 'var(--text-xs)',
        color: 'var(--rebel-gray-600)',
        maxHeight: '4rem',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {prompt.content.slice(0, 150)}...
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '1.5rem',
          background: 'linear-gradient(transparent, var(--rebel-gray-50))',
        }} />
      </div>

      {/* Category */}
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <Badge variant="category" category={prompt.category} />
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 'var(--space-3)',
        borderTop: '1px solid var(--rebel-gray-100)',
        fontSize: 'var(--text-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <span style={{ color: 'var(--rebel-gold)' }}>★</span>
          <span style={{ color: 'var(--rebel-gray-600)', fontWeight: 500 }}>
            {prompt.rating.toFixed(1)}
          </span>
        </div>
        <div style={{ color: 'var(--rebel-gray-400)' }}>
          {prompt.usageCount.toLocaleString()} uses
        </div>
      </div>
    </Card>
  );
};
