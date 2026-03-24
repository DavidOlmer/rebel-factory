import React, { useState, createContext, useContext } from 'react';
import './styles/rebel-theme.css';

import { Sidebar, navItems } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Agents } from './pages/Agents';
import { AgentDetail } from './pages/AgentDetail';
import { Templates } from './pages/Templates';
import { Prompts } from './pages/Prompts';
import { Telemetry } from './pages/Telemetry';
import { Costs } from './pages/Costs';
import { Insights } from './pages/Insights';
import { Approvals } from './pages/Approvals';
import { CreateAgent } from './pages/CreateAgent';

// Navigation context for child components
interface NavigationContextType {
  navigate: (path: string) => void;
}

const NavigationContext = createContext<NavigationContextType>({ navigate: () => {} });

export const useNavigation = () => useContext(NavigationContext);

const App: React.FC = () => {
  const [activePath, setActivePath] = useState('/');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navigate = (path: string) => setActivePath(path);

  const renderPage = () => {
    // Check for agent detail route pattern: /agents/:id
    const agentDetailMatch = activePath.match(/^\/agents\/([^/]+)$/);
    if (agentDetailMatch && agentDetailMatch[1] !== 'new') {
      return <AgentDetail agentId={agentDetailMatch[1]} />;
    }

    switch (activePath) {
      case '/':
        return <Dashboard />;
      case '/agents':
        return <Agents />;
      case '/agents/new':
        return <CreateAgent />;
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
    <NavigationContext.Provider value={{ navigate }}>
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
    </NavigationContext.Provider>
  );
};

export default App;
