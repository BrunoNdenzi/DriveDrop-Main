'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BadgeDollarSign, BarChart3, Bot, Building2, ClipboardCheck, DollarSign, FileText, FlaskConical,
  FolderOpen, LayoutDashboard, Mail, MapIcon, Package, Plug, Send, Settings, Shield, Target,
  Trash2, TrendingUp, UserCheck, Users, Bell,
} from '@/components/icons/streamline-lucide'

import AdminNotificationBell from '@/components/AdminNotificationBell'
import { BenjiAssistant } from '@/components/benji-v3/BenjiAssistant'
import { OperationalDashboardShell } from '@/components/dashboard/OperationalDashboardShell'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
  { href: '/dashboard/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/admin/users', label: 'Users', icon: Users },
  { href: '/dashboard/admin/shipments', label: 'Shipments', icon: Package },
  { href: '/dashboard/admin/map', label: 'Live map', icon: MapIcon },
  { href: '/dashboard/admin/assignments', label: 'Job assignments', icon: ClipboardCheck },
  { href: '/dashboard/admin/driver-applications', label: 'Driver applications', icon: UserCheck },
  { href: '/dashboard/admin/documents', label: 'Driver documents', icon: FolderOpen },
  { href: '/dashboard/admin/pricing', label: 'Pricing', icon: DollarSign },
  { href: '/dashboard/admin/driver-offers', label: 'Driver offers', icon: BadgeDollarSign },
  { href: '/dashboard/admin/reports', label: 'Reports', icon: BarChart3 },
  { href: '/dashboard/admin/commercial', label: 'Commercial accounts', icon: Building2 },
  { href: '/dashboard/admin/brokers', label: 'Broker management', icon: Shield },
  { href: '/dashboard/admin/integrations', label: 'Integrations', icon: Plug },
  { href: '/dashboard/admin/bol', label: 'BOL management', icon: FileText },
  { href: '/dashboard/admin/ai-review', label: 'AI review queue', icon: Bot },
  { href: '/dashboard/admin/benji-qa', label: 'Benji QA console', icon: FlaskConical },
  { href: '/dashboard/admin/leads', label: 'Lead acquisition', icon: Target },
  { href: '/dashboard/admin/campaigns', label: 'Email campaigns', icon: Mail },
  { href: '/dashboard/admin/quick-send', label: 'Quick send', icon: Send },
  { href: '/dashboard/admin/carriers', label: 'Contacts', icon: Users },
  { href: '/dashboard/admin/campaign-analytics', label: 'Campaign analytics', icon: TrendingUp },
  { href: '/dashboard/admin/settings', label: 'Settings', icon: Settings },
  { href: '/dashboard/admin/account-deletions', label: 'Deletion requests', icon: Trash2 },
  { href: '/dashboard/admin/notifications', label: 'Notifications', icon: Bell },
]

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth()
  const pathname = usePathname()

  if (loading) return <WorkspaceLoader />

  const userName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.email?.split('@')[0] || 'Admin'

  return (
    <>
      <OperationalDashboardShell
        navItems={navItems}
        pathname={pathname}
        roleLabel="Admin"
        userName={userName}
        email={profile?.email}
        profileHref="/dashboard/admin/profile"
        onSignOut={signOut}
        notification={<AdminNotificationBell />}
        avatarClassName="bg-[#f3a712] text-[#173436]"
        headerStatus={<div className="hidden items-center gap-2 border border-[#cbd8d6] bg-[#f4f7f6] px-3 py-2 md:flex"><span className="h-2 w-2 bg-[#12a36d]" /><span className="text-xs font-bold text-[#405958]">Systems operational</span></div>}
        sidebarHeader={<><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8fb5b1]">Control center</p><p className="mt-2 text-sm font-semibold">Platform operations</p></>}
        sidebarFooter={<div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8fb5b1]">Quick actions</p><div className="mt-2 grid gap-2"><Link href="/dashboard/admin/driver-applications" className="border border-white/20 px-3 py-2 text-xs font-semibold text-[#d5e2e0] hover:bg-white/10">Review applications</Link><Link href="/dashboard/admin/users" className="border border-white/20 px-3 py-2 text-xs font-semibold text-[#d5e2e0] hover:bg-white/10">Manage users</Link></div></div>}
      >
        {children}
      </OperationalDashboardShell>
      <BenjiAssistant userType="admin" userId={user?.id} />
    </>
  )
}

function WorkspaceLoader() {
  return <div className="flex min-h-screen items-center justify-center bg-[#f2f6f5]"><div className="h-10 w-10 animate-spin rounded-full border-2 border-[#b8cdca] border-t-[#008c82]" /></div>
}