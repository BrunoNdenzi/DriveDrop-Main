import { describe, expect, it } from 'vitest'
import { describeStop, formatClock } from './stop-details'

describe('describeStop', () => {
  it('summarises a delivery with timing, window and reference', () => {
    const details = describeStop({
      type: 'delivery',
      address: '5555 Concord Pkwy S, Concord, NC',
      name: '2023 Toyota Camry delivery',
      estimatedArrival: '2026-10-05T15:30:00.000Z',
      serviceMinutes: 10,
      distanceFromPrevious: 12.34,
      durationFromPrevious: 21.4,
      timeWindow: { earliest: '2026-10-05T15:00:00.000Z', latest: '2026-10-05T17:00:00.000Z' },
      reference: 'LOAD-7',
      status: 'pending',
      hasCoordinates: true,
    }, 'UTC')

    expect(details.kind).toBe('Delivery')
    expect(details.title).toBe('2023 Toyota Camry delivery')
    expect(details.rows).toEqual([
      { label: 'Address', value: '5555 Concord Pkwy S, Concord, NC' },
      { label: 'Expected', value: '3:30 PM' },
      { label: 'Time at stop', value: '10 min' },
      { label: 'From previous', value: '12.3 mi · 21 min' },
      { label: 'Time window', value: '3:00 PM to 5:00 PM' },
      { label: 'Reference', value: 'LOAD-7' },
      { label: 'Status', value: 'Not reached yet' },
    ])
    expect(details.warning).toBeUndefined()
  })

  it('labels the first and last stops and skips the distance on the start', () => {
    const start = describeStop({ type: 'current_location', address: 'Charlotte, NC', isStart: true, distanceFromPrevious: 0 })
    expect(start.kind).toBe('Start')
    expect(start.rows.some(row => row.label === 'From previous')).toBe(false)

    const end = describeStop({ type: 'stop', address: 'Charlotte, NC', isEnd: true, name: 'End: return to Start' })
    expect(end.kind).toBe('End')
    expect(end.title).toBe('End: return to Start')
  })

  it('warns when the location was typed rather than picked', () => {
    expect(describeStop({ type: 'stop', address: 'charlotte', hasCoordinates: false }).warning).toMatch(/estimated/)
    expect(describeStop({ type: 'stop', address: 'charlotte' }).warning).toBeUndefined()
  })

  it('ignores invalid times', () => {
    expect(formatClock('not a date')).toBeNull()
    expect(formatClock(undefined)).toBeNull()
  })
})
