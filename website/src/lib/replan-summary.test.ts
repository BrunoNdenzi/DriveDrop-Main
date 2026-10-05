import { describe, expect, it } from 'vitest'
import { describeReplan } from './replan-summary'

const stops = (...ids: string[]) => ids.map(id => ({ id }))

describe('describeReplan', () => {
  it('reports an unchanged order and an on-schedule finish', () => {
    const text = describeReplan(
      { stops: stops('start', 'a', 'b', 'c'), endTime: '2026-10-05T15:00:00Z' },
      { stops: stops('here', 'a', 'b', 'c'), endTime: '2026-10-05T15:01:00Z' },
    )
    expect(text).toContain('same order')
    expect(text).toContain('on schedule')
  })

  it('counts only stops that actually moved and compares against the old finish', () => {
    const text = describeReplan(
      { stops: stops('start', 'a', 'b', 'c', 'd'), endTime: '2026-10-05T15:00:00Z' },
      { stops: stops('here', 'a', 'c', 'b', 'd'), endTime: '2026-10-05T14:40:00Z' },
    )
    expect(text).toContain('2 stops moved')
    expect(text).toContain('20 min earlier than planned')
  })

  it('says a single move in the singular and reports lateness', () => {
    const text = describeReplan(
      { stops: stops('start', 'a', 'b'), endTime: '2026-10-05T15:00:00Z' },
      { stops: stops('b', 'a'), endTime: '2026-10-05T15:25:00Z' },
    )
    expect(text).toContain('2 stops moved')
    expect(text).toContain('25 min later than planned')
  })

  it('still reads well when no finish times are known', () => {
    expect(describeReplan({ stops: stops('a', 'b') }, { stops: stops('a', 'b') })).toBe('Re-planned from your position. Stops are in the same order.')
  })
})
