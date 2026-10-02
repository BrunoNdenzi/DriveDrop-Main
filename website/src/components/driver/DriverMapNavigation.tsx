'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { assignStopTags } from '@/lib/stop-tags'
import { buildSimPath, positionAt, type SimPath } from '@/lib/route-sim'
import { googleMapsDirectionsUrl } from '@/lib/external-nav'
import { toast } from '@/components/ui/toast'
import {
  Navigation,
  MapPin,
  Package,
  Fuel,
  Coffee,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Locate,
  CornerUpRight,
  ArrowUp,
  Clock,
  Route,
  AlertTriangle,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Layers,
  Zap,
  Target,
  X,
} from '@/components/icons/streamline-lucide'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface NavStop {
  id: string
  address: string
  lat?: number
  lng?: number
  type: 'pickup' | 'delivery' | 'fuel' | 'rest' | 'current_location' | 'stop'
  label?: string
  shipmentId?: string
  vehicleInfo?: string
  order?: number
  estimatedArrival?: string
}

export interface NavigationState {
  isNavigating: boolean
  currentStopIndex: number
  currentLeg: number
  distanceRemaining: string
  durationRemaining: string
  nextInstruction: string
  nextManeuver: string
  totalDistanceRemaining: string
  totalDurationRemaining: string
  eta: string
  completedStops: number[]
}

interface RouteSegment {
  distance: string
  duration: string
  steps: google.maps.DirectionsStep[]
}

export interface DriverFix {
  lat: number
  lng: number
  heading: number | null
  speedMps: number | null
  accuracyMeters: number | null
  at: number
  simulated: boolean
}

interface DriverMapNavigationProps {
  stops: NavStop[]
  plannedDistance?: number
  plannedDurationMinutes?: number
  plannedEndTime?: string
  departureTime?: string
  driverLocation?: { lat: number; lng: number }
  onStopReached?: (stopIndex: number) => void
  onNavigationComplete?: () => void
  onPosition?: (fix: DriverFix) => void
  onNavigationStart?: () => void | Promise<void>
  onSimulationStart?: () => void | Promise<void>
  onReoptimize?: () => Promise<void>
  trackingStatus?: { state: 'off' | 'pending' | 'on' | 'error'; label: string }
  onClose?: () => void
  height?: string
  showOverlay?: boolean
  carolinaInsights?: Array<{
    type: string
    title: string
    description: string
    severity: string
  }>
  benjiTips?: string[]
  fuelStops?: Array<{
    name: string
    address: string
    estimatedPrice: number
    afterStopIndex: number
  }>
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Constants
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MARKER_COLORS: Record<string, string> = {
  pickup: '#3B82F6',
  delivery: '#10B981',
  fuel: '#EAB308',
  rest: '#8B5CF6',
  current_location: '#F59E0B',
}

const MARKER_LABELS: Record<string, string> = {
  pickup: 'P',
  delivery: 'D',
  fuel: 'F',
  rest: 'R',
  current_location: '●',
}

type Point = { lat: number; lng: number }

const MARKER_GLIDE_MS = 900
const STEP_REACHED_METERS = 30
const SIM_TICK_MS = 1000
const SIM_BASE_METERS_PER_SECOND = 17.9 // 40 mph
const SIM_STOP_PAUSE_MS = 2000
const SIM_SPEEDS = [1, 10, 30] as const

function metersBetween(a: Point, b: Point | google.maps.LatLng): number {
  const to = b instanceof google.maps.LatLng ? { lat: b.lat(), lng: b.lng() } : b
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(to.lat - a.lat)
  const dLng = toRad(to.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)))
}

