import { Link } from 'react-router-dom'
import { 
  Users, 
  Building2, 
  Bot, 
  Coins, 
  Shield, 
  Activity,
  ArrowRight,
  AlertTriangle,
  TrendingUp
} from 'lucide-react'
import StatsCard from '../../components/admin/StatsCard'
import type { AdminStats, SecurityAlert, AuditLogEntry } from '../../types/admin'

// Mock data
const mockStats: AdminStats = {
  totalUsers: 1247,
  activeUsers: 892,
  totalTenants: 45,
  activeTenants: 42,
  totalAgents: 328,
  promotedAgents: 24,
  monthlyTokens: 847500000,
  monthlyRevenue: 12450,
  securityAlerts: 3,
}

const mockAlerts: SecurityAlert[] = [
  {
    id: '1',
    type: 'suspicious_login',
    severity: 'high',
    status: 'new',
    title: 'Multiple failed login attempts',
    description: 'User john.doe@acme.com had 15 failed login attempts from IP 192.168.1.100',
    affectedUser: 'john.doe@acme.com',
    affectedTenant: 'Acme Corp',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: '2',
    type: 'token_abuse',
    severity: 'medium',
    status: 'investigating',
    title: 'Unusual token consumption',
    description: 'Tenant "TechStart" exceeded daily average by 500%',
    affectedTenant: 'TechStart',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: '3',
    type: 'permission_escalation',
    severity: 'critical',
    status: 'new',
    title: 'Attempted admin access',
    description: 'User attempted to access admin endpoints without proper permissions',
    affectedUser: 'mike@startup.io',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
]

const mockRecentActivity: AuditLogEntry[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    action: 'user.created',
    actor: 'admin@rebel.ai',
    actorType: 'user',
    resource: 'user',
    resourceId: 'usr_12345',
    details: 'Created new user sarah@newclient.com',
    severity: 'info',
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    action: 'tenant.plan_upgraded',
    actor: 'system',
    actorType: 'system',
    resource: 'tenant',
    resourceId: 'tnt_acme',
    details: 'Acme Corp upgraded from Pro to Enterprise',
    severity: 'info',
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    action: 'agent.promoted',
    actor: 'admin@rebel.ai',
    actorType: 'user',
    resource: 'agent',
    resourceId: 'agt_review',
    details: 'CodeReviewer agent promoted to global catalog',
    severity: 'info',
  },
]

export default function AdminDashboard() {
  const stats = mockStats
  const alerts = mockAlerts
  const recentActivity = mockRecentActivity

  const severityColors: Record<string, string> = {
    low: 'text-blue-400 bg-blue-500/20',
    medium: 'text-yellow-400 bg-yellow-500/20',
    high: 'text-orange-400 bg-orange-500/20',
    critical: 'text-red-400 bg-red-500/20',
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-400 mt-1">Platform overview and management</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Activity className="w-4 h-4 text-green-400" />
          <span>All systems operational</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          label="Total Users"
          value={stats.totalUsers.toLocaleString()}
          icon={Users}
          color="text-blue-400"
          trend={{ value: 12, isPositive: true }}
        />
        <StatsCard
          label="Active Tenants"
          value={stats.activeTenants}
          icon={Building2}
          color="text-purple-400"
          trend={{ value: 5, isPositive: true }}
        />
        <StatsCard
          label="Global Agents"
          value={stats.promotedAgents}
          icon={Bot}
          color="text-green-400"
          trend={{ value: 8, isPositive: true }}
        />
        <StatsCard
          label="Monthly Revenue"
          value={`$${stats.monthlyRevenue.toLocaleString()}`}
          icon={Coins}
          color="text-yellow-400"
          trend={{ value: 15, isPositive: true }}
        />
      </div>

      {/* Token Usage Summary */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Platform Token Usage</h2>
          <Link to="/admin/analytics" className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1">
            View Analytics <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-gray-700/50 rounded-lg">
            <p className="text-gray-400 text-sm mb-1">Total Tokens (This Month)</p>
            <p className="text-2xl font-bold text-white">
              {(stats.monthlyTokens / 1000000).toFixed(1)}M
            </p>
          </div>
          <div className="p-4 bg-gray-700/50 rounded-lg">
            <p className="text-gray-400 text-sm mb-1">Avg per Tenant</p>
            <p className="text-2xl font-bold text-white">
              {(stats.monthlyTokens / stats.activeTenants / 1000000).toFixed(2)}M
            </p>
          </div>
          <div className="p-4 bg-gray-700/50 rounded-lg">
            <p className="text-gray-400 text-sm mb-1">Estimated Cost</p>
            <p className="text-2xl font-bold text-green-400">
              ${(stats.monthlyTokens * 0.000002).toFixed(0)}
            </p>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Security Alerts */}
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="p-6 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-red-400" />
              <h2 className="text-xl font-semibold text-white">Security Alerts</h2>
              {stats.securityAlerts > 0 && (
                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-full">
                  {stats.securityAlerts} new
                </span>
              )}
            </div>
            <Link to="/admin/security" className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-4 space-y-3">
            {alerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-700/50 transition-colors"
              >
                <div className={`p-2 rounded-lg ${severityColors[alert.severity]}`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white">{alert.title}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${severityColors[alert.severity]}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1 truncate">{alert.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="p-6 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
            </div>
            <Link to="/admin/analytics" className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1">
              Full log <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-4 space-y-3">
            {recentActivity.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-700/50 transition-colors"
              >
                <div className="p-2 rounded-lg bg-gray-700">
                  <Activity className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white">
                    <span className="font-medium">{entry.action}</span>
                  </p>
                  <p className="text-sm text-gray-400 mt-1">{entry.details}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>{entry.actor}</span>
                    <span>•</span>
                    <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/admin/users"
            className="p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors text-center"
          >
            <Users className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <p className="text-white font-medium">Manage Users</p>
          </Link>
          <Link
            to="/admin/tenants"
            className="p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors text-center"
          >
            <Building2 className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <p className="text-white font-medium">Manage Tenants</p>
          </Link>
          <Link
            to="/admin/agents"
            className="p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors text-center"
          >
            <Bot className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-white font-medium">Agent Catalog</p>
          </Link>
          <Link
            to="/admin/security"
            className="p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors text-center"
          >
            <Shield className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-white font-medium">Security Center</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
