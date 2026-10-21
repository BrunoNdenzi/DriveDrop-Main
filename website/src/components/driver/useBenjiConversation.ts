'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createListener, speechRecognitionSupported, type ListenEnd } from '@/lib/speech-recognition'
import { isNo, isYes, normalizeHeard } from '@/lib/speech-text'
import { earconDurationMs, type Earcon } from '@/lib/earcons'
import type { MetricEvent } from '@/lib/benji-metrics'
import type { SpeechSequence } from '@/lib/voice'

export type BenjiTalkState = 'off' | 'listening' | 'thinking' | 'speaking'

export interface BenjiTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface BenjiAnswer {
  reply: string
  // Something Benji can do in the app; the driver is asked first when `confirm` is set.
  action?: { type: string; confirm: boolean }
  // Every sentence of the reply already went through `onSentence`, so it must not be spoken again.
  streamed?: boolean
}

interface Options {
  ask: (message: string, history: BenjiTurn[], onSentence: (sentence: string) => void) => Promise<BenjiAnswer>
  say: (text: string) => void
  hush: () => void
  notify: (message: string) => void
  // Carries out an action and returns what Benji should say about it, or nothing to say his own line.
  runAction: (type: string) => string | undefined
  // Voices a reply a sentence at a time while the rest is still being written.
  beginSpeech?: () => SpeechSequence
  chime?: (kind: Earcon) => void
  onMetric?: (event: MetricEvent) => void
  // Words from today's route that help the recognizer.
  hints?: () => string[]
  // Lets the caller drop what the mic picked up from the phone's own speaker.
  ignore?: (heard: string) => boolean
  onFinished?: (summary: { turns: number }) => void
}

