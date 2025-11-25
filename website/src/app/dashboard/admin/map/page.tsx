'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { 
  MapPin, 
  Truck, 
  Users, 
  Package,
  Navigation,
  Layers,
  Filter,
  RefreshCw,
  Search,
  Eye,
  EyeOff,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Driver {
  id: string
  first_name: string
  last_name: string
  phone: string
  vehicle_type?: string
  location?: {
    latitude: number
    longitude: number
  } | null
  active_shipment?: string
}

interface Shipment {
  id: string
  title: string
  status: 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled'
  pickup_address: string
  pickup_city: string
  pickup_state: string
  pickup_lat: number
  pickup_lng: number
  delivery_address: string
  delivery_city: string
  delivery_state: string
  delivery_lat: number
  delivery_lng: number
  driver_id?: string
  client_name?: string
  vehicle_year?: string
  vehicle_make?: string
  vehicle_model?: string
  created_at: string
  estimated_delivery?: string
  current_location?: {
    latitude: number
    longitude: number
  }
}

interface MapFilters {
  showDrivers: boolean
  showShipments: boolean
  showPickups: boolean
  showDeliveries: boolean
  showRoutes: boolean
  shipmentStatus: string[]
  driverStatus: string[]
}

export default function AdminMapPage() {
  const { profile, loading: authLoading } = useAuth()
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null)
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Debug logging
  useEffect(() => {
    console.log('[AdminMap] Auth state:', { profile, authLoading })
  }, [profile, authLoading])
  const [filters, setFilters] = useState<MapFilters>({
    showDrivers: true,
    showShipments: true,
    showPickups: true,
    showDeliveries: true,
    showRoutes: true,
    shipmentStatus: ['pending', 'assigned', 'in_transit', 'delivered'],
    driverStatus: ['available', 'busy', 'offline']
  })
  const [stats, setStats] = useState({
    totalDrivers: 0,
    activeDrivers: 0,
    totalShipments: 0,
    inTransit: 0,
    pendingPickup: 0,
    delivered: 0
  })

  const mapRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<{
    drivers: Map<string, google.maps.Marker>
    pickups: Map<string, google.maps.Marker>
    deliveries: Map<string, google.maps.Marker>
  }>({
    drivers: new Map(),
    pickups: new Map(),
    deliveries: new Map()
  })
  const routesRef = useRef<Map<string, google.maps.Polyline>>(new Map())
  const supabase = getSupabaseBrowserClient()

  // Load Google Maps Script and Initialize Map
  useEffect(() => {
    if (map) {
      console.log('[Map] Map already initialized')
      return
    }
    
    if (typeof window === 'undefined') {
      console.log('[Map] Window is undefined, skipping')
      return
    }

    const loadGoogleMaps = () => {
      if (!mapRef.current) {
        console.log('[Map] MapRef not ready yet, retrying in 100ms...')
        return
      }

      // Check if already loaded
      if (window.google?.maps) {
        console.log('[Map] ✅ Google Maps API available, creating map...')
        try {
          const initMap = new google.maps.Map(mapRef.current, {
            center: { lat: 39.8283, lng: -98.5795 },
            zoom: 5,
            styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true
          })
          console.log('[Map] ✅ Map instance created successfully!')
          setMap(initMap)
          clearInterval(checkInterval)
        } catch (error) {
          console.error('[Map] ❌ Error creating map:', error)
        }
        return
      }

      console.log('[Map] Loading Google Maps script...')
      
      // Load script
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`
      script.async = true
      script.defer = true
      
      script.onload = () => {
        console.log('[Map] ✅ Script loaded, creating map...')
        if (mapRef.current) {
          try {
            const initMap = new google.maps.Map(mapRef.current, {
              center: { lat: 39.8283, lng: -98.5795 },
              zoom: 5,
              styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
              mapTypeControl: true,
              streetViewControl: false,
              fullscreenControl: true,
              zoomControl: true
            })
            console.log('[Map] ✅ Map created after script load!')
            setMap(initMap)
            clearInterval(checkInterval)
          } catch (error) {
            console.error('[Map] ❌ Error creating map:', error)
          }
        }
      }
      
      script.onerror = (error) => {
        console.error('[Map] ❌ Script load failed:', error)
      }
      
      document.head.appendChild(script)
      clearInterval(checkInterval)
    }

    // Poll for mapRef readiness
    const checkInterval = setInterval(loadGoogleMaps, 100)
    loadGoogleMaps() // Try immediately too

    return () => clearInterval(checkInterval)
  }, [map])

  // Load data
  const loadData = useCallback(async () => {
    if (!profile) {
      console.log('[Map] No profile, skipping data load')
      return
    }

    try {
      console.log('[Map] Starting data load...')
      setLoading(true)

      // Load shipments with details - ONLY active shipments for map
      console.log('[Map] Loading shipments...')
      const { data: shipmentsData, error: shipmentsError} = await supabase
        .from('shipments')
        .select(`
          *,
          client:profiles!shipments_client_id_fkey(first_name, last_name),
          driver:profiles!shipments_driver_id_fkey(first_name, last_name, phone)
        `)
        .in('status', ['assigned', 'accepted', 'driver_en_route', 'driver_arrived', 'pickup_verified', 'picked_up', 'in_transit', 'in_progress'])
        .order('created_at', { ascending: false })

      if (shipmentsError) {
        console.error('[Map] Shipments error:', shipmentsError)
        throw shipmentsError
      }
      console.log('[Map] Shipments loaded:', shipmentsData?.length || 0, 'shipments')

      // Load drivers with their current locations (remove status filter - column doesn't exist)
      console.log('[Map] Loading drivers...')
      const { data: driversData, error: driversError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'driver')

      if (driversError) {
        console.error('[Map] Drivers error:', driversError)
        throw driversError
      }
      console.log('[Map] Drivers loaded:', driversData?.length || 0, 'drivers')

      // Get latest driver locations
      console.log('[Map] Loading driver locations...')
      const driverLocations = await Promise.all(
        (driversData || []).map(async (driver) => {
          const { data: location } = await supabase
            .from('driver_locations')
            .select('*')
            .eq('driver_id', driver.id)
            .order('location_timestamp', { ascending: false })
            .limit(1)
            .single()

          return {
            ...driver,
            location: location ? {
              latitude: location.latitude,
              longitude: location.longitude
            } : null
          }
        })
      )
      console.log('[Map] Driver locations loaded')

      setShipments(shipmentsData || [])
      setDrivers(driverLocations)

      console.log('[Map] Data loaded summary:', {
        shipments: shipmentsData?.length || 0,
        drivers: driverLocations.length,
        filters: filters.shipmentStatus
      })

      console.log('[Map] Calculating stats...')
      // Calculate stats (without status filtering since column doesn't exist)
      const stats = {
        totalDrivers: driversData?.length || 0,
        activeDrivers: driverLocations.filter(d => d.location !== null).length,
        totalShipments: shipmentsData?.length || 0,
        inTransit: shipmentsData?.filter(s => s.status === 'in_transit').length || 0,
        pendingPickup: shipmentsData?.filter(s => s.status === 'assigned').length || 0,
        delivered: shipmentsData?.filter(s => s.status === 'delivered').length || 0
      }
      setStats(stats)
      console.log('[Map] Stats calculated:', stats)
      console.log('[Map] Data load complete')

    } catch (error) {
      console.error('[Map] Error loading map data:', error)
    } finally {
      setLoading(false)
    }
  }, [profile, filters, supabase])

  useEffect(() => {
    loadData()
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  // Update markers when data changes
  useEffect(() => {
    if (!map) {
      console.log('[Map] No map instance, skipping marker update')
      return
    }

    console.log('[Map] Starting marker update...')
    console.log('[Map] Drivers:', drivers.length, 'Shipments:', shipments.length)
    console.log('[Map] Filters:', filters)

    // Clear existing markers
    console.log('[Map] Clearing existing markers...')
    markersRef.current.drivers.forEach(marker => marker.setMap(null))
    markersRef.current.pickups.forEach(marker => marker.setMap(null))
    markersRef.current.deliveries.forEach(marker => marker.setMap(null))
    routesRef.current.forEach(route => route.setMap(null))

    markersRef.current.drivers.clear()
    markersRef.current.pickups.clear()
    markersRef.current.deliveries.clear()
    routesRef.current.clear()
    console.log('[Map] Markers cleared')

    // Add driver markers
    if (filters.showDrivers) {
      console.log('[Map] Adding driver markers...')
      let count = 0
      drivers.forEach(driver => {
        if (driver.location) {
          const marker = new google.maps.Marker({
            position: {
              lat: driver.location.latitude,
              lng: driver.location.longitude
            },
            map: map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: '#3B82F6', // Blue for all drivers
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3
            },
            title: `${driver.first_name} ${driver.last_name}`
          })

          marker.addListener('click', () => setSelectedDriver(driver))
          markersRef.current.drivers.set(driver.id, marker)
          count++
        }
      })
      console.log('[Map] Driver markers added:', count)
    }

    // Add shipment markers and routes
    console.log('[Map] Adding shipment markers and routes...')
    let pickupCount = 0, deliveryCount = 0, routeCount = 0
    shipments.forEach(shipment => {
      // Pickup marker
      if (filters.showPickups && shipment.pickup_lat && shipment.pickup_lng) {
        const pickupMarker = new google.maps.Marker({
          position: {
            lat: shipment.pickup_lat,
            lng: shipment.pickup_lng
          },
          map: map,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2">
                <circle cx="12" cy="12" r="10" fill="#EFF6FF"/>
                <text x="12" y="16" text-anchor="middle" font-size="12" fill="#3B82F6" font-weight="bold">P</text>
              </svg>
            `),
            scaledSize: new google.maps.Size(32, 32)
          },
          title: `Pickup: ${shipment.pickup_city}`
        })

        pickupMarker.addListener('click', () => setSelectedShipment(shipment))
        markersRef.current.pickups.set(`${shipment.id}-pickup`, pickupMarker)
        pickupCount++
      }

      // Delivery marker
      if (filters.showDeliveries && shipment.delivery_lat && shipment.delivery_lng) {
        const deliveryMarker = new google.maps.Marker({
          position: {
            lat: shipment.delivery_lat,
            lng: shipment.delivery_lng
          },
          map: map,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2">
                <circle cx="12" cy="12" r="10" fill="#ECFDF5"/>
                <text x="12" y="16" text-anchor="middle" font-size="12" fill="#10B981" font-weight="bold">D</text>
              </svg>
            `),
            scaledSize: new google.maps.Size(32, 32)
          },
          title: `Delivery: ${shipment.delivery_city}`
        })

        deliveryMarker.addListener('click', () => setSelectedShipment(shipment))
        markersRef.current.deliveries.set(`${shipment.id}-delivery`, deliveryMarker)
        deliveryCount++
      }

      // Route line
      if (filters.showRoutes && shipment.pickup_lat && shipment.delivery_lat) {
        const route = new google.maps.Polyline({
          path: [
            { lat: shipment.pickup_lat, lng: shipment.pickup_lng },
            { lat: shipment.delivery_lat, lng: shipment.delivery_lng }
          ],
          geodesic: true,
          strokeColor: shipment.status === 'delivered' ? '#10B981' : 
                      shipment.status === 'in_transit' ? '#3B82F6' : '#9CA3AF',
          strokeOpacity: 0.6,
          strokeWeight: 3,
          map: map
        })

        routesRef.current.set(shipment.id, route)
        routeCount++
      }
    })
    console.log('[Map] Markers added - Pickups:', pickupCount, 'Deliveries:', deliveryCount, 'Routes:', routeCount)
    console.log('[Map] Marker update complete')
  }, [map, drivers, shipments, filters])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'assigned': return 'bg-blue-100 text-blue-800'
      case 'in_transit': return 'bg-purple-100 text-purple-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const focusOnShipment = (shipment: Shipment) => {
    if (!map) return

    const bounds = new google.maps.LatLngBounds()
    bounds.extend({ lat: shipment.pickup_lat, lng: shipment.pickup_lng })
    bounds.extend({ lat: shipment.delivery_lat, lng: shipment.delivery_lng })
    map.fitBounds(bounds)
    setSelectedShipment(shipment)
  }

  const focusOnDriver = (driver: Driver) => {
    if (!map || !driver.location) return

    map.setCenter({
      lat: driver.location.latitude,
      lng: driver.location.longitude
    })
    map.setZoom(12)
    focusOnDriver(driver)
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-2">Unable to load profile</p>
          <p className="text-sm text-gray-600">Please refresh the page or try logging in again</p>
        </div>
      </div>
    )
  }

  if (profile.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-2">Access denied. Admin only.</p>
          <p className="text-sm text-gray-600">Your role: {profile.role}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Compact Top Bar */}
      <div className="bg-white border-b shadow-sm">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Live Map</h1>
                <p className="text-xs text-gray-600">Real-time tracking</p>
              </div>

              {/* Compact Stats */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg">
                  <Truck className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-900">{stats.totalDrivers}</span>
                  <span className="text-xs text-blue-600">drivers</span>
                </div>
                <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-900">{stats.activeDrivers}</span>
                  <span className="text-xs text-green-600">active</span>
                </div>
                <div className="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-lg">
                  <Package className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-semibold text-purple-900">{stats.totalShipments}</span>
                  <span className="text-xs text-purple-600">shipments</span>
                </div>
                <div className="flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-lg">
                  <Navigation className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-semibold text-orange-900">{stats.inTransit}</span>
                  <span className="text-xs text-orange-600">in transit</span>
                </div>
              </div>
            </div>

            <Button
              onClick={loadData}
              variant="outline"
              size="sm"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Map Container - Full Width */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full" />

          {/* Floating Controls Panel - Top Left */}
          <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg border p-4 max-w-xs">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Map Layers
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                <input
                  type="checkbox"
                  checked={filters.showDrivers}
                  onChange={(e) => setFilters({ ...filters, showDrivers: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <Truck className="h-4 w-4 text-blue-600" />
                <span className="text-sm flex-1">Drivers</span>
                <span className="text-xs font-semibold text-gray-600">{drivers.length}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                <input
                  type="checkbox"
                  checked={filters.showPickups}
                  onChange={(e) => setFilters({ ...filters, showPickups: e.target.checked })}
                  className="rounded text-green-600"
                />
                <MapPin className="h-4 w-4 text-green-600" />
                <span className="text-sm flex-1">Pickups</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                <input
                  type="checkbox"
                  checked={filters.showDeliveries}
                  onChange={(e) => setFilters({ ...filters, showDeliveries: e.target.checked })}
                  className="rounded text-purple-600"
                />
                <MapPin className="h-4 w-4 text-purple-600" />
                <span className="text-sm flex-1">Deliveries</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                <input
                  type="checkbox"
                  checked={filters.showRoutes}
                  onChange={(e) => setFilters({ ...filters, showRoutes: e.target.checked })}
                  className="rounded text-cyan-600"
                />
                <Navigation className="h-4 w-4 text-cyan-600" />
                <span className="text-sm flex-1">Routes</span>
              </label>
            </div>
          </div>

          {/* Active Shipments List - Bottom Left */}
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg border max-w-sm max-h-96 overflow-hidden flex flex-col">
            <div className="p-3 border-b bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Active Shipments ({shipments.length})
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <div className="space-y-2">
                {shipments.slice(0, 10).map((shipment) => (
                  <button
                    key={shipment.id}
                    onClick={() => focusOnShipment(shipment)}
                    className={`w-full text-left p-2 rounded-lg border transition-colors ${
                      selectedShipment?.id === shipment.id
                        ? 'bg-teal-50 border-teal-300 shadow-sm'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {shipment.vehicle_year} {shipment.vehicle_make} {shipment.vehicle_model}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${getStatusColor(shipment.status)}`}>
                        {shipment.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-green-500" />
                        <span className="truncate">{shipment.pickup_city}, {shipment.pickup_state}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Navigation className="h-3 w-3 text-blue-500" />
                        <span className="truncate">{shipment.delivery_city}, {shipment.delivery_state}</span>
                      </div>
                    </div>
                  </button>
                ))}
                {shipments.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No active shipments</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Selected Shipment Detail Panel - Top Right */}
          {selectedShipment && (
            <div className="absolute top-4 right-4 w-96 bg-white rounded-lg shadow-xl border">
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 text-lg">Shipment Details</h3>
                  <button
                    onClick={() => setSelectedShipment(null)}
                    className="text-gray-400 hover:text-gray-600 p-1"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Vehicle</p>
                    <p className="text-base font-semibold text-gray-900">
                      {selectedShipment.vehicle_year} {selectedShipment.vehicle_make} {selectedShipment.vehicle_model}
                    </p>
                  </div>

                  <div className="space-y-3 bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-600 mb-0.5">Pickup</p>
                        <p className="text-sm font-medium text-gray-900">{selectedShipment.pickup_address}</p>
                        <p className="text-xs text-gray-600">
                          {selectedShipment.pickup_city}, {selectedShipment.pickup_state}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Navigation className="h-4 w-4 text-blue-500 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-600 mb-0.5">Delivery</p>
                        <p className="text-sm font-medium text-gray-900">{selectedShipment.delivery_address}</p>
                        <p className="text-xs text-gray-600">
                          {selectedShipment.delivery_city}, {selectedShipment.delivery_state}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${getStatusColor(selectedShipment.status)}`}>
                      {selectedShipment.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>

                  <Button
                    onClick={() => window.open(`/dashboard/admin/shipments/${selectedShipment.id}`, '_blank')}
                    className="w-full"
                    size="sm"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Full Details
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Selected Driver Panel - Bottom Right */}
          {selectedDriver && (
            <div className="absolute bottom-4 right-4 w-80 bg-white rounded-lg shadow-xl border">
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Driver Info</h3>
                  <button
                    onClick={() => setSelectedDriver(null)}
                    className="text-gray-400 hover:text-gray-600 p-1"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Name</p>
                    <p className="font-medium text-gray-900">
                      {selectedDriver.first_name} {selectedDriver.last_name}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-1">Phone</p>
                    <p className="text-sm text-gray-900">{selectedDriver.phone || 'N/A'}</p>
                  </div>

                  {selectedDriver.location && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Last Location</p>
                      <p className="text-xs text-gray-600 font-mono">
                        {selectedDriver.location.latitude.toFixed(6)}, {selectedDriver.location.longitude.toFixed(6)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Legend - Bottom Center */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg border px-4 py-2">
            <div className="flex items-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow"></div>
                <span>Driver</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow"></div>
                <span>Pickup</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500 border-2 border-white shadow"></div>
                <span>Delivery</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-blue-500"></div>
                <span>Active Route</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
