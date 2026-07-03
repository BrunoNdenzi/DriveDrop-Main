/**
 * Benji V3 â€” Session hook
 *
 * Manages a stable sessionId (per browser tab, persisted in sessionStorage so
 * it survives React re-mounts within the same tab but starts fresh on a new tab).
 *
 * Uses SSE streaming for progressive token rendering.
 * Falls back to non-streaming /chat if streaming fails.
 */

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { aiService } from '@/services/aiService'

export interface V3Message {
  id:         string
  role:       'user' | 'assistant'
  content:    string
  timestamp:  Date
  toolsUsed?: string[]
  isError?:   boolean
  isStreaming?: boolean   // true while token stream is in-flight
}

interface UseBenjiSessionReturn {
  messages:     V3Message[]
  isTyping:     boolean
  sessionId:    string
  sendMessage:  (text: string) => Promise<void>
  clearSession: () => void
}

const SESSION_STORAGE_KEY = 'benji_v3_session_id'

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return crypto.randomUUID()
  const existing = sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (existing) return existing
  const id = crypto.randomUUID()
  sessionStorage.setItem(SESSION_STORAGE_KEY, id)
  return id
}

export function useBenjiSession(userType?: 'client' | 'driver' | 'admin' | 'broker'): UseBenjiSessionReturn {
  const [messages, setMessages]   = useState<V3Message[]>([])
  const [isTyping, setIsTyping]   = useState(false)
  const sessionIdRef              = useRef<string>('')

  // Init sessionId once on mount
  useEffect(() => {
    sessionIdRef.current = getOrCreateSessionId()
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return

    const sessionId = sessionIdRef.current

    // Add user message immediately
    const userMsg: V3Message = {
      id:        crypto.randomUUID(),
      role:      'user',
      content:   text.trim(),
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)

    console.warn('[BENJI_V3_REQUEST]', { sessionId, msgLen: text.length, ts: new Date().toISOString() })

    // Add placeholder assistant message (shows typing indicator until first token)
    const assistantId = crypto.randomUUID()
    const assistantPlaceholder: V3Message = {
      id:          assistantId,
      role:        'assistant',
      content:     '',
      timestamp:   new Date(),
      isStreaming: true,
    }
    setMessages(prev => [...prev, assistantPlaceholder])

    let streamSucceeded = false

    try {
      // â”€â”€ Attempt streaming â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      await aiService.benjiV3ChatStream(
        text.trim(),
        sessionId,
        {
          onToken: (token) => {
            streamSucceeded = true
            setIsTyping(false)  // Hide typing indicator once first token arrives
            setMessages(prev => prev.map(m =>
              m.id === assistantId
                ? { ...m, content: m.content + token, isStreaming: true }
                : m,
            ))
          },
          onTool: (toolName) => {
            console.warn('[BENJI_V3_TOOL_CALLED]', { toolName, sessionId })
          },
          onEnd: (meta) => {
            console.warn('[BENJI_V3_STREAM_END]', { ...meta, sessionId })
            setMessages(prev => prev.map(m =>
              m.id === assistantId
                ? {
                    ...m,
                    isStreaming: false,
                    toolsUsed:  meta.toolsUsed.length > 0 ? meta.toolsUsed : undefined,
                  }
                : m,
            ))
          },
          onError: (err) => {
            console.warn('[BENJI_V3_STREAM_ERROR]', { err, sessionId })
          },
        },
        userType,
      )

      if (!streamSucceeded) {
        throw new Error('Stream produced no tokens')
      }

    } catch (_streamErr) {
      // â”€â”€ Fallback to non-streaming â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      console.warn('[BENJI_V3_STREAM_FALLBACK]', { sessionId, ts: new Date().toISOString() })
      try {
        const response = await aiService.benjiV3Chat(text.trim(), sessionId, userType)
        console.warn('[BENJI_V3_RESPONSE]', {
          sessionId, latencyMs: response.latencyMs, toolsUsed: response.toolsUsed,
        })
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? {
                ...m,
                content:     response.response,
                isStreaming: false,
                toolsUsed:   response.toolsUsed.length > 0 ? response.toolsUsed : undefined,
              }
            : m,
        ))
      } catch (fallbackErr) {
        console.warn('[BENJI_V3_ERROR]', {
          sessionId, error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
        })
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? {
                ...m,
                content:     "I'm having trouble connecting right now. Please try again in a moment.",
                isStreaming: false,
                isError:     true,
              }
            : m,
        ))
      }
    } finally {
      setIsTyping(false)
    }
  }, [isTyping, userType])

  const clearSession = useCallback(() => {
    const newId = crypto.randomUUID()
    sessionIdRef.current = newId
    sessionStorage.setItem(SESSION_STORAGE_KEY, newId)
    setMessages([])
  }, [])

  return {
    messages,
    isTyping,
    sessionId: sessionIdRef.current,
    sendMessage,
    clearSession,
  }
}
