import React from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'default' | 'success' | 'warning' | 'danger' | 'gradient';
}

const heightMap = {
  sm: '4px',
  md: '8px',
  lg: '12px',
};

const colorMap = {
  default: 'var(--rebel-blue)',
  success: 'var(--rebel-cyan)',
  warning: 'var(--rebel-gold)',
  danger: 'var(--rebel-red)',
  gradient: 'linear-gradient(90deg, var(--rebel-red) 0%, var(--rebel-coral) 100%)',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  showValue = false,
  size = 'md',
  color = 'default',
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  // Auto-color based on percentage if not specified
  const autoColor = 
    percentage > 90 ? 'danger' :
    percentage > 70 ? 'warning' :
    color;

  const fillColor = color === 'default' ? colorMap[autoColor] : colorMap[color];

  return (
    <div style={{ width: '100%' }}>
      {(label || showValue) && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-2)',
          fontSize: 'var(--text-sm)',
        }}>
          {label && (
            <span style={{ 
              color: 'var(--rebel-gray-600)',
              fontWeight: 500,
            }}>
              {label}
            </span>
          )}
          {showValue && (
            <span style={{ 
              color: 'var(--rebel-gray-500)',
              fontWeight: 600,
            }}>
              {value.toLocaleString()} / {max.toLocaleString()}
            </span>
          )}
        </div>
      )}
      <div style={{
        width: '100%',
        height: heightMap[size],
        backgroundColor: 'var(--rebel-gray-200)',
        borderRadius: 'var(--radius-full)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          background: fillColor,
          borderRadius: 'var(--radius-full)',
          transition: 'width var(--transition-base)',
        }} />
      </div>
    </div>
  );
};
