'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { toast } from '@/components/ui/toast'
import { OptimizedLink } from '@/components/ui/optimized-link'
import { 
  Camera, 
  MapPin, 
  CheckCircle2, 
  X, 
  ChevronLeft,
  Loader2,
  DollarSign,
  FileCheck,
  MessageCircle
} from 'lucide-react'

interface DeliveryPhoto {
  id: string
  label: string
  description: string
  captured: boolean
  file?: File
  preview?: string
}

const DELIVERY_PHOTOS: Omit<DeliveryPhoto, 'captured'>[] = [
  {
    id: 'delivered_location',
    label: 'Delivery Location',
    description: 'Photo showing vehicle at delivery address'
  },
  {
    id: 'odometer_delivery',
    label: 'Final Odometer',
    description: 'Clear photo of odometer reading at delivery'
  },
  {
    id: 'vehicle_condition',
    label: 'Vehicle Condition',
    description: 'Overall condition of vehicle at delivery'
  },
  {
    id: 'handover',
    label: 'Handover Photo (Optional)',
    description: 'Photo with client receiving vehicle'
  }
]

export default function DeliveryCompletePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [shipment, setShipment] = useState<any>(null)
  const [photos, setPhotos] = useState<DeliveryPhoto[]>(
    DELIVERY_PHOTOS.map(req => ({ ...req, captured: false }))
  )
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [clientPresent, setClientPresent] = useState(true)
  const [clientName, setClientName] = useState('')
  const [clientSignature, setClientSignature] = useState('')

  useEffect(() => {
    if (profile) {
      fetchShipment()
      getCurrentLocation()
    }
  }, [profile, params.id])

  const fetchShipment = async () => {
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          client:profiles!shipments_client_id_fkey (
            id,
            first_name,
            last_name,
            phone,
            email
          ),
          payment:payments!payments_shipment_id_fkey (
            id,
            amount,
            driver_payout,
            status
          )
        `)
        .eq('id', params.id)
        .single()

      if (error) throw error

      // Pre-fill client name
      if (data.client) {
        setClientName(`${data.client.first_name} ${data.client.last_name}`)
      }

      setShipment(data)
    } catch (error) {
      console.error('Error fetching shipment:', error)
      toast('Failed to load shipment details', 'error')
      router.push('/dashboard/driver/active')
    } finally {
      setLoading(false)
    }
  }

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          })
        },
        (error) => {
          console.error('Location error:', error)
          toast('Unable to get location. Please enable location services.', 'error')
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    }
  }

  const handlePhotoCapture = (photoId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast('Please select an image file', 'error')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast('Image size must be less than 10MB', 'error')
      return
    }

    const preview = URL.createObjectURL(file)

    setPhotos(prev => prev.map(photo => 
      photo.id === photoId 
        ? { ...photo, captured: true, file, preview }
        : photo
    ))

    toast('Photo captured', 'success')
  }

  const removePhoto = (photoId: string) => {
    setPhotos(prev => prev.map(photo => {
      if (photo.id === photoId) {
        if (photo.preview) {
          URL.revokeObjectURL(photo.preview)
        }
        return { ...photo, captured: false, file: undefined, preview: undefined }
      }
      return photo
    }))
  }

  const uploadPhotos = async () => {
    const supabase = getSupabaseBrowserClient()
    const uploadedUrls: { [key: string]: string } = {}

    for (const photo of photos) {
      if (photo.file) {
        const fileName = `${params.id}_delivery_${photo.id}_${Date.now()}.jpg`
        const filePath = `delivery-confirmations/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('vehicle-photos')
          .upload(filePath, photo.file)

        if (uploadError) {
          throw new Error(`Failed to upload ${photo.label}`)
        }

        const { data: { publicUrl } } = supabase.storage
          .from('vehicle-photos')
          .getPublicUrl(filePath)

        uploadedUrls[photo.id] = publicUrl
      }
    }

    return uploadedUrls
  }

  const handleSubmit = async () => {
    // Validation
    const requiredPhotos = photos.filter(p => p.id !== 'handover')
    const missingPhotos = requiredPhotos.filter(p => !p.captured)

    if (missingPhotos.length > 0) {
      toast(`Please capture required photos: ${missingPhotos.map(p => p.label).join(', ')}`, 'error')
      return
    }

    if (!location) {
      toast('Location verification required', 'error')
      return
    }

    if (clientPresent && !clientName.trim()) {
      toast('Please enter client name for confirmation', 'error')
      return
    }

    setSubmitting(true)

    try {
      const supabase = getSupabaseBrowserClient()

      // Upload photos
      toast('Uploading delivery photos...', 'info')
      const photoUrls = await uploadPhotos()

      const deliveryTime = new Date().toISOString()

      // Create delivery confirmation record
      const confirmationData = {
        shipment_id: params.id,
        driver_id: profile?.id,
        delivery_latitude: location.latitude,
        delivery_longitude: location.longitude,
        delivery_photos: photoUrls,
        client_present: clientPresent,
        client_name: clientPresent ? clientName : null,
        client_signature: clientPresent ? clientSignature : null,
        delivery_notes: deliveryNotes || null,
        delivered_at: deliveryTime
      }

      const { error: confirmationError } = await supabase
        .from('delivery_confirmations')
        .insert(confirmationData)

      if (confirmationError) {
        console.error('Delivery confirmation error:', confirmationError)
        // Continue even if this table doesn't exist yet
      }

      // Update shipment status to delivered
      const { error: shipmentError } = await supabase
        .from('shipments')
        .update({ 
          status: 'delivered',
          actual_delivery_time: deliveryTime
        })
        .eq('id', params.id)

      if (shipmentError) throw shipmentError

      // Close conversation for privacy - messages no longer accessible after delivery
      await supabase
        .from('conversations')
        .update({ 
          is_active: false,
          expires_at: deliveryTime 
        })
        .eq('shipment_id', params.id)

      // Create tracking event
      await supabase
        .from('tracking_events')
        .insert({
          shipment_id: params.id,
          event_type: 'delivered',
          description: `Vehicle delivered successfully${clientPresent ? ' and received by client' : ''}`,
          metadata: {
            location: location,
            client_present: clientPresent,
            photos_count: Object.keys(photoUrls).length
          },
          created_by: profile?.id
        })

      // Update payment status to completed
      if (shipment.payment && shipment.payment.length > 0) {
        const payment = shipment.payment[0]
        
        // First, capture the remaining 80% payment
        try {
          const captureResponse = await fetch('/api/stripe/capture-remaining', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentIntentId: payment.payment_intent_id,
              shipmentId: params.id,
              driverId: profile?.id,
            }),
          })

          const captureResult = await captureResponse.json()

          if (!captureResponse.ok) {
            throw new Error(captureResult.error || 'Failed to capture remaining payment')
          }

          console.log('✅ Remaining payment (80%) captured:', captureResult)
          toast('Final payment captured successfully! 💰', 'success')
        } catch (captureError: any) {
          console.error('❌ Error capturing remaining payment:', captureError)
          toast(`Warning: ${captureError.message}. Please contact support.`, 'error')
          // Don't fail delivery completion if payment capture fails
        }

        // Update payment record
        await supabase
          .from('payments')
          .update({ 
            status: 'completed',
            completed_at: deliveryTime
          })
          .eq('id', payment.id)

        // Trigger payout to driver (this would normally be handled by a webhook/cron)
        await supabase.functions.invoke('process-driver-payout', {
          body: {
            shipment_id: params.id,
            driver_id: profile?.id,
            amount: payment.driver_payout
          }
        })
      }

      // Send completion notification to client
      await supabase.functions.invoke('send-notification', {
        body: {
          user_id: shipment.client_id,
          type: 'delivery_completed',
          title: 'Delivery Complete!',
          message: `Your ${shipment.vehicle_year} ${shipment.vehicle_make} ${shipment.vehicle_model} has been delivered successfully.`,
          data: {
            shipment_id: params.id
          }
        }
      })

      toast('Delivery completed successfully! 🎉', 'success')
      
      // Redirect to earnings or completed deliveries
      setTimeout(() => {
        router.push('/dashboard/driver/earnings')
      }, 2000)

    } catch (error: any) {
      console.error('Error completing delivery:', error)
      toast(error.message || 'Failed to complete delivery', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading delivery form...</p>
        </div>
      </div>
    )
  }

  if (!shipment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Shipment not found</p>
          <OptimizedLink href="/dashboard/driver/active" className="text-blue-600 hover:underline mt-4 inline-block">
            Return to Active Deliveries
          </OptimizedLink>
        </div>
      </div>
    )
  }

  const requiredPhotoCount = photos.filter(p => p.id !== 'handover' && p.captured).length
  const totalRequired = photos.filter(p => p.id !== 'handover').length

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <OptimizedLink 
                href={`/dashboard/driver/active/${params.id}`}
                className="text-gray-600 hover:text-gray-900"
              >
                <ChevronLeft className="w-6 h-6" />
              </OptimizedLink>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Complete Delivery</h1>
                <p className="text-sm text-gray-600">
                  {shipment.vehicle_year} {shipment.vehicle_make} {shipment.vehicle_model}
                </p>
              </div>
            </div>
            {shipment.payment && shipment.payment.length > 0 && (
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">
                  ${shipment.payment[0].driver_payout.toFixed(2)}
                </p>
                <p className="text-xs text-gray-600">Your Earnings</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Delivery Address */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-start space-x-3">
            <MapPin className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Delivery Address</p>
              <p className="text-gray-600 mt-1">{shipment.delivery_address}</p>
              <p className="text-sm text-gray-500 mt-1">{shipment.delivery_city}, {shipment.delivery_state} {shipment.delivery_zip}</p>
            </div>
            {location && (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            )}
          </div>
        </div>

        {/* Payment Info */}
        {shipment.payment && shipment.payment.length > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg border border-green-200 p-6">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2">Final Payment Capture</h3>
                <p className="text-sm text-gray-700 mb-3">
                  When you complete this delivery, the remaining 80% payment will be automatically captured from the client's card. 
                  This ensures instant payment with no cash handling required.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <p className="text-xs text-gray-600 mb-1">Already Paid (20%)</p>
                    <p className="text-lg font-bold text-gray-900">
                      ${((shipment.payment[0].amount * 0.2) / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <p className="text-xs text-gray-600 mb-1">Will be Captured (80%)</p>
                    <p className="text-lg font-bold text-green-600">
                      ${((shipment.payment[0].amount * 0.8) / 100).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-green-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Your Earnings (80% of total)</span>
                    <span className="text-xl font-bold text-green-600">
                      ${shipment.payment[0].driver_payout.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Photos */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Delivery Photos</h2>
            <span className="text-sm text-gray-600">
              {requiredPhotoCount}/{totalRequired} Required
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="border rounded-lg overflow-hidden">
                {photo.captured && photo.preview ? (
                  <div className="relative">
                    <img 
                      src={photo.preview} 
                      alt={photo.label}
                      className="w-full h-48 object-cover"
                    />
                    <button
                      onClick={() => removePhoto(photo.id)}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <p className="text-white font-medium text-sm">{photo.label}</p>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handlePhotoCapture(photo.id, e)}
                      className="hidden"
                    />
                    <div className="h-48 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
                      <Camera className="w-8 h-8 text-gray-400 mb-2" />
                      <p className="font-medium text-gray-900">{photo.label}</p>
                      <p className="text-xs text-gray-500 mt-1 px-4 text-center">{photo.description}</p>
                      {photo.id !== 'handover' && (
                        <span className="inline-block mt-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                          Required
                        </span>
                      )}
                    </div>
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Client Confirmation */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Client Confirmation</h2>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="clientPresent"
                checked={clientPresent}
                onChange={(e) => setClientPresent(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="clientPresent" className="text-gray-700">
                Client was present at delivery
              </label>
            </div>

            {clientPresent && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter client name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Signature (Optional)
                  </label>
                  <input
                    type="text"
                    value={clientSignature}
                    onChange={(e) => setClientSignature(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-script text-xl"
                    placeholder="Type signature"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Client can type their name as signature
                  </p>
                </div>
              </>
            )}

            {!clientPresent && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  Please ensure you have authorization to leave the vehicle at this location.
                  Take clear photos documenting the delivery location.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Delivery Notes */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery Notes</h2>
          <textarea
            value={deliveryNotes}
            onChange={(e) => setDeliveryNotes(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Add any notes about the delivery (optional)..."
          />
        </div>

        {/* Summary Card */}
        {shipment.payment && shipment.payment.length > 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-lg border border-blue-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Delivery Summary</h3>
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Distance</span>
                <span className="font-semibold">{shipment.distance} miles</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Fare</span>
                <span className="font-semibold">${shipment.payment[0].amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-3 border-t">
                <span className="text-gray-900 font-semibold">Your Earnings</span>
                <span className="text-2xl font-bold text-green-600">
                  ${shipment.payment[0].driver_payout.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Complete Button */}
        <div className="bg-white rounded-lg border p-6">
          <button
            onClick={handleSubmit}
            disabled={submitting || requiredPhotoCount < totalRequired || !location}
            className="w-full bg-green-600 text-white py-4 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold text-lg flex items-center justify-center space-x-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Completing Delivery...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Complete Delivery & Get Paid</span>
              </>
            )}
          </button>
          {(requiredPhotoCount < totalRequired || !location) && (
            <p className="text-center text-sm text-gray-500 mt-3">
              {!location 
                ? 'Location verification required' 
                : `Capture ${totalRequired - requiredPhotoCount} more required photo(s)`
              }
            </p>
          )}
        </div>

        {/* Contact Client */}
        {shipment.client && (
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <MessageCircle className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">Need to contact client?</p>
                  <p className="text-sm text-gray-600">{shipment.client.first_name} {shipment.client.last_name}</p>
                </div>
              </div>
              <a
                href={`tel:${shipment.client.phone}`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Call Client
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
