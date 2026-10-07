import { distanceMeters, type LatLngPoint } from './route-sim'

export const GRACE_MS = 20_000
export const BREAK_MAX_MS = 30 * 60_000
const NEAR_METERS = 300
const SLOW_MPS = 8

export type DeviationReason = 'unspecified' | 'road_blocked' | 'personal_stop' | 'traffic' | 'customer_request' | 'other'
export type OffRouteAction = 'wait' | 'reroute' | 'hold'

// A slow, short departure (pulling into a lot, a quick pass of a restaurant) gets a moment before the route is rebuilt;
// a clear departure at speed, a reported closure, or an expired break rebuilds it at once.
export function decideOffRoute(input: {
  now: number
  startedAt: number
  distanceMeters: number
  speedMps: number | null
  breakUntil: number | null
  reason: DeviationReason
}): OffRouteAction {
  if (input.breakUntil !== null) return input.now < input.breakUntil ? 'hold' : 'reroute'
  if (input.reason === 'road_blocked') return 'reroute'
  const slow = input.speedMps !== null && input.speedMps < SLOW_MPS
  const near = input.distanceMeters < NEAR_METERS
  return slow && near && input.now - input.startedAt < GRACE_MS ? 'wait' : 'reroute'
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
