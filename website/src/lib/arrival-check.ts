import { distanceMeters, type LatLngPoint } from './route-sim'

export type ArrivalVerdict = 'verified' | 'outside' | 'unreliable' | 'unknown_target'

export interface ArrivalCheck {
  verdict: ArrivalVerdict
  distanceMeters: number | null
  accuracyMeters: number | null
  radiusMeters: number
}

export interface DriverFixLike extends LatLngPoint {
  accuracyMeters?: number | null | undefined
}

// Road-snapped stop coordinates can sit a block from the real door, so the zone is generous.
export function arrivalRadius(type: string): number {
  if (type === 'current_location') return 250
  if (type === 'fuel' || type === 'rest') return 200
  return 150
}

const UNRELIABLE_ACCURACY_METERS = 200
const MAX_ACCURACY_CREDIT_METERS = 100

export function checkArrival(fix: DriverFixLike | null, target: LatLngPoint | null, radiusMeters: number): ArrivalCheck {
  const accuracy = fix?.accuracyMeters ?? null
  if (!target) return { verdict: 'unknown_target', distanceMeters: null, accuracyMeters: accuracy, radiusMeters }
  if (!fix) return { verdict: 'unreliable', distanceMeters: null, accuracyMeters: null, radiusMeters }

  const distance = distanceMeters(fix, target)
  if (accuracy !== null && accuracy > UNRELIABLE_ACCURACY_METERS) {
    return { verdict: 'unreliable', distanceMeters: distance, accuracyMeters: accuracy, radiusMeters }
  }
  // A poor fix may be off by its reported accuracy, so give the driver that much benefit.
  const credit = Math.min(accuracy ?? 0, MAX_ACCURACY_CREDIT_METERS)
  return {
    verdict: distance - credit <= radiusMeters ? 'verified' : 'outside',
    distanceMeters: distance,
    accuracyMeters: accuracy,
    radiusMeters,
  }
}

export function describeDistance(meters: number): string {
  const feet = meters * 3.28084
  if (feet < 1000) return `${Math.max(10, Math.round(feet / 10) * 10)} ft`
  return `${(meters / 1609.344).toFixed(1)} mi`
}

export interface OverrideReason {
  code: string
  label: string
}

export const OVERRIDE_REASONS: OverrideReason[] = [
  { code: 'customer_elsewhere', label: 'Customer asked to meet at a different spot' },
  { code: 'gate_or_access', label: 'Gate, building or access restriction' },
  { code: 'address_wrong', label: 'Address or pin is wrong' },
  { code: 'gps_inaccurate', label: 'My GPS is inaccurate here' },
  { code: 'other', label: 'Other' },
]

// Suggests "you have arrived" once the driver has been inside the zone and slow for a short while.
export function createArrivalWatcher({ dwellMs = 8000, maxSpeedMps = 3 }: { dwellMs?: number; maxSpeedMps?: number } = {}) {
  let enteredAt: number | null = null

  return {
    update({ inside, speedMps, at }: { inside: boolean; speedMps: number | null; at: number }): boolean {
      if (!inside) {
        enteredAt = null
        return false
      }
      if (enteredAt === null) enteredAt = at
      const slow = speedMps === null || speedMps <= maxSpeedMps
      return slow && at - enteredAt >= dwellMs
    },
    reset() {
      enteredAt = null
    },
  }
}
