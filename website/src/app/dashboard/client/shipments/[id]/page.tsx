'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft,
  Package,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  User,
  Phone,
  Mail,
  Truck,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Download,
  Share2,
  MoreVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Messaging from '@/components/messaging/Messaging'

interface Shipment {
  id: string
  title: string
  description: string
  pickup_address: string
  delivery_address: string
  pickup_date: string | null
  delivery_date: string | null
  status: string
  payment_status: string
  estimated_price: number
  final_price: number | null
  vehicle_type: string
  vehicle_make: string
  vehicle_model: string
  vehicle_year: number
  is_operable: boolean
  distance: number
  driver_id: string | null
  created_at: string
  updated_at: string
  client_vehicle_photos: any
  terms_accepted: boolean
}

interface Driver {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  avatar_url: string | null
  rating: number | null
}

interface TrackingEvent {
  id: string
  event_type: string
  notes: string
  created_at: string
  created_by: string
}

const STATUS_TIMELINE = [
  { key: 'pending', label: 'Pending', description: 'Waiting for driver assignment' },
  { key: 'accepted', label: 'Accepted', description: 'Driver assigned and confirmed' },
  { key: 'en_route', label: 'En Route', description: 'Driver heading to pickup location' },
  { key: 'arrived', label: 'Arrived', description: 'Driver at pickup location' },
  { key: 'picked_up', label: 'Picked Up', description: 'Vehicle loaded and secured' },
  { key: 'in_transit', label: 'In Transit', description: 'On the way to delivery' },
  { key: 'delivered', label: 'Delivered', description: 'Vehicle delivered successfully' },
]