function htmlToText(html: string): string {
  return new DOMParser().parseFromString(html, 'text/html').body.textContent || ''
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function DriverMapNavigation({
  stops,
  plannedDistance,
  plannedDurationMinutes,
  plannedEndTime,
  departureTime,
  driverLocation,
  onStopReached,
  onNavigationComplete,
  onPosition,
  onNavigationStart,
  onSimulationStart,
  onReoptimize,
  trackingStatus,
  onClose,
  height = 'h-[600px]',
  showOverlay = true,
  carolinaInsights = [],
  benjiTips = [],
  fuelStops = [],
}: DriverMapNavigationProps) {
  // ── Refs ──────────────────────────────────────────────────────────
  const mapRef = useRef<google.maps.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const driverMarkerRef = useRef<google.maps.Marker | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null)

  // ── State ─────────────────────────────────────────────────────────
  const [mapReady, setMapReady] = useState(false)
  const [routeLoaded, setRouteLoaded] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showTraffic, setShowTraffic] = useState(true)
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap')
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [showStopsList, setShowStopsList] = useState(false)
  const [showBenjiPanel, setShowBenjiPanel] = useState(false)
  const [currentDriverPos, setCurrentDriverPos] = useState(driverLocation || null)
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([])
  const [totalDistance, setTotalDistance] = useState('')
  const [totalDuration, setTotalDuration] = useState('')
  const [legSummaries, setLegSummaries] = useState<Array<{ distance: string; duration: string; from: string; to: string }>>([])

  const [navState, setNavState] = useState<NavigationState>({
    isNavigating: false,
    currentStopIndex: 0,
    currentLeg: 0,
    distanceRemaining: '',
    durationRemaining: '',
    nextInstruction: '',
    nextManeuver: '',
    totalDistanceRemaining: '',
    totalDurationRemaining: '',
    eta: '',
    completedStops: [],
  })
  const [following, setFollowing] = useState(true)

  const stopsKey = JSON.stringify(stops.map(s => [s.id, s.address, s.lat, s.lng, s.type, s.shipmentId, s.order]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stopTags = useMemo(() => assignStopTags(stops), [stopsKey])

  // Latest values for callbacks that must not change identity (map init, GPS watch).
  const stopsRef = useRef(stops)
  const latestRef = useRef({ currentDriverPos, showTraffic })
  const navStateRef = useRef(navState)
  const routeSegmentsRef = useRef(routeSegments)
  const stopTagsRef = useRef(stopTags)
  const resolvedStopsRef = useRef<NavStop[]>([])
  const followRef = useRef(true)
  const stepIndexRef = useRef(0)
  const driverAnimRef = useRef<number | null>(null)
  const speakRef = useRef<(text: string) => void>(() => {})
  const onPositionRef = useRef(onPosition)
  const [replanning, setReplanning] = useState(false)
  const simPathRef = useRef<SimPath | null>(null)
  const simRef = useRef<{ speed: number; meters: number; pausedUntil: number; pending: boolean } | null>(null)
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const markStopCompletedRef = useRef<(idx: number) => void>(() => {})
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const wakeLockWarnedRef = useRef(false)
  const [simulation, setSimulation] = useState<{ speed: number } | null>(null)
  const [simAvailable, setSimAvailable] = useState(false)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  stopsRef.current = stops
  latestRef.current = { currentDriverPos, showTraffic }
  navStateRef.current = navState
  routeSegmentsRef.current = routeSegments
  stopTagsRef.current = stopTags
  onPositionRef.current = onPosition

  const setFollow = useCallback((value: boolean) => {
    followRef.current = value
    setFollowing(value)
  }, [])

  const exitAction = onClose ?? (isFullscreen ? () => setIsFullscreen(false) : undefined)

  // ── Initialize Google Map ─────────────────────────────────────────
  const initMap = useCallback(() => {
    if (!mapContainerRef.current || !window.google || mapRef.current) return

    const { currentDriverPos: driverPos, showTraffic: trafficOn } = latestRef.current
    const firstStop = stopsRef.current[0]
    const center = driverPos
      ? { lat: driverPos.lat, lng: driverPos.lng }
      : firstStop?.lat && firstStop?.lng
        ? { lat: firstStop.lat, lng: firstStop.lng }
        : { lat: 35.2271, lng: -80.8431 } // Charlotte, NC default

    const map = new google.maps.Map(mapContainerRef.current, {
      center,
      zoom: 10,
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

    // Dragging the map hands control back to the driver until they tap recenter.
    map.addListener('dragstart', () => setFollow(false))

    // Traffic layer
    const traffic = new google.maps.TrafficLayer()
    if (trafficOn) traffic.setMap(map)
    trafficLayerRef.current = traffic

    // Directions renderer
    const renderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true, // We use custom markers
      polylineOptions: {
        strokeColor: '#F59E0B',
        strokeWeight: 5,
        strokeOpacity: 0.85,
      },
    })
    directionsRendererRef.current = renderer

    setMapReady(true)
  }, [setFollow])

  useEffect(() => {
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps) {
        initMap()
        return true
      }
      return false
    }

    if (!checkGoogleMaps()) {
      const interval = setInterval(() => {
        if (checkGoogleMaps()) clearInterval(interval)
      }, 200)
      return () => clearInterval(interval)
    }
  }, [initMap])

  // ── Build Route with Directions API ───────────────────────────────
  const buildRoute = useCallback(async () => {
    const stops = stopsRef.current
    if (!mapRef.current || !window.google || stops.length < 2) return

    const directionsService = new google.maps.DirectionsService()

    // Build origin, destination, waypoints
    const validStops = stops.filter(s => s.address && s.address.trim().length > 0)
    if (validStops.length < 2) return

    const origin = validStops[0]!.lat && validStops[0]!.lng
      ? { lat: validStops[0]!.lat, lng: validStops[0]!.lng }
      : validStops[0]!.address

    const lastStop = validStops[validStops.length - 1]!
    const destination = lastStop.lat && lastStop.lng
      ? { lat: lastStop.lat, lng: lastStop.lng }
      : lastStop.address

    const waypoints = validStops.slice(1, -1).map(stop => ({
      location: stop.lat && stop.lng
        ? new google.maps.LatLng(stop.lat, stop.lng)
        : stop.address,
      stopover: true,
    }))

    try {
      const result = await directionsService.route({
        origin: origin as string | google.maps.LatLng | google.maps.LatLngLiteral | google.maps.Place,
        destination: destination as string | google.maps.LatLng | google.maps.LatLngLiteral | google.maps.Place,
        waypoints: waypoints as google.maps.DirectionsWaypoint[],
        optimizeWaypoints: false, // Already optimized by our engine
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: departureTime && new Date(departureTime).getTime() > Date.now()
            ? new Date(departureTime)
            : new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
      })

      if (directionsRendererRef.current) {
        directionsRendererRef.current.setDirections(result)
      }

      // Parse legs
      const legs = result.routes[0]?.legs || []
      const segments: RouteSegment[] = legs.map(leg => ({
        distance: leg.distance?.text || '',
        duration: leg.duration_in_traffic?.text || leg.duration?.text || '',
        steps: leg.steps || [],
      }))

      setRouteSegments(segments)
      stepIndexRef.current = 0
      simPathRef.current = buildSimPath(
        legs.map(leg => (leg.steps || []).flatMap(step => (step.path || []).map(point => ({ lat: point.lat(), lng: point.lng() })))),
      )

      // Calculate totals
      let totalDist = 0
      let totalDur = 0
      const summaries = legs.map((leg, i) => {
        totalDist += leg.distance?.value || 0
        totalDur += (leg.duration_in_traffic?.value || leg.duration?.value || 0)
        return {
          distance: leg.distance?.text || '',
          duration: leg.duration_in_traffic?.text || leg.duration?.text || '',
          from: validStops[i]?.address || '',
          to: validStops[i + 1]?.address || '',
        }
      })

      setTotalDistance(plannedDistance !== undefined ? `${plannedDistance.toFixed(1)} mi` : `${(totalDist / 1609.34).toFixed(1)} mi`)
      setTotalDuration(plannedDurationMinutes !== undefined ? formatDuration(plannedDurationMinutes * 60) : formatDuration(totalDur))
      setLegSummaries(summaries)

      // Compute ETA
      const eta = plannedEndTime ? new Date(plannedEndTime) : new Date(Date.now() + totalDur * 1000)
      setNavState(prev => ({
        ...prev,
        totalDistanceRemaining: `${(totalDist / 1609.34).toFixed(1)} mi`,
        totalDurationRemaining: formatDuration(totalDur),
        eta: eta.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      }))

      // Place custom markers
      const resolvedStops = validStops.map((stop, index) => {
        const location = index === 0 ? legs[0]?.start_location : legs[index - 1]?.end_location
        return location
          ? { ...stop, lat: location.lat(), lng: location.lng() }
          : stop
      })
      resolvedStopsRef.current = resolvedStops
      placeMarkers(resolvedStops)
      setRouteLoaded(true)

      // Set first navigation instruction
      if (segments[0]?.steps[0]) {
        setNavState(prev => ({
          ...prev,
          nextInstruction: stripHtml(segments[0]!.steps[0]!.instructions),
          distanceRemaining: segments[0]!.distance,
          durationRemaining: segments[0]!.duration,
        }))
      }
    } catch (err: any) {
      console.error('Directions error:', err)
      toast('Could not calculate route — check addresses', 'error')
      // Fallback: place markers and draw polyline
      resolvedStopsRef.current = validStops
      placeMarkers(validStops)
      drawFallbackPolyline(validStops)
    }
  }, [stopsKey, departureTime, plannedDistance, plannedDurationMinutes, plannedEndTime])

  useEffect(() => {
    if (mapReady && stops.length >= 2) {
      buildRoute()
    }
  }, [mapReady, buildRoute])

  // ── Custom Markers ────────────────────────────────────────────────
  const placeMarkers = (stopsToMark: NavStop[]) => {
    // Clear existing
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    if (!mapRef.current) return

    stopsToMark.forEach((stop, idx) => {
      const position = stop.lat && stop.lng
        ? { lat: stop.lat, lng: stop.lng }
        : null

      if (!position) return // Geocoded via directions

      const { completedStops, currentStopIndex, isNavigating } = navStateRef.current
      const isCompleted = completedStops.includes(idx)
      const isCurrent = idx === currentStopIndex && isNavigating
      const color = MARKER_COLORS[stop.type] || '#6B7280'
      const tag = stopTagsRef.current.get(stop.id)
      const labelText = tag ?? MARKER_LABELS[stop.type] ?? stop.order?.toString() ?? `${idx + 1}`

      const marker = new google.maps.Marker({
        position,
        map: mapRef.current!,
        title: `${tag ? `${tag} — ` : ''}${stop.label || stop.type} — ${stop.address}`,
        label: {
          text: labelText,
          color: '#FFFFFF',
          fontWeight: 'bold',
          fontSize: labelText.length > 2 ? '10px' : '12px',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isCurrent ? 16 : 13,
          fillColor: isCompleted ? '#9CA3AF' : color,
          fillOpacity: isCompleted ? 0.5 : 1,
          strokeWeight: isCurrent ? 3 : 2,
          strokeColor: isCurrent ? '#FFFFFF' : '#1F2937',
        },
        zIndex: isCurrent ? 100 : 50 - idx,
      })

      // Info window
      const infoContent = `
        <div style="font-family:system-ui;max-width:240px;">
          <p style="font-weight:600;margin:0 0 4px;">${tag ? `${tag} · ` : ''}${stop.label || stop.type.replace('_', ' ')}</p>
          <p style="font-size:13px;color:#555;margin:0 0 4px;">${stop.address}</p>
          ${stop.vehicleInfo ? `<p style="font-size:12px;color:#888;margin:0;">${stop.vehicleInfo}</p>` : ''}
          ${stop.estimatedArrival ? `<p style="font-size:12px;color:#F59E0B;margin:4px 0 0;">ETA: ${new Date(stop.estimatedArrival).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>` : ''}
        </div>
      `

      const infoWindow = new google.maps.InfoWindow({ content: infoContent })
      marker.addListener('click', () => {
        infoWindow.open(mapRef.current!, marker)
      })

      markersRef.current.push(marker)
    })
  }

  // ── Fallback polyline (when Directions API fails) ─────────────────
  const drawFallbackPolyline = (stopsToConnect: NavStop[]) => {
    if (!mapRef.current) return
    const path = stopsToConnect
      .filter(s => s.lat && s.lng)
      .map(s => ({ lat: s.lat!, lng: s.lng! }))

    if (path.length < 2) return

    new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#F59E0B',
      strokeOpacity: 0.8,
      strokeWeight: 4,
      map: mapRef.current,
    })

    const bounds = new google.maps.LatLngBounds()
    path.forEach(p => bounds.extend(p))
    mapRef.current.fitBounds(bounds, 60)
  }

  // ── GPS Tracking ─────────────────────────────────────────────────
  // Re-style markers when the current or completed stop changes.
  useEffect(() => {
    if (resolvedStopsRef.current.length) placeMarkers(resolvedStopsRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navState.completedStops, navState.currentStopIndex, navState.isNavigating])

  useEffect(() => {
    if (!exitAction) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') exitAction()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [exitAction])

  const moveDriverMarker = useCallback((to: Point) => {
    const marker = driverMarkerRef.current
    const from = marker?.getPosition()
    if (!marker || !from) return
    if (driverAnimRef.current !== null) cancelAnimationFrame(driverAnimRef.current)

    const startLat = from.lat()
    const startLng = from.lng()
    const startedAt = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / MARKER_GLIDE_MS)
      marker.setPosition({ lat: startLat + (to.lat - startLat) * t, lng: startLng + (to.lng - startLng) * t })
      driverAnimRef.current = t < 1 ? requestAnimationFrame(tick) : null
    }
    driverAnimRef.current = requestAnimationFrame(tick)
  }, [])

  // Shows the upcoming maneuver and the distance to it, advancing as the driver passes each step.
  const updateGuidance = useCallback((pos: Point) => {
    const steps = routeSegmentsRef.current[navStateRef.current.currentLeg]?.steps
    if (!steps?.length) return

    let idx = Math.min(stepIndexRef.current, steps.length - 1)
    while (idx < steps.length - 1 && metersBetween(pos, steps[idx]!.end_location) < STEP_REACHED_METERS) idx++

    const upcoming = steps[idx + 1]
    const meters = metersBetween(pos, steps[idx]!.end_location)
    const instruction = upcoming ? htmlToText(upcoming.instructions) : 'Arrive at your stop'
    const distance = meters < 300 ? `${Math.max(10, Math.round(meters * 3.28084 / 10) * 10)} ft` : `${(meters / 1609.34).toFixed(1)} mi`

    if (idx !== stepIndexRef.current) {
      stepIndexRef.current = idx
      if ((simRef.current?.speed ?? 1) <= 1) speakRef.current(instruction)
    }
    setNavState(prev =>
      prev.nextInstruction === instruction && prev.distanceRemaining === distance
        ? prev
        : { ...prev, nextInstruction: instruction, distanceRemaining: distance }
    )
  }, [])

  // Single entry point for a driver position, whether it came from real GPS or the simulator.
  const applyPosition = useCallback((
    newPos: Point,
    heading: number | null,
    extra: { speedMps?: number | null; accuracyMeters?: number | null; simulated?: boolean } = {},
  ) => {
    setCurrentDriverPos(newPos)

    if (driverMarkerRef.current) {
      moveDriverMarker(newPos)
    } else if (mapRef.current) {
      driverMarkerRef.current = new google.maps.Marker({
        position: newPos,
        map: mapRef.current,
        title: 'Your Location',
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 7,
          fillColor: '#F59E0B',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
          rotation: heading ?? 0,
        },
        zIndex: 200,
      })
      if (followRef.current) mapRef.current.setZoom(16)
    }

    if (heading !== null && driverMarkerRef.current) {
      const icon = driverMarkerRef.current.getIcon() as google.maps.Symbol
      if (icon) {
        icon.rotation = heading
        driverMarkerRef.current.setIcon(icon)
      }
    }

    if (followRef.current) mapRef.current?.panTo(newPos)
    updateGuidance(newPos)
    onPositionRef.current?.({
      lat: newPos.lat,
      lng: newPos.lng,
      heading,
      speedMps: extra.speedMps ?? null,
      accuracyMeters: extra.accuracyMeters ?? null,
      at: Date.now(),
      simulated: extra.simulated === true,
    })
  }, [moveDriverMarker, updateGuidance])

  const startGPSTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast('Geolocation not supported', 'error')
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const heading = typeof pos.coords.heading === 'number' && Number.isFinite(pos.coords.heading) ? pos.coords.heading : null
        const speed = typeof pos.coords.speed === 'number' && Number.isFinite(pos.coords.speed) ? pos.coords.speed : null
        applyPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }, heading, { speedMps: speed, accuracyMeters: pos.coords.accuracy })
      },
      (err) => {
        console.error('GPS error:', err)
        toast('Could not get GPS position', 'warning')
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    )
  }, [applyPosition])

  const stopGPSTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (driverAnimRef.current !== null) {
      cancelAnimationFrame(driverAnimRef.current)
      driverAnimRef.current = null
    }
  }, [])

  // ── Screen wake lock (browsers release it whenever the page is hidden) ──
  const acquireWakeLock = useCallback(async () => {
    if (wakeLockRef.current) return
    if (!('wakeLock' in navigator)) {
      if (!wakeLockWarnedRef.current) {
        wakeLockWarnedRef.current = true
        toast('This browser cannot keep the screen on. Turn off auto-lock while driving.', 'warning')
      }
      return
    }
    try {
      const lock = await navigator.wakeLock.request('screen')
      wakeLockRef.current = lock
      setWakeLockActive(true)
      lock.addEventListener('release', () => {
        if (wakeLockRef.current !== lock) return
        wakeLockRef.current = null
        setWakeLockActive(false)
      })
    } catch {
      // Denied, for example under battery saver.
    }
  }, [])

  const releaseWakeLock = useCallback(() => {
    const lock = wakeLockRef.current
    wakeLockRef.current = null
    setWakeLockActive(false)
    void lock?.release().catch(() => {})
  }, [])

  // ── Simulated drive: feeds the same pipeline as real GPS ─────────────
  const stopSimulation = useCallback(() => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current)
      simTimerRef.current = null
    }
    simRef.current = null
    setSimulation(null)
  }, [])

  const tickSimulation = useCallback(() => {
    const sim = simRef.current
    const path = simPathRef.current
    if (!sim || !path) return
    if (!navStateRef.current.isNavigating) {
      stopSimulation()
      return
    }
    if (Date.now() < sim.pausedUntil) return

    const nav = navStateRef.current
    if (sim.pending) {
      sim.pending = false
      markStopCompletedRef.current(nav.currentStopIndex)
      return
    }

    sim.meters += SIM_BASE_METERS_PER_SECOND * sim.speed * (SIM_TICK_MS / 1000)
    const legEnd = path.legEnds[nav.currentLeg]
    const arrived = legEnd !== undefined && sim.meters >= legEnd
    if (arrived) sim.meters = legEnd

    const position = positionAt(path, sim.meters)
    if (position) applyPosition(position, position.heading, { speedMps: SIM_BASE_METERS_PER_SECOND * sim.speed, simulated: true })
    if (arrived) {
      sim.pending = true
      sim.pausedUntil = Date.now() + SIM_STOP_PAUSE_MS
    }
  }, [applyPosition, stopSimulation])

  const setSimulationSpeed = (speed: number) => {
    if (simRef.current) simRef.current.speed = speed
    setSimulation({ speed })
  }

  useEffect(() => {
    setSimAvailable(process.env.NODE_ENV !== 'production' || new URLSearchParams(window.location.search).has('simulate'))
  }, [])

  useEffect(() => {
    if (navState.isNavigating) {
      void acquireWakeLock()
    } else {
      releaseWakeLock()
      stopSimulation()
    }
  }, [navState.isNavigating, acquireWakeLock, releaseWakeLock, stopSimulation])

  // Coming back from a locked screen: the lock is gone and GPS watches often stop delivering fixes.
  useEffect(() => {
    let hiddenAt = 0
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      if (!navStateRef.current.isNavigating) return
      void acquireWakeLock()
      if (simRef.current) return
      stopGPSTracking()
      startGPSTracking()
      if (hiddenAt && Date.now() - hiddenAt > 5000) toast('Welcome back. GPS tracking resumed.', 'info')
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [acquireWakeLock, startGPSTracking, stopGPSTracking])

  useEffect(() => () => {
    stopSimulation()
    releaseWakeLock()
  }, [stopSimulation, releaseWakeLock])

  // ── Navigation Controls ───────────────────────────────────────────
  const beginNavState = () => {
    stepIndexRef.current = 0
    setFollow(true)
    // Leg 0 runs stop 0 to stop 1, so the origin is already done and stop 1 is the first target.
    const hasOrigin = stops.length > 1
    setNavState(prev => ({
      ...prev,
      isNavigating: true,
      currentStopIndex: hasOrigin ? 1 : 0,
      currentLeg: 0,
      completedStops: hasOrigin ? [0] : [],
    }))
  }

  const startNavigation = () => {
    beginNavState()
    startGPSTracking()
    Promise.resolve(onNavigationStart?.()).catch(() => {})
    toast('Navigation started — follow the route', 'success')
    if (voiceEnabled) speak('Navigation started. Follow the amber route.')
  }

  const startSimulation = () => {
    const path = simPathRef.current
    const first = path && positionAt(path, 0)
    if (!path || !first || path.points.length < 2) {
      toast('The route is still loading', 'warning')
      return
    }

    stopGPSTracking()
    driverMarkerRef.current?.setMap(null)
    driverMarkerRef.current = null
    beginNavState()
    Promise.resolve(onSimulationStart?.()).catch(() => {})

    simRef.current = { speed: 10, meters: 0, pausedUntil: 0, pending: false }
    setSimulation({ speed: 10 })
    applyPosition(first, first.heading, { speedMps: SIM_BASE_METERS_PER_SECOND * 10, simulated: true })
    if (simTimerRef.current) clearInterval(simTimerRef.current)
    simTimerRef.current = setInterval(tickSimulation, SIM_TICK_MS)
    toast('Simulated drive started. This is not real GPS.', 'info')
  }

  const openInGoogleMaps = () => {
    const route = resolvedStopsRef.current.length ? resolvedStopsRef.current : stops
    const from = navState.isNavigating ? navState.currentStopIndex : route.length > 1 ? 1 : 0
    const remaining = route.slice(from)
    const url = googleMapsDirectionsUrl(remaining.map(stop => ({ address: stop.address, lat: stop.lat, lng: stop.lng })))
    if (!url) {
      toast('No stops left to navigate to', 'info')
      return
    }
    window.open(url, '_blank', 'noopener')
    if (remaining.length > 10) toast('Google Maps takes 10 stops at a time. Opened the next 10.', 'info')
  }

  const stopNavigation = () => {
    stopSimulation()
    setNavState(prev => ({
      ...prev,
      isNavigating: false,
    }))
    stopGPSTracking()
    toast('Navigation stopped', 'info')
  }

  // Handlers run outside state updaters so a double-invoked updater can never record a stop twice.
  const markStopCompleted = (idx: number) => {
    const prev = navStateRef.current
    if (prev.completedStops.includes(idx)) return
    stepIndexRef.current = 0

    const completed = [...prev.completedStops, idx]
    const nextLeg = Math.min(prev.currentLeg + 1, routeSegments.length - 1)
    const nextStop = idx + 1
    const recordProgress = !simRef.current // A simulated drive never writes real progress.

    if (recordProgress) onStopReached?.(idx)

    if (nextStop >= stops.length) {
      if (recordProgress) onNavigationComplete?.()
      toast('Route complete!', 'success')
      if (voiceEnabled) speak('You have reached your final destination. Route complete!')
      setNavState(current => ({ ...current, completedStops: completed, isNavigating: false }))
      return
    }

    const nextSegment = routeSegments[nextLeg]
    const nextInstr = nextSegment?.steps[0]?.instructions || ''
    if (voiceEnabled) {
      speak(`${stopTags.get(stops[idx]?.id ?? '') ?? `Stop ${idx + 1}`} complete. Next: ${stops[nextStop]?.address || 'next stop'}`)
    }

    setNavState(current => ({
      ...current,
      completedStops: completed,
      currentStopIndex: nextStop,
      currentLeg: nextLeg,
      distanceRemaining: nextSegment?.distance || '',
      durationRemaining: nextSegment?.duration || '',
      nextInstruction: stripHtml(nextInstr),
    }))
  }

  markStopCompletedRef.current = markStopCompleted

  // A re-plan replaces the stop list, so progress restarts from the new first leg.
  const previousStopsKeyRef = useRef(stopsKey)
  useEffect(() => {
    if (previousStopsKeyRef.current === stopsKey) return
    previousStopsKeyRef.current = stopsKey
    if (!navStateRef.current.isNavigating) return
    if (simRef.current) {
      stopNavigation()
      return
    }
    beginNavState()
    toast('Route re-planned from your position', 'success')
    if (voiceEnabled) speak('Route updated from your position.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopsKey])

  const replan = async () => {
    if (!onReoptimize || replanning) return
    setReplanning(true)
    try {
      await onReoptimize()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not re-plan the route', 'error')
    } finally {
      setReplanning(false)
    }
  }

  const goToNextStep = () => {
    setNavState(prev => {
      const currentSegment = routeSegments[prev.currentLeg]
      if (!currentSegment) return prev

      // We're abstracting "step" to mean the leg/stop level for simplicity
      // The actual turn-by-turn is shown per-leg
      return prev
    })
  }

  // ── Recenter Map ─────────────────────────────────────────────────
  const recenterMap = () => {
    if (!mapRef.current) return
    setFollow(true)
    if (currentDriverPos) {
      mapRef.current.panTo(currentDriverPos)
      mapRef.current.setZoom(15)
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setCurrentDriverPos(loc)
          mapRef.current?.panTo(loc)
          mapRef.current?.setZoom(15)
        },
        () => toast('Could not get location', 'warning')
      )
    }
  }

  // ── Toggle Traffic Layer ──────────────────────────────────────────
  useEffect(() => {
    if (trafficLayerRef.current && mapRef.current) {
      trafficLayerRef.current.setMap(showTraffic ? mapRef.current : null)
    }
  }, [showTraffic])

  // ── Toggle Map Type ───────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setMapTypeId(mapType)
    }
  }, [mapType])

  // ── Cleanup GPS on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => { stopGPSTracking() }
  }, [stopGPSTracking])

  // ── Voice ─────────────────────────────────────────────────────────
  const speak = (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1
    utterance.volume = 0.9
    window.speechSynthesis.speak(utterance)
  }
  speakRef.current = speak

  // ── Helpers ────────────────────────────────────────────────────────
  const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return doc.body.textContent || ''
  }

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.round((seconds % 3600) / 60)
    if (hours === 0) return `${mins} min`
    return `${hours}h ${mins}m`
  }

  const stopTypeIcon = (type: string) => {
    switch (type) {
      case 'pickup': return <Package className="h-4 w-4 text-blue-500" />
      case 'delivery': return <MapPin className="h-4 w-4 text-green-500" />
      case 'fuel': return <Fuel className="h-4 w-4 text-yellow-500" />
      case 'rest': return <Coffee className="h-4 w-4 text-purple-500" />
      default: return <Navigation className="h-4 w-4 text-amber-500" />
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Render
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div className={`relative ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* ── Map Container ───────────────────────────────────────── */}
      <div
        ref={mapContainerRef}
        className={`w-full ${isFullscreen ? 'h-full' : height} rounded-lg overflow-hidden border border-gray-200`}
      />

      {/* ── Map Loading ─────────────────────────────────────────── */}
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading map...</p>
          </div>
        </div>
      )}

      {/* ── Exit (always reachable, large touch target) ─────────────── */}
      {exitAction && (
        <button
          type="button"
          onClick={exitAction}
          aria-label={onClose ? 'Exit driving mode' : 'Exit full screen'}
          className="absolute right-3 z-20 flex h-12 items-center gap-1.5 rounded-lg bg-gray-900 px-3.5 text-sm font-semibold text-white shadow-lg ring-1 ring-white/30 active:bg-gray-700"
          style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <X className="h-5 w-5" />
          Exit
        </button>
      )}

      {showOverlay && mapReady && (
        <>
          {/* ── Top Bar: Route Summary ──────────────────────────── */}
          {routeLoaded && (
            <div
              className={`absolute left-3 z-10 ${exitAction ? 'right-[5.5rem]' : 'right-3'}`}
              style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}
            >
              {/* Navigation Instruction Banner */}
              {navState.isNavigating && navState.nextInstruction && (
                <div className="bg-gray-900 text-white rounded-lg px-4 py-3 mb-2 shadow-lg">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      <CornerUpRight className="h-6 w-6 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{navState.nextInstruction}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-300">
                        <span>{navState.distanceRemaining}</span>
                        <span>·</span>
                        <span>{navState.durationRemaining}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Route Summary Bar */}
              <div className="bg-white/95 backdrop-blur rounded-lg px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Route className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold text-gray-900">{totalDistance}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span className="font-medium text-gray-700">{totalDuration}</span>
                  </div>
                  {navState.eta && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Target className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-gray-700">ETA {navState.eta}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {trackingStatus && !simulation && (
                    <span
                      className={`text-[11px] font-semibold ${
                        trackingStatus.state === 'on' ? 'text-green-600'
                          : trackingStatus.state === 'error' ? 'text-red-600'
                            : trackingStatus.state === 'pending' ? 'text-amber-600' : 'text-gray-500'
                      }`}
                    >
                      {trackingStatus.label}
                    </span>
                  )}
                  {navState.isNavigating && !simulation && (
                    <span className={`text-[11px] font-medium ${wakeLockActive ? 'text-green-600' : 'text-amber-600'}`}>
                      {wakeLockActive ? 'Screen stays on' : 'Auto-lock can pause GPS'}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {stops.length} stop{stops.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Right Controls ──────────────────────────────────── */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2">
            <MapControlButton
              icon={<Locate className={`h-4 w-4 ${following ? 'text-amber-500' : ''}`} />}
              title={following ? 'Following your location' : 'Recenter on my location'}
              onClick={recenterMap}
              active={following}
            />
            <MapControlButton
              icon={showTraffic ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <AlertTriangle className="h-4 w-4" />}
              title="Toggle Traffic"
              onClick={() => setShowTraffic(p => !p)}
              active={showTraffic}
            />
            <MapControlButton
              icon={<Layers className="h-4 w-4" />}
              title="Map Style"
              onClick={() =>
                setMapType(p =>
                  p === 'roadmap' ? 'satellite' : p === 'satellite' ? 'hybrid' : 'roadmap'
                )
              }
            />
            <MapControlButton
              icon={voiceEnabled ? <Volume2 className="h-4 w-4 text-amber-500" /> : <VolumeX className="h-4 w-4" />}
              title="Voice Navigation"
              onClick={() => setVoiceEnabled(p => !p)}
              active={voiceEnabled}
            />
            {!onClose && (
              <MapControlButton
                icon={isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                title={isFullscreen ? 'Exit full screen' : 'Full screen'}
                onClick={() => setIsFullscreen(p => !p)}
              />
            )}
          </div>

          {/* ── Bottom Panel ────────────────────────────────────── */}
          <div
            className="absolute left-3 right-3 z-10"
            style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
          >
            {/* Benji Tip (floating) */}
            {showBenjiPanel && benjiTips.length > 0 && (
              <div className="bg-amber-50/95 backdrop-blur border border-amber-200 rounded-lg p-3 mb-2 shadow-md">
                <div className="flex items-start gap-2">
                  <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-amber-800 mb-1">Benji's Tip</p>
                    <p className="text-xs text-amber-900">{benjiTips[0]}</p>
                  </div>
                  <button onClick={() => setShowBenjiPanel(false)} className="text-amber-400 hover:text-amber-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Carolina Insight Alert */}
            {carolinaInsights.length > 0 && carolinaInsights[0] && carolinaInsights[0].severity !== 'info' && (
              <div className="bg-red-50/95 backdrop-blur border border-red-200 rounded-lg p-3 mb-2 shadow-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-red-800">{carolinaInsights[0].title}</p>
                    <p className="text-xs text-red-700">{carolinaInsights[0].description}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Simulated drive controls */}
            {simulation && (
              <div className="bg-violet-600 text-white rounded-lg px-3 py-2 mb-2 shadow-md flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide">Simulated drive</span>
                <span className="text-[11px] text-violet-100">Not real GPS</span>
                <div className="flex-1" />
                {SIM_SPEEDS.map(speed => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => setSimulationSpeed(speed)}
                    className={`h-8 min-w-[2.75rem] rounded-md px-2 text-xs font-bold ${
                      simulation.speed === speed ? 'bg-white text-violet-700' : 'bg-violet-500 text-white'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
                <button
                  type="button"
                  onClick={stopNavigation}
                  className="h-8 rounded-md bg-violet-900 px-3 text-xs font-bold text-white"
                >
                  End
                </button>
              </div>
            )}

            {/* Stops List (expandable) */}
            {showStopsList && (
              <div className="bg-white/95 backdrop-blur rounded-lg border border-gray-200 shadow-lg mb-2 max-h-64 overflow-y-auto">
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-900">Route Stops</span>
                  <button onClick={() => setShowStopsList(false)}>
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
                <div className="divide-y divide-gray-50">
                  {stops.map((stop, idx) => {
                    const isCompleted = navState.completedStops.includes(idx)
                    const isCurrent = idx === navState.currentStopIndex
                    return (
                      <div
                        key={stop.id}
                        className={`flex items-center gap-3 px-4 py-2.5 ${
                          isCurrent ? 'bg-amber-50' : isCompleted ? 'opacity-50' : ''
                        }`}
                      >
                        <div className={`min-w-[1.75rem] h-7 px-1.5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                          isCompleted ? 'bg-gray-400' : isCurrent ? 'bg-amber-500' : stop.type === 'pickup' ? 'bg-blue-500' : stop.type === 'delivery' ? 'bg-emerald-500' : 'bg-gray-300'
                        }`}>
                          {stopTags.get(stop.id) ?? (stop.order || idx + 1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {stopTypeIcon(stop.type)}
                            <span className="text-xs font-medium text-gray-900 truncate">{stop.address}</span>
                          </div>
                          {stop.vehicleInfo && (
                            <p className="text-[11px] text-gray-500 mt-0.5 truncate">{stop.vehicleInfo}</p>
                          )}
                        </div>
                        {legSummaries[idx] && !isCompleted && (
                          <span className="text-[11px] text-gray-500 shrink-0">{legSummaries[idx]!.distance}</span>
                        )}
                        {navState.isNavigating && isCurrent && (
                          <button
                            onClick={() => markStopCompleted(idx)}
                            className="text-[11px] font-semibold text-green-600 hover:text-green-700 bg-green-50 px-2 py-1 rounded shrink-0"
                          >
                            Done
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 overflow-hidden">
              <div className="flex flex-wrap items-center gap-1 p-2">
                {/* Toggle Stops List */}
                <button
                  onClick={() => setShowStopsList(p => !p)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    showStopsList ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {showStopsList ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                  Stops
                </button>

                {/* Benji Toggle */}
                {benjiTips.length > 0 && (
                  <button
                    onClick={() => setShowBenjiPanel(p => !p)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                      showBenjiPanel ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Benji
                  </button>
                )}

                {/* Fuel Stops */}
                {fuelStops.length > 0 && (
                  <div className="flex items-center gap-1 px-3 py-2 text-xs text-green-600 font-medium">
                    <Fuel className="h-3.5 w-3.5" />
                    {fuelStops.length} fuel
                  </div>
                )}

                {/* Hand off to Google Maps: keeps guiding when this page is backgrounded or the screen locks */}
                {routeLoaded && (
                  <button
                    type="button"
                    onClick={openInGoogleMaps}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    Google Maps
                  </button>
                )}

                {onReoptimize && navState.isNavigating && !simulation && (
                  <button
                    type="button"
                    onClick={() => void replan()}
                    disabled={replanning}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    {replanning ? 'Re-planning...' : 'Re-plan'}
                  </button>
                )}

                {simAvailable && routeLoaded && !navState.isNavigating && (
                  <button
                    type="button"
                    onClick={startSimulation}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium text-violet-700 hover:bg-violet-50 transition-colors"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Simulate drive
                  </button>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Navigation Start/Stop */}
                {!navState.isNavigating ? (
                  <Button
                    onClick={startNavigation}
                    disabled={!routeLoaded}
                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-4 py-2 h-auto"
                  >
                    <Navigation className="h-3.5 w-3.5 mr-1.5" />
                    Start Navigation
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    {/* Mark current stop done */}
                    <Button
                      onClick={() => markStopCompleted(navState.currentStopIndex)}
                      className="bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-2 h-auto"
                    >
                      Arrived
                    </Button>
                    <Button
                      onClick={stopNavigation}
                      variant="outline"
                      className="text-xs px-3 py-2 h-auto border-red-300 text-red-600 hover:bg-red-50"
                    >
                      Stop
                    </Button>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {navState.isNavigating && stops.length > 0 && (
                <div className="px-2 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${(navState.completedStops.length / stops.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-gray-500 shrink-0">
                      {navState.completedStops.length}/{stops.length}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sub-components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function MapControlButton({
  icon,
  title,
  onClick,
  active,
}: {
  icon: React.ReactNode
  title: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`w-11 h-11 sm:w-9 sm:h-9 rounded-lg shadow-md flex items-center justify-center transition-colors ${
        active ? 'bg-amber-50 border border-amber-300' : 'bg-white border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {icon}
    </button>
  )
}
