import { useState } from 'react'
import { 
  Building2, 
  Plus, 
  Search,
  Filter,
  TrendingUp,
  Users,
  Bot,
  Coins
} from 'lucide-react'
import TenantCard from '../../components/admin/TenantCard'
import StatsCard from '../../components/admin/StatsCard'
import type { Tenant } from '../../types/admin'

// Mock data
const mockTenants: Tenant[] = [
  {
    id: 'acme',
    name: 'Acme Corporation',
    slug: 'acme',
    plan: 'enterprise',
    status: 'active',
    userCount: 156,
    agentCount: 24,
    monthlyTokens: 125000000,
    tokenLimit: 200000000,
    monthlyCost: 2450,
    createdAt: '2024-01-15T10:00:00Z',
    azureAdTenantId: 'acme-azure-id',
  },
  {
    id: 'techstart',
    name: 'TechStart Inc',
    slug: 'techstart',
    plan: 'pro',
    status: 'active',
    userCount: 45,
    agentCount: 12,
    monthlyTokens: 45000000,
    tokenLimit: 50000000,
    monthlyCost: 890,
    createdAt: '2024-02-01T09:00:00Z',
  },
  {
    id: 'enterprise',
    name: 'Enterprise Co',
    slug: 'enterprise-co',
    plan: 'enterprise',
    status: 'active',
    userCount: 320,
    agentCount: 58,
    monthlyTokens: 280000000,
    tokenLimit: 500000000,
    monthlyCost: 4200,
    createdAt: '2024-01-20T14:30:00Z',
    azureAdTenantId: 'enterprise-azure-id',
  },
  {
    id: 'startup',
    name: 'Startup Labs',
    slug: 'startup-labs',
    plan: 'free',
    status: 'trial',
    userCount: 8,
    agentCount: 3,
    monthlyTokens: 2500000,
    tokenLimit: 5000000,
    monthlyCost: 0,
    createdAt: '2024-03-10T11:00:00Z',
  },
  {
    id: 'newclient',
    name: 'New Client LLC',
    slug: 'newclient',
    plan: 'pro',
    status: 'active',
    userCount: 22,
    agentCount: 6,
    monthlyTokens: 18000000,
    tokenLimit: 50000000,
    monthlyCost: 450,
    createdAt: '2024-03-01T08:00:00Z',
  },
  {
    id: 'suspended-corp',
    name: 'Suspended Corp',
    slug: 'suspended',
    plan: 'pro',
    status: 'suspended',
    userCount: 15,
    agentCount: 4,
    monthlyTokens: 0,
    tokenLimit: 50000000,
    monthlyCost: 0,
    createdAt: '2024-02-15T10:00:00Z',
  },
]

export default function AdminTenants() {
  const [tenants] = useState(mockTenants)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = 
      tenant.name.toLowerCase().includes(search.toLowerCase()) ||
      tenant.slug.toLowerCase().includes(search.toLowerCase())
    const matchesPlan = planFilter === 'all' || tenant.plan === planFilter
    const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter
    return matchesSearch && matchesPlan && matchesStatus
  })

  const stats = {
    total: tenants.length,
    active: tenants.filter(t => t.status === 'active').length,
    totalUsers: tenants.reduce((acc, t) => acc + t.userCount, 0),
    totalAgents: tenants.reduce((acc, t) => acc + t.agentCount, 0),
    totalRevenue: tenants.reduce((acc, t) => acc + t.monthlyCost, 0),
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Tenant Management</h1>
          <p className="text-gray-400 mt-1">Manage organizations and their subscriptions</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Tenant
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <StatsCard
          label="Total Tenants"
          value={stats.total}
          icon={Building2}
          color="text-purple-400"
        />
        <StatsCard
          label="Active Tenants"
          value={stats.active}
          icon={TrendingUp}
          color="text-green-400"
        />
        <StatsCard
          label="Total Users"
          value={stats.totalUsers}
          icon={Users}
          color="text-blue-400"
        />
        <StatsCard
          label="Total Agents"
          value={stats.totalAgents}
          icon={Bot}
          color="text-yellow-400"
        />
        <StatsCard
          label="Monthly Revenue"
          value={`$${stats.totalRevenue.toLocaleString()}`}
          icon={Coins}
          color="text-green-400"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
          />
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="pl-9 pr-8 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-red-500"
            >
              <option value="all">All Plans</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-red-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Tenant Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTenants.map((tenant) => (
          <TenantCard key={tenant.id} tenant={tenant} />
        ))}
      </div>

      {filteredTenants.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No tenants found matching your filters.
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">Create New Tenant</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Organization Name</label>
                <input
                  type="text"
                  placeholder="Acme Corporation"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Slug</label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-gray-600 border border-gray-600 border-r-0 rounded-l-lg text-gray-400">/</span>
                  <input
                    type="text"
                    placeholder="acme-corp"
                    className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-r-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Plan</label>
                <select className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-red-500">
                  <option value="free">Free</option>
                  <option value="pro">Pro - $199/month</option>
                  <option value="enterprise">Enterprise - Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Admin Email</label>
                <input
                  type="email"
                  placeholder="admin@company.com"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <input type="checkbox" className="rounded bg-gray-700 border-gray-600" />
                  Enable Azure AD integration
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Create Tenant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
