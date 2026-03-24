import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const styles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: 'var(--rebel-red)',
    color: 'var(--rebel-white)',
  },
  secondary: {
    backgroundColor: 'var(--rebel-navy)',
    color: 'var(--rebel-white)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--rebel-navy)',
    border: '1px solid var(--rebel-gray-200)',
  },
  danger: {
    backgroundColor: 'var(--rebel-coral)',
    color: 'var(--rebel-white)',
  },
};

const sizes: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '0.375rem 0.75rem', fontSize: 'var(--text-sm)' },
  md: { padding: '0.5rem 1rem', fontSize: 'var(--text-base)' },
  lg: { padding: '0.75rem 1.5rem', fontSize: 'var(--text-lg)' },
};

const hoverColors: Record<ButtonVariant, string> = {
  primary: 'var(--rebel-red-hover)',
  secondary: 'var(--rebel-navy-hover)',
  ghost: 'var(--rebel-gray-100)',
  danger: '#E5614A',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  style,
  ...props
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    borderRadius: 'var(--radius-md)',
    border: 'none',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: 'all var(--transition-fast)',
    opacity: disabled || loading ? 0.6 : 1,
    ...styles[variant],
    ...sizes[size],
    ...(isHovered && !disabled && !loading
      ? { backgroundColor: hoverColors[variant] }
      : {}),
    ...style,
  };

  return (
    <button
      style={baseStyle}
      disabled={disabled || loading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {loading ? (
        <span style={{ 
          width: '1em', 
          height: '1em', 
          border: '2px solid currentColor',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }} />
      ) : icon}
      {children}
    </button>
  );
};
