'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from '@/components/icons/streamline-lucide'

interface CollapsibleSectionProps {
  title: string
  count?: number
  storageKey: string
  defaultOpen?: boolean
  className?: string
  children: React.ReactNode
}

// Remembers each section's open state per browser so long guidance lists stay out of the way.
export default function CollapsibleSection({ title, count, storageKey, defaultOpen = false, className = '', children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`planner-section:${storageKey}`)
      if (saved !== null) setOpen(saved === '1')
    } catch {
      // Storage can be unavailable in private mode; the default applies.
    }
  }, [storageKey])

  const toggle = () => {
    setOpen(current => {
      const next = !current
      try { localStorage.setItem(`planner-section:${storageKey}`, next ? '1' : '0') } catch { /* see above */ }
      return next
    })
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left font-bold text-[#254947]"
      >
        <span>{title}{count !== undefined ? <span className="ml-2 font-semibold text-[#6b807e]">({count})</span> : null}</span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  )
}
