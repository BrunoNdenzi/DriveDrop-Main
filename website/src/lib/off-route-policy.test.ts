import { describe, expect, it } from 'vitest'
import {
  BREAK_MAX_MS,
  GRACE_MS,
  activeClosures,
  angleDifference,
  decideOffRoute,
  describeDetour,
  distanceToPolylineMeters,
  isConverging,
  isRerouteLoop,
  pickAvoidingRoute,
  rerouteCooldownMs,
  startsAgainstHeading,
} from './off-route-policy'

const base = { now: 100_000, startedAt: 100_000, distanceMeters: 120, speedMps: 4, breakUntil: null, reason: 'unspecified' as const }

describe('decideOffRoute', () => {
  it('gives a slow, short departure a moment, then rebuilds the route', () => {
    expect(decideOffRoute(base)).toBe('wait')
    expect(decideOffRoute({ ...base, now: base.startedAt + GRACE_MS - 1 })).toBe('wait')
    expect(decideOffRoute({ ...base, now: base.startedAt + GRACE_MS })).toBe('reroute')
  })

  it('rebuilds at once for a clear departure at speed or far from the road', () => {
    expect(decideOffRoute({ ...base, speedMps: 20 })).toBe('reroute')
    expect(decideOffRoute({ ...base, distanceMeters: 600 })).toBe('reroute')
    expect(decideOffRoute({ ...base, speedMps: null })).toBe('reroute')
  })

  it('rebuilds at once when the driver reports a closure', () => {
    expect(decideOffRoute({ ...base, reason: 'road_blocked' })).toBe('reroute')
  })

  it('holds during a personal stop until the break runs out', () => {
    const breakUntil = base.now + BREAK_MAX_MS
    expect(decideOffRoute({ ...base, speedMps: 25, distanceMeters: 5000, breakUntil, reason: 'personal_stop' })).toBe('hold')
    expect(decideOffRoute({ ...base, now: breakUntil, breakUntil, reason: 'personal_stop' })).toBe('reroute')
  })
})

describe('distanceToPolylineMeters', () => {
  const road = [{ lat: 0, lng: 0 }, { lat: 0, lng: 0.01 }]

  it('measures to the nearest point on the segment, not just the vertices', () => {
    expect(distanceToPolylineMeters(road, { lat: 0.0009, lng: 0.005 })).toBeCloseTo(100, -1)
    expect(distanceToPolylineMeters(road, { lat: 0, lng: 0.02 })).toBeGreaterThan(1000)
  })
})

describe('pickAvoidingRoute', () => {
  const main = [{ lat: 0, lng: 0 }, { lat: 0, lng: 0.02 }]
  const bypass = [{ lat: 0, lng: 0 }, { lat: 0.01, lng: 0.01 }, { lat: 0, lng: 0.02 }]
  const closure = { lat: 0, lng: 0.01 }

  it('skips routes through the closure and takes the first clear one', () => {
    expect(pickAvoidingRoute([main, bypass], [closure])).toBe(1)
    expect(pickAvoidingRoute([main, bypass], [])).toBe(0)
  })

  it('reports -1 when every option passes the closure', () => {
    expect(pickAvoidingRoute([main, main], [closure])).toBe(-1)
  })
})

describe('re-route loop protection', () => {
  it('waits while the driver is visibly closing in on the route', () => {
    const input = { now: 100_000, startedAt: 100_000, distanceMeters: 200, speedMps: 15, breakUntil: null, reason: 'unspecified' as const }
    expect(decideOffRoute(input)).toBe('reroute')
    expect(decideOffRoute({ ...input, converging: true })).toBe('wait')
    expect(decideOffRoute({ ...input, converging: true, now: input.startedAt + GRACE_MS * 3 })).toBe('reroute')
    expect(decideOffRoute({ ...input, converging: true, distanceMeters: 900 })).toBe('reroute')
  })

  it('detects steady approach but not a flat or growing distance', () => {
    expect(isConverging([300, 250, 200])).toBe(true)
    expect(isConverging([200, 200, 200])).toBe(false)
    expect(isConverging([200, 250, 300])).toBe(false)
    expect(isConverging([300, 200])).toBe(false)
  })

  it('doubles the wait for each recent automatic re-route, up to two minutes', () => {
    expect([0, 1, 2, 3, 4, 8].map(rerouteCooldownMs)).toEqual([10_000, 20_000, 40_000, 80_000, 120_000, 120_000])
  })

  it('calls it a loop after three re-routes in five minutes', () => {
    const now = 1_000_000
    expect(isRerouteLoop([now - 10_000, now - 60_000], now)).toBe(false)
    expect(isRerouteLoop([now - 10_000, now - 60_000, now - 120_000], now)).toBe(true)
    expect(isRerouteLoop([now - 10_000, now - 60_000, now - 6 * 60_000], now)).toBe(false)
  })
})

describe('heading bias', () => {
  it('measures the smaller angle between two bearings', () => {
    expect(angleDifference(350, 10)).toBe(20)
    expect(angleDifference(0, 180)).toBe(180)
  })

  it('flags a route that starts back the way the driver came', () => {
    const east = [{ lat: 0, lng: 0 }, { lat: 0, lng: 0.001 }]
    const west = [{ lat: 0, lng: 0 }, { lat: 0, lng: -0.001 }]
    expect(startsAgainstHeading(east, 90)).toBe(false)
    expect(startsAgainstHeading(west, 90)).toBe(true)
    expect(startsAgainstHeading([{ lat: 0, lng: 0 }], 90)).toBe(false)
  })
})

describe('closures and detour wording', () => {
  it('forgets closures after they expire', () => {
    const marks = [{ point: { lat: 1, lng: 1 }, until: 500 }, { point: { lat: 2, lng: 2 }, until: 50 }]
    expect(activeClosures(marks, 100)).toEqual([{ lat: 1, lng: 1 }])
  })

  it('describes the cost of a new route in minutes', () => {
    expect(describeDetour(1000 + 6 * 60, 1000)).toBe('adds about 6 min')
    expect(describeDetour(1000 - 4 * 60, 1000)).toBe('saves about 4 min')
    expect(describeDetour(1030, 1000)).toBe('about the same time as before')
  })
})
