import { describe, expect, it } from 'vitest'
import { bearingDegrees, buildSimPath, distanceMeters, positionAt } from './route-sim'

describe('route simulation path', () => {
  it('measures distance and bearing', () => {
    expect(distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111195, -2)
    expect(bearingDegrees({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90, 3)
    expect(bearingDegrees({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0, 3)
  })

  it('records where each leg ends and drops the duplicated stop point', () => {
    const path = buildSimPath([
      [{ lat: 0, lng: 0 }, { lat: 0, lng: 0.01 }],
      [{ lat: 0, lng: 0.01 }, { lat: 0, lng: 0.02 }],
    ])

    expect(path.points).toHaveLength(3)
    expect(path.legEnds[0]).toBeCloseTo(1112, -1)
    expect(path.legEnds[1]).toBeCloseTo(2224, -1)
    expect(path.total).toBe(path.legEnds[1])
  })

  it('interpolates along the path and reports the leg being driven', () => {
    const path = buildSimPath([
      [{ lat: 0, lng: 0 }, { lat: 0, lng: 0.01 }],
      [{ lat: 0, lng: 0.01 }, { lat: 0, lng: 0.02 }],
    ])

    const start = positionAt(path, 0)!
    expect(start.lng).toBe(0)
    expect(start.heading).toBeCloseTo(90, 3)
    expect(start.leg).toBe(0)

    const halfwayLeg1 = positionAt(path, (path.legEnds[0]! + path.legEnds[1]!) / 2)!
    expect(halfwayLeg1.lng).toBeCloseTo(0.015, 4)
    expect(halfwayLeg1.leg).toBe(1)
  })

  it('clamps beyond the ends of the route', () => {
    const path = buildSimPath([[{ lat: 0, lng: 0 }, { lat: 0, lng: 0.01 }]])

    expect(positionAt(path, -50)!.lng).toBe(0)
    expect(positionAt(path, path.total + 500)!.lng).toBeCloseTo(0.01, 6)
    expect(positionAt(buildSimPath([]), 10)).toBeNull()
  })
})
