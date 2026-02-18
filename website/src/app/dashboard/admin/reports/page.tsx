'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Package,
  Users,
  Truck,
  Calendar,
  Download,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ReportStats {
  totalRevenue: number
  totalShipments: number
  completedShipments: number
  activeShipments: number
  cancelledShipments: number
  pendingShipments: number
  totalClients: number
  totalDrivers: number
  activeDrivers: number
  averageShipmentValue: number
  averageDistance: number
  revenueGrowth: number
  shipmentGrowth: number
  completionRate: number
  cancellationRate: number
}

interface RevenueByMonth {
  month: string
  revenue: number
  shipments: number
  completed: number
  cancelled: number
}

interface TopRoute {
  from: string
  to: string
  count: number
  totalRevenue: number
}

export default function AdminReportsPage() {
  const { profile, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ReportStats | null>(null)
  const [revenueByMonth, setRevenueByMonth] = useState<RevenueByMonth[]>([])
  const [topRoutes, setTopRoutes] = useState<TopRoute[]>([])
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadReports()
    }
  }, [profile, dateRange])

  const loadReports = async () => {
    try {
      setLoading(true)

      const { data: shipments, error: shipmentsError } = await supabase
        .from('shipments')
        .select('*')
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end)

      if (shipmentsError) throw shipmentsError

      const startDate = new Date(dateRange.start)
      const endDate = new Date(dateRange.end)
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const prevStart = new Date(startDate)
      prevStart.setDate(prevStart.getDate() - daysDiff)
      
      const { data: prevShipments } = await supabase
        .from('shipments')
        .select('*')
        .gte('created_at', prevStart.toISOString())
        .lt('created_at', dateRange.start)

      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('role')

      if (usersError) throw usersError

      const totalRevenue = shipments?.reduce((sum, s) => sum + (s.total_price || 0), 0) || 0
      const prevRevenue = prevShipments?.reduce((sum, s) => sum + (s.total_price || 0), 0) || 0
      const completedShipments = shipments?.filter(s => s.status === 'delivered').length || 0
      const activeShipments = shipments?.filter(s => ['assigned', 'in_transit'].includes(s.status)).length || 0
      const pendingShipments = shipments?.filter(s => s.status === 'pending').length || 0
      const cancelledShipments = shipments?.filter(s => s.status === 'cancelled').length || 0
      const totalClients = users?.filter(u => u.role === 'client').length || 0
      const totalDrivers = users?.filter(u => u.role === 'driver').length || 0

      const totalDistance = shipments?.reduce((sum, s) => sum + (s.distance || 0), 0) || 0
      const averageDistance = shipments?.length ? totalDistance / shipments.length : 0

      const revenueGrowth = prevRevenue ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0
      const shipmentGrowth = prevShipments?.length ? ((shipments?.length || 0) - prevShipments.length) / prevShipments.length * 100 : 0

      setStats({
        totalRevenue,
        totalShipments: shipments?.length || 0,
        completedShipments,
        activeShipments,
        cancelledShipments,
        pendingShipments,
        totalClients,
        totalDrivers,
        activeDrivers: activeShipments,
        averageShipmentValue: shipments?.length ? totalRevenue / shipments.length : 0,
        averageDistance,
        revenueGrowth,
        shipmentGrowth,
        completionRate: shipments?.length ? (completedShipments / shipments.length) * 100 : 0,
        cancellationRate: shipments?.length ? (cancelledShipments / shipments.length) * 100 : 0
      })

      const monthlyData = shipments?.reduce((acc: any, shipment) => {
        const month = new Date(shipment.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
        if (!acc[month]) {
          acc[month] = { month, revenue: 0, shipments: 0, completed: 0, cancelled: 0 }
        }
        acc[month].revenue += shipment.total_price || 0
        acc[month].shipments += 1
        if (shipment.status === 'delivered') acc[month].completed += 1
        if (shipment.status === 'cancelled') acc[month].cancelled += 1
        return acc
      }, {}) || {}

      setRevenueByMonth(Object.values(monthlyData))

      const routesData = shipments?.reduce((acc: any, shipment) => {
        // Skip shipments with missing location data
        if (!shipment.pickup_city || !shipment.pickup_state || !shipment.delivery_city || !shipment.delivery_state) {
          return acc
        }
        
        const route = `${shipment.pickup_city}, ${shipment.pickup_state} → ${shipment.delivery_city}, ${shipment.delivery_state}`
        if (!acc[route]) {
          acc[route] = {
            from: `${shipment.pickup_city}, ${shipment.pickup_state}`,
            to: `${shipment.delivery_city}, ${shipment.delivery_state}`,
            count: 0,
            totalRevenue: 0
          }
        }
        acc[route].count += 1
        acc[route].totalRevenue += shipment.total_price || shipment.estimated_price || 0
        return acc
      }, {}) || {}

      const topRoutesArray = Object.values(routesData).sort((a: any, b: any) => b.count - a.count).slice(0, 5) as TopRoute[]
      setTopRoutes(topRoutesArray)

    } catch (error) {
      console.error('Error loading reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (!stats) return

    const csv = [
      ['DriveDrop Analytics Report'],
      ['Generated:', new Date().toLocaleString()],
      ['Period:', `${dateRange.start} to ${dateRange.end}`],
      [''],
      ['FINANCIAL METRICS'],
      ['Total Revenue', `$${stats.totalRevenue.toFixed(2)}`],
      ['Average Shipment Value', `$${stats.averageShipmentValue.toFixed(2)}`],
      ['Revenue Growth', `${stats.revenueGrowth.toFixed(1)}%`],
      [''],
      ['SHIPMENT METRICS'],
      ['Total Shipments', stats.totalShipments],
      ['Completed', stats.completedShipments],
      ['Active', stats.activeShipments],
      ['Pending', stats.pendingShipments],
      ['Cancelled', stats.cancelledShipments],
      ['Completion Rate', `${stats.completionRate.toFixed(1)}%`],
      ['Cancellation Rate', `${stats.cancellationRate.toFixed(1)}%`],
      [''],
      ['USER METRICS'],
      ['Total Clients', stats.totalClients],
      ['Total Drivers', stats.totalDrivers],
      ['Active Drivers', stats.activeDrivers],
      [''],
      ['OPERATIONAL METRICS'],
      ['Average Distance', `${stats.averageDistance.toFixed(1)} miles`],
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `drivedrop-analytics-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-red-600">Access denied. Admin only.</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-50">
      <div>
        <div className="mb-6 bg-purple-500 rounded-md border p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-3 mb-2">
                <BarChart3 className="h-10 w-10" />
                Analytics Dashboard
              </h1>
              <p className="text-blue-100">Comprehensive business intelligence and insights</p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={loadReports} variant="outline" disabled={loading} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={exportToCSV} className="bg-white text-blue-600 hover:bg-blue-50">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4 bg-white/10 backdrop-blur-sm p-4 rounded-md border border-white/20">
            <Calendar className="h-5 w-5" />
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">From:</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="px-3 py-1.5 bg-white/20 border border-white/30 rounded-md focus:outline-none focus:ring-2 focus:ring-white/50 text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">To:</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="px-3 py-1.5 bg-white/20 border border-white/30 rounded-md focus:outline-none focus:ring-2 focus:ring-white/50 text-white"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading analytics...</p>
            </div>
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard
                title="Total Revenue"
                value={`$${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={<DollarSign className="h-7 w-7" />}
                color="green"
                trend={stats.revenueGrowth}
                subtitle={`Avg: $${stats.averageShipmentValue.toFixed(2)}`}
              />
              <StatCard
                title="Total Shipments"
                value={stats.totalShipments.toString()}
                icon={<Package className="h-7 w-7" />}
                color="blue"
                trend={stats.shipmentGrowth}
                subtitle={`${stats.completedShipments} completed`}
              />
              <StatCard
                title="Active Clients"
                value={stats.totalClients.toString()}
                icon={<Users className="h-7 w-7" />}
                color="purple"
                subtitle={`${stats.activeShipments} active orders`}
              />
              <StatCard
                title="Driver Fleet"
                value={stats.totalDrivers.toString()}
                icon={<Truck className="h-7 w-7" />}
                color="orange"
                subtitle={`${stats.activeDrivers} active now`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <MetricBox
                icon={<CheckCircle className="h-5 w-5 text-green-600" />}
                label="Completion Rate"
                value={`${stats.completionRate.toFixed(1)}%`}
                bgColor="bg-green-50"
              />
              <MetricBox
                icon={<XCircle className="h-5 w-5 text-red-600" />}
                label="Cancellation Rate"
                value={`${stats.cancellationRate.toFixed(1)}%`}
                bgColor="bg-red-50"
              />
              <MetricBox
                icon={<MapPin className="h-5 w-5 text-blue-600" />}
                label="Avg Distance"
                value={`${stats.averageDistance.toFixed(0)} mi`}
                bgColor="bg-blue-50"
              />
              <MetricBox
                icon={<Clock className="h-5 w-5 text-purple-600" />}
                label="Pending Orders"
                value={stats.pendingShipments.toString()}
                bgColor="bg-purple-50"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-md border p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <Package className="h-6 w-6 text-blue-600" />
                  Shipment Status Distribution
                </h3>
                <div className="space-y-4">
                  <StatusBar
                    label="Completed"
                    value={stats.completedShipments}
                    total={stats.totalShipments}
                    color="green"
                    icon={<CheckCircle className="h-4 w-4" />}
                  />
                  <StatusBar
                    label="In Progress"
                    value={stats.activeShipments}
                    total={stats.totalShipments}
                    color="blue"
                    icon={<Clock className="h-4 w-4" />}
                  />
                  <StatusBar
                    label="Pending"
                    value={stats.pendingShipments}
                    total={stats.totalShipments}
                    color="yellow"
                    icon={<AlertCircle className="h-4 w-4" />}
                  />
                  <StatusBar
                    label="Cancelled"
                    value={stats.cancelledShipments}
                    total={stats.totalShipments}
                    color="red"
                    icon={<XCircle className="h-4 w-4" />}
                  />
                </div>
              </div>

              <div className="bg-white rounded-md border p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <MapPin className="h-6 w-6 text-purple-600" />
                  Top Shipping Routes
                </h3>
                <div className="space-y-3">
                  {topRoutes.length > 0 ? topRoutes.map((route, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{route.from}</p>
                        <p className="text-xs text-gray-600">→ {route.to}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{route.count} trips</p>
                        <p className="text-xs text-gray-600">${route.totalRevenue.toFixed(0)}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-gray-500 text-center py-4">No route data available</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-md border p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-green-600" />
                Monthly Revenue Analysis
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 font-bold text-gray-700">Month</th>
                      <th className="text-right py-3 px-4 font-bold text-gray-700">Total Shipments</th>
                      <th className="text-right py-3 px-4 font-bold text-gray-700">Completed</th>
                      <th className="text-right py-3 px-4 font-bold text-gray-700">Cancelled</th>
                      <th className="text-right py-3 px-4 font-bold text-gray-700">Revenue</th>
                      <th className="text-right py-3 px-4 font-bold text-gray-700">Avg Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueByMonth.map((month, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4 font-medium text-gray-900">{month.month}</td>
                        <td className="py-4 px-4 text-right text-gray-700">{month.shipments}</td>
                        <td className="py-4 px-4 text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                            <CheckCircle className="h-3 w-3" />
                            {month.completed}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                            <XCircle className="h-3 w-3" />
                            {month.cancelled}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-gray-900">
                          ${month.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4 text-right text-gray-600">
                          ${(month.revenue / month.shipments).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function StatCard({ 
  title, 
  value, 
  icon, 
  color, 
  trend,
  subtitle
}: { 
  title: string
  value: string
  icon: React.ReactNode
  color: 'green' | 'blue' | 'purple' | 'orange'
  trend?: number
  subtitle?: string
}) {
  const colorClasses = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500'
  }

  return (
    <div className="bg-white rounded-md border overflow-hidden">
      <div className={`h-2 ${colorClasses[color]}`}></div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-md ${colorClasses[color]} text-white`}>
            {icon}
          </div>
          {trend !== undefined && trend !== 0 && (
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${trend > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {trend > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-2">{title}</p>
        <p className="text-lg font-semibold text-gray-900 mb-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  )
}

function MetricBox({ 
  icon, 
  label, 
  value,
  bgColor
}: { 
  icon: React.ReactNode
  label: string
  value: string
  bgColor: string
}) {
  return (
    <div className={`${bgColor} rounded-md p-4 flex items-center gap-3`}>
      <div>{icon}</div>
      <div>
        <p className="text-xs text-gray-600 font-medium">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

function StatusBar({ 
  label, 
  value, 
  total, 
  color,
  icon
}: { 
  label: string
  value: number
  total: number
  color: 'green' | 'blue' | 'red' | 'yellow'
  icon: React.ReactNode
}) {
  const percentage = total ? (value / total) * 100 : 0
  const colorClasses = {
    green: { bg: 'bg-green-500', text: 'text-green-700', bgLight: 'bg-green-100' },
    blue: { bg: 'bg-blue-500', text: 'text-blue-700', bgLight: 'bg-blue-100' },
    red: { bg: 'bg-red-500', text: 'text-red-700', bgLight: 'bg-red-100' },
    yellow: { bg: 'bg-yellow-500', text: 'text-yellow-700', bgLight: 'bg-yellow-100' }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`${colorClasses[color].text}`}>{icon}</div>
          <span className="text-sm font-semibold text-gray-900">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold px-2 py-1 rounded ${colorClasses[color].bgLight} ${colorClasses[color].text}`}>
            {value}
          </span>
          <span className="text-sm text-gray-600 font-medium">{percentage.toFixed(1)}%</span>
        </div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className={`h-3 ${colorClasses[color].bg} transition-all duration-500 ease-out shadow-inner`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
