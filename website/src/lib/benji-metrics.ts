const STORAGE_KEY = 'planner-benji-metrics'
const MAX_SAMPLES = 50

export type MetricEvent =
  | { kind: 'turn'; askMs: number; firstAudioMs: number }
  | { kind: 'silent' }
  | { kind: 'error' }
  | { kind: 'action'; decision: 'confirmed' | 'declined' }

export interface BenjiMetrics {
  samples: Array<{ askMs: number; firstAudioMs: number }>
  silent: number
  errors: number
  confirmed: number
  declined: number
}

export const emptyMetrics = (): BenjiMetrics => ({ samples: [], silent: 0, errors: 0, confirmed: 0, declined: 0 })

export function recordMetric(metrics: BenjiMetrics, event: MetricEvent): BenjiMetrics {
  switch (event.kind) {
    case 'turn':
      return { ...metrics, samples: [...metrics.samples, { askMs: Math.round(event.askMs), firstAudioMs: Math.round(event.firstAudioMs) }].slice(-MAX_SAMPLES) }
    case 'silent':
      return { ...metrics, silent: metrics.silent + 1 }
    case 'error':
      return { ...metrics, errors: metrics.errors + 1 }
    case 'action':
      return event.decision === 'confirmed' ? { ...metrics, confirmed: metrics.confirmed + 1 } : { ...metrics, declined: metrics.declined + 1 }
  }
}

const average = (values: number[]) => (values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length)

export function summarizeMetrics(metrics: BenjiMetrics) {
  const sorted = metrics.samples.map(sample => sample.firstAudioMs).sort((a, b) => a - b)
  return {
    replies: metrics.samples.length,
    avgThinkMs: average(metrics.samples.map(sample => sample.askMs)),
    avgFirstAudioMs: average(sorted),
    slowestTenthMs: sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))]!,
    silent: metrics.silent,
    errors: metrics.errors,
    confirmed: metrics.confirmed,
    declined: metrics.declined,
  }
}

export const formatSeconds = (ms: number): string => `${(ms / 1000).toFixed(1)} s`

export function loadMetrics(): BenjiMetrics {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<BenjiMetrics> | null
    if (!stored || !Array.isArray(stored.samples)) return emptyMetrics()
    return {
      samples: stored.samples.filter(sample => Number.isFinite(sample?.askMs) && Number.isFinite(sample?.firstAudioMs)).slice(-MAX_SAMPLES),
      silent: Number(stored.silent) || 0,
      errors: Number(stored.errors) || 0,
      confirmed: Number(stored.confirmed) || 0,
      declined: Number(stored.declined) || 0,
    }
  } catch {
    return emptyMetrics()
  }
}

export function saveMetrics(metrics: BenjiMetrics): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics)) } catch { /* storage unavailable */ }
}
