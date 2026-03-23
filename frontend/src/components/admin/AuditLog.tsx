import { useState } from 'react'
import { 
  Search, 
  Filter, 
  Clock, 
  User, 
  Bot, 
  Server,
  AlertTriangle,
  Info,
  AlertCircle,
  Download,
  RefreshCw
} from 'lucide-react'
import type { AuditLogEntry } from '../../types/admin'

interface AuditLogProps {
  entries: AuditLogEntry[]
  onRefresh?: () => void
  onExport?: () => void
}

export default function AuditLog({ entries, onRefresh, onExport }: AuditLogProps) {
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [actorTypeFilter, setActorTypeFilter] = useState<string>('all')

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = 
      entry.action.toLowerCase().includes(search.toLowerCase()) ||
      entry.actor.toLowerCase().includes(search.toLowerCase()) ||
      entry.resource.toLowerCase().includes(search.toLowerCase()) ||
      entry.details.toLowerCase().includes(search.toLowerCase())
    const matchesSeverity = severityFilter === 'all' || entry.severity === severityFilter
    const matchesActorType = actorTypeFilter === 'all' || entry.actorType === actorTypeFilter
    return matchesSearch && matchesSeverity && matchesActorType
  })

  const severityConfig: Record<string, { icon: typeof Info; color: string; bg: string }> = {
    info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/20' },
    warning: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    critical: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/20' },
  }

  const actorTypeIcons: Record<string, typeof User> = {
    user: User,
    system: Server,
    agent: Bot,
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Audit Log</h3>
          <div className="flex gap-2">
            {onRefresh && (
              <button 
                onClick={onRefresh}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            )}
            {onExport && (
              <button 
                onClick={onExport}
                className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search actions, actors, resources..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="pl-9 pr-8 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-red-500"
              >
                <option value="all">All Severity</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <select
              value={actorTypeFilter}
              onChange={(e) => setActorTypeFilter(e.target.value)}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-red-500"
            >
              <option value="all">All Actors</option>
              <option value="user">Users</option>
              <option value="system">System</option>
              <option value="agent">Agents</option>
            </select>
          </div>
        </div>
      </div>

      {/* Log Entries */}
      <div className="divide-y divide-gray-700 max-h-[600px] overflow-y-auto">
        {filteredEntries.map((entry) => {
          const severity = severityConfig[entry.severity]
          const SeverityIcon = severity.icon
          const ActorIcon = actorTypeIcons[entry.actorType]

          return (
            <div 
              key={entry.id} 
              className="p-4 hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Severity Icon */}
                <div className={`p-2 rounded-lg ${severity.bg}`}>
                  <SeverityIcon className={`w-5 h-5 ${severity.color}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">{entry.action}</span>
                    <span className="text-gray-500">on</span>
                    <span className="text-red-400 font-mono text-sm">{entry.resource}</span>
                    {entry.resourceId && (
                      <span className="text-gray-500 font-mono text-xs">#{entry.resourceId}</span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mb-2">{entry.details}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-gray-500">
                      <ActorIcon className="w-4 h-4" />
                      <span>{entry.actor}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    {entry.tenantId && (
                      <span className="text-gray-600 text-xs">
                        Tenant: {entry.tenantId}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {filteredEntries.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No audit log entries found matching your filters.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-700 text-sm text-gray-400">
        Showing {filteredEntries.length} of {entries.length} entries
      </div>
    </div>
  )
}
