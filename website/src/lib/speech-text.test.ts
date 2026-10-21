import { describe, expect, it } from 'vitest'
import { isNo, isYes, normalizeHeard, recognitionHints } from './speech-text'

describe('normalizeHeard', () => {
  it('fixes how Benji is usually misheard and drops the wake phrase', () => {
    expect(normalizeHeard('Hey Benny, how long until my next stop')).toBe('how long until my next stop')
    expect(normalizeHeard('ok Benji how far')).toBe('how far')
    expect(normalizeHeard('Benji, what is next?')).toBe('what is next?')
  })

  it('keeps an ordinary question as it was', () => {
    expect(normalizeHeard('  Can you re-plan the route  ')).toBe('Can you re-plan the route')
  })

  it('leaves nothing when only the wake phrase was said', () => {
    expect(normalizeHeard('Hey Benji')).toBe('')
  })
})

describe('yes and no answers', () => {
  it('recognises a confirmation', () => {
    for (const text of ['yes', 'Yeah do it', 'sure thing', 'go ahead', 'Okay']) expect(isYes(text)).toBe(true)
    expect(isNo('yes please')).toBe(false)
  })

  it('recognises a refusal', () => {
    for (const text of ['no', 'nope', "don't", 'not now', 'cancel that']) expect(isNo(text)).toBe(true)
    expect(isYes('no way')).toBe(false)
  })

  it('treats anything else as neither', () => {
    expect(isYes('how long until the next stop')).toBe(false)
    expect(isNo('how long until the next stop')).toBe(false)
  })
})

describe('recognitionHints', () => {
  it('adds street names, stop names and customers without duplicates or generic labels', () => {
    const hints = recognitionHints([
      { name: 'Start', address: '4309 Staffordshire Ln, Charlotte, NC' },
      { name: '2023 Toyota Camry pickup', address: '400 E M.L.K. Jr Blvd, Charlotte', customerName: 'Pat Moore' },
      { name: 'Stop 3', address: '400 E M.L.K. Jr Blvd, Charlotte' },
    ])
    expect(hints).toContain('Benji')
    expect(hints).toContain('Staffordshire Ln')
    expect(hints).toContain('2023 Toyota Camry pickup')
    expect(hints).toContain('Pat Moore')
    expect(hints).not.toContain('Start')
    expect(hints.filter(hint => hint === 'E M.L.K. Jr Blvd')).toHaveLength(1)
  })
})
