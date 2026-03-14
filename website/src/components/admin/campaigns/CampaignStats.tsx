'use client'

import { CampaignStats as Stats } from '@/types/campaigns'
import { Users, Send, CheckCircle, Eye, MousePointer, XCircle, TrendingUp, BarChart3 } from 'lucide-react'

interface CampaignStatsProps {
  stats: Stats
  loading?: boolean
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={`flex-shrink-0 p-2 rounded-lg ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3 animate-pulse">
      <div className="w-9 h-9 bg-gray-200 rounded-lg flex-shrink-0" />
      <div className="flex-1">
        <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
        <div className="h-6 bg-gray-200 rounded w-14" />
      </div>
    </div>
  )
}

function pct(num: number, den: number) {
  if (!den) return '0.0%'
  return ((num / den) * 100).toFixed(1) + '%'
}

export default function CampaignStats({ stats, loading }: CampaignStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  const cards = [
    { icon: Users, label: 'Recipients', value: stats.totalRecipients.toLocaleString(), sub: 'in audience', color: 'bg-blue-100 text-blue-600' },
    { icon: Send, label: 'Sent', value: stats.sent.toLocaleString(), sub: pct(stats.sent, stats.totalRecipients) + ' of total', color: 'bg-teal-100 text-teal-600' },
    { icon: CheckCircle, label: 'Delivered', value: stats.delivered.toLocaleString(), sub: pct(stats.delivered, stats.sent) + ' delivery rate', color: 'bg-green-100 text-green-600' },
    { icon: Eye, label: 'Opened', value: stats.opened.toLocaleString(), sub: pct(stats.opened, stats.delivered) + ' open rate', color: 'bg-purple-100 text-purple-600' },
    { icon: MousePointer, label: 'Clicked', value: stats.clicked.toLocaleString(), sub: pct(stats.clicked, stats.opened) + ' of opens', color: 'bg-orange-100 text-orange-600' },
    { icon: XCircle, label: 'Bounced', value: stats.bounced.toLocaleString(), sub: pct(stats.bounced, stats.sent) + ' bounce rate', color: 'bg-red-100 text-red-600' },
    { icon: TrendingUp, label: 'Open Rate', value: pct(stats.opened, stats.delivered), sub: 'vs sent', color: 'bg-indigo-100 text-indigo-600' },
    { icon: BarChart3, label: 'Click Rate', value: pct(stats.clicked, stats.delivered), sub: 'clicks / delivered', color: 'bg-amber-100 text-amber-600' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(c => <StatCard key={c.label} {...c} />)}
    </div>
  )
}
