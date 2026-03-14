'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, Play, Pause, Trash2, MoreVertical } from 'lucide-react'
import type { Campaign } from '@/types/campaigns'
import { startCampaign, pauseCampaign, deleteCampaign } from '@/lib/api/campaigns'
import { toast } from '@/components/ui/toast'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  sending: 'bg-teal-100 text-[#00B8A9] border-teal-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  paused: 'bg-orange-100 text-orange-700 border-orange-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
}

interface CampaignListProps {
  campaigns: Campaign[]
  loading: boolean
  onRefresh: () => void
}

function rate(num: number, denom: number) {
  if (!denom) return '0%'
  return `${((num / denom) * 100).toFixed(1)}%`
}

export default function CampaignList({ campaigns, loading, onRefresh }: CampaignListProps) {
  const router = useRouter()
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function handleStart(id: string) {
    setActionLoading(id)
    try {
      await startCampaign(id)
      toast('Campaign started', 'success')
      onRefresh()
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handlePause(id: string) {
    setActionLoading(id)
    try {
      await pauseCampaign(id)
      toast('Campaign paused', 'success')
      onRefresh()
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete campaign "${name}"? This cannot be undone.`)) return
    setActionLoading(id)
    try {
      await deleteCampaign(id)
      toast('Campaign deleted', 'success')
      onRefresh()
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (campaigns.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="text-4xl mb-4">📧</div>
        <p className="text-gray-500 text-lg font-medium">No campaigns yet</p>
        <p className="text-gray-400 text-sm mt-1">Create your first campaign to start reaching carriers.</p>
        <Link href="/dashboard/admin/campaigns/new" className="mt-4 inline-block px-4 py-2 bg-[#00B8A9] text-white rounded-lg text-sm font-medium hover:bg-teal-600 transition-colors">
          Create Campaign
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Name', 'Status', 'Recipients', 'Sent', 'Opens', 'Clicks', 'Open Rate', 'Click Rate', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {campaigns.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{c.name}</p>
                    <p className="text-xs text-gray-400 truncate max-w-[180px]">{c.subject}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[c.status] || STATUS_STYLES.draft}`}>
                    {c.status}
                  </span>
                  {c.warmupMode && <span className="ml-1 text-xs text-gray-400">(warmup)</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{c.totalRecipients.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{c.sentCount.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{c.openedCount.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{c.clickedCount.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm font-medium text-[#00B8A9]">{rate(c.openedCount, c.deliveredCount)}</td>
                <td className="px-4 py-3 text-sm font-medium text-[#FF9800]">{rate(c.clickedCount, c.openedCount)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Link href={`/dashboard/admin/campaigns/${c.id}`} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors" title="View">
                      <Eye className="h-4 w-4" />
                    </Link>
                    {['draft', 'paused', 'scheduled'].includes(c.status) && (
                      <button onClick={() => handleStart(c.id)} disabled={actionLoading === c.id} className="p-1.5 rounded hover:bg-teal-50 text-[#00B8A9] transition-colors" title="Start">
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    {c.status === 'sending' && (
                      <button onClick={() => handlePause(c.id)} disabled={actionLoading === c.id} className="p-1.5 rounded hover:bg-orange-50 text-[#FF9800] transition-colors" title="Pause">
                        <Pause className="h-4 w-4" />
                      </button>
                    )}
                    {['draft', 'paused', 'cancelled'].includes(c.status) && (
                      <button onClick={() => handleDelete(c.id, c.name)} disabled={actionLoading === c.id} className="p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
