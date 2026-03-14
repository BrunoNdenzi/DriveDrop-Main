'use client'

import { useCallback, useEffect, useState } from 'react'
import OverviewDashboard from '@/components/admin/analytics/OverviewDashboard'
import PerformanceChart from '@/components/admin/analytics/PerformanceChart'
import FunnelChart from '@/components/admin/analytics/FunnelChart'
import GeoMap from '@/components/admin/analytics/GeoMap'
import ExportButton from '@/components/admin/analytics/ExportButton'
import { getTimeline, getGeography, getFunnel } from '@/lib/api/analytics'
import { TimeSeriesPoint, GeoDataPoint, FunnelStep } from '@/types/campaigns'

export default function CampaignAnalyticsPage() {
  const [timeline, setTimeline] = useState<TimeSeriesPoint[]>([])
  const [geo, setGeo] = useState<GeoDataPoint[]>([])
  const [funnel, setFunnel] = useState<FunnelStep[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [t, g, f] = await Promise.all([getTimeline(), getGeography(), getFunnel()])
      setTimeline(t)
      setGeo(g)
      setFunnel(f)
    } catch {
      // no-op
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaign Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Platform-wide email performance metrics</p>
        </div>
        <ExportButton />
      </div>

      {/* Overview: stats cards + leaderboard */}
      <OverviewDashboard />

      {/* Performance Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Performance Over Time</h2>
        <PerformanceChart data={timeline} loading={loading} />
      </div>

      {/* Funnel + Geo side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Engagement Funnel</h2>
          <FunnelChart data={funnel} loading={loading} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Top States by Volume</h2>
          <GeoMap data={geo} loading={loading} />
        </div>
      </div>
    </div>
  )
}
