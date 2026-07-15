'use client'

/**
 * Benji V3 — Main chat assistant widget
 *
 * Floating chat button → expandable chat window.
 * Replaces BenjiChat.tsx (V2) when migrated.
 *
 * Features:
 *   - Stable sessionId per tab (survives React re-mounts)
 *   - Full conversation history rendered in-component
 *   - Auto-scroll on new messages
 *   - Smooth typing indicator
 *   - Suggestion chips on welcome message
 *   - New conversation / minimize / close controls
 *   - Keyboard: Enter to send, Shift+Enter for newline
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Send, Sparkles, ImagePlus, Paperclip } from 'lucide-react'
import { BenjiHeader }    from './BenjiHeader'
import { MessageBubble }  from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import { useBenjiSession } from './hooks/useBenjiSession'

// ─── Suggestion chips ─────────────────────────────────────────────────────────

const SUGGESTIONS: Record<string, string[]> = {
  client: ['Get a shipping quote', 'Track my shipment', 'What vehicles do you ship?'],
  driver: ['Show me available loads', 'Optimize my route', 'Help with paperwork'],
  admin:  ['Show today\'s metrics', 'Assign a load', 'Support tickets'],
  broker: ['Upload bulk shipments', 'Match carriers', 'Revenue report'],
}

// ─── Welcome messages ────────────────────────────────────────────────────────

const WELCOME: Record<string, string> = {
  client: "Hi! I'm Benji, your DriveDrop shipping assistant. I can help you get quotes, book shipments, or track your vehicles. What can I help you with?",
  driver: "Hey! I'm Benji. Need help finding loads, optimizing your route, or anything else? I'm here.",
  admin:  "Hi! I'm Benji. Ask me about dispatching, analytics, support, or anything else on the platform.",
  broker: "Hello! I'm Benji. I can help with bulk uploads, carrier matching, or integration questions. What do you need?",
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BenjiAssistantProps {
  userType?: 'client' | 'driver' | 'admin' | 'broker'
  shipmentId?: string
  userId?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BenjiAssistant({ userType = 'client', shipmentId, userId }: BenjiAssistantProps) {
  const [isOpen,      setIsOpen]      = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [inputValue,  setInputValue]  = useState('')
  const [hasWelcome,  setHasWelcome]  = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const { messages, isTyping, sendMessage, clearSession } = useBenjiSession(userType, userId)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLTextAreaElement>(null)
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const prevTypingRef  = useRef(false)
  const suggestions    = SUGGESTIONS[userType] ?? SUGGESTIONS.client!
  const welcomeText    = WELCOME[userType] ?? WELCOME.client!

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, isMinimized])

  // Refocus input after Benji finishes responding
  useEffect(() => {
    if (prevTypingRef.current && !isTyping && isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
    prevTypingRef.current = isTyping
  }, [isTyping, isOpen, isMinimized])

  // Inject welcome message once when first opened
  useEffect(() => {
    if (isOpen && !hasWelcome && messages.length === 0) {
      setHasWelcome(true)
    }
  }, [isOpen, hasWelcome, messages.length])

  const handleSend = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || isTyping) return
    setInputValue('')
    await sendMessage(text)
  }, [inputValue, isTyping, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSuggestionClick = (s: string) => {
    setInputValue(s)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleNewSession = () => {
    clearSession()
    setHasWelcome(false)
  }

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image must be under 10 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      // Send as a message — Benji will call process_document automatically
      const caption = file.name ? `[Image: ${file.name}] ` : ''
      await sendMessage(`${caption}${dataUrl}`)
    }
    reader.readAsDataURL(file)
    // Reset so same file can be re-selected
    e.target.value = ''
  }, [sendMessage])

  return (
    <>
      {/* ── Floating Button ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center z-50 shadow-lg shadow-blue-500/30"
            aria-label="Open Benji assistant"
          >
            <Bot className="w-6 h-6 text-white" />
            <motion.div
              className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Chat Window ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 80, scale: 0.85 }}
            animate={{
              opacity: 1, y: 0, scale: 1,
              height: isMinimized ? '60px' : '580px',
            }}
            exit={{ opacity: 0, y: 80, scale: 0.85 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-6 right-6 w-[380px] bg-white rounded-3xl z-50 flex flex-col overflow-hidden shadow-2xl shadow-gray-900/15 border border-gray-100"
            style={{ maxHeight: '90vh' }}
          >
            {/* Header */}
            <BenjiHeader
              onMinimize={() => setIsMinimized(p => !p)}
              onClose={() => { setIsOpen(false); setIsMinimized(false) }}
              onNewSession={handleNewSession}
            />

            {/* Body — hidden when minimized */}
            {!isMinimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto py-3 space-y-0.5 bg-gray-50/50">

                  {/* Welcome bubble (always shown on first open) */}
                  {messages.length === 0 && hasWelcome && (
                    <div className="flex items-end gap-2 px-4 py-1">
                      <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-sm">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-gray-800 shadow-sm max-w-[78%] leading-relaxed">
                        {welcomeText}
                      </div>
                    </div>
                  )}

                  {/* Conversation history — skip empty streaming placeholder (show TypingIndicator instead) */}
                  {messages
                    .filter(msg => !(msg.role === 'assistant' && msg.isStreaming && msg.content.length === 0))
                    .map(msg => (
                      <MessageBubble key={msg.id} message={msg} />
                    ))}

                  {/* Typing indicator — shown while waiting for first token */}
                  {(isTyping || messages.some(m => m.role === 'assistant' && m.isStreaming && m.content.length === 0)) && (
                    <TypingIndicator />
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Suggestion chips (shown only before first user message) */}
                {messages.filter(m => m.role === 'user').length === 0 && (
                  <div className="flex flex-wrap gap-1.5 px-3 py-2 border-t border-gray-100 bg-white">
                    {suggestions.map(s => (
                      <button
                        key={s}
                        onClick={() => handleSuggestionClick(s)}
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100 rounded-full px-3 py-1.5 transition-colors font-medium"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <div className="px-3 py-3 border-t border-gray-100 bg-white">
                  {uploadError && (
                    <p className="text-xs text-red-500 mb-1 px-1">{uploadError}</p>
                  )}
                  <div className="flex items-end gap-1.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <button
                      onClick={() => { setUploadError(null); fileInputRef.current?.click() }}
                      disabled={isTyping}
                      title="Attach image or document"
                      className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-blue-500 disabled:opacity-40 transition-colors rounded-full hover:bg-blue-50"
                    >
                      <ImagePlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setUploadError(null)
                        if (fileInputRef.current) {
                          fileInputRef.current.setAttribute('capture', 'environment')
                          fileInputRef.current.click()
                          setTimeout(() => fileInputRef.current?.removeAttribute('capture'), 500)
                        }
                      }}
                      disabled={isTyping}
                      title="Scan document / take photo"
                      className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-blue-500 disabled:opacity-40 transition-colors rounded-full hover:bg-blue-50"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Message Benji…"
                      rows={1}
                      disabled={isTyping}
                      className="flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-blue-400 focus:bg-white transition-colors disabled:opacity-50 max-h-28 overflow-y-auto"
                      style={{ lineHeight: '1.5' }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!inputValue.trim() || isTyping}
                      className="w-9 h-9 flex-shrink-0 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                      aria-label="Send"
                    >
                      <Send className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
