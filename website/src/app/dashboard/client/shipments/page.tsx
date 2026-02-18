'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import Link from 'next/link'
import { 
  Package, 
  Search,
  Filter,
  MapPin,
  Calendar,
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare,
  Eye,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Shipment {
  id: string
  title: string
  description: string
  pickup_address: string
  delivery_address: string
  pickup_date: string | null
  status: string
  payment_status: string
  estimated_price: number
  vehicle_type: string
  vehicle_make: string
  vehicle_model: string
  vehicle_year: number
  driver_id: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    icon: Clock,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    dotColor: 'bg-yellow-500',
  },
  assigned: {
    label: 'Driver Assigned',
    icon: Truck,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    dotColor: 'bg-blue-500',
  },
  accepted: {
    label: 'Accepted',
    icon: CheckCircle,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    dotColor: 'bg-blue-500',
  },
  driver_en_route: {
    label: 'En Route to Pickup',
    icon: Truck,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    dotColor: 'bg-purple-500',
  },
  driver_arrived: {
    label: 'Driver Arrived',
    icon: MapPin,
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    dotColor: 'bg-indigo-500',
  },
  pickup_verification_pending: {
    label: 'Verifying Pickup',
    icon: Clock,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    dotColor: 'bg-orange-500',
  },
  pickup_verified: {
    label: 'Pickup Verified',
    icon: CheckCircle,
    color: 'bg-teal-100 text-teal-800 border-teal-200',
    dotColor: 'bg-teal-500',
  },
  picked_up: {
    label: 'Picked Up',
    icon: Package,
    color: 'bg-teal-100 text-teal-800 border-teal-200',
    dotColor: 'bg-teal-500',
  },
  in_transit: {
    label: 'In Transit',
    icon: Truck,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    dotColor: 'bg-orange-500',
  },
  in_progress: {
    label: 'In Progress',
    icon: Truck,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    dotColor: 'bg-blue-500',
  },
  delivered: {
    label: 'Delivered',
    icon: CheckCircle,
    color: 'bg-green-100 text-green-800 border-green-200',
    dotColor: 'bg-green-500',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle,
    color: 'bg-green-100 text-green-800 border-green-200',
    dotColor: 'bg-green-500',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    color: 'bg-red-100 text-red-800 border-red-200',
    dotColor: 'bg-red-500',
  },
}

