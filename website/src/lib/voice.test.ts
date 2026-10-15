import { describe, expect, it } from 'vitest'
import { DEFAULT_VOICE_SETTINGS, createClipCache, guessVoiceGender, pickDeviceVoice, sanitizeVoiceSettings, voiceCacheKey } from './voice'

describe('sanitizeVoiceSettings', () => {
  it('falls back to the defaults for missing or hostile input', () => {
    expect(sanitizeVoiceSettings(null)).toEqual(DEFAULT_VOICE_SETTINGS)
    expect(sanitizeVoiceSettings({ engine: 'robot', voice: 'x', rate: 'fast', volume: 99, muted: 'yes' })).toEqual({ ...DEFAULT_VOICE_SETTINGS, volume: 1 })
  })

  it('keeps valid choices and clamps speed and volume', () => {
    expect(sanitizeVoiceSettings({ engine: 'device', voice: 'en-US-Neural2-D', deviceVoice: 'Samantha', rate: 5, volume: 0, muted: true })).toEqual({
      engine: 'device',
      voice: 'en-US-Neural2-D',
      deviceVoice: 'Samantha',
      rate: 1.3,
      volume: 0.2,
      muted: true,
    })
  })
})

describe('device voice gender', () => {
  it('recognises common male and female device voices', () => {
    expect(guessVoiceGender('Samantha')).toBe('female')
    expect(guessVoiceGender('Microsoft Zira - English (United States)')).toBe('female')
    expect(guessVoiceGender('Google UK English Male')).toBe('male')
    expect(guessVoiceGender('Microsoft David Desktop')).toBe('male')
    expect(guessVoiceGender('Google US English')).toBe('female')
    expect(guessVoiceGender('Unnamed')).toBe('unknown')
  })

  it('prefers a US English voice of the wanted gender', () => {
    const voices = [
      { name: 'Daniel', lang: 'en-GB' },
      { name: 'Alex', lang: 'en-US' },
      { name: 'Samantha', lang: 'en-US' },
    ]
    expect(pickDeviceVoice(voices, 'male')).toBe('Alex')
    expect(pickDeviceVoice(voices, 'female')).toBe('Samantha')
    expect(pickDeviceVoice([{ name: 'Unnamed', lang: 'en-US' }], 'male')).toBe('')
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
