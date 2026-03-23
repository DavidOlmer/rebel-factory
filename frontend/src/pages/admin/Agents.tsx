import { useState } from 'react'
import { 
  Bot, 
  Search, 
  Filter,
  Star,
  Building2,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  ThumbsUp,
  ThumbsDown,
  ExternalLink
} from 'lucide-react'
import StatsCard from '../../components/admin/StatsCard'
import type { GlobalAgent } from '../../types/admin'

// Mock data
const mockAgents: GlobalAgent[] = [
  {
    id: 'ag-1',
    name: 'CodeReviewer Pro',
    template: 'code-review',
    description: 'Advanced code review agent with support for 20+ languages and security analysis',
    promotionStatus: 'promoted',
    sourceTenantId: 'acme',
    sourceTenantName: 'Acme Corp',
    usageCount: 1250,
    rating: 4.8,
    createdAt: '2024-01-20T10:00:00Z',
  },
  {
    id: 'ag-2',
    name: 'DocGenerator',
    template: 'documentation',
    description: 'Automatically generates comprehensive documentation from code',
    promotionStatus: 'promoted',
    sourceTenantId: 'enterprise',
    sourceTenantName: 'Enterprise Co',
    usageCount: 890,
    rating: 4.5,
    createdAt: '2024-02-01T14:00:00Z',
  },
  {
    id: 'ag-3',
    name: 'TestWriter AI',
    template: 'testing',
    description: 'Generates unit tests, integration tests, and e2e tests',
    promotionStatus: 'pending',
    sourceTenantId: 'techstart',
    sourceTenantName: 'TechStart',
    usageCount: 0,
    rating: 0,
    createdAt: '2024-03-15T09:00:00Z',
  },
  {
    id: 'ag-4',
    name: 'SecurityScanner',
    template: 'security',
    description: 'Scans code for security vulnerabilities and suggests fixes',
    promotionStatus: 'pending',
    sourceTenantId: 'acme',
    sourceTenantName: 'Acme Corp',
    usageCount: 0,
    rating: 0,
    createdAt: '2024-03-18T11:00:00Z',
  },
  {
    id: 'ag-5',
    name: 'API Designer',
    template: 'api-design',
    description: 'Helps design REST and GraphQL APIs following best practices',
    promotionStatus: 'rejected',
    sourceTenantId: 'startup',
    sourceTenantName: 'Startup Labs',
    usageCount: 0,
    rating: 0,
    createdAt: '2024-03-10T16:00:00Z',
  },
  {
    id: 'ag-6',
    name: 'Refactoring Assistant',
    template: 'refactoring',
    description: 'Suggests and implements code refactoring improvements',
    promotionStatus: 'promoted',
    sourceTenantId: 'enterprise',
    sourceTenantName: 'Enterprise Co',
    usageCount: 567,
    rating: 4.2,
    createdAt: '2024-02-20T08:00:00Z',
  },
]

