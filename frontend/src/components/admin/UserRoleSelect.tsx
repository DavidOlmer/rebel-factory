import { useState } from 'react'
import { ChevronDown, Shield, ShieldCheck, User } from 'lucide-react'
import type { AdminUser } from '../../types/admin'

type Role = AdminUser['role']

interface UserRoleSelectProps {
  value: Role
  onChange: (role: Role) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

const roleConfig: Record<Role, { label: string; icon: typeof User; color: string; bgColor: string }> = {
  super_admin: {
    label: 'Super Admin',
    icon: ShieldCheck,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20 border-purple-500/30',
  },
  tenant_admin: {
    label: 'Tenant Admin',
    icon: Shield,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20 border-blue-500/30',
  },
  user: {
    label: 'User',
    icon: User,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20 border-gray-500/30',
  },
}

export default function UserRoleSelect({ 
  value, 
  onChange, 
  disabled = false,
  size = 'md' 
}: UserRoleSelectProps) {
  const [isOpen, setIsOpen] = useState(false)

  const current = roleConfig[value]
  const CurrentIcon = current.icon

  const handleSelect = (role: Role) => {
    onChange(role)
    setIsOpen(false)
  }

  const sizeClasses = size === 'sm' 
    ? 'px-2 py-1 text-xs gap-1'
    : 'px-3 py-2 text-sm gap-2'

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center ${sizeClasses} rounded-lg border transition-colors ${current.bgColor} ${current.color} ${
          disabled 
            ? 'cursor-not-allowed opacity-60' 
            : 'hover:opacity-80 cursor-pointer'
        }`}
      >
        <CurrentIcon className={iconSize} />
        <span className="font-medium">{current.label}</span>
        {!disabled && <ChevronDown className={`${iconSize} ml-1`} />}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)} 
          />
          
          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-1 bg-gray-700 rounded-lg shadow-lg border border-gray-600 py-1 z-20 min-w-[160px]">
            {(Object.keys(roleConfig) as Role[]).map((role) => {
              const config = roleConfig[role]
              const Icon = config.icon
              const isSelected = role === value

              return (
                <button
                  key={role}
                  onClick={() => handleSelect(role)}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm transition-colors ${
                    isSelected 
                      ? 'bg-gray-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${config.color}`} />
                  <span>{config.label}</span>
                  {isSelected && (
                    <span className="ml-auto text-green-400">✓</span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
