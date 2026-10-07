import { describe, expect, it } from 'vitest'
import { createZoomGovernor, metersPerPixel, routeHeadingAt, stepCamera } from './camera'
import { buildSimPath } from './route-sim'

const camera = (lat: number, lng: number, heading: number, zoom: number) => ({ lat, lng, heading, zoom })

describe('stepCamera', () => {
  it('moves part of the way each frame and converges', () => {
    let state = camera(35, -80, 0, 16)
    const target = camera(35.001, -80, 90, 17)
    const first = stepCamera(state, target, 33)
    expect(first.lat).toBeGreaterThan(35)
    expect(first.lat).toBeLessThan(35.001)
    for (let i = 0; i < 120; i++) state = stepCamera(state, target, 33)
    expect(state.lat).toBeCloseTo(35.001, 5)
    expect(state.heading).toBeCloseTo(90, 1)
    expect(state.zoom).toBeCloseTo(17, 2)
  })

  it('turns the short way across north', () => {
    const next = stepCamera(camera(35, -80, 350, 16), camera(35, -80, 10, 16), 200)
    expect(next.heading > 350 || next.heading < 10).toBe(true)
  })

  it('snaps on a far jump such as a re-plan from another place', () => {
    const next = stepCamera(camera(35, -80, 0, 16), camera(36, -81, 0, 16), 16)
    expect(next.lat).toBe(36)
    expect(next.lng).toBe(-81)
  })
})

describe('metersPerPixel', () => {
  it('halves with each zoom level and shrinks away from the equator', () => {
    expect(metersPerPixel(0, 17)).toBeCloseTo(metersPerPixel(0, 16) / 2, 6)
    expect(metersPerPixel(60, 16)).toBeCloseTo(metersPerPixel(0, 16) / 2, 2)
  })
})

describe('createZoomGovernor', () => {
  it('zooms in at once but waits before zooming out', () => {
    const governor = createZoomGovernor({ outDelayMs: 4000 })
    expect(governor.update(16, 0)).toBe(16)
    expect(governor.update(18, 100)).toBe(18)
    expect(governor.update(16, 200)).toBe(18)
    expect(governor.update(16, 3000)).toBe(18)
    expect(governor.update(16, 4300)).toBe(16)
  })

  it('does not zoom out when the lower level keeps flickering back', () => {
    const governor = createZoomGovernor({ outDelayMs: 4000 })
    governor.update(17, 0)
    expect(governor.update(16, 1000)).toBe(17)
    expect(governor.update(17, 2000)).toBe(17)
    expect(governor.update(16, 3000)).toBe(17)
    expect(governor.update(16, 6000)).toBe(17)
    expect(governor.update(16, 7100)).toBe(16)
  })
})

describe('routeHeadingAt', () => {
  const path = buildSimPath([[{ lat: 0, lng: 0 }, { lat: 0, lng: 0.001 }, { lat: 0.001, lng: 0.002 }, { lat: 0.002, lng: 0.002 }]])

  it('looks ahead along the road instead of using only the current tiny segment', () => {
    expect(routeHeadingAt(path, 10)).toBeCloseTo(90, 0)
    const mid = routeHeadingAt(path, 100)!
    expect(mid).toBeGreaterThan(50)
    expect(mid).toBeLessThan(89)
  })

  it('keeps a sensible heading at the very end of the route', () => {
    expect(routeHeadingAt(path, path.total)).toBeCloseTo(0, 0)
  })
})
