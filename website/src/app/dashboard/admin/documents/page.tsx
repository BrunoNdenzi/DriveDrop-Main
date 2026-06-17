'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  CheckCircle2, XCircle, Clock, Eye, FileText,
  ChevronDown, ChevronUp, Search, RefreshCw
} from 'lucide-react'

type DocStatus = 'pending' | 'approved' | 'rejected'

interface DriverDoc {
  id: string
  driver_id: string
  document_type: string
  file_url: string
  file_name: string
  status: DocStatus
  expiry_date: string | null
  uploaded_at: string
  verified_at: string | null
  rejection_reason: string | null
  driver_name: string
  driver_email: string
}

const TYPE_LABELS: Record<string, string> = {
  license: "Driver's License",
  insurance: 'Vehicle Insurance',
  registration: 'Vehicle Registration',
  background_check: 'Background Check',
  other: 'Other',
}

const STATUS_CONFIG: Record<DocStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:  { label: 'Pending',  color: 'bg-amber-100 text-amber-700 border-amber-200',   icon: <Clock className="h-3.5 w-3.5" /> },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700 border-green-200',   icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200',         icon: <XCircle className="h-3.5 w-3.5" /> },
}

function StatusBadge({ status }: { status: DocStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

export default function AdminDocumentsPage() {
  const { profile } = useAuth()
  const [docs, setDocs] = useState<DriverDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<DocStatus>('pending')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    try {
      // Use service-role API route so RLS does not block admin visibility
      const res = await fetch('/api/admin/documents')
      const body = await res.json()
      if (!res.ok) {
        console.error('Error fetching driver documents:', body)
        return
      }
      setDocs(body.docs || [])
    } catch (err) {
      console.error('Error fetching driver documents:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  const handleReview = async (doc: DriverDoc, action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectReason[doc.id]?.trim()) {
      alert('Please enter a rejection reason before rejecting.')
      return
    }
    setProcessing(doc.id)
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          rejectionReason: action === 'reject' ? rejectReason[doc.id] : undefined,
          driverEmail: doc.driver_email,
          driverFirstName: doc.driver_name.split(' ')[0] || 'Driver',
          documentType: TYPE_LABELS[doc.document_type] || doc.document_type,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      await fetchDocs()
      setExpandedId(null)
      setRejectReason(p => { const n = { ...p }; delete n[doc.id]; return n })
    } catch (err: any) {
      alert(`Failed: ${err.message}`)
    } finally {
      setProcessing(null)
    }
  }

  const counts = {
    pending:  docs.filter(d => d.status === 'pending').length,
    approved: docs.filter(d => d.status === 'approved').length,
    rejected: docs.filter(d => d.status === 'rejected').length,
  }

  const filtered = docs
    .filter(d => d.status === activeTab)
    .filter(d =>
      !search ||
      d.driver_name.toLowerCase().includes(search.toLowerCase()) ||
      d.driver_email.toLowerCase().includes(search.toLowerCase()) ||
      d.document_type.toLowerCase().includes(search.toLowerCase())
    )

  const tabs: { key: DocStatus; label: string }[] = [
    { key: 'pending',  label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Driver Documents</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review and approve driver-submitted documents</p>
        </div>
        <button
          onClick={fetchDocs}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                tab.key === 'pending'
                  ? 'bg-amber-100 text-amber-700'
                  : tab.key === 'approved'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
              }`}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by driver name, email, or document type..."
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400 bg-white"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw className="h-6 w-6 animate-spin mr-3" /> Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No {activeTab} documents</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(doc => {
            const isExpanded = expandedId === doc.id
            return (
              <div key={doc.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Summary row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-purple-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{doc.driver_name}</span>
                      <span className="text-gray-400 text-xs">·</span>
                      <span className="text-xs text-gray-500">{doc.driver_email}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-sm text-gray-700 font-medium">
                        {TYPE_LABELS[doc.document_type] || doc.document_type}
                      </span>
                      <span className="text-xs text-gray-400">{doc.file_name}</span>
                      <span className="text-xs text-gray-400">
                        Uploaded {new Date(doc.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      {doc.expiry_date && (
                        <span className="text-xs text-gray-400">
                          Expires {new Date(doc.expiry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={doc.status} />
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </a>
                    {doc.status === 'pending' && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
                      >
                        Actions {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Rejection reason display (for rejected docs) */}
                {doc.status === 'rejected' && doc.rejection_reason && (
                  <div className="mx-5 mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                    <p className="text-xs font-semibold text-red-700 mb-0.5">Rejection reason</p>
                    <p className="text-sm text-red-800">{doc.rejection_reason}</p>
                  </div>
                )}

                {/* Approve / Reject actions panel */}
                {isExpanded && doc.status === 'pending' && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-4">
                    {/* Approve */}
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm text-gray-600">Approve this document — driver will be notified via email.</p>
                      <button
                        disabled={processing === doc.id}
                        onClick={() => handleReview(doc, 'approve')}
                        className="shrink-0 flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {processing === doc.id ? 'Processing...' : 'Approve'}
                      </button>
                    </div>

                    {/* Reject */}
                    <div className="border-t border-gray-200 pt-4 space-y-2">
                      <p className="text-sm text-gray-600">Or reject with a reason — driver will be notified with the explanation.</p>
                      <textarea
                        rows={2}
                        value={rejectReason[doc.id] || ''}
                        onChange={e => setRejectReason(p => ({ ...p, [doc.id]: e.target.value }))}
                        placeholder="e.g. Document is expired, image is blurry, wrong document type..."
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-red-400 resize-none bg-white"
                      />
                      <div className="flex justify-end">
                        <button
                          disabled={processing === doc.id || !rejectReason[doc.id]?.trim()}
                          onClick={() => handleReview(doc, 'reject')}
                          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                        >
                          <XCircle className="h-4 w-4" />
                          {processing === doc.id ? 'Processing...' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
