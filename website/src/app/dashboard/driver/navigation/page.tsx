'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { toast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import {
  Navigation,
  MapPin,
  Package,
  Truck,
  Clock,
  Route,
  Zap,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertTriangle,
  Fuel,
  Coffee,
  Target,
  CheckCircle,
  Locate,
  Layers,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  X,
  Search,
  CornerUpRight,
  Info,
  Star,
  Scale,
  AlertCircle,
} from 'lucide-react'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Shipment {
  id: string
  title: string
  pickup_address: string
  delivery_address: string
  pickup_lat: number | null
  pickup_lng: number | null
  delivery_lat: number | null
  delivery_lng: number | null
  status: string
  estimated_price: number | null
  distance: number | null
  created_at: string
}

interface NearbyPlace {
  name: string
  address: string
  lat: number
  lng: number
  type: 'truck_stop' | 'fuel' | 'rest_area' | 'repair' | 'food' | 'weigh_station'
  rating?: number
  isOpen?: boolean
  distance?: string
}

interface TruckRestriction {
  type: 'low_clearance' | 'weight_limit' | 'no_trucks' | 'steep_grade'
  description: string
  location: string
  lat: number
  lng: number
}

// Carolina-specific known truck restrictions
const CAROLINA_TRUCK_RESTRICTIONS: TruckRestriction[] = [
  { type: 'low_clearance', description: 'Low clearance 11\'8" — Norfolk Southern Railroad', location: 'Gregson St, Durham, NC', lat: 35.9975, lng: -78.9050 },
  { type: 'low_clearance', description: 'Low clearance 12\'4" — CSX Railroad', location: 'S Tryon St, Charlotte, NC', lat: 35.2160, lng: -80.8492 },
  { type: 'low_clearance', description: 'Low clearance 12\'0"', location: 'Peace St, Raleigh, NC', lat: 35.7870, lng: -78.6470 },
  { type: 'weight_limit', description: 'Weight limit 15 tons — bridge restriction', location: 'NC-150 over Yadkin River', lat: 35.8350, lng: -80.4280 },
  { type: 'no_trucks', description: 'No trucks over 10,000 lbs — residential zone', location: 'Providence Rd, Charlotte, NC', lat: 35.1620, lng: -80.8120 },
  { type: 'steep_grade', description: '6% grade — use low gear downhill', location: 'I-40 near Old Fort, NC (Eastern Continental Divide)', lat: 35.6270, lng: -82.1690 },
  { type: 'steep_grade', description: '5% grade — truck pulloffs available', location: 'I-26 near Saluda, NC', lat: 35.2790, lng: -82.3310 },
  { type: 'low_clearance', description: 'Low clearance 13\'6" — railroad overpass', location: 'N Main St, Salisbury, NC', lat: 35.6744, lng: -80.4765 },
  { type: 'weight_limit', description: 'Posted weight limit — aging bridge', location: 'SC-9 over Broad River, SC', lat: 34.9930, lng: -81.5370 },
  { type: 'no_trucks', description: 'No through trucks — use US-74 bypass', location: 'Downtown Waynesville, NC', lat: 35.4888, lng: -83.0066 },
]

