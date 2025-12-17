'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import Link from 'next/link'
import { 
  Users, 
  Package, 
  DollarSign,
  TrendingUp,
  UserCheck,
  Truck,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowRight,
  Calendar,
  BarChart3
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SystemStats {
  totalUsers: number
  totalClients: number
  totalDrivers: number
  totalShipments: number
  activeShipments: number
  completedShipments: number
  totalRevenue: number
  pendingApplications: number
}

interface RecentActivity {
  id: string
  type: 'shipment' | 'user' | 'application'
  description: string
  timestamp: string
}

export default function AdminDashboardPage() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    totalClients: 0,
    totalDrivers: 0,
    totalShipments: 0,
    activeShipments: 0,
    completedShipments: 0,
    totalRevenue: 0,
    pendingApplications: 0,
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Use Promise.all to fetch data in parallel for faster loading
        const [
          clientsResult,
          driversResult,
          shipmentsResult,
          jobApplicationsResult
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'client'),
          supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'driver'),
          supabase
            .from('shipments')
            .select('status, estimated_price'),
          supabase
            .from('job_applications')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending')
        ])

        const totalClients = clientsResult.count || 0
        const totalDrivers = driversResult.count || 0
        const totalUsers = totalClients + totalDrivers

        const shipments = shipmentsResult.data || []
        const totalShipments = shipments.length
        // Active deliveries = shipments actually being worked on (not pending, not completed)
        const activeShipments = shipments.filter(s => 
          ['assigned', 'accepted', 'driver_en_route', 'driver_arrived', 'pickup_verification_pending', 'pickup_verified', 'picked_up', 'in_transit', 'in_progress'].includes(s.status)
        ).length
        const completedShipments = shipments.filter(s => s.status === 'delivered').length
        const totalRevenue = shipments.reduce((sum, s) => sum + (s.estimated_price || 0), 0)

        const pendingApplications = jobApplicationsResult.count || 0

        setStats({
          totalUsers,
          totalClients,
          totalDrivers,
          totalShipments,
          activeShipments,
          completedShipments,
          totalRevenue,
          pendingApplications,
        })

        // Fetch recent activity from database
        const activities: RecentActivity[] = []

        // Get recent shipments
        const { data: recentShipments } = await supabase
          .from('shipments')
          .select('id, created_at, pickup_address, profiles!client_id(first_name, last_name)')
          .order('created_at', { ascending: false })
          .limit(3)

        recentShipments?.forEach(shipment => {
          const clientName = shipment.profiles 
            ? `${shipment.profiles.first_name} ${shipment.profiles.last_name}`
            : 'Unknown Client'
          activities.push({
            id: `shipment-${shipment.id}`,
            type: 'shipment',
            description: `New shipment created by ${clientName}`,
            timestamp: shipment.created_at,
          })
        })

        // Get recent user registrations
        const { data: recentUsers } = await supabase
          .from('profiles')
          .select('id, created_at, first_name, last_name, role')
          .eq('role', 'client')
          .order('created_at', { ascending: false })
          .limit(2)

        recentUsers?.forEach(user => {
          activities.push({
            id: `user-${user.id}`,
            type: 'user',
            description: `New client registered: ${user.first_name} ${user.last_name}`,
            timestamp: user.created_at,
          })
        })

        // Get recent driver applications
        const { data: recentApps } = await supabase
          .from('job_applications')
          .select('id, submitted_at, full_name')
          .order('submitted_at', { ascending: false })
          .limit(2)

        recentApps?.forEach(app => {
          activities.push({
            id: `app-${app.id}`,
            type: 'application',
            description: `Driver application submitted: ${app.full_name}`,
            timestamp: app.submitted_at,
          })
        })

        // Sort all activities by timestamp
        activities.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )

        setRecentActivity(activities.slice(0, 5))
      } catch (error) {
        console.error('Error fetching admin data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6" id="admin-dashboard">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl p-8 text-white" data-tour="analytics">
        <h1 className="text-3xl font-bold mb-2">
          Admin Dashboard 🛡️
        </h1>
        <p className="text-white/90 mb-6">
          Monitor and manage DriveDrop
        </p>
        <div className="flex flex-wrap gap-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
            <p className="text-xs text-white/80">Total Revenue</p>
            <p className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
            <p className="text-xs text-white/80">Active Shipments</p>
            <p className="text-2xl font-bold">{stats.activeShipments}</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
            <p className="text-xs text-white/80">Pending Applications</p>
            <p className="text-2xl font-bold">{stats.pendingApplications}</p>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-gray-600 text-sm mb-1">Total Users</p>
          <h3 className="text-3xl font-bold text-gray-900">{stats.totalUsers}</h3>
          <p className="text-xs text-gray-500 mt-2">
            {stats.totalClients} clients, {stats.totalDrivers} drivers
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <Package className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-1">Total Shipments</p>
          <h3 className="text-3xl font-bold text-gray-900">{stats.totalShipments}</h3>
          <p className="text-xs text-gray-500 mt-2">
            {stats.activeShipments} active
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-gray-600 text-sm mb-1">Total Revenue</p>
          <h3 className="text-3xl font-bold text-gray-900">
            ${stats.totalRevenue.toFixed(0)}
          </h3>
          <p className="text-xs text-gray-500 mt-2">
            From {stats.completedShipments} completed deliveries
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <UserCheck className="h-6 w-6 text-purple-600" />
            </div>
            {stats.pendingApplications > 0 && (
              <AlertCircle className="h-5 w-5 text-orange-500" />
            )}
          </div>
          <p className="text-gray-600 text-sm mb-1">Driver Applications</p>
          <h3 className="text-3xl font-bold text-gray-900">{stats.pendingApplications}</h3>
          <p className="text-xs text-gray-500 mt-2">Pending review</p>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/dashboard/admin/applications"
          className="bg-white rounded-xl p-6 border-2 border-dashed border-orange-300 hover:border-orange-500 hover:bg-orange-50 transition-all group"
          data-tour="driver-management"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-orange-50 rounded-lg group-hover:bg-orange-500 group-hover:text-white transition-colors">
              <UserCheck className="h-6 w-6 text-orange-600 group-hover:text-white" />
            </div>
            {stats.pendingApplications > 0 && (
              <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {stats.pendingApplications}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Review Applications</h3>
          <p className="text-sm text-gray-600">
            {stats.pendingApplications} driver applications waiting
          </p>
        </Link>

        <Link
          href="/dashboard/admin/shipments"
          className="bg-white rounded-xl p-6 border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50 transition-all group"
          data-tour="shipments-overview"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-500 group-hover:text-white transition-colors">
              <Package className="h-6 w-6 text-blue-600 group-hover:text-white" />
            </div>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Manage Shipments</h3>
          <p className="text-sm text-gray-600">
            {stats.activeShipments} active shipments
          </p>
        </Link>

        <Link
          href="/dashboard/admin/reports"
          className="bg-white rounded-xl p-6 border-2 border-dashed border-green-300 hover:border-green-500 hover:bg-green-50 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-green-50 rounded-lg group-hover:bg-green-500 group-hover:text-white transition-colors">
              <BarChart3 className="h-6 w-6 text-green-600 group-hover:text-white" />
            </div>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">View Reports</h3>
          <p className="text-sm text-gray-600">
            Analytics and insights
          </p>
        </Link>
      </div>

      {/* Recent Activity & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`
                    p-2 rounded-lg
                    ${activity.type === 'shipment' ? 'bg-blue-50' : ''}
                    ${activity.type === 'user' ? 'bg-green-50' : ''}
                    ${activity.type === 'application' ? 'bg-orange-50' : ''}
                  `}>
                    {activity.type === 'shipment' && <Package className="h-4 w-4 text-blue-600" />}
                    {activity.type === 'user' && <Users className="h-4 w-4 text-green-600" />}
                    {activity.type === 'application' && <UserCheck className="h-4 w-4 text-orange-600" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.description}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                      <Clock className="h-3 w-3" />
                      {new Date(activity.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Overview */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">System Overview</h2>
          </div>

          <div className="p-6 space-y-4">
            {/* Clients */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Active Clients</span>
                <span className="text-sm font-bold text-gray-900">{stats.totalClients}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full"
                  style={{ width: `${Math.min((stats.totalClients / 100) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Drivers */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Active Drivers</span>
                <span className="text-sm font-bold text-gray-900">{stats.totalDrivers}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-orange-500 to-orange-600 h-2 rounded-full"
                  style={{ width: `${Math.min((stats.totalDrivers / 50) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Completion Rate */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Completion Rate</span>
                <span className="text-sm font-bold text-gray-900">
                  {stats.totalShipments > 0 
                    ? ((stats.completedShipments / stats.totalShipments) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full"
                  style={{ 
                    width: stats.totalShipments > 0 
                      ? `${(stats.completedShipments / stats.totalShipments) * 100}%`
                      : '0%'
                  }}
                ></div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="pt-4 space-y-2">
              <Link href="/dashboard/admin/users">
                <Button variant="outline" className="w-full justify-start" size="sm" data-tour="user-management">
                  <Users className="h-4 w-4 mr-2" />
                  Manage Users
                </Button>
              </Link>
              <Link href="/dashboard/admin/pricing">
                <Button variant="outline" className="w-full justify-start" size="sm" data-tour="pricing-config">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Configure Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Cards */}
      {stats.pendingApplications > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-orange-500 rounded-lg">
              <AlertCircle className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">
                Action Required: Pending Driver Applications
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                You have {stats.pendingApplications} driver application{stats.pendingApplications !== 1 ? 's' : ''} waiting for review
              </p>
              <Link href="/dashboard/admin/applications">
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                  Review Applications
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
