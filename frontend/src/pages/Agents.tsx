import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Plus, Search, Filter } from 'lucide-react'
import { useAgents } from '../hooks/useApi'
import AgentCard from '../components/AgentCard'
import type { Agent } from '../types'

// Mock data fallback
const mockAgents: Agent[] = [
  { id: '1', name: 'CodeReviewer', template: 'reviewer', status: 'running', createdAt: '2024-01-15', config: {} },
  { id: '2', name: 'TestWriter', template: 'tester', status: 'running', createdAt: '2024-01-14', config: {} },
  { id: '3', name: 'DocGenerator', template: 'docs', status: 'idle', createdAt: '2024-01-12', config: {} },
  { id: '4', name: 'SecurityScanner', template: 'security', status: 'error', createdAt: '2024-01-10', config: {} },
  { id: '5', name: 'RefactorBot', template: 'refactor', status: 'idle', createdAt: '2024-01-08', config: {} },
  { id: '6', name: 'PerformanceOptimizer', template: 'perf', status: 'running', createdAt: '2024-01-05', config: {} },
]

export default function Agents() {
  const { data: agents, isLoading } = useAgents()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const displayAgents = agents || mockAgents

  const filteredAgents = displayAgents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const statusCounts = {
    all: displayAgents.length,
    running: displayAgents.filter(a => a.status === 'running').length,
    idle: displayAgents.filter(a => a.status === 'idle').length,
    error: displayAgents.filter(a => a.status === 'error').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Agents</h1>
          <p className="text-gray-400 mt-1">Manage your AI workforce</p>
        </div>
        <Link
          to="/agents/new"
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Agent
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
            {(['all', 'running', 'idle', 'error'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)} ({statusCounts[status]})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Agent Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-gray-800 rounded-xl p-6 animate-pulse border border-gray-700">
              <div className="w-12 h-12 bg-gray-700 rounded-lg mb-4" />
              <div className="h-4 bg-gray-700 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredAgents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map(agent => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Bot className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No agents found</h3>
          <p className="text-gray-400 mb-6">
            {search ? 'Try a different search term' : 'Create your first agent to get started'}
          </p>
          <Link
            to="/agents/new"
            className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Agent
          </Link>
        </div>
      )}
    </div>
  )
}
