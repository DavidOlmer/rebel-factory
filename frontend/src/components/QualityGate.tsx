import { Check, X, Loader, Clock } from 'lucide-react'
import type { QualityGate as QualityGateType } from '../types'

interface QualityGateProps {
  gate: QualityGateType
  compact?: boolean
  mini?: boolean
}

export default function QualityGate({ gate, compact = false, mini = false }: QualityGateProps) {
  const statusConfig = {
    passed: {
      icon: Check,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/30',
    },
    failed: {
      icon: X,
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-500/30',
    },
    pending: {
      icon: Clock,
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/20',
      borderColor: 'border-gray-500/30',
    },
    running: {
      icon: Loader,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/30',
    },
  }

  const status = statusConfig[gate.status] || statusConfig.pending
  const Icon = status.icon

  // Mini variant - just a dot
  if (mini) {
    return (
      <div
        className={`w-2 h-2 rounded-full ${status.bgColor}`}
        title={`${gate.name}: ${gate.status}`}
      />
    )
  }

  // Compact variant - icon + name
  if (compact) {
    return (
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded ${status.bgColor}`}
        title={gate.details}
      >
        <Icon className={`w-3 h-3 ${status.color} ${gate.status === 'running' ? 'animate-spin' : ''}`} />
        <span className={`text-xs font-medium ${status.color}`}>{gate.name}</span>
      </div>
    )
  }

  // Full variant
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${status.borderColor} ${status.bgColor}`}>
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded ${status.bgColor}`}>
          <Icon className={`w-4 h-4 ${status.color} ${gate.status === 'running' ? 'animate-spin' : ''}`} />
        </div>
        <div>
          <p className="font-medium text-white text-sm">{gate.name}</p>
          {gate.details && (
            <p className="text-xs text-gray-400 mt-0.5">{gate.details}</p>
          )}
        </div>
      </div>
      <span className={`text-xs font-medium uppercase ${status.color}`}>
        {gate.status}
      </span>
    </div>
  )
}
