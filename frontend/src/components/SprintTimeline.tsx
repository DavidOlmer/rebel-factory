import { Check, Clock, AlertCircle, Loader } from 'lucide-react'
import type { Sprint } from '../types'

interface SprintTimelineProps {
  sprints: Sprint[]
}

export default function SprintTimeline({ sprints }: SprintTimelineProps) {
  // Group sprints by date
  const grouped = sprints.reduce((acc, sprint) => {
    const date = new Date(sprint.createdAt).toLocaleDateString()
    if (!acc[date]) acc[date] = []
    acc[date].push(sprint)
    return acc
  }, {} as Record<string, Sprint[]>)

  const statusIcons = {
    completed: Check,
    in_progress: Loader,
    review: Clock,
    planning: Clock,
    failed: AlertCircle,
  }

  const statusColors = {
    completed: 'text-green-400 bg-green-500/20 border-green-500',
    in_progress: 'text-yellow-400 bg-yellow-500/20 border-yellow-500',
    review: 'text-blue-400 bg-blue-500/20 border-blue-500',
    planning: 'text-purple-400 bg-purple-500/20 border-purple-500',
    failed: 'text-red-400 bg-red-500/20 border-red-500',
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, daySprints]) => (
        <div key={date}>
          {/* Date Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 rounded-full bg-gray-600" />
            <span className="text-sm font-medium text-gray-400">{date}</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          {/* Sprints for this day */}
          <div className="ml-1.5 border-l-2 border-gray-700 pl-6 space-y-4">
            {daySprints.map((sprint) => {
              const Icon = statusIcons[sprint.status]
              const colors = statusColors[sprint.status]

              return (
                <div
                  key={sprint.id}
                  className="relative bg-gray-800 rounded-lg p-4 border border-gray-700"
                >
                  {/* Timeline dot */}
                  <div className={`absolute -left-[33px] w-4 h-4 rounded-full border-2 ${colors}`}>
                    <Icon className={`w-2 h-2 m-0.5 ${sprint.status === 'in_progress' ? 'animate-spin' : ''}`} />
                  </div>

                  {/* Content */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-white">{sprint.task}</p>
                      <p className="text-sm text-gray-400 mt-1">
                        {sprint.agentName} • {new Date(sprint.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${colors}`}>
                      {sprint.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Quality Gates */}
                  <div className="flex gap-2 mt-3">
                    {sprint.qualityGates.map((gate) => {
                      const gateColors = {
                        passed: 'bg-green-500/20 text-green-400',
                        failed: 'bg-red-500/20 text-red-400',
                        pending: 'bg-gray-500/20 text-gray-400',
                      }
                      return (
                        <span
                          key={gate.name}
                          className={`px-2 py-0.5 rounded text-xs ${gateColors[gate.status]}`}
                        >
                          {gate.name}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
