'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { 
  LayoutDashboard,
  Package,
  Users,
  DollarSign,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  FileText,
  Briefcase,
  TrendingUp,
  User
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/dashboard/broker', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/broker/load-board', label: 'Load Board', icon: Package },
  { href: '/dashboard/broker/assignments', label: 'My Assignments', icon: Briefcase },
  { href: '/dashboard/broker/tracking', label: 'Live Tracking', icon: TrendingUp },
  { href: '/dashboard/broker/carriers', label: 'Carrier Network', icon: Users },
  { href: '/dashboard/broker/payouts', label: 'Payouts', icon: DollarSign },
  { href: '/dashboard/broker/settings', label: 'Settings', icon: Settings },
]

export default function BrokerDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-primary/5">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const userName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.email?.split('@')[0] || 'Broker'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo & Mobile Menu */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
              
              <Link href="/" className="flex items-center">
                <Image
                  src="/logo-primary.png"
                  alt="DriveDrop"
                  width={120}
                  height={30}
                  className="h-8 w-auto"
                />
              </Link>
            </div>

            {/* Center - Broker Badge */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200">
              <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
              <span className="text-sm font-semibold text-blue-700">Broker Portal</span>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
              {/* Notifications */}
              <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative">
                <Bell className="h-5 w-5 text-gray-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full"></span>
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="hidden md:block text-sm font-medium text-gray-700">
                    {userName}
                  </span>
                  <ChevronDown className="hidden md:block h-4 w-4 text-gray-500" />
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{userName}</p>
                      <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                        <span className="text-xs text-gray-600">Broker Account</span>
                      </div>
                    </div>
                    <Link
                      href="/dashboard/broker/settings"
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <User className="h-4 w-4" />
                      Profile Settings
                    </Link>
                    <button
                      onClick={signOut}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors w-full"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] 
            w-64 bg-white border-r border-gray-200 
            transition-transform duration-300 ease-in-out z-30
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                    ${isActive 
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/20' 
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Revenue Widget */}
          <div className="p-4">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-gray-900">This Month</h3>
              </div>
              <p className="text-3xl font-bold text-green-600 mb-1">$0.00</p>
              <p className="text-xs text-gray-600">0 loads completed</p>
            </div>
          </div>

          {/* Quick Help */}
          <div className="p-4">
            <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl p-4 border border-primary/20">
              <h3 className="font-semibold text-gray-900 mb-2">Need Help?</h3>
              <p className="text-sm text-gray-600 mb-3">
                Contact broker support
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
              >
                Contact Support
              </Button>
            </div>
          </div>
        </aside>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
