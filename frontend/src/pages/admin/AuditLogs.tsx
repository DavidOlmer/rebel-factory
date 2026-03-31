import { useState, useMemo } from 'react'
import { 
  FileText,
  Search, 
  Filter, 
  Calendar,
  Download,
  RefreshCw,
  Clock,
  User,
  Bot,
  Server,
  AlertTriangle,
  Info,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react'
import StatsCard from '../../components/admin/StatsCard'
import AuditLogRow from '../../components/admin/AuditLogRow'
import type { AuditLogEntry } from '../../types/admin'

// Generate extensive mock audit data
const generateMockAuditData = (): AuditLogEntry[] => {
  const actions = [
    { action: 'user.login', resource: 'session', actorType: 'user' as const, severity: 'info' as const },
    { action: 'user.logout', resource: 'session', actorType: 'user' as const, severity: 'info' as const },
    { action: 'user.created', resource: 'user', actorType: 'user' as const, severity: 'info' as const },
    { action: 'user.role_changed', resource: 'user', actorType: 'user' as const, severity: 'warning' as const },
    { action: 'user.suspended', resource: 'user', actorType: 'user' as const, severity: 'warning' as const },
    { action: 'agent.created', resource: 'agent', actorType: 'user' as const, severity: 'info' as const },
    { action: 'agent.run.started', resource: 'sprint', actorType: 'agent' as const, severity: 'info' as const },
    { action: 'agent.run.completed', resource: 'sprint', actorType: 'agent' as const, severity: 'info' as const },
    { action: 'agent.run.failed', resource: 'sprint', actorType: 'agent' as const, severity: 'critical' as const },
    { action: 'agent.promoted', resource: 'agent', actorType: 'user' as const, severity: 'info' as const },
    { action: 'tenant.created', resource: 'tenant', actorType: 'user' as const, severity: 'info' as const },
    { action: 'tenant.plan_upgraded', resource: 'tenant', actorType: 'system' as const, severity: 'info' as const },
    { action: 'tenant.token_limit.warning', resource: 'tenant', actorType: 'system' as const, severity: 'warning' as const },
    { action: 'tenant.token_limit.exceeded', resource: 'tenant', actorType: 'system' as const, severity: 'critical' as const },
    { action: 'api.rate_limit.exceeded', resource: 'api', actorType: 'system' as const, severity: 'critical' as const },
    { action: 'security.failed_login', resource: 'auth', actorType: 'system' as const, severity: 'warning' as const },
    { action: 'security.mfa_enabled', resource: 'user', actorType: 'user' as const, severity: 'info' as const },
    { action: 'data.exported', resource: 'export', actorType: 'user' as const, severity: 'info' as const },
    { action: 'settings.changed', resource: 'config', actorType: 'user' as const, severity: 'warning' as const },
    { action: 'backup.created', resource: 'system', actorType: 'system' as const, severity: 'info' as const },
  ]

  const users = [
    'admin@rebel.ai', 'john.doe@acme.com', 'jane.smith@techstart.io', 
    'sarah@newclient.com', 'alex.dev@acme.com', 'lisa@enterprise.co'
  ]
  const agents = ['CodeReviewer', 'DataAnalyzer', 'TestRunner', 'DocWriter', 'SecurityScanner']
  const tenants = ['acme', 'techstart', 'enterprise', 'startup', 'newclient']

  const entries: AuditLogEntry[] = []
  
  for (let i = 0; i < 150; i++) {
    const template = actions[Math.floor(Math.random() * actions.length)]
    const timestamp = new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 30) // Last 30 days
    
    let actor = template.actorType === 'user' 
      ? users[Math.floor(Math.random() * users.length)]
      : template.actorType === 'agent'
        ? agents[Math.floor(Math.random() * agents.length)]
        : 'system'

    entries.push({
      id: `audit-${i}`,
      timestamp: timestamp.toISOString(),
      action: template.action,
      actor,
      actorType: template.actorType,
      resource: template.resource,
      resourceId: `${template.resource}_${Math.random().toString(36).substr(2, 8)}`,
      details: getDetailText(template.action),
      severity: template.severity,
      tenantId: tenants[Math.floor(Math.random() * tenants.length)],
    })
  }

  return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

function getDetailText(action: string): string {
  const details: Record<string, string[]> = {
    'user.login': ['User logged in successfully', 'Session started from new device', 'Login from recognized location'],
    'user.logout': ['User logged out', 'Session ended', 'Signed out from all devices'],
    'user.created': ['New user account created', 'User invited to platform', 'User registration completed'],
    'user.role_changed': ['User role updated to admin', 'Permissions modified', 'Role downgraded'],
    'user.suspended': ['Account suspended due to policy violation', 'User deactivated by admin', 'Temporary suspension applied'],
    'agent.created': ['New agent created from template', 'Custom agent deployed', 'Agent cloned from catalog'],
    'agent.run.started': ['Sprint execution started', 'Agent run initiated', 'Batch processing began'],
    'agent.run.completed': ['Sprint completed successfully with 15,000 tokens', 'Run finished in 45 seconds', 'Processing completed'],
    'agent.run.failed': ['Execution failed: timeout', 'Run aborted: API error', 'Processing failed: invalid input'],
    'agent.promoted': ['Agent promoted to global catalog', 'Template published for all tenants', 'Agent made public'],
    'tenant.created': ['New organization onboarded', 'Tenant provisioned', 'Workspace created'],
    'tenant.plan_upgraded': ['Upgraded from Pro to Enterprise', 'Plan tier increased', 'Subscription changed'],
    'tenant.token_limit.warning': ['90% of monthly token limit reached', 'Approaching usage cap', 'Token usage alert'],
    'tenant.token_limit.exceeded': ['Monthly token limit exceeded', 'Usage cap reached', 'Overage recorded'],
    'api.rate_limit.exceeded': ['API rate limit reached', 'Too many requests', 'Throttling applied'],
    'security.failed_login': ['Multiple failed login attempts detected', 'Invalid credentials provided', 'Account lockout triggered'],
    'security.mfa_enabled': ['Two-factor authentication enabled', 'MFA configured', 'Security enhanced'],
    'data.exported': ['User data exported to CSV', 'Report generated', 'Data download completed'],
    'settings.changed': ['System settings modified', 'Configuration updated', 'Preferences changed'],
    'backup.created': ['Automatic backup completed', 'Snapshot created', 'Data backed up'],
  }
  const options = details[action] || ['Action performed']
  return options[Math.floor(Math.random() * options.length)]
}

const mockAuditData = generateMockAuditData()

type SeverityFilter = 'all' | 'info' | 'warning' | 'critical'
type ActorTypeFilter = 'all' | 'user' | 'system' | 'agent'

export default function AuditLogs() {
  const [entries] = useState<AuditLogEntry[]>(mockAuditData)
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [actorTypeFilter, setActorTypeFilter] = useState<ActorTypeFilter>('all')
  const [tenantFilter, setTenantFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null)
  const entriesPerPage = 20

  // Get unique values for filters
  const uniqueTenants = [...new Set(entries.map(e => e.tenantId).filter(Boolean))]
  const uniqueActions = [...new Set(entries.map(e => e.action))]

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesSearch = 
        search === '' ||
        entry.action.toLowerCase().includes(search.toLowerCase()) ||
        entry.actor.toLowerCase().includes(search.toLowerCase()) ||
        entry.details.toLowerCase().includes(search.toLowerCase()) ||
        entry.resourceId.toLowerCase().includes(search.toLowerCase())
      
      const matchesSeverity = severityFilter === 'all' || entry.severity === severityFilter
      const matchesActorType = actorTypeFilter === 'all' || entry.actorType === actorTypeFilter
      const matchesTenant = tenantFilter === 'all' || entry.tenantId === tenantFilter
      const matchesAction = actionFilter === 'all' || entry.action === actionFilter
      
      const entryDate = new Date(entry.timestamp)
      const matchesDateFrom = !dateFrom || entryDate >= new Date(dateFrom)
      const matchesDateTo = !dateTo || entryDate <= new Date(dateTo + 'T23:59:59')

      return matchesSearch && matchesSeverity && matchesActorType && matchesTenant && matchesAction && matchesDateFrom && matchesDateTo
    })
  }, [entries, search, severityFilter, actorTypeFilter, tenantFilter, actionFilter, dateFrom, dateTo])

  // Pagination
  const totalPages = Math.ceil(filteredEntries.length / entriesPerPage)
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage
  )

  // Stats
  const stats = {
    total: entries.length,
    info: entries.filter(e => e.severity === 'info').length,
    warning: entries.filter(e => e.severity === 'warning').length,
    critical: entries.filter(e => e.severity === 'critical').length,
  }

  const clearFilters = () => {
    setSearch('')
    setSeverityFilter('all')
    setActorTypeFilter('all')
    setTenantFilter('all')
    setActionFilter('all')
    setDateFrom('')
    setDateTo('')
    setCurrentPage(1)
  }

  const hasActiveFilters = search || severityFilter !== 'all' || actorTypeFilter !== 'all' || 
    tenantFilter !== 'all' || actionFilter !== 'all' || dateFrom || dateTo

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Action', 'Actor', 'Actor Type', 'Resource', 'Resource ID', 'Details', 'Severity', 'Tenant'],
      ...filteredEntries.map(e => [
        e.timestamp,
        e.action,
        e.actor,
        e.actorType,
        e.resource,
        e.resourceId,
        e.details,
        e.severity,
        e.tenantId || ''
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Audit Logs</h1>
          <p className="text-gray-400 mt-1">Complete activity history across the platform</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard
          label="Total Events"
          value={stats.total.toLocaleString()}
          icon={FileText}
          color="text-blue-400"
        />
        <StatsCard
          label="Info Events"
          value={stats.info.toLocaleString()}
          icon={Info}
          color="text-blue-400"
        />
        <StatsCard
          label="Warnings"
          value={stats.warning.toLocaleString()}
          icon={AlertTriangle}
          color="text-yellow-400"
        />
        <StatsCard
          label="Critical Events"
          value={stats.critical.toLocaleString()}
          icon={AlertCircle}
          color="text-red-400"
        />
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            Filters
          </h3>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Clear All
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-sm text-gray-400 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search actions, actors, details..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">From Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1) }}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">To Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1) }}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => { setSeverityFilter(e.target.value as SeverityFilter); setCurrentPage(1) }}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-red-500"
            >
              <option value="all">All Severity</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Actor Type */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Actor Type</label>
            <select
              value={actorTypeFilter}
              onChange={(e) => { setActorTypeFilter(e.target.value as ActorTypeFilter); setCurrentPage(1) }}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-red-500"
            >
              <option value="all">All Actors</option>
              <option value="user">Users</option>
              <option value="system">System</option>
              <option value="agent">Agents</option>
            </select>
          </div>

          {/* Tenant */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Tenant</label>
            <select
              value={tenantFilter}
              onChange={(e) => { setTenantFilter(e.target.value); setCurrentPage(1) }}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-red-500"
            >
              <option value="all">All Tenants</option>
              {uniqueTenants.map(tenant => (
                <option key={tenant} value={tenant}>{tenant}</option>
              ))}
            </select>
          </div>

          {/* Action Type */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Action Type</label>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1) }}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-red-500"
            >
              <option value="all">All Actions</option>
              {uniqueActions.sort().map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        {/* Table Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <p className="text-gray-400">
            Showing <span className="text-white font-medium">{filteredEntries.length}</span> of {entries.length} events
          </p>
        </div>

        {/* Log Entries */}
        <div className="divide-y divide-gray-700">
          {paginatedEntries.map((entry) => (
            <AuditLogRow 
              key={entry.id} 
              entry={entry} 
              onClick={() => setSelectedEntry(entry)}
            />
          ))}

          {paginatedEntries.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No audit logs found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              
              {/* Page Numbers */}
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded ${
                        currentPage === pageNum
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Audit Log Details</h3>
              <button 
                onClick={() => setSelectedEntry(null)}
                className="p-2 hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-400 mb-1">Action</p>
                  <p className="text-white font-medium">{selectedEntry.action}</p>
                </div>
                <div className="p-4 bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-400 mb-1">Severity</p>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedEntry.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                    selectedEntry.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {selectedEntry.severity}
                  </span>
                </div>
                <div className="p-4 bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-400 mb-1">Actor</p>
                  <div className="flex items-center gap-2 text-white">
                    {selectedEntry.actorType === 'user' && <User className="w-4 h-4 text-blue-400" />}
                    {selectedEntry.actorType === 'agent' && <Bot className="w-4 h-4 text-green-400" />}
                    {selectedEntry.actorType === 'system' && <Server className="w-4 h-4 text-purple-400" />}
                    <span>{selectedEntry.actor}</span>
                  </div>
                </div>
                <div className="p-4 bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-400 mb-1">Actor Type</p>
                  <p className="text-white capitalize">{selectedEntry.actorType}</p>
                </div>
                <div className="p-4 bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-400 mb-1">Resource</p>
                  <p className="text-white">{selectedEntry.resource}</p>
                </div>
                <div className="p-4 bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-400 mb-1">Resource ID</p>
                  <p className="text-white font-mono text-sm">{selectedEntry.resourceId}</p>
                </div>
                <div className="p-4 bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-400 mb-1">Timestamp</p>
                  <div className="flex items-center gap-2 text-white">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>{new Date(selectedEntry.timestamp).toLocaleString()}</span>
                  </div>
                </div>
                <div className="p-4 bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-400 mb-1">Tenant</p>
                  <p className="text-white">{selectedEntry.tenantId || 'N/A'}</p>
                </div>
              </div>

              <div className="p-4 bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-400 mb-2">Details</p>
                <p className="text-white">{selectedEntry.details}</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setSelectedEntry(null)}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
