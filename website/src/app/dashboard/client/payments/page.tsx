'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState, useCallback } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { 
  CreditCard,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Package,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Payment {
  id: string
  shipment_id: string
  amount: number
  payment_type: 'upfront' | 'final' | 'full' | 'initial'
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
  payment_intent_id: string | null
  paid_at: string | null
  refund_amount: number | null
  refunded_at: string | null
  created_at: string
  updated_at: string
  shipment?: {
    id: string
    title: string
    pickup_address: string
    delivery_address: string
    status: string
  }
}

interface PaymentStats {
  totalPaid: number
  totalRefunded: number
  pendingPayments: number
  completedPayments: number
}

export default function ClientPaymentsPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [payments, setPayments] = useState<Payment[]>([])
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([])
  const [stats, setStats] = useState<PaymentStats>({
    totalPaid: 0,
    totalRefunded: 0,
    pendingPayments: 0,
    completedPayments: 0,
  })
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const supabase = getSupabaseBrowserClient()

  const loadPayments = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          *,
          shipment:shipments (
            id,
            title,
            pickup_address,
            delivery_address,
            status
          )
        `)
        .eq('client_id', profile.id)
        .order('created_at', { ascending: false })

      if (paymentsError) throw paymentsError

      setPayments(paymentsData || [])

      // Calculate stats
      const succeededPayments = paymentsData?.filter(p => p.status === 'completed') || []
      const pendingPayments = paymentsData?.filter(p => 
        p.status === 'pending' || p.status === 'processing'
      ) || []
      const refundedPayments = paymentsData?.filter(p => p.status === 'refunded') || []

      // Note: amounts are stored in dollars (not cents) in the database
      const totalPaid = succeededPayments.reduce((sum, p) => sum + p.amount, 0)
      const totalRefunded = refundedPayments.reduce((sum, p) => sum + (p.refund_amount || p.amount), 0)

      setStats({
        totalPaid,
        totalRefunded,
        pendingPayments: pendingPayments.length,
        completedPayments: succeededPayments.length,
      })
    } catch (error: any) {
      console.error('Error loading payments:', error)
    } finally {
      setLoading(false)
    }
  }, [profile?.id, supabase])

  const applyFilters = useCallback(() => {
    let filtered = [...payments]

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === filterStatus)
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(p => p.payment_type === filterType)
    }

    setFilteredPayments(filtered)
  }, [payments, filterStatus, filterType])

  useEffect(() => {
    loadPayments()
  }, [loadPayments])

  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'pending':
      case 'processing':
        return 'bg-orange-100 text-orange-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'refunded':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'pending':
      case 'processing':
        return <Clock className="h-5 w-5 text-orange-600" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'refunded':
        return <RefreshCw className="h-5 w-5 text-purple-600" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'upfront':
      case 'initial':
        return 'Initial Payment (20%)'
      case 'final':
        return 'Final Payment (80%)'
      case 'full':
        return 'Full Payment'
      default:
        return type
    }
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Please log in to view payments</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading payment history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Payments</h1>
          <p className="text-xs text-gray-500">View your payment history and manage transactions</p>
        </div>
        <Button
          onClick={loadPayments}
          variant="outline"
          size="sm"
          className="h-8 text-xs"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      </div>

      <div>
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {/* Total Paid */}
          <div className="bg-white rounded-md p-3 border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-blue-50 rounded">
                <DollarSign className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-xs text-gray-500">Total Paid</p>
            </div>
            <h3 className="text-xl font-bold text-gray-900">
              ${stats.totalPaid.toFixed(2)}
            </h3>
          </div>

          {/* Completed Payments */}
          <div className="bg-white rounded-md p-3 border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-green-50 rounded">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
            <h3 className="text-xl font-bold text-gray-900">
              {stats.completedPayments}
            </h3>
          </div>

          {/* Pending Payments */}
          <div className="bg-white rounded-md p-3 border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-amber-50 rounded">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
            <h3 className="text-xl font-bold text-gray-900">
              {stats.pendingPayments}
            </h3>
          </div>

          {/* Total Refunded */}
          <div className="bg-white rounded-md p-3 border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-purple-50 rounded">
                <RefreshCw className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-xs text-gray-500">Refunded</p>
            </div>
            <h3 className="text-xl font-bold text-gray-900">
              ${stats.totalRefunded.toFixed(2)}
            </h3>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-md border border-gray-200 p-3 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500">Filters:</span>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="upfront">Initial Payment (20%)</option>
              <option value="initial">Initial Payment (20%)</option>
              <option value="final">Final Payment (80%)</option>
              <option value="full">Full Payment</option>
            </select>

            <div className="ml-auto text-xs text-gray-400">
              {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Payments List */}
        {filteredPayments.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-md border border-gray-200">
            <CreditCard className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              No Payments Found
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              {filterStatus !== 'all' || filterType !== 'all'
                ? 'Try adjusting your filters'
                : 'Your payment history will appear here'}
            </p>
            {(filterStatus !== 'all' || filterType !== 'all') && (
              <Button
                onClick={() => {
                  setFilterStatus('all')
                  setFilterType('all')
                }}
                variant="outline"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-md border border-gray-200 divide-y divide-gray-100">
            {filteredPayments.map((payment) => (
              <div
                key={payment.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 bg-gray-50 rounded-md">
                      {getStatusIcon(payment.status)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-semibold text-gray-900">
                          ${payment.amount.toFixed(2)}
                        </h3>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(
                            payment.status
                          )}`}
                        >
                          {payment.status}
                        </span>
                      </div>

                      <p className="text-xs text-gray-500 mb-1">
                        {getTypeLabel(payment.payment_type)}
                      </p>

                      {payment.shipment && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                          <Package className="h-3 w-3" />
                          <button
                            onClick={() => router.push(`/dashboard/client/shipments/${payment.shipment_id}`)}
                            className="hover:text-blue-600 hover:underline truncate"
                          >
                            {payment.shipment.title}
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {payment.paid_at
                            ? formatDate(payment.paid_at)
                            : formatDate(payment.created_at)}
                        </div>
                        {payment.payment_intent_id && (
                          <div className="font-mono">
                            {payment.payment_intent_id.substring(0, 20)}...
                          </div>
                        )}
                      </div>

                      {payment.status === 'refunded' && payment.refunded_at && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-purple-600">
                          <RefreshCw className="h-4 w-4" />
                          Refunded ${(payment.refund_amount || payment.amount).toFixed(2)} on{' '}
                          {formatDate(payment.refunded_at)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    {payment.shipment && (
                      <Button
                        onClick={() => router.push(`/dashboard/client/shipments/${payment.shipment_id}`)}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                      >
                        View Shipment
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
