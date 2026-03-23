import { useState } from 'react'
import { 
  Shield, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle,
  Clock,
  Search,
  Filter,
  Eye,
  X,
  RefreshCw,
  Lock,
  Unlock,
  UserX,
  Activity,
  Globe,
  Key
} from 'lucide-react'
import StatsCard from '../../components/admin/StatsCard'
import type { SecurityAlert } from '../../types/admin'

// Mock data
const mockAlerts: SecurityAlert[] = [
  {
    id: '1',
    type: 'brute_force',
    severity: 'high',
    status: 'new',
    title: 'Multiple failed login attempts detected',
    description: 'User john.doe@acme.com had 15 failed login attempts from IP 192.168.1.100 in the last 10 minutes. This may indicate a brute force attack.',
    affectedUser: 'john.doe@acme.com',
    affectedTenant: 'Acme Corp',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: '2',
    type: 'token_abuse',
    severity: 'medium',
    status: 'investigating',
    title: 'Unusual token consumption pattern',
    description: 'Tenant "TechStart" token usage exceeded daily average by 500%. An agent appears to be running in an infinite loop.',
    affectedTenant: 'TechStart',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: '3',
    type: 'permission_escalation',
    severity: 'critical',
    status: 'new',
    title: 'Attempted admin access without authorization',
    description: 'User mike@startup.io attempted to access admin endpoints 5 times without proper permissions. Request originated from unfamiliar IP address.',
    affectedUser: 'mike@startup.io',
    affectedTenant: 'Startup Labs',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: '4',
    type: 'suspicious_login',
    severity: 'medium',
    status: 'new',
    title: 'Login from new location',
    description: 'User sarah@enterprise.co logged in from a new country (Germany) that has not been seen before for this account.',
    affectedUser: 'sarah@enterprise.co',
    affectedTenant: 'Enterprise Co',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    id: '5',
    type: 'data_export',
    severity: 'high',
    status: 'resolved',
    title: 'Large data export detected',
    description: 'User admin@acme.com exported 50,000 records in a single request. Export was verified as legitimate business operation.',
    affectedUser: 'admin@acme.com',
    affectedTenant: 'Acme Corp',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    resolvedAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
  },
  {
    id: '6',
    type: 'brute_force',
    severity: 'low',
    status: 'dismissed',
    title: 'Failed login attempts',
    description: 'User forgot password and triggered multiple failed attempts before resetting.',
    affectedUser: 'jane@techstart.io',
    affectedTenant: 'TechStart',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
]

const securityMetrics = {
  totalAlerts: 23,
  newAlerts: 4,
  activeIncidents: 2,
  resolvedToday: 5,
  avgResponseTime: '24 min',
  blockedIPs: 12,
}

export default function AdminSecurity() {
  const [alerts, setAlerts] = useState(mockAlerts)
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null)

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = 
      alert.title.toLowerCase().includes(search.toLowerCase()) ||
      alert.description.toLowerCase().includes(search.toLowerCase()) ||
      alert.affectedUser?.toLowerCase().includes(search.toLowerCase()) ||
      alert.affectedTenant?.toLowerCase().includes(search.toLowerCase())
    const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter
    const matchesStatus = statusFilter === 'all' || alert.status === statusFilter
    return matchesSearch && matchesSeverity && matchesStatus
  })

  const handleResolve = (alertId: string) => {
    setAlerts(alerts.map(a => 
      a.id === alertId 
        ? { ...a, status: 'resolved' as const, resolvedAt: new Date().toISOString() } 
        : a
    ))
    setSelectedAlert(null)
  }

  const handleDismiss = (alertId: string) => {
    setAlerts(alerts.map(a => 
      a.id === alertId ? { ...a, status: 'dismissed' as const } : a
    ))
    setSelectedAlert(null)
  }

  const handleInvestigate = (alertId: string) => {
    setAlerts(alerts.map(a => 
      a.id === alertId ? { ...a, status: 'investigating' as const } : a
    ))
  }

  const severityConfig: Record<string, { color: string; bg: string; border: string }> = {
    low: { color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
    medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' },
    high: { color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30' },
    critical: { color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
  }

  const statusConfig: Record<string, { color: string; icon: typeof Clock }> = {
    new: { color: 'text-red-400', icon: AlertCircle },
    investigating: { color: 'text-yellow-400', icon: Clock },
    resolved: { color: 'text-green-400', icon: CheckCircle },
    dismissed: { color: 'text-gray-400', icon: X },
  }

  const typeIcons: Record<string, typeof Shield> = {
    brute_force: Lock,
    suspicious_login: Globe,
    token_abuse: Activity,
    permission_escalation: Key,
    data_export: Unlock,
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Security Center</h1>
          <p className="text-gray-400 mt-1">Monitor and respond to security alerts</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatsCard
          label="New Alerts"
          value={securityMetrics.newAlerts}
          icon={AlertTriangle}
          color="text-red-400"
        />
        <StatsCard
          label="Investigating"
          value={securityMetrics.activeIncidents}
          icon={Clock}
          color="text-yellow-400"
        />
        <StatsCard
          label="Resolved Today"
          value={securityMetrics.resolvedToday}
          icon={CheckCircle}
          color="text-green-400"
        />
        <StatsCard
          label="Total (30d)"
          value={securityMetrics.totalAlerts}
          icon={Shield}
          color="text-blue-400"
        />
        <StatsCard
          label="Avg Response"
          value={securityMetrics.avgResponseTime}
          icon={Activity}
          color="text-purple-400"
        />
        <StatsCard
          label="Blocked IPs"
          value={securityMetrics.blockedIPs}
          icon={UserX}
          color="text-gray-400"
        />
      </div>

      {/* Active Critical Alerts Banner */}
      {alerts.filter(a => a.severity === 'critical' && a.status === 'new').length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/20 rounded-lg animate-pulse">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="font-medium text-white">Critical Security Alert</p>
              <p className="text-sm text-gray-400">
                {alerts.filter(a => a.severity === 'critical' && a.status === 'new').length} critical alerts require immediate attention
              </p>
            </div>
          </div>
          <button 
            onClick={() => setSeverityFilter('critical')}
            className="px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors"
          >
            Review Now
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search alerts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
          />
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="pl-9 pr-8 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-red-500"
            >
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-red-500"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {filteredAlerts.map((alert) => {
          const severity = severityConfig[alert.severity]
          const status = statusConfig[alert.status]
          const StatusIcon = status.icon
          const TypeIcon = typeIcons[alert.type] || Shield

          return (
            <div 
              key={alert.id}
              className={`bg-gray-800 rounded-xl border ${severity.border} p-4 hover:bg-gray-700/50 transition-colors cursor-pointer`}
              onClick={() => setSelectedAlert(alert)}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`p-3 rounded-lg ${severity.bg}`}>
                  <TypeIcon className={`w-6 h-6 ${severity.color}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-medium text-white">{alert.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severity.bg} ${severity.color}`}>
                      {alert.severity}
                    </span>
                    <span className={`flex items-center gap-1 text-xs ${status.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {alert.status}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm line-clamp-2 mb-2">{alert.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {alert.affectedUser && (
                      <span>User: {alert.affectedUser}</span>
                    )}
                    {alert.affectedTenant && (
                      <span>Tenant: {alert.affectedTenant}</span>
                    )}
                    <span>{new Date(alert.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2">
                  {alert.status === 'new' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleInvestigate(alert.id) }}
                      className="p-2 text-yellow-400 hover:bg-yellow-500/20 rounded-lg transition-colors"
                      title="Start Investigation"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  )}
                  {(alert.status === 'new' || alert.status === 'investigating') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleResolve(alert.id) }}
                      className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                      title="Mark Resolved"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {filteredAlerts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No security alerts found matching your filters.</p>
          </div>
        )}
      </div>

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${severityConfig[selectedAlert.severity].bg}`}>
                  {(() => {
                    const TypeIcon = typeIcons[selectedAlert.type] || Shield
                    return <TypeIcon className={`w-8 h-8 ${severityConfig[selectedAlert.severity].color}`} />
                  })()}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">{selectedAlert.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityConfig[selectedAlert.severity].bg} ${severityConfig[selectedAlert.severity].color}`}>
                      {selectedAlert.severity}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-400 text-sm">{selectedAlert.type.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="p-2 hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm text-gray-400">Description</label>
                <p className="text-white mt-1">{selectedAlert.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {selectedAlert.affectedUser && (
                  <div className="p-4 bg-gray-700/50 rounded-lg">
                    <label className="text-sm text-gray-400">Affected User</label>
                    <p className="text-white font-medium mt-1">{selectedAlert.affectedUser}</p>
                  </div>
                )}
                {selectedAlert.affectedTenant && (
                  <div className="p-4 bg-gray-700/50 rounded-lg">
                    <label className="text-sm text-gray-400">Affected Tenant</label>
                    <p className="text-white font-medium mt-1">{selectedAlert.affectedTenant}</p>
                  </div>
                )}
                <div className="p-4 bg-gray-700/50 rounded-lg">
                  <label className="text-sm text-gray-400">Detected At</label>
                  <p className="text-white font-medium mt-1">
                    {new Date(selectedAlert.timestamp).toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-gray-700/50 rounded-lg">
                  <label className="text-sm text-gray-400">Status</label>
                  <p className={`font-medium mt-1 ${statusConfig[selectedAlert.status].color}`}>
                    {selectedAlert.status}
                  </p>
                </div>
              </div>

              {selectedAlert.resolvedAt && (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <label className="text-sm text-gray-400">Resolved At</label>
                  <p className="text-green-400 font-medium mt-1">
                    {new Date(selectedAlert.resolvedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-700">
              <button
                onClick={() => setSelectedAlert(null)}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
              
              {selectedAlert.status === 'new' && (
                <>
                  <button
                    onClick={() => handleInvestigate(selectedAlert.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Investigate
                  </button>
                  <button
                    onClick={() => handleDismiss(selectedAlert.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-gray-300 rounded-lg hover:bg-gray-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Dismiss
                  </button>
                </>
              )}
              
              {(selectedAlert.status === 'new' || selectedAlert.status === 'investigating') && (
                <button
                  onClick={() => handleResolve(selectedAlert.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors ml-auto"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark Resolved
                </button>
              )}

              {selectedAlert.affectedUser && selectedAlert.status !== 'resolved' && (
                <button className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors">
                  <UserX className="w-4 h-4" />
                  Suspend User
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
