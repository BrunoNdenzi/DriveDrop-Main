'use client'

import { useCallback, useEffect, useState } from 'react'
import { Campaign } from '@/types/campaigns'
import { listCampaigns, getCampaignStats } from '@/lib/api/campaigns'
import { CampaignStats as Stats } from '@/types/campaigns'
import CampaignList from '@/components/admin/campaigns/CampaignList'
import StatsCard from '@/components/admin/campaigns/StatsCard'
import Link from 'next/link'
import { Plus, Mail, Send, Eye, MousePointer } from 'lucide-react'

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Aggregate stats across all campaigns for summary row
  const [totalSent, setTotalSent] = useState(0)
  const [totalOpened, setTotalOpened] = useState(0)
  const [totalClicked, setTotalClicked] = useState(0)
  const [statsLoading, setStatsLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listCampaigns({
        search: search || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
      setCampaigns(res.campaigns)
    } catch {
      // no-op
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])

  // Load aggregate stats once
  useEffect(() => {
    async function loadStats() {
      setStatsLoading(true)
      try {
        // Get stats for all completed/sending campaigns
        const res = await listCampaigns({ limit: 100 })
        const sending = res.campaigns.filter(c => ['sending', 'completed'].includes(c.status))
        if (!sending.length) { setStatsLoading(false); return }
        const allStats = await Promise.allSettled(sending.map(c => getCampaignStats(c.id)))
        let sent = 0, opened = 0, clicked = 0
        allStats.forEach(r => {
          if (r.status === 'fulfilled') {
            sent += r.value.sent
            opened += r.value.opened
            clicked += r.value.clicked
          }
        })
        setTotalSent(sent); setTotalOpened(opened); setTotalClicked(clicked)
      } catch {
        // no-op
      } finally {
        setStatsLoading(false)
      }
    }
    loadStats()
  }, [])

  const STATUSES = ['all', 'draft', 'scheduled', 'sending', 'completed', 'paused', 'cancelled']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and monitor carrier outreach campaigns</p>
        </div>
        <Link
          href="/dashboard/admin/campaigns/new"
          className="flex items-center gap-2 px-4 py-2 bg-[#00B8A9] text-white rounded-lg text-sm font-medium hover:bg-[#009e92] transition-colors"
        >
          <Plus className="h-4 w-4" /> New Campaign
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard title="Total Campaigns" value={campaigns.length} icon={Mail} loading={loading} />
        <StatsCard title="Total Sent" value={totalSent.toLocaleString()} icon={Send} loading={statsLoading} accent="teal" />
        <StatsCard title="Total Opened" value={totalOpened.toLocaleString()} icon={Eye} loading={statsLoading} accent="purple" />
        <StatsCard title="Total Clicked" value={totalClicked.toLocaleString()} icon={MousePointer} loading={statsLoading} accent="orange" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search campaigns..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B8A9] w-56"
        />
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                statusFilter === s ? 'bg-[#00B8A9] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <CampaignList campaigns={campaigns} loading={loading} onRefresh={load} />
    </div>
  )
}
