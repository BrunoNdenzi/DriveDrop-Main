import { describe, expect, it } from 'vitest'
import { formatMinutes, formatMiles, toDirectionsResult, type MapsLike, type TruckRoute } from './truck-route'

class FakeLatLng {
  constructor(private readonly latitude: number, private readonly longitude: number) {}
  lat() { return this.latitude }
  lng() { return this.longitude }
}

class FakeBounds {
  constructor(readonly southWest: { lat: number; lng: number }, readonly northEast: { lat: number; lng: number }) {}
}

const maps: MapsLike = { LatLng: FakeLatLng, LatLngBounds: FakeBounds }

const route: TruckRoute = {
  bounds: { north: 35.3, south: 35.2, east: -80.7, west: -80.8 },
  legs: [
    {
      distanceMeters: 3218.68,
      durationSeconds: 420,
      steps: [
        { instruction: 'Head north on Main St & 5th', distanceMeters: 1600, durationSeconds: 200, path: [{ lat: 35.2, lng: -80.8 }, { lat: 35.25, lng: -80.75 }] },
        { instruction: 'Turn left onto Trade St', maneuver: 'turn-left', distanceMeters: 1600, durationSeconds: 220, path: [{ lat: 35.25, lng: -80.75 }, { lat: 35.3, lng: -80.7 }] },
      ],
    },
  ],
}

describe('truck route adapter', () => {
  it('gives the navigation screen the leg, step and path fields it reads', () => {
    const result = toDirectionsResult(route, maps)
    const leg = result.routes[0]!.legs[0]!
    expect(leg.distance!.text).toBe('2.0 mi')
    expect(leg.duration_in_traffic!.value).toBe(420)
    expect(leg.duration_in_traffic!.text).toBe('7 min')
    expect(leg.start_location!.lat()).toBe(35.2)
    expect(leg.end_location!.lng()).toBe(-80.7)
    expect(leg.steps).toHaveLength(2)
    expect(leg.steps[1]!.maneuver).toBe('turn-left')
    expect(leg.steps[0]!.maneuver).toBeUndefined()
    expect(leg.steps[0]!.path.map(point => [point.lat(), point.lng()])).toEqual([[35.2, -80.8], [35.25, -80.75]])
    expect(leg.steps[0]!.end_location.lat()).toBe(35.25)
  })

  it('escapes instruction text because the screen reads it as HTML', () => {
    const leg = toDirectionsResult(route, maps).routes[0]!.legs[0]!
    expect(leg.steps[0]!.instructions).toBe('Head north on Main St &amp; 5th')
  })

  it('builds map bounds from the route extent', () => {
    const bounds = toDirectionsResult(route, maps).routes[0]!.bounds as unknown as FakeBounds
    expect(bounds.southWest).toEqual({ lat: 35.2, lng: -80.8 })
    expect(bounds.northEast).toEqual({ lat: 35.3, lng: -80.7 })
  })

  it('formats distances and durations', () => {
    expect(formatMiles(1609.34)).toBe('1.0 mi')
    expect(formatMinutes(20)).toBe('1 min')
    expect(formatMinutes(3900)).toBe('1 hr 5 min')
  })
})
