'use client'

import Image from 'next/image'
import Link from 'next/link'
import { type ComponentType, type ReactNode, useState } from 'react'
import { ChevronDown, LogOut, Menu, User, X } from '@/components/icons/streamline-lucide'

export type DashboardNavItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
}

type OperationalDashboardShellProps = {
  children: ReactNode
  navItems: readonly DashboardNavItem[]
  pathname: string
  roleLabel: string
  userName: string
  email?: string | null
  profileHref: string
  onSignOut: () => void | Promise<void>
  notification: ReactNode
  headerStatus?: ReactNode
  sidebarHeader?: ReactNode
  sidebarFooter?: ReactNode
  avatarClassName?: string
}

export function OperationalDashboardShell({
  children,
  navItems,
  pathname,
  roleLabel,
  userName,
  email,
  profileHref,
  onSignOut,
  notification,
  headerStatus,
  sidebarHeader,
  sidebarFooter,
  avatarClassName = 'bg-[#5cd6ca] text-[#173436]',
}: OperationalDashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
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
            <p className="hidden border-l border-[#d7e1df] pl-3 text-xs font-bold uppercase tracking-[0.12em] text-[#6d807f] sm:block">{roleLabel} workspace</p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {headerStatus}
            {notification}
            <div className="relative">
              <button type="button" onClick={() => setUserMenuOpen(current => !current)} aria-expanded={userMenuOpen} className="flex h-10 items-center gap-2 px-1 text-left sm:px-2">
                <span className={`grid h-9 w-9 place-items-center text-xs font-bold ${avatarClassName}`}>{initials}</span>
                <span className="hidden max-w-36 truncate text-sm font-semibold text-[#263f40] md:block">{userName}</span>
                <ChevronDown className="hidden h-4 w-4 text-[#718482] md:block" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-12 w-60 border border-[#cbd8d6] bg-white py-2 shadow-lg">
                  <div className="border-b border-[#dce5e3] px-4 py-3">
                    <p className="truncate text-sm font-semibold text-[#263f40]">{userName}</p>
                    <p className="mt-0.5 truncate text-xs text-[#718482]">{email}</p>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#008c82]">{roleLabel} account</p>
                  </div>
                  <Link href={profileHref} onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#405958] hover:bg-[#f2f6f5]">
                    <User className="h-4 w-4" /> Profile settings
                  </Link>
                  <button type="button" onClick={onSignOut} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#aa3e35] hover:bg-[#fff4f3]">
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className={`fixed bottom-0 left-0 top-16 z-30 flex w-[min(18rem,85vw)] flex-col border-r border-[#294849] bg-[#173436] text-white transition-transform duration-200 lg:sticky lg:h-[calc(100vh-4rem)] lg:w-64 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {sidebarHeader && <div className="border-b border-white/10 px-5 py-5">{sidebarHeader}</div>}
          <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-3" aria-label={`${roleLabel} navigation`}>
            {navItems.map(item => {
              const Icon = item.icon
              const isActive = pathname === item.href || (pathname.startsWith(`${item.href}/`) && item.href.split('/').length > 3)

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
          {sidebarFooter && <div className="border-t border-white/10 p-3">{sidebarFooter}</div>}
        </aside>

        {sidebarOpen && <button type="button" aria-label="Close navigation overlay" className="fixed inset-0 top-16 z-20 bg-black/35 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        <main className="min-w-0 flex-1 p-3 sm:p-5 lg:p-6">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  )
}