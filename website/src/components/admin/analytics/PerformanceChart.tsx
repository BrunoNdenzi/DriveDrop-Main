'use client'

import { TimeSeriesPoint } from '@/types/campaigns'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

interface PerformanceChartProps {
  data: TimeSeriesPoint[]
  loading?: boolean
}

function SkeletonChart() {
  return (
    <div className="h-80 bg-gray-50 rounded-lg border border-gray-200 animate-pulse flex items-center justify-center">
      <span className="text-gray-300 text-sm">Loading chart...</span>
    </div>
  )
}

export default function PerformanceChart({ data, loading }: PerformanceChartProps) {
  if (loading) return <SkeletonChart />

  const formatted = data.map(d => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="sent" stroke="#9CA3AF" strokeWidth={2} dot={false} name="Sent" />
          <Line type="monotone" dataKey="opens" stroke="#00B8A9" strokeWidth={2} dot={false} name="Opens" />
          <Line type="monotone" dataKey="clicks" stroke="#FF9800" strokeWidth={2} dot={false} name="Clicks" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
