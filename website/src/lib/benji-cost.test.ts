import { describe, expect, it } from 'vitest'
import { emptyCost, formatUsd, summarizeCost, TTS_USD_PER_MILLION_CHARS } from './benji-cost'

describe('summarizeCost', () => {
  it('adds the thinking cost to the voice cost', () => {
    const summary = summarizeCost({ ...emptyCost('2026-10-16'), questions: 3, llmUsd: 0.002, ttsChars: 5000 })
    expect(summary.ttsUsd).toBeCloseTo((5000 / 1_000_000) * TTS_USD_PER_MILLION_CHARS)
    expect(summary.totalUsd).toBeCloseTo(0.002 + summary.ttsUsd)
  })

  it('starts at zero', () => {
    expect(summarizeCost(emptyCost('2026-10-16')).totalUsd).toBe(0)
  })
})

describe('formatUsd', () => {
  it('keeps tiny amounts readable', () => {
    expect(formatUsd(0)).toBe('$0.00')
    expect(formatUsd(0.0042)).toBe('$0.0042')
    expect(formatUsd(1.236)).toBe('$1.24')
  })
})
