import { describe, expect, it } from 'vitest'
import { adaptiveZoom, buildRoutePlan, createOffRouteDetector, headingFromMovement, offsetAhead, progressAlong, projectOnPath, smoothHeading } from './route-geometry'
import { distanceMeters } from './route-sim'

// Two legs heading east along the equator, about 1.1 km each.
const plan = buildRoutePlan([
  { durationSeconds: 120, steps: [{ points: [{ lat: 0, lng: 0 }, { lat: 0, lng: 0.005 }] }, { points: [{ lat: 0, lng: 0.005 }, { lat: 0, lng: 0.01 }] }] },
  { durationSeconds: 60, steps: [{ points: [{ lat: 0, lng: 0.01 }, { lat: 0, lng: 0.02 }] }] },
])

describe('projectOnPath', () => {
  it('reports zero distance on the path and the distance travelled along it', () => {
    const projection = projectOnPath(plan, { lat: 0, lng: 0.005 })!
    expect(projection.distanceFromPath).toBeLessThan(1)
    expect(projection.alongMeters).toBeCloseTo(556, -1)
  })

  it('measures how far a point is from the road', () => {
    const projection = projectOnPath(plan, { lat: 0.001, lng: 0.004 })!
    expect(projection.distanceFromPath).toBeCloseTo(111, -1)
    expect(distanceMeters(projection.snapped, { lat: 0, lng: 0.004 })).toBeLessThan(2)
  })

  it('finds the path again after a long jump outside the search window', () => {
    const projection = projectOnPath(plan, { lat: 0, lng: 0.019 }, 0, 1)!
    expect(projection.distanceFromPath).toBeLessThan(1)
    expect(projection.alongMeters).toBeCloseTo(2113, -1)
  })

  it('returns null when there is no path', () => {
    expect(projectOnPath(buildRoutePlan([]), { lat: 0, lng: 0 })).toBeNull()
  })
})

describe('progressAlong', () => {
  it('scales remaining time by how much of the current leg is left', () => {
    const halfway = progressAlong(plan, plan.legEnds[0]! / 2)
    expect(halfway.legIndex).toBe(0)
    expect(halfway.remainingSeconds).toBeCloseTo(60 + 60, 0)
    expect(halfway.remainingMeters).toBeCloseTo(plan.total - plan.legEnds[0]! / 2, 0)
  })

  it('tracks the step and the distance to the next maneuver', () => {
    const firstStep = progressAlong(plan, 100)
    expect(firstStep.stepIndex).toBe(0)
    expect(firstStep.metersToStepEnd).toBeCloseTo(456, -1)
    expect(progressAlong(plan, 700).stepIndex).toBe(1)
  })

  it('moves to the next leg once a stop is reached and clamps the ends', () => {
    expect(progressAlong(plan, plan.legEnds[0]! + 10).legIndex).toBe(1)
    const done = progressAlong(plan, plan.total + 500)
    expect(done.remainingMeters).toBe(0)
    expect(done.remainingSeconds).toBe(0)
  })
})

describe('adaptiveZoom', () => {
  it('zooms in when slow and out on the highway', () => {
    expect(adaptiveZoom({ speedMps: 2, metersToManeuver: null })).toBe(18)
    expect(adaptiveZoom({ speedMps: 30, metersToManeuver: null })).toBe(15)
  })

  it('zooms in as a turn approaches, within limits', () => {
    expect(adaptiveZoom({ speedMps: 15, metersToManeuver: 300 })).toBe(17)
    expect(adaptiveZoom({ speedMps: 15, metersToManeuver: 80 })).toBe(18)
    expect(adaptiveZoom({ speedMps: 2, metersToManeuver: 50 })).toBe(19)
  })
})

describe('createOffRouteDetector', () => {
  it('ignores a single noisy fix', () => {
    const detector = createOffRouteDetector()
    expect(detector.update({ distanceFromPath: 90, accuracyMeters: 10, at: 0 })).toBe('suspect')
    expect(detector.update({ distanceFromPath: 5, accuracyMeters: 10, at: 1000 })).toBe('on')
  })

  it('confirms a sustained departure', () => {
    const detector = createOffRouteDetector()
    expect(detector.update({ distanceFromPath: 70, accuracyMeters: 8, at: 0 })).toBe('suspect')
    expect(detector.update({ distanceFromPath: 75, accuracyMeters: 8, at: 3000 })).toBe('suspect')
    expect(detector.update({ distanceFromPath: 80, accuracyMeters: 8, at: 6500 })).toBe('off')
  })

  it('reacts quickly to a clear, large departure', () => {
    const detector = createOffRouteDetector()
    detector.update({ distanceFromPath: 400, accuracyMeters: 8, at: 0 })
    expect(detector.update({ distanceFromPath: 450, accuracyMeters: 8, at: 1000 })).toBe('off')
  })

  it('widens the zone when GPS accuracy is poor', () => {
    const detector = createOffRouteDetector()
    expect(detector.update({ distanceFromPath: 90, accuracyMeters: 80, at: 0 })).toBe('on')
  })
})

describe('headings', () => {
  it('uses movement only when it is clearly more than jitter', () => {
    expect(headingFromMovement({ lat: 0, lng: 0 }, { lat: 0, lng: 0.0001 })).toBeCloseTo(90, 0)
    expect(headingFromMovement({ lat: 0, lng: 0 }, { lat: 0, lng: 0.00001 })).toBeNull()
    expect(headingFromMovement(null, { lat: 0, lng: 0 })).toBeNull()
  })

  it('offsets a point ahead along a heading', () => {
    const ahead = offsetAhead({ lat: 35, lng: -80 }, 0, 111)
    expect(ahead.lat).toBeCloseTo(35.001, 4)
    expect(ahead.lng).toBeCloseTo(-80, 6)
  })

  it('smooths a heading along the shortest turn, including across north', () => {
    expect(smoothHeading(null, 90)).toBe(90)
    expect(smoothHeading(80, 100, 0.5)).toBeCloseTo(90, 5)
    expect(smoothHeading(350, 10, 0.5)).toBeCloseTo(0, 5)
    expect(smoothHeading(10, 350, 0.5)).toBeCloseTo(0, 5)
    expect(smoothHeading(0, -90, 1)).toBeCloseTo(270, 5)
  })
})
