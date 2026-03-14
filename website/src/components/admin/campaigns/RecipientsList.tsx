'use client'

import { useCallback, useEffect, useState } from 'react'
import { CampaignRecipient } from '@/types/campaigns'
import { getCampaignRecipients } from '@/lib/api/campaigns'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-gray-100 text-gray-600',
  sent:      'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  opened:    'bg-purple-100 text-purple-700',
  clicked:   'bg-orange-100 text-orange-700',
  bounced:   'bg-red-100 text-red-700',
  failed:    'bg-red-100 text-red-700',
  unsubscribed: 'bg-gray-100 text-gray-600',
}

const STATUSES = ['all', 'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'unsubscribed']

interface RecipientsListProps {
  campaignId: string
}

export default function RecipientsList({ campaignId }: RecipientsListProps) {
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 25

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCampaignRecipients(campaignId, {
        status: status === 'all' ? undefined : status,
        page,
        limit,
      })
      setRecipients(res.recipients)
      setTotal(res.total)
    } catch {
      // no-op
    } finally {
      setLoading(false)
    }
  }, [campaignId, status, page])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1) }}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
              status === s
                ? 'bg-[#00B8A9] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#00B8A9]" />
        </div>
      ) : recipients.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No recipients found</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Company</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">State</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Sent At</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Opened At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recipients.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{r.carrier_contacts?.company_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{r.email}</td>
                    <td className="px-4 py-3 text-gray-500">{r.carrier_contacts?.state || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {r.sentAt ? new Date(r.sentAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {r.openedAt ? new Date(r.openedAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page <= 1}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-medium text-gray-700">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
