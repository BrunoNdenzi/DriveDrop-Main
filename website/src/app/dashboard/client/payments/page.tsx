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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading payment history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
              <p className="text-sm text-gray-600">View your payment history and manage transactions</p>
            </div>
            <Button
              onClick={loadPayments}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Paid */}
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="h-8 w-8" />
              <CheckCircle className="h-5 w-5" />
            </div>
            <h3 className="text-3xl font-bold mb-1">
              ${stats.totalPaid.toFixed(2)}
            </h3>
            <p className="text-teal-100 text-sm">Total Paid</p>
          </div>

          {/* Completed Payments */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">
              {stats.completedPayments}
            </h3>
            <p className="text-gray-600 text-sm">Completed Payments</p>
          </div>

          {/* Pending Payments */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">
              {stats.pendingPayments}
            </h3>
            <p className="text-gray-600 text-sm">Pending Payments</p>
          </div>

          {/* Total Refunded */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <RefreshCw className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">
              ${stats.totalRefunded.toFixed(2)}
            </h3>
            <p className="text-gray-600 text-sm">Total Refunded</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>

            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">All Types</option>
              <option value="upfront">Initial Payment (20%)</option>
              <option value="initial">Initial Payment (20%)</option>
              <option value="final">Final Payment (80%)</option>
              <option value="full">Full Payment</option>
            </select>

            <div className="ml-auto text-sm text-gray-600">
              {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Payments List */}
        {filteredPayments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <CreditCard className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Payments Found
            </h3>
            <p className="text-gray-600 mb-4">
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
            {filteredPayments.map((payment) => (
              <div
                key={payment.id}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  {/* Left Side - Payment Info */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      {getStatusIcon(payment.status)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">
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

                      <p className="text-sm text-gray-600 mb-2">
                        {getTypeLabel(payment.payment_type)}
                      </p>

                      {payment.shipment && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <Package className="h-4 w-4" />
                          <button
                            onClick={() => router.push(`/dashboard/client/shipments/${payment.shipment_id}`)}
                            className="hover:text-teal-600 hover:underline truncate"
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

                  {/* Right Side - Actions */}
                  <div className="flex flex-col gap-2">
                    {payment.shipment && (
                      <Button
                        onClick={() => router.push(`/dashboard/client/shipments/${payment.shipment_id}`)}
                        variant="outline"
                        size="sm"
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