export default function AdminAgents() {
  const [agents, setAgents] = useState(mockAgents)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedAgent, setSelectedAgent] = useState<GlobalAgent | null>(null)

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = 
      agent.name.toLowerCase().includes(search.toLowerCase()) ||
      agent.description.toLowerCase().includes(search.toLowerCase()) ||
      agent.sourceTenantName.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || agent.promotionStatus === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: agents.length,
    promoted: agents.filter(a => a.promotionStatus === 'promoted').length,
    pending: agents.filter(a => a.promotionStatus === 'pending').length,
    totalUsage: agents.reduce((acc, a) => acc + a.usageCount, 0),
  }

  const handleApprove = (agentId: string) => {
    setAgents(agents.map(a => 
      a.id === agentId ? { ...a, promotionStatus: 'promoted' as const } : a
    ))
    setSelectedAgent(null)
  }

  const handleReject = (agentId: string) => {
    setAgents(agents.map(a => 
      a.id === agentId ? { ...a, promotionStatus: 'rejected' as const } : a
    ))
    setSelectedAgent(null)
  }

  const statusConfig: Record<string, { color: string; bg: string; icon: typeof CheckCircle }> = {
    promoted: { color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle },
    pending: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: Clock },
    rejected: { color: 'text-red-400', bg: 'bg-red-500/20', icon: XCircle },
    private: { color: 'text-gray-400', bg: 'bg-gray-500/20', icon: Eye },
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Global Agent Catalog</h1>
        <p className="text-gray-400 mt-1">Review and manage promoted agents across tenants</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard
          label="Total Agents"
          value={stats.total}
          icon={Bot}
          color="text-blue-400"
        />
        <StatsCard
          label="Promoted"
          value={stats.promoted}
          icon={CheckCircle}
          color="text-green-400"
        />
        <StatsCard
          label="Pending Review"
          value={stats.pending}
          icon={Clock}
          color="text-yellow-400"
        />
        <StatsCard
          label="Total Usage"
          value={stats.totalUsage.toLocaleString()}
          icon={TrendingUp}
          color="text-purple-400"
        />
      </div>

      {/* Pending Review Banner */}
      {stats.pending > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <p className="font-medium text-white">{stats.pending} Agents Pending Review</p>
              <p className="text-sm text-gray-400">
                Tenants have submitted agents for promotion to the global catalog
              </p>
            </div>
          </div>
          <button 
            onClick={() => setStatusFilter('pending')}
            className="px-4 py-2 bg-yellow-500 text-black font-medium rounded-lg hover:bg-yellow-400 transition-colors"
          >
            Review Now
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
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
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-9 pr-8 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-red-500"
          >
            <option value="all">All Status</option>
            <option value="promoted">Promoted</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Agent List */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium">Source Tenant</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Usage</th>
              <th className="px-4 py-3 font-medium">Rating</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredAgents.map((agent) => {
              const status = statusConfig[agent.promotionStatus]
              const StatusIcon = status.icon

              return (
                <tr key={agent.id} className="hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-700 rounded-lg">
                        <Bot className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{agent.name}</p>
                        <p className="text-sm text-gray-400 line-clamp-1 max-w-xs">
                          {agent.description}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 text-gray-300">
                      <Building2 className="w-4 h-4 text-gray-500" />
                      {agent.sourceTenantName}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {agent.promotionStatus}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-300">
                    {agent.usageCount > 0 ? agent.usageCount.toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-4">
                    {agent.rating > 0 ? (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="text-white">{agent.rating}</span>
                      </div>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedAgent(agent)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {agent.promotionStatus === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(agent.id)}
                            className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                            title="Approve"
                          >
                            <ThumbsUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReject(agent.id)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <ThumbsDown className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-700 rounded-xl">
                  <Bot className="w-8 h-8 text-red-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">{selectedAgent.name}</h3>
                  <p className="text-gray-400">{selectedAgent.template}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig[selectedAgent.promotionStatus].bg} ${statusConfig[selectedAgent.promotionStatus].color}`}>
                {selectedAgent.promotionStatus}
              </span>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm text-gray-400">Description</label>
                <p className="text-white mt-1">{selectedAgent.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-700/50 rounded-lg">
                  <label className="text-sm text-gray-400">Source Tenant</label>
                  <p className="text-white font-medium mt-1">{selectedAgent.sourceTenantName}</p>
                </div>
                <div className="p-4 bg-gray-700/50 rounded-lg">
                  <label className="text-sm text-gray-400">Created</label>
                  <p className="text-white font-medium mt-1">
                    {new Date(selectedAgent.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {selectedAgent.promotionStatus === 'promoted' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-700/50 rounded-lg">
                    <label className="text-sm text-gray-400">Total Usage</label>
                    <p className="text-2xl font-bold text-white mt-1">
                      {selectedAgent.usageCount.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-700/50 rounded-lg">
                    <label className="text-sm text-gray-400">Rating</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                      <span className="text-2xl font-bold text-white">{selectedAgent.rating}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-700">
              <button
                onClick={() => setSelectedAgent(null)}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
              {selectedAgent.promotionStatus === 'pending' && (
                <>
                  <button
                    onClick={() => handleReject(selectedAgent.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                  >
                    <ThumbsDown className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(selectedAgent.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Approve
                  </button>
                </>
              )}
              {selectedAgent.promotionStatus === 'promoted' && (
                <button className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                  View in Catalog
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
