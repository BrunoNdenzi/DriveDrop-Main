'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import SignUpRoleModal from '@/components/auth/SignUpRoleModal'

export default function OperationalHero() {
  const [showSignUpModal, setShowSignUpModal] = useState(false)

  return (
    <section className="bg-slate-950 border-b border-slate-800">
      {/* Telemetry bar — StatusBadge integrated into first metric cell */}
      <div className="grid grid-cols-2 sm:grid-cols-5 items-stretch border-b border-slate-800 bg-slate-900">
        {/* First cell: System Online + Active Shipments */}
        <div className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center px-2 sm:px-4 py-3 border-b sm:border-b-0 border-slate-800">
          <StatusBadge variant="success" label="System Online" size="sm" className="!bg-white/10 !border-white/20 !text-emerald-400" />
          <span className="text-lg font-semibold tabular-nums text-white mt-1">8</span>
        </div>
        {[
          { label: 'On-Time Rate', value: '100%' },
          { label: 'Delayed', value: '0' },
          { label: 'Coverage', value: 'Southeast US' },
          { label: 'Avg Response', value: '< 2 hrs' },
        ].map((metric) => (
          <div key={metric.label} className="min-w-0 flex flex-col items-center justify-center px-2 sm:px-4 py-3 border-l border-t sm:border-t-0 border-slate-800 text-center">
            <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-normal sm:tracking-wider">{metric.label}</span>
            <span className="text-base sm:text-lg font-semibold tabular-nums text-white break-words">{metric.value}</span>
          </div>
        ))}
      </div>

      {/* Primary Content */}
      <div className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-full">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
            Vehicle Logistics Operations
          </h1>

          <p className="text-sm text-slate-300 mb-5 max-w-xl">
            Multi-broker dispatch, AI routing, and real-time shipment tracking — Carolina operations.
          </p>

          {/* CTAs */}
          <div className="grid grid-cols-1 sm:flex gap-3">
            <Button
              size="default"
              className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-white"
              onClick={() => setShowSignUpModal(true)}
            >
              Create Account
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Link href="/#quote" className="w-full sm:w-auto">
              <Button size="default" className="w-full sm:w-auto gap-2 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600">
                Request Quote
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <SignUpRoleModal open={showSignUpModal} onOpenChange={setShowSignUpModal} />
      </div>
    </section>
  )
}
