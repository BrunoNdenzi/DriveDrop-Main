import { NATIVE_EVENT, nativeInfo, postToNative } from '@/lib/native-bridge'

interface RecognitionResult { readonly isFinal: boolean; readonly 0: { readonly transcript: string } }
interface RecognitionEvent { readonly resultIndex: number; readonly results: { readonly length: number; readonly [index: number]: RecognitionResult } }
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionConstructor = new () => Recognition

function constructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const scope = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null
}

export const speechRecognitionSupported = (): boolean => Boolean(nativeInfo()?.speech) || constructor() !== null

export type ListenEnd = 'silence' | 'denied' | 'error' | 'stopped'

export interface ListenerEvents {
  onInterim?: (text: string) => void
  onFinal: (text: string) => void
  onEnd: (reason: ListenEnd) => void
  // Names and places from the route; the app's recognizer listens for them first.
  hints?: () => string[]
}

// Inside the app the phone's own recognizer does the listening and reports back through the bridge.
function createNativeListener(events: ListenerEvents) {
  let handler: ((event: Event) => void) | null = null
  const detach = () => {
    if (handler) window.removeEventListener(NATIVE_EVENT, handler)
    handler = null
  }
  return {
    start() {
      detach()
      let heard = ''
      handler = event => {
        const detail = (event as CustomEvent<{ type?: string; text?: string; reason?: string }>).detail
        if (detail?.type === 'stt-interim' && detail.text) {
          heard = detail.text
          events.onInterim?.(heard)
        } else if (detail?.type === 'stt-final' && detail.text) {
          heard = detail.text
        } else if (detail?.type === 'stt-end') {
          detach()
          if (detail.reason === 'denied') events.onEnd('denied')
          else if (heard) events.onFinal(heard)
          else events.onEnd(detail.reason === 'error' ? 'error' : 'silence')
        }
      }
      window.addEventListener(NATIVE_EVENT, handler)
      postToNative({ type: 'stt-start', hints: events.hints?.() ?? [] })
    },
    stop() {
      detach()
      postToNative({ type: 'stt-stop' })
    },
  }
}

// One question at a time: listens until the driver pauses, then hands back what was said. Phones are happiest with a fresh recognizer each turn.
export function createListener(events: ListenerEvents) {
  if (nativeInfo()?.speech) return createNativeListener(events)
  let active: Recognition | null = null

  return {
    start() {
      const Recognition = constructor()
      if (!Recognition) {
        events.onEnd('error')
        return
      }
      active?.abort()
      const recognition = new Recognition()
      let heard = ''
      let failure: ListenEnd | null = null
      recognition.lang = 'en-US'
      recognition.continuous = false
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      recognition.onresult = event => {
        let text = ''
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index]
          if (result) text += result[0].transcript
        }
        heard = text.trim()
        const last = event.results[event.results.length - 1]
        if (!last?.isFinal) events.onInterim?.(heard)
      }
      recognition.onerror = event => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') failure = 'denied'
        else if (event.error === 'no-speech') failure = 'silence'
        else if (event.error === 'aborted') failure = 'stopped'
        else failure = 'error'
      }
      recognition.onend = () => {
        if (active === recognition) active = null
        if (failure === 'stopped') events.onEnd('stopped')
        else if (heard && failure !== 'denied') events.onFinal(heard)
        else events.onEnd(failure ?? 'silence')
      }
      active = recognition
      try {
        recognition.start()
      } catch {
        active = null
        events.onEnd('error')
      }
    },
    stop() {
      const current = active
      active = null
      if (current) {
        current.onend = null
        current.onerror = null
        current.onresult = null
        current.abort()
      }
    },
  }
}
