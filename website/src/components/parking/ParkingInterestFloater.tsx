'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ParkingSquare, X } from '@/components/icons/streamline-lucide'

const DISMISSED_KEY = 'parking-interest-floater-dismissed'

export default function ParkingInterestFloater() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(sessionStorage.getItem(DISMISSED_KEY) !== 'true')
  }, [])

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, 'true')
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <aside
      className="fixed bottom-6 left-6 z-40 hidden w-[calc(100vw-3rem)] max-w-sm animate-slide-up overflow-hidden rounded-md border border-teal-700/30 bg-slate-950 text-white shadow-2xl shadow-slate-950/30 sm:block"
      aria-label="Charlotte commercial parking survey"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-teal-400"
        aria-label="Dismiss parking survey notice"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="flex items-center gap-4 p-4 pr-11 sm:items-start sm:p-5 sm:pr-12">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-teal-500 text-slate-950">
          <ParkingSquare className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-300">Charlotte I-77 corridor</p>
          <h2 className="mt-1 text-base font-bold leading-6">Need secure commercial parking?</h2>
          <p className="mt-2 hidden text-sm leading-6 text-slate-300 sm:block">
            Help shape a proposed gated facility for tractors, trailers, and equipment. The survey takes about two minutes.
          </p>
          <Link
            href="/parking-interest"
            className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-teal-300 transition hover:text-teal-200 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            Share your parking needs
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </aside>
  )
}