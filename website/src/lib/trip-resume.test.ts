import { describe, expect, it } from 'vitest'
import { resumePosition } from './trip-resume'

describe('resumePosition', () => {
  const ids = ['start', 'p1', 'd1', 'p2', 'd2']

  it('continues at the first stop that is not finished', () => {
    expect(resumePosition(ids, ['start', 'p1', 'd1'], 4)).toEqual({ completedStops: [0, 1, 2], currentStopIndex: 3, currentLeg: 2, allDone: false })
  })

  it('treats the start as done even when the server never recorded it', () => {
    expect(resumePosition(ids, [], 4)).toEqual({ completedStops: [0], currentStopIndex: 1, currentLeg: 0, allDone: false })
  })

  it('resumes at the first unfinished stop when a later one was done out of order', () => {
    expect(resumePosition(ids, ['p1', 'p2'], 4).currentStopIndex).toBe(2)
  })

  it('reports a trip with nothing left', () => {
    const done = resumePosition(ids, ids, 4)
    expect(done.allDone).toBe(true)
    expect(done.currentStopIndex).toBe(4)
  })

  it('never points past the legs that were drawn', () => {
    expect(resumePosition(ids, ['start', 'p1', 'd1', 'p2'], 2).currentLeg).toBe(1)
  })
})