// Carolina weigh station locations
const CAROLINA_WEIGH_STATIONS = [
  { name: 'I-85 Weigh Station (NB)', lat: 35.0820, lng: -80.7260, state: 'NC', highway: 'I-85 N' },
  { name: 'I-85 Weigh Station (SB)', lat: 35.0810, lng: -80.7250, state: 'NC', highway: 'I-85 S' },
  { name: 'I-77 Weigh Station', lat: 35.3650, lng: -80.9580, state: 'NC', highway: 'I-77' },
  { name: 'I-40 Weigh Station (WB)', lat: 35.5270, lng: -79.1820, state: 'NC', highway: 'I-40 W' },
  { name: 'I-95 Weigh Station', lat: 34.7570, lng: -79.0120, state: 'NC', highway: 'I-95' },
  { name: 'I-26 Weigh Station', lat: 34.1570, lng: -81.1730, state: 'SC', highway: 'I-26' },
  { name: 'I-85 Weigh Station', lat: 34.8630, lng: -82.2430, state: 'SC', highway: 'I-85' },
  { name: 'I-95 Weigh Station (NB)', lat: 33.9740, lng: -80.3570, state: 'SC', highway: 'I-95 N' },
  { name: 'I-77 Weigh Station (SB)', lat: 34.7830, lng: -80.9220, state: 'SC', highway: 'I-77 S' },
]

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function DriverNavigationPage() {
  const { user, profile } = useAuth()
  const supabase = getSupabaseBrowserClient()

  // ── Refs ──────────────────────────────────────────────────────────
  const mapRef = useRef<google.maps.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const restrictionMarkersRef = useRef<google.maps.Marker[]>([])
  const weighStationMarkersRef = useRef<google.maps.Marker[]>([])
  const nearbyMarkersRef = useRef<google.maps.Marker[]>([])
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null)
  const driverMarkerRef = useRef<google.maps.Marker | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)

  // ── State ─────────────────────────────────────────────────────────
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loadingShipments, setLoadingShipments] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showTraffic, setShowTraffic] = useState(true)
  const [showRestrictions, setShowRestrictions] = useState(true)
  const [showWeighStations, setShowWeighStations] = useState(false)
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap')
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null)
  const [showShipmentPanel, setShowShipmentPanel] = useState(true)
  const [showNearbyPanel, setShowNearbyPanel] = useState(false)
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([])
  const [searchingNearby, setSearchingNearby] = useState(false)
  const [nearbyFilter, setNearbyFilter] = useState<string>('all')
  const [navigatingTo, setNavigatingTo] = useState<Shipment | null>(null)
  const [navInstruction, setNavInstruction] = useState('')
  const [navDistance, setNavDistance] = useState('')
  const [navDuration, setNavDuration] = useState('')
  const [navETA, setNavETA] = useState('')
  const [isNavigating, setIsNavigating] = useState(false)

  // ── Load Shipments (same logic as RouteOptimizer) ───────────────────
  useEffect(() => {
    const load = async () => {
      // Get authenticated user directly — same approach as RouteOptimizer
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const driverId = authUser?.id
      if (!driverId) return
      try {
        setLoadingShipments(true)
        const { data, error } = await supabase
          .from('shipments')
          .select('id, title, pickup_address, delivery_address, pickup_lat, pickup_lng, delivery_lat, delivery_lng, status, estimated_price, distance, created_at')
          .eq('driver_id', driverId)
          .in('status', ['accepted', 'assigned', 'picked_up', 'in_transit', 'in_progress', 'driver_en_route', 'driver_arrived', 'pickup_verification_pending', 'pickup_verified'])
          .order('created_at', { ascending: false })

        if (error) throw error
        setShipments(data || [])
      } catch (err) {
        console.error('Failed to load shipments:', err)
      } finally {
        setLoadingShipments(false)
      }
    }
    load()
  }, [supabase])

  // ── Initialize Map ─────────────────────────────────────────────────
  const initMap = useCallback(() => {
    if (!mapContainerRef.current || !window.google) return

    const map = new google.maps.Map(mapContainerRef.current, {
      center: { lat: 35.2271, lng: -80.8431 }, // Charlotte default
      zoom: 8,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      gestureHandling: 'greedy',
      styles: [
        { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
      ],
    })

    mapRef.current = map

    // Traffic layer (on by default)
    const traffic = new google.maps.TrafficLayer()
    traffic.setMap(map)
    trafficLayerRef.current = traffic

    // Directions renderer for navigation
    const renderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#F59E0B',
        strokeWeight: 5,
        strokeOpacity: 0.85,
      },
    })
    directionsRendererRef.current = renderer

    // Shared InfoWindow
    infoWindowRef.current = new google.maps.InfoWindow()

    setMapReady(true)
  }, [])

  useEffect(() => {
    const check = () => {
      if (window.google?.maps) { initMap(); return true }
      return false
    }
    if (!check()) {
      const interval = setInterval(() => { if (check()) clearInterval(interval) }, 200)
      return () => clearInterval(interval)
    }
  }, [initMap])

  // ── Place Shipment Markers ─────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    if (shipments.length === 0) return

    const bounds = new google.maps.LatLngBounds()
    let hasValidCoords = false

    shipments.forEach(shipment => {
      // Pickup marker
      if (shipment.pickup_lat && shipment.pickup_lng) {
        const pos = { lat: shipment.pickup_lat, lng: shipment.pickup_lng }
        bounds.extend(pos)
        hasValidCoords = true

        const needsPickup = ['accepted', 'assigned', 'driver_en_route', 'driver_arrived'].includes(shipment.status)

        const marker = new google.maps.Marker({
          position: pos,
          map: mapRef.current!,
          title: `Pickup: ${shipment.title}`,
          label: { text: 'P', color: '#FFFFFF', fontWeight: 'bold', fontSize: '11px' },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: needsPickup ? '#3B82F6' : '#9CA3AF',
            fillOpacity: needsPickup ? 1 : 0.5,
            strokeWeight: 2,
            strokeColor: '#1F2937',
          },
          zIndex: 50,
        })

        marker.addListener('click', () => {
          setSelectedShipment(shipment)
          showShipmentInfo(marker, shipment, 'pickup')
        })

        markersRef.current.push(marker)
      }

      // Delivery marker
      if (shipment.delivery_lat && shipment.delivery_lng) {
        const pos = { lat: shipment.delivery_lat, lng: shipment.delivery_lng }
        bounds.extend(pos)
        hasValidCoords = true

        const needsDelivery = ['picked_up', 'in_transit'].includes(shipment.status)

        const marker = new google.maps.Marker({
          position: pos,
          map: mapRef.current!,
          title: `Delivery: ${shipment.title}`,
          label: { text: 'D', color: '#FFFFFF', fontWeight: 'bold', fontSize: '11px' },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: needsDelivery ? '#10B981' : '#9CA3AF',
            fillOpacity: needsDelivery ? 1 : 0.5,
            strokeWeight: 2,
            strokeColor: '#1F2937',
          },
          zIndex: 49,
        })

        marker.addListener('click', () => {
          setSelectedShipment(shipment)
          showShipmentInfo(marker, shipment, 'delivery')
        })

        markersRef.current.push(marker)
      }
    })

    if (driverPos) {
      bounds.extend(driverPos)
      hasValidCoords = true
    }

    if (hasValidCoords) {
      mapRef.current.fitBounds(bounds, 60)
    }
  }, [mapReady, shipments, driverPos])

  // ── Show Shipment InfoWindow ──────────────────────────────────────
  const showShipmentInfo = (marker: google.maps.Marker, shipment: Shipment, type: 'pickup' | 'delivery') => {
    if (!infoWindowRef.current || !mapRef.current) return

    const statusLabel = {
      accepted: 'Accepted', assigned: 'Assigned', picked_up: 'Picked Up',
      in_transit: 'In Transit', driver_en_route: 'En Route', driver_arrived: 'At Pickup',
    }[shipment.status] || shipment.status

    const color = type === 'pickup' ? '#3B82F6' : '#10B981'

    infoWindowRef.current.setContent(`
      <div style="font-family:system-ui;max-width:280px;padding:4px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          <span style="background:${color};color:white;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;">
            ${type === 'pickup' ? 'PICKUP' : 'DELIVERY'}
          </span>
          <span style="font-size:10px;color:#888;">${statusLabel}</span>
        </div>
        <p style="font-weight:600;font-size:14px;margin:0 0 4px;color:#111;">${shipment.title}</p>
        <p style="font-size:12px;color:#555;margin:0 0 6px;">${type === 'pickup' ? shipment.pickup_address : shipment.delivery_address}</p>
        <div style="display:flex;gap:12px;font-size:11px;color:#777;">
          ${shipment.distance ? `<span>📏 ${shipment.distance} mi</span>` : ''}
          ${shipment.estimated_price ? `<span>💰 $${shipment.estimated_price.toFixed(0)}</span>` : ''}
        </div>
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid #eee;">
          <button onclick="window.__ddNavigateTo='${shipment.id}'"
            style="background:#F59E0B;color:white;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;width:100%;">
            🧭 Navigate Here
          </button>
        </div>
      </div>
    `)
    infoWindowRef.current.open(mapRef.current, marker)
  }

  // Listen for navigate clicks from InfoWindow
  useEffect(() => {
    const handler = () => {
      const id = (window as any).__ddNavigateTo
      if (id) {
        delete (window as any).__ddNavigateTo
        const shipment = shipments.find(s => s.id === id)
        if (shipment) navigateToShipment(shipment)
      }
    }
    const interval = setInterval(handler, 300)
    return () => clearInterval(interval)
  }, [shipments])

  // ── Truck Restriction Markers ──────────────────────────────────────
  useEffect(() => {
    restrictionMarkersRef.current.forEach(m => m.setMap(null))
    restrictionMarkersRef.current = []

    if (!mapReady || !mapRef.current || !showRestrictions) return

    CAROLINA_TRUCK_RESTRICTIONS.forEach(restriction => {
      const emoji = restriction.type === 'low_clearance' ? '⚠️'
        : restriction.type === 'weight_limit' ? '⚖️'
        : restriction.type === 'no_trucks' ? '🚫'
        : '⛰️'

      const marker = new google.maps.Marker({
        position: { lat: restriction.lat, lng: restriction.lng },
        map: mapRef.current!,
        title: restriction.description,
        label: { text: emoji, fontSize: '16px' },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 0,
          fillOpacity: 0,
          strokeOpacity: 0,
        },
        zIndex: 30,
      })

      marker.addListener('click', () => {
        if (!infoWindowRef.current || !mapRef.current) return
        const typeLabel = restriction.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        const clr = restriction.type === 'low_clearance' || restriction.type === 'no_trucks' ? '#DC2626'
          : restriction.type === 'weight_limit' ? '#D97706'
          : '#7C3AED'
        infoWindowRef.current.setContent(`
          <div style="font-family:system-ui;max-width:250px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              <span style="background:${clr};color:white;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;">
                ${typeLabel}
              </span>
            </div>
            <p style="font-weight:600;font-size:13px;margin:0 0 4px;">${restriction.description}</p>
            <p style="font-size:12px;color:#666;margin:0;">${restriction.location}</p>
          </div>
        `)
        infoWindowRef.current.open(mapRef.current, marker)
      })

      restrictionMarkersRef.current.push(marker)
    })
  }, [mapReady, showRestrictions])

  // ── Weigh Station Markers ──────────────────────────────────────────
  useEffect(() => {
    weighStationMarkersRef.current.forEach(m => m.setMap(null))
    weighStationMarkersRef.current = []

    if (!mapReady || !mapRef.current || !showWeighStations) return

    CAROLINA_WEIGH_STATIONS.forEach(ws => {
      const marker = new google.maps.Marker({
        position: { lat: ws.lat, lng: ws.lng },
        map: mapRef.current!,
        title: ws.name,
        label: { text: '⚖️', fontSize: '18px' },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 0,
          fillOpacity: 0,
          strokeOpacity: 0,
        },
        zIndex: 25,
      })

      marker.addListener('click', () => {
        if (!infoWindowRef.current || !mapRef.current) return
        infoWindowRef.current.setContent(`
          <div style="font-family:system-ui;max-width:220px;">
            <p style="font-weight:600;font-size:13px;margin:0 0 4px;">⚖️ ${ws.name}</p>
            <p style="font-size:12px;color:#666;margin:0;">${ws.highway} · ${ws.state}</p>
            <p style="font-size:11px;color:#999;margin:4px 0 0;">Check PrePass/DriveWyze for bypass status</p>
          </div>
        `)
        infoWindowRef.current.open(mapRef.current, marker)
      })

      weighStationMarkersRef.current.push(marker)
    })
  }, [mapReady, showWeighStations])

  // ── GPS Tracking ──────────────────────────────────────────────────
  const updateDriverMarker = useCallback((pos: { lat: number; lng: number }, heading: number | null) => {
    if (!mapRef.current) return

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setPosition(pos)
      if (heading != null) {
        const icon = driverMarkerRef.current.getIcon() as google.maps.Symbol
        if (icon) {
          icon.rotation = heading
          driverMarkerRef.current.setIcon(icon)
        }
      }
    } else {
      driverMarkerRef.current = new google.maps.Marker({
        position: pos,
        map: mapRef.current,
        title: 'Your Location',
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 7,
          fillColor: '#F59E0B',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
          rotation: heading || 0,
        },
        zIndex: 200,
      })
    }
  }, [])

  const startGPSTracking = useCallback(() => {
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setDriverPos(loc)
        updateDriverMarker(loc, pos.coords.heading)
      },
      () => {},
      { enableHighAccuracy: true }
    )

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setDriverPos(loc)
        updateDriverMarker(loc, pos.coords.heading)
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
  }, [updateDriverMarker])

  useEffect(() => {
    startGPSTracking()
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [startGPSTracking])

  // ── Toggle Traffic ─────────────────────────────────────────────────
  useEffect(() => {
    if (trafficLayerRef.current && mapRef.current) {
      trafficLayerRef.current.setMap(showTraffic ? mapRef.current : null)
    }
  }, [showTraffic])

  // ── Toggle Map Type ────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) mapRef.current.setMapTypeId(mapType)
  }, [mapType])

  // ── Navigate to Shipment ──────────────────────────────────────────
  const navigateToShipment = async (shipment: Shipment) => {
    if (!mapRef.current || !window.google) return

    const needsPickup = ['accepted', 'assigned', 'driver_en_route', 'driver_arrived'].includes(shipment.status)

    let origin: google.maps.LatLng | string
    const waypoints: google.maps.DirectionsWaypoint[] = []
    let destination: google.maps.LatLng | string

    if (driverPos) {
      origin = new google.maps.LatLng(driverPos.lat, driverPos.lng)
    } else {
      toast('Waiting for GPS location...', 'warning')
      return
    }

    if (needsPickup) {
      if (shipment.pickup_lat && shipment.pickup_lng) {
        waypoints.push({ location: new google.maps.LatLng(shipment.pickup_lat, shipment.pickup_lng), stopover: true })
      } else {
        waypoints.push({ location: shipment.pickup_address, stopover: true })
      }
      destination = shipment.delivery_lat && shipment.delivery_lng
        ? new google.maps.LatLng(shipment.delivery_lat, shipment.delivery_lng)
        : shipment.delivery_address
    } else {
      destination = shipment.delivery_lat && shipment.delivery_lng
        ? new google.maps.LatLng(shipment.delivery_lat, shipment.delivery_lng)
        : shipment.delivery_address
    }

    try {
      const result = await new google.maps.DirectionsService().route({
        origin,
        destination,
        waypoints,
        optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
      })

      if (directionsRendererRef.current) {
        directionsRendererRef.current.setDirections(result)
      }

      const legs = result.routes[0]?.legs || []
      let totalDist = 0
      let totalDur = 0
      legs.forEach(leg => {
        totalDist += leg.distance?.value || 0
        totalDur += (leg.duration_in_traffic?.value || leg.duration?.value || 0)
      })

      setNavDistance(`${(totalDist / 1609.34).toFixed(1)} mi`)
      setNavDuration(formatDuration(totalDur))
      setNavETA(new Date(Date.now() + totalDur * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))

      const firstStep = legs[0]?.steps?.[0]
      if (firstStep) setNavInstruction(stripHtml(firstStep.instructions))

      setNavigatingTo(shipment)
      setIsNavigating(true)
      setShowShipmentPanel(false)
      setShowNearbyPanel(false)

      if (voiceEnabled) {
        speak(`Navigating to ${needsPickup ? 'pickup' : 'delivery'} for ${shipment.title}.`)
      }
      toast(`Navigation started for ${shipment.title}`, 'success')
    } catch (err) {
      console.error('Navigation error:', err)
      toast('Could not calculate route — check addresses', 'error')
    }
  }

  const stopNavigation = () => {
    setIsNavigating(false)
    setNavigatingTo(null)
    setNavInstruction('')
    setNavDistance('')
    setNavDuration('')
    setNavETA('')
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] } as any)
    }
    if (voiceEnabled) speak('Navigation stopped.')
    toast('Navigation stopped', 'info')
  }

  // ── Find Nearby Services ──────────────────────────────────────────
  const findNearby = (type: string) => {
    if (!mapRef.current || !driverPos) {
      toast('Need GPS location to search nearby', 'warning')
      return
    }

    setSearchingNearby(true)
    setShowNearbyPanel(true)
    setShowShipmentPanel(false)

    const service = new google.maps.places.PlacesService(mapRef.current)
    const configs: Record<string, { keyword: string; type: string }> = {
      truck_stop: { keyword: 'truck stop', type: 'gas_station' },
      fuel: { keyword: 'gas station diesel', type: 'gas_station' },
      food: { keyword: 'restaurant food', type: 'restaurant' },
      repair: { keyword: 'truck repair mechanic', type: 'car_repair' },
      rest_area: { keyword: 'rest area park', type: 'park' },
    }

    const cfg = configs[type] || configs.truck_stop!

    service.nearbySearch(
      { location: driverPos, radius: 40000, keyword: cfg.keyword, type: cfg.type as any },
      (results, status) => {
        setSearchingNearby(false)

        if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
          setNearbyPlaces([])
          return
        }

        nearbyMarkersRef.current.forEach(m => m.setMap(null))
        nearbyMarkersRef.current = []

        const places: NearbyPlace[] = results.slice(0, 15).map(place => {
          const lat = place.geometry?.location?.lat() || 0
          const lng = place.geometry?.location?.lng() || 0

          if (mapRef.current && lat && lng) {
            const emoji = type === 'fuel' ? '⛽' : type === 'food' ? '🍔' : type === 'repair' ? '🔧' : type === 'rest_area' ? '🅿️' : '🚛'
            const m = new google.maps.Marker({
              position: { lat, lng },
              map: mapRef.current,
              title: place.name || '',
              label: { text: emoji, fontSize: '16px' },
              icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0, fillOpacity: 0, strokeOpacity: 0 },
              zIndex: 20,
            })

            m.addListener('click', () => {
              if (!infoWindowRef.current || !mapRef.current) return
              infoWindowRef.current.setContent(`
                <div style="font-family:system-ui;max-width:220px;">
                  <p style="font-weight:600;font-size:13px;margin:0 0 2px;">${place.name || ''}</p>
                  <p style="font-size:12px;color:#666;margin:0 0 4px;">${place.vicinity || ''}</p>
                  ${place.rating ? `<p style="font-size:11px;color:#F59E0B;margin:0;">⭐ ${place.rating}/5</p>` : ''}
                </div>
              `)
              infoWindowRef.current.open(mapRef.current, m)
            })

            nearbyMarkersRef.current.push(m)
          }

          let distStr = ''
          if (driverPos && lat && lng) {
            const R = 3958.8
            const dLat = (lat - driverPos.lat) * Math.PI / 180
            const dLng = (lng - driverPos.lng) * Math.PI / 180
            const a = Math.sin(dLat/2) ** 2 +
              Math.cos(driverPos.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
              Math.sin(dLng/2) ** 2
            distStr = `${(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1)} mi`
          }

          return {
            name: place.name || 'Unknown',
            address: place.vicinity || '',
            lat, lng,
            type: type as NearbyPlace['type'],
            rating: place.rating,
            isOpen: place.opening_hours?.isOpen?.(),
            distance: distStr,
          }
        })

        places.sort((a, b) => parseFloat(a.distance || '999') - parseFloat(b.distance || '999'))
        setNearbyPlaces(places)
        setNearbyFilter(type)
      }
    )
  }

  // ── Map Helpers ───────────────────────────────────────────────────
  const recenterOnDriver = () => {
    if (!mapRef.current || !driverPos) { toast('GPS not available', 'warning'); return }
    mapRef.current.panTo(driverPos)
    mapRef.current.setZoom(14)
  }

  const fitAllShipments = () => {
    if (!mapRef.current || shipments.length === 0) return
    const bounds = new google.maps.LatLngBounds()
    let has = false
    shipments.forEach(s => {
      if (s.pickup_lat && s.pickup_lng) { bounds.extend({ lat: s.pickup_lat, lng: s.pickup_lng }); has = true }
      if (s.delivery_lat && s.delivery_lng) { bounds.extend({ lat: s.delivery_lat, lng: s.delivery_lng }); has = true }
    })
    if (driverPos) { bounds.extend(driverPos); has = true }
    if (has) mapRef.current.fitBounds(bounds, 60)
  }

  const speak = (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.95; u.volume = 0.9
    window.speechSynthesis.speak(u)
  }

  const stripHtml = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.textContent || ''

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.round((s % 3600) / 60)
    return h === 0 ? `${m} min` : `${h}h ${m}m`
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      accepted: { label: 'Accepted', color: 'bg-blue-50 text-blue-700 border-blue-200' },
      assigned: { label: 'Assigned', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
      driver_en_route: { label: 'En Route', color: 'bg-purple-50 text-purple-700 border-purple-200' },
      driver_arrived: { label: 'At Pickup', color: 'bg-pink-50 text-pink-700 border-pink-200' },
      picked_up: { label: 'Picked Up', color: 'bg-orange-50 text-orange-700 border-orange-200' },
      in_transit: { label: 'In Transit', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    }
    const info = map[status] || { label: status, color: 'bg-gray-50 text-gray-700 border-gray-200' }
    return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${info.color}`}>{info.label}</span>
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Render
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white' : 'space-y-4'}`}>
      {/* ── Header ─────────────────────────────────────────────── */}
      {!isFullscreen && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Navigation className="h-6 w-6 text-amber-500" />
              Driver Map
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Live map &middot; shipment markers &middot; traffic &middot; truck restrictions &middot; nearby services
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">
              {shipments.length} active shipment{shipments.length !== 1 ? 's' : ''}
            </span>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" title="GPS Active" />
          </div>
        </div>
      )}

      {/* ── Map ────────────────────────────────────────────────── */}
      <div className={`relative ${isFullscreen ? 'h-full' : ''}`}>
        <div
          ref={mapContainerRef}
          className={`w-full ${isFullscreen ? 'h-full' : 'h-[calc(100vh-220px)] min-h-[500px]'} rounded-lg overflow-hidden border border-gray-200`}
        />

        {/* Loading */}
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Loading map...</p>
            </div>
          </div>
        )}

        {mapReady && (
          <>
            {/* ── Navigation Bar ──────────────────────────────── */}
            {isNavigating && navigatingTo && (
              <div className="absolute top-3 left-3 right-3 z-10">
                {navInstruction && (
                  <div className="bg-gray-900 text-white rounded-lg px-4 py-3 mb-2 shadow-lg">
                    <div className="flex items-start gap-3">
                      <CornerUpRight className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{navInstruction}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-300">
                          <span>{navDistance}</span>
                          <span>·</span>
                          <span>{navDuration}</span>
                          <span>·</span>
                          <span>ETA {navETA}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="bg-white/95 backdrop-blur rounded-lg px-4 py-2.5 shadow-md flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Truck className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold text-gray-900 truncate max-w-[200px]">{navigatingTo.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Route className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-gray-700">{navDistance}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Clock className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-gray-700">{navDuration}</span>
                    </div>
                  </div>
                  <Button onClick={stopNavigation} variant="outline" className="text-xs border-red-300 text-red-600 hover:bg-red-50 h-8">
                    Stop
                  </Button>
                </div>
              </div>
            )}

            {/* ── Right Controls ──────────────────────────────── */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2">
              <MapBtn icon={<Locate className="h-4 w-4" />} title="My Location" onClick={recenterOnDriver} />
              <MapBtn icon={<Target className="h-4 w-4" />} title="Fit All" onClick={fitAllShipments} />
              <div className="w-9 h-px bg-gray-200" />
              <MapBtn icon={<AlertTriangle className="h-4 w-4" />} title="Truck Restrictions" onClick={() => setShowRestrictions(p => !p)} active={showRestrictions} activeColor="text-red-500" />
              <MapBtn icon={<Scale className="h-4 w-4" />} title="Weigh Stations" onClick={() => setShowWeighStations(p => !p)} active={showWeighStations} activeColor="text-purple-500" />
              <MapBtn icon={<AlertCircle className="h-4 w-4" />} title="Traffic" onClick={() => setShowTraffic(p => !p)} active={showTraffic} activeColor="text-amber-500" />
              <div className="w-9 h-px bg-gray-200" />
              <MapBtn icon={<Layers className="h-4 w-4" />} title="Map Style" onClick={() => setMapType(p => p === 'roadmap' ? 'satellite' : p === 'satellite' ? 'hybrid' : 'roadmap')} />
              <MapBtn icon={voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} title="Voice" onClick={() => setVoiceEnabled(p => !p)} active={voiceEnabled} activeColor="text-amber-500" />
              <MapBtn icon={isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />} title="Fullscreen" onClick={() => setIsFullscreen(p => !p)} />
            </div>

            {/* ── Left Panels ─────────────────────────────────── */}
            <div className="absolute left-3 bottom-3 z-10" style={{ top: isNavigating ? '140px' : '12px' }}>
              {/* Panel Tab Toggles */}
              <div className="flex gap-1 mb-2">
                <PanelTab
                  active={showShipmentPanel}
                  onClick={() => { setShowShipmentPanel(!showShipmentPanel); setShowNearbyPanel(false) }}
                  icon={<Package className="h-3.5 w-3.5" />}
                  label={`Shipments (${shipments.length})`}
                />
                <PanelTab
                  active={showNearbyPanel}
                  onClick={() => { setShowNearbyPanel(!showNearbyPanel); setShowShipmentPanel(false) }}
                  icon={<Search className="h-3.5 w-3.5" />}
                  label="Nearby"
                />
              </div>

              {/* Shipment List Panel */}
              {showShipmentPanel && (
                <div className="bg-white/95 backdrop-blur rounded-lg shadow-lg border border-gray-200 w-80 max-h-[calc(100vh-340px)] overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-amber-500" />
                      Active Shipments
                    </h3>
                  </div>

                  <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
                    {loadingShipments ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500" />
                      </div>
                    ) : shipments.length === 0 ? (
                      <div className="p-6 text-center">
                        <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs text-gray-500">No active shipments</p>
                      </div>
                    ) : (
                      shipments.map(shipment => (
                        <div
                          key={shipment.id}
                          className={`px-4 py-3 cursor-pointer hover:bg-amber-50/50 transition-colors ${
                            selectedShipment?.id === shipment.id ? 'bg-amber-50 border-l-2 border-amber-500' : ''
                          }`}
                          onClick={() => {
                            setSelectedShipment(shipment)
                            if (mapRef.current) {
                              const bounds = new google.maps.LatLngBounds()
                              if (shipment.pickup_lat && shipment.pickup_lng) bounds.extend({ lat: shipment.pickup_lat, lng: shipment.pickup_lng })
                              if (shipment.delivery_lat && shipment.delivery_lng) bounds.extend({ lat: shipment.delivery_lat, lng: shipment.delivery_lng })
                              if (driverPos) bounds.extend(driverPos)
                              mapRef.current.fitBounds(bounds, 80)
                            }
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-gray-900 truncate flex-1">{shipment.title}</p>
                            {statusBadge(shipment.status)}
                          </div>
                          <div className="space-y-1 mb-2">
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                              <MapPin className="h-3 w-3 text-blue-400 shrink-0" />
                              <span className="truncate">{shipment.pickup_address}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                              <MapPin className="h-3 w-3 text-green-400 shrink-0" />
                              <span className="truncate">{shipment.delivery_address}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-[11px] text-gray-400">
                              {shipment.distance && <span>{shipment.distance} mi</span>}
                              {shipment.estimated_price && <span className="text-green-600 font-medium">${shipment.estimated_price.toFixed(0)}</span>}
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); navigateToShipment(shipment) }}
                              className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md"
                            >
                              <Navigation className="h-3 w-3" />
                              Navigate
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Nearby Services Panel */}
              {showNearbyPanel && (
                <div className="bg-white/95 backdrop-blur rounded-lg shadow-lg border border-gray-200 w-80 max-h-[calc(100vh-340px)] overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-3">
                      Find Nearby Services
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { key: 'truck_stop', label: '🚛 Truck Stops' },
                        { key: 'fuel', label: '⛽ Fuel / Diesel' },
                        { key: 'food', label: '🍔 Food' },
                        { key: 'repair', label: '🔧 Repair' },
                        { key: 'rest_area', label: '🅿️ Rest Areas' },
                      ].map(svc => (
                        <button
                          key={svc.key}
                          onClick={() => findNearby(svc.key)}
                          disabled={searchingNearby}
                          className={`text-[11px] font-medium px-2.5 py-1.5 rounded-md border transition-colors ${
                            nearbyFilter === svc.key
                              ? 'bg-amber-50 border-amber-300 text-amber-700'
                              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-amber-50'
                          }`}
                        >
                          {svc.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-y-auto flex-1">
                    {searchingNearby ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500" />
                      </div>
                    ) : nearbyPlaces.length === 0 ? (
                      <div className="p-6 text-center">
                        <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs text-gray-500">Select a category to search</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {nearbyPlaces.map((place, idx) => (
                          <div
                            key={idx}
                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => {
                              if (mapRef.current && place.lat && place.lng) {
                                mapRef.current.panTo({ lat: place.lat, lng: place.lng })
                                mapRef.current.setZoom(15)
                              }
                            }}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{place.name}</p>
                              {place.distance && <span className="text-[11px] text-gray-400 shrink-0">{place.distance}</span>}
                            </div>
                            <p className="text-[11px] text-gray-500 truncate">{place.address}</p>
                            <div className="flex items-center gap-3 mt-1">
                              {place.rating && (
                                <span className="text-[11px] text-amber-500 flex items-center gap-0.5">
                                  <Star className="h-3 w-3" /> {place.rating}
                                </span>
                              )}
                              {place.isOpen !== undefined && (
                                <span className={`text-[11px] ${place.isOpen ? 'text-green-600' : 'text-red-500'}`}>
                                  {place.isOpen ? 'Open' : 'Closed'}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Bottom Legend Bar ────────────────────────────── */}
            {!isNavigating && (
              <div className="absolute bottom-3 left-[340px] right-14 z-10">
                <div className="bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500" /> Pickup</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500" /> Delivery</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500" /> You</span>
                    {showRestrictions && <span className="flex items-center gap-1.5"><span className="text-sm">⚠️</span> Restriction</span>}
                    {showWeighStations && <span className="flex items-center gap-1.5"><span className="text-sm">⚖️</span> Weigh Station</span>}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <Info className="h-3 w-3" />
                    <span>Carolina Region</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sub-components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function MapBtn({ icon, title, onClick, active, activeColor }: {
  icon: React.ReactNode; title: string; onClick: () => void; active?: boolean; activeColor?: string
}) {
  return (
    <button onClick={onClick} title={title}
      className={`w-9 h-9 rounded-lg shadow-md flex items-center justify-center transition-colors ${
        active ? `bg-amber-50 border border-amber-300 ${activeColor || ''}` : 'bg-white border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {icon}
    </button>
  )
}

function PanelTab({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium shadow-md transition-colors ${
        active ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
