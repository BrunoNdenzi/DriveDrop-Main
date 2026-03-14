'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Campaign, CampaignStats as Stats } from '@/types/campaigns'
import { getCampaign, getCampaignStats, startCampaign, pauseCampaign, deleteCampaign } from '@/lib/api/campaigns'
import { toast } from '@/components/ui/toast'
import CampaignStatsComponent from '@/components/admin/campaigns/CampaignStats'
import RecipientsList from '@/components/admin/campaigns/RecipientsList'
import TestEmailModal from '@/components/admin/campaigns/TestEmailModal'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Edit, Play, Pause, Trash2, Send, Loader2
} from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  draft:      'bg-gray-100 text-gray-600',
  scheduled:  'bg-blue-100 text-blue-700',
  sending:    'bg-teal-100 text-teal-700',
  completed:  'bg-green-100 text-green-700',
  paused:     'bg-yellow-100 text-yellow-700',
  cancelled:  'bg-red-100 text-red-700',
}

type TabKey = 'stats' | 'recipients' | 'content'

export default function CampaignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [tab, setTab] = useState<TabKey>('stats')
  const [showTestModal, setShowTestModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, s] = await Promise.all([getCampaign(id), getCampaignStats(id)])
      setCampaign(c)
      setStats(s)
    } catch {
      // no-op
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleStart() {
    setActionLoading(true)
    try {
      await startCampaign(id)
      toast('Campaign started', 'success')
      load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to start campaign', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  async function handlePause() {
    setActionLoading(true)
    try {
      await pauseCampaign(id)
      toast('Campaign paused', 'success')
      load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to pause campaign', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete() {
    setActionLoading(true)
    try {
      await deleteCampaign(id)
      toast('Campaign deleted', 'success')
      router.push('/dashboard/admin/campaigns')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete campaign', 'error')
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-[#00B8A9]" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="text-center py-32 text-gray-400">
        <p className="text-lg mb-2">Campaign not found</p>
        <Link href="/dashboard/admin/campaigns" className="text-[#00B8A9] hover:underline text-sm">Back to campaigns</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/dashboard/admin/campaigns" className="text-gray-400 hover:text-gray-600 mt-1">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[campaign.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {campaign.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Subject: {campaign.subject}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTestModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Send className="h-3.5 w-3.5" /> Test
          </button>

          {(campaign.status === 'draft' || campaign.status === 'paused') && (
            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#00B8A9] text-white rounded-lg text-sm font-medium hover:bg-[#009e92] disabled:opacity-40"
            >
              {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Start
            </button>
          )}

          {campaign.status === 'sending' && (
            <button
              onClick={handlePause}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-yellow-100 text-yellow-700 border border-yellow-200 rounded-lg text-sm font-medium hover:bg-yellow-200 disabled:opacity-40"
            >
              {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />} Pause
            </button>
          )}

          <Link
            href={`/dashboard/admin/campaigns/${id}/edit`}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Edit className="h-3.5 w-3.5" /> Edit
          </Link>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="text-xs text-red-600 font-medium">Delete?</span>
              <button onClick={handleDelete} disabled={actionLoading} className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700 disabled:opacity-40">
                Yes
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="text-xs text-gray-500 hover:text-gray-700">No</button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0">
          {([
            { key: 'stats', label: 'Analytics' },
            { key: 'recipients', label: 'Recipients' },
            { key: 'content', label: 'Email Content' },
          ] as { key: TabKey; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key
                  ? 'border-[#00B8A9] text-[#00B8A9]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'stats' && (
        <CampaignStatsComponent stats={stats!} loading={!stats} />
      )}

      {tab === 'recipients' && (
        <RecipientsList campaignId={id} />
      )}

      {tab === 'content' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Email Preview</p>
          </div>
          <div className="relative" style={{ height: '600px' }}>
            {campaign.htmlContent ? (
              <iframe
                srcDoc={campaign.htmlContent}
                className="w-full h-full border-0"
                title="Campaign email content"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No email content — edit the campaign to add HTML
              </div>
            )}
          </div>
        </div>
      )}

      {/* Test email modal */}
      {showTestModal && (
        <TestEmailModal campaignId={id} onClose={() => setShowTestModal(false)} />
      )}
    </div>
  )
}
