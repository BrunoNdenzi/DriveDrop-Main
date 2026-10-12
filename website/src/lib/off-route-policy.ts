import { bearingDegrees, distanceMeters, type LatLngPoint } from './route-sim'

export const GRACE_MS = 20_000
export const BREAK_MAX_MS = 30 * 60_000
const NEAR_METERS = 300
const SLOW_MPS = 8
const LOOP_WINDOW_MS = 5 * 60_000
const LOOP_LIMIT = 3

export type DeviationReason = 'unspecified' | 'road_blocked' | 'personal_stop' | 'traffic' | 'customer_request' | 'other'
export type OffRouteAction = 'wait' | 'reroute' | 'hold'

// A slow, short departure (pulling into a lot, a quick pass of a restaurant) gets a moment before the route is rebuilt;
// a clear departure at speed, a reported closure, or an expired break rebuilds it at once.
// A driver who is visibly closing in on the route again (going round a block) is left alone for a while longer.
export function decideOffRoute(input: {
  now: number
  startedAt: number
  distanceMeters: number
  speedMps: number | null
  breakUntil: number | null
  reason: DeviationReason
  converging?: boolean
}): OffRouteAction {
  if (input.breakUntil !== null) return input.now < input.breakUntil ? 'hold' : 'reroute'
  if (input.reason === 'road_blocked') return 'reroute'
  if (input.converging && input.distanceMeters < 500 && input.now - input.startedAt < 3 * GRACE_MS) return 'wait'
  const slow = input.speedMps !== null && input.speedMps < SLOW_MPS
  const near = input.distanceMeters < NEAR_METERS
  return slow && near && input.now - input.startedAt < GRACE_MS ? 'wait' : 'reroute'
}

// True when each recent distance is smaller than the one before it.
export function isConverging(recent: number[], minimumDropMeters = 15): boolean {
  if (recent.length < 3) return false
  const last = recent.slice(-3)
  return last[0]! - last[1]! >= minimumDropMeters / 2 && last[1]! - last[2]! >= minimumDropMeters / 2 && last[0]! - last[2]! >= minimumDropMeters
}

// Each automatic re-route in a short span doubles the wait before the next, so an ignored route can never loop every few seconds.
export function rerouteCooldownMs(recentReroutes: number): number {
  return Math.min(120_000, 10_000 * 2 ** Math.max(0, recentReroutes))
}

export function recentReroutes(times: number[], now: number): number[] {
  return times.filter(time => now - time < LOOP_WINDOW_MS)
}

export function isRerouteLoop(times: number[], now: number): boolean {
  return recentReroutes(times, now).length >= LOOP_LIMIT
}

export function angleDifference(a: number, b: number): number {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180)
}

// A route that begins by pointing the way the driver just came from would tell them to turn around on the spot.
export function startsAgainstHeading(path: LatLngPoint[], headingDegrees: number, thresholdDegrees = 120): boolean {
  if (path.length < 2) return false
  let target = path[1]!
  for (let i = 1; i < path.length; i++) {
    target = path[i]!
    if (distanceMeters(path[0]!, target) >= 25) break
  }
  if (distanceMeters(path[0]!, target) < 5) return false
  return angleDifference(bearingDegrees(path[0]!, target), headingDegrees) > thresholdDegrees
}

// Shortest distance from a point to a road polyline, using a flat approximation that is exact enough over a few hundred metres.
export function distanceToPolylineMeters(path: LatLngPoint[], point: LatLngPoint): number {
  if (path.length === 0) return Number.POSITIVE_INFINITY
  if (path.length === 1) return distanceMeters(path[0]!, point)
  const cosLat = Math.cos((point.lat * Math.PI) / 180)
  const metersPerDegree = 111_195
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    const bx = (b.lng - a.lng) * cosLat * metersPerDegree
    const by = (b.lat - a.lat) * metersPerDegree
    const px = (point.lng - a.lng) * cosLat * metersPerDegree
    const py = (point.lat - a.lat) * metersPerDegree
    const lengthSquared = bx * bx + by * by
    const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, (px * bx + py * by) / lengthSquared))
    best = Math.min(best, Math.hypot(px - t * bx, py - t * by))
  }
  return best
}

// The first candidate (they arrive fastest first) that stays clear of every reported closure, or -1 when none does.
export function pickAvoidingRoute(paths: LatLngPoint[][], blocked: LatLngPoint[], clearanceMeters = 60): number {
  return paths.findIndex(path => blocked.every(point => distanceToPolylineMeters(path, point) > clearanceMeters))
}

export interface ClosureMark {
  point: LatLngPoint
  until: number
}

export const CLOSURE_MS = 90 * 60_000

export function activeClosures(marks: ClosureMark[], now: number): LatLngPoint[] {
  return marks.filter(mark => mark.until > now).map(mark => mark.point)
}

export function describeDetour(newSeconds: number, previousSeconds: number): string {
  const minutes = Math.round((newSeconds - previousSeconds) / 60)
  if (Math.abs(minutes) < 2) return 'about the same time as before'
  return minutes > 0 ? `adds about ${minutes} min` : `saves about ${Math.abs(minutes)} min`
}
