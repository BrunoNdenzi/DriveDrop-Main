import { describe, expect, it } from 'vitest'
import { DESKTOP_WAYPOINT_LIMIT, MOBILE_WAYPOINT_LIMIT, googleMapsRouteParts, isMobileBrowser } from './external-nav'

const stops = (count: number) => Array.from({ length: count }, (_, index) => ({ address: `Stop ${index + 1}`, lat: 35 + index / 100, lng: -80 }))

describe('googleMapsRouteParts', () => {
  it('keeps a short route in one link with the last stop as destination', () => {
    const parts = googleMapsRouteParts(stops(3))
    expect(parts).toHaveLength(1)
    const url = new URL(parts[0]!.url)
    expect(url.searchParams.get('destination')).toBe('35.02,-80')
    expect(url.searchParams.get('waypoints')).toBe('35,-80|35.01,-80')
    expect(url.searchParams.has('origin')).toBe(false)
  })

  it('splits a long route so every stop appears exactly once, in order', () => {
    const parts = googleMapsRouteParts(stops(25), { maxWaypoints: DESKTOP_WAYPOINT_LIMIT })
    expect(parts.map(part => part.stops.length)).toEqual([10, 10, 5])
    expect(parts.flatMap(part => part.stops.map(stop => stop.address))).toEqual(stops(25).map(stop => stop.address))
    expect(parts.every(part => part.total === 3)).toBe(true)
  })

  it('chains each part from the end of the previous one', () => {
    const parts = googleMapsRouteParts(stops(8), { maxWaypoints: MOBILE_WAYPOINT_LIMIT })
    expect(parts).toHaveLength(2)
    expect(new URL(parts[0]!.url).searchParams.get('destination')).toBe('35.03,-80')
    expect(new URL(parts[1]!.url).searchParams.get('origin')).toBe('35.03,-80')
    // Mobile browsers allow 3 waypoints, so 4 stops per link.
    expect(new URL(parts[0]!.url).searchParams.get('waypoints')!.split('|')).toHaveLength(3)
  })

  it('uses a given origin only for the first part', () => {
    const parts = googleMapsRouteParts(stops(6), { maxWaypoints: 3, origin: { address: 'Depot', lat: 34, lng: -81 } })
    expect(new URL(parts[0]!.url).searchParams.get('origin')).toBe('34,-81')
  })

  it('splits long addresses to stay under the URL limit and ignores empty stops', () => {
    const long = Array.from({ length: 9 }, (_, index) => ({ address: `${index} ${'Very Long Street Name '.repeat(30)}Charlotte, NC` }))
    const parts = googleMapsRouteParts([{ address: '  ' }, ...long], { maxWaypoints: DESKTOP_WAYPOINT_LIMIT })
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every(part => part.url.length <= 2048)).toBe(true)
    expect(parts.flatMap(part => part.stops)).toHaveLength(9)
    expect(googleMapsRouteParts([])).toEqual([])
  })

  it('detects mobile browsers', () => {
    expect(isMobileBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true)
    expect(isMobileBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile')).toBe(true)
    expect(isMobileBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140')).toBe(false)
  })
})
