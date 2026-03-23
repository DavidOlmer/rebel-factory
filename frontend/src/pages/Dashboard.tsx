import { Bot, Zap, CheckCircle, TrendingUp, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStats, useSprints, useAgents } from '../hooks/useApi'

// Mock data fallback
const mockStats = {
  totalAgents: 12,
  activeAgents: 4,
  completedSprints: 47,
  successRate: 94,
}

const mockRecentSprints = [
  { id: '1', agentName: 'CodeReviewer', task: 'Review PR #234', status: 'completed' },
  { id: '2', agentName: 'TestWriter', task: 'Add unit tests for auth module', status: 'in_progress' },
  { id: '3', agentName: 'DocGenerator', task: 'Generate API docs', status: 'review' },
]

export default function Dashboard() {
  const { data: stats } = useStats()
  const { data: sprints } = useSprints()
  const { data: agents } = useAgents()

  const displayStats = stats || mockStats
  const recentSprints = sprints?.slice(0, 5) || mockRecentSprints
  const activeAgents = agents?.filter(a => a.status === 'running') || []

  const statCards = [
    { label: 'Total Agents', value: displayStats.totalAgents, icon: Bot, color: 'text-blue-400' },
    { label: 'Active Now', value: displayStats.activeAgents, icon: Zap, color: 'text-yellow-400' },
    { label: 'Completed Sprints', value: displayStats.completedSprints, icon: CheckCircle, color: 'text-green-400' },
    { label: 'Success Rate', value: `${displayStats.successRate}%`, icon: TrendingUp, color: 'text-red-400' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Overview of your AI Factory</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">{label}</p>
                <p className="text-3xl font-bold text-white mt-1">{value}</p>
              </div>
              <div className={`p-3 rounded-lg bg-gray-700/50 ${color}`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active Agents */}
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="p-6 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Active Agents</h2>
            <Link
              to="/agents"
              className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
            >
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-4 space-y-3">
            {activeAgents.length > 0 ? (
              activeAgents.slice(0, 4).map((agent) => (
                <Link
                  key={agent.id}
                  to={`/agents/${agent.id}`}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-700/50 transition-colors"
                >
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <Bot className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{agent.name}</p>
                    <p className="text-sm text-gray-400">{agent.template}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-sm text-green-400">Running</span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                No active agents. <Link to="/agents/new" className="text-red-400 hover:underline">Create one</Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Sprints */}
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="p-6 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Recent Sprints</h2>
            <Link
              to="/sprints"
              className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
            >
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-4 space-y-3">
            {recentSprints.map((sprint) => (
              <div
                key={sprint.id}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-700/50 transition-colors"
              >
                <StatusBadge status={sprint.status} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{sprint.task}</p>
                  <p className="text-sm text-gray-400">{sprint.agentName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-green-500/20 text-green-400',
    in_progress: 'bg-yellow-500/20 text-yellow-400',
    review: 'bg-blue-500/20 text-blue-400',
    planning: 'bg-purple-500/20 text-purple-400',
    failed: 'bg-red-500/20 text-red-400',
  }

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || styles.planning}`}>
      {status.replace('_', ' ')}
    </span>
  )
}
