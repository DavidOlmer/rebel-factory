import { Building2, Users, Bot, Coins, TrendingUp, MoreVertical } from 'lucide-react'
import type { Tenant } from '../../types/admin'

interface TenantCardProps {
  tenant: Tenant
  onClick?: () => void
}

export default function TenantCard({ tenant, onClick }: TenantCardProps) {
  const planColors: Record<string, string> = {
    free: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    pro: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    enterprise: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    suspended: 'bg-red-500/20 text-red-400',
    trial: 'bg-yellow-500/20 text-yellow-400',
  }

  const tokenUsagePercent = Math.min((tenant.monthlyTokens / tenant.tokenLimit) * 100, 100)
  const tokenUsageColor = tokenUsagePercent > 90 
    ? 'bg-red-500' 
    : tokenUsagePercent > 70 
      ? 'bg-yellow-500' 
      : 'bg-green-500'

  return (
    <div 
      onClick={onClick}
      className="bg-gray-800 rounded-xl border border-gray-700 hover:border-gray-600 transition-all p-6 cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{tenant.name}</h3>
            <p className="text-sm text-gray-400">/{tenant.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[tenant.status]}`}>
            {tenant.status}
          </span>
          <button className="p-1 hover:bg-gray-700 rounded">
            <MoreVertical className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Plan Badge */}
      <div className="mb-4">
        <span className={`px-3 py-1 rounded-md text-sm font-medium border ${planColors[tenant.plan]}`}>
          {tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)} Plan
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 bg-gray-700/50 rounded-lg">
          <Users className="w-5 h-5 text-blue-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{tenant.userCount}</p>
          <p className="text-xs text-gray-400">Users</p>
        </div>
        <div className="text-center p-3 bg-gray-700/50 rounded-lg">
          <Bot className="w-5 h-5 text-green-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">{tenant.agentCount}</p>
          <p className="text-xs text-gray-400">Agents</p>
        </div>
        <div className="text-center p-3 bg-gray-700/50 rounded-lg">
          <Coins className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-white">${tenant.monthlyCost}</p>
          <p className="text-xs text-gray-400">This Month</p>
        </div>
      </div>

      {/* Token Usage */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-400">Token Usage</span>
          <span className="text-white font-medium">
            {(tenant.monthlyTokens / 1000000).toFixed(1)}M / {(tenant.tokenLimit / 1000000).toFixed(0)}M
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full ${tokenUsageColor} rounded-full transition-all`}
            style={{ width: `${tokenUsagePercent}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-gray-700 flex items-center justify-between text-sm">
        <span className="text-gray-500">
          Created {new Date(tenant.createdAt).toLocaleDateString()}
        </span>
        {tenant.azureAdTenantId && (
          <div className="flex items-center gap-1 text-blue-400">
            <TrendingUp className="w-4 h-4" />
            <span>Azure AD</span>
          </div>
        )}
      </div>
    </div>
  )
}
