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
import { BenjiChat } from '@/components/benji/BenjiChat'

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
    <div className="space-y-4" id="client-dashboard">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Welcome back, {profile?.first_name || 'there'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Track your shipments and manage your deliveries
          </p>
        </div>
        <Link href="/dashboard/client/new-shipment" data-tour="create-shipment">
          <Button
            size="sm"
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Shipment
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-md p-4 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-md">
              <Package className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-xs text-gray-500">Total Shipments</p>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.total}</h3>
        </div>

        <div className="bg-white rounded-md p-4 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-50 rounded-md">
              <Truck className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-xs text-gray-500">Active</p>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.active}</h3>
        </div>

        <div className="bg-white rounded-md p-4 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 rounded-md">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-xs text-gray-500">Completed</p>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.completed}</h3>
        </div>

        <div className="bg-white rounded-md p-4 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-md">
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-xs text-gray-500">Total Spent</p>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">
            ${stats.totalSpent.toFixed(2)}
          </h3>
        </div>
      </div>

      {/* Recent Shipments */}
      <div className="bg-white rounded-md border border-gray-200" data-tour="active-shipments">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Recent Shipments</h2>
            <Link href="/dashboard/client/shipments" data-tour="shipment-history">
              <Button variant="ghost" size="sm" className="text-xs h-7">
                View All
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        {shipments.length === 0 ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-gray-100 rounded-md mb-3">
              <Package className="h-5 w-5 text-gray-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              No shipments yet
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Create your first shipment to get started
            </p>
            <Link href="/dashboard/client/new">
              <Button size="sm" className="h-8 text-xs">
                <Plus className="h-3 w-3 mr-1" />
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
                className="block px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-400">
                        #{shipment.id.slice(0, 8)}
                      </span>
                      <span
                        className={`
                          px-2 py-0.5 rounded text-xs font-medium border
                          ${getStatusColor(shipment.status)}
                        `}
                      >
                        {getStatusLabel(shipment.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 text-blue-500 flex-shrink-0" />
                        {shipment.pickup_address}
                      </span>
                      <ArrowRight className="h-3 w-3 text-gray-300 flex-shrink-0" />
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 text-green-500 flex-shrink-0" />
                        {shipment.delivery_address}
                      </span>
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900">
                      ${shipment.estimated_price?.toFixed(2) || '0.00'}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
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
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/dashboard/client/new-shipment"
          className="bg-white rounded-md p-3 border border-gray-200 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-md">
              <Plus className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">New Shipment</h3>
              <p className="text-xs text-gray-500">Create a new delivery</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/client/track"
          className="bg-white rounded-md p-3 border border-gray-200 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-md">
              <MapPin className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">Track Shipment</h3>
              <p className="text-xs text-gray-500">View delivery status</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/client/payments"
          data-tour="payment-methods"
          className="bg-white rounded-md p-3 border border-gray-200 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-md">
              <DollarSign className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">Payments</h3>
              <p className="text-xs text-gray-500">View payment history</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Benji Chat Widget */}
      <BenjiChat 
        context="dashboard" 
        userId={profile?.id}
        userType="client"
      />
    </div>
  )
}
