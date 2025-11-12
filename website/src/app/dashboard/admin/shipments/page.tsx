'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import Link from 'next/link'
import {
  Package,
  MapPin,
  Search,
  Filter,
  User,
  Truck,
  Calendar,
  DollarSign,
  Edit,
  X,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Shipment {
  id: string
  title: string
  pickup_address: string
  delivery_address: string
  estimated_price: number
  final_price: number | null
  distance: number
  status: string
  payment_status: string
  created_at: string
  pickup_date: string
  vehicle_type: string
  vehicle_make: string
  vehicle_model: string
  client_id: string
  driver_id: string | null
  client?: {
    first_name: string
    last_name: string
    email: string
  }
  driver?: {
    first_name: string
    last_name: string
    email: string
  }
}

export default function AdminShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [filteredShipments, setFilteredShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('all')
  const [assigningDriver, setAssigningDriver] = useState<string | null>(null)
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([])
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    fetchShipments()
    fetchDrivers()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [shipments, searchQuery, filterStatus, filterPaymentStatus])

  const fetchShipments = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          client:profiles!shipments_client_id_fkey (
            first_name,
            last_name,
            email
          ),
          driver:profiles!shipments_driver_id_fkey (
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setShipments(data || [])
    } catch (error) {
      console.error('Error fetching shipments:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, rating')
        .eq('role', 'driver')
        .order('rating', { ascending: false })

      if (error) throw error
      setAvailableDrivers(data || [])
    } catch (error) {
      console.error('Error fetching drivers:', error)
    }
  }

  const applyFilters = () => {
    let filtered = [...shipments]

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(shipment =>
        shipment.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.pickup_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.delivery_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.client?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.driver?.email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => s.status === filterStatus)
    }

    // Payment status filter
    if (filterPaymentStatus !== 'all') {
      filtered = filtered.filter(s => s.payment_status === filterPaymentStatus)
    }

    setFilteredShipments(filtered)
  }

  const handleAssignDriver = async (shipmentId: string, driverId: string) => {
    try {
      const { error } = await supabase
        .from('shipments')
        .update({
          driver_id: driverId,
          status: 'accepted'
        })
        .eq('id', shipmentId)

      if (error) throw error

      alert('Driver assigned successfully!')
      fetchShipments()
      setAssigningDriver(null)
    } catch (error) {
      console.error('Error assigning driver:', error)
      alert('Failed to assign driver')
    }
  }

  const handleCancelShipment = async (shipmentId: string) => {
    if (!confirm('Are you sure you want to cancel this shipment?')) return

    try {
      const { error } = await supabase
        .from('shipments')
        .update({ status: 'cancelled' })
        .eq('id', shipmentId)

      if (error) throw error

      alert('Shipment cancelled successfully')
      fetchShipments()
    } catch (error) {
      console.error('Error cancelling shipment:', error)
      alert('Failed to cancel shipment')
    }
  }

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-blue-100 text-blue-800',
      en_route: 'bg-purple-100 text-purple-800',
      arrived: 'bg-indigo-100 text-indigo-800',
      picked_up: 'bg-orange-100 text-orange-800',
      in_transit: 'bg-cyan-100 text-cyan-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getPaymentStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: 'bg-orange-100 text-orange-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not specified'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Shipment Management</h1>
              <p className="text-sm text-gray-600">{filteredShipments.length} shipments</p>
            </div>
            <Link href="/dashboard/admin">
              <Button variant="outline" size="sm">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search shipments..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shipment Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="en_route">En Route</option>
                <option value="arrived">Arrived</option>
                <option value="picked_up">Picked Up</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Payment Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Status
              </label>
              <select
                value={filterPaymentStatus}
                onChange={(e) => setFilterPaymentStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Payments</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Shipments List */}
        {filteredShipments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Shipments Found
            </h3>
            <p className="text-gray-600">
              {shipments.length === 0
                ? "There are no shipments in the system yet."
                : "No shipments match your filters. Try adjusting your search criteria."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredShipments.map((shipment) => (
              <div
                key={shipment.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  {/* Shipment Details */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {shipment.title || `${shipment.vehicle_make} ${shipment.vehicle_model}`}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(shipment.status)}`}>
                            {shipment.status}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(shipment.payment_status)}`}>
                            Payment: {shipment.payment_status}
                          </span>
                          <span className="text-xs text-gray-500">
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {formatDate(shipment.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Client & Driver Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                          <User className="h-3 w-3" /> Client
                        </p>
                        {shipment.client && (
                          <p className="text-sm font-medium text-gray-900">
                            {shipment.client.first_name} {shipment.client.last_name}
                          </p>
                        )}
                      </div>
                      <div className="bg-orange-50 rounded-lg p-3">
                        <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                          <Truck className="h-3 w-3" /> Driver
                        </p>
                        {shipment.driver ? (
                          <p className="text-sm font-medium text-gray-900">
                            {shipment.driver.first_name} {shipment.driver.last_name}
                          </p>
                        ) : (
                          <p className="text-sm text-orange-600">Not assigned</p>
                        )}
                      </div>
                    </div>

                    {/* Addresses */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium">From:</span> {shipment.pickup_address}
                        </div>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium">To:</span> {shipment.delivery_address}
                        </div>
                      </div>
                    </div>

                    {/* Price & Distance */}
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        ${(shipment.final_price || shipment.estimated_price).toFixed(2)}
                      </span>
                      <span>{shipment.distance.toFixed(0)} miles</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="lg:w-64 flex flex-col gap-2">
                    {!shipment.driver_id && shipment.status === 'pending' && (
                      <>
                        {assigningDriver === shipment.id ? (
                          <div className="space-y-2">
                            <select
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAssignDriver(shipment.id, e.target.value)
                                }
                              }}
                            >
                              <option value="">Select Driver</option>
                              {availableDrivers.map((driver) => (
                                <option key={driver.id} value={driver.id}>
                                  {driver.first_name} {driver.last_name} ({driver.rating?.toFixed(1) || '0.0'}★)
                                </option>
                              ))}
                            </select>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => setAssigningDriver(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => setAssigningDriver(shipment.id)}
                          >
                            <Truck className="h-4 w-4 mr-2" />
                            Assign Driver
                          </Button>
                        )}
                      </>
                    )}

                    <Link href={`/dashboard/client/shipments/${shipment.id}`} className="w-full">
                      <Button variant="outline" size="sm" className="w-full">
                        View Details
                      </Button>
                    </Link>

                    {shipment.status !== 'delivered' && shipment.status !== 'cancelled' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={() => handleCancelShipment(shipment.id)}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel Shipment
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
