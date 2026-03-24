import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import type { Template } from '../../types';

interface TemplateCardProps {
  template: Template;
  onClick?: () => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({ template, onClick }) => {
  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    const stars = [];
    
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push('★');
      } else if (i === fullStars && hasHalf) {
        stars.push('☆');
      } else {
        stars.push('☆');
      }
    }
    
    return stars.join('');
  };

  return (
    <Card hoverable onClick={onClick}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 'var(--space-3)',
      }}>
        <h3 style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 600,
          color: 'var(--rebel-navy)',
          flex: 1,
        }}>
          {template.name}
        </h3>
        <Badge variant="tier" tier={template.tier} />
      </div>

      {/* Description */}
      <p style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--rebel-gray-500)',
        marginBottom: 'var(--space-3)',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {template.description}
      </p>

      {/* Category Badge */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Badge variant="category" category={template.category} />
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
        <div style={{ color: 'var(--rebel-gold)' }}>
          {renderStars(template.rating)}
          <span style={{ 
            marginLeft: 'var(--space-1)', 
            color: 'var(--rebel-gray-400)',
          }}>
            {template.rating.toFixed(1)}
          </span>
        </div>
        <div style={{ color: 'var(--rebel-gray-400)' }}>
          {template.usageCount.toLocaleString()} uses
        </div>
      </div>
    </Card>
  );
};
