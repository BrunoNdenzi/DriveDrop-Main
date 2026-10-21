import { describe, expect, it } from 'vitest'
import { coastedAlong, derivedSpeedMps } from './gps-noise'

describe('derivedSpeedMps', () => {
  it('treats a shift inside the GPS noise as standing still', () => {
    expect(derivedSpeedMps(5, 1, 10)).toBe(0)
    expect(derivedSpeedMps(14, 1, 20)).toBe(0)
  })

  it('reports real movement', () => {
    expect(derivedSpeedMps(20, 2, 5)).toBe(10)
  })

  it('ignores an impossible time gap', () => {
    expect(derivedSpeedMps(50, 0, null)).toBe(0)
  })
})

describe('coastedAlong', () => {
  it('moves ahead along the leg', () => {
    expect(coastedAlong(100, 20, 500)).toBe(120)
  })

  it('stops at the end of the leg instead of running onto the next one', () => {
    expect(coastedAlong(490, 30, 500)).toBe(500)
    expect(coastedAlong(510, 30, 500)).toBe(510)
  })

  it('does nothing when the leg end is unknown and ignores a negative look-ahead', () => {
    expect(coastedAlong(100, 20, undefined)).toBe(120)
    expect(coastedAlong(100, -5, 500)).toBe(100)
  })
})
