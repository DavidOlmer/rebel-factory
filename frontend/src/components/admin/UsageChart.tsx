import { useState } from 'react'
import { BarChart3, TrendingUp, DollarSign, Zap } from 'lucide-react'
import type { UsageMetric } from '../../types/admin'

interface UsageChartProps {
  data: UsageMetric[]
  title?: string
}

type MetricType = 'tokens' | 'cost' | 'runs'

export default function UsageChart({ data, title = 'Usage Overview' }: UsageChartProps) {
  const [activeMetric, setActiveMetric] = useState<MetricType>('tokens')

  const metrics: { key: MetricType; label: string; icon: typeof BarChart3; color: string; format: (v: number) => string }[] = [
    { 
      key: 'tokens', 
      label: 'Tokens', 
      icon: BarChart3, 
      color: 'text-blue-400',
      format: (v) => `${(v / 1000000).toFixed(1)}M`
    },
    { 
      key: 'cost', 
      label: 'Cost', 
      icon: DollarSign, 
      color: 'text-green-400',
      format: (v) => `$${v.toLocaleString()}`
    },
    { 
      key: 'runs', 
      label: 'Runs', 
      icon: Zap, 
      color: 'text-yellow-400',
      format: (v) => v.toLocaleString()
    },
  ]

  const activeMetricConfig = metrics.find(m => m.key === activeMetric)!
  const maxValue = Math.max(...data.map(d => d[activeMetric]))
  const total = data.reduce((acc, d) => acc + d[activeMetric], 0)

  // Calculate trend
  const recentData = data.slice(-7)
  const previousData = data.slice(-14, -7)
  const recentAvg = recentData.reduce((acc, d) => acc + d[activeMetric], 0) / recentData.length
  const previousAvg = previousData.length > 0 
    ? previousData.reduce((acc, d) => acc + d[activeMetric], 0) / previousData.length 
    : recentAvg
  const trendPercent = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg * 100).toFixed(1) : '0'
  const trendPositive = parseFloat(trendPercent) >= 0

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <div className="flex bg-gray-700 rounded-lg p-1">
          {metrics.map(({ key, label, icon: Icon, color }) => (
            <button
              key={key}
              onClick={() => setActiveMetric(key)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeMetric === key
                  ? `bg-gray-600 ${color}`
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="flex items-center gap-6 mb-6">
        <div>
          <p className="text-sm text-gray-400">Total ({activeMetricConfig.label})</p>
          <p className={`text-2xl font-bold ${activeMetricConfig.color}`}>
            {activeMetricConfig.format(total)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className={`w-5 h-5 ${trendPositive ? 'text-green-400' : 'text-red-400'}`} />
          <span className={`text-sm font-medium ${trendPositive ? 'text-green-400' : 'text-red-400'}`}>
            {trendPositive ? '+' : ''}{trendPercent}%
          </span>
          <span className="text-sm text-gray-500">vs previous week</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 flex items-end gap-2">
        {data.map((item, idx) => {
          const height = maxValue > 0 ? (item[activeMetric] / maxValue * 100) : 0
          const barColor = activeMetric === 'tokens' 
            ? 'bg-blue-500' 
            : activeMetric === 'cost' 
              ? 'bg-green-500' 
              : 'bg-yellow-500'
          
          return (
            <div 
              key={idx} 
              className="flex-1 flex flex-col items-center gap-2 group"
            >
              {/* Tooltip */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-700 px-2 py-1 rounded text-xs text-white whitespace-nowrap">
                {activeMetricConfig.format(item[activeMetric])}
              </div>
              {/* Bar */}
              <div 
                className={`w-full ${barColor} rounded-t-md transition-all group-hover:opacity-80`}
                style={{ height: `${Math.max(height, 2)}%` }}
              />
              {/* Label */}
              <span className="text-xs text-gray-500 truncate w-full text-center">
                {new Date(item.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
