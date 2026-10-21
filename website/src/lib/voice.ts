import { getSupabaseBrowserClient } from '@/lib/supabase-client'

export interface VoiceSettings {
  engine: 'natural' | 'device'
  voice: string
  deviceVoice: string
  rate: number
  volume: number
  muted: boolean
}

export const NATURAL_VOICE_OPTIONS = [
  { id: 'en-US-Neural2-F', label: 'Female, warm' },
  { id: 'en-US-Neural2-C', label: 'Female, clear' },
  { id: 'en-US-Neural2-D', label: 'Male, steady' },
  { id: 'en-US-Neural2-J', label: 'Male, calm' },
] as const

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = { engine: 'natural', voice: 'en-US-Neural2-F', deviceVoice: '', rate: 1, volume: 1, muted: false }

const STORAGE_KEY = 'planner-voice-settings'
const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

export function sanitizeVoiceSettings(raw: unknown): VoiceSettings {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const voice = NATURAL_VOICE_OPTIONS.some(option => option.id === input['voice']) ? String(input['voice']) : DEFAULT_VOICE_SETTINGS.voice
  return {
    engine: input['engine'] === 'device' ? 'device' : 'natural',
    voice,
    deviceVoice: typeof input['deviceVoice'] === 'string' ? input['deviceVoice'].slice(0, 120) : '',
    rate: clamp(input['rate'], 0.8, 1.3, 1),
    volume: clamp(input['volume'], 0.2, 1, 1),
    muted: input['muted'] === true,
  }
}

export function loadVoiceSettings(): VoiceSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return sanitizeVoiceSettings(stored ? JSON.parse(stored) : null)
  } catch {
    return DEFAULT_VOICE_SETTINGS
  }
}

export function saveVoiceSettings(settings: VoiceSettings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch { /* storage unavailable */ }
}

export const voiceCacheKey = (settings: Pick<VoiceSettings, 'voice' | 'rate'>, text: string) => `${settings.voice}|${settings.rate.toFixed(2)}|${text}`

// Keeps recent clips so a repeated phrase is never fetched (or paid for) twice; the oldest is dropped first.
export function createClipCache<T>(max: number, onEvict?: (value: T) => void) {
  const items = new Map<string, T>()
  return {
    get(key: string): T | undefined {
      const value = items.get(key)
      if (value === undefined) return undefined
      items.delete(key)
      items.set(key, value)
      return value
    },
    set(key: string, value: T) {
      items.delete(key)
      items.set(key, value)
      while (items.size > max) {
        const oldest = items.keys().next().value as string
        onEvict?.(items.get(oldest)!)
        items.delete(oldest)
      }
    },
    get size() { return items.size },
  }
}

export type VoiceGender = 'female' | 'male' | 'unknown'

