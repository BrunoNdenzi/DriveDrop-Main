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
  accepted: {
    label: 'Accepted',
    icon: CheckCircle,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    dotColor: 'bg-blue-500',
  },
  en_route: {
    label: 'En Route to Pickup',
    icon: Truck,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    dotColor: 'bg-purple-500',
  },
  arrived: {
    label: 'Driver Arrived',
    icon: MapPin,
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    dotColor: 'bg-indigo-500',
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
  delivered: {
    label: 'Delivered',
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading shipments...</p>
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
            <div className="flex items-center gap-4">
              <Link 
                href="/dashboard/client"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="font-medium">Dashboard</span>
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Package className="h-6 w-6 text-teal-600" />
                My Shipments
              </h1>
            </div>
            <Link href="/dashboard/client/new-shipment">
              <Button className="bg-teal-600 hover:bg-teal-700">
                <Package className="h-4 w-4 mr-2" />
                New Shipment
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation (like mobile) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 inline-flex gap-2 mb-6">
          <button
            onClick={() => setTabFilter('pending')}
            className={`px-6 py-2.5 rounded-md text-sm font-semibold transition-colors ${
              tabFilter === 'pending'
                ? 'bg-teal-600 text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Pending
            {counts.pending > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                tabFilter === 'pending' ? 'bg-teal-700' : 'bg-gray-200 text-gray-700'
              }`}>
                {counts.pending}
              </span>
            )}
          </button>
          <button
            onClick={() => setTabFilter('active')}
            className={`px-6 py-2.5 rounded-md text-sm font-semibold transition-colors ${
              tabFilter === 'active'
                ? 'bg-teal-600 text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Active
            {counts.active > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                tabFilter === 'active' ? 'bg-teal-700' : 'bg-gray-200 text-gray-700'
              }`}>
                {counts.active}
              </span>
            )}
          </button>
          <button
            onClick={() => setTabFilter('past')}
            className={`px-6 py-2.5 rounded-md text-sm font-semibold transition-colors ${
              tabFilter === 'past'
                ? 'bg-teal-600 text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Past
            {counts.past > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                tabFilter === 'past' ? 'bg-teal-700' : 'bg-gray-200 text-gray-700'
              }`}>
                {counts.past}
              </span>
            )}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending</p>
                <p className="text-3xl font-bold text-yellow-600">{counts.pending}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active</p>
                <p className="text-3xl font-bold text-orange-600">{counts.active}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Truck className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Past</p>
                <p className="text-3xl font-bold text-gray-600">{counts.past}</p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-gray-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by vehicle, address, or shipment ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Shipments List */}
        {filteredShipments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {shipments.length === 0 ? 'No shipments yet' : `No ${tabFilter} shipments`}
            </h3>
            <p className="text-gray-600 mb-6">
              {shipments.length === 0 
                ? 'Create your first shipment to get started with vehicle transport.'
                : `You don't have any ${tabFilter} shipments${searchQuery ? ' matching your search' : ''}.`}
            </p>
            {shipments.length === 0 && (
              <Link href="/dashboard/client/new-shipment">
                <Button className="bg-teal-600 hover:bg-teal-700">
                  <Package className="h-4 w-4 mr-2" />
                  Create New Shipment
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredShipments.map((shipment) => {
              const statusConfig = getStatusConfig(shipment.status)
              const StatusIcon = statusConfig.icon

              return (
                <div
                  key={shipment.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {shipment.title}
                          </h3>
                          <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${statusConfig.color}`}>
                            <div className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`}></div>
                            {statusConfig.label}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">{shipment.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-teal-600">
                          ${shipment.estimated_price.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">Estimated</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Pickup */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                          <MapPin className="h-4 w-4 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Pickup</p>
                          <p className="text-sm text-gray-900">{shipment.pickup_address}</p>
                          {shipment.pickup_date && (
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(shipment.pickup_date)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Delivery */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                          <MapPin className="h-4 w-4 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Delivery</p>
                          <p className="text-sm text-gray-900">{shipment.delivery_address}</p>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(shipment.created_at)}
                        </span>
                        {shipment.driver_id && (
                          <span className="flex items-center gap-1 text-green-600">
                            <Truck className="h-4 w-4" />
                            Driver Assigned
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {shipment.driver_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-teal-600 border-teal-600 hover:bg-teal-50"
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Message
                          </Button>
                        )}
                        <Link href={`/dashboard/client/shipments/${shipment.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                            <ChevronRight className="h-4 w-4 ml-1" />
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

        {/* Results Count */}
        {filteredShipments.length > 0 && (
          <div className="mt-6 text-center text-sm text-gray-600">
            Showing {filteredShipments.length} of {shipments.length} shipment{shipments.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
