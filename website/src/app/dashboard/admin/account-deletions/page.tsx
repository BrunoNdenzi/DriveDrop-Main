'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { Trash2, CheckCircle, XCircle, Clock, RefreshCw, User } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DeletionRequest {
  id: string
  user_id: string
  email: string
  reason: string
  status: 'pending' | 'approved' | 'denied'
  requested_at: string
}

export default function AccountDeletionsPage() {
  const supabase = getSupabaseBrowserClient()
  const [requests, setRequests] = useState<DeletionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('pending')

  const loadRequests = useCallback(async () => {
    setLoading(true)
    const query = supabase
      .from('account_deletion_requests')
      .select('*')
      .order('requested_at', { ascending: false })

    if (filter !== 'all') {
      query.eq('status', filter)
    }

    const { data, error } = await query
    if (!error && data) setRequests(data)
    setLoading(false)
  }, [supabase, filter])

  useEffect(() => { loadRequests() }, [loadRequests])

  const handleApprove = async (req: DeletionRequest) => {
    if (!confirm(`Permanently delete account for ${req.email}? This cannot be undone.`)) return
    setActionLoading(req.id)
    try {
      // 1. Delete the auth user (this cascades to profile via DB triggers)
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: req.user_id, email: req.email }),
      })
      if (!res.ok) throw new Error('Failed to delete user')

      // 2. Mark request as approved
      await supabase
        .from('account_deletion_requests')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', req.id)

      await loadRequests()
    } catch (err: any) {
      alert(err.message || 'Failed to approve deletion')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeny = async (req: DeletionRequest) => {
    setActionLoading(req.id)
    try {
      // Restore the user's profile status
      await supabase
        .from('profiles')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', req.user_id)

      await supabase
        .from('account_deletion_requests')
        .update({ status: 'denied', reviewed_at: new Date().toISOString() })
        .eq('id', req.id)

      await loadRequests()
    } catch (err: any) {
      alert(err.message || 'Failed to deny deletion')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            Account Deletion Requests
          </h1>
          <p className="text-xs text-gray-500">Review and approve or deny pending account deletion requests</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadRequests}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'pending', 'approved', 'denied'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
              filter === f ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-md border border-gray-200 p-8 text-center text-gray-400">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No {filter !== 'all' ? filter : ''} deletion requests</p>
        </div>
      ) : (
        <div className="bg-white rounded-md border border-gray-200 divide-y divide-gray-100">
          {requests.map(req => (
            <div key={req.id} className="p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-red-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{req.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(req.requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {req.reason && (
                    <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded p-2 max-w-md">{req.reason}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                  req.status === 'approved' ? 'bg-red-100 text-red-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {req.status}
                </span>
                {req.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs"
                      disabled={actionLoading === req.id}
                      onClick={() => handleApprove(req)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={actionLoading === req.id}
                      onClick={() => handleDeny(req)}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Deny
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
