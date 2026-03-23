import { useState } from 'react'
import { 
  Users as UsersIcon, 
  UserPlus, 
  RefreshCw, 
  Download,
  Upload,
  Shield
} from 'lucide-react'
import UserTable from '../../components/admin/UserTable'
import StatsCard from '../../components/admin/StatsCard'
import type { AdminUser } from '../../types/admin'

// Mock data
const mockUsers: AdminUser[] = [
  {
    id: '1',
    email: 'admin@rebel.ai',
    displayName: 'Platform Admin',
    role: 'super_admin',
    status: 'active',
    tenantId: 'rebel',
    tenantName: 'Rebel AI',
    azureAdSynced: true,
    lastLogin: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    createdAt: '2024-01-15T10:00:00Z',
    mfaEnabled: true,
  },
  {
    id: '2',
    email: 'john.doe@acme.com',
    displayName: 'John Doe',
    role: 'tenant_admin',
    status: 'active',
    tenantId: 'acme',
    tenantName: 'Acme Corp',
    azureAdSynced: true,
    lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    createdAt: '2024-02-20T14:30:00Z',
    mfaEnabled: true,
  },
  {
    id: '3',
    email: 'jane.smith@techstart.io',
    displayName: 'Jane Smith',
    role: 'user',
    status: 'active',
    tenantId: 'techstart',
    tenantName: 'TechStart',
    azureAdSynced: false,
    lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    createdAt: '2024-03-01T09:15:00Z',
    mfaEnabled: false,
  },
  {
    id: '4',
    email: 'mike@startup.io',
    displayName: 'Mike Wilson',
    role: 'user',
    status: 'suspended',
    tenantId: 'startup',
    tenantName: 'Startup Inc',
    azureAdSynced: false,
    lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    createdAt: '2024-03-05T11:00:00Z',
    mfaEnabled: false,
  },
  {
    id: '5',
    email: 'sarah@newclient.com',
    displayName: 'Sarah Johnson',
    role: 'tenant_admin',
    status: 'pending',
    tenantId: 'newclient',
    tenantName: 'New Client LLC',
    azureAdSynced: false,
    createdAt: new Date().toISOString(),
    mfaEnabled: false,
  },
  {
    id: '6',
    email: 'alex.dev@acme.com',
    displayName: 'Alex Developer',
    role: 'user',
    status: 'active',
    tenantId: 'acme',
    tenantName: 'Acme Corp',
    azureAdSynced: true,
    lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    createdAt: '2024-02-25T08:00:00Z',
    mfaEnabled: true,
  },
  {
    id: '7',
    email: 'lisa@enterprise.co',
    displayName: 'Lisa Chen',
    role: 'tenant_admin',
    status: 'active',
    tenantId: 'enterprise',
    tenantName: 'Enterprise Co',
    azureAdSynced: true,
    lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
    createdAt: '2024-01-20T16:30:00Z',
    mfaEnabled: true,
  },
]

export default function AdminUsers() {
  const [users, setUsers] = useState(mockUsers)
  const [showInviteModal, setShowInviteModal] = useState(false)

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    pending: users.filter(u => u.status === 'pending').length,
    synced: users.filter(u => u.azureAdSynced).length,
  }

  const handleSuspend = (userId: string) => {
    setUsers(users.map(u => 
      u.id === userId ? { ...u, status: 'suspended' as const } : u
    ))
  }

  const handleActivate = (userId: string) => {
    setUsers(users.map(u => 
      u.id === userId ? { ...u, status: 'active' as const } : u
    ))
  }

  const handleSyncAzure = (userId: string) => {
    setUsers(users.map(u => 
      u.id === userId ? { ...u, azureAdSynced: true } : u
    ))
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">User Management</h1>
          <p className="text-gray-400 mt-1">Manage platform users and permissions</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-colors">
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button 
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Invite User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard
          label="Total Users"
          value={stats.total}
          icon={UsersIcon}
          color="text-blue-400"
        />
        <StatsCard
          label="Active Users"
          value={stats.active}
          icon={UsersIcon}
          color="text-green-400"
        />
        <StatsCard
          label="Pending Invites"
          value={stats.pending}
          icon={UserPlus}
          color="text-yellow-400"
        />
        <StatsCard
          label="Azure AD Synced"
          value={stats.synced}
          icon={Shield}
          color="text-purple-400"
        />
      </div>

      {/* Azure AD Sync Banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/20 rounded-lg">
            <RefreshCw className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="font-medium text-white">Azure AD Sync Available</p>
            <p className="text-sm text-gray-400">
              {users.length - stats.synced} users can be synced with Azure Active Directory
            </p>
          </div>
        </div>
        <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
          Start Sync
        </button>
      </div>

      {/* User Table */}
      <UserTable 
        users={users}
        onSuspend={handleSuspend}
        onActivate={handleActivate}
        onSyncAzure={handleSyncAzure}
      />

      {/* Invite Modal Placeholder */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">Invite New User</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="user@company.com"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Role</label>
                <select className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-red-500">
                  <option value="user">User</option>
                  <option value="tenant_admin">Tenant Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tenant</label>
                <select className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-red-500">
                  <option value="acme">Acme Corp</option>
                  <option value="techstart">TechStart</option>
                  <option value="enterprise">Enterprise Co</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
