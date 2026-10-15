'use client'

interface BenjiAvatarProps {
  speaking: boolean
  muted: boolean
  caption: string
  onOpen: () => void
}

// Benji on the map: his mouth moves while a direction is spoken, and what he says shows beside him.
export default function BenjiAvatar({ speaking, muted, caption, onOpen }: BenjiAvatarProps) {
  return (
    <div className="pointer-events-none flex items-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        aria-label={muted ? 'Benji is quiet. Open voice settings' : "Open Benji's voice settings"}
        className={`pointer-events-auto relative h-12 w-12 shrink-0 rounded-full bg-white shadow-lg ring-2 transition-shadow ${speaking ? 'ring-amber-400' : 'ring-white'} ${muted ? 'opacity-70' : ''}`}
      >
        <svg viewBox="0 0 64 64" className={`h-full w-full ${speaking ? 'benji-talking' : ''}`} aria-hidden="true">
          <line x1="32" y1="9" x2="32" y2="16" stroke="#173f40" strokeWidth="2.5" strokeLinecap="round" />
          <circle className="benji-antenna" cx="32" cy="7" r="3.5" fill="#f59e0b" />
          <rect x="4" y="30" width="5" height="12" rx="2.5" fill="#0f2c2d" />
          <rect x="55" y="30" width="5" height="12" rx="2.5" fill="#0f2c2d" />
          <rect x="8" y="16" width="48" height="42" rx="15" fill="#173f40" />
          <rect x="13" y="22" width="38" height="30" rx="11" fill="#d9f2ee" />
          {muted ? (
            <g fill="none" stroke="#173f40" strokeWidth="2.5" strokeLinecap="round">
              <path d="M20 35q3.5 3 7 0" />
              <path d="M37 35q3.5 3 7 0" />
              <path d="M27 45h10" />
            </g>
          ) : (
            <>
              <g className="benji-eyes" fill="#173f40">
                <circle cx="24" cy="35" r="3.6" />
                <circle cx="40" cy="35" r="3.6" />
              </g>
              <ellipse className="benji-mouth" cx="32" cy="45" rx="5.5" ry="2.2" fill="#173f40" />
            </>
          )}
        </svg>
      </button>
      {caption && (
        <p
          role="status"
          className="pointer-events-auto min-w-0 rounded-2xl rounded-bl-sm bg-white/95 px-3 py-2 text-xs font-medium leading-snug text-gray-900 shadow-lg"
          style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {caption}
        </p>
      )}
    </div>
  )
}
