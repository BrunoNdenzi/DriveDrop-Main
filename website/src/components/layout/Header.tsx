'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { Menu, X, LogIn, Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SignUpRoleModal from '@/components/auth/SignUpRoleModal'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [showSignUpModal, setShowSignUpModal] = useState(false)

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
          ? 'bg-white/95 backdrop-blur-xl border-b border-border shadow-sm' 
          : 'bg-slate-950'
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
                width={180} 
                height={46}
                className={`h-10 w-auto group-hover:scale-105 transition-all ${
                  isScrolled ? '' : 'brightness-0 invert'
                }`}
              />
            </div>
          </Link>

          {/* Centered Navigation with floating effect */}
          <nav className="hidden lg:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            <div className={`flex items-center gap-1 px-2 py-2 rounded-full transition-all duration-300 ${
              isScrolled ? 'bg-slate-100/80 border border-border' : 'bg-white/10 border border-white/10'
            }`}>
              <Link 
                href="/#quote" 
                className={`relative px-4 py-2.5 text-sm font-medium rounded-full transition-all duration-200 ${
                  isScrolled ? 'text-foreground/80 hover:text-primary hover:bg-primary/5' : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                Get Quote
              </Link>
              <Link 
                href="/drivers/register" 
                className={`relative px-4 py-2.5 text-sm font-medium rounded-full transition-all duration-200 ${
                  isScrolled ? 'text-foreground/80 hover:text-primary hover:bg-primary/5' : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                Become a Driver
              </Link>
              <Link 
                href="/login?redirect=/dashboard/client/track" 
                className={`relative px-4 py-2.5 text-sm font-medium rounded-full transition-all duration-200 ${
                  isScrolled ? 'text-foreground/80 hover:text-primary hover:bg-primary/5' : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                Track Shipment
              </Link>
            </div>
          </nav>

          {/* Right Actions with special styling */}
          <div className="hidden lg:flex items-center gap-3">
            <Button 
              asChild 
              variant="ghost" 
              className={`group transition-all duration-300 ${
                isScrolled 
                  ? 'text-foreground/80 hover:text-primary hover:bg-primary/5' 
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <Link href="/login">
                <LogIn className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
                Sign In
              </Link>
            </Button>
            <Button 
              className="gradient-primary hover-lift relative overflow-hidden group"
              onClick={() => setShowSignUpModal(true)}
            >
              <span className="relative z-10 flex items-center">
                <Sparkles className="w-4 h-4 mr-2 group-hover:animate-spin" />
                Register
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>
          </div>

          {/* Mobile Menu Button with animation */}
          <button
            className={`lg:hidden p-2 rounded-xl transition-all relative group ${
              isScrolled ? 'hover:bg-primary/10' : 'hover:bg-white/10'
            }`}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              {isMenuOpen ? (
                <X className={`h-6 w-6 ${isScrolled ? 'text-primary' : 'text-white'} animate-spin-in`} />
              ) : (
                <Menu className={`h-6 w-6 ${isScrolled ? 'text-primary' : 'text-white'}`} />
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
              href="/drivers/register"
              className="px-6 py-4 text-base font-medium rounded-xl hover:bg-primary/10 hover:text-primary transition-all hover:translate-x-2 flex items-center group"
              onClick={() => setIsMenuOpen(false)}
            >
              <span className="w-1 h-1 rounded-full bg-primary mr-3 group-hover:scale-150 transition-transform" />
              Become a Driver
            </Link>
            <Link
              href="/login?redirect=/dashboard/client/track"
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
                className="w-full gradient-primary hover-lift"
                size="lg"
                onClick={() => {
                  setIsMenuOpen(false)
                  setShowSignUpModal(true)
                }}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Register
              </Button>
            </div>
          </nav>
        </div>
      )}

      <SignUpRoleModal open={showSignUpModal} onOpenChange={setShowSignUpModal} />
    </header>
  )
}
