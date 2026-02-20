'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
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
} from 'lucide-react'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface NavStop {
  id: string
  address: string
  lat?: number
  lng?: number
  type: 'pickup' | 'delivery' | 'fuel' | 'rest' | 'current_location'
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

interface DriverMapNavigationProps {
  stops: NavStop[]
  driverLocation?: { lat: number; lng: number }
  onStopReached?: (stopIndex: number) => void
  onNavigationComplete?: () => void
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function DriverMapNavigation({
  stops,
  driverLocation,
  onStopReached,
  onNavigationComplete,
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

  // ── Initialize Google Map ─────────────────────────────────────────
  const initMap = useCallback(() => {
    if (!mapContainerRef.current || !window.google) return

    const center = currentDriverPos
      ? { lat: currentDriverPos.lat, lng: currentDriverPos.lng }
      : stops[0]?.lat && stops[0]?.lng
        ? { lat: stops[0].lat, lng: stops[0].lng }
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

    // Traffic layer
    const traffic = new google.maps.TrafficLayer()
    if (showTraffic) traffic.setMap(map)
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
  }, [currentDriverPos, stops, showTraffic])

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
          departureTime: new Date(),
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

      setTotalDistance(`${(totalDist / 1609.34).toFixed(1)} mi`)
      setTotalDuration(formatDuration(totalDur))
      setLegSummaries(summaries)

      // Compute ETA
      const eta = new Date(Date.now() + totalDur * 1000)
      setNavState(prev => ({
        ...prev,
        totalDistanceRemaining: `${(totalDist / 1609.34).toFixed(1)} mi`,
        totalDurationRemaining: formatDuration(totalDur),
        eta: eta.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      }))

      // Place custom markers
      placeMarkers(validStops)
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
      placeMarkers(validStops)
      drawFallbackPolyline(validStops)
    }
  }, [stops])

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

      const isCompleted = navState.completedStops.includes(idx)
      const isCurrent = idx === navState.currentStopIndex && navState.isNavigating
      const color = MARKER_COLORS[stop.type] || '#6B7280'

      const marker = new google.maps.Marker({
        position,
        map: mapRef.current!,
        title: `${stop.label || stop.type} — ${stop.address}`,
        label: {
          text: stop.order?.toString() || MARKER_LABELS[stop.type] || `${idx + 1}`,
          color: '#FFFFFF',
          fontWeight: 'bold',
          fontSize: '12px',
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
          <p style="font-weight:600;margin:0 0 4px;">${stop.label || stop.type.replace('_', ' ')}</p>
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
  const startGPSTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast('Geolocation not supported', 'error')
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setCurrentDriverPos(newPos)

        // Update driver marker
        if (driverMarkerRef.current) {
          driverMarkerRef.current.setPosition(newPos)
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
              rotation: pos.coords.heading || 0,
            },
            zIndex: 200,
          })
        }

        // Update heading
        if (pos.coords.heading != null && driverMarkerRef.current) {
          const icon = driverMarkerRef.current.getIcon() as google.maps.Symbol
          if (icon) {
            icon.rotation = pos.coords.heading
            driverMarkerRef.current.setIcon(icon)
          }
        }
      },
      (err) => {
        console.error('GPS error:', err)
        toast('Could not get GPS position', 'warning')
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    )
  }, [])

  const stopGPSTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  // ── Navigation Controls ───────────────────────────────────────────
  const startNavigation = () => {
    setNavState(prev => ({ ...prev, isNavigating: true, currentStopIndex: 0, currentLeg: 0 }))
    startGPSTracking()
    toast('Navigation started — follow the route', 'success')
    if (voiceEnabled) speak('Navigation started. Follow the amber route.')
  }

  const stopNavigation = () => {
    setNavState(prev => ({
      ...prev,
      isNavigating: false,
    }))
    stopGPSTracking()
    toast('Navigation stopped', 'info')
  }

  const markStopCompleted = (idx: number) => {
    setNavState(prev => {
      const completed = [...prev.completedStops, idx]
      const nextLeg = Math.min(prev.currentLeg + 1, routeSegments.length - 1)
      const nextStop = idx + 1

      if (nextStop >= stops.length) {
        onNavigationComplete?.()
        toast('Route complete!', 'success')
        if (voiceEnabled) speak('You have reached your final destination. Route complete!')
        return { ...prev, completedStops: completed, isNavigating: false }
      }

      onStopReached?.(idx)

      // Set next leg instructions
      const nextSegment = routeSegments[nextLeg]
      const nextInstr = nextSegment?.steps[0]?.instructions || ''

      if (voiceEnabled) {
        speak(`Stop ${idx + 1} complete. Next: ${stops[nextStop]?.address || 'next stop'}`)
      }

      return {
        ...prev,
        completedStops: completed,
        currentStopIndex: nextStop,
        currentLeg: nextLeg,
        distanceRemaining: nextSegment?.distance || '',
        durationRemaining: nextSegment?.duration || '',
        nextInstruction: stripHtml(nextInstr),
      }
    })
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

      {showOverlay && mapReady && (
        <>
          {/* ── Top Bar: Route Summary ──────────────────────────── */}
          {routeLoaded && (
            <div className="absolute top-3 left-3 right-3 z-10">
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
              <div className="bg-white/95 backdrop-blur rounded-lg px-4 py-2.5 shadow-md flex items-center justify-between">
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
                <div className="flex items-center gap-1">
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
              icon={<Locate className="h-4 w-4" />}
              title="My Location"
              onClick={recenterMap}
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
            <MapControlButton
              icon={isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              title="Fullscreen"
              onClick={() => setIsFullscreen(p => !p)}
            />
          </div>

          {/* ── Bottom Panel ────────────────────────────────────── */}
          <div className="absolute bottom-3 left-3 right-3 z-10">
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
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                          isCompleted ? 'bg-gray-400' : isCurrent ? 'bg-amber-500' : 'bg-gray-300'
                        }`}>
                          {stop.order || idx + 1}
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
              <div className="flex items-center gap-1 p-2">
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

                {/* Close */}
                {onClose && (
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
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
      onClick={onClick}
      title={title}
      className={`w-9 h-9 rounded-lg shadow-md flex items-center justify-center transition-colors ${
        active ? 'bg-amber-50 border border-amber-300' : 'bg-white border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {icon}
    </button>
  )
}
