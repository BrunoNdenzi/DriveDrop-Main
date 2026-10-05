'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import StopPopover from '@/components/route-planner/StopPopover'
import { describeStop, type StopDetails } from '@/lib/stop-details'
import { ArrowRight, Check, ChevronLeft, ChevronRight } from '@/components/icons/streamline-lucide'
import type { NavStop } from './DriverMapNavigation'

export function isEndStop(stop: NavStop, index: number, stops: NavStop[]): boolean {
  return index > 0 && (stop.isReturn === true || (index === stops.length - 1 && stop.id === stops[0]?.id))
}

export function navStopLabel(stop: NavStop, index: number, stops: NavStop[]): string {
  if (index === 0) return stop.name || 'Start'
  if (isEndStop(stop, index, stops)) return 'End: return to start'
  return stop.label || stop.name || stop.address
}

export function navStopDetails(stop: NavStop, index: number, stops: NavStop[], completed: boolean): StopDetails {
  return describeStop({
    type: stop.type,
    address: stop.address,
    name: navStopLabel(stop, index, stops),
    estimatedArrival: stop.estimatedArrival,
    serviceMinutes: stop.serviceMinutes,
    distanceFromPrevious: stop.distanceFromPrevious,
    durationFromPrevious: stop.durationFromPrevious,
    timeWindow: stop.timeWindow,
    reference: stop.shipmentId,
    hasCoordinates: stop.lat !== undefined && stop.lng !== undefined,
    status: completed ? 'completed' : 'pending',
    isStart: index === 0,
    isEnd: isEndStop(stop, index, stops),
  })
}

interface StopStripProps {
  stops: NavStop[]
  tags: Map<string, string>
  completed: number[]
  currentIndex: number | null
  onSelect?: (index: number) => void
}

// The delivery order as a row you can swipe or step through with the arrows; the next stop stays in view.
export default function StopStrip({ stops, tags, completed, currentIndex, onSelect }: StopStripProps) {
  const scrollerRef = useRef<HTMLOListElement>(null)
  const itemRefs = useRef(new Map<number, HTMLLIElement>())
  const [edges, setEdges] = useState({ start: true, end: true })

  const measure = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    setEdges({
      start: scroller.scrollLeft <= 2,
      end: scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2,
    })
  }, [])

  useEffect(() => {
    measure()
    const scroller = scrollerRef.current
    if (!scroller) return
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(scroller)
    return () => observer?.disconnect()
  }, [measure, stops.length])

  // Keep the stop being driven to centred in the strip, without scrolling the page itself.
  useEffect(() => {
    if (currentIndex === null) return
    const scroller = scrollerRef.current
    const item = itemRefs.current.get(currentIndex)
    if (!scroller || !item) return
    const target = item.offsetLeft - (scroller.clientWidth - item.offsetWidth) / 2
    scroller.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [currentIndex])

  const page = (direction: -1 | 1) => {
    const scroller = scrollerRef.current
    if (scroller) scroller.scrollBy({ left: direction * Math.max(160, scroller.clientWidth * 0.7), behavior: 'smooth' })
  }

  if (stops.length === 0) return null

  const arrow = 'grid h-9 w-8 shrink-0 place-items-center text-gray-600 hover:bg-gray-100 disabled:opacity-25 disabled:hover:bg-transparent'

  return (
    <div className="flex items-stretch border-b border-gray-100" aria-label="Delivery order">
      <button type="button" onClick={() => page(-1)} disabled={edges.start} aria-label="Earlier stops" className={arrow}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      <ol
        ref={scrollerRef}
        onScroll={measure}
        className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {stops.map((stop, index) => {
          const done = completed.includes(index)
          const current = currentIndex === index
          const isStart = index === 0
          const isEnd = isEndStop(stop, index, stops)
          const badge = isStart ? 'S' : isEnd ? 'E' : tags.get(stop.id) ?? String(stop.order ?? index)
          const tone = done
            ? 'bg-gray-400'
            : current
              ? 'bg-amber-500'
              : isStart || isEnd
                ? 'bg-gray-800'
                : stop.type === 'pickup'
                  ? 'bg-blue-600'
                  : stop.type === 'delivery'
                    ? 'bg-emerald-600'
                    : 'bg-gray-600'
          const label = navStopLabel(stop, index, stops)

          return (
            <Fragment key={`${stop.id}-${index}`}>
              {index > 0 && <ArrowRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-gray-300" />}
              <li
                ref={element => {
                  if (element) itemRefs.current.set(index, element)
                  else itemRefs.current.delete(index)
                }}
                className="shrink-0"
              >
                <StopPopover
                  details={navStopDetails(stop, index, stops, done)}
                  onActivate={() => onSelect?.(index)}
                  aria-label={`Stop ${index + 1}: ${label}`}
                  className={`flex max-w-[11rem] items-center gap-1.5 rounded-md border px-1.5 py-1 text-left ${
                    current ? 'border-amber-400 bg-amber-50' : 'border-transparent hover:bg-gray-100'
                  } ${done ? 'opacity-60' : ''}`}
                >
                  <span className={`grid h-6 min-w-6 shrink-0 place-items-center rounded-full px-1 text-[11px] font-bold text-white ${tone}`}>
                    {done ? <Check className="h-3.5 w-3.5" /> : badge}
                  </span>
                  <span className="truncate text-xs font-medium text-gray-800">{label}</span>
                </StopPopover>
              </li>
            </Fragment>
          )
        })}
      </ol>
      <button type="button" onClick={() => page(1)} disabled={edges.end} aria-label="Later stops" className={arrow}>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
