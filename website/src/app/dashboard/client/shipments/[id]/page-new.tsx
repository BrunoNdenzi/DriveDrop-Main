'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState, useRef } from 'react'
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
  XCircle,
  MessageSquare,
  Download,
  RefreshCw,
  Navigation,
  Shield,
  AlertTriangle,
  Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'

interface Shipment {
  id: string
  title: string
  description: string | null
  pickup_address: string
  delivery_address: string
  pickup_date: string | null
  delivery_date: string | null
  estimated_delivery: string | null
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
  weight: number | null
  dimensions: string | null
  notes: string | null
  driver_id: string | null
  client_id: string
  created_at: string
  updated_at: string
  actual_delivery_time: string | null
  delivered_at: string | null
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

interface PickupVerification {
  id: string
  shipment_id: string
  driver_id: string
  verification_status: 'matches' | 'minor_differences' | 'major_issues'
  verification_completed_at: string | null
  client_response: 'approved' | 'disputed' | null
  client_response_at: string | null
  verification_photos: string[]
  notes: string | null
}

interface DriverLocation {
  latitude: number
  longitude: number
  location_timestamp: string
}

interface CancellationEligibility {
  eligible: boolean
  reason?: string
  refund_eligible?: boolean
  refund_amount?: number
  refund_percentage?: number
  message?: string
}

export default function ShipmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [driver, setDriver] = useState<Driver | null>(null)
  const [pickupVerification, setPickupVerification] = useState<PickupVerification | null>(null)
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const realtimeChannelRef = useRef<any>(null)

  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    if (profile?.id && params.id) {
      fetchShipmentDetails()
      loadPickupVerification()
      setupRealtimeSubscription()
    }

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current)
      }
    }
  }, [params.id, profile?.id])

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`shipment:${params.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shipments',
          filter: `id=eq.${params.id}`,
        },
        (payload) => {
          console.log('Shipment updated:', payload.new)
          setShipment(payload.new as Shipment)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations',
          filter: `shipment_id=eq.${params.id}`,
        },
        (payload) => {
          console.log('Driver location updated:', payload.new)
          if (payload.new) {
            setDriverLocation({
              latitude: (payload.new as any).latitude,
              longitude: (payload.new as any).longitude,
              location_timestamp: (payload.new as any).location_timestamp,
            })
          }
        }
      )
      .subscribe()

    realtimeChannelRef.current = channel
  }

  const fetchShipmentDetails = async () => {
    if (!profile?.id || !params.id) return

    setLoading(true)

    try {
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

        // Fetch driver location if in transit
        if (['picked_up', 'in_transit'].includes(shipmentData.status)) {
          const { data: locationData } = await supabase
            .from('driver_locations')
            .select('latitude, longitude, location_timestamp')
            .eq('shipment_id', params.id)
            .order('location_timestamp', { ascending: false })
            .limit(1)
            .single()

          if (locationData) setDriverLocation(locationData)
        }
      }
    } catch (error) {
      console.error('Error fetching shipment:', error)
      toast('Failed to load shipment details', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadPickupVerification = async () => {
    try {
      const { data, error } = await supabase
        .from('pickup_verifications')
        .select('*')
        .eq('shipment_id', params.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching pickup verification:', error)
        return
      }

      if (data) {
        setPickupVerification(data)
        
        // Show modal if verification needs client response
        if (data.verification_status === 'minor_differences' && !data.client_response) {
          setShowVerificationModal(true)
        }
      }
    } catch (err) {
      console.error('Error loading pickup verification:', err)
    }
  }

  const handleVerificationResponse = async (response: 'approved' | 'disputed') => {
    if (!pickupVerification) return

    try {
      const { error } = await supabase
        .from('pickup_verifications')
        .update({
          client_response: response,
          client_response_at: new Date().toISOString(),
        })
        .eq('id', pickupVerification.id)

      if (error) throw error

      toast(
        response === 'approved' 
          ? 'Pickup verified and approved' 
          : 'Verification dispute submitted',
        'success'
      )

      setShowVerificationModal(false)
      loadPickupVerification()
    } catch (error) {
      console.error('Error responding to verification:', error)
      toast('Failed to submit response', 'error')
    }
  }

  const handleCancelShipment = async () => {
    if (!shipment) return

    setCancelling(true)

    try {
      // Check cancellation eligibility
      const { data: eligibilityData, error: eligibilityError } = await supabase
        .rpc('check_cancellation_eligibility', { p_shipment_id: shipment.id })

      if (eligibilityError) throw eligibilityError

      const eligibility = eligibilityData as CancellationEligibility

      if (!eligibility || !eligibility.eligible) {
        toast(eligibility?.reason || 'This shipment cannot be cancelled', 'error')
        setCancelling(false)
        return
      }

      // Show confirmation
      const refundInfo = eligibility.refund_eligible
        ? `\n\nRefund: $${eligibility.refund_amount?.toFixed(2)} (${eligibility.refund_percentage}%)\n${eligibility.message}`
        : '\n\nNo refund available for this cancellation'

      if (!confirm(`Are you sure you want to cancel this shipment?${refundInfo}`)) {
        setCancelling(false)
        return
      }

      // Cancel shipment
      const { error: updateError } = await supabase
        .from('shipments')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', shipment.id)

      if (updateError) throw updateError

      const successMessage = eligibility.refund_eligible
        ? `Shipment cancelled. Refund of $${eligibility.refund_amount?.toFixed(2)} will be processed within 5-10 business days.`
        : 'Shipment cancelled successfully.'

      toast(successMessage, 'success')
      
      setTimeout(() => {
        router.push('/dashboard/client/shipments')
      }, 2000)

    } catch (error) {
      console.error('Error cancelling shipment:', error)
      toast('Failed to cancel shipment', 'error')
    } finally {
      setCancelling(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      assigned: 'bg-blue-100 text-blue-800 border-blue-200',
      accepted: 'bg-blue-100 text-blue-800 border-blue-200',
      driver_en_route: 'bg-purple-100 text-purple-800 border-purple-200',
      driver_arrived: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      pickup_verification_pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      pickup_verified: 'bg-green-100 text-green-800 border-green-200',
      picked_up: 'bg-teal-100 text-teal-800 border-teal-200',
      in_transit: 'bg-orange-100 text-orange-800 border-orange-200',
      delivered: 'bg-green-100 text-green-800 border-green-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
    }
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

  if (!shipment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Shipment Not Found</h2>
          <p className="text-gray-600 mb-6">The shipment you're looking for doesn't exist or you don't have access to it.</p>
          <Link href="/dashboard/client/shipments">
            <Button>Back to Shipments</Button>
          </Link>
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
                href="/dashboard/client/shipments"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="font-medium">Back</span>
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Shipment #{shipment.id.slice(0, 8)}
                </h1>
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border mt-1 ${getStatusColor(shipment.status)}`}>
                  {shipment.status.charAt(0).toUpperCase() + shipment.status.slice(1).replace(/_/g, ' ')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchShipmentDetails}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {driver && (
                <Link href={`/dashboard/client/track/${shipment.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-teal-600 border-teal-600 hover:bg-teal-50"
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Track on Map
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pickup Verification Status */}
            {pickupVerification && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  {pickupVerification.verification_status === 'matches' ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : pickupVerification.verification_status === 'minor_differences' ? (
                    <AlertTriangle className="h-6 w-6 text-yellow-600" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-600" />
                  )}
                  <h2 className="text-xl font-bold text-gray-900">Pickup Verification</h2>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Status:</span>
                    <span className={`font-semibold ${
                      pickupVerification.verification_status === 'matches' ? 'text-green-600' :
                      pickupVerification.verification_status === 'minor_differences' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {pickupVerification.verification_status === 'matches' ? 'Vehicle Matches' :
                       pickupVerification.verification_status === 'minor_differences' ? 'Minor Differences Found' :
                       'Major Issues Reported'}
                    </span>
                  </div>

                  {pickupVerification.verification_completed_at && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Verified at:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatDate(pickupVerification.verification_completed_at)}
                      </span>
                    </div>
                  )}

                  {pickupVerification.verification_status === 'minor_differences' && !pickupVerification.client_response && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                      <div className="flex items-start gap-3">
                        <Clock className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-900 mb-3">
                            Action Required: Please review the verification photos
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => setShowVerificationModal(true)}
                              className="bg-yellow-600 hover:bg-yellow-700"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Review Photos
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {pickupVerification.client_response && (
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Your Response:</span>
                      <span className={`font-semibold ${
                        pickupVerification.client_response === 'approved' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {pickupVerification.client_response === 'approved' ? 'Approved' : 'Disputed'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Shipment Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Shipment Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Created</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(shipment.created_at)}</p>
                </div>
                {shipment.estimated_delivery && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Est. Delivery</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(shipment.estimated_delivery)}</p>
                  </div>
                )}
                {shipment.delivered_at && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Delivered</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(shipment.delivered_at)}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600 mb-1">Price</p>
                  <p className="text-sm font-medium text-gray-900">
                    ${shipment.estimated_price.toFixed(2)}
                  </p>
                </div>
                {shipment.weight && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Weight</p>
                    <p className="text-sm font-medium text-gray-900">{shipment.weight} kg</p>
                  </div>
                )}
                {shipment.dimensions && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Dimensions</p>
                    <p className="text-sm font-medium text-gray-900">{shipment.dimensions}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Addresses */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Addresses</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">From</p>
                  <p className="text-sm text-gray-900">{shipment.pickup_address}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">To</p>
                  <p className="text-sm text-gray-900">{shipment.delivery_address}</p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {shipment.notes && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Notes</h2>
                <p className="text-sm text-gray-700 leading-relaxed">{shipment.notes}</p>
              </div>
            )}

            {/* Actions */}
            {shipment.status === 'pending' && !shipment.driver_id && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <Button
                  onClick={handleCancelShipment}
                  disabled={cancelling}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  {cancelling ? 'Cancelling...' : 'Cancel Shipment'}
                </Button>
              </div>
            )}

            {/* Track on Map */}
            {shipment.status === 'in_transit' && driverLocation && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Track Delivery</h2>
                <Link href={`/dashboard/client/track/${shipment.id}`}>
                  <Button className="w-full">
                    <Navigation className="h-4 w-4 mr-2" />
                    Track on Map
                  </Button>
                </Link>
                {driverLocation && (
                  <p className="text-xs text-gray-600 mt-3 text-center">
                    Last updated: {formatDate(driverLocation.location_timestamp)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Driver Info */}
            {driver && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Driver</h2>
                <div className="flex items-center gap-4 mb-4">
                  {driver.avatar_url ? (
                    <img
                      src={driver.avatar_url}
                      alt={`${driver.first_name} ${driver.last_name}`}
                      className="h-12 w-12 rounded-full"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-teal-100 flex items-center justify-center">
                      <User className="h-6 w-6 text-teal-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">
                      {driver.first_name} {driver.last_name}
                    </p>
                    {driver.rating && (
                      <div className="flex items-center gap-1 text-sm text-yellow-600">
                        <span>★</span>
                        <span>{driver.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span>{driver.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>{driver.phone}</span>
                  </div>
                </div>
                <Button className="w-full mt-4">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Message Driver
                </Button>
              </div>
            )}

            {/* Vehicle Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Vehicle</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {shipment.vehicle_year} {shipment.vehicle_make} {shipment.vehicle_model}
                    </p>
                    <p className="text-xs text-gray-600 capitalize">{shipment.vehicle_type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-600">Operable:</p>
                  <p className="text-sm font-medium text-gray-900">
                    {shipment.is_operable ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Payment</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Estimated Price:</span>
                  <span className="text-lg font-bold text-teal-600">
                    ${shipment.estimated_price.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                  <span className="text-sm text-gray-600">Payment Status:</span>
                  <span className={`text-sm font-semibold ${
                    shipment.payment_status === 'paid' ? 'text-green-600' :
                    shipment.payment_status === 'pending' ? 'text-yellow-600' :
                    'text-gray-600'
                  }`}>
                    {shipment.payment_status.charAt(0).toUpperCase() + shipment.payment_status.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Verification Modal */}
      {showVerificationModal && pickupVerification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Pickup Verification Photos</h2>
                <button
                  onClick={() => setShowVerificationModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                The driver has completed the pickup verification. Please review the photos and approve or dispute.
              </p>
            </div>
            
            <div className="p-6">
              {pickupVerification.verification_photos && pickupVerification.verification_photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {pickupVerification.verification_photos.map((photo: string, index: number) => (
                    <div key={index} className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={photo}
                        alt={`Verification photo ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-600 py-8">No photos available</p>
              )}

              {pickupVerification.notes && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <p className="text-sm font-medium text-gray-900 mb-1">Driver Notes:</p>
                  <p className="text-sm text-gray-700">{pickupVerification.notes}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={() => handleVerificationResponse('approved')}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Verification
                </Button>
                <Button
                  onClick={() => handleVerificationResponse('disputed')}
                  variant="outline"
                  className="flex-1 text-red-600 border-red-600 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Dispute
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
