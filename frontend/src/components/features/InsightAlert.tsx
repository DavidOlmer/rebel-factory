import React from 'react';
import { Button } from '../ui/Button';
import type { Insight, AlertType } from '../../types';

interface InsightAlertProps {
  insight: Insight;
  onDismiss?: () => void;
  onAction?: () => void;
}

const alertStyles: Record<AlertType, {
  background: string;
  border: string;
  icon: string;
  iconColor: string;
}> = {
  warning: {
    background: 'rgba(206, 152, 78, 0.08)',
    border: 'rgba(206, 152, 78, 0.3)',
    icon: '!',
    iconColor: 'var(--rebel-gold)',
  },
  success: {
    background: 'rgba(19, 191, 203, 0.08)',
    border: 'rgba(19, 191, 203, 0.3)',
    icon: 'OK',
    iconColor: 'var(--rebel-cyan)',
  },
  error: {
    background: 'rgba(239, 64, 53, 0.08)',
    border: 'rgba(239, 64, 53, 0.3)',
    icon: 'X',
    iconColor: 'var(--rebel-red)',
  },
  info: {
    background: 'rgba(49, 103, 177, 0.08)',
    border: 'rgba(49, 103, 177, 0.3)',
    icon: 'i',
    iconColor: 'var(--rebel-blue)',
  },
  drift_warning: {
    background: 'rgba(206, 152, 78, 0.08)',
    border: 'rgba(206, 152, 78, 0.3)',
    icon: 'DW',
    iconColor: 'var(--rebel-gold)',
  },
  pattern: {
    background: 'rgba(49, 103, 177, 0.08)',
    border: 'rgba(49, 103, 177, 0.3)',
    icon: 'PT',
    iconColor: 'var(--rebel-blue)',
  },
  optimization: {
    background: 'rgba(19, 191, 203, 0.08)',
    border: 'rgba(19, 191, 203, 0.3)',
    icon: '+',
    iconColor: 'var(--rebel-cyan)',
  },
  anomaly: {
    background: 'rgba(239, 64, 53, 0.08)',
    border: 'rgba(239, 64, 53, 0.3)',
    icon: 'AN',
    iconColor: 'var(--rebel-red)',
  },
};

export const InsightAlert: React.FC<InsightAlertProps> = ({
  insight,
  onDismiss,
  onAction,
}) => {
  const style = alertStyles[insight.type];

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return 'Unknown';

    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div style={{
      display: 'flex',
      gap: 'var(--space-3)',
      padding: 'var(--space-4)',
      backgroundColor: style.background,
      border: `1px solid ${style.border}`,
      borderRadius: 'var(--radius-lg)',
    }}>
      <div style={{
        width: '2rem',
        height: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--text-sm)',
        fontWeight: 700,
        color: style.iconColor,
        flexShrink: 0,
      }}>
        {style.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 'var(--space-1)',
        }}>
          <h4 style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--rebel-navy)',
          }}>
            {insight.title}
          </h4>
          <span style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--rebel-gray-400)',
            flexShrink: 0,
            marginLeft: 'var(--space-2)',
          }}>
            {formatTime(insight.timestamp ?? insight.createdAt)}
          </span>
        </div>

        <p style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--rebel-gray-600)',
          marginBottom: insight.actionRequired ? 'var(--space-3)' : 0,
        }}>
          {insight.message ?? insight.description}
        </p>

        {insight.actionRequired && (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button size="sm" onClick={onAction}>
              Take Action
            </Button>
            {onDismiss && (
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                Dismiss
              </Button>
            )}
          </div>
        )}
      </div>

      {!insight.actionRequired && onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--rebel-gray-400)',
            cursor: 'pointer',
            padding: 'var(--space-1)',
            fontSize: 'var(--text-lg)',
            lineHeight: 1,
          }}
        >
          x
        </button>
      )}
    </div>
  );
};
