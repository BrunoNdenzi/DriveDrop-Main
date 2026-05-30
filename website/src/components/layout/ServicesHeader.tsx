'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { Phone, Menu, X, Layers, TreePine, Package } from 'lucide-react'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/services/tiles', label: 'Tiles', icon: Layers, accent: '#f59e0b' },
  { href: '/services/tree-removal', label: 'Tree Removal', icon: TreePine, accent: '#22c55e' },
  { href: '/services/delivery', label: 'Van Delivery', icon: Package, accent: '#3b82f6' },
]

export default function ServicesHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const activeAccent = NAV.find(n => pathname === n.href)?.accent ?? '#f59e0b'

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/96 backdrop-blur-xl border-b border-border shadow-sm'
          : 'bg-slate-950'
      }`}
    >
      <div className="container">
        <div className="flex h-[68px] items-center justify-between gap-4">

          {/* Logo — placeholder until brand is decided */}
          <Link href="/services" className="flex items-center shrink-0">
            <Image
              src="/logo-primary.png"
              alt="Logo"
              width={150}
              height={38}
              className={`h-8 w-auto transition-all ${isScrolled ? '' : 'brightness-0 invert'}`}
            />
          </Link>

          {/* Desktop — service nav pill */}
          <nav className="hidden md:flex items-center">
            <div
              className={`flex items-center gap-0.5 px-1.5 py-1.5 rounded-full transition-all ${
                isScrolled
                  ? 'bg-slate-100 border border-border'
                  : 'bg-white/8 border border-white/10'
              }`}
            >
              {NAV.map(({ href, label, icon: Icon, accent }) => {
                const active = pathname === href
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 ${
                      active
                        ? isScrolled
                          ? 'bg-white shadow-sm text-foreground'
                          : 'bg-white/15 text-white'
                        : isScrolled
                          ? 'text-foreground/55 hover:text-foreground hover:bg-white'
                          : 'text-white/50 hover:text-white/90 hover:bg-white/8'
                    }`}
                  >
                    <Icon
                      className="h-3.5 w-3.5"
                      style={{ color: active ? accent : undefined }}
                    />
                    {label}
                  </Link>
                )
              })}
            </div>
          </nav>

          {/* Desktop right — phone + subtle DriveDrop link */}
          <div className="hidden md:flex items-center gap-4 shrink-0">
            <Link
              href="/"
              className={`text-xs font-medium transition-colors whitespace-nowrap ${
                isScrolled ? 'text-muted-foreground hover:text-foreground' : 'text-white/30 hover:text-white/60'
              }`}
            >
              DriveDrop.us.com ↗
            </Link>
            <a
              href="tel:+17042662317"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm px-5 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
            >
              <Phone className="h-3.5 w-3.5" />
              (704) 266-2317
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            className={`md:hidden p-2 rounded-lg transition-colors ${
              isScrolled ? 'hover:bg-slate-100' : 'hover:bg-white/10'
            }`}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen
              ? <X className={`h-5 w-5 ${isScrolled ? 'text-foreground' : 'text-white'}`} />
              : <Menu className={`h-5 w-5 ${isScrolled ? 'text-foreground' : 'text-white'}`} />
            }
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {isMenuOpen && (
        <div
          className={`md:hidden border-t ${
            isScrolled ? 'border-border bg-white' : 'border-white/10 bg-slate-950'
          }`}
        >
          <div className="container py-4 space-y-1">
            {NAV.map(({ href, label, icon: Icon, accent }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    active
                      ? isScrolled
                        ? 'bg-slate-50 text-foreground'
                        : 'bg-white/10 text-white'
                      : isScrolled
                        ? 'text-foreground/60 hover:text-foreground hover:bg-slate-50'
                        : 'text-white/60 hover:text-white hover:bg-white/8'
                  }`}
                >
                  <Icon className="h-4 w-4" style={{ color: accent }} />
                  {label}
                </Link>
              )
            })}

            <div className="pt-3 space-y-2 border-t border-white/10 mt-1">
              <a
                href="tel:+17042662317"
                className="flex items-center gap-2 bg-amber-500 text-black font-bold px-4 py-3 rounded-xl text-sm"
              >
                <Phone className="h-4 w-4" />
                +1 (704) 266-2317
              </a>
              <Link
                href="/"
                onClick={() => setIsMenuOpen(false)}
                className={`block px-4 py-2 text-xs transition-colors ${
                  isScrolled ? 'text-muted-foreground' : 'text-white/30'
                }`}
              >
                ← Back to DriveDrop Vehicle Shipping
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
