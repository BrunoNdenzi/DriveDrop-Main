'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import Link from 'next/link'
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  Calendar,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Package
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Payment {
  id: string
  amount: number
  status: string
  created_at: string
  shipment_id: string
  shipment?: {
    id: string
    title: string
    pickup_address: string
    delivery_address: string
    distance: number
  }
}

interface EarningsStats {
  totalEarnings: number
  pendingEarnings: number
  thisWeekEarnings: number
  thisMonthEarnings: number
  completedDeliveries: number
  averageEarningPerDelivery: number
}

export default function DriverEarningsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([])
  const [stats, setStats] = useState<EarningsStats>({
    totalEarnings: 0,
    pendingEarnings: 0,
    thisWeekEarnings: 0,
    thisMonthEarnings: 0,
    completedDeliveries: 0,
    averageEarningPerDelivery: 0,
  })
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPeriod, setFilterPeriod] = useState('all')
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    fetchProfile()
  }, [])

  useEffect(() => {
    if (profile?.id) {
      fetchEarningsData()
    }
  }, [profile?.id])

  useEffect(() => {
    applyFilters()
  }, [payments, filterStatus, filterPeriod])

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const fetchEarningsData = async () => {
    if (!profile?.id) return

    setLoading(true)
    try {
      // Fetch payments for this driver
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          *,
          shipment:shipments (
            id,
            title,
            pickup_address,
            delivery_address,
            distance
          )
        `)
        .eq('driver_id', profile.id)
        .order('created_at', { ascending: false })

      if (paymentsError) throw paymentsError

      setPayments(paymentsData || [])

      // Calculate stats
      const completedPayments = paymentsData?.filter(p => p.status === 'completed') || []
      const pendingPayments = paymentsData?.filter(p => p.status === 'pending') || []

      // Driver gets 80% of payment amount
      const totalEarnings = completedPayments.reduce((sum, p) => sum + (p.amount * 0.8), 0)
      const pendingEarnings = pendingPayments.reduce((sum, p) => sum + (p.amount * 0.8), 0)

      // This week earnings
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      const thisWeekPayments = completedPayments.filter(
        p => new Date(p.created_at) >= oneWeekAgo
      )
      const thisWeekEarnings = thisWeekPayments.reduce((sum, p) => sum + (p.amount * 0.8), 0)

      // This month earnings
      const oneMonthAgo = new Date()
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
      const thisMonthPayments = completedPayments.filter(
        p => new Date(p.created_at) >= oneMonthAgo
      )
      const thisMonthEarnings = thisMonthPayments.reduce((sum, p) => sum + (p.amount * 0.8), 0)

      const averageEarningPerDelivery = completedPayments.length > 0
        ? totalEarnings / completedPayments.length
        : 0

      setStats({
        totalEarnings,
        pendingEarnings,
        thisWeekEarnings,
        thisMonthEarnings,
        completedDeliveries: completedPayments.length,
        averageEarningPerDelivery,
      })
    } catch (error) {
      console.error('Error fetching earnings data:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...payments]

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === filterStatus)
    }

    // Period filter
    if (filterPeriod !== 'all') {
      const now = new Date()
      if (filterPeriod === 'week') {
        const oneWeekAgo = new Date()
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
        filtered = filtered.filter(p => new Date(p.created_at) >= oneWeekAgo)
      } else if (filterPeriod === 'month') {
        const oneMonthAgo = new Date()
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
        filtered = filtered.filter(p => new Date(p.created_at) >= oneMonthAgo)
      } else if (filterPeriod === 'year') {
        const oneYearAgo = new Date()
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
        filtered = filtered.filter(p => new Date(p.created_at) >= oneYearAgo)
      }
    }

    setFilteredPayments(filtered)
  }

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
        return 'bg-orange-100 text-orange-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto mb-3"></div>
          <p className="text-xs text-gray-500">Loading earnings data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Earnings</h1>
          <p className="text-xs text-gray-500">Track your income and payments</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Earnings */}
        <div className="bg-white rounded-md p-3 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-green-50 rounded-md">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-xs text-gray-500">Total Earnings</p>
          </div>
          <h3 className="text-xl font-bold text-gray-900">
            ${stats.totalEarnings.toFixed(2)}
          </h3>
        </div>

        {/* Pending Earnings */}
        <div className="bg-white rounded-md p-3 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-amber-50 rounded-md">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
          <h3 className="text-xl font-bold text-gray-900">
            ${stats.pendingEarnings.toFixed(2)}
          </h3>
        </div>

        {/* This Week */}
        <div className="bg-white rounded-md p-3 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-blue-50 rounded-md">
              <Calendar className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-xs text-gray-500">This Week</p>
          </div>
          <h3 className="text-xl font-bold text-gray-900">
            ${stats.thisWeekEarnings.toFixed(2)}
          </h3>
        </div>

        {/* Average Per Delivery */}
        <div className="bg-white rounded-md p-3 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-teal-50 rounded-md">
              <Package className="h-4 w-4 text-teal-600" />
            </div>
            <p className="text-xs text-gray-500">Avg/Delivery</p>
          </div>
          <h3 className="text-xl font-bold text-gray-900">
            ${stats.averageEarningPerDelivery.toFixed(2)}
          </h3>
        </div>
      </div>

      {/* Monthly Overview */}
      <div className="bg-white rounded-md border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Monthly Overview</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">This Month</p>
            <p className="text-lg font-bold text-amber-600">
              ${stats.thisMonthEarnings.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Deliveries</p>
            <p className="text-lg font-bold text-gray-900">
              {stats.completedDeliveries}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Success Rate</p>
            <p className="text-lg font-bold text-green-600">
              {stats.completedDeliveries > 0 ? '100%' : '0%'}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-md border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Filter Payments</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Period
            </label>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="all">All Time</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="year">Last Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-md border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Payment History</h2>
            <p className="text-[10px] text-gray-400">
              {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>
        </div>

        {filteredPayments.length === 0 ? (
          <div className="p-8 text-center">
            <DollarSign className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              No Payments Found
            </h3>
            <p className="text-xs text-gray-500">
              {payments.length === 0
                ? "Complete deliveries to start earning!"
                : "No payments match your filters."}
            </p>
          </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredPayments.map((payment) => {
                const driverEarning = payment.amount * 0.8
                const shipment = payment.shipment

                return (
                  <div key={payment.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${getStatusColor(payment.status)}`}>
                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {formatDate(payment.created_at)}
                          </span>
                        </div>

                        {shipment && (
                          <div className="mt-1">
                            <p className="text-xs font-medium text-gray-900">
                              {shipment.title || 'Vehicle Transport'}
                            </p>
                            <p className="text-[10px] text-gray-500 truncate">
                              {shipment.pickup_address} → {shipment.delivery_address}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {shipment.distance} mi • {shipment.id.slice(0, 8)}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="text-right ml-3">
                        <p className="text-sm font-bold text-amber-600">
                          ${driverEarning.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          Total: ${payment.amount.toFixed(2)} (80%)
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      {/* Tips */}
      <div className="bg-amber-50 border border-amber-100 rounded-md p-3">
        <div className="flex items-start gap-2">
          <TrendingUp className="h-4 w-4 text-amber-600 mt-0.5" />
          <div>
            <h3 className="text-xs font-semibold text-gray-900 mb-1">Maximize Earnings</h3>
            <ul className="text-[10px] text-gray-600 space-y-0.5">
              <li className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                Longer distance deliveries = higher payouts
              </li>
              <li className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                High ratings unlock premium jobs
              </li>
              <li className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                Fast completions enable more jobs
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
