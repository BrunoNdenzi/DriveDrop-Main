import { distanceMeters, type LatLngPoint } from './route-sim'

export const OFFLINE_QUEUE_KEY = 'drivedrop-planner-offline-actions'

export interface QueuedAction {
  path: string
  method: string
  body: string
  queuedAt: string
}

type QueueStorage = Pick<Storage, 'getItem' | 'setItem'>

export function readQueue(storage: QueueStorage = localStorage): QueuedAction[] {
  try {
    const parsed = JSON.parse(storage.getItem(OFFLINE_QUEUE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function queueAction(action: QueuedAction, storage: QueueStorage = localStorage): void {
  storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([...readQueue(storage), action]))
}

let replaying = false

// Sends queued actions in order; anything that still fails stays queued for the next attempt.
export async function replayQueue(send: (action: QueuedAction) => Promise<void>, storage: QueueStorage = localStorage): Promise<number> {
  if (replaying) return 0
  replaying = true
  try {
    const queued = readQueue(storage)
    const remaining: QueuedAction[] = []
    for (const action of queued) {
      try {
        await send(action)
      } catch {
        remaining.push(action)
      }
    }
    // Actions queued while this was running are kept.
    const added = readQueue(storage).slice(queued.length)
    storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([...remaining, ...added]))
    return queued.length - remaining.length
  } finally {
    replaying = false
  }
}

export interface TimedFix extends LatLngPoint {
  at: number
}

interface PingGateOptions {
  minIntervalMs?: number
  minMoveMeters?: number
  heartbeatMs?: number
}

// Sends a position at most every few seconds, but still sends a heartbeat when the driver is stopped.
export function createPingGate({ minIntervalMs = 10_000, minMoveMeters = 15, heartbeatMs = 30_000 }: PingGateOptions = {}) {
  let last: TimedFix | null = null

  return {
    shouldSend(fix: TimedFix): boolean {
      if (!last) {
        last = fix
        return true
      }
      const elapsed = fix.at - last.at
      if (elapsed < minIntervalMs) return false
      if (distanceMeters(last, fix) >= minMoveMeters || elapsed >= heartbeatMs) {
        last = fix
        return true
      }
      return false
    },
    reset() {
      last = null
    },
  }
}

const MAX_USABLE_ACCURACY_METERS = 100
const JITTER_METERS = 5
const MAX_PLAUSIBLE_METERS_PER_SECOND = 70

// Adds up real driven distance, ignoring poor fixes, standing-still jitter and GPS jumps.
export function createTravelTracker() {
  let last: TimedFix | null = null
  let meters = 0

  return {
    add(fix: TimedFix & { accuracyMeters?: number | null }): number {
      if (fix.accuracyMeters != null && fix.accuracyMeters > MAX_USABLE_ACCURACY_METERS) return meters
      if (!last) {
        last = fix
        return meters
      }
      const seconds = (fix.at - last.at) / 1000
      if (seconds <= 0) return meters
      const moved = distanceMeters(last, fix)
      if (moved < JITTER_METERS) return meters
      if (moved / seconds <= MAX_PLAUSIBLE_METERS_PER_SECOND) meters += moved
      last = fix
      return meters
    },
    get miles() {
      return meters / 1609.344
    },
  }
}
