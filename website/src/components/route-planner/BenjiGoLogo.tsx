// BenjiGo mark and wordmark. "dark" text is for light backgrounds, "light" text for dark ones.
export default function BenjiGoLogo({ tone = 'light', caption, className = '' }: { tone?: 'light' | 'dark'; caption?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/benjigo-mark.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0" />
      <div className="leading-tight">
        <p className="text-lg font-extrabold tracking-tight">
          <span className={tone === 'light' ? 'text-white' : 'text-[#0b1f44]'}>Benji</span>
          <span className="bg-gradient-to-r from-[#3b82f6] to-[#14d8b6] bg-clip-text text-transparent">Go</span>
        </p>
        <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${tone === 'light' ? 'text-[#a9b9d6]' : 'text-[#5a6b8c]'}`}>{caption ?? 'Route Planner'}</p>
      </div>
    </div>
  )
}
