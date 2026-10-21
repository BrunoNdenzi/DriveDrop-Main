// Phones report heading and speed unreliably when barely moving, which is exactly when a driver reaches a stop.
export const HEADING_MIN_SPEED_MPS = 2.5

// Speed worked out from two fixes. A shift smaller than the GPS noise is the phone wobbling, not the car moving.
export function derivedSpeedMps(meters: number, seconds: number, accuracyMeters: number | null): number {
  if (seconds <= 0) return 0
  const noise = Math.max(8, accuracyMeters ?? 0)
  return meters < noise ? 0 : meters / seconds
}

// The marker coasts between fixes, but never past the end of the leg being driven (the next leg heads back out of the stop).
export function coastedAlong(along: number, aheadMeters: number, legEnd: number | undefined): number {
  const target = along + Math.max(0, aheadMeters)
  return legEnd === undefined ? target : Math.min(target, Math.max(along, legEnd))
}

// Within this distance of the stop the driver is parking, and the road line no longer describes where the car is.
export const ARRIVAL_APPROACH_METERS = 100
