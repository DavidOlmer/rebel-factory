import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Bot, 
  BarChart3,
  Shield,
  Settings,
  Flame,
  ChevronLeft,
  LogOut,
  FileText
} from 'lucide-react'

interface AdminLayoutProps {
  children: ReactNode
}

const adminNavItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/users', icon: Users, label: 'Users' },
  { path: '/admin/tenants', icon: Building2, label: 'Tenants' },
  { path: '/admin/agents', icon: Bot, label: 'Agent Catalog' },
  { path: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/admin/audit', icon: FileText, label: 'Audit Logs' },
  { path: '/admin/security', icon: Shield, label: 'Security' },
]

export default function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-700">
          <Link to="/admin" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center group-hover:bg-red-600 transition-colors">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Rebel AI</h1>
              <p className="text-xs text-red-400 font-medium">Admin Panel</p>
            </div>
          </Link>
        </div>

        {/* Back to Factory */}
        <div className="px-4 py-3 border-b border-gray-700">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Factory
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Management
          </p>
          {adminNavItems.map(({ path, icon: Icon, label }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive(path)
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
              {path === '/admin/security' && (
                <span className="ml-auto px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-full">
                  3
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 space-y-2">
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-700/50 hover:text-white transition-colors w-full">
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-700/50 hover:text-red-400 transition-colors w-full">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-gray-900">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
