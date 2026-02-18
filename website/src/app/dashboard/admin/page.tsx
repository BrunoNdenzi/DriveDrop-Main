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
import { BenjiChat } from '@/components/benji/BenjiChat'

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
            .from('driver_applications')
            .select('*')
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

        const allApplications = jobApplicationsResult.data || []
        const pendingApplications = allApplications.filter((app: any) => app.status === 'pending').length

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
          .select('id, created_at, pickup_address, client_id, profiles!client_id(first_name, last_name)')
          .order('created_at', { ascending: false })
          .limit(3)

        recentShipments?.forEach((shipment: any) => {
          const profile = shipment.profiles
          const clientName = profile 
            ? `${profile.first_name} ${profile.last_name}`
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
          .from('driver_applications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(2)

        recentApps?.forEach(app => {
          activities.push({
            id: `app-${app.id}`,
            type: 'application',
            description: `Driver application submitted: ${app.first_name} ${app.last_name}`,
            timestamp: app.created_at,
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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4" id="admin-dashboard">
      {/* Welcome Header */}
      <div className="flex items-center justify-between" data-tour="analytics">
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            Admin Dashboard
          </h1>
          <p className="text-xs text-gray-500">
            Monitor and manage DriveDrop
          </p>
        </div>
        <Link href="/dashboard/admin/applications">
          <Button size="sm" className="h-8 text-xs bg-purple-500 hover:bg-purple-600 text-white">
            Review Applications
            {stats.pendingApplications > 0 && (
              <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded text-[10px]">{stats.pendingApplications}</span>
            )}
          </Button>
        </Link>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-md p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-purple-50 rounded-md">
              <Users className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-xs text-gray-500">Total Users</p>
          </div>
          <h3 className="text-xl font-bold text-gray-900">{stats.totalUsers}</h3>
          <p className="text-[10px] text-gray-400 mt-1">
            {stats.totalClients} clients, {stats.totalDrivers} drivers
          </p>
        </div>

        <div className="bg-white rounded-md p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-purple-50 rounded-md">
              <Package className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-xs text-gray-500">Shipments</p>
          </div>
          <h3 className="text-xl font-bold text-gray-900">{stats.totalShipments}</h3>
          <p className="text-[10px] text-gray-400 mt-1">
            {stats.activeShipments} active
          </p>
        </div>

        <div className="bg-white rounded-md p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-green-50 rounded-md">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-xs text-gray-500">Revenue</p>
          </div>
          <h3 className="text-xl font-bold text-gray-900">
            ${stats.totalRevenue.toFixed(0)}
          </h3>
          <p className="text-[10px] text-gray-400 mt-1">
            {stats.completedShipments} completed
          </p>
        </div>

        <div className="bg-white rounded-md p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-amber-50 rounded-md">
              <UserCheck className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-xs text-gray-500">Applications</p>
          </div>
          <h3 className="text-xl font-bold text-gray-900">{stats.pendingApplications}</h3>
          <p className="text-[10px] text-gray-400 mt-1">Pending review</p>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/dashboard/admin/applications"
          className="bg-white rounded-md p-3 border border-gray-200 hover:border-purple-300 transition-colors"
          data-tour="driver-management"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1.5 bg-purple-50 rounded-md">
              <UserCheck className="h-4 w-4 text-purple-600" />
            </div>
            {stats.pendingApplications > 0 && (
              <span className="bg-purple-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                {stats.pendingApplications}
              </span>
            )}
          </div>
          <h3 className="text-xs font-semibold text-gray-900">Review Applications</h3>
          <p className="text-[10px] text-gray-500">
            {stats.pendingApplications} waiting
          </p>
        </Link>

        <Link
          href="/dashboard/admin/shipments"
          className="bg-white rounded-md p-3 border border-gray-200 hover:border-purple-300 transition-colors"
          data-tour="shipments-overview"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1.5 bg-purple-50 rounded-md">
              <Package className="h-4 w-4 text-purple-600" />
            </div>
          </div>
          <h3 className="text-xs font-semibold text-gray-900">Manage Shipments</h3>
          <p className="text-[10px] text-gray-500">
            {stats.activeShipments} active
          </p>
        </Link>

        <Link
          href="/dashboard/admin/reports"
          className="bg-white rounded-md p-3 border border-gray-200 hover:border-purple-300 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1.5 bg-purple-50 rounded-md">
              <BarChart3 className="h-4 w-4 text-purple-600" />
            </div>
          </div>
          <h3 className="text-xs font-semibold text-gray-900">View Reports</h3>
          <p className="text-[10px] text-gray-500">
            Analytics & insights
          </p>
        </Link>
      </div>

      {/* Recent Activity & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <div className="bg-white rounded-md border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              View All
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
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
        <div className="bg-white rounded-md border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">System Overview</h2>
          </div>

          <div className="p-4 space-y-3">
            {/* Clients */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">Active Clients</span>
                <span className="text-xs font-bold text-gray-900">{stats.totalClients}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div 
                  className="bg-purple-500 h-1.5 rounded-full"
                  style={{ width: `${Math.min((stats.totalClients / 100) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Drivers */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">Active Drivers</span>
                <span className="text-xs font-bold text-gray-900">{stats.totalDrivers}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div 
                  className="bg-amber-500 h-1.5 rounded-full"
                  style={{ width: `${Math.min((stats.totalDrivers / 50) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Completion Rate */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">Completion Rate</span>
                <span className="text-xs font-bold text-gray-900">
                  {stats.totalShipments > 0 
                    ? ((stats.completedShipments / stats.totalShipments) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div 
                  className="bg-green-500 h-1.5 rounded-full"
                  style={{ 
                    width: stats.totalShipments > 0 
                      ? `${(stats.completedShipments / stats.totalShipments) * 100}%`
                      : '0%'
                  }}
                ></div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="pt-2 space-y-1.5">
              <Link href="/dashboard/admin/users">
                <Button variant="outline" className="w-full justify-start h-7 text-xs" size="sm" data-tour="user-management">
                  <Users className="h-3 w-3 mr-1.5" />
                  Manage Users
                </Button>
              </Link>
              <Link href="/dashboard/admin/pricing">
                <Button variant="outline" className="w-full justify-start h-7 text-xs" size="sm" data-tour="pricing-config">
                  <DollarSign className="h-3 w-3 mr-1.5" />
                  Configure Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Alert */}
      {stats.pendingApplications > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-900">
              {stats.pendingApplications} driver application{stats.pendingApplications !== 1 ? 's' : ''} pending review
            </p>
          </div>
          <Link href="/dashboard/admin/applications">
            <Button size="sm" className="h-7 text-xs bg-amber-500 hover:bg-amber-600">
              Review
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      )}

      {/* Benji Chat Widget */}
      <BenjiChat 
        context="dashboard" 
        userId={profile?.id}
        userType="admin"
      />
    </div>
  )
}
