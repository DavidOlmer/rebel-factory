import { useState } from 'react'
import { Kanban, Clock, CheckCircle, AlertCircle, Loader, Eye } from 'lucide-react'
import { useSprints } from '../hooks/useApi'
import QualityGate from '../components/QualityGate'
import type { Sprint } from '../types'

// Mock data
const mockSprints: Sprint[] = [
  {
    id: '1',
    agentId: '1',
    agentName: 'CodeReviewer',
    task: 'Review authentication refactor PR #234',
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
    agentId: '2',
    agentName: 'TestWriter',
    task: 'Add unit tests for auth module',
    status: 'in_progress',
    qualityGates: [
      { name: 'Lint', status: 'passed' },
      { name: 'Tests', status: 'pending' },
      { name: 'Coverage', status: 'pending' },
    ],
    createdAt: '2024-01-20T14:00:00Z',
  },
  {
    id: '3',
    agentId: '3',
    agentName: 'DocGenerator',
    task: 'Generate API documentation',
    status: 'review',
    qualityGates: [
      { name: 'Format', status: 'passed' },
      { name: 'Links', status: 'passed' },
      { name: 'Review', status: 'pending' },
    ],
    createdAt: '2024-01-20T11:30:00Z',
  },
  {
    id: '4',
    agentId: '4',
    agentName: 'SecurityScanner',
    task: 'Scan dependencies for vulnerabilities',
    status: 'failed',
    qualityGates: [
      { name: 'Scan', status: 'passed' },
      { name: 'Analysis', status: 'failed', details: 'Found 3 critical vulnerabilities' },
    ],
    createdAt: '2024-01-19T16:00:00Z',
  },
  {
    id: '5',
    agentId: '1',
    agentName: 'CodeReviewer',
    task: 'Review database migration PR #230',
    status: 'planning',
    qualityGates: [
      { name: 'Lint', status: 'pending' },
      { name: 'Tests', status: 'pending' },
    ],
    createdAt: '2024-01-20T15:00:00Z',
  },
]

const columns: Array<{ id: Sprint['status']; label: string; icon: typeof Clock; color: string }> = [
  { id: 'planning', label: 'Planning', icon: Clock, color: 'border-purple-500' },
  { id: 'in_progress', label: 'In Progress', icon: Loader, color: 'border-yellow-500' },
  { id: 'review', label: 'Review', icon: Eye, color: 'border-blue-500' },
  { id: 'completed', label: 'Completed', icon: CheckCircle, color: 'border-green-500' },
  { id: 'failed', label: 'Failed', icon: AlertCircle, color: 'border-red-500' },
]

export default function Sprints() {
  const { data: sprints } = useSprints()
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null)

  const displaySprints = sprints || mockSprints

  const getSprintsByStatus = (status: string) =>
    displaySprints.filter(s => s.status === status)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Sprint Board</h1>
          <p className="text-gray-400 mt-1">Track agent task progress</p>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Kanban className="w-5 h-5" />
          <span>{displaySprints.length} sprints</span>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(({ id, label, icon: Icon, color }) => {
          const columnSprints = getSprintsByStatus(id)
          return (
            <div
              key={id}
              className={`flex-shrink-0 w-80 bg-gray-800/50 rounded-xl border-t-2 ${color}`}
            >
              {/* Column Header */}
              <div className="p-4 border-b border-gray-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-gray-400" />
                    <h3 className="font-semibold text-white">{label}</h3>
                  </div>
                  <span className="text-sm text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
                    {columnSprints.length}
                  </span>
                </div>
              </div>

              {/* Sprint Cards */}
              <div className="p-3 space-y-3 min-h-[200px]">
                {columnSprints.map((sprint) => (
                  <SprintCard
                    key={sprint.id}
                    sprint={sprint}
                    onClick={() => setSelectedSprint(sprint)}
                  />
                ))}
                {columnSprints.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No sprints
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Sprint Detail Modal */}
      {selectedSprint && (
        <SprintModal
          sprint={selectedSprint}
          onClose={() => setSelectedSprint(null)}
        />
      )}
    </div>
  )
}

function SprintCard({ sprint, onClick }: { sprint: Sprint; onClick: () => void }) {
  const passedGates = sprint.qualityGates.filter(g => g.status === 'passed').length
  const totalGates = sprint.qualityGates.length

  return (
    <button
      onClick={onClick}
      className="w-full bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors text-left"
    >
      <p className="font-medium text-white text-sm line-clamp-2 mb-2">
        {sprint.task}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{sprint.agentName}</span>
        <div className="flex items-center gap-1">
          {sprint.qualityGates.map((gate) => (
            <QualityGate key={gate.name} gate={gate} compact mini />
          ))}
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-500">
        {passedGates}/{totalGates} gates passed
      </div>
    </button>
  )
}

function SprintModal({ sprint, onClose }: { sprint: Sprint; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl max-w-lg w-full border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{sprint.task}</h2>
              <p className="text-gray-400 mt-1">Agent: {sprint.agentName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Timeline */}
          <div className="space-y-2">
            <h3 className="font-semibold text-white">Timeline</h3>
            <div className="text-sm text-gray-400">
              <p>Started: {new Date(sprint.createdAt).toLocaleString()}</p>
              {sprint.completedAt && (
                <p>Completed: {new Date(sprint.completedAt).toLocaleString()}</p>
              )}
            </div>
          </div>

          {/* Quality Gates */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white">Quality Gates</h3>
            <div className="space-y-2">
              {sprint.qualityGates.map((gate) => (
                <QualityGate key={gate.name} gate={gate} />
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
