'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SignUpRoleModal from '@/components/auth/SignUpRoleModal'

export default function OperationalHero() {
  const [showSignUpModal, setShowSignUpModal] = useState(false)

  return (
    <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white py-16 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="container relative">
        <div className="max-w-4xl mx-auto text-center">
          {/* System Status Badge */}
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/30 rounded-full px-4 py-2 mb-6">
            <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-teal-300">Live System • 898 Active Loads</span>
          </div>
          
          {/* Main Headline */}
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Ship Vehicles Faster<br />with AI-Powered Logistics
          </h1>
          
          <p className="text-xl text-gray-300 mb-8 leading-relaxed max-w-3xl mx-auto">
            The only platform combining <span className="text-teal-400 font-semibold">multi-broker integration</span>, <span className="text-teal-400 font-semibold">AI dispatch</span>, and <span className="text-teal-400 font-semibold">real-time tracking</span> across Texas
          </p>

          {/* Key Benefits */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {['Instant quotes', 'Live GPS tracking', 'AI route optimization', 'Broker network sync'].map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
                <CheckCircle className="h-4 w-4 text-teal-400" />
                <span className="text-sm font-medium text-gray-200">{benefit}</span>
              </div>
            ))}
          </div>
          
          {/* CTAs */}
          <div className="flex flex-wrap justify-center gap-4">
            <Button 
              size="lg" 
              className="gap-2 bg-teal-500 hover:bg-teal-600 text-white text-base px-8 py-6"
              onClick={() => setShowSignUpModal(true)}
            >
              Sign Up Now
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Link href="/#quote">
              <Button size="lg" variant="outline" className="gap-2 border-2 border-white/30 text-white hover:bg-white/10 text-base px-8 py-6">
                Get Instant Quote
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Sign Up Role Modal */}
          <SignUpRoleModal open={showSignUpModal} onOpenChange={setShowSignUpModal} />

          {/* Social Proof Stats */}
          <div className="grid grid-cols-3 gap-6 mt-12 pt-12 border-t border-white/10">
            <div>
              <div className="text-3xl font-bold text-teal-400 mb-1">12,500+</div>
              <div className="text-sm text-gray-400">Vehicles Shipped</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-teal-400 mb-1">98.2%</div>
              <div className="text-sm text-gray-400">On-Time Delivery</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-teal-400 mb-1">247</div>
              <div className="text-sm text-gray-400">Active Carriers</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
