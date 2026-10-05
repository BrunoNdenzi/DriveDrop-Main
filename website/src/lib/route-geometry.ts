import { bearingDegrees, distanceMeters, type LatLngPoint, type SimPath } from './route-sim'

export interface RoutePlan extends SimPath {
  // Seconds Google expects each leg to take, in traffic.
  legDurations: number[]
  // Distance along the whole path at which each step of each leg ends.
  stepEnds: number[][]
}

export interface PlanLeg {
  durationSeconds: number
  steps: Array<{ points: LatLngPoint[] }>
}

export interface PathProjection {
  index: number
  distanceFromPath: number
  alongMeters: number
  snapped: LatLngPoint
}

const METERS_PER_DEGREE = 111_195

export function buildRoutePlan(legs: PlanLeg[]): RoutePlan {
  const points: LatLngPoint[] = []
  const legOf: number[] = []
  const cumulative: number[] = []
  const legEnds: number[] = []
  const stepEnds: number[][] = []
  const legDurations: number[] = []
  let total = 0

  legs.forEach((leg, legIndex) => {
    const ends: number[] = []
    for (const step of leg.steps) {
      for (const point of step.points) {
        const previous = points[points.length - 1]
        if (previous && previous.lat === point.lat && previous.lng === point.lng) continue
        if (previous) total += distanceMeters(previous, point)
        points.push(point)
        legOf.push(legIndex)
        cumulative.push(total)
      }
      ends.push(total)
    }
    stepEnds.push(ends)
    legEnds.push(total)
    legDurations.push(leg.durationSeconds)
  })

  return { points, legOf, cumulative, legEnds, total, legDurations, stepEnds }
}

function scan(path: SimPath, point: LatLngPoint, from: number, to: number): PathProjection | null {
  const cosLat = Math.cos((point.lat * Math.PI) / 180)
  let best: PathProjection | null = null

  for (let i = from; i < to; i++) {
    const a = path.points[i]!
    const b = path.points[i + 1]!
    const bx = (b.lng - a.lng) * cosLat * METERS_PER_DEGREE
    const by = (b.lat - a.lat) * METERS_PER_DEGREE
    const px = (point.lng - a.lng) * cosLat * METERS_PER_DEGREE
    const py = (point.lat - a.lat) * METERS_PER_DEGREE
    const lengthSquared = bx * bx + by * by
    const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, (px * bx + py * by) / lengthSquared))
    const dx = px - t * bx
    const dy = py - t * by
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (!best || distance < best.distanceFromPath) {
      const segmentLength = path.cumulative[i + 1]! - path.cumulative[i]!
      best = {
        index: i,
        distanceFromPath: distance,
        alongMeters: path.cumulative[i]! + t * segmentLength,
        snapped: { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t },
      }
    }
  }
  return best
}

// Finds the closest point on the route, searching near the last known position first so long routes stay cheap.
export function projectOnPath(path: SimPath, point: LatLngPoint, hintIndex = 0, window = 300): PathProjection | null {
  const segments = path.points.length - 1
  if (segments < 1) return null

  const from = Math.max(0, hintIndex - 20)
  const to = Math.min(segments, hintIndex + window)
  const near = scan(path, point, from, to)
  if (near && near.distanceFromPath <= 150) return near
  return scan(path, point, 0, segments)
}

export function offsetAhead(point: LatLngPoint, headingDegrees: number, meters: number): LatLngPoint {
  const heading = (headingDegrees * Math.PI) / 180
  const dLat = (Math.cos(heading) * meters) / METERS_PER_DEGREE
  const dLng = (Math.sin(heading) * meters) / (METERS_PER_DEGREE * Math.max(0.01, Math.cos((point.lat * Math.PI) / 180)))
  return { lat: point.lat + dLat, lng: point.lng + dLng }
}

export interface RouteProgress {
  legIndex: number
  stepIndex: number
  remainingMeters: number
  remainingSeconds: number
  metersToStepEnd: number
  metersToLegEnd: number
}

