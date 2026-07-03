'use client'

/**
 * Benji V3 — Single message bubble
 *
 * User messages: right-aligned, blue bubble
 * Assistant messages: left-aligned, white bubble with subtle border
 * Error messages: left-aligned, soft red tint
 * Tool badge: small pill showing which logistics tools were used
 */

import { Bot } from 'lucide-react'
import type { V3Message } from './hooks/useBenjiSession'

interface MessageBubbleProps {
  message: V3Message
}

const TOOL_LABELS: Record<string, string> = {
  get_shipping_quote:     'Quoted',
  parse_shipment_details: 'Parsed',
  create_shipment:        'Booked',
  track_shipment:         'Tracked',
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-1">
        <div className="max-w-[75%] bg-blue-500 text-white rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed shadow-sm">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2 px-4 py-1">
      {/* Avatar */}
      <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-sm">
        <Bot className="w-4 h-4 text-white" />
      </div>

      <div className="flex flex-col gap-1 max-w-[78%]">
        {/* Bubble */}
        <div
          className={[
            'rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed shadow-sm',
            message.isError
              ? 'bg-red-50 border border-red-100 text-red-700'
              : 'bg-white border border-gray-100 text-gray-800',
          ].join(' ')}
        >
          {/* Render with line breaks preserved */}
          {message.content.split('\n').map((line, i) => (
            <span key={i}>
              {line}
              {i < message.content.split('\n').length - 1 && <br />}
            </span>
          ))}
          {/* Streaming cursor */}
          {message.isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 animate-pulse align-middle" />
          )}
        </div>

        {/* Tool badges */}
        {message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="flex flex-wrap gap-1 ml-1">
            {message.toolsUsed.map(tool => (
              <span
                key={tool}
                className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 rounded-full px-2 py-0.5 font-medium"
              >
                {TOOL_LABELS[tool] ?? tool}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
