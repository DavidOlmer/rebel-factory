import { useState } from 'react'
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Shield, 
  ShieldCheck,
  ShieldX,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  UserCheck,
  UserX
} from 'lucide-react'
import type { AdminUser } from '../../types/admin'

interface UserTableProps {
  users: AdminUser[]
  onSuspend?: (userId: string) => void
  onActivate?: (userId: string) => void
  onSyncAzure?: (userId: string) => void
}

type SortField = 'displayName' | 'email' | 'tenantName' | 'lastLogin' | 'role'
type SortDir = 'asc' | 'desc'

export default function UserTable({ users, onSuspend, onActivate, onSyncAzure }: UserTableProps) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('displayName')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const filteredUsers = users
    .filter(user => {
      const matchesSearch = 
        user.displayName.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase()) ||
        user.tenantName.toLowerCase().includes(search.toLowerCase())
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter
      return matchesSearch && matchesRole && matchesStatus
    })
    .sort((a, b) => {
      const aVal = a[sortField] || ''
      const bVal = b[sortField] || ''
      const cmp = aVal.toString().localeCompare(bVal.toString())
      return sortDir === 'asc' ? cmp : -cmp
    })

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDir === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    )
  }

  const roleColors: Record<string, string> = {
    super_admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    tenant_admin: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    user: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    suspended: 'bg-red-500/20 text-red-400',
    pending: 'bg-yellow-500/20 text-yellow-400',
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700">
      {/* Header with Search and Filters */}
      <div className="p-4 border-b border-gray-700 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
          />
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="pl-9 pr-8 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-red-500"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="tenant_admin">Tenant Admin</option>
              <option value="user">User</option>
            </select>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-red-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
              <th 
                className="px-4 py-3 font-medium cursor-pointer hover:text-white"
                onClick={() => handleSort('displayName')}
              >
                <div className="flex items-center gap-1">
                  User <SortIcon field="displayName" />
                </div>
              </th>
              <th 
                className="px-4 py-3 font-medium cursor-pointer hover:text-white"
                onClick={() => handleSort('tenantName')}
              >
                <div className="flex items-center gap-1">
                  Tenant <SortIcon field="tenantName" />
                </div>
              </th>
              <th 
                className="px-4 py-3 font-medium cursor-pointer hover:text-white"
                onClick={() => handleSort('role')}
              >
                <div className="flex items-center gap-1">
                  Role <SortIcon field="role" />
                </div>
              </th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Azure AD</th>
              <th 
                className="px-4 py-3 font-medium cursor-pointer hover:text-white"
                onClick={() => handleSort('lastLogin')}
              >
                <div className="flex items-center gap-1">
                  Last Login <SortIcon field="lastLogin" />
                </div>
              </th>
              <th className="px-4 py-3 font-medium w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-700/50 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-white">{user.displayName}</p>
                    <p className="text-sm text-gray-400">{user.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-300">{user.tenantName}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium border ${roleColors[user.role]}`}>
                    {user.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[user.status]}`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {user.azureAdSynced ? (
                    <div className="flex items-center gap-1 text-green-400">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="text-sm">Synced</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-gray-500">
                      <ShieldX className="w-4 h-4" />
                      <span className="text-sm">Not synced</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">
                  {user.lastLogin 
                    ? new Date(user.lastLogin).toLocaleString()
                    : 'Never'
                  }
                </td>
                <td className="px-4 py-3 relative">
                  <button 
                    onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                    className="p-1 hover:bg-gray-600 rounded"
                  >
                    <MoreVertical className="w-5 h-5 text-gray-400" />
                  </button>
                  {openMenu === user.id && (
                    <div className="absolute right-4 top-full mt-1 bg-gray-700 rounded-lg shadow-lg border border-gray-600 py-1 z-10 min-w-[160px]">
                      {user.status === 'active' ? (
                        <button
                          onClick={() => { onSuspend?.(user.id); setOpenMenu(null) }}
                          className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-600 flex items-center gap-2"
                        >
                          <UserX className="w-4 h-4" /> Suspend User
                        </button>
                      ) : (
                        <button
                          onClick={() => { onActivate?.(user.id); setOpenMenu(null) }}
                          className="w-full px-4 py-2 text-left text-sm text-green-400 hover:bg-gray-600 flex items-center gap-2"
                        >
                          <UserCheck className="w-4 h-4" /> Activate User
                        </button>
                      )}
                      {!user.azureAdSynced && (
                        <button
                          onClick={() => { onSyncAzure?.(user.id); setOpenMenu(null) }}
                          className="w-full px-4 py-2 text-left text-sm text-blue-400 hover:bg-gray-600 flex items-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4" /> Sync Azure AD
                        </button>
                      )}
                      <button
                        className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-600 flex items-center gap-2"
                      >
                        <Shield className="w-4 h-4" /> View Permissions
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between text-sm text-gray-400">
        <span>Showing {filteredUsers.length} of {users.length} users</span>
        <div className="flex gap-2">
          <button className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600">Previous</button>
          <button className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600">Next</button>
        </div>
      </div>
    </div>
  )
}
