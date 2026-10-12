import { getSupabaseBrowserClient } from '@/lib/supabase-client'

export interface VoiceSettings {
  engine: 'natural' | 'device'
  voice: string
  deviceVoice: string
  rate: number
  volume: number
}

export const NATURAL_VOICE_OPTIONS = [
  { id: 'en-US-Neural2-F', label: 'Female, warm' },
  { id: 'en-US-Neural2-C', label: 'Female, clear' },
  { id: 'en-US-Neural2-D', label: 'Male, steady' },
  { id: 'en-US-Neural2-J', label: 'Male, calm' },
] as const

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = { engine: 'natural', voice: 'en-US-Neural2-F', deviceVoice: '', rate: 1, volume: 1 }

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

const SILENT_CLIP = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'

export function deviceVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return []
  return window.speechSynthesis.getVoices().filter(voice => voice.lang.toLowerCase().startsWith('en'))
}

export function createVoicePlayer(getSettings: () => VoiceSettings) {
  let audio: HTMLAudioElement | null = null
  let latest = 0
  let cloudOffUntil = 0
  const clips = createClipCache<string>(60, url => URL.revokeObjectURL(url))

  const speakOnDevice = (text: string, settings: VoiceSettings) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const utterance = new SpeechSynthesisUtterance(text)
    const chosen = deviceVoices().find(voice => voice.name === settings.deviceVoice)
    if (chosen) utterance.voice = chosen
    utterance.rate = settings.rate
    utterance.volume = settings.volume
    window.speechSynthesis.speak(utterance)
  }

  const stopAll = () => {
    audio?.pause()
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
  }

  const fetchClip = async (text: string, settings: VoiceSettings): Promise<string> => {
    const key = voiceCacheKey(settings, text)
    const cached = clips.get(key)
    if (cached) return cached

    const { data: { session } } = await getSupabaseBrowserClient().auth.getSession()
    if (!session?.access_token) throw new Error('Signed out')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3500)
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
        throw new Error(`Voice ${response.status}`)
      }
      const url = URL.createObjectURL(await response.blob())
      clips.set(key, url)
      return url
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    // Browsers only allow sound after a tap, so this runs from "Start navigation" to open the speaker for later announcements.
    unlock() {
      audio ??= new Audio()
      audio.src = SILENT_CLIP
      void audio.play().catch(() => undefined)
      window.speechSynthesis?.getVoices()
    },
    speak(text: string) {
      const settings = getSettings()
      const id = ++latest
      stopAll()
      if (settings.engine === 'device' || Date.now() < cloudOffUntil) {
        speakOnDevice(text, settings)
        return
      }
      void (async () => {
        try {
          const url = await fetchClip(text, settings)
          if (id !== latest) return
          audio ??= new Audio()
          audio.src = url
          audio.volume = settings.volume
          await audio.play()
        } catch {
          // A slow or failed natural voice must never mean a missed turn: say it with the device voice instead.
          if (id === latest) speakOnDevice(text, settings)
        }
      })()
    },
    stop() {
      latest += 1
      stopAll()
    },
  }
}
