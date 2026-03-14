'use client'

import { FunnelStep } from '@/types/campaigns'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'

interface FunnelChartProps {
  data: FunnelStep[]
  loading?: boolean
}

const COLORS = ['#00B8A9', '#22c55e', '#a855f7', '#FF9800', '#ef4444']

export default function FunnelChart({ data, loading }: FunnelChartProps) {
  if (loading) {
    return (
      <div className="h-64 bg-gray-50 rounded-lg border border-gray-200 animate-pulse flex items-center justify-center">
        <span className="text-gray-300 text-sm">Loading funnel...</span>
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
        No funnel data available
      </div>
    )
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 16, bottom: 4 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
          <YAxis dataKey="stage" type="category" tick={{ fontSize: 12, fill: '#374151' }} tickLine={false} axisLine={false} width={90} />
          <Tooltip
            formatter={(value) => [Number(value ?? 0).toLocaleString(), 'Count']}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
