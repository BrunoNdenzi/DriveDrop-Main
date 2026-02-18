'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { 
  Package, 
  MapPin, 
  User, 
  Truck,
  Calendar,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Edit,
  Phone,
  Mail,
  FileText,
  Navigation
} from 'lucide-react'
import Link from 'next/link'
import { BenjiChat } from '@/components/benji/BenjiChat'

interface Shipment {
  id: string
  title: string
  description: string
  pickup_address: string
  pickup_city: string
  pickup_state: string
  pickup_zip: string
  delivery_address: string
  delivery_city: string
  delivery_state: string
  delivery_zip: string
  pickup_date: string
  estimated_delivery_date: string
  estimated_price: number
  final_price: number | null
  total_price: number | null
  distance: number
  status: string
  payment_status: string
  payment_intent_id: string
  created_at: string
  updated_at: string
  vehicle_type: string
  vehicle_make: string
  vehicle_model: string
  vehicle_year: number
  is_operable: boolean
  terms_accepted: boolean
  client_id: string
  driver_id: string | null
  client_vehicle_photos: any
  driver_pickup_photos: any
  driver_delivery_photos: any
  special_instructions: string
  client?: {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string
  }
  driver?: {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string
  }
}

export default function AdminShipmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([])
  const [assigningDriver, setAssigningDriver] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<string>('')
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    fetchProfile()
  }, [])

  useEffect(() => {
    if (params.id) {
      fetchShipment()
      fetchAvailableDrivers()
    }
  }, [params.id])

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (error) throw error
        setProfile(data)
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const fetchShipment = async () => {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          client:profiles!shipments_client_id_fkey (
            id,
            first_name,
            last_name,
            email,
            phone
          ),
          driver:profiles!shipments_driver_id_fkey (
            id,
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .eq('id', params.id)
        .single()

      if (error) throw error
      setShipment(data)
    } catch (error) {
      console.error('Error fetching shipment:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone')
        .eq('role', 'driver')

      if (error) throw error
      setAvailableDrivers(data || [])
    } catch (error) {
      console.error('Error fetching drivers:', error)
    }
  }

  const handleAssignDriver = async () => {
    if (!selectedDriver) return

    setAssigningDriver(true)
    try {
      const { error } = await supabase
        .from('shipments')
        .update({ 
          driver_id: selectedDriver,
          status: 'assigned'
        })
        .eq('id', params.id)

      if (error) throw error

      alert('Driver assigned successfully!')
      fetchShipment()
      setSelectedDriver('')
    } catch (error) {
      console.error('Error assigning driver:', error)
      alert('Failed to assign driver')
    } finally {
      setAssigningDriver(false)
    }
  }

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from('shipments')
        .update({ status: newStatus })
        .eq('id', params.id)

      if (error) throw error

      alert('Status updated successfully!')
      fetchShipment()
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Failed to update status')
    }
  }

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: 'bg-yellow-100 text-yellow-800',
      assigned: 'bg-blue-100 text-blue-800',
      accepted: 'bg-indigo-100 text-indigo-800',
      driver_en_route: 'bg-purple-100 text-purple-800',
      driver_arrived: 'bg-purple-200 text-purple-900',
      pickup_verified: 'bg-orange-100 text-orange-800',
      picked_up: 'bg-orange-200 text-orange-900',
      in_transit: 'bg-cyan-100 text-cyan-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not specified'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="py-12 bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (!shipment) {
    return (
      <div className="py-12 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Shipment Not Found</h2>
          <Link href="/dashboard/admin/shipments">
            <Button>Back to Shipments</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/admin/shipments">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{shipment.title}</h1>
                <p className="text-sm text-gray-600">Shipment ID: {shipment.id.slice(0, 8)}</p>
              </div>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(shipment.status)}`}>
              {shipment.status.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Vehicle Information */}
            <div className="bg-white rounded-md border p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-4 flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Vehicle Information
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Year</p>
                  <p className="font-medium text-gray-900">{shipment.vehicle_year}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Make</p>
                  <p className="font-medium text-gray-900">{shipment.vehicle_make}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Model</p>
                  <p className="font-medium text-gray-900">{shipment.vehicle_model}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Type</p>
                  <p className="font-medium text-gray-900 capitalize">{shipment.vehicle_type}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Condition</p>
                  <p className={`font-medium ${shipment.is_operable ? 'text-green-600' : 'text-orange-600'}`}>
                    {shipment.is_operable ? 'Operable' : 'Non-Operable'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Distance</p>
                  <p className="font-medium text-gray-900">{shipment.distance.toFixed(0)} mi</p>
                </div>
              </div>
            </div>

            {/* Route Information */}
            <div className="bg-white rounded-md border p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Route Details
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-50 rounded-md">
                    <MapPin className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 mb-1">Pickup Location</p>
                    <p className="text-sm text-gray-600">{shipment.pickup_address}</p>
                    <p className="text-xs text-gray-500">{shipment.pickup_city}, {shipment.pickup_state} {shipment.pickup_zip}</p>
                    {shipment.pickup_date && (
                      <p className="text-xs text-gray-500 mt-1">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        {formatDate(shipment.pickup_date)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="border-l-2 border-dashed border-gray-300 ml-4 pl-8 h-8"></div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-md">
                    <Navigation className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 mb-1">Delivery Location</p>
                    <p className="text-sm text-gray-600">{shipment.delivery_address}</p>
                    <p className="text-xs text-gray-500">{shipment.delivery_city}, {shipment.delivery_state} {shipment.delivery_zip}</p>
                    {shipment.estimated_delivery_date && (
                      <p className="text-xs text-gray-500 mt-1">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        Est: {formatDate(shipment.estimated_delivery_date)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Special Instructions */}
            {shipment.special_instructions && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <h3 className="text-sm font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Special Instructions
                </h3>
                <p className="text-sm text-yellow-800">{shipment.special_instructions}</p>
              </div>
            )}

            {/* Description */}
            {shipment.description && (
              <div className="bg-white rounded-md border p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-3">Description</h2>
                <p className="text-gray-600">{shipment.description}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Pricing Information */}
            <div className="bg-white rounded-md border p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pricing
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Estimated Price:</span>
                  <span className="font-semibold text-gray-900">${shipment.estimated_price.toFixed(2)}</span>
                </div>
                {shipment.final_price && (
                  <div className="flex justify-between pt-3 border-t">
                    <span className="text-sm text-gray-600">Final Price:</span>
                    <span className="font-bold text-lg text-gray-900">${shipment.final_price.toFixed(2)}</span>
                  </div>
                )}
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Payment Status:</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      shipment.payment_status === 'completed' ? 'bg-green-100 text-green-800' :
                      shipment.payment_status === 'processing' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {shipment.payment_status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Client Information */}
            {shipment.client && (
              <div className="bg-white rounded-md border p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-4 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Client
                </h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-medium text-gray-900">
                      {shipment.client.first_name} {shipment.client.last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <a href={`mailto:${shipment.client.email}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {shipment.client.email}
                    </a>
                  </div>
                  {shipment.client.phone && (
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <a href={`tel:${shipment.client.phone}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {shipment.client.phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Driver Information or Assignment */}
            {shipment.driver ? (
              <div className="bg-white rounded-md border p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-4 flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Assigned Driver
                </h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-medium text-gray-900">
                      {shipment.driver.first_name} {shipment.driver.last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <a href={`mailto:${shipment.driver.email}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {shipment.driver.email}
                    </a>
                  </div>
                  {shipment.driver.phone && (
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <a href={`tel:${shipment.driver.phone}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {shipment.driver.phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-md border p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-4">Assign Driver</h2>
                <div className="space-y-4">
                  <select
                    value={selectedDriver}
                    onChange={(e) => setSelectedDriver(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select a driver...</option>
                    {availableDrivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.first_name} {driver.last_name}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={handleAssignDriver}
                    disabled={!selectedDriver || assigningDriver}
                    className="w-full"
                  >
                    {assigningDriver ? 'Assigning...' : 'Assign Driver'}
                  </Button>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="bg-white rounded-md border p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Timeline
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span className="font-medium text-gray-900">{formatDate(shipment.created_at)}</span>
                </div>
                {shipment.updated_at !== shipment.created_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Updated:</span>
                    <span className="font-medium text-gray-900">{formatDate(shipment.updated_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-50 rounded-md border p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Link href={`/dashboard/admin/map`}>
                  <Button variant="outline" className="w-full text-sm" size="sm">
                    <MapPin className="h-4 w-4 mr-2" />
                    View on Map
                  </Button>
                </Link>
                {shipment.status !== 'cancelled' && (
                  <Button
                    onClick={() => {
                      if (confirm('Cancel this shipment?')) {
                        handleUpdateStatus('cancelled')
                      }
                    }}
                    variant="destructive"
                    className="w-full text-sm"
                    size="sm"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Shipment
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Benji Chat Widget - Context-aware for admin managing this shipment */}
      <BenjiChat 
        context="shipment" 
        userId={profile?.id}
        userType="admin"
        shipmentId={shipment.id}
      />
    </div>
  )
}
