import { useParams, Link } from 'react-router-dom'
import { Bot, ArrowLeft, Play, Pause, Settings, Trash2, Activity } from 'lucide-react'
import { useAgent, useSprints } from '../hooks/useApi'
import QualityGate from '../components/QualityGate'
import type { Agent, Sprint } from '../types'

// Mock data
const mockAgent: Agent = {
  id: '1',
  name: 'CodeReviewer',
  template: 'reviewer',
  status: 'running',
  createdAt: '2024-01-15T10:30:00Z',
  lastActivity: '2024-01-20T14:22:00Z',
  config: {
    model: 'claude-3-opus',
    maxTokens: 4096,
    reviewDepth: 'thorough',
  },
}

const mockSprints: Sprint[] = [
  {
    id: '1',
    agentId: '1',
    agentName: 'CodeReviewer',
    task: 'Review authentication refactor PR',
    status: 'completed',
    qualityGates: [
      { name: 'Lint', status: 'passed' },
      { name: 'Tests', status: 'passed' },
      { name: 'Security', status: 'passed' },
    ],
    createdAt: '2024-01-20T10:00:00Z',
    completedAt: '2024-01-20T10:45:00Z',
  },
  {
    id: '2',
    agentId: '1',
    agentName: 'CodeReviewer',
    task: 'Review database migration PR',
    status: 'in_progress',
    qualityGates: [
      { name: 'Lint', status: 'passed' },
      { name: 'Tests', status: 'pending' },
      { name: 'Security', status: 'pending' },
    ],
    createdAt: '2024-01-20T14:00:00Z',
  },
]

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: agent } = useAgent(id || '')
  const { data: allSprints } = useSprints()

  const displayAgent = agent || mockAgent
  const agentSprints = allSprints?.filter(s => s.agentId === id) || mockSprints

  const statusColors: Record<string, string> = {
    running: 'text-green-400 bg-green-500/20',
    idle: 'text-gray-400 bg-gray-500/20',
    error: 'text-red-400 bg-red-500/20',
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/agents"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Agents
      </Link>

      {/* Header */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-xl flex items-center justify-center">
              <Bot className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{displayAgent.name}</h1>
              <p className="text-gray-400">Template: {displayAgent.template}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[displayAgent.status]}`}>
                  {displayAgent.status}
                </span>
                <span className="text-gray-500 text-sm">
                  Created {new Date(displayAgent.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {displayAgent.status === 'running' ? (
              <button className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors">
                <Pause className="w-4 h-4" />
                Pause
              </button>
            ) : (
              <button className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors">
                <Play className="w-4 h-4" />
                Start
              </button>
            )}
            <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config */}
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="p-4 border-b border-gray-700">
            <h2 className="font-semibold text-white">Configuration</h2>
          </div>
          <div className="p-4 space-y-3">
            {Object.entries(displayAgent.config).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">{key}</span>
                <span className="text-white font-mono text-sm">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sprints */}
        <div className="lg:col-span-2 bg-gray-800 rounded-xl border border-gray-700">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-white">Recent Sprints</h2>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <div className="divide-y divide-gray-700">
            {agentSprints.map((sprint) => (
              <div key={sprint.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-white">{sprint.task}</p>
                    <p className="text-sm text-gray-400">
                      {new Date(sprint.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <SprintStatus status={sprint.status} />
                </div>
                <div className="flex gap-2">
                  {sprint.qualityGates.map((gate) => (
                    <QualityGate key={gate.name} gate={gate} compact />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function SprintStatus({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-green-500/20 text-green-400',
    in_progress: 'bg-yellow-500/20 text-yellow-400',
    review: 'bg-blue-500/20 text-blue-400',
    planning: 'bg-purple-500/20 text-purple-400',
    failed: 'bg-red-500/20 text-red-400',
  }

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {status.replace('_', ' ')}
    </span>
  )
}
