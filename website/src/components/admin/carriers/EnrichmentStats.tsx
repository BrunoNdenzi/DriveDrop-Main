'use client'

import { useCallback, useEffect, useState } from 'react'
import { getCarrierStats, type CarrierStats } from '@/lib/api/carriers'
import { Loader2, RefreshCw, Mail, CheckCircle, Users } from 'lucide-react'

export default function EnrichmentStats() {
  const [stats, setStats] = useState<CarrierStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const s = await getCarrierStats()
      setStats(s)
    } catch {
      // no-op
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const carrierStats = stats?.byType?.['carrier']

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Enrichment Progress</h3>
        <button
          onClick={load}
          disabled={loading}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
          title="Refresh stats"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !stats ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-[#00B8A9]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={<Users className="h-5 w-5 text-blue-500" />}
            label="Total Carriers in DB"
            value={carrierStats?.total ?? 0}
            bg="bg-blue-50"
          />
          <StatCard
            icon={<Mail className="h-5 w-5 text-[#00B8A9]" />}
            label="With Email Found"
            value={carrierStats?.withEmail ?? 0}
            sub={carrierStats?.total ? `${Math.round(((carrierStats.withEmail ?? 0) / carrierStats.total) * 100)}% hit rate` : undefined}
            bg="bg-teal-50"
          />
          <StatCard
            icon={<CheckCircle className="h-5 w-5 text-green-500" />}
            label="Email Verified"
            value={carrierStats?.verified ?? 0}
            sub={carrierStats?.withEmail ? `${Math.round(((carrierStats.verified ?? 0) / carrierStats.withEmail) * 100)}% of found` : undefined}
            bg="bg-green-50"
          />
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, sub, bg }: {
  icon: React.ReactNode
  label: string
  value: number
  sub?: string
  bg: string
}) {
  return (
    <div className={`${bg} rounded-lg p-4 flex items-start gap-3`}>
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
        <p className="text-xs text-gray-600 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
