import React from 'react';
import { Button } from '../ui/Button';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    icon?: string;
    onClick: () => void;
  };
  breadcrumb?: string[];
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  action,
  breadcrumb,
}) => {
  return (
    <header style={{
      marginBottom: 'var(--space-6)',
    }}>
      {/* Breadcrumb */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-3)',
          fontSize: 'var(--text-sm)',
          color: 'var(--rebel-gray-400)',
        }}>
          {breadcrumb.map((item, index) => (
            <React.Fragment key={item}>
              {index > 0 && <span>/</span>}
              <span style={{
                color: index === breadcrumb.length - 1 
                  ? 'var(--rebel-navy)' 
                  : 'inherit',
              }}>
                {item}
              </span>
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Title row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 'var(--space-4)',
      }}>
        <div>
          <h1 style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            fontFamily: 'var(--font-headline)',
            color: 'var(--rebel-navy)',
            marginBottom: subtitle ? 'var(--space-1)' : 0,
          }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{
              fontSize: 'var(--text-base)',
              color: 'var(--rebel-gray-500)',
            }}>
              {subtitle}
            </p>
          )}
        </div>

        {action && (
          <Button onClick={action.onClick} icon={action.icon ? <span>{action.icon}</span> : undefined}>
            {action.label}
          </Button>
        )}
      </div>
    </header>
  );
};
