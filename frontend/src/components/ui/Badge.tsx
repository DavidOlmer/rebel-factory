import React from 'react';
import type { Tier, Category, Status } from '../../types';

type BadgeVariant = 'tier' | 'category' | 'status' | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  tier?: Tier;
  category?: Category;
  status?: Status;
  children?: React.ReactNode;
}

const tierStyles: Record<Tier, React.CSSProperties> = {
  core: {
    backgroundColor: 'rgba(63, 53, 214, 0.1)',
    color: 'var(--rebel-purple)',
  },
  venture: {
    backgroundColor: 'rgba(49, 103, 177, 0.1)',
    color: 'var(--rebel-blue)',
  },
  personal: {
    backgroundColor: 'var(--rebel-gray-100)',
    color: 'var(--rebel-gray-500)',
  },
};

const categoryStyles: Record<Category, React.CSSProperties> = {
  rebelgroup: {
    backgroundColor: 'rgba(239, 64, 53, 0.1)',
    color: 'var(--rebel-red)',
  },
  entertainment: {
    backgroundColor: 'rgba(251, 113, 84, 0.1)',
    color: 'var(--rebel-coral)',
  },
  travel: {
    backgroundColor: 'rgba(19, 191, 203, 0.1)',
    color: 'var(--rebel-teal)',
  },
  services: {
    backgroundColor: 'rgba(206, 152, 78, 0.1)',
    color: 'var(--rebel-gold)',
  },
  innovation: {
    backgroundColor: 'rgba(139, 138, 255, 0.1)',
    color: 'var(--rebel-lavender)',
  },
};

const statusStyles: Record<Status, React.CSSProperties> = {
  active: {
    backgroundColor: 'rgba(19, 191, 203, 0.1)',
    color: 'var(--rebel-cyan)',
  },
  inactive: {
    backgroundColor: 'var(--rebel-gray-100)',
    color: 'var(--rebel-gray-500)',
  },
  pending: {
    backgroundColor: 'rgba(206, 152, 78, 0.1)',
    color: 'var(--rebel-gold)',
  },
  error: {
    backgroundColor: 'rgba(239, 64, 53, 0.1)',
    color: 'var(--rebel-red)',
  },
};

const tierLabels: Record<Tier, string> = {
  core: 'Core',
  venture: 'Venture',
  personal: 'Personal',
};

const categoryLabels: Record<Category, string> = {
  rebelgroup: 'Rebel Group',
  entertainment: 'Entertainment',
  travel: 'Travel',
  services: 'Services',
  innovation: 'Innovation',
};

const statusLabels: Record<Status, string> = {
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
  error: 'Error',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  tier,
  category,
  status,
  children,
}) => {
  let style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    padding: '0.25rem 0.625rem',
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.025em',
    borderRadius: 'var(--radius-full)',
    whiteSpace: 'nowrap',
  };

  let label = children;

  if (variant === 'tier' && tier) {
    style = { ...style, ...tierStyles[tier] };
    label = label || tierLabels[tier];
  } else if (variant === 'category' && category) {
    style = { ...style, ...categoryStyles[category] };
    label = label || categoryLabels[category];
  } else if (variant === 'status' && status) {
    style = { ...style, ...statusStyles[status] };
    label = label || statusLabels[status];
  } else {
    style = {
      ...style,
      backgroundColor: 'var(--rebel-gray-100)',
      color: 'var(--rebel-gray-600)',
    };
  }

  return <span style={style}>{label}</span>;
};
