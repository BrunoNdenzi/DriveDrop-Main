'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { StopDetails } from '@/lib/stop-details'

interface StopPopoverProps {
  details: StopDetails
  children: React.ReactNode
  className?: string
  onActivate?: () => void
  'aria-label'?: string
}

const WIDTH = 288
const MARGIN = 8

// Shows on hover or keyboard focus, and stays open when tapped or clicked (touch has no hover).
export default function StopPopover({ details, children, className, onActivate, ...rest }: StopPopoverProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [hovering, setHovering] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const visible = hovering || pinned

  const place = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const box = trigger.getBoundingClientRect()
    const height = panelRef.current?.offsetHeight ?? 160
    const left = Math.min(Math.max(MARGIN, box.left + box.width / 2 - WIDTH / 2), window.innerWidth - WIDTH - MARGIN)
    const below = box.bottom + 6
    const top = below + height > window.innerHeight - MARGIN ? Math.max(MARGIN, box.top - height - 6) : below
    setPosition({ left, top })
  }, [])

  useLayoutEffect(() => {
    if (visible) place()
  }, [visible, place, details])

  useEffect(() => {
    if (!visible) return
    const close = () => { setPinned(false); setHovering(false) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [visible, place])

  return (
    <>
      <button
        {...rest}
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={visible}
        className={className}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onFocus={() => setHovering(true)}
        onBlur={() => setHovering(false)}
        onClick={() => {
          setPinned(current => !current)
          onActivate?.()
        }}
      >
        {children}
      </button>
      {visible && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`${details.kind}: ${details.title}`}
          style={{ position: 'fixed', left: position?.left ?? -9999, top: position?.top ?? -9999, width: WIDTH, zIndex: 80 }}
          className="border border-[#c6d4d2] bg-white p-3 text-left text-xs shadow-xl"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#008c82]">{details.kind}</p>
          <p className="mt-0.5 text-sm font-semibold text-[#173435]">{details.title}</p>
          <dl className="mt-2 space-y-1">
            {details.rows.map(row => (
              <div key={row.label} className="grid grid-cols-[88px_1fr] gap-2">
                <dt className="text-[#6b807e]">{row.label}</dt>
                <dd className="break-words font-medium text-[#254947]">{row.value}</dd>
              </div>
            ))}
          </dl>
          {details.warning && <p className="mt-2 border border-amber-200 bg-amber-50 p-2 text-amber-800">{details.warning}</p>}
        </div>,
        document.body,
      )}
    </>
  )
}
