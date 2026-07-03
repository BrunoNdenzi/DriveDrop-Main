'use client'

/**
 * Benji V3 — Typing indicator
 * Three-dot breathing animation while Benji is generating a response.
 */

export function TypingIndicator() {
  return (
    <div className="flex items-end gap-1 px-4 py-3">
      <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <span
          className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
          style={{ animationDelay: '0ms', animationDuration: '1.2s' }}
        />
        <span
          className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
          style={{ animationDelay: '200ms', animationDuration: '1.2s' }}
        />
        <span
          className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
          style={{ animationDelay: '400ms', animationDuration: '1.2s' }}
        />
      </div>
    </div>
  )
}
