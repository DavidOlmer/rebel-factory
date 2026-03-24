import React, { useState } from 'react';
import './styles/rebel-theme.css';

import { Sidebar, navItems } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Agents } from './pages/Agents';
import { Templates } from './pages/Templates';
import { Prompts } from './pages/Prompts';
import { Telemetry } from './pages/Telemetry';
import { Costs } from './pages/Costs';
import { Insights } from './pages/Insights';
import { Approvals } from './pages/Approvals';

const App: React.FC = () => {
  const [activePath, setActivePath] = useState('/');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderPage = () => {
    switch (activePath) {
      case '/':
        return <Dashboard />;
      case '/agents':
        return <Agents />;
      case '/templates':
        return <Templates />;
      case '/prompts':
        return <Prompts />;
      case '/telemetry':
        return <Telemetry />;
      case '/costs':
        return <Costs />;
      case '/insights':
        return <Insights />;
      case '/approvals':
        return <Approvals />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        items={navItems}
        activePath={activePath}
        onNavigate={setActivePath}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main
        style={{
          flex: 1,
          marginLeft: sidebarCollapsed 
            ? 'var(--sidebar-collapsed-width)' 
            : 'var(--sidebar-width)',
          padding: 'var(--space-6)',
          backgroundColor: 'var(--rebel-gray-50)',
          minHeight: '100vh',
          transition: 'margin-left var(--transition-base)',
        }}
      >
        {renderPage()}
      </main>
    </div>
  );
};

export default App;
