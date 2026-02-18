'use client'

import { useEffect, useState } from 'react'
import { Wrench, Clock, ArrowRight } from 'lucide-react'

export default function MaintenancePage() {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'))
    }, 600)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center space-y-8">
        {/* Logo / Brand */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Drive<span className="text-blue-400">Drop</span>
          </h1>
        </div>

        {/* Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Wrench className="w-10 h-10 text-blue-400 animate-pulse" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
              <Clock className="w-3 h-3 text-amber-900" />
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            Under Maintenance{dots}
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed max-w-md mx-auto">
            We're making improvements to give you a better experience. 
            This won't take long — we'll be back shortly.
          </p>
        </div>

        {/* Status indicator */}
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">
            Deploying updates
          </span>
        </div>

        {/* Contact info */}
        <div className="pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-600">
            Questions? Reach us at{' '}
            <a
              href="mailto:support@drivedrop.com"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              support@drivedrop.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
