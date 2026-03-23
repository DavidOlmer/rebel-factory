import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import AdminLayout from './components/admin/AdminLayout'
import Dashboard from './pages/Dashboard'
import Agents from './pages/Agents'
import AgentDetail from './pages/AgentDetail'
import CreateAgent from './pages/CreateAgent'
import Sprints from './pages/Sprints'

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard'
import AdminUsers from './pages/admin/Users'
import AdminTenants from './pages/admin/Tenants'
import AdminAgents from './pages/admin/Agents'
import AdminAnalytics from './pages/admin/Analytics'
import AdminAuditLogs from './pages/admin/AuditLogs'
import AdminSecurity from './pages/admin/Security'

export default function App() {
  return (
    <Routes>
      {/* Main Factory Routes */}
      <Route path="/" element={<Layout><Dashboard /></Layout>} />
      <Route path="/agents" element={<Layout><Agents /></Layout>} />
      <Route path="/agents/:id" element={<Layout><AgentDetail /></Layout>} />
      <Route path="/agents/new" element={<Layout><CreateAgent /></Layout>} />
      <Route path="/sprints" element={<Layout><Sprints /></Layout>} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
      <Route path="/admin/users" element={<AdminLayout><AdminUsers /></AdminLayout>} />
      <Route path="/admin/tenants" element={<AdminLayout><AdminTenants /></AdminLayout>} />
      <Route path="/admin/agents" element={<AdminLayout><AdminAgents /></AdminLayout>} />
      <Route path="/admin/analytics" element={<AdminLayout><AdminAnalytics /></AdminLayout>} />
      <Route path="/admin/audit" element={<AdminLayout><AdminAuditLogs /></AdminLayout>} />
      <Route path="/admin/security" element={<AdminLayout><AdminSecurity /></AdminLayout>} />
    </Routes>
  )
}
