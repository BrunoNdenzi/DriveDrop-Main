'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Building2,
  CheckCircle,
  ChevronDown,
  ClipboardList,
  DollarSign,
  FileText,
  Handshake,
  LogOut,
  Mail,
  Map,
  Menu,
  MessageSquare,
  Navigation,
  Package,
  Phone,
  TrendingUp,
  Truck,
  User,
  X,
} from '@/components/icons/streamline-lucide'

import NotificationBell from '@/components/NotificationBell'
import { BenjiAssistant } from '@/components/benji-v3/BenjiAssistant'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
  { href: '/dashboard/driver', label: 'Overview', icon: TrendingUp },
  { href: '/dashboard/driver/jobs', label: 'Available jobs', icon: Package },
  { href: '/dashboard/driver/broker-loads', label: 'Broker loads', icon: Building2 },
  { href: '/dashboard/driver/active', label: 'Active deliveries', icon: Truck },
  { href: '/dashboard/driver/navigation', label: 'Live navigation', icon: Map },
  { href: '/dashboard/driver/route-planner', label: 'Route planner', icon: Navigation },
  { href: '/dashboard/driver/applications', label: 'Applications', icon: ClipboardList },
  { href: '/dashboard/driver/invitations', label: 'Broker invitations', icon: Handshake },
  { href: '/dashboard/driver/completed', label: 'Completed', icon: CheckCircle },
  { href: '/dashboard/driver/messages', label: 'Messages', icon: MessageSquare },
  { href: '/dashboard/driver/earnings', label: 'Earnings', icon: DollarSign },
  { href: '/dashboard/driver/documents', label: 'Documents', icon: FileText },
  { href: '/dashboard/driver/profile', label: 'Profile', icon: User },
]

export default function DriverDashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f6f5]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#b8cdca] border-t-[#008c82]" />
      </div>
    )
  }

  if (user?.user_metadata?.force_password_change === true) {
    router.replace('/change-password?required=true')
    return null
  }

  const userName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.email?.split('@')[0] || 'Driver'
  const initials = userName.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-[#f2f6f5] text-[#193638]">
      <header className="sticky top-0 z-40 border-b border-[#cbd8d6] bg-white">
        <div className="flex h-16 items-center justify-between px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(current => !current)}
              aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={sidebarOpen}
              className="grid h-9 w-9 place-items-center border border-[#c8d5d3] text-[#304b4c] lg:hidden"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link href="/" aria-label="DriveDrop home" className="shrink-0">
              <Image src="/logo-primary.png" alt="DriveDrop" width={120} height={30} priority className="h-8 w-auto" />
            </Link>
            <div className="hidden border-l border-[#d7e1df] pl-3 sm:block">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#6d807f]">Driver workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 border border-[#cbd8d6] bg-[#f4f7f6] px-3 py-2 md:flex">
              <span className={`h-2 w-2 ${isOnline ? 'bg-[#12a36d]' : 'bg-[#8a9a98]'}`} />
              <button type="button" onClick={() => setIsOnline(current => !current)} className="text-xs font-bold text-[#405958]">
                {isOnline ? 'Online' : 'Offline'}
              </button>
            </div>
            <NotificationBell />
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen(current => !current)}
                aria-expanded={userMenuOpen}
                className="flex h-10 items-center gap-2 px-1 text-left sm:px-2"
              >
                <span className="grid h-9 w-9 place-items-center bg-[#f3a712] text-xs font-bold text-[#173436]">{initials}</span>
                <span className="hidden max-w-36 truncate text-sm font-semibold text-[#263f40] md:block">{userName}</span>
                <ChevronDown className="hidden h-4 w-4 text-[#718482] md:block" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-12 w-60 border border-[#cbd8d6] bg-white py-2 shadow-lg">
                  <div className="border-b border-[#dce5e3] px-4 py-3">
                    <p className="truncate text-sm font-semibold text-[#263f40]">{userName}</p>
                    <p className="mt-0.5 truncate text-xs text-[#718482]">{profile?.email}</p>
                  </div>
                  <Link href="/dashboard/driver/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#405958] hover:bg-[#f2f6f5]">
                    <User className="h-4 w-4" /> Profile settings
                  </Link>
                  <button type="button" onClick={signOut} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#aa3e35] hover:bg-[#fff4f3]">
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside
          className={`fixed bottom-0 left-0 top-16 z-30 flex w-[min(18rem,85vw)] flex-col border-r border-[#294849] bg-[#173436] text-white transition-transform duration-200 lg:sticky lg:h-[calc(100vh-4rem)] lg:w-64 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="border-b border-white/10 px-5 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8fb5b1]">Current status</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{isOnline ? 'Available for work' : 'Not available'}</p>
                <p className="mt-0.5 text-xs text-[#9fbcba]">Update your dispatch status</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOnline(current => !current)}
                aria-label={isOnline ? 'Go offline' : 'Go online'}
                className={`relative h-6 w-11 ${isOnline ? 'bg-[#12a36d]' : 'bg-[#587170]'}`}
              >
                <span className={`absolute top-1 h-4 w-4 bg-white transition-transform ${isOnline ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-3" aria-label="Driver navigation">
            {navItems.map(item => {
              const Icon = item.icon
              const isActive = pathname === item.href || (item.href !== '/dashboard/driver' && pathname.startsWith(`${item.href}/`))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-10 items-center gap-3 px-3 py-2 text-sm font-medium ${isActive ? 'bg-white text-[#173436]' : 'text-[#bfd0ce] hover:bg-white/10 hover:text-white'}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-white/10 p-3">
            <p className="px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8fb5b1]">Driver support</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <a href="mailto:support@drivedrop.us.com" className="flex h-9 items-center justify-center gap-2 border border-white/20 text-xs font-semibold text-[#d5e2e0] hover:bg-white/10">
                <Mail className="h-3.5 w-3.5" /> Email
              </a>
              <a href="tel:+15042662317" className="flex h-9 items-center justify-center gap-2 border border-white/20 text-xs font-semibold text-[#d5e2e0] hover:bg-white/10">
                <Phone className="h-3.5 w-3.5" /> Call
              </a>
            </div>
          </div>
        </aside>

        {sidebarOpen && <button type="button" aria-label="Close navigation overlay" className="fixed inset-0 top-16 z-20 bg-black/35 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        <main className="min-w-0 flex-1 p-3 sm:p-5 lg:p-6">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
      </div>

      <BenjiAssistant userType="driver" userId={user?.id} />
    </div>
  )
}