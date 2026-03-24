import React from 'react';
import type { NavItem } from '../../types';

interface SidebarProps {
  items: NavItem[];
  activePath: string;
  onNavigate: (path: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: '📊' },
  { label: 'Agents', path: '/agents', icon: '🤖' },
  { label: 'Templates', path: '/templates', icon: '📋' },
  { label: 'Prompts', path: '/prompts', icon: '💬' },
  { label: 'Telemetry', path: '/telemetry', icon: '📈' },
  { label: 'Costs', path: '/costs', icon: '💰' },
  { label: 'Insights', path: '/insights', icon: '💡' },
  { label: 'Approvals', path: '/approvals', icon: '✅' },
];

export { navItems };

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  activePath,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}) => {
  return (
    <aside style={{
      width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
      height: '100vh',
      background: 'var(--sidebar-gradient)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width var(--transition-base)',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? 'var(--space-4)' : 'var(--space-6)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <span style={{
            color: 'var(--rebel-red)',
            fontSize: collapsed ? 'var(--text-xl)' : 'var(--text-2xl)',
            fontWeight: 700,
            fontFamily: 'var(--font-headline)',
            letterSpacing: '0.1em',
          }}>
            {collapsed ? 'R' : 'REBEL'}
          </span>
          {!collapsed && (
            <span style={{
              color: 'var(--rebel-white)',
              fontSize: 'var(--text-sm)',
              opacity: 0.7,
            }}>
              AI Factory
            </span>
          )}
        </div>
        {onToggleCollapse && !collapsed && (
          <button
            onClick={onToggleCollapse}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--rebel-white)',
              cursor: 'pointer',
              opacity: 0.6,
              fontSize: 'var(--text-lg)',
            }}
          >
            ←
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav style={{
        flex: 1,
        padding: 'var(--space-4)',
        overflowY: 'auto',
      }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((item) => (
            <NavItemComponent
              key={item.path}
              item={item}
              isActive={activePath === item.path}
              collapsed={collapsed}
              onClick={() => onNavigate(item.path)}
            />
          ))}
        </ul>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div style={{
          padding: 'var(--space-4)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          color: 'var(--rebel-white)',
          fontSize: 'var(--text-xs)',
          opacity: 0.5,
          textAlign: 'center',
        }}>
          Rebel AI Ventures © 2026
        </div>
      )}
    </aside>
  );
};

interface NavItemComponentProps {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}

const NavItemComponent: React.FC<NavItemComponentProps> = ({
  item,
  isActive,
  collapsed,
  onClick,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <li style={{ marginBottom: 'var(--space-1)' }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: collapsed 
            ? 'var(--space-3)' 
            : 'var(--space-3) var(--space-4)',
          backgroundColor: isActive 
            ? 'var(--rebel-red)' 
            : isHovered 
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'transparent',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          color: 'var(--rebel-white)',
          fontSize: 'var(--text-sm)',
          fontWeight: isActive ? 600 : 400,
          cursor: 'pointer',
          transition: 'background-color var(--transition-fast)',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        <span style={{ fontSize: 'var(--text-lg)' }}>{item.icon}</span>
        {!collapsed && <span>{item.label}</span>}
      </button>
    </li>
  );
};