export default function ShipmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [driver, setDriver] = useState<Driver | null>(null)
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showMessaging, setShowMessaging] = useState(false)

  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    if (profile?.id && params.id) {
      fetchShipmentDetails()
    }
  }, [params.id, profile?.id])

  const fetchShipmentDetails = async () => {
    if (!profile?.id || !params.id) {
      return
    }

    setLoading(true)

    try {
      // Fetch shipment
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', params.id)
        .eq('client_id', profile.id)
        .single()

      if (shipmentError) throw shipmentError

      setShipment(shipmentData)

      // Fetch driver if assigned
      if (shipmentData.driver_id) {
        const { data: driverData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, phone, avatar_url, rating')
          .eq('id', shipmentData.driver_id)
          .single()

        if (driverData) setDriver(driverData)
      }

      // Fetch tracking events
      const { data: eventsData } = await supabase
        .from('tracking_events')
        .select('*')
        .eq('shipment_id', params.id)
        .order('created_at', { ascending: false })

      if (eventsData) setTrackingEvents(eventsData)

    } catch (error) {
      console.error('Error fetching shipment:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCurrentStatusIndex = () => {
    if (!shipment) return 0
    return STATUS_TIMELINE.findIndex(s => s.key === shipment.status)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set'
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading shipment details...</p>
        </div>
      </div>
    )
  }

  if (!loading && !shipment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Shipment Not Found</h2>
          <p className="text-gray-600 mb-6">This shipment doesn't exist or you don't have access to it.</p>
          <Link href="/dashboard/client/shipments">
            <Button className="bg-teal-600 hover:bg-teal-700">
              Back to Shipments
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Ensure shipment exists before rendering (TypeScript guard)
  if (!shipment) return null

  const currentStatusIndex = getCurrentStatusIndex()
  const isDelivered = shipment.status === 'delivered'
  const isCancelled = shipment.status === 'cancelled'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link 
                href="/dashboard/client/shipments"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="font-medium">Back</span>
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-lg font-semibold text-gray-900">
                {shipment.title}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Receipt
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Timeline */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Tracking Timeline</h2>
              
              <div className="relative">
                {STATUS_TIMELINE.map((step, index) => {
                  const isCompleted = index <= currentStatusIndex
                  const isCurrent = index === currentStatusIndex
                  const isLast = index === STATUS_TIMELINE.length - 1

                  return (
                    <div key={step.key} className="relative pb-8 last:pb-0">
                      {!isLast && (
                        <div
                          className={`absolute left-5 top-11 -ml-px h-full w-0.5 ${
                            isCompleted ? 'bg-teal-600' : 'bg-gray-300'
                          }`}
                        ></div>
                      )}
                      
                      <div className="relative flex items-start group">
                        <div className="flex items-center">
                          <div
                            className={`h-10 w-10 rounded-full flex items-center justify-center border-2 ${
                              isCompleted
                                ? 'bg-teal-600 border-teal-600'
                                : 'bg-white border-gray-300'
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle className="h-6 w-6 text-white" />
                            ) : (
                              <div className="h-3 w-3 rounded-full bg-gray-300"></div>
                            )}
                          </div>
                        </div>
                        
                        <div className="ml-4 flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className={`font-semibold ${
                                isCurrent ? 'text-teal-600' : isCompleted ? 'text-gray-900' : 'text-gray-500'
                              }`}>
                                {step.label}
                              </h3>
                              <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                            </div>
                            {isCurrent && (
                              <span className="px-3 py-1 bg-teal-100 text-teal-800 text-xs font-medium rounded-full">
                                Current
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {isCancelled && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-900">Shipment Cancelled</h4>
                      <p className="text-sm text-red-700 mt-1">
                        This shipment has been cancelled. Please contact support if you have questions.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Shipment Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Shipment Details</h2>
              
              <div className="space-y-6">
                {/* Addresses */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                        <MapPin className="h-4 w-4 text-teal-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Pickup Location</h3>
                    </div>
                    <p className="text-gray-700 ml-10">{shipment.pickup_address}</p>
                    {shipment.pickup_date && (
                      <p className="text-sm text-gray-500 ml-10 mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(shipment.pickup_date)}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                        <MapPin className="h-4 w-4 text-orange-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Delivery Location</h3>
                    </div>
                    <p className="text-gray-700 ml-10">{shipment.delivery_address}</p>
                    {shipment.delivery_date && (
                      <p className="text-sm text-gray-500 ml-10 mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(shipment.delivery_date)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Vehicle Info */}
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3">Vehicle Information</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Type</p>
                      <p className="text-sm font-medium text-gray-900">{shipment.vehicle_type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Make</p>
                      <p className="text-sm font-medium text-gray-900">{shipment.vehicle_make}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Model</p>
                      <p className="text-sm font-medium text-gray-900">{shipment.vehicle_model}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Year</p>
                      <p className="text-sm font-medium text-gray-900">{shipment.vehicle_year}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 uppercase mb-1">Condition</p>
                    <p className="text-sm font-medium text-gray-900">
                      {shipment.is_operable ? 'Operable' : 'Non-Operable'}
                    </p>
                  </div>
                </div>

                {/* Distance */}
                <div className="pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Distance</p>
                      <p className="text-lg font-bold text-gray-900">
                        {shipment.distance.toFixed(0)} miles
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase mb-1">Estimated Time</p>
                      <p className="text-lg font-bold text-gray-900">
                        {Math.ceil(shipment.distance / 500)} days
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Vehicle Photos */}
            {shipment.client_vehicle_photos && (() => {
              try {
                const photos = typeof shipment.client_vehicle_photos === 'string' 
                  ? JSON.parse(shipment.client_vehicle_photos)
                  : shipment.client_vehicle_photos
                
                const hasPhotos = Object.values(photos).some(photo => photo)
                
                if (!hasPhotos) return null
                
                return (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">Vehicle Photos</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {Object.entries(photos).map(([key, value]: [string, any]) => {
                        if (!value) return null
                        return (
                          <div key={key} className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden group">
                            <img
                              src={value}
                              alt={`${key} view`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                              <p className="text-white text-sm font-medium capitalize">{key}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              } catch (error) {
                console.error('Error parsing vehicle photos:', error)
                return null
              }
            })()}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pricing Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Pricing</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Estimated Price</span>
                  <span className="text-2xl font-bold text-gray-900">
                    ${shipment.estimated_price.toFixed(2)}
                  </span>
                </div>
                {shipment.final_price && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Final Price</span>
                    <span className="text-lg font-semibold text-teal-600">
                      ${shipment.final_price.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Payment Status</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      shipment.payment_status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : shipment.payment_status === 'processing'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {shipment.payment_status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Driver Card */}
            {driver && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Your Driver</h3>
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                    {driver.avatar_url ? (
                      <img src={driver.avatar_url} alt={driver.first_name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-white text-2xl font-bold">
                        {driver.first_name.charAt(0)}{driver.last_name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">
                      {driver.first_name} {driver.last_name}
                    </h4>
                    {driver.rating && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-yellow-500">★</span>
                        <span className="text-sm font-medium text-gray-700">
                          {driver.rating.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <a
                    href={`tel:${driver.phone}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Phone className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-700">{driver.phone}</span>
                  </a>
                  <a
                    href={`mailto:${driver.email}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Mail className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-700">{driver.email}</span>
                  </a>
                </div>

                <Button
                  onClick={() => setShowMessaging(true)}
                  className="w-full mt-4 bg-teal-600 hover:bg-teal-700"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Message
                </Button>

                {/* Track Live Location button for active shipments */}
                {['accepted', 'driver_en_route', 'driver_arrived', 'picked_up', 'in_transit', 'in_progress'].includes(shipment.status) && (
                  <Link href={`/dashboard/client/track/${shipment.id}`}>
                    <Button
                      className="w-full mt-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Track Live Location
                    </Button>
                  </Link>
                )}
              </div>
            )}

            {!driver && shipment.status === 'pending' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <Clock className="h-6 w-6 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">
                      Awaiting Driver Assignment
                    </h4>
                    <p className="text-sm text-blue-700">
                      We're matching your shipment with the best available driver. You'll be notified once a driver accepts your request.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Support */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Need Help?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Contact our support team for assistance with your shipment.
              </p>
              <Button variant="outline" className="w-full">
                Contact Support
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Messaging Modal */}
      {showMessaging && driver && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full h-[600px] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900">
                Message {driver.first_name} {driver.last_name}
              </h3>
              <button
                onClick={() => setShowMessaging(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <Messaging
                shipmentId={shipment.id}
                receiverId={driver.id}
                receiverName={`${driver.first_name} ${driver.last_name}`}
                onClose={() => setShowMessaging(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