const FEMALE_VOICES = new Set(['samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'allison', 'ava', 'susan', 'zira', 'hazel', 'aria', 'jenny', 'emma', 'michelle', 'linda', 'heather', 'catherine', 'serena', 'kate', 'nicky', 'veena', 'joanna', 'salli', 'kendra', 'kimberly', 'ivy', 'female'])
const MALE_VOICES = new Set(['alex', 'daniel', 'fred', 'tom', 'aaron', 'david', 'mark', 'guy', 'ryan', 'george', 'james', 'richard', 'oliver', 'arthur', 'rishi', 'gordon', 'eric', 'christopher', 'roger', 'brandon', 'joey', 'matthew', 'male'])

// Devices do not say whether a voice is male or female, so this goes by the well-known voice names.
export function guessVoiceGender(name: string): VoiceGender {
  const words = name.toLowerCase().split(/[^a-z]+/).filter(Boolean)
  if (words.includes('female') || words.some(word => FEMALE_VOICES.has(word))) return 'female'
  if (words.includes('male') || words.some(word => MALE_VOICES.has(word))) return 'male'
  // Android's default English voice has no name of its own and is a female voice.
  return /google (us|uk) english$/i.test(name.trim()) ? 'female' : 'unknown'
}

export function pickDeviceVoice(voices: Array<{ name: string; lang: string }>, gender: Exclude<VoiceGender, 'unknown'>): string {
  const matching = voices.filter(voice => guessVoiceGender(voice.name) === gender)
  return (matching.find(voice => /^en-us/i.test(voice.lang)) ?? matching[0])?.name ?? ''
}

export type NaturalVoiceState = 'unknown' | 'ready' | 'unavailable'

export interface VoiceEvents {
  onSpeaking?: (speaking: boolean, text: string) => void
  // A phrase finished (or failed) by itself; being cut off by a newer phrase does not count.
  onEnd?: (text: string) => void
  // Characters sent to the paid natural voice, for the cost meter.
  onCloudChars?: (chars: number) => void
  onNaturalState?: (state: NaturalVoiceState) => void
}

const SILENT_CLIP = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'

// One speaker for the whole page: a phone only lets an audio element play after a tap on that same element.
let sharedAudio: HTMLAudioElement | null = null
const speaker = (): HTMLAudioElement => (sharedAudio ??= new Audio())

// Runs inside a tap (Start navigation) so later announcements are allowed to make sound.
export function unlockVoiceOutput(): void {
  if (typeof window === 'undefined') return
  const audio = speaker()
  audio.src = SILENT_CLIP
  void audio.play().catch(() => undefined)
  const synth = window.speechSynthesis
  if (synth) {
    synth.getVoices()
    // Phones also need a real (silent) utterance from a tap before the device voice will speak.
    const warmUp = new SpeechSynthesisUtterance(' ')
    warmUp.volume = 0
    synth.speak(warmUp)
  }
}

export function deviceVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return []
  return window.speechSynthesis.getVoices().filter(voice => voice.lang.toLowerCase().startsWith('en'))
}

export function createVoicePlayer(getSettings: () => VoiceSettings, events: VoiceEvents = {}) {
  let latest = 0
  let cloudOffUntil = 0
  let naturalState: NaturalVoiceState = 'unknown'
  const clips = createClipCache<string>(60, url => URL.revokeObjectURL(url))

  const setNatural = (state: NaturalVoiceState) => {
    if (state === naturalState) return
    naturalState = state
    events.onNaturalState?.(state)
  }

  const speakOnDevice = (text: string, settings: VoiceSettings, id: number) => {
    const synth = typeof window === 'undefined' ? undefined : window.speechSynthesis
    if (!synth) {
      events.onSpeaking?.(false, text)
      events.onEnd?.(text)
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    const chosen = deviceVoices().find(voice => voice.name === settings.deviceVoice)
    if (chosen) utterance.voice = chosen
    utterance.lang = chosen?.lang ?? 'en-US'
    utterance.rate = settings.rate
    utterance.volume = settings.volume
    utterance.onstart = () => { if (id === latest) events.onSpeaking?.(true, text) }
    utterance.onend = utterance.onerror = () => {
      if (id !== latest) return
      events.onSpeaking?.(false, text)
      events.onEnd?.(text)
    }
    synth.resume()
    // Android Chrome drops speech queued in the same instant as a cancel.
    window.setTimeout(() => { if (id === latest) synth.speak(utterance) }, 60)
  }

  const stopAll = () => {
    if (sharedAudio) {
      sharedAudio.onplaying = null
      sharedAudio.onended = null
      sharedAudio.onerror = null
      sharedAudio.pause()
    }
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
  }

  const fetchClip = async (text: string, settings: VoiceSettings): Promise<string> => {
    const key = voiceCacheKey(settings, text)
    const cached = clips.get(key)
    if (cached) return cached

    const { data: { session } } = await getSupabaseBrowserClient().auth.getSession()
    if (!session?.access_token) throw new Error('Signed out')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2500)
    try {
      const response = await fetch(`${API_BASE_URL}/standalone-route-planner/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ text, voice: settings.voice, rate: settings.rate }),
        signal: controller.signal,
      })
      if (!response.ok) {
        // Not set up on the server: stop asking this session. Busy or failing: pause for a minute.
        cloudOffUntil = response.status === 503 ? Number.POSITIVE_INFINITY : Date.now() + 60_000
        if (response.status === 503) setNatural('unavailable')
        throw new Error(`Voice ${response.status}`)
      }
      setNatural('ready')
      events.onCloudChars?.(text.length)
      const url = URL.createObjectURL(await response.blob())
      clips.set(key, url)
      return url
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    unlock: unlockVoiceOutput,
    get naturalState() { return naturalState },
    // Asks the server whether the natural voice is set up, so the settings can say so instead of silently falling back.
    async checkNatural(): Promise<NaturalVoiceState> {
      try {
        const { data: { session } } = await getSupabaseBrowserClient().auth.getSession()
        if (!session?.access_token) return naturalState
        const response = await fetch(`${API_BASE_URL}/standalone-route-planner/voice/status`, { headers: { Authorization: `Bearer ${session.access_token}` } })
        if (!response.ok) return naturalState
        const body = await response.json() as { data?: { natural?: boolean } }
        if (body.data?.natural) {
          cloudOffUntil = 0
          setNatural('ready')
        } else {
          cloudOffUntil = Number.POSITIVE_INFINITY
          setNatural('unavailable')
        }
      } catch {
        // Offline: leave the state as it was.
      }
      return naturalState
    },
    speak(text: string) {
      const settings = getSettings()
      const id = ++latest
      stopAll()
      if (settings.engine === 'device' || Date.now() < cloudOffUntil) {
        speakOnDevice(text, settings, id)
        return
      }
      void (async () => {
        try {
          const url = await fetchClip(text, settings)
          if (id !== latest) return
          const audio = speaker()
          audio.onplaying = () => { if (id === latest) events.onSpeaking?.(true, text) }
          audio.onended = audio.onerror = () => {
            if (id !== latest) return
            events.onSpeaking?.(false, text)
            events.onEnd?.(text)
          }
          audio.src = url
          audio.volume = settings.volume
          await audio.play()
        } catch {
          // A slow or failed natural voice must never mean a missed turn: say it with the device voice instead.
          if (id === latest) speakOnDevice(text, settings, id)
        }
      })()
    },
    stop() {
      latest += 1
      stopAll()
      events.onSpeaking?.(false, '')
    },
  }
}
