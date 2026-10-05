'use client'

import StopPopover from './StopPopover'
import { describeStop } from '@/lib/stop-details'

export interface ListedStop {
  id: string
  type: string
  order: number
  address: string
  name?: string | undefined
  vehicleInfo?: string | undefined
  estimatedArrival?: string | undefined
  estimatedDuration?: number | undefined
  distanceFromPrevious?: number | undefined
  durationFromPrevious?: number | undefined
  timeWindow?: { earliest: string; latest: string } | undefined
  shipmentId?: string | undefined
  referenceId?: string | undefined
  latitude?: number | undefined
  longitude?: number | undefined
  isReturn?: boolean | undefined
}

// Older saved results repeat the start stop at the end instead of flagging it as the return.
export function isEndStop(stop: ListedStop, index: number, stops: ListedStop[]): boolean {
  return index > 0 && (stop.isReturn === true || (index === stops.length - 1 && stop.id === stops[0]?.id))
}

export function stopLabel(stop: ListedStop, index: number, stops: ListedStop[]): string {
  if (index === 0) return stop.name || 'Start'
  if (isEndStop(stop, index, stops)) return stop.vehicleInfo?.startsWith('End') ? stop.vehicleInfo : 'End: return to start'
  return stop.vehicleInfo || stop.name || stop.address
}

export default function OptimizedStopList({ stops, tags }: { stops: ListedStop[]; tags: Map<string, string> | null }) {
  return (
    <ol className="mt-4 space-y-1">
      {stops.map((stop, index) => {
        const isStart = index === 0
        const isEnd = isEndStop(stop, index, stops)
        const label = stopLabel(stop, index, stops)
        const badge = isStart ? 'S' : isEnd ? 'E' : tags?.get(stop.id) ?? String(stop.order)
        const tone = isStart || isEnd ? 'bg-[#173f40]' : stop.type === 'pickup' ? 'bg-blue-600' : stop.type === 'delivery' ? 'bg-emerald-600' : 'bg-[#173f40]'
        const details = describeStop({
          type: stop.type,
          address: stop.address,
          name: label,
          estimatedArrival: stop.estimatedArrival,
          serviceMinutes: stop.estimatedDuration,
          distanceFromPrevious: stop.distanceFromPrevious,
          durationFromPrevious: stop.durationFromPrevious,
          timeWindow: stop.timeWindow,
          reference: stop.shipmentId ?? stop.referenceId,
          hasCoordinates: stop.latitude !== undefined && stop.longitude !== undefined,
          isStart,
          isEnd,
        })

        return (
          <li key={`${stop.order}-${stop.id}-${index}`}>
            <StopPopover details={details} className="flex w-full gap-3 p-1.5 text-left text-sm hover:bg-[#edf3f2] focus:bg-[#edf3f2] focus:outline-none">
              <span className={`grid h-6 min-w-6 shrink-0 place-items-center px-1 text-xs font-bold text-white ${tone}`}>{badge}</span>
              <span className="min-w-0">
                <span className="block font-semibold">{label}</span>
                <span className="block truncate text-xs text-[#657a78]">{stop.address}</span>
              </span>
            </StopPopover>
          </li>
        )
      })}
    </ol>
  )
}
