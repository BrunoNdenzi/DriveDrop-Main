import { describe, expect, it } from 'vitest'
import { OFFLINE_QUEUE_KEY, createPingGate, createTravelTracker, queueAction, readQueue, replayQueue } from './planner-sync'

function memoryStorage(initial?: string) {
  const data = new Map<string, string>(initial ? [[OFFLINE_QUEUE_KEY, initial]] : [])
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

const action = (path: string) => ({ path, method: 'PATCH', body: '{}', queuedAt: '2026-10-02T12:00:00.000Z' })

describe('offline queue', () => {
  it('queues in order and survives corrupt storage', () => {
    const storage = memoryStorage()
    queueAction(action('/a'), storage)
    queueAction(action('/b'), storage)
    expect(readQueue(storage).map(item => item.path)).toEqual(['/a', '/b'])
    expect(readQueue(memoryStorage('not json'))).toEqual([])
  })

  it('keeps only the actions that still fail', async () => {
    const storage = memoryStorage()
    queueAction(action('/ok'), storage)
    queueAction(action('/fails'), storage)

    const synced = await replayQueue(async item => {
      if (item.path === '/fails') throw new Error('offline')
    }, storage)

    expect(synced).toBe(1)
    expect(readQueue(storage).map(item => item.path)).toEqual(['/fails'])
  })

  it('does not lose actions queued while replaying', async () => {
    const storage = memoryStorage()
    queueAction(action('/first'), storage)

    await replayQueue(async () => queueAction(action('/during'), storage), storage)

    expect(readQueue(storage).map(item => item.path)).toEqual(['/during'])
  })
})

describe('ping gate', () => {
  const at = (seconds: number, lng = 0) => ({ lat: 0, lng, at: seconds * 1000 })

  it('sends first, then waits for the interval and for movement', () => {
    const gate = createPingGate()
    expect(gate.shouldSend(at(0))).toBe(true)
    expect(gate.shouldSend(at(5, 0.001))).toBe(false)
    expect(gate.shouldSend(at(10, 0.0001))).toBe(false)
    expect(gate.shouldSend(at(12, 0.001))).toBe(true)
  })

  it('sends a heartbeat when stationary', () => {
    const gate = createPingGate()
    gate.shouldSend(at(0))
    expect(gate.shouldSend(at(29))).toBe(false)
    expect(gate.shouldSend(at(30))).toBe(true)
  })
})

describe('travel tracker', () => {
  it('adds up real movement and ignores jitter', () => {
    const tracker = createTravelTracker()
    tracker.add({ lat: 0, lng: 0, at: 0 })
    tracker.add({ lat: 0, lng: 0.00001, at: 1000 })
    expect(tracker.miles).toBe(0)

    tracker.add({ lat: 0, lng: 0.01, at: 60_000 })
    expect(tracker.miles).toBeCloseTo(0.69, 1)
  })

  it('skips inaccurate fixes and impossible jumps', () => {
    const tracker = createTravelTracker()
    tracker.add({ lat: 0, lng: 0, at: 0 })
    tracker.add({ lat: 0, lng: 0.01, at: 1000, accuracyMeters: 500 })
    expect(tracker.miles).toBe(0)

    tracker.add({ lat: 0, lng: 1, at: 2000 })
    expect(tracker.miles).toBe(0)

    tracker.add({ lat: 0, lng: 1.01, at: 62_000 })
    expect(tracker.miles).toBeCloseTo(0.69, 1)
  })
})
