import { describe, expect, it } from 'vitest'
import { arrivalRadius, checkArrival, createArrivalWatcher, describeDistance } from './arrival-check'
import { arrowRotation, parseManeuver } from './maneuvers'

const stop = { lat: 35.2271, lng: -80.8431 }
const metersNorth = (meters: number) => ({ lat: stop.lat + meters / 111_195, lng: stop.lng })

describe('checkArrival', () => {
  it('verifies a driver inside the zone', () => {
    const check = checkArrival({ ...metersNorth(60), accuracyMeters: 10 }, stop, 150)
    expect(check.verdict).toBe('verified')
    expect(check.distanceMeters).toBeCloseTo(60, 0)
  })

  it('rejects a driver clearly outside the zone and reports how far', () => {
    const check = checkArrival({ ...metersNorth(900), accuracyMeters: 10 }, stop, 150)
    expect(check.verdict).toBe('outside')
    expect(check.distanceMeters).toBeCloseTo(900, 0)
  })

  it('gives a poor fix the benefit of its accuracy, but not unlimited', () => {
    expect(checkArrival({ ...metersNorth(220), accuracyMeters: 80 }, stop, 150).verdict).toBe('verified')
    expect(checkArrival({ ...metersNorth(400), accuracyMeters: 150 }, stop, 150).verdict).toBe('outside')
  })

  it('does not decide on a very inaccurate fix or without a fix or target', () => {
    expect(checkArrival({ ...metersNorth(10), accuracyMeters: 500 }, stop, 150).verdict).toBe('unreliable')
    expect(checkArrival(null, stop, 150).verdict).toBe('unreliable')
    expect(checkArrival({ ...stop }, null, 150).verdict).toBe('unknown_target')
  })

  it('uses wider zones for depots and fuel stops', () => {
    expect(arrivalRadius('delivery')).toBe(150)
    expect(arrivalRadius('fuel')).toBe(200)
    expect(arrivalRadius('current_location')).toBe(250)
  })
})

describe('describeDistance', () => {
  it('uses feet up close and miles farther out', () => {
    expect(describeDistance(60)).toBe('200 ft')
    expect(describeDistance(2414)).toBe('1.5 mi')
  })
})

describe('createArrivalWatcher', () => {
  it('suggests arrival only after a slow dwell inside the zone', () => {
    const watcher = createArrivalWatcher({ dwellMs: 8000 })
    expect(watcher.update({ inside: true, speedMps: 2, at: 0 })).toBe(false)
    expect(watcher.update({ inside: true, speedMps: 1, at: 9000 })).toBe(true)
  })

  it('does not trigger while driving past or after leaving the zone', () => {
    const watcher = createArrivalWatcher({ dwellMs: 8000 })
    watcher.update({ inside: true, speedMps: 12, at: 0 })
    expect(watcher.update({ inside: true, speedMps: 12, at: 9000 })).toBe(false)
    expect(watcher.update({ inside: false, speedMps: 1, at: 10000 })).toBe(false)
    expect(watcher.update({ inside: true, speedMps: 1, at: 11000 })).toBe(false)
  })
})

describe('parseManeuver', () => {
  it('reads Google maneuver codes', () => {
    expect(parseManeuver('turn-left')).toEqual({ glyph: 'turn', side: 'left' })
    expect(parseManeuver('turn-slight-right')).toEqual({ glyph: 'slight', side: 'right' })
    expect(parseManeuver('uturn-left')).toEqual({ glyph: 'uturn', side: 'left' })
    expect(parseManeuver('roundabout-right')).toEqual({ glyph: 'roundabout', side: 'right' })
    expect(parseManeuver('ramp-left')).toEqual({ glyph: 'ramp', side: 'left' })
    expect(parseManeuver('straight')).toEqual({ glyph: 'straight', side: null })
  })

  it('falls back to the wording when there is no maneuver code', () => {
    expect(parseManeuver(undefined, 'Turn right onto Main St').side).toBe('right')
    expect(parseManeuver(undefined, 'Make a U-turn').glyph).toBe('uturn')
    expect(parseManeuver(undefined, 'Destination will be on the left').glyph).toBe('arrive')
    expect(parseManeuver(undefined, 'Head north on Tryon St').glyph).toBe('straight')
  })

  it('rotates the arrow for each turn', () => {
    expect(arrowRotation({ glyph: 'turn', side: 'left' })).toBe(-90)
    expect(arrowRotation({ glyph: 'turn', side: 'right' })).toBe(90)
    expect(arrowRotation({ glyph: 'slight', side: 'left' })).toBe(-45)
    expect(arrowRotation({ glyph: 'uturn', side: 'left' })).toBe(180)
    expect(arrowRotation({ glyph: 'straight', side: null })).toBe(0)
  })
})
