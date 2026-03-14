'use client'

import { GeoDataPoint } from '@/types/campaigns'

interface GeoMapProps {
  data: GeoDataPoint[]
  loading?: boolean
}

export default function GeoMap({ data, loading }: GeoMapProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data.length) {
    return <div className="py-8 text-center text-gray-400 text-sm">No geographic data available</div>
  }

  const max = Math.max(...data.map(d => d.sent))

  return (
    <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
      {data.map((row, i) => {
        const pct = max > 0 ? (row.sent / max) * 100 : 0
        return (
          <div key={row.state} className="flex items-center gap-3 py-1">
            <span className="text-xs font-medium text-gray-500 w-6 text-right">{i + 1}</span>
            <span className="text-sm font-semibold text-gray-700 w-8">{row.state}</span>
            <div className="flex-1 relative h-5 bg-gray-100 rounded overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded transition-all duration-300"
                style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #00B8A9, #00d4c4)' }}
              />
            </div>
            <span className="text-xs text-gray-600 w-14 text-right">{row.sent.toLocaleString()} sent</span>
            {row.openRate !== undefined && (
              <span className="text-xs text-purple-600 w-14 text-right">{row.openRate.toFixed(1)}% open</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
