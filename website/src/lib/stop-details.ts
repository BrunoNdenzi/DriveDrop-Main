export interface StopDetailInput {
  type: string
  address: string
  name?: string | undefined
  status?: string | undefined
  estimatedArrival?: string | undefined
  serviceMinutes?: number | undefined
  distanceFromPrevious?: number | undefined
  durationFromPrevious?: number | undefined
  timeWindow?: { earliest: string; latest: string } | undefined
  reference?: string | undefined
  hasCoordinates?: boolean | undefined
  isStart?: boolean | undefined
  isEnd?: boolean | undefined
}

export interface StopDetails {
  kind: string
  title: string
  rows: Array<{ label: string; value: string }>
  warning?: string
}

const KIND_LABELS: Record<string, string> = {
  pickup: 'Pickup',
  delivery: 'Delivery',
  fuel: 'Fuel stop',
  rest: 'Rest stop',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Not reached yet',
  arrived: 'Arrived',
  completed: 'Completed',
  skipped: 'Skipped',
}

export function formatClock(iso: string | undefined, timeZone?: string): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...(timeZone ? { timeZone } : {}) })
}

export function describeStop(input: StopDetailInput, timeZone?: string): StopDetails {
  const kind = input.isStart ? 'Start' : input.isEnd ? 'End' : KIND_LABELS[input.type] ?? 'Stop'
  const rows: StopDetails['rows'] = [{ label: 'Address', value: input.address }]

  const arrival = formatClock(input.estimatedArrival, timeZone)
  if (arrival) rows.push({ label: input.isStart ? 'Departs' : 'Expected', value: arrival })
  if (input.serviceMinutes !== undefined && input.serviceMinutes > 0) rows.push({ label: 'Time at stop', value: `${input.serviceMinutes} min` })
  if (!input.isStart && input.distanceFromPrevious !== undefined) {
    const minutes = input.durationFromPrevious !== undefined ? ` · ${Math.round(input.durationFromPrevious)} min` : ''
    rows.push({ label: 'From previous', value: `${input.distanceFromPrevious.toFixed(1)} mi${minutes}` })
  }
  const earliest = formatClock(input.timeWindow?.earliest, timeZone)
  const latest = formatClock(input.timeWindow?.latest, timeZone)
  if (earliest && latest) rows.push({ label: 'Time window', value: `${earliest} to ${latest}` })
  if (input.reference) rows.push({ label: 'Reference', value: input.reference })
  if (input.status) rows.push({ label: 'Status', value: STATUS_LABELS[input.status] ?? input.status })

  return {
    kind,
    title: input.name?.trim() || input.address,
    rows,
    ...(input.hasCoordinates === false ? { warning: 'Typed without picking a suggestion, so this location is estimated from the text.' } : {}),
  }
}
