'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Car, CreditCard, MessageSquare, Package, Plus, Settings, User } from '@/components/icons/streamline-lucide'

import NotificationBell from '@/components/NotificationBell'
import { BenjiAssistant } from '@/components/benji-v3/BenjiAssistant'
import { OperationalDashboardShell } from '@/components/dashboard/OperationalDashboardShell'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
  { href: '/dashboard/client', label: 'Overview', icon: Package },
  { href: '/dashboard/client/shipments', label: 'My shipments', icon: Package },
  { href: '/dashboard/client/new-shipment', label: 'New shipment', icon: Plus },
  { href: '/dashboard/client/vehicles', label: 'My vehicles', icon: Car },
  { href: '/dashboard/client/messages', label: 'Messages', icon: MessageSquare },
  { href: '/dashboard/client/payments', label: 'Payments', icon: CreditCard },
  { href: '/dashboard/client/profile', label: 'Profile', icon: User },
  { href: '/dashboard/client/settings', label: 'Settings', icon: Settings },
]

export default function ClientDashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth()
  const pathname = usePathname()

  if (loading) return <WorkspaceLoader />

  const userName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.email?.split('@')[0] || 'Shipper'

  return (
    <>
      <OperationalDashboardShell
        navItems={navItems}
        pathname={pathname}
        roleLabel="Shipper"
        userName={userName}
        email={profile?.email}
        profileHref="/dashboard/client/profile"
        onSignOut={signOut}
        notification={<NotificationBell />}
        avatarClassName="bg-[#5cd6ca] text-[#173436]"
        sidebarHeader={<><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8fb5b1]">Transport account</p><p className="mt-2 text-sm font-semibold">Plan and track every move</p></>}
        sidebarFooter={<Link href="/contact" className="block border border-white/20 px-3 py-2 text-center text-xs font-semibold text-[#d5e2e0] hover:bg-white/10">Contact support</Link>}
      >
        {children}
      </OperationalDashboardShell>
      <BenjiAssistant userType="client" userId={user?.id} />
    </>
  )
}

function WorkspaceLoader() {
  return <div className="flex min-h-screen items-center justify-center bg-[#f2f6f5]"><div className="h-10 w-10 animate-spin rounded-full border-2 border-[#b8cdca] border-t-[#008c82]" /></div>
}