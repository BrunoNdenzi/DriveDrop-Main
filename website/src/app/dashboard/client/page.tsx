'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import Link from 'next/link'
import { 
  Package, 
  Plus, 
  TrendingUp, 
  Clock,
  CheckCircle,
  Truck,
  MapPin,
  DollarSign,
  ArrowRight,
  Calendar
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Shipment {
  id: string
  pickup_address: string
  delivery_address: string
  status: string
  created_at: string
  estimated_price: number
  title: string
}

export default function ClientDashboardPage() {
  const { profile } = useAuth()
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    totalSpent: 0,
  })
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.id) {
        setLoading(false)
        return
      }

      try {
        // Fetch ALL shipments for stats calculation
        const { data: allShipmentsData, error: statsError } = await supabase
          .from('shipments')
          .select('status, estimated_price')
          .eq('client_id', profile.id)

        if (statsError) {
          console.error('[CLIENT DASHBOARD] Error fetching stats:', statsError)
        } else if (allShipmentsData) {
          // Calculate accurate stats from ALL shipments
          const total = allShipmentsData.length
          const active = allShipmentsData.filter(s => 
            ['assigned', 'accepted', 'driver_en_route', 'driver_arrived', 
             'pickup_verification_pending', 'pickup_verified', 'picked_up', 
             'in_transit', 'in_progress'].includes(s.status)
          ).length
          const completed = allShipmentsData.filter(s => 
            ['delivered', 'completed'].includes(s.status)
          ).length
          const totalSpent = allShipmentsData.reduce((sum, s) => sum + (s.estimated_price || 0), 0)

          setStats({ total, active, completed, totalSpent })
        }

        // Fetch recent 5 shipments for display
        const { data: shipmentsData, error } = await supabase
          .from('shipments')
          .select('id, pickup_address, delivery_address, status, created_at, estimated_price, title')
          .eq('client_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(5)

        if (error) {
          console.error('[CLIENT DASHBOARD] Error fetching shipments:', error)
          setLoading(false)
          return
        }

        if (shipmentsData) {
          setShipments(shipmentsData)
        }
      } catch (error) {
        console.error('[CLIENT DASHBOARD] Error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [profile?.id])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'in_transit':
      case 'picked_up':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'accepted':
        return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'cancelled':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusLabel = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary to-secondary rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {profile?.first_name || 'there'}! 👋
        </h1>
        <p className="text-white/90 mb-6">
          Track your shipments and manage your deliveries all in one place
        </p>
        <Link href="/dashboard/client/new-shipment">
          <Button
            size="lg"
            className="bg-white text-primary hover:bg-white/90 shadow-xl"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create New Shipment
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-gray-600 text-sm mb-1">Total Shipments</p>
          <h3 className="text-3xl font-bold text-gray-900">{stats.total}</h3>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <Truck className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-1">Active Deliveries</p>
          <h3 className="text-3xl font-bold text-gray-900">{stats.active}</h3>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-1">Completed</p>
          <h3 className="text-3xl font-bold text-gray-900">{stats.completed}</h3>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-1">Total Spent</p>
          <h3 className="text-3xl font-bold text-gray-900">
            ${stats.totalSpent.toFixed(2)}
          </h3>
        </div>
      </div>

      {/* Recent Shipments */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Recent Shipments</h2>
            <Link href="/dashboard/client/shipments">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>

        {shipments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Package className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No shipments yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create your first shipment to get started
            </p>
            <Link href="/dashboard/client/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Shipment
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {shipments.map((shipment) => (
              <Link
                key={shipment.id}
                href={`/dashboard/client/shipments/${shipment.id}`}
                className="block p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-mono text-gray-500">
                        #{shipment.id.slice(0, 8)}
                      </span>
                      <span
                        className={`
                          px-3 py-1 rounded-full text-xs font-medium border
                          ${getStatusColor(shipment.status)}
                        `}
                      >
                        {getStatusLabel(shipment.status)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">Pickup</p>
                          <p className="text-gray-600">{shipment.pickup_address}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">Delivery</p>
                          <p className="text-gray-600">{shipment.delivery_address}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-2xl font-bold text-gray-900">
                      ${shipment.estimated_price?.toFixed(2) || '0.00'}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(shipment.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/dashboard/client/new-shipment"
          className="bg-white rounded-xl p-6 border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
              <Plus className="h-6 w-6 text-primary group-hover:text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">New Shipment</h3>
              <p className="text-sm text-gray-600">Create a new delivery</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/client/track"
          className="bg-white rounded-xl p-6 border-2 border-dashed border-gray-300 hover:border-secondary hover:bg-secondary/5 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 rounded-lg group-hover:bg-secondary group-hover:text-white transition-colors">
              <MapPin className="h-6 w-6 text-secondary group-hover:text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Track Shipment</h3>
              <p className="text-sm text-gray-600">View delivery status</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/client/payments"
          className="bg-white rounded-xl p-6 border-2 border-dashed border-gray-300 hover:border-orange-500 hover:bg-orange-50 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 rounded-lg group-hover:bg-orange-500 group-hover:text-white transition-colors">
              <DollarSign className="h-6 w-6 text-orange-600 group-hover:text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Payments</h3>
              <p className="text-sm text-gray-600">View payment history</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
