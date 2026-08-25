'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Layers, Menu, Package, Phone, TreePine, Truck, X } from '@/components/icons/streamline-lucide'

const navigation = [
  { href: '/services/tiles', label: 'Tiles', icon: Layers },
  { href: '/services/tree-removal', label: 'Tree removal', icon: TreePine },
  { href: '/services/delivery', label: 'Van delivery', icon: Package },
  { href: '/services/freight', label: 'Freight', icon: Truck },
]

export default function ServicesHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/15 bg-[#173436] text-white">
      <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/services" className="shrink-0" aria-label="DriveDrop services">
          <Image src="/logo-white.png" alt="DriveDrop" width={150} height={38} className="h-8 w-auto" priority />
        </Link>

        <nav className="hidden h-full items-stretch md:flex" aria-label="Services">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${active ? 'border-[#5cd6ca] bg-white/10 text-white' : 'border-transparent text-[#b8cecb] hover:bg-white/5 hover:text-white'}`}>
                <Icon className="h-4 w-4" />{label}
              </Link>
            )
          })}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <Link href="/" className="text-xs font-semibold text-[#9fbcba] hover:text-white">Vehicle shipping</Link>
          <a href="tel:+17042662317" className="inline-flex h-10 items-center gap-2 bg-[#f3a712] px-4 text-sm font-bold text-[#173436] hover:bg-[#e3a018]"><Phone className="h-4 w-4" />(704) 266-2317</a>
        </div>

        <button type="button" className="grid h-9 w-9 place-items-center border border-white/25 md:hidden" onClick={() => setIsMenuOpen(current => !current)} aria-label={isMenuOpen ? 'Close services menu' : 'Open services menu'} aria-expanded={isMenuOpen}>
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isMenuOpen && (
        <div className="border-t border-white/15 bg-[#173436] px-4 py-3 md:hidden">
          <nav className="mx-auto max-w-[1440px] space-y-1" aria-label="Mobile services">
            {navigation.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setIsMenuOpen(false)} className={`flex min-h-11 items-center gap-3 px-3 text-sm font-semibold ${pathname === href ? 'bg-white text-[#173436]' : 'text-[#bfd0ce] hover:bg-white/10 hover:text-white'}`}>
                <Icon className="h-4 w-4" />{label}
              </Link>
            ))}
            <a href="tel:+17042662317" className="mt-3 flex min-h-11 items-center justify-center gap-2 bg-[#f3a712] px-4 text-sm font-bold text-[#173436]"><Phone className="h-4 w-4" />+1 (704) 266-2317</a>
          </nav>
        </div>
      )}
    </header>
  )
}