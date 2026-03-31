import { Link } from 'react-router-dom'
import { Bot, Activity, Clock, AlertTriangle } from 'lucide-react'
import type { Agent, Status } from '../types'

interface AgentCardProps {
  agent: Agent
}

export default function AgentCard({ agent }: AgentCardProps) {
  const statusConfig: Partial<Record<Status, {
    icon: typeof Activity
    color: string
    bgColor: string
    borderColor: string
    label: string
    pulse: boolean
  }>> = {
    active: {
      icon: Activity,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/30',
      label: 'Active',
      pulse: true,
    },
    running: {
      icon: Activity,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/30',
      label: 'Running',
      pulse: true,
    },
    idle: {
      icon: Clock,
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/20',
      borderColor: 'border-gray-500/30',
      label: 'Idle',
      pulse: false,
    },
    error: {
      icon: AlertTriangle,
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-500/30',
      label: 'Error',
      pulse: false,
    },
    inactive: {
      icon: Clock,
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/20',
      borderColor: 'border-gray-500/30',
      label: 'Inactive',
      pulse: false,
    },
    pending: {
      icon: Clock,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/30',
      label: 'Pending',
      pulse: false,
    },
    paused: {
      icon: Clock,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/30',
      label: 'Paused',
      pulse: false,
    },
    archived: {
      icon: Clock,
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/20',
      borderColor: 'border-gray-500/30',
      label: 'Archived',
      pulse: false,
    },
  }

  const status = statusConfig[agent.status] ?? statusConfig.idle!
  const StatusIcon = status.icon
  const createdLabel = agent.createdAt
    ? new Date(agent.createdAt).toLocaleDateString()
    : 'Unknown'

  return (
    <Link
      to={`/agents/${agent.id}`}
      className={`block bg-gray-800 rounded-xl p-6 border ${status.borderColor} hover:border-red-500/50 transition-all group`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${status.bgColor}`}>
          <Bot className={`w-6 h-6 ${status.color}`} />
        </div>
        <div className="flex items-center gap-2">
          {status.pulse && (
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          )}
          <span className={`text-sm font-medium ${status.color}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Info */}
      <h3 className="text-lg font-semibold text-white group-hover:text-red-400 transition-colors">
        {agent.name}
      </h3>
      <p className="text-gray-400 text-sm mt-1">
        Template: {agent.template ?? 'Custom'}
      </p>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between text-sm">
        <span className="text-gray-500">
          Created {createdLabel}
        </span>
        <StatusIcon className={`w-4 h-4 ${status.color}`} />
      </div>
    </Link>
  )
}