export default function MyShipmentsPage() {
  const { profile } = useAuth()
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [filteredShipments, setFilteredShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [tabFilter, setTabFilter] = useState<'pending' | 'active' | 'past'>('active')

  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    fetchShipments()
  }, [profile?.id])

  useEffect(() => {
    filterShipments()
  }, [shipments, searchQuery, tabFilter])

  const fetchShipments = async () => {
    if (!profile?.id) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('client_id', profile.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setShipments(data || [])
    } catch (error) {
      console.error('Error fetching shipments:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterShipments = () => {
    let filtered = [...shipments]

    // Filter by tab (matching mobile app logic)
    switch (tabFilter) {
      case 'pending':
        filtered = filtered.filter(s => s.status === 'pending')
        break
      case 'active':
        // Include all in-progress lifecycle statuses visible to client
        filtered = filtered.filter(s => 
          ['assigned', 'accepted', 'driver_en_route', 'driver_arrived', 
           'pickup_verification_pending', 'pickup_verified', 'picked_up', 
           'in_transit', 'in_progress'].includes(s.status)
        )
        break
      case 'past':
        // Completed lifecycle statuses
        filtered = filtered.filter(s => 
          ['delivered', 'completed', 'cancelled'].includes(s.status)
        )
        break
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(s => 
        s.title.toLowerCase().includes(query) ||
        s.pickup_address.toLowerCase().includes(query) ||
        s.delivery_address.toLowerCase().includes(query) ||
        s.vehicle_make.toLowerCase().includes(query) ||
        s.vehicle_model.toLowerCase().includes(query)
      )
    }

    setFilteredShipments(filtered)
  }

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  const getStatusCounts = () => {
    return {
      pending: shipments.filter(s => s.status === 'pending').length,
      active: shipments.filter(s => 
        ['assigned', 'accepted', 'driver_en_route', 'driver_arrived',
         'pickup_verification_pending', 'pickup_verified', 'picked_up', 
         'in_transit', 'in_progress'].includes(s.status)
      ).length,
      past: shipments.filter(s => 
        ['delivered', 'completed', 'cancelled'].includes(s.status)
      ).length,
    }
  }

  const counts = getStatusCounts()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading shipments...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-blue-500" />
          <h1 className="text-lg font-bold text-gray-900">My Shipments</h1>
        </div>
        <Link href="/dashboard/client/new-shipment">
          <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white h-8 text-xs">
            <Package className="h-3 w-3 mr-1" />
            New Shipment
          </Button>
        </Link>
      </div>

      <div>
        {/* Tab Navigation */}
        <div className="bg-white rounded-md border border-gray-200 p-1 inline-flex gap-1 mb-4">
          <button
            onClick={() => setTabFilter('pending')}
            className={`px-4 py-1.5 rounded text-xs font-semibold transition-colors ${
              tabFilter === 'pending'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Pending
            {counts.pending > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs font-bold ${
                tabFilter === 'pending' ? 'bg-blue-600' : 'bg-gray-200 text-gray-700'
              }`}>
                {counts.pending}
              </span>
            )}
          </button>
          <button
            onClick={() => setTabFilter('active')}
            className={`px-4 py-1.5 rounded text-xs font-semibold transition-colors ${
              tabFilter === 'active'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Active
            {counts.active > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs font-bold ${
                tabFilter === 'active' ? 'bg-blue-600' : 'bg-gray-200 text-gray-700'
              }`}>
                {counts.active}
              </span>
            )}
          </button>
          <button
            onClick={() => setTabFilter('past')}
            className={`px-4 py-1.5 rounded text-xs font-semibold transition-colors ${
              tabFilter === 'past'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Past
            {counts.past > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs font-bold ${
                tabFilter === 'past' ? 'bg-blue-600' : 'bg-gray-200 text-gray-700'
              }`}>
                {counts.past}
              </span>
            )}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-md border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Pending</p>
                <p className="text-xl font-bold text-yellow-600">{counts.pending}</p>
              </div>
              <div className="w-8 h-8 bg-yellow-50 rounded-md flex items-center justify-center">
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Active</p>
                <p className="text-xl font-bold text-blue-600">{counts.active}</p>
              </div>
              <div className="w-8 h-8 bg-blue-50 rounded-md flex items-center justify-center">
                <Truck className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Past</p>
                <p className="text-xl font-bold text-gray-600">{counts.past}</p>
              </div>
              <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-gray-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-md border border-gray-200 p-2 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by vehicle, address, or shipment ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
        </div>

        {/* Shipments List */}
        {filteredShipments.length === 0 ? (
          <div className="bg-white rounded-md border border-gray-200 p-8 text-center">
            <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              {shipments.length === 0 ? 'No shipments yet' : `No ${tabFilter} shipments`}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {shipments.length === 0 
                ? 'Create your first shipment to get started with vehicle transport.'
                : `You don't have any ${tabFilter} shipments${searchQuery ? ' matching your search' : ''}.`}
            </p>
            {shipments.length === 0 && (
              <Link href="/dashboard/client/new-shipment">
                <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white h-8 text-xs">
                  <Package className="h-3 w-3 mr-1" />
                  Create New Shipment
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredShipments.map((shipment) => {
              const statusConfig = getStatusConfig(shipment.status)
              const StatusIcon = statusConfig.icon

              return (
                <div
                  key={shipment.id}
                  className="bg-white rounded-md border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-gray-900">
                            {shipment.title}
                          </h3>
                          <div className={`px-2 py-0.5 rounded text-xs font-medium border flex items-center gap-1 ${statusConfig.color}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`}></div>
                            {statusConfig.label}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">{shipment.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">
                          ${shipment.estimated_price.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400">Estimated</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {/* Pickup */}
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                          <MapPin className="h-3 w-3 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-400 uppercase">Pickup</p>
                          <p className="text-xs text-gray-900">{shipment.pickup_address}</p>
                          {shipment.pickup_date && (
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(shipment.pickup_date)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Delivery */}
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 bg-green-50 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                          <MapPin className="h-3 w-3 text-green-500" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-400 uppercase">Delivery</p>
                          <p className="text-xs text-gray-900">{shipment.delivery_address}</p>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(shipment.created_at)}
                        </span>
                        {shipment.driver_id && (
                          <span className="flex items-center gap-1 text-green-600">
                            <Truck className="h-3 w-3" />
                            Driver Assigned
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {shipment.driver_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-blue-600 border-blue-300 hover:bg-blue-50"
                          >
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Message
                          </Button>
                        )}
                        <Link href={`/dashboard/client/shipments/${shipment.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Details
                            <ChevronRight className="h-3 w-3 ml-0.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {filteredShipments.length > 0 && (
          <div className="mt-4 text-center text-xs text-gray-400">
            Showing {filteredShipments.length} of {shipments.length} shipment{shipments.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
