'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { Menu, X, LogIn, Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'glass border-b border-white/20 shadow-lg' 
          : 'bg-transparent'
      }`}
    >
      <div className="container">
        <div className="flex h-20 items-center justify-between">
          {/* Logo with animated border */}
          <Link 
            href="/" 
            className="flex items-center group relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-xl blur-xl group-hover:blur-2xl transition-all opacity-0 group-hover:opacity-100" />
            <div className="relative px-4 py-2 rounded-xl border border-primary/20 group-hover:border-primary/40 transition-all">
              <Image 
                src="/logo-primary.png" 
                alt="DriveDrop" 
                width={140} 
                height={36}
                className="h-8 w-auto group-hover:scale-105 transition-transform"
              />
            </div>
          </Link>

          {/* Centered Navigation with floating effect */}
          <nav className="hidden lg:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-1 px-2 py-2 rounded-full glass-nav">
              <Link 
                href="/#quote" 
                className="nav-link group"
              >
                <span className="relative z-10">Get Quote</span>
                <div className="absolute inset-0 rounded-full bg-primary/10 scale-0 group-hover:scale-100 transition-transform" />
              </Link>
              <Link 
                href="/#how-it-works" 
                className="nav-link group"
              >
                <span className="relative z-10">How It Works</span>
                <div className="absolute inset-0 rounded-full bg-primary/10 scale-0 group-hover:scale-100 transition-transform" />
              </Link>
              <Link 
                href="/drivers/register" 
                className="nav-link group"
              >
                <span className="relative z-10">Become a Driver</span>
                <div className="absolute inset-0 rounded-full bg-primary/10 scale-0 group-hover:scale-100 transition-transform" />
              </Link>
              <Link 
                href="/#track" 
                className="nav-link group"
              >
                <span className="relative z-10">Track Shipment</span>
                <div className="absolute inset-0 rounded-full bg-primary/10 scale-0 group-hover:scale-100 transition-transform" />
              </Link>
            </div>
          </nav>

          {/* Right Actions with special styling */}
          <div className="hidden lg:flex items-center gap-3">
            <Button 
              asChild 
              variant="ghost" 
              className="text-foreground/80 hover:text-primary hover:bg-primary/5 group"
            >
              <Link href="/login">
                <LogIn className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
                Sign In
              </Link>
            </Button>
            <Button 
              asChild 
              className="gradient-primary hover-lift relative overflow-hidden group"
            >
              <Link href="/#quote" className="relative z-10 flex items-center">
                <Sparkles className="w-4 h-4 mr-2 group-hover:animate-spin" />
                Get Started
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>

          {/* Mobile Menu Button with animation */}
          <button
            className="lg:hidden p-2 hover:bg-primary/10 rounded-xl transition-all relative group"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              {isMenuOpen ? (
                <X className="h-6 w-6 text-primary animate-spin-in" />
              ) : (
                <Menu className="h-6 w-6 text-primary" />
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="lg:hidden glass-nav border-t border-white/20 animate-slide-down">
          <nav className="container flex flex-col py-6 space-y-1">
            <Link
              href="/#quote"
              className="px-6 py-4 text-base font-medium rounded-xl hover:bg-primary/10 hover:text-primary transition-all hover:translate-x-2 flex items-center group"
              onClick={() => setIsMenuOpen(false)}
            >
              <span className="w-1 h-1 rounded-full bg-primary mr-3 group-hover:scale-150 transition-transform" />
              Get Quote
            </Link>
            <Link
              href="/#how-it-works"
              className="px-6 py-4 text-base font-medium rounded-xl hover:bg-primary/10 hover:text-primary transition-all hover:translate-x-2 flex items-center group"
              onClick={() => setIsMenuOpen(false)}
            >
              <span className="w-1 h-1 rounded-full bg-primary mr-3 group-hover:scale-150 transition-transform" />
              How It Works
            </Link>
            <Link
              href="/drivers/register"
              className="px-6 py-4 text-base font-medium rounded-xl hover:bg-primary/10 hover:text-primary transition-all hover:translate-x-2 flex items-center group"
              onClick={() => setIsMenuOpen(false)}
            >
              <span className="w-1 h-1 rounded-full bg-primary mr-3 group-hover:scale-150 transition-transform" />
              Become a Driver
            </Link>
            <Link
              href="/#track"
              className="px-6 py-4 text-base font-medium rounded-xl hover:bg-primary/10 hover:text-primary transition-all hover:translate-x-2 flex items-center group"
              onClick={() => setIsMenuOpen(false)}
            >
              <span className="w-1 h-1 rounded-full bg-primary mr-3 group-hover:scale-150 transition-transform" />
              Track Shipment
            </Link>
            
            <div className="border-t border-white/20 my-4" />
            
            <Link
              href="/login"
              className="px-6 py-4 text-base font-medium rounded-xl hover:bg-primary/10 hover:text-primary transition-all flex items-center"
              onClick={() => setIsMenuOpen(false)}
            >
              <LogIn className="w-5 h-5 mr-3" />
              Sign In
            </Link>
            
            <div className="px-6 pt-2">
              <Button 
                asChild 
                className="w-full gradient-primary hover-lift"
                size="lg"
              >
                <Link href="/#quote" onClick={() => setIsMenuOpen(false)}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Get Started
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
