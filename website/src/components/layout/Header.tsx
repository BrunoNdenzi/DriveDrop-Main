'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <Truck className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">DriveDrop</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
          <Link href="/#quote" className="transition-colors hover:text-primary">
            Get Quote
          </Link>
          <Link href="/#how-it-works" className="transition-colors hover:text-primary">
            How It Works
          </Link>
          <Link href="/drivers/register" className="transition-colors hover:text-primary">
            Become a Driver
          </Link>
          <Link href="/#mobile-app" className="transition-colors hover:text-primary">
            Mobile App
          </Link>
        </nav>

        <div className="hidden md:flex items-center space-x-4">
          <Button asChild variant="outline">
            <Link href="/#mobile-app">Download App</Link>
          </Button>
          <Button asChild>
            <Link href="/#quote">Get Quote</Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden border-t">
          <nav className="container flex flex-col space-y-4 py-4">
            <Link
              href="/#quote"
              className="text-sm font-medium transition-colors hover:text-primary"
              onClick={() => setIsMenuOpen(false)}
            >
              Get Quote
            </Link>
            <Link
              href="/#how-it-works"
              className="text-sm font-medium transition-colors hover:text-primary"
              onClick={() => setIsMenuOpen(false)}
            >
              How It Works
            </Link>
            <Link
              href="/drivers/register"
              className="text-sm font-medium transition-colors hover:text-primary"
              onClick={() => setIsMenuOpen(false)}
            >
              Become a Driver
            </Link>
            <Link
              href="/#mobile-app"
              className="text-sm font-medium transition-colors hover:text-primary"
              onClick={() => setIsMenuOpen(false)}
            >
              Mobile App
            </Link>
            <div className="flex flex-col space-y-2 pt-4">
              <Button asChild variant="outline">
                <Link href="/#mobile-app">Download App</Link>
              </Button>
              <Button asChild>
                <Link href="/#quote">Get Quote</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
