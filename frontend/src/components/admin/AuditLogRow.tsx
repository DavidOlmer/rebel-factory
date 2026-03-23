import { 
  Clock, 
  User, 
  Bot, 
  Server,
  AlertTriangle,
  Info,
  AlertCircle,
  ChevronRight
} from 'lucide-react'
import type { AuditLogEntry } from '../../types/admin'

interface AuditLogRowProps {
  entry: AuditLogEntry
  onClick?: () => void
}

export default function AuditLogRow({ entry, onClick }: AuditLogRowProps) {
  const severityConfig = {
    info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/20' },
    warning: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    critical: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/20' },
  }

  const actorTypeConfig = {
    user: { icon: User, color: 'text-blue-400' },
    agent: { icon: Bot, color: 'text-green-400' },
    system: { icon: Server, color: 'text-purple-400' },
  }

  const severity = severityConfig[entry.severity]
  const actorType = actorTypeConfig[entry.actorType]
  const SeverityIcon = severity.icon
  const ActorIcon = actorType.icon

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    // Less than 1 minute
    if (diff < 60000) return 'Just now'
    // Less than 1 hour
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    // Less than 24 hours
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    // Less than 7 days
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
    // Otherwise show date
    return date.toLocaleDateString()
  }

  return (
    <div 
      className="p-4 hover:bg-gray-700/50 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        {/* Severity Icon */}
        <div className={`p-2 rounded-lg flex-shrink-0 ${severity.bg}`}>
          <SeverityIcon className={`w-5 h-5 ${severity.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-white">{entry.action}</span>
            <span className="text-gray-500">on</span>
            <span className="text-red-400 font-mono text-sm bg-red-500/10 px-2 py-0.5 rounded">
              {entry.resource}
            </span>
            {entry.resourceId && (
              <span className="text-gray-500 font-mono text-xs">
                #{entry.resourceId.slice(-8)}
              </span>
            )}
          </div>
          
          <p className="text-gray-400 text-sm mb-2 truncate">{entry.details}</p>
          
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <div className={`flex items-center gap-1 ${actorType.color}`}>
              <ActorIcon className="w-4 h-4" />
              <span>{entry.actor}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-500">
              <Clock className="w-4 h-4" />
              <span title={new Date(entry.timestamp).toLocaleString()}>
                {formatTimestamp(entry.timestamp)}
              </span>
            </div>
            {entry.tenantId && (
              <span className="text-gray-600 text-xs px-2 py-0.5 bg-gray-700/50 rounded">
                {entry.tenantId}
              </span>
            )}
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0" />
      </div>
    </div>
  )
}