export function progressAlong(plan: RoutePlan, along: number): RouteProgress {
  const clamped = Math.min(Math.max(along, 0), plan.total)
  let legIndex = plan.legEnds.findIndex(end => end > clamped + 0.5)
  if (legIndex === -1) legIndex = Math.max(0, plan.legEnds.length - 1)

  const legStart = legIndex === 0 ? 0 : plan.legEnds[legIndex - 1]!
  const legEnd = plan.legEnds[legIndex] ?? plan.total
  const legLength = Math.max(1, legEnd - legStart)
  const fraction = Math.min(1, Math.max(0, (legEnd - clamped) / legLength))

  let remainingSeconds = fraction * (plan.legDurations[legIndex] ?? 0)
  for (let i = legIndex + 1; i < plan.legDurations.length; i++) remainingSeconds += plan.legDurations[i] ?? 0

  const ends = plan.stepEnds[legIndex] ?? []
  let stepIndex = ends.findIndex(end => end > clamped + 0.5)
  if (stepIndex === -1) stepIndex = Math.max(0, ends.length - 1)

  return {
    legIndex,
    stepIndex,
    remainingMeters: Math.max(0, plan.total - clamped),
    remainingSeconds,
    metersToStepEnd: Math.max(0, (ends[stepIndex] ?? legEnd) - clamped),
    metersToLegEnd: Math.max(0, legEnd - clamped),
  }
}

// Picks a map zoom a driver can read: closer when slow or about to turn, wider on the highway.
export function adaptiveZoom({ speedMps, metersToManeuver }: { speedMps: number; metersToManeuver: number | null }): number {
  let zoom = speedMps < 5 ? 18 : speedMps < 12 ? 17 : speedMps < 22 ? 16 : 15
  if (metersToManeuver !== null) {
    if (metersToManeuver < 400) zoom += 1
    if (metersToManeuver < 120) zoom += 1
  }
  return Math.min(19, Math.max(14, zoom))
}

export interface OffRouteOptions {
  minThresholdMeters?: number
  accuracyFactor?: number
  confirmFixes?: number
  confirmMs?: number
  farFactor?: number
}

export type OffRouteState = 'on' | 'suspect' | 'off'

// A single bad fix never triggers a re-route; it takes several in a row, or a large clear departure.
export function createOffRouteDetector({ minThresholdMeters = 45, accuracyFactor = 1.5, confirmFixes = 3, confirmMs = 6000, farFactor = 3 }: OffRouteOptions = {}) {
  let streak = 0
  let streakStartedAt = 0

  return {
    update({ distanceFromPath, accuracyMeters, at }: { distanceFromPath: number; accuracyMeters: number | null; at: number }): OffRouteState {
      const threshold = Math.max(minThresholdMeters, (accuracyMeters ?? 0) * accuracyFactor)
      if (distanceFromPath <= threshold) {
        streak = 0
        return 'on'
      }
      if (streak === 0) streakStartedAt = at
      streak += 1
      if (distanceFromPath > threshold * farFactor && streak >= 2) return 'off'
      if (streak >= confirmFixes && at - streakStartedAt >= confirmMs) return 'off'
      return 'suspect'
    },
    reset() {
      streak = 0
      streakStartedAt = 0
    },
  }
}

// Heading from movement when the device does not report one; ignores jitter while standing still.
export function headingFromMovement(previous: LatLngPoint | null, current: LatLngPoint, minMeters = 8): number | null {
  if (!previous || distanceMeters(previous, current) < minMeters) return null
  return bearingDegrees(previous, current)
}

// Eases toward a new heading along the shortest turn, so the map does not spin when a reading jumps across north.
export function smoothHeading(previous: number | null, next: number, gain = 0.4): number {
  if (previous === null) return ((next % 360) + 360) % 360
  const delta = ((((next - previous) % 360) + 540) % 360) - 180
  return (((previous + delta * gain) % 360) + 360) % 360
}
