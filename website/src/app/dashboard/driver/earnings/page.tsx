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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading earnings data...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
              <p className="text-sm text-gray-600">Track your income and payments</p>
            </div>
            <Link href="/dashboard/driver">
              <Button variant="outline" size="sm">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Earnings */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="h-8 w-8" />
              <TrendingUp className="h-5 w-5" />
            </div>
            <h3 className="text-3xl font-bold mb-1">
              ${stats.totalEarnings.toFixed(2)}
            </h3>
            <p className="text-green-100 text-sm">Total Earnings</p>
          </div>

          {/* Pending Earnings */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">
              ${stats.pendingEarnings.toFixed(2)}
            </h3>
            <p className="text-gray-600 text-sm">Pending Payment</p>
          </div>

          {/* This Week */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <ArrowUpRight className="h-5 w-5 text-green-500" />
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">
              ${stats.thisWeekEarnings.toFixed(2)}
            </h3>
            <p className="text-gray-600 text-sm">This Week</p>
          </div>

          {/* Average Per Delivery */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-teal-100 rounded-lg">
                <Package className="h-6 w-6 text-teal-600" />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">
              ${stats.averageEarningPerDelivery.toFixed(2)}
            </h3>
            <p className="text-gray-600 text-sm">Avg per Delivery</p>
          </div>
        </div>

        {/* Monthly Overview */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-2">This Month Earnings</p>
              <p className="text-2xl font-bold text-teal-600">
                ${stats.thisMonthEarnings.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Completed Deliveries</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.completedDeliveries}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Success Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.completedDeliveries > 0 ? '100%' : '0%'}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filter Payments</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Period Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Period
              </label>
              <select
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Payment History</h2>
                <p className="text-gray-600 text-sm mt-1">
                  {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''} found
                </p>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Payments Found
              </h3>
              <p className="text-gray-600">
                {payments.length === 0
                  ? "You haven't received any payments yet. Complete deliveries to start earning!"
                  : "No payments match your filters. Try adjusting your search criteria."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredPayments.map((payment) => {
                const driverEarning = payment.amount * 0.8
                const shipment = payment.shipment

                return (
                  <div key={payment.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </span>
                          <span className="text-sm text-gray-500">
                            {formatDate(payment.created_at)}
                          </span>
                        </div>

                        {shipment && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-900">
                              {shipment.title || 'Vehicle Transport'}
                            </p>
                            <p className="text-sm text-gray-600">
                              {shipment.pickup_address} → {shipment.delivery_address}
                            </p>
                            <p className="text-xs text-gray-500">
                              {shipment.distance} miles • ID: {shipment.id.slice(0, 8)}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="text-right ml-4">
                        <p className="text-2xl font-bold text-teal-600">
                          ${driverEarning.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Total: ${payment.amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          (80% commission)
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500 rounded-lg">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Maximize Your Earnings
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                Here are some tips to increase your income on DriveDrop:
              </p>
              <ul className="text-sm text-gray-700 space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Accept longer distance deliveries for higher payouts
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Maintain a high rating to get access to premium jobs
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Complete deliveries quickly to take on more jobs
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Provide excellent service for repeat customers
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
