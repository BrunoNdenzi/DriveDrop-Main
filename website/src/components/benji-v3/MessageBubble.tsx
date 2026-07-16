'use client'

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
  initiate_payment:       'Payment',
  get_terms:              'Terms',
  cancel_shipment:        'Cancelled',
  list_shipments:         'Loaded',
}

// ─── Content renderer (URLs → links, **bold**, line breaks) ──────────────────

function renderContent(content: string, isUser: boolean): React.ReactNode {
  const URL_RE  = /https?:\/\/[^\s<>"')\]]+/g
  const BOLD_RE = /\*\*(.+?)\*\*/g

  return content.split('\n').map((line, lineIdx, arr) => {
    const nodes: React.ReactNode[] = []
    let cursor = 0

    // Collect URL spans
    const urlSpans: { start: number; end: number; url: string }[] = []
    let m: RegExpExecArray | null
    URL_RE.lastIndex = 0
    while ((m = URL_RE.exec(line)) !== null) {
      urlSpans.push({ start: m.index, end: m.index + m[0].length, url: m[0] })
    }

    let seg = 0
    for (const { start, end, url } of urlSpans) {
      // Render text before URL (with bold)
      if (start > cursor) renderBold(line.slice(cursor, start), nodes, seg, isUser)
      // Render URL as link
      const label = url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 44)
      nodes.push(
        <a
          key={`url-${seg}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline break-all font-medium ${isUser ? 'text-blue-100 hover:text-white' : 'text-blue-500 hover:text-blue-700'}`}
        >
          {label}{url.replace(/^https?:\/\/(www\.)?/, '').length > 44 ? '…' : ''}
        </a>
      )
      cursor = end
      seg++
    }

    // Remaining text after last URL
    if (cursor < line.length) renderBold(line.slice(cursor), nodes, seg + 100, isUser)

    return (
      <span key={lineIdx}>
        {nodes.length > 0 ? nodes : line}
        {lineIdx < arr.length - 1 && <br />}
      </span>
    )
  })
}

function renderBold(text: string, out: React.ReactNode[], offset: number, isUser: boolean) {
  const BOLD_RE = /\*\*(.+?)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = BOLD_RE.exec(text)) !== null) {
    if (m.index > last) out.push(<span key={`${offset}-t${i}`}>{text.slice(last, m.index)}</span>)
    out.push(<strong key={`${offset}-b${i}`} className="font-semibold">{m[1]}</strong>)
    last = m.index + m[0].length
    i++
  }
  if (last < text.length) out.push(<span key={`${offset}-te`}>{text.slice(last)}</span>)
}

// ─── Component ────────────────────────────────────────────────────────────────

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
          {renderContent(message.content, false)}
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
