import { describe, expect, it } from 'vitest'
import { emptyMetrics, formatSeconds, recordMetric, summarizeMetrics } from './benji-metrics'

describe('benji metrics', () => {
  it('averages how long replies took and finds the slow tail', () => {
    let metrics = emptyMetrics()
    for (const [askMs, firstAudioMs] of [[1000, 2000], [1200, 2400], [800, 1800], [1400, 5000]] as const) {
      metrics = recordMetric(metrics, { kind: 'turn', askMs, firstAudioMs })
    }
    const summary = summarizeMetrics(metrics)
    expect(summary.replies).toBe(4)
    expect(summary.avgThinkMs).toBe(1100)
    expect(summary.avgFirstAudioMs).toBe(2800)
    expect(summary.slowestTenthMs).toBe(5000)
  })

  it('counts missed words, failures and what happened to proposed actions', () => {
    let metrics = emptyMetrics()
    metrics = recordMetric(metrics, { kind: 'silent' })
    metrics = recordMetric(metrics, { kind: 'error' })
    metrics = recordMetric(metrics, { kind: 'action', decision: 'confirmed' })
    metrics = recordMetric(metrics, { kind: 'action', decision: 'declined' })
    metrics = recordMetric(metrics, { kind: 'action', decision: 'declined' })
    expect(summarizeMetrics(metrics)).toMatchObject({ silent: 1, errors: 1, confirmed: 1, declined: 2 })
  })

  it('keeps only the latest samples', () => {
    let metrics = emptyMetrics()
    for (let index = 0; index < 60; index += 1) metrics = recordMetric(metrics, { kind: 'turn', askMs: index, firstAudioMs: index })
    expect(metrics.samples).toHaveLength(50)
    expect(metrics.samples[0]!.askMs).toBe(10)
  })

  it('handles nothing recorded yet', () => {
    expect(summarizeMetrics(emptyMetrics()).avgFirstAudioMs).toBe(0)
    expect(formatSeconds(2340)).toBe('2.3 s')
  })
})
