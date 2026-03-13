'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
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
  Truck,
  Image,
  ShieldCheck,
  AlertTriangle,
  Eye,
  ExternalLink
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
  is_accident_recovery: boolean
  client_vehicle_photos: any
  pickup_verified: boolean
  pickup_verification_status: string | null
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
  { value: 'assigned', label: 'Job Assigned', icon: Package, color: 'gray' },
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
  const [confirmAction, setConfirmAction] = useState<string | null>(null)
  const [showNavMap, setShowNavMap] = useState<'pickup' | 'delivery' | null>(null)
  const navMapRef = useRef<HTMLDivElement>(null)
  const navMapInstanceRef = useRef<google.maps.Map | null>(null)
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  const driverMarkerRef = useRef<google.maps.Marker | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const [navDirections, setNavDirections] = useState<{ steps: google.maps.DirectionsStep[]; currentStepIndex: number; totalDistance: string; totalDuration: string; driverLat: number | null; driverLng: number | null } | null>(null)
  const [navFollowDriver, setNavFollowDriver] = useState(true)
  const navFollowDriverRef = useRef(true)
  const navDestinationRef = useRef<string>('')
  const navPickupAddrRef = useRef<string>('')
  const navDeliveryAddrRef = useRef<string>('')
  const navDirectionsThrottleRef = useRef<number>(0)
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

    // Enforce pickup verification before allowing "picked_up"
    if (newStatus === 'picked_up' && !shipment.pickup_verified) {
      toast('Please complete pickup verification before marking as picked up', 'error')
      return
    }

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
      setConfirmAction(null)
      fetchShipment()
    } catch (error) {
      console.error('Error updating status:', error)
      toast('Failed to update status', 'error')
    } finally {
      setUpdating(false)
    }
  }

  const handleStatusAdvance = (newStatus: string) => {
    // Show confirmation dialog
    setConfirmAction(newStatus)
  }

  const getCurrentStatusIndex = () => {
    if (!shipment) return 0
    const idx = STATUS_FLOW.findIndex(s => s.value === shipment.status)
    if (idx >= 0) return idx
    // Map intermediate statuses to their closest flow position
    if (shipment.status === 'pickup_verification_pending' || shipment.status === 'pickup_verified') {
      return STATUS_FLOW.findIndex(s => s.value === 'driver_arrived')
    }
    if (shipment.status === 'in_progress') {
      return STATUS_FLOW.findIndex(s => s.value === 'in_transit')
    }
    return 0
  }

  const getNextStatus = () => {
    const currentIndex = getCurrentStatusIndex()
    if (currentIndex >= 0 && currentIndex < STATUS_FLOW.length - 1) {
      return STATUS_FLOW[currentIndex + 1]
    }
    return null
  }

  const openInAppNav = useCallback((type: 'pickup' | 'delivery') => {
    if (!shipment) return
    // Store addresses in refs so map overlay doesn't depend on shipment state
    navPickupAddrRef.current = shipment.pickup_address
    navDeliveryAddrRef.current = shipment.delivery_address
    navDestinationRef.current = type === 'pickup' ? shipment.pickup_address : shipment.delivery_address
    setNavDirections(null)
    setNavFollowDriver(true)
    navFollowDriverRef.current = true
    setShowNavMap(type)
  }, [shipment])

  const openExternalMaps = (address: string) => {
    const encoded = encodeURIComponent(address)
    // Try native Google Maps navigation deep link (works on mobile)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (isMobile) {
      window.open(`google.navigation:q=${encoded}`, '_self')
      // Fallback for iOS / no Google Maps app
      setTimeout(() => {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`, '_blank')
      }, 500)
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`, '_blank')
    }
  }

  // Cleanup watchPosition on unmount or nav close
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [])

  // Keep ref in sync with state
  useEffect(() => {
    navFollowDriverRef.current = navFollowDriver
  }, [navFollowDriver])

  // Initialize real-time navigation map when showNavMap changes
  // IMPORTANT: Only depends on showNavMap, NOT shipment — prevents map rebuild on status updates
  useEffect(() => {
    if (!showNavMap || !navMapRef.current || !window.google?.maps) return

    const address = navDestinationRef.current
    if (!address) return

    // Cleanup previous watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    const map = new google.maps.Map(navMapRef.current, {
      zoom: 15,
      center: { lat: 35.2271, lng: -80.8431 },
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      gestureHandling: 'greedy',
    })
    navMapInstanceRef.current = map

    // When user pans manually, stop auto-following
    map.addListener('dragstart', () => {
      setNavFollowDriver(false)
      navFollowDriverRef.current = false
    })

    const directionsService = new google.maps.DirectionsService()
    const directionsRenderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: false,
      polylineOptions: { strokeColor: '#3b82f6', strokeWeight: 6, strokeOpacity: 0.8 },
      markerOptions: {
        zIndex: 10,
      }
    })
    directionsRendererRef.current = directionsRenderer

    // Create driver marker (blue dot like Google Maps)
    const driverMarker = new google.maps.Marker({
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#4285F4',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
      title: 'Your Location',
      zIndex: 100,
    })
    driverMarkerRef.current = driverMarker

    // Accuracy circle
    const accuracyCircle = new google.maps.Circle({
      map,
      strokeColor: '#4285F4',
      strokeOpacity: 0.2,
      strokeWeight: 1,
      fillColor: '#4285F4',
      fillOpacity: 0.1,
      center: { lat: 0, lng: 0 },
      radius: 50,
      visible: false,
    })

    const calculateRoute = (origin: google.maps.LatLngLiteral) => {
      directionsService.route(
        {
          origin,
          destination: address,
          travelMode: google.maps.TravelMode.DRIVING,
          provideRouteAlternatives: false,
        },
        (result, status) => {
          if (status === 'OK' && result) {
            directionsRenderer.setDirections(result)
            const leg = result.routes[0]?.legs[0]
            if (leg) {
              setNavDirections({
                steps: leg.steps,
                currentStepIndex: 0,
                totalDistance: leg.distance?.text || '',
                totalDuration: leg.duration?.text || '',
                driverLat: origin.lat,
                driverLng: origin.lng,
              })
            }
          }
        }
      )
    }

    const findCurrentStep = (driverPos: google.maps.LatLngLiteral, steps: google.maps.DirectionsStep[]): number => {
      for (let i = steps.length - 1; i >= 0; i--) {
        const stepEnd = steps[i].end_location
        const dist = google.maps.geometry?.spherical?.computeDistanceBetween(
          new google.maps.LatLng(driverPos.lat, driverPos.lng),
          stepEnd
        )
        // If we're within 100m of this step's end, we've likely passed it
        if (dist !== undefined && dist < 100) {
          return Math.min(i + 1, steps.length - 1)
        }
      }
      // Check proximity to each step's start
      for (let i = 0; i < steps.length; i++) {
        const stepStart = steps[i].start_location
        const dist = google.maps.geometry?.spherical?.computeDistanceBetween(
          new google.maps.LatLng(driverPos.lat, driverPos.lng),
          stepStart
        )
        if (dist !== undefined && dist < 200) {
          return i
        }
      }
      return 0
    }

    let lastRouteCalcTime = 0
    const ROUTE_RECALC_INTERVAL = 30000 // Recalculate route every 30 seconds

    // Start real-time position tracking
    if (navigator.geolocation) {
      // Initial position
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          driverMarker.setPosition(origin)
          accuracyCircle.setCenter(origin)
          accuracyCircle.setRadius(pos.coords.accuracy)
          accuracyCircle.setVisible(true)
          map.setCenter(origin)
          map.setZoom(16)
          calculateRoute(origin)
          lastRouteCalcTime = Date.now()
        },
        () => {
          // Fallback: just geocode destination
          const geocoder = new google.maps.Geocoder()
          geocoder.geocode({ address }, (results, geoStatus) => {
            if (geoStatus === 'OK' && results?.[0]) {
              map.setCenter(results[0].geometry.location)
              map.setZoom(14)
            }
          })
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )

      // Continuous tracking
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const driverPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }

          // Update driver marker position smoothly
          driverMarker.setPosition(driverPos)
          accuracyCircle.setCenter(driverPos)
          accuracyCircle.setRadius(pos.coords.accuracy)
          accuracyCircle.setVisible(true)

          // Auto-center map on driver if following
          if (navFollowDriverRef.current) {
            map.panTo(driverPos)
          }

          // Throttle direction state updates to max once per 3 seconds to reduce re-renders
          const now2 = Date.now()
          if (now2 - navDirectionsThrottleRef.current > 3000) {
            navDirectionsThrottleRef.current = now2
            setNavDirections(prev => {
              if (!prev) return prev
              const currentStepIndex = findCurrentStep(driverPos, prev.steps)
              if (currentStepIndex === prev.currentStepIndex) return prev // No change, skip re-render
              return {
                ...prev,
                currentStepIndex,
                driverLat: driverPos.lat,
                driverLng: driverPos.lng,
              }
            })
          }

          // Periodically recalculate the route for updated ETA
          const now = Date.now()
          if (now - lastRouteCalcTime > ROUTE_RECALC_INTERVAL) {
            lastRouteCalcTime = now
            calculateRoute(driverPos)
          }
        },
        (err) => {
          console.warn('watchPosition error:', err.message)
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 10000,
        }
      )
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      driverMarker.setMap(null)
      accuracyCircle.setMap(null)
      directionsRenderer.setMap(null)
    }
  }, [showNavMap])

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
                  {nextStatus.value === 'picked_up' && !shipment.pickup_verified && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-3">
                      <p className="text-sm text-red-700 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Complete pickup verification before marking as picked up
                      </p>
                    </div>
                  )}
                  <Button
                    onClick={() => handleStatusAdvance(nextStatus.value)}
                    disabled={updating || (nextStatus.value === 'picked_up' && !shipment.pickup_verified)}
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
                        <span className="text-xs block opacity-75">Tap to complete</span>
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
                  onClick={() => openInAppNav('pickup')}
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
                  onClick={() => openInAppNav('delivery')}
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
                {shipment.is_accident_recovery && (
                  <div className="col-span-2">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                      <p className="text-sm font-medium text-yellow-800 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Accident Recovery Vehicle
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Client Vehicle Photos */}
            {shipment.client_vehicle_photos && (() => {
              try {
                const photos = typeof shipment.client_vehicle_photos === 'string'
                  ? JSON.parse(shipment.client_vehicle_photos)
                  : shipment.client_vehicle_photos

                // Handle both array and object formats
                const photoEntries: [string, any][] = Array.isArray(photos)
                  ? photos.map((url: string, i: number) => [`Photo ${i + 1}`, url] as [string, any])
                  : Object.entries(photos).flatMap(([key, value]: [string, any]) => {
                      if (Array.isArray(value)) {
                        return value.filter(Boolean).map((url: string, i: number) => [`${key} ${i + 1}`, url] as [string, any])
                      }
                      return value ? [[key, value] as [string, any]] : []
                    })

                if (photoEntries.length === 0) return null

                return (
                  <div className="bg-white rounded-md p-4 border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-blue-100 rounded-md">
                        <Image className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Client Vehicle Photos</h3>
                        <p className="text-sm text-gray-500">{photoEntries.length} photo(s) submitted by client</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {photoEntries.map(([key, url]: [string, any], index: number) => (
                        <div key={index} className="relative aspect-video bg-gray-100 rounded-md overflow-hidden group cursor-pointer">
                          <img
                            src={url}
                            alt={`${key} view`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <p className="text-white text-xs font-medium capitalize">{key}</p>
                          </div>
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-white/90 p-1.5 rounded-full shadow-sm hover:bg-white"
                            >
                              <Eye className="h-3.5 w-3.5 text-gray-700" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      Compare these photos with the actual vehicle during pickup verification.
                    </p>
                  </div>
                )
              } catch (error) {
                console.error('Error parsing vehicle photos:', error)
                return null
              }
            })()}

            {/* Pickup Verification Action */}
            {(shipment.status === 'driver_arrived' || shipment.status === 'accepted' || shipment.status === 'driver_en_route') && !shipment.pickup_verified && (
              <div className="bg-amber-50 rounded-md p-4 border border-amber-200">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-6 w-6 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900">Pickup Verification Required</h3>
                    <p className="text-sm text-amber-700 mt-1">
                      Before picking up the vehicle, verify its condition matches the client&apos;s submitted photos. 
                      Take photos, report any issues, and confirm the vehicle details.
                    </p>
                    <Link href={`/dashboard/driver/pickup-verification/${shipment.id}`}>
                      <Button className="mt-3 bg-amber-500 hover:bg-amber-600 text-white" size="sm">
                        <Camera className="h-4 w-4 mr-2" />
                        Start Pickup Verification
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Verification Completed Badge */}
            {shipment.pickup_verified && (
              <div className="bg-green-50 rounded-md p-4 border border-green-200">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-green-900">Pickup Verified</h3>
                    <p className="text-sm text-green-700">
                      Vehicle condition verified at pickup
                      {shipment.pickup_verification_status === 'issues_reported' && ' — issues were reported'}
                    </p>
                  </div>
                </div>
              </div>
            )}
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

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md max-w-sm w-full p-6">
            <div className="text-center mb-4">
              <div className="mx-auto w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-3">
                <CheckCircle className="h-6 w-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Confirm Status Update</h3>
              <p className="text-sm text-gray-600 mt-2">
                Are you sure you want to mark this shipment as <strong className="text-amber-600">{STATUS_FLOW.find(s => s.value === confirmAction)?.label}</strong>?
              </p>
              {confirmAction === 'driver_arrived' && !shipment?.pickup_verified && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mt-3 text-left">
                  <p className="text-xs text-blue-700 flex items-center gap-2">
                    <Camera className="h-4 w-4 flex-shrink-0" />
                    Remember: Take vehicle photos and complete pickup verification after arriving.
                  </p>
                </div>
              )}
              {confirmAction === 'delivered' && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3 mt-3 text-left">
                  <p className="text-xs text-green-700">
                    This will complete the delivery and notify the client. Make sure the vehicle has been safely delivered.
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmAction(null)} disabled={updating}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-amber-500 hover:bg-amber-600"
                onClick={() => updateStatus(confirmAction)}
                disabled={updating}
              >
                {updating ? 'Updating...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Navigation Modal — uses refs for addresses so it never depends on shipment state */}
      {showNavMap && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Nav Header with ETA */}
          <div className="bg-[#1a73e8] text-white p-3 flex items-center justify-between safe-area-top">
            <div className="flex items-center gap-3">
              <button onClick={() => { setShowNavMap(null); setNavDirections(null) }} className="p-2 hover:bg-white/10 rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h3 className="font-semibold text-sm">
                  {showNavMap === 'pickup' ? 'Navigate to Pickup' : 'Navigate to Delivery'}
                </h3>
                {navDirections && (
                  <p className="text-xs text-blue-100">
                    {navDirections.totalDuration} · {navDirections.totalDistance}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!navFollowDriver && (
                <button
                  onClick={() => {
                    setNavFollowDriver(true)
                    if (navDirections?.driverLat && navDirections?.driverLng && navMapInstanceRef.current) {
                      navMapInstanceRef.current.panTo({ lat: navDirections.driverLat, lng: navDirections.driverLng })
                      navMapInstanceRef.current.setZoom(16)
                    }
                  }}
                  className="bg-white/20 hover:bg-white/30 rounded-full p-2"
                  title="Re-center on your location"
                >
                  <Navigation className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Current Step Banner */}
          {navDirections && navDirections.steps.length > 0 && (
            <div className="bg-[#1a73e8] text-white px-4 pb-3">
              <div className="bg-white/15 rounded-lg p-3 flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  <Navigation className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm leading-tight" dangerouslySetInnerHTML={{
                    __html: navDirections.steps[navDirections.currentStepIndex]?.instructions || 'Calculating...'
                  }} />
                  <p className="text-xs text-blue-200 mt-1">
                    {navDirections.steps[navDirections.currentStepIndex]?.distance?.text || ''}{' · '}
                    Step {navDirections.currentStepIndex + 1} of {navDirections.steps.length}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Map */}
          <div ref={navMapRef} className="flex-1 w-full" />

          {/* Bottom Panel - Destination + Actions */}
          <div className="bg-white border-t border-gray-200 safe-area-bottom">
            <div className="p-3 flex items-center gap-3 border-b border-gray-100">
              <div className="p-2 bg-red-100 rounded-full">
                <MapPin className="h-4 w-4 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {showNavMap === 'pickup' ? navPickupAddrRef.current : navDeliveryAddrRef.current}
                </p>
                {navDirections && (
                  <p className="text-xs text-gray-500">
                    ETA: {navDirections.totalDuration} ({navDirections.totalDistance})
                  </p>
                )}
              </div>
            </div>
            <div className="p-3 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => openExternalMaps(showNavMap === 'pickup' ? navPickupAddrRef.current : navDeliveryAddrRef.current)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Google Maps App
              </Button>
              <Button
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                onClick={() => { setShowNavMap(null); setNavDirections(null) }}
              >
                End Navigation
              </Button>
            </div>

            {/* Step-by-step Directions (collapsible) */}
            {navDirections && navDirections.steps.length > 0 && (
              <details className="border-t border-gray-100">
                <summary className="p-3 text-sm font-medium text-blue-600 cursor-pointer hover:bg-gray-50">
                  View all {navDirections.steps.length} directions
                </summary>
                <div className="max-h-48 overflow-y-auto px-3 pb-3">
                  {navDirections.steps.map((step, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 py-2 border-b border-gray-50 last:border-0 ${
                        i === navDirections.currentStepIndex ? 'bg-blue-50 -mx-3 px-3 rounded' : ''
                      } ${i < navDirections.currentStepIndex ? 'opacity-40' : ''}`}
                    >
                      <span className={`flex-shrink-0 w-6 h-6 rounded-full text-xs flex items-center justify-center font-medium ${
                        i === navDirections.currentStepIndex
                          ? 'bg-blue-500 text-white'
                          : i < navDirections.currentStepIndex
                          ? 'bg-green-100 text-green-600'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {i < navDirections.currentStepIndex ? '✓' : i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-800" dangerouslySetInnerHTML={{ __html: step.instructions }} />
                        <p className="text-xs text-gray-400 mt-0.5">{step.distance?.text} · {step.duration?.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
