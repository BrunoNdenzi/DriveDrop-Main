'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnalyticsOverview, LeaderboardEntry } from '@/types/campaigns'
import { getOverview, getLeaderboard } from '@/lib/api/analytics'
import LeaderboardTable from './LeaderboardTable'
import { Mail, Eye, MousePointer, Users, RefreshCw } from 'lucide-react'

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

function SkeletonStat() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 animate-pulse">
      <div className="w-10 h-10 bg-gray-200 rounded-xl flex-shrink-0" />
      <div className="flex-1">
        <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
        <div className="h-7 bg-gray-200 rounded w-16 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-24" />
      </div>
    </div>
  )
}

export default function OverviewDashboard() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, lb] = await Promise.all([getOverview(), getLeaderboard()])
      setOverview(ov)
      setLeaderboard(lb)
      setLastRefresh(new Date())
    } catch {
      // no-op
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load])

  const stats = overview ? [
    {
      icon: Mail,
      label: 'Total Sent',
      value: overview.sent.toLocaleString(),
      sub: `${overview.total} total campaigns`,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      icon: Eye,
      label: 'Open Rate',
      value: overview.openRate.toFixed(1) + '%',
      sub: `${overview.opened.toLocaleString()} total opens`,
      color: 'bg-teal-100 text-teal-600',
    },
    {
      icon: MousePointer,
      label: 'Click Rate',
      value: overview.clickRate.toFixed(1) + '%',
      sub: `${overview.clicked.toLocaleString()} total clicks`,
      color: 'bg-orange-100 text-orange-600',
    },
    {
      icon: Users,
      label: 'Delivered',
      value: overview.delivered.toLocaleString(),
      sub: `${overview.bounced} bounced`,
      color: 'bg-purple-100 text-purple-600',
    },
  ] : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Last updated {lastRefresh.toLocaleTimeString()} · auto-refreshes every 30s
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-[#00B8A9] hover:text-[#009e92] disabled:opacity-40"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading || !overview
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonStat key={i} />)
          : stats.map(s => <StatCard key={s.label} {...s} />)
        }
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Top Campaigns by Open Rate</h2>
        <LeaderboardTable entries={leaderboard} loading={loading} />
      </div>
    </div>
  )
}
