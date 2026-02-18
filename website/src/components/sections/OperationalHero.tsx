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
      <div className="flex items-stretch border-b border-slate-800 bg-slate-900">
        {/* First cell: System Online + Active Shipments */}
        <div className="flex-1 min-w-[140px] flex flex-col items-center justify-center px-4 py-3">
          <StatusBadge variant="success" label="System Online" size="sm" className="!bg-white/10 !border-white/20 !text-emerald-400" />
          <span className="text-lg font-semibold tabular-nums text-white mt-1">898</span>
        </div>
        {[
          { label: 'On-Time Rate', value: '98.2%' },
          { label: 'Delayed', value: '3' },
          { label: 'Capacity Utilization', value: '74%' },
          { label: '24h Throughput', value: '156' },
        ].map((metric) => (
          <div key={metric.label} className="flex-1 min-w-[120px] flex flex-col items-center justify-center px-4 py-3 border-l border-slate-800">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{metric.label}</span>
            <span className="text-lg font-semibold tabular-nums text-white">{metric.value}</span>
          </div>
        ))}
      </div>

      {/* Primary Content */}
      <div className="px-6 py-8">
        <div className="max-w-full">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
            Vehicle Logistics Operations
          </h1>

          <p className="text-sm text-slate-300 mb-5 max-w-xl">
            Multi-broker dispatch, AI routing, and real-time shipment tracking — Carolina operations.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3">
            <Button
              size="default"
              className="gap-2 bg-primary hover:bg-primary/90 text-white"
              onClick={() => setShowSignUpModal(true)}
            >
              Create Account
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Link href="/#quote">
              <Button size="default" className="gap-2 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600">
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
