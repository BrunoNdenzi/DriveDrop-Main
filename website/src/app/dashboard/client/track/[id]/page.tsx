'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { OptimizedLink } from '@/components/ui/optimized-link'
import { 
  MapPin, 
  Navigation, 
  Truck, 
  Clock,
  Phone,
  MessageCircle,
  ChevronLeft,
  Loader2,
  CheckCircle2
} from 'lucide-react'

interface DriverLocation {
  latitude: number
  longitude: number
  accuracy: number
  speed: number | null
  heading: number | null
  location_timestamp: string
}

export default function TrackShipmentPage({ params }: { params: { id: string } }) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [shipment, setShipment] = useState<any>(null)
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null)
  const [eta, setEta] = useState<string | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const googleMapRef = useRef<any>(null)
  const driverMarkerRef = useRef<any>(null)
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    fetchShipment()
  }, [params.id])

  useEffect(() => {
    if (shipment) {
      subscribeToLocationUpdates()
      loadGoogleMaps()
    }

    return () => {
      // Cleanup subscription
    }
  }, [shipment])

  const fetchShipment = async () => {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          driver:profiles!shipments_driver_id_fkey (
            id,
            first_name,
            last_name,
            phone,
            avatar_url
          )
        `)
        .eq('id', params.id)
        .single()

      if (error) throw error
      setShipment(data)

      // Fetch latest driver location if driver assigned
      if (data?.driver_id) {
        fetchLatestLocation(data.driver_id)
      }
    } catch (error) {
      console.error('Error fetching shipment:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchLatestLocation = async (driverId: string) => {
    try {
      const { data, error } = await supabase
        .from('driver_locations')
        .select('*')
        .eq('driver_id', driverId)
        .eq('shipment_id', params.id)
        .order('location_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Error fetching location:', error)
        return
      }

      if (data) {
        setDriverLocation(data)
        updateMapMarker(data)
      }
    } catch (error) {
      console.error('Error fetching location:', error)
    }
  }

  const subscribeToLocationUpdates = () => {
    const channel = supabase
      .channel(`location-updates-${params.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_locations',
          filter: `shipment_id=eq.${params.id}`
        },
        (payload) => {
          const newLocation = payload.new as DriverLocation
          setDriverLocation(newLocation)
          updateMapMarker(newLocation)
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }

  const loadGoogleMaps = () => {
    if (typeof window === 'undefined') return

    // Check if Google Maps is already loaded
    if ((window as any).google && (window as any).google.maps) {
      initializeMap()
      return
    }

    // Load Google Maps script
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}`
    script.async = true
    script.defer = true
    script.onload = () => initializeMap()
    document.head.appendChild(script)
  }

  const initializeMap = () => {
    if (!mapRef.current || !shipment) return

    const google = (window as any).google

    // Default to pickup location
    const center = driverLocation
      ? { lat: driverLocation.latitude, lng: driverLocation.longitude }
      : { lat: parseFloat(shipment.pickup_latitude) || 0, lng: parseFloat(shipment.pickup_longitude) || 0 }

    googleMapRef.current = new google.maps.Map(mapRef.current, {
      center,
      zoom: 13,
      styles: [
        {
          featureType: 'poi',
          stylers: [{ visibility: 'off' }]
        }
      ]
    })

    // Add pickup marker
    new google.maps.Marker({
      position: { lat: parseFloat(shipment.pickup_latitude), lng: parseFloat(shipment.pickup_longitude) },
      map: googleMapRef.current,
      title: 'Pickup Location',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#3B82F6',
        fillOpacity: 1,
        strokeColor: '#1E40AF',
        strokeWeight: 2,
        scale: 8
      }
    })

    // Add delivery marker
    new google.maps.Marker({
      position: { lat: parseFloat(shipment.delivery_latitude), lng: parseFloat(shipment.delivery_longitude) },
      map: googleMapRef.current,
      title: 'Delivery Location',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#EF4444',
        fillOpacity: 1,
        strokeColor: '#991B1B',
        strokeWeight: 2,
        scale: 8
      }
    })

    // Add driver marker if location available
    if (driverLocation) {
      updateMapMarker(driverLocation)
    }
  }

  const updateMapMarker = (location: DriverLocation) => {
    if (!googleMapRef.current) return

    const google = (window as any).google
    const position = { lat: location.latitude, lng: location.longitude }

    if (driverMarkerRef.current) {
      // Update existing marker
      driverMarkerRef.current.setPosition(position)
    } else {
      // Create new marker
      driverMarkerRef.current = new google.maps.Marker({
        position,
        map: googleMapRef.current,
        title: 'Driver Location',
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          fillColor: '#10B981',
          fillOpacity: 1,
          strokeColor: '#059669',
          strokeWeight: 2,
          scale: 6,
          rotation: location.heading || 0
        }
      })
    }

    // Center map on driver
    googleMapRef.current.panTo(position)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading tracking information...</p>
        </div>
      </div>
    )
  }

  if (!shipment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Shipment not found</p>
      </div>
    )
  }

  const isEnRoute = ['en_route', 'arrived', 'picked_up', 'in_transit'].includes(shipment.status)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <OptimizedLink 
                href="/dashboard/client/shipments"
                className="text-gray-600 hover:text-gray-900"
              >
                <ChevronLeft className="w-6 h-6" />
              </OptimizedLink>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Track Your Shipment</h1>
                <p className="text-sm text-gray-600">
                  {shipment.vehicle_year} {shipment.vehicle_make} {shipment.vehicle_model}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                shipment.status === 'delivered' 
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {shipment.status.replace('_', ' ').toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Map */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <div 
            ref={mapRef} 
            className="w-full h-[400px] bg-gray-200"
          >
            {!driverLocation && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">Waiting for driver location...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Location Info */}
        {driverLocation && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Navigation className="w-5 h-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-green-900">Driver En Route</h3>
                <p className="text-sm text-green-700 mt-1">
                  Last updated: {new Date(driverLocation.location_timestamp).toLocaleTimeString()}
                </p>
                {driverLocation.speed && (
                  <p className="text-sm text-green-700">
                    Speed: {Math.round(driverLocation.speed * 2.237)} mph
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Driver Info */}
        {shipment.driver && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Driver</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {shipment.driver.profile_image ? (
                  <img 
                    src={shipment.driver.profile_image} 
                    alt={`${shipment.driver.first_name} ${shipment.driver.last_name}`}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-2xl font-bold text-blue-600">
                      {shipment.driver.first_name[0]}{shipment.driver.last_name[0]}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900">
                    {shipment.driver.first_name} {shipment.driver.last_name}
                  </p>
                  <p className="text-sm text-gray-600">Professional Driver</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <OptimizedLink
                  href={`/dashboard/client/messages?shipment=${params.id}`}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Message</span>
                </OptimizedLink>
                <a
                  href={`tel:${shipment.driver.phone}`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Route Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">Pickup Location</p>
                <p className="text-gray-600 mt-1">{shipment.pickup_address}</p>
                <p className="text-sm text-gray-500">
                  {shipment.pickup_city}, {shipment.pickup_state} {shipment.pickup_zip}
                </p>
                {shipment.actual_pickup_time && (
                  <div className="flex items-center space-x-1 mt-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600">
                      Picked up {new Date(shipment.actual_pickup_time).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">Delivery Location</p>
                <p className="text-gray-600 mt-1">{shipment.delivery_address}</p>
                <p className="text-sm text-gray-500">
                  {shipment.delivery_city}, {shipment.delivery_state} {shipment.delivery_zip}
                </p>
                {shipment.actual_delivery_time && (
                  <div className="flex items-center space-x-1 mt-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600">
                      Delivered {new Date(shipment.actual_delivery_time).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery Timeline</h2>
          <div className="space-y-4">
            {[
              { status: 'accepted', label: 'Job Accepted', time: shipment.driver_accepted_at },
              { status: 'en_route', label: 'Driver En Route to Pickup', time: shipment.driver_enroute_time },
              { status: 'arrived', label: 'Driver Arrived at Pickup', time: shipment.driver_arrival_time },
              { status: 'picked_up', label: 'Vehicle Picked Up', time: shipment.actual_pickup_time },
              { status: 'in_transit', label: 'In Transit to Delivery', time: shipment.in_transit_time },
              { status: 'delivered', label: 'Delivered', time: shipment.actual_delivery_time }
            ].map((step, index) => {
              const isCompleted = step.time !== null
              const isCurrent = shipment.status === step.status && !isCompleted
              
              return (
                <div key={step.status} className="flex items-start space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isCompleted 
                      ? 'bg-green-100 text-green-600' 
                      : isCurrent
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-semibold">{index + 1}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${
                      isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-400'
                    }`}>
                      {step.label}
                    </p>
                    {step.time && (
                      <p className="text-sm text-gray-600 mt-0.5">
                        {new Date(step.time).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
