import { describe, expect, it } from 'vitest'
import { DEFAULT_VOICE_SETTINGS, createClipCache, sanitizeVoiceSettings, voiceCacheKey } from './voice'

describe('sanitizeVoiceSettings', () => {
  it('falls back to the defaults for missing or hostile input', () => {
    expect(sanitizeVoiceSettings(null)).toEqual(DEFAULT_VOICE_SETTINGS)
    expect(sanitizeVoiceSettings({ engine: 'robot', voice: 'x', rate: 'fast', volume: 99 })).toEqual({ ...DEFAULT_VOICE_SETTINGS, volume: 1 })
  })

  it('keeps valid choices and clamps speed and volume', () => {
    expect(sanitizeVoiceSettings({ engine: 'device', voice: 'en-US-Neural2-D', deviceVoice: 'Samantha', rate: 5, volume: 0 })).toEqual({
      engine: 'device',
      voice: 'en-US-Neural2-D',
      deviceVoice: 'Samantha',
      rate: 1.3,
      volume: 0.2,
    })
  })
})

describe('createClipCache', () => {
  it('drops the least recently used clip and tells the owner to release it', () => {
    const released: string[] = []
    const cache = createClipCache<string>(2, value => released.push(value))
    cache.set('a', 'A')
    cache.set('b', 'B')
    expect(cache.get('a')).toBe('A')
    cache.set('c', 'C')
    expect(released).toEqual(['B'])
    expect(cache.get('b')).toBeUndefined()
    expect(cache.size).toBe(2)
  })

  it('keys a clip by voice, speed and wording', () => {
    expect(voiceCacheKey({ voice: 'v', rate: 1 }, 'Turn left')).toBe('v|1.00|Turn left')
    expect(voiceCacheKey({ voice: 'v', rate: 1.2 }, 'Turn left')).not.toBe(voiceCacheKey({ voice: 'v', rate: 1 }, 'Turn left'))
  })
})
