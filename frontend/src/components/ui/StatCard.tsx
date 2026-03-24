import React from 'react';
import { Card } from './Card';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: number;
  trendLabel?: string;
  icon?: string;
  color?: 'default' | 'success' | 'warning' | 'error';
}

const colorMap = {
  default: 'var(--rebel-navy)',
  success: 'var(--rebel-cyan)',
  warning: 'var(--rebel-gold)',
  error: 'var(--rebel-red)',
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  trend,
  trendLabel,
  icon,
  color = 'default',
}) => {
  const trendIsPositive = trend !== undefined && trend >= 0;
  const trendColor = trendIsPositive ? 'var(--rebel-lime)' : 'var(--rebel-coral)';
  const trendIcon = trendIsPositive ? '↑' : '↓';

  return (
    <Card padding="md">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div>
          <p style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--rebel-gray-500)',
            marginBottom: 'var(--space-2)',
          }}>
            {label}
          </p>
          <p style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            fontFamily: 'var(--font-headline)',
            color: colorMap[color],
            lineHeight: 1,
          }}>
            {value}
          </p>
          {trend !== undefined && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              marginTop: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
            }}>
              <span style={{ color: trendColor, fontWeight: 600 }}>
                {trendIcon} {Math.abs(trend)}%
              </span>
              {trendLabel && (
                <span style={{ color: 'var(--rebel-gray-400)' }}>
                  {trendLabel}
                </span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <span style={{
            fontSize: '1.5rem',
            opacity: 0.8,
          }}>
            {icon}
          </span>
        )}
      </div>
    </Card>
  );
};
