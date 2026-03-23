import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

interface StatsCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  color?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  onClick?: () => void
}

export default function StatsCard({ 
  label, 
  value, 
  icon: Icon, 
  color = 'text-blue-400',
  trend,
  onClick 
}: StatsCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all ${
        onClick ? 'cursor-pointer hover:scale-[1.02]' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-sm font-medium">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.isPositive ? (
                <TrendingUp className="w-4 h-4 text-green-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-400" />
              )}
              <span className={`text-sm ${trend.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-gray-500 text-sm">vs last month</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-gray-700/50 ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}
