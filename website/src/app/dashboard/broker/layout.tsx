'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Briefcase, DollarSign, FileText, LayoutDashboard, MessageSquare, Package, Settings, TrendingUp, Users } from '@/components/icons/streamline-lucide'

import NotificationBell from '@/components/NotificationBell'
import { BenjiAssistant } from '@/components/benji-v3/BenjiAssistant'
import { OperationalDashboardShell } from '@/components/dashboard/OperationalDashboardShell'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
  { href: '/dashboard/broker', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/broker/shipments', label: 'My shipments', icon: Package },
  { href: '/dashboard/broker/load-board', label: 'Load board', icon: FileText },
  { href: '/dashboard/broker/assignments', label: 'My assignments', icon: Briefcase },
  { href: '/dashboard/broker/tracking', label: 'Live tracking', icon: TrendingUp },
  { href: '/dashboard/broker/messages', label: 'Messages', icon: MessageSquare },
  { href: '/dashboard/broker/carriers', label: 'Carrier network', icon: Users },
  { href: '/dashboard/broker/payouts', label: 'Payouts', icon: DollarSign },
  { href: '/dashboard/broker/settings', label: 'Settings', icon: Settings },
]

export default function BrokerDashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  if (loading) return <WorkspaceLoader />
  if (!user) { router.push('/login'); return null }

  if (profile?.role && profile.role !== 'broker') {
    const roleRedirects: Record<string, string> = { client: '/dashboard', driver: '/dashboard/driver', admin: '/dashboard/admin' }
    router.push(roleRedirects[profile.role] || '/dashboard')
    return null
  }

  const userName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.email?.split('@')[0] || 'Broker'

  return (
    <>
      <OperationalDashboardShell
        navItems={navItems}
        pathname={pathname}
        roleLabel="Broker"
        userName={userName}
        email={profile?.email}
        profileHref="/dashboard/broker/settings"
        onSignOut={signOut}
        notification={<NotificationBell />}
        avatarClassName="bg-[#5cd6ca] text-[#173436]"
        headerStatus={<div className="hidden items-center gap-2 border border-[#cbd8d6] bg-[#f4f7f6] px-3 py-2 md:flex"><span className="h-2 w-2 bg-[#12a36d]" /><span className="text-xs font-bold text-[#405958]">Broker portal</span></div>}
        sidebarHeader={<><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8fb5b1]">Network desk</p><p className="mt-2 text-sm font-semibold">Loads, carriers, and payouts</p></>}
        sidebarFooter={<div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8fb5b1]">This month</p><div className="mt-2 flex items-end justify-between"><p className="text-xl font-semibold tabular-nums">$0.00</p><p className="text-xs text-[#9fbcba]">0 loads</p></div><Link href="/contact" className="mt-3 block border border-white/20 px-3 py-2 text-center text-xs font-semibold text-[#d5e2e0] hover:bg-white/10">Broker support</Link></div>}
      >
        {children}
      </OperationalDashboardShell>
      <BenjiAssistant userType="broker" userId={user.id} />
    </>
  )
}

function WorkspaceLoader() {
  return <div className="flex min-h-screen items-center justify-center bg-[#f2f6f5]"><div className="h-10 w-10 animate-spin rounded-full border-2 border-[#b8cdca] border-t-[#008c82]" /></div>
}