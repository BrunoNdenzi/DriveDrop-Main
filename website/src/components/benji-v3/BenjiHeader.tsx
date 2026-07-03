'use client'

/**
 * Benji V3 — Chat window header
 * Shows avatar, name, online indicator, minimize/close controls.
 */

import { Bot, Minus, X, RefreshCw } from 'lucide-react'

interface BenjiHeaderProps {
  onMinimize:   () => void
  onClose:      () => void
  onNewSession: () => void
}

export function BenjiHeader({ onMinimize, onClose, onNewSession }: BenjiHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
      {/* Left: avatar + name */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30">
            <Bot className="w-5 h-5 text-white" />
          </div>
          {/* Online dot */}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-indigo-600" />
        </div>

        <div>
          <p className="text-white font-semibold text-sm leading-none">Benji</p>
          <p className="text-blue-200 text-xs mt-0.5">DriveDrop AI</p>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onNewSession}
          title="New conversation"
          className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onMinimize}
          title="Minimize"
          className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          title="Close"
          className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
