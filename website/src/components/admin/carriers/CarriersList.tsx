'use client'

import { useCallback, useEffect, useState } from 'react'
import { CarrierContact } from '@/types/campaigns'
import { listCarriers, verifyCarrierEmail } from '@/lib/api/carriers'
import { toast } from '@/components/ui/toast'
import { Loader2, Search, CheckCircle, Clock, RefreshCw } from 'lucide-react'

const VERIFICATION_COLORS: Record<string, string> = {
  verified:   'bg-green-100 text-green-700',
  valid:      'bg-green-100 text-green-700',
  invalid:    'bg-red-100 text-red-700',
  risky:      'bg-yellow-100 text-yellow-700',
  unknown:    'bg-gray-100 text-gray-600',
  unverified: 'bg-gray-100 text-gray-600',
}

interface CarriersListProps {
  onEnrich: (dotNumber: string) => void
}

export default function CarriersList({ onEnrich }: CarriersListProps) {
  const [carriers, setCarriers] = useState<CarrierContact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [verifying, setVerifying] = useState<string | null>(null)
  const limit = 30

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listCarriers({ search: search || undefined, page, limit })
      setCarriers(res.carriers)
      setTotal(res.total)
    } catch {
      // no-op
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { load() }, [load])

  async function handleVerify(carrier: CarrierContact) {
    if (!carrier.email) return
    setVerifying(carrier.dot_number)
    try {
      await verifyCarrierEmail(carrier.dot_number)
      toast('Email verification started', 'success')
      load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Verification failed', 'error')
    } finally {
      setVerifying(null)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-4">
      {/* Search + refresh */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by DOT, company, state..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B8A9]"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#00B8A9]" /></div>
      ) : carriers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>No carriers found</p>
          {search && <p className="text-sm mt-1">Try a different search</p>}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">DOT #</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Company</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">State</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Verification</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Power Units</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {carriers.map(c => {
                  const isVerified = c.emailVerified || c.email_verified
                  const verification = isVerified ? 'verified' : 'unverified'
                  return (
                    <tr key={c.dot_number} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.dot_number}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">{c.company_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{c.state || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-[180px] truncate">{c.email || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${VERIFICATION_COLORS[verification] ?? 'bg-gray-100 text-gray-600'}`}>
                          {isVerified ? (
                            <CheckCircle className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {verification}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{c.power_units ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onEnrich(c.dot_number)}
                            className="text-xs text-[#00B8A9] hover:underline font-medium"
                          >
                            Re-enrich
                          </button>
                          {c.email && !isVerified && (
                            <button
                              onClick={() => handleVerify(c)}
                              disabled={verifying === c.dot_number}
                              className="text-xs text-purple-600 hover:underline font-medium disabled:opacity-40"
                            >
                              {verifying === c.dot_number ? 'Verifying...' : 'Verify'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{total.toLocaleString()} carriers</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">Prev</button>
                <span className="font-medium text-gray-700">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">Next</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
