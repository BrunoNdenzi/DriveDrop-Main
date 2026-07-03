/**
 * Benji V3 — Session hook
 *
 * Manages a stable sessionId (per browser tab, persisted in sessionStorage so
 * it survives React re-mounts within the same tab but starts fresh on a new tab).
 *
 * Also owns the send action so components stay thin.
 */

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { aiService } from '@/services/aiService'

export interface V3Message {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  timestamp: Date
  toolsUsed?: string[]
  isError?:  boolean
}

interface UseBenjiSessionReturn {
  messages:   V3Message[]
  isTyping:   boolean
  sessionId:  string
  sendMessage: (text: string) => Promise<void>
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

    const userMsg: V3Message = {
      id:        crypto.randomUUID(),
      role:      'user',
      content:   text.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)

    console.warn('[BENJI_V3_REQUEST]', {
      sessionId,
      msgLen: text.length,
      ts:     new Date().toISOString(),
    })

    try {
      const response = await aiService.benjiV3Chat(text.trim(), sessionId, userType)

      console.warn('[BENJI_V3_RESPONSE]', {
        sessionId,
        latencyMs: response.latencyMs,
        toolsUsed: response.toolsUsed,
        ts:        new Date().toISOString(),
      })

      const assistantMsg: V3Message = {
        id:        crypto.randomUUID(),
        role:      'assistant',
        content:   response.response,
        timestamp: new Date(),
        toolsUsed: response.toolsUsed.length > 0 ? response.toolsUsed : undefined,
      }

      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      const errorMsg: V3Message = {
        id:        crypto.randomUUID(),
        role:      'assistant',
        content:   "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date(),
        isError:   true,
      }
      setMessages(prev => [...prev, errorMsg])

      console.warn('[BENJI_V3_ERROR]', {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
        ts:    new Date().toISOString(),
      })
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