const MAX_SILENT_TURNS = 2
const HISTORY_TURNS = 6
const FILLER_AFTER_MS = 1800
const FILLERS = ['Let me check.', 'One sec.', 'Hmm, let me see.', 'Give me a second.']
const GOODBYE = /^(ok(ay)?[, ]*)?(stop|that'?s (all|it)|never ?mind|no thanks?|thanks?( you)?( benji)?|bye( benji)?|goodbye)[.!]*$/i

// A back-and-forth with the driver: listen, think, speak, listen again, until they say they are done or go quiet.
export function useBenjiConversation(options: Options) {
  const [state, setState] = useState<BenjiTalkState>('off')
  const [heard, setHeard] = useState('')
  const [supported, setSupported] = useState(false)
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => setSupported(speechRecognitionSupported()), [])

  const controller = useMemo(() => {
    let current: BenjiTalkState = 'off'
    let history: BenjiTurn[] = []
    let silentTurns = 0
    let turns = 0
    let expected = ''
    let endAfterSpeech = false
    let pendingAction: string | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let listenTimer: ReturnType<typeof setTimeout> | null = null
    let fillerTimer: ReturnType<typeof setTimeout> | null = null
    let fillerText: string | null = null
    let fillerCount = 0
    let streamCount = 0
    // How long this turn has taken so far, for the speed measurements.
    let heardAt = 0
    let measure: { thinkMs: number } | null = null

    const set = (next: BenjiTalkState) => {
      current = next
      setState(next)
    }
    const clearTimer = () => {
      if (timer) clearTimeout(timer)
      timer = null
    }
    const clearFiller = () => {
      if (fillerTimer) clearTimeout(fillerTimer)
      fillerTimer = null
    }
    // A function call, so TypeScript does not assume the state stayed the same across an await.
    const isOff = () => current === 'off'
    const metric = (event: MetricEvent) => optionsRef.current.onMetric?.(event)

    const listener = createListener({
      onInterim: text => setHeard(text),
      onFinal: text => void handleHeard(text),
      onEnd: reason => handleListenEnd(reason),
      hints: () => optionsRef.current.hints?.() ?? [],
    })

    function finish() {
      const spoke = turns
      clearTimer()
      clearFiller()
      if (listenTimer) clearTimeout(listenTimer)
      listener.stop()
      endAfterSpeech = false
      pendingAction = null
      fillerText = null
      measure = null
      history = []
      turns = 0
      silentTurns = 0
      set('off')
      setHeard('')
      if (spoke > 0) {
        optionsRef.current.chime?.('done')
        optionsRef.current.onFinished?.({ turns: spoke })
      }
    }

    function listen(withChime = false) {
      if (current === 'off') return
      setHeard('')
      set('listening')
      if (listenTimer) clearTimeout(listenTimer)
      if (withChime && optionsRef.current.chime) {
        optionsRef.current.chime('listen')
        // The recognizer starts after the chime, so it does not hear it.
        listenTimer = setTimeout(() => { if (current === 'listening') listener.start() }, earconDurationMs('listen') + 80)
      } else {
        listener.start()
      }
    }

    function speakReply(text: string, afterwards: 'listen' | 'finish') {
      set('speaking')
      expected = text
      endAfterSpeech = afterwards === 'finish'
      optionsRef.current.say(text)
      // A navigation prompt can cut the reply off, so do not wait for an end that will never come.
      clearTimer()
      timer = setTimeout(() => speechEnded(text, true), 4000 + text.length * 90)
    }

    function speechStarted(text: string) {
      if (!measure || text === fillerText) return
      const { thinkMs } = measure
      measure = null
      metric({ kind: 'turn', askMs: thinkMs, firstAudioMs: performance.now() - heardAt })
    }

    function speechEnded(text: string, timedOut = false) {
      if (fillerText && text === fillerText) {
        fillerText = null
        flushAfterFiller()
        return
      }
      if (current !== 'speaking' || (!timedOut && text !== expected)) return
      clearTimer()
      setTimeout(() => {
        if (current !== 'speaking') return
        if (endAfterSpeech) finish()
        else listen()
      }, 350)
    }

    // Replies that arrived while a filler phrase was still being said wait their turn.
    let heldSentences: string[] = []
    let heldAnswer: BenjiAnswer | null = null
    let sequence: SpeechSequence | null = null

    function flushAfterFiller() {
      const sentences = heldSentences
      heldSentences = []
      for (const sentence of sentences) addSentence(sentence)
      if (heldAnswer) {
        const answer = heldAnswer
        heldAnswer = null
        deliver(answer)
      }
    }

    function addSentence(sentence: string) {
      if (isOff()) return
      if (fillerText) {
        heldSentences.push(sentence)
        return
      }
      if (!sequence) {
        clearFiller()
        sequence = optionsRef.current.beginSpeech?.() ?? null
        measure = { thinkMs: performance.now() - heardAt }
        set('speaking')
      }
      sequence?.add(sentence)
    }

    function deliver(answer: BenjiAnswer) {
      if (isOff()) return
      clearFiller()
      if (answer.streamed && sequence) {
        const endText = `stream:${++streamCount}`
        expected = endText
        endAfterSpeech = false
        sequence.finish(endText)
        sequence = null
        set('speaking')
        clearTimer()
        timer = setTimeout(() => speechEnded(endText, true), 6000 + answer.reply.length * 90)
        return
      }
      if (!measure) measure = { thinkMs: performance.now() - heardAt }
      if (answer.action?.confirm) {
        pendingAction = answer.action.type
        speakReply(answer.reply, 'listen')
      } else if (answer.action) {
        speakReply(optionsRef.current.runAction(answer.action.type) ?? answer.reply, 'listen')
      } else {
        speakReply(answer.reply, 'listen')
      }
    }

    // Stops a reply that is still being spoken sentence by sentence.
    function dropStream() {
      sequence?.cancel()
      sequence = null
      heldSentences = []
      heldAnswer = null
    }

    async function handleHeard(raw: string) {
      if (current === 'off') return
      if (optionsRef.current.ignore?.(raw)) {
        listen()
        return
      }
      silentTurns = 0
      const text = normalizeHeard(raw)
      setHeard(text || raw)
      if (!text) {
        speakReply("I'm here. What's up?", 'listen')
        return
      }

      // A pending action waits for a yes or a no; anything else is a new question and drops it.
      if (pendingAction) {
        const action = pendingAction
        pendingAction = null
        if (isYes(text)) {
          metric({ kind: 'action', decision: 'confirmed' })
          speakReply(optionsRef.current.runAction(action) ?? 'Done.', 'listen')
          return
        }
        if (isNo(text)) {
          metric({ kind: 'action', decision: 'declined' })
          speakReply("No problem, I'll leave it.", 'listen')
          return
        }
      }
      if (GOODBYE.test(text)) {
        speakReply("Okay, I'm here if you need me.", 'finish')
        return
      }

      set('thinking')
      optionsRef.current.chime?.('heard')
      heardAt = performance.now()
      dropStream()
      // A slow answer gets a short spoken acknowledgement instead of dead air.
      clearFiller()
      fillerTimer = setTimeout(() => {
        if (current !== 'thinking') return
        fillerText = FILLERS[fillerCount++ % FILLERS.length]!
        optionsRef.current.say(fillerText)
        // If the end of the filler never reports back, do not hold the reply hostage.
        setTimeout(() => {
          if (fillerText) {
            fillerText = null
            flushAfterFiller()
          }
        }, 2500)
      }, FILLER_AFTER_MS)

      try {
        const answer = await optionsRef.current.ask(text, history, addSentence)
        if (isOff()) return
        clearFiller()
        history = [...history, { role: 'user' as const, content: text }, { role: 'assistant' as const, content: answer.reply }].slice(-HISTORY_TURNS)
        turns += 1
        if (fillerText) {
          heldAnswer = answer
          return
        }
        deliver(answer)
      } catch {
        if (isOff()) return
        clearFiller()
        dropStream()
        metric({ kind: 'error' })
        optionsRef.current.chime?.('error')
        speakReply("Sorry, I couldn't work that out. Try again in a moment.", 'finish')
      }
    }

    function handleListenEnd(reason: ListenEnd) {
      if (current !== 'listening' || reason === 'stopped') return
      if (reason === 'denied') {
        optionsRef.current.chime?.('error')
        optionsRef.current.notify('Allow the microphone to talk with Benji.')
        finish()
        return
      }
      metric({ kind: 'silent' })
      silentTurns += 1
      if (silentTurns >= MAX_SILENT_TURNS) {
        optionsRef.current.notify('Benji stopped listening. Tap the mic when you want to talk.')
        finish()
        return
      }
      listen()
    }

    return {
      // Tap once to start, tap while Benji speaks to cut in, tap while he listens to end.
      toggle() {
        if (current === 'off') {
          if (!speechRecognitionSupported()) {
            optionsRef.current.notify('Talking to Benji needs Chrome or Samsung Internet on this phone.')
            return
          }
          history = []
          silentTurns = 0
          turns = 0
          pendingAction = null
          current = 'listening'
          listen(true)
        } else if (current === 'speaking') {
          clearTimer()
          dropStream()
          optionsRef.current.hush()
          endAfterSpeech = false
          listen()
        } else {
          finish()
        }
      },
      stop: finish,
      speechEnded,
      speechStarted,
      dispose() {
        clearTimer()
        clearFiller()
        if (listenTimer) clearTimeout(listenTimer)
        listener.stop()
      },
    }
  }, [])

  useEffect(() => () => controller.dispose(), [controller])

  return { state, heard, supported, toggle: controller.toggle, stop: controller.stop, speechEnded: controller.speechEnded, speechStarted: controller.speechStarted }
}
