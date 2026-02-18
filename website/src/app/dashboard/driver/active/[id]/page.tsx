'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'
import { 
  ArrowLeft, 
  MapPin, 
  Package, 
  DollarSign, 
  Calendar,
  Phone,
  User,
  Navigation,
  Camera,
  CheckCircle,
  Clock,
  Truck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'

interface Shipment {
  id: string
  title: string
  description: string
  pickup_address: string
  delivery_address: string
  pickup_date: string
  estimated_price: number
  distance: number
  status: string
  vehicle_type: string
  vehicle_make: string
  vehicle_model: string
  vehicle_year: number
  is_operable: boolean
  client: {
    first_name: string
    last_name: string
    phone: string
    email: string
  }
  driver_arrival_time: string | null
  actual_pickup_time: string | null
  actual_delivery_time: string | null
}

const STATUS_FLOW = [
  { value: 'accepted', label: 'Accepted', icon: CheckCircle, color: 'blue' },
  { value: 'driver_en_route', label: 'En Route to Pickup', icon: Truck, color: 'indigo' },
  { value: 'driver_arrived', label: 'Arrived at Pickup', icon: MapPin, color: 'purple' },
  { value: 'picked_up', label: 'Vehicle Picked Up', icon: Package, color: 'orange' },
  { value: 'in_transit', label: 'In Transit', icon: Navigation, color: 'yellow' },
  { value: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'green' }
]

export default function DriverShipmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    if (profile?.id && params.id) {
      fetchShipment()
    }
  }, [profile?.id, params.id])

  const fetchShipment = async () => {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          client:profiles!shipments_client_id_fkey (
            first_name,
            last_name,
            phone,
            email
          )
        `)
        .eq('id', params.id)
        .eq('driver_id', profile?.id)
        .single()

      if (error) throw error
      setShipment(data)
    } catch (error) {
      console.error('Error fetching shipment:', error)
      toast('Failed to load shipment details', 'error')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (newStatus: string) => {
    if (!shipment) return

    setUpdating(true)
    try {
      const updates: any = { status: newStatus }

      // Add timestamps based on status
      if (newStatus === 'driver_arrived') {
        updates.driver_arrival_time = new Date().toISOString()
      } else if (newStatus === 'picked_up') {
        updates.actual_pickup_time = new Date().toISOString()
      } else if (newStatus === 'delivered') {
        updates.actual_delivery_time = new Date().toISOString()
      }

      const { error } = await supabase
        .from('shipments')
        .update(updates)
        .eq('id', shipment.id)

      if (error) throw error

      // Create tracking event
      await supabase.from('tracking_events').insert({
        shipment_id: shipment.id,
        event_type: newStatus,
        created_by: profile?.id,
        notes: `Status updated to ${newStatus}`
      })

      toast(`Status updated to ${STATUS_FLOW.find(s => s.value === newStatus)?.label}`, 'success')
      fetchShipment()
    } catch (error) {
      console.error('Error updating status:', error)
      toast('Failed to update status', 'error')
    } finally {
      setUpdating(false)
    }
  }

  const getCurrentStatusIndex = () => {
    if (!shipment) return 0
    return STATUS_FLOW.findIndex(s => s.value === shipment.status)
  }

  const getNextStatus = () => {
    const currentIndex = getCurrentStatusIndex()
    if (currentIndex >= 0 && currentIndex < STATUS_FLOW.length - 1) {
      return STATUS_FLOW[currentIndex + 1]
    }
    return null
  }

  const openGoogleMaps = (address: string) => {
    const encoded = encodeURIComponent(address)
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank')
  }

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading shipment details...</p>
        </div>
      </div>
    )
  }

  if (!shipment) {
    return (
      <div className="min-h-[300px] flex items-center justify-center">
        <div className="text-center">
          <Package className="h-10 w-10 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Shipment Not Found</h3>
          <Link href="/dashboard/driver/active">
            <Button variant="outline">Back to Active Deliveries</Button>
          </Link>
        </div>
      </div>
    )
  }

  const nextStatus = getNextStatus()
  const currentStatusIndex = getCurrentStatusIndex()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border-b">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/driver/active">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-sm font-semibold text-gray-900">{shipment.title}</h1>
                <p className="text-sm text-gray-600">Shipment ID: {shipment.id.slice(0, 8)}</p>
              </div>
            </div>
          </div>
      </div>

      <div className="py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Status Progress */}
            <div className="bg-white rounded-md p-4 border border-gray-200">
              <h2 className="text-lg font-semibold mb-4">Delivery Progress</h2>
              <div className="space-y-4">
                {STATUS_FLOW.map((status, index) => {
                  const Icon = status.icon
                  const isComplete = index < currentStatusIndex
                  const isCurrent = index === currentStatusIndex
                  const isNext = index === currentStatusIndex + 1

                  return (
                    <div key={status.value} className="flex items-center gap-4">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        isComplete ? 'bg-green-500 text-white' :
                        isCurrent ? 'bg-blue-500 text-white' :
                        'bg-gray-200 text-gray-400'
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${isCurrent ? 'text-blue-600' : 'text-gray-900'}`}>
                          {status.label}
                        </p>
                        {isCurrent && (
                          <p className="text-sm text-gray-500">Current Status</p>
                        )}
                      </div>
                      {index < STATUS_FLOW.length - 1 && (
                        <div className={`w-px h-8 ${isComplete ? 'bg-green-500' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Next Action Button */}
              {nextStatus && (
                <div className="mt-4 pt-4 border-t">
                  <Button
                    onClick={() => updateStatus(nextStatus.value)}
                    disabled={updating}
                    className="w-full bg-amber-500 hover:bg-amber-600"
                    size="lg"
                  >
                    {updating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Updating...
                      </>
                    ) : (
                      <>
                        Mark as {nextStatus.label}
                        <nextStatus.icon className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Pickup Location */}
            <div className="bg-white rounded-md p-4 border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-md">
                    <MapPin className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Pickup Location</h3>
                    <p className="text-sm text-gray-500">
                      {shipment.pickup_date && new Date(shipment.pickup_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => openGoogleMaps(shipment.pickup_address)}
                  variant="outline"
                  size="sm"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Navigate
                </Button>
              </div>
              <p className="text-gray-700">{shipment.pickup_address}</p>
            </div>

            {/* Delivery Location */}
            <div className="bg-white rounded-md p-4 border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-md">
                    <MapPin className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Delivery Location</h3>
                    <p className="text-sm text-gray-500">{shipment.distance} miles away</p>
                  </div>
                </div>
                <Button
                  onClick={() => openGoogleMaps(shipment.delivery_address)}
                  variant="outline"
                  size="sm"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Navigate
                </Button>
              </div>
              <p className="text-gray-700">{shipment.delivery_address}</p>
            </div>

            {/* Vehicle Details */}
            <div className="bg-white rounded-md p-4 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Vehicle Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Vehicle</p>
                  <p className="font-medium">
                    {shipment.vehicle_year} {shipment.vehicle_make} {shipment.vehicle_model}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="font-medium capitalize">{shipment.vehicle_type}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Condition</p>
                  <p className="font-medium">{shipment.is_operable ? 'Operable' : 'Not Operable'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Distance</p>
                  <p className="font-medium">{shipment.distance} miles</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Earnings */}
            <div className="bg-amber-500 text-white rounded-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5" />
                <h3 className="font-semibold">Your Earnings</h3>
              </div>
              <p className="text-lg font-bold">${shipment.estimated_price.toFixed(2)}</p>
              <p className="text-amber-100 text-sm mt-1">Payment on delivery</p>
            </div>

            {/* Client Info */}
            <div className="bg-white rounded-md p-4 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Client Information</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium">
                      {shipment.client.first_name} {shipment.client.last_name}
                    </p>
                  </div>
                </div>
                {shipment.client.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <a
                        href={`tel:${shipment.client.phone}`}
                        className="font-medium text-amber-500 hover:text-amber-600"
                      >
                        {shipment.client.phone}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Timestamps */}
            <div className="bg-white rounded-md p-4 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Timeline</h3>
              <div className="space-y-3">
                {shipment.driver_arrival_time && (
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Arrived at Pickup</p>
                      <p className="text-sm font-medium">
                        {new Date(shipment.driver_arrival_time).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
                {shipment.actual_pickup_time && (
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Vehicle Picked Up</p>
                      <p className="text-sm font-medium">
                        {new Date(shipment.actual_pickup_time).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
                {shipment.actual_delivery_time && (
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Delivered</p>
                      <p className="text-sm font-medium">
                        {new Date(shipment.actual_delivery_time).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
