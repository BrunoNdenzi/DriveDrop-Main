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
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Target,
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
  Shield,
  Ruler,
  ArrowUpDown,
  Eye,
  DollarSign,
  Fuel,
  TrendingUp,
  BrickWall,
} from 'lucide-react'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Shipment {
  id: string
  title: string
  pickup_address: string
  delivery_address: string
  status: string
  estimated_price: number | null
  distance: number | null
  created_at: string
}

interface GeocodedCoords {
  pickup?: { lat: number; lng: number }
  delivery?: { lat: number; lng: number }
}

interface NearbyPlace {
  name: string
  address: string
  lat: number
  lng: number
  type: string
  rating?: number
  isOpen?: boolean
  distance?: string
}

interface TruckRestriction {
  type: 'low_clearance' | 'weight_limit' | 'no_trucks' | 'steep_grade' | 'sharp_curve' | 'narrow_road'
  description: string
  location: string
  lat: number
  lng: number
  clearance_ft?: number
  weight_tons?: number
}

interface TruckProfile {
  height_ft: number
  weight_tons: number
  length_ft: number
  is_hazmat: boolean
  trailer_type: string
}

interface RouteInfo {
  shipmentId: string
  distance: string
  duration: string
  distanceMeters: number
  durationSeconds: number
  eta: string
  warnings: string[]
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Known truck restrictions database (US — Southeast & East Coast focus)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TRUCK_RESTRICTIONS: TruckRestriction[] = [
  // North Carolina
  { type: 'low_clearance', description: 'Low clearance 11\'8" — Norfolk Southern Railroad overpass', location: 'Gregson St, Durham, NC', lat: 35.9975, lng: -78.9050, clearance_ft: 11.67 },
  { type: 'low_clearance', description: 'Low clearance 12\'4" — CSX Railroad bridge', location: 'S Tryon St, Charlotte, NC', lat: 35.2160, lng: -80.8492, clearance_ft: 12.33 },
  { type: 'low_clearance', description: 'Low clearance 12\'0"', location: 'Peace St, Raleigh, NC', lat: 35.7870, lng: -78.6470, clearance_ft: 12.0 },
  { type: 'low_clearance', description: 'Low clearance 13\'6" — railroad overpass', location: 'N Main St, Salisbury, NC', lat: 35.6744, lng: -80.4765, clearance_ft: 13.5 },
  { type: 'low_clearance', description: 'Low clearance 12\'6" — railroad underpass', location: 'S Elm St, Greensboro, NC', lat: 36.0687, lng: -79.7922, clearance_ft: 12.5 },
  { type: 'weight_limit', description: 'Weight limit 15 tons — bridge restriction', location: 'NC-150 over Yadkin River', lat: 35.8350, lng: -80.4280, weight_tons: 15 },
  { type: 'weight_limit', description: 'Posted weight limit 20 tons — aging bridge', location: 'NC-49 bridge near Asheboro, NC', lat: 35.7075, lng: -79.8136, weight_tons: 20 },
  { type: 'no_trucks', description: 'No trucks over 10,000 lbs — residential zone', location: 'Providence Rd, Charlotte, NC', lat: 35.1620, lng: -80.8120 },
  { type: 'no_trucks', description: 'No through trucks — use US-74 bypass', location: 'Downtown Waynesville, NC', lat: 35.4888, lng: -83.0066 },
  { type: 'no_trucks', description: 'No commercial vehicles — residential', location: 'Queens Rd, Charlotte, NC', lat: 35.1935, lng: -80.8375 },
  { type: 'steep_grade', description: '6% grade — use low gear, runaway truck ramp available', location: 'I-40 near Old Fort, NC (Eastern Continental Divide)', lat: 35.6270, lng: -82.1690 },
  { type: 'steep_grade', description: '5% grade — truck pulloffs available', location: 'I-26 near Saluda, NC', lat: 35.2790, lng: -82.3310 },
  { type: 'steep_grade', description: '6% grade — Fancy Gap mountain descent', location: 'I-77 at Fancy Gap, VA/NC border', lat: 36.6540, lng: -80.8340 },
  // South Carolina
  { type: 'weight_limit', description: 'Posted weight limit 18 tons — aging bridge', location: 'SC-9 over Broad River, SC', lat: 34.9930, lng: -81.5370, weight_tons: 18 },
  { type: 'low_clearance', description: 'Low clearance 12\'8" — railroad overpass', location: 'Gervais St, Columbia, SC', lat: 34.0014, lng: -81.0348, clearance_ft: 12.67 },
  { type: 'no_trucks', description: 'No trucks — historic district', location: 'Meeting St, Charleston, SC', lat: 32.7765, lng: -79.9311 },
  // Virginia
  { type: 'low_clearance', description: 'Low clearance 11\'0" — C&O rail bridge', location: 'W Main St, Richmond, VA', lat: 37.5407, lng: -77.4360, clearance_ft: 11.0 },
  { type: 'low_clearance', description: 'Low clearance 12\'2" — railroad overpass', location: 'Commerce St, Petersburg, VA', lat: 37.2279, lng: -77.4019, clearance_ft: 12.17 },
  { type: 'steep_grade', description: '7% grade — Afton Mountain, caution in winter', location: 'I-64 Afton Mountain, VA', lat: 37.9570, lng: -78.8520 },
  // Georgia
  { type: 'low_clearance', description: 'Low clearance 11\'8" — Norfolk Southern Railroad', location: '11th St NW, Atlanta, GA', lat: 33.7815, lng: -84.3961, clearance_ft: 11.67 },
  { type: 'no_trucks', description: 'No through trucks — residential/campus', location: 'North Ave NE, Atlanta, GA', lat: 33.7714, lng: -84.3862 },
  // Tennessee
  { type: 'steep_grade', description: '6% grade — Monteagle Mountain', location: 'I-24 Monteagle, TN', lat: 35.2384, lng: -85.8395 },
  { type: 'low_clearance', description: 'Low clearance 12\'0" — railroad bridge', location: 'Broadway, Nashville, TN', lat: 36.1563, lng: -86.7896, clearance_ft: 12.0 },
  // Florida
  { type: 'weight_limit', description: 'Weight limit 20 tons — drawbridge', location: 'US-17 St Johns River bridge, FL', lat: 29.0295, lng: -81.3044, weight_tons: 20 },
  { type: 'low_clearance', description: 'Low clearance 13\'0"', location: 'Colonial Dr, Orlando, FL', lat: 28.5505, lng: -81.3744, clearance_ft: 13.0 },
  // Notable
  { type: 'narrow_road', description: 'Narrow lanes — no wide loads without permit', location: 'George Washington Bridge approaches, NJ', lat: 40.8517, lng: -73.9527 },
  { type: 'sharp_curve', description: 'Sharp curves — 25 mph advisory for large vehicles', location: 'I-40 Pigeon River Gorge, NC/TN border', lat: 35.7270, lng: -83.0040 },
]

const WEIGH_STATIONS = [
  { name: 'I-85 Weigh Station (NB)', lat: 35.0820, lng: -80.7260, state: 'NC', highway: 'I-85 N' },
  { name: 'I-85 Weigh Station (SB)', lat: 35.0810, lng: -80.7250, state: 'NC', highway: 'I-85 S' },
  { name: 'I-77 Weigh Station', lat: 35.3650, lng: -80.9580, state: 'NC', highway: 'I-77' },
  { name: 'I-40 Weigh Station (WB)', lat: 35.5270, lng: -79.1820, state: 'NC', highway: 'I-40 W' },
  { name: 'I-95 Weigh Station', lat: 34.7570, lng: -79.0120, state: 'NC', highway: 'I-95' },
  { name: 'I-26 Weigh Station', lat: 34.1570, lng: -81.1730, state: 'SC', highway: 'I-26' },
  { name: 'I-85 Weigh Station', lat: 34.8630, lng: -82.2430, state: 'SC', highway: 'I-85' },
  { name: 'I-95 Weigh Station (NB)', lat: 33.9740, lng: -80.3570, state: 'SC', highway: 'I-95 N' },
  { name: 'I-77 Weigh Station (SB)', lat: 34.7830, lng: -80.9220, state: 'SC', highway: 'I-77 S' },
  { name: 'I-75 Weigh Station', lat: 30.8450, lng: -83.2550, state: 'GA', highway: 'I-75' },
  { name: 'I-95 Weigh Station', lat: 31.5610, lng: -81.3640, state: 'GA', highway: 'I-95' },
  { name: 'I-81 Weigh Station', lat: 37.1830, lng: -80.3960, state: 'VA', highway: 'I-81' },
  { name: 'I-95 Weigh Station', lat: 37.4920, lng: -77.4330, state: 'VA', highway: 'I-95' },
  { name: 'I-40 Weigh Station', lat: 35.8460, lng: -86.3220, state: 'TN', highway: 'I-40' },
  { name: 'I-75 Weigh Station', lat: 27.4310, lng: -82.4480, state: 'FL', highway: 'I-75' },
]

const ROUTE_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#EC4899', '#06B6D4', '#84CC16']

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function DriverNavigationPage() {
  const { user, profile } = useAuth()
  const supabase = getSupabaseBrowserClient()

  const mapRef = useRef<google.maps.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const restrictionMarkersRef = useRef<google.maps.Marker[]>([])
  const weighStationMarkersRef = useRef<google.maps.Marker[]>([])
  const nearbyMarkersRef = useRef<google.maps.Marker[]>([])
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  const multiRouteRenderersRef = useRef<google.maps.DirectionsRenderer[]>([])
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null)
  const driverMarkerRef = useRef<google.maps.Marker | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)

  const [shipments, setShipments] = useState<Shipment[]>([])
  const [shipmentCoords, setShipmentCoords] = useState<Record<string, GeocodedCoords>>({})
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
  const [activePanel, setActivePanel] = useState<'shipments' | 'nearby' | 'vehicle' | null>('shipments')
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([])
  const [searchingNearby, setSearchingNearby] = useState(false)
  const [nearbyFilter, setNearbyFilter] = useState<string>('all')
  const [navigatingTo, setNavigatingTo] = useState<Shipment | null>(null)
  const [navInstruction, setNavInstruction] = useState('')
  const [navDistance, setNavDistance] = useState('')
  const [navDuration, setNavDuration] = useState('')
  const [navETA, setNavETA] = useState('')
  const [isNavigating, setIsNavigating] = useState(false)
  const [showAllRoutes, setShowAllRoutes] = useState(false)
  const [allRouteInfos, setAllRouteInfos] = useState<RouteInfo[]>([])
  const [loadingAllRoutes, setLoadingAllRoutes] = useState(false)
  const [routeWarnings, setRouteWarnings] = useState<string[]>([])
  const [truckProfile, setTruckProfile] = useState<TruckProfile>({
    height_ft: 13.5, weight_tons: 40, length_ft: 75, is_hazmat: false, trailer_type: 'car_hauler',
  })
  const [truckSafeMode, setTruckSafeMode] = useState(true)
  const [showAllBridges, setShowAllBridges] = useState(false)

  // ── Load Shipments ────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser?.id) return
      try {
        setLoadingShipments(true)
        const { data, error } = await supabase
          .from('shipments')
          .select('id, title, pickup_address, delivery_address, status, estimated_price, distance, created_at')
          .eq('driver_id', authUser.id)
          .in('status', ['accepted', 'assigned', 'picked_up', 'in_transit', 'in_progress', 'driver_en_route', 'driver_arrived', 'pickup_verification_pending', 'pickup_verified'])
          .order('created_at', { ascending: false })
        if (error) throw error
        setShipments(data || [])
        if ((data || []).length > 0 && window.google) geocodeShipments(data || [])
      } catch (err) { console.error('Failed to load shipments:', err) }
      finally { setLoadingShipments(false) }
    }
    load()
  }, [supabase])

  const geocodeShipments = async (items: Shipment[]) => {
    if (!window.google) return
    const geocoder = new google.maps.Geocoder()
    const coords: Record<string, GeocodedCoords> = {}
    const geocode = (address: string): Promise<{ lat: number; lng: number } | null> =>
      new Promise(resolve => {
        geocoder.geocode({ address }, (results, status) => {
          if (status === 'OK' && results?.[0]?.geometry?.location) {
            resolve({ lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() })
          } else resolve(null)
        })
      })
    for (let i = 0; i < items.length; i += 5) {
      const batch = items.slice(i, i + 5)
      await Promise.all(batch.map(async s => {
        const entry: GeocodedCoords = {}
        const [p, d] = await Promise.all([geocode(s.pickup_address), geocode(s.delivery_address)])
        if (p) entry.pickup = p
        if (d) entry.delivery = d
        coords[s.id] = entry
      }))
    }
    setShipmentCoords(coords)
  }

  useEffect(() => {
    if (shipments.length > 0 && Object.keys(shipmentCoords).length === 0 && window.google) geocodeShipments(shipments)
  }, [mapReady, shipments.length])

  // ── Init Map ───────────────────────────────────────────────────────
  const initMap = useCallback(() => {
    if (!mapContainerRef.current || !window.google) return
    const map = new google.maps.Map(mapContainerRef.current, {
      center: { lat: 35.2271, lng: -80.8431 }, zoom: 8,
      mapTypeControl: false, streetViewControl: false, fullscreenControl: false, zoomControl: true, gestureHandling: 'greedy',
      styles: [
        { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
      ],
    })
    mapRef.current = map
    const traffic = new google.maps.TrafficLayer(); traffic.setMap(map); trafficLayerRef.current = traffic
    directionsRendererRef.current = new google.maps.DirectionsRenderer({
      map, suppressMarkers: true, polylineOptions: { strokeColor: '#F59E0B', strokeWeight: 5, strokeOpacity: 0.85 },
    })
    infoWindowRef.current = new google.maps.InfoWindow()
    setMapReady(true)
  }, [])

  useEffect(() => {
    const check = () => { if (window.google?.maps) { initMap(); return true } return false }
    if (!check()) { const i = setInterval(() => { if (check()) clearInterval(i) }, 200); return () => clearInterval(i) }
  }, [initMap])

  // ── Place Shipment Markers ────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    markersRef.current.forEach(m => m.setMap(null)); markersRef.current = []
    if (shipments.length === 0) return
    const bounds = new google.maps.LatLngBounds(); let hasValid = false
    shipments.forEach(s => {
      const coords = shipmentCoords[s.id]
      if (coords?.pickup) {
        bounds.extend(coords.pickup); hasValid = true
        const needsPickup = ['accepted', 'assigned', 'driver_en_route', 'driver_arrived'].includes(s.status)
        const m = new google.maps.Marker({
          position: coords.pickup, map: mapRef.current!, title: `Pickup: ${s.title}`,
          label: { text: 'P', color: '#FFF', fontWeight: 'bold', fontSize: '11px' },
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: needsPickup ? '#3B82F6' : '#9CA3AF', fillOpacity: needsPickup ? 1 : 0.5, strokeWeight: 2, strokeColor: '#1F2937' }, zIndex: 50,
        })
        m.addListener('click', () => { setSelectedShipment(s); showShipmentInfo(m, s, 'pickup') })
        markersRef.current.push(m)
      }
      if (coords?.delivery) {
        bounds.extend(coords.delivery); hasValid = true
        const needsDel = ['picked_up', 'in_transit'].includes(s.status)
        const m = new google.maps.Marker({
          position: coords.delivery, map: mapRef.current!, title: `Delivery: ${s.title}`,
          label: { text: 'D', color: '#FFF', fontWeight: 'bold', fontSize: '11px' },
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: needsDel ? '#10B981' : '#9CA3AF', fillOpacity: needsDel ? 1 : 0.5, strokeWeight: 2, strokeColor: '#1F2937' }, zIndex: 49,
        })
        m.addListener('click', () => { setSelectedShipment(s); showShipmentInfo(m, s, 'delivery') })
        markersRef.current.push(m)
      }
    })
    if (driverPos) { bounds.extend(driverPos); hasValid = true }
    if (hasValid) mapRef.current.fitBounds(bounds, 60)
  }, [mapReady, shipments, shipmentCoords, driverPos])

  const showShipmentInfo = (marker: google.maps.Marker, shipment: Shipment, type: 'pickup' | 'delivery') => {
    if (!infoWindowRef.current || !mapRef.current) return
    const color = type === 'pickup' ? '#3B82F6' : '#10B981'
    infoWindowRef.current.setContent(`
      <div style="font-family:system-ui;max-width:280px;padding:4px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          <span style="background:${color};color:white;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;">${type.toUpperCase()}</span>
        </div>
        <p style="font-weight:600;font-size:14px;margin:0 0 4px;">${shipment.title}</p>
        <p style="font-size:12px;color:#555;margin:0 0 6px;">${type === 'pickup' ? shipment.pickup_address : shipment.delivery_address}</p>
        <div style="display:flex;gap:12px;font-size:11px;color:#777;">
          ${shipment.distance ? `<span>📏 ${shipment.distance} mi</span>` : ''}
          ${shipment.estimated_price ? `<span>💰 $${shipment.estimated_price.toFixed(0)}</span>` : ''}
        </div>
        <button onclick="window.__ddNavigateTo='${shipment.id}'"
          style="background:#F59E0B;color:white;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;width:100%;margin-top:8px;">
          🧭 Navigate Here
        </button>
      </div>
    `)
    infoWindowRef.current.open(mapRef.current, marker)
  }

  useEffect(() => {
    const handler = () => { const id = (window as any).__ddNavigateTo; if (id) { delete (window as any).__ddNavigateTo; const s = shipments.find(x => x.id === id); if (s) navigateToShipment(s) } }
    const i = setInterval(handler, 300); return () => clearInterval(i)
  }, [shipments])

  // ── Truck Restriction Markers ─────────────────────────────────────
  useEffect(() => {
    restrictionMarkersRef.current.forEach(m => m.setMap(null)); restrictionMarkersRef.current = []
    if (!mapReady || !mapRef.current || !showRestrictions) return
    TRUCK_RESTRICTIONS.forEach(r => {
      const isDanger = (r.type === 'low_clearance' && r.clearance_ft && truckProfile.height_ft >= r.clearance_ft) ||
        (r.type === 'weight_limit' && r.weight_tons && truckProfile.weight_tons >= r.weight_tons)
      const emoji = r.type === 'low_clearance' ? (isDanger ? '🚫' : '⚠️') : r.type === 'weight_limit' ? (isDanger ? '🚫' : '⚖️') : r.type === 'no_trucks' ? '🚫' : r.type === 'steep_grade' ? '⛰️' : r.type === 'sharp_curve' ? '↩️' : '⚠️'
      const m = new google.maps.Marker({
        position: { lat: r.lat, lng: r.lng }, map: mapRef.current!, title: r.description,
        label: { text: emoji, fontSize: isDanger ? '20px' : '16px' },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0, fillOpacity: 0, strokeOpacity: 0 }, zIndex: isDanger ? 100 : 30,
      })
      m.addListener('click', () => {
        if (!infoWindowRef.current || !mapRef.current) return
        let detail = ''
        if (r.clearance_ft) {
          const cf = Math.floor(r.clearance_ft); const ci = Math.round((r.clearance_ft - cf) * 12)
          const tf = Math.floor(truckProfile.height_ft); const ti = Math.round((truckProfile.height_ft % 1) * 12)
          detail += `<p style="font-size:11px;margin:4px 0 0;"><b>Clearance:</b> ${cf}'${ci}" — <b>Your height:</b> ${tf}'${ti}"</p>`
          if (isDanger) detail += `<p style="font-size:11px;color:#DC2626;font-weight:600;margin:2px 0 0;">⛔ VEHICLE WILL NOT FIT</p>`
        }
        if (r.weight_tons) {
          detail += `<p style="font-size:11px;margin:4px 0 0;"><b>Limit:</b> ${r.weight_tons}T — <b>Your weight:</b> ${truckProfile.weight_tons}T</p>`
          if (isDanger) detail += `<p style="font-size:11px;color:#DC2626;font-weight:600;margin:2px 0 0;">⛔ EXCEEDS WEIGHT LIMIT</p>`
        }
        infoWindowRef.current.setContent(`
          <div style="font-family:system-ui;max-width:300px;">
            <span style="background:${isDanger ? '#DC2626' : '#D97706'};color:white;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;">${isDanger ? '⛔ DANGER' : r.type.replace(/_/g, ' ').toUpperCase()}</span>
            <p style="font-weight:600;font-size:13px;margin:6px 0 4px;">${r.description}</p>
            <p style="font-size:12px;color:#666;margin:0;">${r.location}</p>
            ${detail}
          </div>
        `)
        infoWindowRef.current.open(mapRef.current, m)
      })
      restrictionMarkersRef.current.push(m)
    })
  }, [mapReady, showRestrictions, truckProfile, truckSafeMode])

  // ── Weigh Station Markers ─────────────────────────────────────────
  useEffect(() => {
    weighStationMarkersRef.current.forEach(m => m.setMap(null)); weighStationMarkersRef.current = []
    if (!mapReady || !mapRef.current || !showWeighStations) return
    WEIGH_STATIONS.forEach(ws => {
      const m = new google.maps.Marker({
        position: { lat: ws.lat, lng: ws.lng }, map: mapRef.current!, title: ws.name,
        label: { text: '⚖️', fontSize: '18px' },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0, fillOpacity: 0, strokeOpacity: 0 }, zIndex: 25,
      })
      m.addListener('click', () => {
        if (!infoWindowRef.current || !mapRef.current) return
        infoWindowRef.current.setContent(`<div style="font-family:system-ui;"><p style="font-weight:600;font-size:13px;margin:0 0 4px;">⚖️ ${ws.name}</p><p style="font-size:12px;color:#666;">${ws.highway} · ${ws.state}</p></div>`)
        infoWindowRef.current.open(mapRef.current, m)
      })
      weighStationMarkersRef.current.push(m)
    })
  }, [mapReady, showWeighStations])

  // ── GPS ───────────────────────────────────────────────────────────
  const updateDriverMarker = useCallback((pos: { lat: number; lng: number }, heading: number | null) => {
    if (!mapRef.current) return
    if (driverMarkerRef.current) { driverMarkerRef.current.setPosition(pos); if (heading != null) { const ic = driverMarkerRef.current.getIcon() as google.maps.Symbol; if (ic) { ic.rotation = heading; driverMarkerRef.current.setIcon(ic) } } }
    else { driverMarkerRef.current = new google.maps.Marker({ position: pos, map: mapRef.current, title: 'You', icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 7, fillColor: '#F59E0B', fillOpacity: 1, strokeWeight: 2, strokeColor: '#FFF', rotation: heading || 0 }, zIndex: 200 }) }
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(p => { const l = { lat: p.coords.latitude, lng: p.coords.longitude }; setDriverPos(l); updateDriverMarker(l, p.coords.heading) }, () => {}, { enableHighAccuracy: true })
    watchIdRef.current = navigator.geolocation.watchPosition(p => { const l = { lat: p.coords.latitude, lng: p.coords.longitude }; setDriverPos(l); updateDriverMarker(l, p.coords.heading) }, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 })
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current) }
  }, [updateDriverMarker])

  useEffect(() => { if (trafficLayerRef.current && mapRef.current) trafficLayerRef.current.setMap(showTraffic ? mapRef.current : null) }, [showTraffic])
  useEffect(() => { if (mapRef.current) mapRef.current.setMapTypeId(mapType) }, [mapType])

  // ── Check Route Restrictions ──────────────────────────────────────
  const checkRouteRestrictions = (route: google.maps.DirectionsRoute): string[] => {
    const warnings: string[] = []
    const path = route.overview_path
    if (!path) return warnings
    TRUCK_RESTRICTIONS.forEach(r => {
      for (let i = 0; i < path.length - 1; i++) {
        const p1 = { lat: path[i].lat(), lng: path[i].lng() }; const p2 = { lat: path[i + 1].lat(), lng: path[i + 1].lng() }
        if (r.lat >= Math.min(p1.lat, p2.lat) - 0.008 && r.lat <= Math.max(p1.lat, p2.lat) + 0.008 && r.lng >= Math.min(p1.lng, p2.lng) - 0.008 && r.lng <= Math.max(p1.lng, p2.lng) + 0.008) {
          if (r.type === 'low_clearance' && r.clearance_ft && truckProfile.height_ft >= r.clearance_ft) warnings.push(`⛔ LOW CLEARANCE: ${r.description} at ${r.location}`)
          else if (r.type === 'weight_limit' && r.weight_tons && truckProfile.weight_tons >= r.weight_tons) warnings.push(`⛔ WEIGHT: ${r.description} at ${r.location}`)
          else if (r.type === 'no_trucks') warnings.push(`🚫 NO TRUCKS: ${r.description} at ${r.location}`)
          else if (r.type === 'steep_grade') warnings.push(`⛰️ STEEP: ${r.description}`)
          else if (r.type === 'sharp_curve') warnings.push(`↩️ CURVE: ${r.description}`)
          break
        }
      }
    })
    return warnings
  }

  // ── Navigate to Shipment ──────────────────────────────────────────
  const navigateToShipment = async (shipment: Shipment) => {
    if (!mapRef.current || !window.google) return
    clearAllRoutes()
    const needsPickup = ['accepted', 'assigned', 'driver_en_route', 'driver_arrived'].includes(shipment.status)
    if (!driverPos) { toast('Waiting for GPS...', 'warning'); return }
    const origin = new google.maps.LatLng(driverPos.lat, driverPos.lng)
    const coords = shipmentCoords[shipment.id]; const waypoints: google.maps.DirectionsWaypoint[] = []
    let destination: google.maps.LatLng | string
    if (needsPickup) {
      waypoints.push({ location: coords?.pickup ? new google.maps.LatLng(coords.pickup.lat, coords.pickup.lng) : shipment.pickup_address, stopover: true })
      destination = coords?.delivery ? new google.maps.LatLng(coords.delivery.lat, coords.delivery.lng) : shipment.delivery_address
    } else {
      destination = coords?.delivery ? new google.maps.LatLng(coords.delivery.lat, coords.delivery.lng) : shipment.delivery_address
    }
    try {
      const req: google.maps.DirectionsRequest = { origin, destination, waypoints, optimizeWaypoints: false, travelMode: google.maps.TravelMode.DRIVING, drivingOptions: { departureTime: new Date(), trafficModel: google.maps.TrafficModel.BEST_GUESS } }
      if (truckSafeMode) req.provideRouteAlternatives = true
      const result = await new google.maps.DirectionsService().route(req)
      let bestIdx = 0; let fewest = Infinity
      if (result.routes.length > 1 && truckSafeMode) {
        result.routes.forEach((rt, idx) => { const w = checkRouteRestrictions(rt).filter(x => x.startsWith('⛔')).length; if (w < fewest) { fewest = w; bestIdx = idx } })
      }
      if (directionsRendererRef.current) { directionsRendererRef.current.setDirections(result); directionsRendererRef.current.setRouteIndex(bestIdx) }
      const route = result.routes[bestIdx]; const warns = checkRouteRestrictions(route); setRouteWarnings(warns)
      const legs = route?.legs || []; let dist = 0, dur = 0
      legs.forEach(l => { dist += l.distance?.value || 0; dur += l.duration_in_traffic?.value || l.duration?.value || 0 })
      setNavDistance(`${(dist / 1609.34).toFixed(1)} mi`); setNavDuration(fmtDur(dur))
      setNavETA(new Date(Date.now() + dur * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
      const step = legs[0]?.steps?.[0]; if (step) setNavInstruction(stripHtml(step.instructions))
      setNavigatingTo(shipment); setIsNavigating(true); setActivePanel(null)
      if (voiceEnabled) speak(`Navigating to ${needsPickup ? 'pickup' : 'delivery'} for ${shipment.title}.${warns.length > 0 ? ` Warning: ${warns.length} restriction${warns.length > 1 ? 's' : ''} on route.` : ''}`)
      toast(`Navigation started for ${shipment.title}`, warns.length > 0 ? 'warning' : 'success')
    } catch { toast('Could not calculate route', 'error') }
  }

  const stopNavigation = () => {
    setIsNavigating(false); setNavigatingTo(null); setNavInstruction(''); setNavDistance(''); setNavDuration(''); setNavETA(''); setRouteWarnings([])
    if (directionsRendererRef.current) directionsRendererRef.current.setDirections({ routes: [] } as any)
    toast('Navigation stopped', 'info')
  }

  // ── View All Routes ───────────────────────────────────────────────
  const clearAllRoutes = () => {
    multiRouteRenderersRef.current.forEach(r => r.setMap(null)); multiRouteRenderersRef.current = []; setAllRouteInfos([]); setShowAllRoutes(false)
  }

  const viewAllRoutes = async () => {
    if (!mapRef.current || !window.google || !driverPos) { toast('Need GPS', 'warning'); return }
    if (shipments.length === 0) { toast('No shipments', 'info'); return }
    stopNavigation(); setLoadingAllRoutes(true); setShowAllRoutes(true); setActivePanel(null)
    const origin = new google.maps.LatLng(driverPos.lat, driverPos.lng)
    const infos: RouteInfo[] = []; const bounds = new google.maps.LatLngBounds(); bounds.extend(origin)

    for (let i = 0; i < shipments.length; i++) {
      const s = shipments[i]; const co = shipmentCoords[s.id]
      const needsPickup = ['accepted', 'assigned', 'driver_en_route', 'driver_arrived'].includes(s.status)
      const wps: google.maps.DirectionsWaypoint[] = []; let dest: google.maps.LatLng | string
      if (needsPickup) { wps.push({ location: co?.pickup ? new google.maps.LatLng(co.pickup.lat, co.pickup.lng) : s.pickup_address, stopover: true }); dest = co?.delivery ? new google.maps.LatLng(co.delivery.lat, co.delivery.lng) : s.delivery_address }
      else { dest = co?.delivery ? new google.maps.LatLng(co.delivery.lat, co.delivery.lng) : s.delivery_address }
      try {
        const res = await new google.maps.DirectionsService().route({ origin, destination: dest, waypoints: wps, travelMode: google.maps.TravelMode.DRIVING, drivingOptions: { departureTime: new Date(), trafficModel: google.maps.TrafficModel.BEST_GUESS } })
        const color = ROUTE_COLORS[i % ROUTE_COLORS.length]
        const renderer = new google.maps.DirectionsRenderer({ map: mapRef.current, directions: res, suppressMarkers: true, polylineOptions: { strokeColor: color, strokeWeight: 4, strokeOpacity: 0.7 } })
        multiRouteRenderersRef.current.push(renderer)
        const rt = res.routes[0]; const warns = truckSafeMode ? checkRouteRestrictions(rt) : []; let d = 0, t = 0
        rt.legs.forEach(l => { d += l.distance?.value || 0; t += l.duration_in_traffic?.value || l.duration?.value || 0 })
        if (co?.pickup) bounds.extend(co.pickup); if (co?.delivery) bounds.extend(co.delivery)
        infos.push({ shipmentId: s.id, distance: `${(d / 1609.34).toFixed(1)} mi`, duration: fmtDur(t), distanceMeters: d, durationSeconds: t, eta: new Date(Date.now() + t * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), warnings: warns })
      } catch { infos.push({ shipmentId: s.id, distance: 'Error', duration: 'Error', distanceMeters: 0, durationSeconds: 0, eta: '—', warnings: ['Route error'] }) }
    }
    mapRef.current.fitBounds(bounds, 60); setAllRouteInfos(infos); setLoadingAllRoutes(false)
    if (voiceEnabled) speak(`Showing ${infos.length} routes.`)
  }

  // ── Nearby ────────────────────────────────────────────────────────
  const findNearby = (type: string) => {
    if (!mapRef.current || !driverPos) { toast('Need GPS', 'warning'); return }
    setSearchingNearby(true); setActivePanel('nearby')
    const svc = new google.maps.places.PlacesService(mapRef.current)
    const cfgs: Record<string, { keyword: string; type: string }> = { truck_stop: { keyword: 'truck stop', type: 'gas_station' }, fuel: { keyword: 'gas station diesel', type: 'gas_station' }, food: { keyword: 'restaurant food', type: 'restaurant' }, repair: { keyword: 'truck repair', type: 'car_repair' }, rest_area: { keyword: 'rest area', type: 'park' } }
    const cfg = cfgs[type] || cfgs.truck_stop!
    svc.nearbySearch({ location: driverPos, radius: 40000, keyword: cfg.keyword, type: cfg.type as any }, (results, status) => {
      setSearchingNearby(false); nearbyMarkersRef.current.forEach(m => m.setMap(null)); nearbyMarkersRef.current = []
      if (status !== google.maps.places.PlacesServiceStatus.OK || !results) { setNearbyPlaces([]); return }
      const places: NearbyPlace[] = results.slice(0, 15).map(p => {
        const lat = p.geometry?.location?.lat() || 0; const lng = p.geometry?.location?.lng() || 0
        if (mapRef.current && lat && lng) {
          const emoji = type === 'fuel' ? '⛽' : type === 'food' ? '🍔' : type === 'repair' ? '🔧' : type === 'rest_area' ? '🅿️' : '🚛'
          const mk = new google.maps.Marker({ position: { lat, lng }, map: mapRef.current, title: p.name || '', label: { text: emoji, fontSize: '16px' }, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0, fillOpacity: 0, strokeOpacity: 0 }, zIndex: 20 })
          mk.addListener('click', () => { if (infoWindowRef.current && mapRef.current) { infoWindowRef.current.setContent(`<div style="font-family:system-ui;"><p style="font-weight:600;">${p.name}</p><p style="font-size:12px;color:#666;">${p.vicinity}</p></div>`); infoWindowRef.current.open(mapRef.current, mk) } })
          nearbyMarkersRef.current.push(mk)
        }
        let dist = ''; if (driverPos && lat && lng) { const R = 3958.8; const dL = (lat - driverPos.lat) * Math.PI / 180; const dN = (lng - driverPos.lng) * Math.PI / 180; const a = Math.sin(dL/2)**2 + Math.cos(driverPos.lat*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dN/2)**2; dist = `${(R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1)} mi` }
        return { name: p.name || 'Unknown', address: p.vicinity || '', lat, lng, type, rating: p.rating, isOpen: p.opening_hours?.isOpen?.(), distance: dist }
      })
      places.sort((a, b) => parseFloat(a.distance || '999') - parseFloat(b.distance || '999')); setNearbyPlaces(places); setNearbyFilter(type)
    })
  }

  // ── Helpers ───────────────────────────────────────────────────────
  const recenter = () => { if (mapRef.current && driverPos) { mapRef.current.panTo(driverPos); mapRef.current.setZoom(14) } else toast('No GPS', 'warning') }
  const fitAll = () => { if (!mapRef.current || !shipments.length) return; const b = new google.maps.LatLngBounds(); let h = false; shipments.forEach(s => { const c = shipmentCoords[s.id]; if (c?.pickup) { b.extend(c.pickup); h = true } if (c?.delivery) { b.extend(c.delivery); h = true } }); if (driverPos) { b.extend(driverPos); h = true }; if (h) mapRef.current.fitBounds(b, 60) }
  const speak = (t: string) => { if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return; window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.rate = 0.95; u.volume = 0.9; window.speechSynthesis.speak(u) }
  const stripHtml = (h: string) => new DOMParser().parseFromString(h, 'text/html').body.textContent || ''
  const fmtDur = (s: number) => { const h = Math.floor(s / 3600); const m = Math.round((s % 3600) / 60); return h === 0 ? `${m} min` : `${h}h ${m}m` }
  const badge = (st: string) => {
    const m: Record<string, { l: string; c: string }> = { accepted: { l: 'Accepted', c: 'bg-blue-50 text-blue-700 border-blue-200' }, assigned: { l: 'Assigned', c: 'bg-indigo-50 text-indigo-700 border-indigo-200' }, driver_en_route: { l: 'En Route', c: 'bg-purple-50 text-purple-700 border-purple-200' }, driver_arrived: { l: 'At Pickup', c: 'bg-pink-50 text-pink-700 border-pink-200' }, picked_up: { l: 'Picked Up', c: 'bg-orange-50 text-orange-700 border-orange-200' }, in_transit: { l: 'In Transit', c: 'bg-amber-50 text-amber-700 border-amber-200' } }
    const i = m[st] || { l: st, c: 'bg-gray-50 text-gray-700 border-gray-200' }
    return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${i.c}`}>{i.l}</span>
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Render
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white' : 'space-y-4'}`}>
      {!isFullscreen && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Navigation className="h-6 w-6 text-amber-500" />
              Driver Map
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Truck-safe routing &middot; height/weight restrictions &middot; traffic &middot; nearby services
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setTruckSafeMode(!truckSafeMode)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${truckSafeMode ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
              <Shield className="h-3.5 w-3.5" /> Truck Safe {truckSafeMode ? 'ON' : 'OFF'}
            </button>
            <Button onClick={showAllRoutes ? clearAllRoutes : viewAllRoutes} variant="outline" size="sm" disabled={loadingAllRoutes || shipments.length === 0} className={showAllRoutes ? 'bg-amber-50 border-amber-300 text-amber-700' : ''}>
              {loadingAllRoutes ? <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-amber-500 mr-1.5" /> : <Route className="h-3.5 w-3.5 mr-1.5" />}
              {showAllRoutes ? 'Clear Routes' : 'View All Routes'}
            </Button>
            <span className="text-xs font-medium text-gray-500">{shipments.length} shipment{shipments.length !== 1 ? 's' : ''}</span>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" title="GPS" />
          </div>
        </div>
      )}

      <div className={`relative ${isFullscreen ? 'h-full' : ''}`}>
        <div ref={mapContainerRef} className={`w-full ${isFullscreen ? 'h-full' : 'h-[calc(100vh-220px)] min-h-[500px]'} rounded-lg overflow-hidden border border-gray-200`} />

        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
            <div className="text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mx-auto mb-3" /><p className="text-sm text-gray-500">Loading map...</p></div>
          </div>
        )}

        {mapReady && (<>
          {/* Navigation overlay */}
          {isNavigating && navigatingTo && (
            <div className="absolute top-3 left-3 right-3 z-10">
              {navInstruction && (
                <div className="bg-gray-900 text-white rounded-lg px-4 py-3 mb-2 shadow-lg">
                  <div className="flex items-start gap-3">
                    <CornerUpRight className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{navInstruction}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-300">
                        <span>{navDistance}</span><span>·</span><span>{navDuration}</span><span>·</span><span>ETA {navETA}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {routeWarnings.length > 0 && (
                <div className="bg-red-900/95 text-white rounded-lg px-4 py-2.5 mb-2 shadow-lg">
                  <div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-red-400" /><span className="text-xs font-semibold text-red-300 uppercase">{routeWarnings.length} Truck Restriction{routeWarnings.length > 1 ? 's' : ''}</span></div>
                  <div className="space-y-1 max-h-20 overflow-y-auto">{routeWarnings.map((w, i) => <p key={i} className="text-xs text-red-200">{w}</p>)}</div>
                </div>
              )}
              <div className="bg-white/95 backdrop-blur rounded-lg px-4 py-2.5 shadow-md flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-sm"><Truck className="h-4 w-4 text-amber-500" /><span className="font-semibold text-gray-900 truncate max-w-[200px]">{navigatingTo.title}</span></div>
                  <div className="flex items-center gap-1.5 text-sm"><Route className="h-4 w-4 text-blue-500" /><span className="font-medium text-gray-700">{navDistance}</span></div>
                  <div className="flex items-center gap-1.5 text-sm"><Clock className="h-4 w-4 text-green-500" /><span className="font-medium text-gray-700">{navDuration}</span></div>
                  {routeWarnings.length > 0 && <div className="flex items-center gap-1 text-sm"><AlertTriangle className="h-4 w-4 text-red-500" /><span className="font-medium text-red-600">{routeWarnings.length}</span></div>}
                </div>
                <Button onClick={stopNavigation} variant="outline" className="text-xs border-red-300 text-red-600 hover:bg-red-50 h-8">Stop</Button>
              </div>
            </div>
          )}

          {/* All Routes panel */}
          {showAllRoutes && !isNavigating && (() => {
            // Compute route totals
            const totalDistMi = allRouteInfos.reduce((sum, r) => sum + (r.distanceMeters / 1609.34), 0)
            const totalDurSec = allRouteInfos.reduce((sum, r) => sum + r.durationSeconds, 0)
            const totalEarnings = allRouteInfos.reduce((sum, r) => {
              const s = shipments.find(x => x.id === r.shipmentId)
              return sum + (s?.estimated_price || 0)
            }, 0)
            const AVG_MPG = 6.5 // avg truck mpg
            const DIESEL_PER_GAL = 3.85 // avg diesel $/gal
            const estFuelCost = (totalDistMi / AVG_MPG) * DIESEL_PER_GAL
            const netProfit = totalEarnings - estFuelCost
            const bridgeWarnings = allRouteInfos.flatMap(r => r.warnings).filter(w => w.includes('LOW CLEARANCE'))
            const totalHrs = Math.floor(totalDurSec / 3600)
            const totalMin = Math.round((totalDurSec % 3600) / 60)

            return (
            <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur rounded-lg shadow-lg border border-gray-200 w-96 max-h-[calc(100vh-280px)] overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2"><Route className="h-3.5 w-3.5 text-amber-500" />All Routes</h3>
                <button onClick={clearAllRoutes} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
              </div>

              {/* ── Route Totals Summary ── */}
              {!loadingAllRoutes && allRouteInfos.length > 0 && (
                <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-amber-50/50 to-green-50/50">
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500 uppercase">Total Earnings</p>
                      <p className="text-lg font-bold text-green-600">${totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500 uppercase">Est. Fuel Cost</p>
                      <p className="text-lg font-bold text-red-500">-${estFuelCost.toFixed(0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500 uppercase">Net Profit</p>
                      <p className={`text-lg font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>${netProfit >= 0 ? '' : '-'}${Math.abs(netProfit).toFixed(0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span className="flex items-center gap-1"><Route className="h-3 w-3" />{totalDistMi.toFixed(0)} mi total</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{totalHrs > 0 ? `${totalHrs}h ${totalMin}m` : `${totalMin} min`}</span>
                    <span className="flex items-center gap-1"><Fuel className="h-3 w-3" />{(totalDistMi / AVG_MPG).toFixed(0)} gal</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[10px]">
                    <span className="text-gray-400">@ ${DIESEL_PER_GAL}/gal · {AVG_MPG} mpg avg</span>
                    <span className="font-medium text-emerald-600">${totalDistMi > 0 ? (netProfit / totalDistMi).toFixed(2) : '0.00'}/mi profit</span>
                  </div>
                  {bridgeWarnings.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
                      <BrickWall className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      <span className="text-[10px] font-semibold text-red-700">⛔ {bridgeWarnings.length} bridge clearance issue{bridgeWarnings.length > 1 ? 's' : ''} on routes</span>
                    </div>
                  )}
                </div>
              )}

              {loadingAllRoutes ? (
                <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500" /><span className="ml-2 text-sm text-gray-500">Calculating...</span></div>
              ) : (
                <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
                  {allRouteInfos.map((info, idx) => {
                    const s = shipments.find(x => x.id === info.shipmentId); if (!s) return null
                    const color = ROUTE_COLORS[idx % ROUTE_COLORS.length]; const hasDanger = info.warnings.some(w => w.startsWith('⛔'))
                    const routeFuelCost = (info.distanceMeters / 1609.34 / 6.5) * 3.85
                    const routeEarnings = s.estimated_price || 0
                    const routeProfit = routeEarnings - routeFuelCost
                    const costPerMi = info.distanceMeters > 0 ? (routeProfit / (info.distanceMeters / 1609.34)) : 0
                    return (
                      <div key={info.shipmentId} className={`px-4 py-3 hover:bg-amber-50/30 ${hasDanger ? 'border-l-2 border-red-500' : ''}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          <p className="text-sm font-medium text-gray-900 truncate flex-1">{s.title}</p>{badge(s.status)}
                        </div>
                        <div className="flex items-center gap-4 ml-5 text-[11px] text-gray-500">
                          <span><Route className="h-3 w-3 inline" /> {info.distance}</span><span><Clock className="h-3 w-3 inline" /> {info.duration}</span><span>ETA {info.eta}</span>
                        </div>
                        {/* Per-route financial breakdown */}
                        <div className="flex items-center gap-3 ml-5 mt-1 text-[11px]">
                          {routeEarnings > 0 && <span className="text-green-600 font-medium"><DollarSign className="h-3 w-3 inline" />${routeEarnings.toFixed(0)}</span>}
                          <span className="text-red-400">-${routeFuelCost.toFixed(0)} fuel</span>
                          <span className={`font-semibold ${routeProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            = ${routeProfit >= 0 ? '+' : ''}${routeProfit.toFixed(0)} net
                          </span>
                          {costPerMi > 0 && <span className="text-gray-400">(${costPerMi.toFixed(2)}/mi)</span>}
                        </div>
                        {/* Bridge height warnings highlighted */}
                        {info.warnings.filter(w => w.includes('LOW CLEARANCE')).length > 0 && (
                          <div className="ml-5 mt-1 flex items-center gap-1 bg-red-50 rounded px-2 py-0.5">
                            <BrickWall className="h-3 w-3 text-red-500" />
                            <span className="text-[10px] text-red-700 font-semibold">Bridge clearance issue!</span>
                          </div>
                        )}
                        {info.warnings.length > 0 && <div className="ml-5 mt-1 space-y-0.5">{info.warnings.slice(0, 2).map((w, i) => <p key={i} className={`text-[10px] ${w.startsWith('⛔') ? 'text-red-600 font-medium' : 'text-yellow-600'}`}>{w}</p>)}{info.warnings.length > 2 && <p className="text-[10px] text-gray-400">+{info.warnings.length - 2} more</p>}</div>}
                        <div className="ml-5 mt-2">
                          <button onClick={() => navigateToShipment(s)} className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md"><Navigation className="h-3 w-3" />Navigate</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )})()}

          {/* Right controls */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2">
            <MapBtn icon={<Locate className="h-4 w-4" />} title="My Location" onClick={recenter} />
            <MapBtn icon={<Target className="h-4 w-4" />} title="Fit All" onClick={fitAll} />
            <div className="w-9 h-px bg-gray-200" />
            <MapBtn icon={<AlertTriangle className="h-4 w-4" />} title="Restrictions" onClick={() => setShowRestrictions(p => !p)} active={showRestrictions} activeColor="text-red-500" />
            <MapBtn icon={<Scale className="h-4 w-4" />} title="Weigh Stations" onClick={() => setShowWeighStations(p => !p)} active={showWeighStations} activeColor="text-purple-500" />
            <MapBtn icon={<AlertCircle className="h-4 w-4" />} title="Traffic" onClick={() => setShowTraffic(p => !p)} active={showTraffic} activeColor="text-amber-500" />
            <div className="w-9 h-px bg-gray-200" />
            <MapBtn icon={<Truck className="h-4 w-4" />} title="Vehicle Profile" onClick={() => setActivePanel(activePanel === 'vehicle' ? null : 'vehicle')} active={activePanel === 'vehicle'} activeColor="text-blue-500" />
            <MapBtn icon={<Layers className="h-4 w-4" />} title="Map Style" onClick={() => setMapType(p => p === 'roadmap' ? 'satellite' : p === 'satellite' ? 'hybrid' : 'roadmap')} />
            <MapBtn icon={voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} title="Voice" onClick={() => setVoiceEnabled(p => !p)} active={voiceEnabled} activeColor="text-amber-500" />
            <MapBtn icon={isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />} title="Fullscreen" onClick={() => setIsFullscreen(p => !p)} />
          </div>

          {/* Left side panels */}
          {!showAllRoutes && (
            <div className="absolute left-3 bottom-3 z-10" style={{ top: isNavigating ? (routeWarnings.length > 0 ? '220px' : '140px') : '12px' }}>
              <div className="flex gap-1 mb-2">
                <PanelTab active={activePanel === 'shipments'} onClick={() => setActivePanel(activePanel === 'shipments' ? null : 'shipments')} icon={<Package className="h-3.5 w-3.5" />} label={`Shipments (${shipments.length})`} />
                <PanelTab active={activePanel === 'nearby'} onClick={() => setActivePanel(activePanel === 'nearby' ? null : 'nearby')} icon={<Search className="h-3.5 w-3.5" />} label="Nearby" />
                <PanelTab active={activePanel === 'vehicle'} onClick={() => setActivePanel(activePanel === 'vehicle' ? null : 'vehicle')} icon={<Truck className="h-3.5 w-3.5" />} label="Vehicle" />
              </div>

              {/* Vehicle Profile Panel */}
              {activePanel === 'vehicle' && (
                <div className="bg-white/95 backdrop-blur rounded-lg shadow-lg border border-gray-200 w-80 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2"><Truck className="h-3.5 w-3.5 text-blue-500" />Vehicle Profile</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">Set dimensions to check route clearances & weight limits</p>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1"><Ruler className="h-3 w-3 inline mr-1" />Vehicle Height (ft)</label>
                      <input type="number" step="0.5" min="6" max="14" value={truckProfile.height_ft} onChange={e => setTruckProfile(p => ({ ...p, height_ft: parseFloat(e.target.value) || 13.5 }))} className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-amber-500" />
                      <p className="text-[10px] text-gray-400 mt-0.5">Car hauler: ~13.5&apos; | Enclosed: ~14&apos; | Flatbed: 11-14&apos;</p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1"><Scale className="h-3 w-3 inline mr-1" />Gross Weight (tons)</label>
                      <input type="number" step="1" min="1" max="80" value={truckProfile.weight_tons} onChange={e => setTruckProfile(p => ({ ...p, weight_tons: parseFloat(e.target.value) || 40 }))} className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-amber-500" />
                      <p className="text-[10px] text-gray-400 mt-0.5">US legal max: 80,000 lbs (40 tons) including cargo</p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1"><ArrowUpDown className="h-3 w-3 inline mr-1" />Total Length (ft)</label>
                      <input type="number" step="1" min="10" max="100" value={truckProfile.length_ft} onChange={e => setTruckProfile(p => ({ ...p, length_ft: parseFloat(e.target.value) || 75 }))} className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-amber-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">Trailer Type</label>
                      <select value={truckProfile.trailer_type} onChange={e => setTruckProfile(p => ({ ...p, trailer_type: e.target.value }))} className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-amber-500">
                        <option value="car_hauler">Car Hauler (Open)</option><option value="enclosed">Enclosed Transport</option><option value="flatbed">Flatbed</option><option value="dually">Dually + Trailer</option><option value="other">Other</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-medium text-gray-700">Hazmat</label>
                      <button onClick={() => setTruckProfile(p => ({ ...p, is_hazmat: !p.is_hazmat }))} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${truckProfile.is_hazmat ? 'bg-red-500' : 'bg-gray-300'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${truckProfile.is_hazmat ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    <div className="pt-2 border-t border-gray-100">
                      <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 text-[11px]">
                        <p className="font-medium text-amber-800 mb-1">Active Profile:</p>
                        <p className="text-amber-700">{Math.floor(truckProfile.height_ft)}&apos;{Math.round((truckProfile.height_ft % 1) * 12)}&quot; H &middot; {truckProfile.weight_tons}T &middot; {truckProfile.length_ft}&apos; L &middot; {truckProfile.trailer_type.replace(/_/g, ' ')}{truckProfile.is_hazmat ? ' · ☣️' : ''}</p>
                        <p className="text-amber-600 mt-1">{truckSafeMode ? '✅ Restrictions active' : '⚠️ Truck Safe OFF'}</p>
                      </div>
                      {/* Bridge Clearance Summary */}
                      {(() => {
                        const dangerBridges = TRUCK_RESTRICTIONS.filter(r => r.type === 'low_clearance' && r.clearance_ft && truckProfile.height_ft >= r.clearance_ft)
                        const tightBridges = TRUCK_RESTRICTIONS.filter(r => r.type === 'low_clearance' && r.clearance_ft && truckProfile.height_ft >= r.clearance_ft - 1 && truckProfile.height_ft < r.clearance_ft)
                        const overweightBridges = TRUCK_RESTRICTIONS.filter(r => r.type === 'weight_limit' && r.weight_tons && truckProfile.weight_tons >= r.weight_tons)
                        return (
                          <div className={`mt-2 rounded-md p-2.5 text-[11px] border ${dangerBridges.length > 0 ? 'bg-red-50 border-red-200' : tightBridges.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <BrickWall className={`h-3.5 w-3.5 ${dangerBridges.length > 0 ? 'text-red-500' : tightBridges.length > 0 ? 'text-yellow-500' : 'text-green-500'}`} />
                              <span className="font-semibold">Bridge & Weight Clearances</span>
                            </div>
                            {dangerBridges.length > 0 ? (
                              <div>
                                <p className="text-red-700 font-semibold">⛔ {dangerBridges.length} bridge{dangerBridges.length > 1 ? 's' : ''} your vehicle CANNOT fit under</p>
                                <div className={`mt-1 space-y-0.5 ${showAllBridges ? 'max-h-48' : 'max-h-16'} overflow-y-auto transition-all`}>
                                  {(showAllBridges ? dangerBridges : dangerBridges.slice(0, 3)).map((b, i) => (
                                    <p key={i} className="text-red-600 truncate">{b.location} ({b.clearance_ft}&apos;)</p>
                                  ))}
                                </div>
                                {dangerBridges.length > 3 && (
                                  <button onClick={() => setShowAllBridges(!showAllBridges)} className="text-red-500 hover:text-red-700 text-[10px] font-medium mt-1 underline">
                                    {showAllBridges ? 'Show less' : `View all ${dangerBridges.length} bridges`}
                                  </button>
                                )}
                              </div>
                            ) : tightBridges.length > 0 ? (
                              <p className="text-yellow-700">⚠️ {tightBridges.length} bridge{tightBridges.length > 1 ? 's' : ''} with tight clearance (&lt;1&apos; margin)</p>
                            ) : (
                              <p className="text-green-700">✅ All known bridges clear for your vehicle</p>
                            )}
                            {overweightBridges.length > 0 && (
                              <p className="text-red-700 font-semibold mt-1">⚖️ {overweightBridges.length} bridge{overweightBridges.length > 1 ? 's' : ''} with weight limit exceeded</p>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Shipment Panel */}
              {activePanel === 'shipments' && (
                <div className="bg-white/95 backdrop-blur rounded-lg shadow-lg border border-gray-200 w-80 max-h-[calc(100vh-340px)] overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2"><Truck className="h-3.5 w-3.5 text-amber-500" />Active Shipments</h3>
                    {shipments.length > 0 && <button onClick={viewAllRoutes} className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded"><Eye className="h-3 w-3" />All Routes</button>}
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
                    {loadingShipments ? <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500" /></div> :
                    shipments.length === 0 ? <div className="p-6 text-center"><Package className="h-8 w-8 text-gray-300 mx-auto mb-2" /><p className="text-xs text-gray-500">No active shipments</p></div> :
                    shipments.map(s => (
                      <div key={s.id} className={`px-4 py-3 cursor-pointer hover:bg-amber-50/50 transition-colors ${selectedShipment?.id === s.id ? 'bg-amber-50 border-l-2 border-amber-500' : ''}`}
                        onClick={() => { setSelectedShipment(s); if (mapRef.current) { const b = new google.maps.LatLngBounds(); const c = shipmentCoords[s.id]; if (c?.pickup) b.extend(c.pickup); if (c?.delivery) b.extend(c.delivery); if (driverPos) b.extend(driverPos); mapRef.current.fitBounds(b, 80) } }}>
                        <div className="flex items-center gap-2 mb-1"><p className="text-sm font-medium text-gray-900 truncate flex-1">{s.title}</p>{badge(s.status)}</div>
                        <div className="space-y-1 mb-2">
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-500"><MapPin className="h-3 w-3 text-blue-400 shrink-0" /><span className="truncate">{s.pickup_address}</span></div>
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-500"><MapPin className="h-3 w-3 text-green-400 shrink-0" /><span className="truncate">{s.delivery_address}</span></div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-[11px] text-gray-400">{s.distance && <span>{s.distance} mi</span>}{s.estimated_price && <span className="text-green-600 font-medium">${s.estimated_price.toFixed(0)}</span>}</div>
                          <button onClick={e => { e.stopPropagation(); navigateToShipment(s) }} className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md"><Navigation className="h-3 w-3" />Navigate</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nearby Panel */}
              {activePanel === 'nearby' && (
                <div className="bg-white/95 backdrop-blur rounded-lg shadow-lg border border-gray-200 w-80 max-h-[calc(100vh-340px)] overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-3">Nearby Services</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {[{ k: 'truck_stop', l: '🚛 Truck Stops' }, { k: 'fuel', l: '⛽ Fuel' }, { k: 'food', l: '🍔 Food' }, { k: 'repair', l: '🔧 Repair' }, { k: 'rest_area', l: '🅿️ Rest' }].map(s => (
                        <button key={s.k} onClick={() => findNearby(s.k)} disabled={searchingNearby} className={`text-[11px] font-medium px-2.5 py-1.5 rounded-md border ${nearbyFilter === s.k ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-amber-50'}`}>{s.l}</button>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {searchingNearby ? <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500" /></div> :
                    nearbyPlaces.length === 0 ? <div className="p-6 text-center"><Search className="h-8 w-8 text-gray-300 mx-auto mb-2" /><p className="text-xs text-gray-500">Select a category</p></div> :
                    <div className="divide-y divide-gray-50">
                      {nearbyPlaces.map((p, i) => (
                        <div key={i} className="px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => { if (mapRef.current) { mapRef.current.panTo({ lat: p.lat, lng: p.lng }); mapRef.current.setZoom(15) } }}>
                          <div className="flex items-start justify-between gap-2 mb-1"><p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>{p.distance && <span className="text-[11px] text-gray-400 shrink-0">{p.distance}</span>}</div>
                          <p className="text-[11px] text-gray-500 truncate">{p.address}</p>
                          <div className="flex items-center gap-3 mt-1">{p.rating && <span className="text-[11px] text-amber-500"><Star className="h-3 w-3 inline" /> {p.rating}</span>}{p.isOpen !== undefined && <span className={`text-[11px] ${p.isOpen ? 'text-green-600' : 'text-red-500'}`}>{p.isOpen ? 'Open' : 'Closed'}</span>}</div>
                        </div>
                      ))}
                    </div>
                    }
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom legend */}
          {!isNavigating && !showAllRoutes && (
            <div className="absolute bottom-3 left-[340px] right-14 z-10">
              <div className="bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500" /> Pickup</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500" /> Delivery</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500" /> You</span>
                  {showRestrictions && <span>⚠️ Restriction</span>}
                  {showRestrictions && <span className="flex items-center gap-1"><BrickWall className="h-3 w-3 text-red-500" /><span className="text-red-600 font-medium">{TRUCK_RESTRICTIONS.filter(r => r.type === 'low_clearance').length} bridges</span></span>}
                  {showWeighStations && <span>⚖️ Weigh Stn</span>}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-gray-400">
                  {shipments.length > 0 && (
                    <span className="text-green-600 font-medium">
                      ${shipments.reduce((sum, s) => sum + (s.estimated_price || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 0 })} total
                    </span>
                  )}
                  {truckSafeMode && <span className="flex items-center gap-1 text-amber-600 font-medium"><Shield className="h-3 w-3" />Safe</span>}
                  <span>{Math.floor(truckProfile.height_ft)}&apos;{Math.round((truckProfile.height_ft % 1) * 12)}&quot; · {truckProfile.weight_tons}T</span>
                </div>
              </div>
            </div>
          )}
        </>)}
      </div>
    </div>
  )
}

// Sub-components
function MapBtn({ icon, title, onClick, active, activeColor }: { icon: React.ReactNode; title: string; onClick: () => void; active?: boolean; activeColor?: string }) {
  return <button onClick={onClick} title={title} className={`w-9 h-9 rounded-lg shadow-md flex items-center justify-center transition-colors ${active ? `bg-amber-50 border border-amber-300 ${activeColor || ''}` : 'bg-white border border-gray-200 hover:bg-gray-50'}`}>{icon}</button>
}
function PanelTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium shadow-md transition-colors ${active ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{icon}{label}</button>
}
