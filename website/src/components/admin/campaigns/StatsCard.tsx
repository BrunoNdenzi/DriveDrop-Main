'use client'

import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  description?: string
  trend?: number // positive = up, negative = down
  loading?: boolean
  accent?: 'teal' | 'orange' | 'green' | 'red' | 'purple' | 'blue'
}

const accentStyles: Record<string, string> = {
  teal: 'bg-teal-50 text-[#00B8A9]',
  orange: 'bg-orange-50 text-[#FF9800]',
  green: 'bg-green-50 text-green-600',
  red: 'bg-red-50 text-red-600',
  purple: 'bg-purple-50 text-purple-600',
  blue: 'bg-blue-50 text-blue-600',
}

export default function StatsCard({ title, value, icon: Icon, description, trend, loading, accent = 'teal' }: StatsCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-9 w-9 bg-gray-200 rounded-lg" />
        </div>
        <div className="h-7 bg-gray-200 rounded w-20 mb-1" />
        <div className="h-3 bg-gray-100 rounded w-32" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${accentStyles[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {(description || trend !== undefined) && (
        <div className="flex items-center gap-1 mt-1">
          {trend !== undefined && (
            <span className={`flex items-center text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {description && <p className="text-xs text-gray-400">{description}</p>}
        </div>
      )}
    </div>
  )
}
