import React from 'react';

interface CardProps {
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

const paddingMap = {
  none: '0',
  sm: 'var(--space-3)',
  md: 'var(--space-4)',
  lg: 'var(--space-6)',
};

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  hoverable = false,
  onClick,
  style,
  className,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--rebel-white)',
    border: '1px solid var(--rebel-gray-200)',
    borderRadius: 'var(--radius-lg)',
    padding: paddingMap[padding],
    boxShadow: isHovered && hoverable 
      ? 'var(--shadow-md)' 
      : 'var(--shadow-sm)',
    transition: 'box-shadow var(--transition-fast), transform var(--transition-fast)',
    transform: isHovered && hoverable ? 'translateY(-2px)' : 'none',
    cursor: onClick ? 'pointer' : 'default',
    ...style,
  };

  return (
    <div
      className={className}
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </div>
  );
};

// Card Header subcomponent
interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ title, subtitle, action }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 'var(--space-4)',
  }}>
    <div>
      <h3 style={{ 
        fontSize: 'var(--text-lg)', 
        fontWeight: 600,
        color: 'var(--rebel-navy)',
        marginBottom: subtitle ? 'var(--space-1)' : 0,
      }}>
        {title}
      </h3>
      {subtitle && (
        <p style={{ 
          fontSize: 'var(--text-sm)', 
          color: 'var(--rebel-gray-500)' 
        }}>
          {subtitle}
        </p>
      )}
    </div>
    {action}
  </div>
);

// Card Content subcomponent
interface CardContentProps {
  children: React.ReactNode;
}

export const CardContent: React.FC<CardContentProps> = ({ children }) => (
  <div>{children}</div>
);
