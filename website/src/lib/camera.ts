import { bearingDegrees, positionAt, type LatLngPoint, type SimPath } from './route-sim'

export interface CameraState extends LatLngPoint {
  heading: number
  zoom: number
}

export interface CameraTimings {
  positionTauMs?: number
  headingTauMs?: number
  zoomTauMs?: number
}

const ease = (dtMs: number, tauMs: number) => 1 - Math.exp(-Math.max(0, dtMs) / tauMs)
const wrap = (degrees: number) => ((degrees % 360) + 360) % 360
const shortestTurn = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180

// Eases the camera toward its target each frame; heading takes the short way round and a far jump (re-plan) snaps.
export function stepCamera(current: CameraState, target: CameraState, dtMs: number, timings: CameraTimings = {}): CameraState {
  const { positionTauMs = 220, headingTauMs = 420, zoomTauMs = 700 } = timings
  const far = Math.abs(target.lat - current.lat) > 0.02 || Math.abs(target.lng - current.lng) > 0.02
  const p = far ? 1 : ease(dtMs, positionTauMs)
  const h = ease(dtMs, headingTauMs)
  const z = ease(dtMs, zoomTauMs)
  return {
    lat: current.lat + (target.lat - current.lat) * p,
    lng: current.lng + (target.lng - current.lng) * p,
    heading: wrap(current.heading + shortestTurn(current.heading, target.heading) * h),
    zoom: current.zoom + (target.zoom - current.zoom) * z,
  }
}

export function metersPerPixel(latitude: number, zoom: number): number {
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom
}

// Zooming in for a turn is immediate; zooming back out waits until the lower level has held, so speed wobble never pumps the map.
export function createZoomGovernor({ outDelayMs = 4000 }: { outDelayMs?: number } = {}) {
  let accepted: number | null = null
  let pending: { value: number; since: number } | null = null

  return {
    update(candidate: number, now: number): number {
      if (accepted === null || candidate > accepted) {
        accepted = candidate
        pending = null
        return accepted
      }
      if (candidate === accepted) {
        pending = null
        return accepted
      }
      if (!pending || pending.value !== candidate) pending = { value: candidate, since: now }
      if (now - pending.since >= outDelayMs) {
        accepted = candidate
        pending = null
      }
      return accepted
    },
    reset() {
      accepted = null
      pending = null
    },
  }
}

// Direction of the road a little ahead, which stays steady through the short segments of a curve.
export function routeHeadingAt(path: SimPath, along: number, lookMeters = 35): number | null {
  const here = positionAt(path, along)
  const ahead = positionAt(path, Math.min(path.total, along + lookMeters))
  if (!here || !ahead) return null
  if (ahead.lat === here.lat && ahead.lng === here.lng) return positionAt(path, Math.max(0, along - lookMeters)) ? bearingDegrees(positionAt(path, Math.max(0, along - lookMeters))!, here) : null
  return bearingDegrees(here, ahead)
}
