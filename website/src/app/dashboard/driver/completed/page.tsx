'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/components/ui/toast'
import { 
  CheckCircle,
  MapPin,
  Truck,
  Calendar,
  Download,
  Eye,
  DollarSign,
  Star
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface CompletedShipment {
  id: string
  title: string
  pickup_address: string
  delivery_address: string
  pickup_city: string
  delivery_city: string
  estimated_price: number
  distance: number
  status: string
  vehicle_make: string
  vehicle_model: string
  vehicle_year: number
  created_at: string
  actual_delivery_time: string | null
  completed_at: string | null
  driver_id: string
  client_id: string
  client: {
    id: string
    first_name: string
    last_name: string
    email: string
    avatar_url: string | null
  }
}

type TimeFilter = '30days' | '3months' | '1year' | 'all'

export default function CompletedShipmentsPage() {
  const { profile } = useAuth()
  const [shipments, setShipments] = useState<CompletedShipment[]>([])
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30days')
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    if (profile?.id) {
      fetchCompletedShipments()
    }
  }, [profile?.id, timeFilter])

  const fetchCompletedShipments = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('shipments')
        .select(`
          *,
          client:profiles!shipments_client_id_fkey (
            id,
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .eq('driver_id', profile?.id)
        .in('status', ['delivered', 'completed'])
        .order('actual_delivery_time', { ascending: false })

      // Apply time filter
      if (timeFilter !== 'all') {
        const now = new Date()
        let startDate: Date

        switch (timeFilter) {
          case '30days':
            startDate = new Date(now.setDate(now.getDate() - 30))
            break
          case '3months':
            startDate = new Date(now.setMonth(now.getMonth() - 3))
            break
          case '1year':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1))
            break
          default:
            startDate = new Date(0)
        }

        query = query.gte('actual_delivery_time', startDate.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      setShipments(data || [])
    } catch (error) {
      console.error('Error fetching completed shipments:', error)
      toast('Failed to load completed shipments', 'error')
    } finally {
      setLoading(false)
    }
  }

  const totalEarnings = shipments.reduce((sum, s) => sum + (s.estimated_price * 0.9), 0)
  const totalDeliveries = shipments.length
  const totalMiles = shipments.reduce((sum, s) => sum + s.distance, 0)

  const getTimeFilterLabel = (filter: TimeFilter) => {
    switch (filter) {
      case '30days': return 'Last 30 Days'
      case '3months': return 'Last 3 Months'
      case '1year': return 'Last Year'
      case 'all': return 'All Time'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Completed Shipments</h1>
          <p className="text-gray-600 mt-1">View your delivery history and earnings</p>
        </div>

        {/* Time Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 font-medium">Filter:</span>
          <div className="bg-white rounded-md border border-gray-200 p-1 inline-flex">
            {(['30days', '3months', '1year', 'all'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeFilter === filter
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {getTimeFilterLabel(filter)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-md p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-gray-600">Total Earnings</p>
          </div>
          <p className="text-lg font-bold text-green-600">${totalEarnings.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">From {totalDeliveries} deliveries</p>
        </div>

        <div className="bg-white border rounded-md p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            <p className="text-sm font-medium text-gray-600">Completed Deliveries</p>
          </div>
          <p className="text-lg font-bold text-blue-600">{totalDeliveries}</p>
          <p className="text-sm text-gray-500 mt-1">{getTimeFilterLabel(timeFilter)}</p>
        </div>

        <div className="bg-white border rounded-md p-4">
          <div className="flex items-center gap-2 mb-2">
            <Truck className="h-5 w-5 text-purple-600" />
            <p className="text-sm font-medium text-gray-600">Total Miles Driven</p>
          </div>
          <p className="text-lg font-bold text-purple-600">{totalMiles.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">
            Avg: {totalDeliveries > 0 ? Math.round(totalMiles / totalDeliveries) : 0} miles/delivery
          </p>
        </div>
      </div>

      {/* Shipments List */}
      <div className="space-y-4">
        {shipments.length === 0 ? (
          <div className="bg-white rounded-md p-8 text-center border border-gray-200">
            <CheckCircle className="h-8 w-8 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Completed Deliveries Yet
            </h3>
            <p className="text-gray-600 mb-4">
              Complete your first delivery to see it here.
            </p>
            <Link href="/dashboard/driver/active">
              <Button>View Active Deliveries</Button>
            </Link>
          </div>
        ) : (
          shipments.map((shipment) => (
            <div key={shipment.id} className="bg-white rounded-md p-4 border border-gray-200 transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  {/* Status Badge */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">
                      <CheckCircle className="h-3 w-3" />
                      Delivered
                    </span>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      {shipment.actual_delivery_time
                        ? new Date(shipment.actual_delivery_time).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })
                        : 'Date unavailable'}
                    </div>
                  </div>

                  {/* Vehicle */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {shipment.vehicle_year} {shipment.vehicle_make} {shipment.vehicle_model}
                  </h3>

                  {/* Client */}
                  <div className="flex items-center gap-2 mb-4">
                    {shipment.client.avatar_url ? (
                      <img
                        src={shipment.client.avatar_url}
                        alt={`${shipment.client.first_name} ${shipment.client.last_name}`}
                        className="h-6 w-6 rounded-full"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600">
                        {shipment.client.first_name?.[0]}{shipment.client.last_name?.[0]}
                      </div>
                    )}
                    <span className="text-sm text-gray-600">
                      {shipment.client.first_name} {shipment.client.last_name}
                    </span>
                    <div className="flex items-center gap-0.5 ml-2">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium text-gray-700">4.8</span>
                    </div>
                  </div>
                </div>

                {/* Earnings */}
                <div className="text-right ml-4">
                  <p className="text-sm text-gray-600">Earnings (90%)</p>
                  <p className="text-lg font-bold text-green-600">
                    ${(shipment.estimated_price * 0.9).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Total: ${shipment.estimated_price.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Route */}
              <div className="space-y-2 mb-4 bg-gray-50 rounded-md p-4">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm flex-1">
                    <p className="font-medium text-gray-900">Pickup</p>
                    <p className="text-gray-600">{shipment.pickup_address}</p>
                  </div>
                </div>
                <div className="border-l-2 border-gray-300 h-4 ml-2"></div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm flex-1">
                    <p className="font-medium text-gray-900">Delivery</p>
                    <p className="text-gray-600">{shipment.delivery_address}</p>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="flex items-center gap-4 text-sm text-gray-600 border-t border-gray-200 pt-4">
                <div className="flex items-center gap-1">
                  <Truck className="h-4 w-4" />
                  <span className="font-medium">{shipment.distance} miles</span>
                </div>
                <div className="flex-1"></div>

                {/* Actions */}
                <Link href={`/dashboard/driver/active/${shipment.id}`}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Eye className="h-4 w-4" />
                    View Details
                  </Button>
                </Link>
                <Button variant="outline" size="sm" className="gap-2" disabled>
                  <Download className="h-4 w-4" />
                  Receipt
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Export Section */}
      {shipments.length > 0 && (
        <div className="bg-gray-50 rounded-md p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Export Your Records</h3>
              <p className="text-sm text-gray-600">
                Download a CSV file of all completed deliveries for your records.
              </p>
            </div>
            <Button variant="outline" className="gap-2" disabled>
              <Download className="h-4 w-4" />
              Export to CSV
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
