'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createListener, speechRecognitionSupported, type ListenEnd } from '@/lib/speech-recognition'
import { isNo, isYes, normalizeHeard } from '@/lib/speech-text'

export type BenjiTalkState = 'off' | 'listening' | 'thinking' | 'speaking'

export interface BenjiTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface BenjiAnswer {
  reply: string
  // Something Benji can do in the app; the driver is asked first when `confirm` is set.
  action?: { type: string; confirm: boolean }
}

interface Options {
  ask: (message: string, history: BenjiTurn[]) => Promise<BenjiAnswer>
  say: (text: string) => void
  hush: () => void
  notify: (message: string) => void
  // Carries out an action and returns what Benji should say about it, or nothing to say his own line.
  runAction: (type: string) => string | undefined
  // Words from today's route that help the recognizer.
  hints?: () => string[]
  // Lets the caller drop what the mic picked up from the phone's own speaker.
  ignore?: (heard: string) => boolean
  onFinished?: (summary: { turns: number }) => void
}

const MAX_SILENT_TURNS = 2
const HISTORY_TURNS = 6
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

    const set = (next: BenjiTalkState) => {
      current = next
      setState(next)
    }
    const clearTimer = () => {
      if (timer) clearTimeout(timer)
      timer = null
    }
    // A function call, so TypeScript does not assume the state stayed the same across an await.
    const isOff = () => current === 'off'

    const listener = createListener({
      onInterim: text => setHeard(text),
      onFinal: text => void handleHeard(text),
      onEnd: reason => handleListenEnd(reason),
      hints: () => optionsRef.current.hints?.() ?? [],
    })

    function finish() {
      const spoke = turns
      clearTimer()
      listener.stop()
      endAfterSpeech = false
      pendingAction = null
      history = []
      turns = 0
      silentTurns = 0
      set('off')
      setHeard('')
      if (spoke > 0) optionsRef.current.onFinished?.({ turns: spoke })
    }

    function listen() {
      if (current === 'off') return
      setHeard('')
      set('listening')
      listener.start()
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

    function speechEnded(text: string, timedOut = false) {
      if (current !== 'speaking' || (!timedOut && text !== expected)) return
      clearTimer()
      setTimeout(() => {
        if (current !== 'speaking') return
        if (endAfterSpeech) finish()
        else listen()
      }, 350)
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
          speakReply(optionsRef.current.runAction(action) ?? 'Done.', 'listen')
          return
        }
        if (isNo(text)) {
          speakReply("No problem, I'll leave it.", 'listen')
          return
        }
      }
      if (GOODBYE.test(text)) {
        speakReply("Okay, I'm here if you need me.", 'finish')
        return
      }

      set('thinking')
      try {
        const answer = await optionsRef.current.ask(text, history)
        if (isOff()) return
        history = [...history, { role: 'user' as const, content: text }, { role: 'assistant' as const, content: answer.reply }].slice(-HISTORY_TURNS)
        turns += 1
        if (answer.action?.confirm) {
          pendingAction = answer.action.type
          speakReply(answer.reply, 'listen')
        } else if (answer.action) {
          speakReply(optionsRef.current.runAction(answer.action.type) ?? answer.reply, 'listen')
        } else {
          speakReply(answer.reply, 'listen')
        }
      } catch {
        if (isOff()) return
        speakReply("Sorry, I couldn't work that out. Try again in a moment.", 'finish')
      }
    }

    function handleListenEnd(reason: ListenEnd) {
      if (current !== 'listening' || reason === 'stopped') return
      if (reason === 'denied') {
        optionsRef.current.notify('Allow the microphone to talk with Benji.')
        finish()
        return
      }
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
          listen()
        } else if (current === 'speaking') {
          clearTimer()
          optionsRef.current.hush()
          endAfterSpeech = false
          listen()
        } else {
          finish()
        }
      },
      stop: finish,
      speechEnded,
      dispose() {
        clearTimer()
        listener.stop()
      },
    }
  }, [])

  useEffect(() => () => controller.dispose(), [controller])

  return { state, heard, supported, toggle: controller.toggle, stop: controller.stop, speechEnded: controller.speechEnded }
}
