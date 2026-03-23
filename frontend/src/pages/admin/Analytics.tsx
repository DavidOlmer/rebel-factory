import { useState } from 'react'
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Zap,
  Calendar,
  Download,
  RefreshCw,
  Building2
} from 'lucide-react'
import StatsCard from '../../components/admin/StatsCard'
import UsageChart from '../../components/admin/UsageChart'
import AuditLog from '../../components/admin/AuditLog'
import type { UsageMetric, AuditLogEntry } from '../../types/admin'

// Generate mock usage data for the last 30 days
const generateUsageData = (): UsageMetric[] => {
  const data: UsageMetric[] = []
  for (let i = 29; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    data.push({
      date: date.toISOString(),
      tokens: Math.floor(Math.random() * 50000000) + 10000000,
      cost: Math.floor(Math.random() * 500) + 100,
      runs: Math.floor(Math.random() * 1000) + 200,
    })
  }
  return data
}

const mockUsageData = generateUsageData()

const mockTopTenants = [
  { name: 'Acme Corp', tokens: 125000000, cost: 2450, percentage: 28 },
  { name: 'Enterprise Co', tokens: 95000000, cost: 1850, percentage: 21 },
  { name: 'TechStart', tokens: 65000000, cost: 1300, percentage: 14 },
  { name: 'New Client LLC', tokens: 45000000, cost: 890, percentage: 10 },
  { name: 'Startup Labs', tokens: 35000000, cost: 700, percentage: 8 },
]

const mockAuditLog: AuditLogEntry[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    action: 'agent.run.completed',
    actor: 'CodeReviewer',
    actorType: 'agent',
    resource: 'sprint',
    resourceId: 'spr_12345',
    details: 'Completed code review sprint with 15,000 tokens',
    severity: 'info',
    tenantId: 'acme',
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    action: 'user.login',
    actor: 'john.doe@acme.com',
    actorType: 'user',
    resource: 'session',
    resourceId: 'sess_xyz',
    details: 'User logged in from 192.168.1.100',
    severity: 'info',
    tenantId: 'acme',
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    action: 'tenant.token_limit.warning',
    actor: 'system',
    actorType: 'system',
    resource: 'tenant',
    resourceId: 'techstart',
    details: 'TechStart reached 90% of monthly token limit',
    severity: 'warning',
    tenantId: 'techstart',
  },
  {
    id: '4',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    action: 'agent.created',
    actor: 'sarah@newclient.com',
    actorType: 'user',
    resource: 'agent',
    resourceId: 'agt_new',
    details: 'Created new agent "DataAnalyzer"',
    severity: 'info',
    tenantId: 'newclient',
  },
  {
    id: '5',
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    action: 'api.rate_limit.exceeded',
    actor: 'system',
    actorType: 'system',
    resource: 'api',
    resourceId: 'api_v1',
    details: 'Rate limit exceeded for tenant startup-labs',
    severity: 'critical',
    tenantId: 'startup',
  },
]

type TimeRange = '7d' | '30d' | '90d'

export default function AdminAnalytics() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [auditEntries] = useState(mockAuditLog)

  const totalTokens = mockUsageData.reduce((acc, d) => acc + d.tokens, 0)
  const totalCost = mockUsageData.reduce((acc, d) => acc + d.cost, 0)
  const totalRuns = mockUsageData.reduce((acc, d) => acc + d.runs, 0)
  const avgDaily = totalTokens / 30

  const timeRangeData = {
    '7d': mockUsageData.slice(-7),
    '30d': mockUsageData,
    '90d': mockUsageData, // Would be 90 days in real app
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400 mt-1">Platform usage statistics and insights</p>
        </div>
        <div className="flex gap-3">
          <div className="flex bg-gray-800 rounded-lg p-1">
            {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard
          label="Total Tokens"
          value={`${(totalTokens / 1000000).toFixed(1)}M`}
          icon={BarChart3}
          color="text-blue-400"
          trend={{ value: 12, isPositive: true }}
        />
        <StatsCard
          label="Total Cost"
          value={`$${totalCost.toLocaleString()}`}
          icon={DollarSign}
          color="text-green-400"
          trend={{ value: 8, isPositive: true }}
        />
        <StatsCard
          label="Total Runs"
          value={totalRuns.toLocaleString()}
          icon={Zap}
          color="text-yellow-400"
          trend={{ value: 15, isPositive: true }}
        />
        <StatsCard
          label="Avg Daily Tokens"
          value={`${(avgDaily / 1000000).toFixed(1)}M`}
          icon={TrendingUp}
          color="text-purple-400"
        />
      </div>

      {/* Usage Chart */}
      <UsageChart 
        data={timeRangeData[timeRange]} 
        title={`Usage Trends (Last ${timeRange === '7d' ? '7' : timeRange === '30d' ? '30' : '90'} Days)`}
      />

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Tenants */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Top Tenants by Usage</h3>
            <button className="text-red-400 hover:text-red-300 text-sm">View All</button>
          </div>
          <div className="space-y-4">
            {mockTopTenants.map((tenant, idx) => (
              <div key={tenant.name} className="flex items-center gap-4">
                <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center text-sm font-bold text-gray-400">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-white">{tenant.name}</span>
                    </div>
                    <span className="text-gray-400 text-sm">
                      {(tenant.tokens / 1000000).toFixed(1)}M tokens
                    </span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${tenant.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Cost Breakdown</h3>
            <div className="flex items-center gap-1 text-sm text-gray-400">
              <Calendar className="w-4 h-4" />
              This Month
            </div>
          </div>
          
          <div className="space-y-6">
            {/* Cost Categories */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Token Costs</p>
                <p className="text-2xl font-bold text-white">$8,450</p>
                <p className="text-xs text-green-400">68% of total</p>
              </div>
              <div className="p-4 bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Compute Costs</p>
                <p className="text-2xl font-bold text-white">$3,200</p>
                <p className="text-xs text-blue-400">26% of total</p>
              </div>
              <div className="p-4 bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Storage Costs</p>
                <p className="text-2xl font-bold text-white">$520</p>
                <p className="text-xs text-purple-400">4% of total</p>
              </div>
              <div className="p-4 bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Other</p>
                <p className="text-2xl font-bold text-white">$280</p>
                <p className="text-xs text-yellow-400">2% of total</p>
              </div>
            </div>

            {/* Total */}
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Monthly Cost</p>
                  <p className="text-3xl font-bold text-green-400">$12,450</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">vs Last Month</p>
                  <p className="text-lg font-medium text-green-400">+8.5%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log */}
      <AuditLog 
        entries={auditEntries}
        onRefresh={() => console.log('Refresh audit log')}
        onExport={() => console.log('Export audit log')}
      />
    </div>
  )
}
