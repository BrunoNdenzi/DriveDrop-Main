'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { assignStopTags } from '@/lib/stop-tags'
import { positionAt } from '@/lib/route-sim'
import {
  adaptiveZoom,
  buildRoutePlan,
  createOffRouteDetector,
  headingFromMovement,
  offsetAhead,
  progressAlong,
  projectOnPath,
  type RoutePlan,
} from '@/lib/route-geometry'
import { createZoomGovernor, metersPerPixel, routeHeadingAt, stepCamera, type CameraState } from '@/lib/camera'
import {
  BREAK_MAX_MS,
  CLOSURE_MS,
  activeClosures,
  decideOffRoute,
  describeDetour,
  pickAvoidingRoute,
  type ClosureMark,
  type DeviationReason,
} from '@/lib/off-route-policy'
import { arrowRotation, parseManeuver, type ManeuverView } from '@/lib/maneuvers'
import {
  OVERRIDE_REASONS,
  arrivalRadius,
  checkArrival,
  createArrivalWatcher,
  describeDistance,
  type ArrivalCheck,
} from '@/lib/arrival-check'
import {
  DESKTOP_WAYPOINT_LIMIT,
  MOBILE_WAYPOINT_LIMIT,
  googleMapsRouteParts,
  isMobileBrowser,
  type ExportPart,
} from '@/lib/external-nav'
import StopStrip, { navStopDetails, navStopLabel } from './StopStrip'
import AddShipmentSheet, { type AddedStopDraft } from '@/components/route-planner/AddShipmentSheet'
import { canFullscreen, enterFullscreen, exitFullscreen, isFullscreen as isDeviceFullscreen, isIphoneBrowser } from '@/lib/fullscreen'
import { toast } from '@/components/ui/toast'
import {
  Navigation,
  MapPin,
  Package,
  Fuel,
  Coffee,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Locate,
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
  name?: string
  isReturn?: boolean
  serviceMinutes?: number
  distanceFromPrevious?: number
  durationFromPrevious?: number
  timeWindow?: { earliest: string; latest: string }
}

// What the driver confirmed when marking a stop reached, so the server can verify it independently.
export interface ArrivalReport {
  target: { lat: number; lng: number }
  radiusMeters: number
  fix: { lat: number; lng: number; accuracyMeters: number | null } | null
  overrideCode?: string
  overrideNote?: string
}

export interface NavigationState {
  isNavigating: boolean
  currentStopIndex: number
  currentLeg: number
  distanceRemaining: string
  durationRemaining: string
  nextInstruction: string
  nextManeuver: string
  maneuver: ManeuverView | null
  thenInstruction: string
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
  onStopReached?: (stopIndex: number, arrival?: ArrivalReport) => void
  onNavigationComplete?: () => void
  onPosition?: (fix: DriverFix) => void
  onNavigationStart?: () => void | Promise<void>
  onSimulationStart?: () => void | Promise<void>
  onReoptimize?: () => Promise<string | void>
  onAddShipment?: (stops: AddedStopDraft[]) => Promise<string | void>
  onDeviation?: (event: DeviationEvent) => void
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

const FRAME_MS = 33
const MAX_PREDICT_MS = 1500
const FOLLOW_RESUME_MS = 12_000
const SIM_TICK_MS = 1000
const SIM_BASE_METERS_PER_SECOND = 17.9 // 40 mph
const SIM_STOP_PAUSE_MS = 2000
const SIM_SPEEDS = [1, 10, 30] as const
const SIM_DETOUR_METERS = 450
const SIM_DETOUR_MS = 12_000
const FIX_FRESH_MS = 45_000
const REROUTE_COOLDOWN_MS = 10_000
const TRAFFIC_REFRESH_MS = 240_000
const FASTER_ROUTE_MIN_SECONDS = 180
const USER_ZOOM_HOLD_MS = 15_000
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID

interface BuiltRoute {
  result: google.maps.DirectionsResult
  valid: NavStop[]
  legBase: number
  fromHere: boolean
  // Set only when closures were given: whether the route found stays clear of them.
  avoided?: boolean
}

export interface DeviationEvent {
  id: string
  startedAt: number
  endedAt?: number
  reason: DeviationReason
  resolution?: 'returned' | 'rerouted' | 'break_ended' | 'still_off'
  maxDistanceMeters: number
  addedMinutes?: number
  lat: number
  lng: number
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const isPoint = (stop: NavStop | undefined): stop is NavStop & Point => Boolean(stop && stop.lat && stop.lng)

const legSeconds = (leg: google.maps.DirectionsLeg): number => leg.duration_in_traffic?.value ?? leg.duration?.value ?? 0

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
  onAddShipment,
  onDeviation,
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
  const routeLineRef = useRef<google.maps.Polyline | null>(null)
  const routeCasingRef = useRef<google.maps.Polyline | null>(null)
  const traveledLineRef = useRef<google.maps.Polyline | null>(null)
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
  const [legSummaries, setLegSummaries] = useState<Array<{ distance: string; duration: string; from: string; to: string; toIndex: number }>>([])
  const [rerouting, setRerouting] = useState(false)
  const [rerouteFailed, setRerouteFailed] = useState(false)
  const [deviation, setDeviation] = useState<{ reason: DeviationReason; distance: number } | null>(null)
  const [breakMode, setBreakMode] = useState(false)
  const [fasterRoute, setFasterRoute] = useState<{ minutes: number } | null>(null)
  const [arrivalPrompt, setArrivalPrompt] = useState<{ idx: number; check: ArrivalCheck } | null>(null)
  const [overrideCode, setOverrideCode] = useState('')
  const [overrideNote, setOverrideNote] = useState('')
  const [arrivalSuggestion, setArrivalSuggestion] = useState<number | null>(null)
  const [exportParts, setExportParts] = useState<ExportPart[] | null>(null)
  const [liveStats, setLiveStats] = useState<{ speedMph: number | null; accuracy: number | null }>({ speedMph: null, accuracy: null })

  const [navState, setNavState] = useState<NavigationState>({
    isNavigating: false,
    currentStopIndex: 0,
    currentLeg: 0,
    distanceRemaining: '',
    durationRemaining: '',
    nextInstruction: '',
    nextManeuver: '',
    maneuver: null,
    thenInstruction: '',
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
  const speakRef = useRef<(text: string) => void>(() => {})
  const onPositionRef = useRef(onPosition)
  const [replanning, setReplanning] = useState(false)
  const [addingShipment, setAddingShipment] = useState(false)
  const planRef = useRef<RoutePlan | null>(null)
  const latestFixRef = useRef<DriverFix | null>(null)
  const lastRawRef = useRef<Point | null>(null)
  const lastFixTimeRef = useRef<{ pos: Point; at: number } | null>(null)
  const fixStateRef = useRef<{ pos: Point; along: number | null; speed: number; heading: number | null; at: number } | null>(null)
  const cameraRef = useRef<CameraState | null>(null)
  const headingTargetRef = useRef<number | null>(null)
  const zoomTargetRef = useRef(16)
  const zoomGovernorRef = useRef(createZoomGovernor())
  const viewportHeightRef = useRef(600)
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const projHintRef = useRef(0)
  const traveledIndexRef = useRef(-1)
  const progressRef = useRef({ remainingMeters: 0, remainingSeconds: 0 })
  const offRouteDetectorRef = useRef(createOffRouteDetector())
  const offRouteStateRef = useRef<'on' | 'suspect' | 'off'>('on')
  const rerouteBusyRef = useRef(false)
  const deviationRef = useRef<{ id: string; startedAt: number; reason: DeviationReason; maxDistance: number; lat: number; lng: number } | null>(null)
  const breakUntilRef = useRef<number | null>(null)
  const closuresRef = useRef<ClosureMark[]>([])
  const alongRef = useRef<number | null>(null)
  const onDeviationRef = useRef(onDeviation)
  const offRouteHandlerRef = useRef<(pos: Point, distance: number, speed: number | null, now: number, state: 'on' | 'suspect' | 'off') => void>(() => {})
  const lastRerouteAtRef = useRef(0)
  const rerouteRef = useRef<(from: Point) => Promise<void>>(async () => {})
  const refreshRef = useRef<() => Promise<void>>(async () => {})
  const announcedRef = useRef(new Set<string>())
  const userZoomUntilRef = useRef(0)
  const arrivalWatcherRef = useRef(createArrivalWatcher())
  const suggestedForRef = useRef<number | null>(null)
  const simPathRef = useRef<RoutePlan | null>(null)
  const simRef = useRef<{ speed: number; meters: number; pausedUntil: number; pending: boolean; detourUntil: number } | null>(null)
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
  onDeviationRef.current = onDeviation

  const setFollow = useCallback((value: boolean) => {
    followRef.current = value
    setFollowing(value)
    if (value && resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current)
      resumeTimerRef.current = null
    }
  }, [])

  // While driving, a look around the map ends by itself and the camera returns to the car.
  const holdFollowOff = useCallback((ms: number) => {
    setFollow(false)
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => {
      resumeTimerRef.current = null
      if (navStateRef.current.isNavigating) setFollow(true)
    }, ms)
  }, [setFollow])

  const exitAction = onClose ?? (isFullscreen ? () => setIsFullscreen(false) : undefined)

  // The browser's own fullscreen is separate from the on-page overlay, and the driver can leave it with a system gesture.
  const [fullscreenSupported, setFullscreenSupported] = useState(false)
  const [deviceFullscreen, setDeviceFullscreen] = useState(false)
  useEffect(() => {
    if (!onClose) return
    setFullscreenSupported(canFullscreen())
    const sync = () => setDeviceFullscreen(isDeviceFullscreen())
    sync()
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    if (isIphoneBrowser() && !sessionStorage.getItem('planner-iphone-tip')) {
      sessionStorage.setItem('planner-iphone-tip', '1')
      toast('For true full screen on iPhone: tap Share, Add to Home Screen, then open the planner from that icon.', 'info')
    }
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    }
  }, [onClose])

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
      // A Map ID unlocks heading-up rotation and tilt; styling then lives in the Cloud console, so no inline styles.
      ...(MAP_ID
        ? { mapId: MAP_ID }
        : {
          styles: [
            { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
          ],
        }),
    })

    mapRef.current = map

    // Dragging the map hands control back to the driver for a moment.
    map.addListener('dragstart', () => holdFollowOff(FOLLOW_RESUME_MS))
    // Pinching, the wheel or the zoom buttons pause automatic zoom for a while.
    const container = mapContainerRef.current
    const holdZoom = () => { userZoomUntilRef.current = Date.now() + USER_ZOOM_HOLD_MS }
    container.addEventListener('wheel', holdZoom, { passive: true })
    container.addEventListener('touchstart', event => { if (event.touches.length > 1) holdZoom() }, { passive: true })
    container.addEventListener('pointerdown', event => { if ((event.target as HTMLElement).closest('button[title*="oom"]')) holdZoom() })

    // Traffic layer
    const traffic = new google.maps.TrafficLayer()
    if (trafficOn) traffic.setMap(map)
    trafficLayerRef.current = traffic

    // The route is drawn by hand (not DirectionsRenderer) so the part already driven can be greyed out.
    routeCasingRef.current = new google.maps.Polyline({ map, strokeColor: '#FFFFFF', strokeWeight: 9, strokeOpacity: 0.95, zIndex: 1 })
    routeLineRef.current = new google.maps.Polyline({ map, strokeColor: '#F59E0B', strokeWeight: 5.5, strokeOpacity: 1, zIndex: 2 })
    traveledLineRef.current = new google.maps.Polyline({ map, strokeColor: '#9CA3AF', strokeWeight: 5.5, strokeOpacity: 0.95, zIndex: 3 })

    setMapReady(true)
  }, [holdFollowOff])

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
  // With `from`, the route starts at the driver's position and runs through the stops not yet reached.
  const requestRoute = async (from: Point | null, startIndex: number, avoid: Point[] = []): Promise<BuiltRoute | null> => {
    if (!window.google) return null
    const valid = stopsRef.current.filter(s => s.address && s.address.trim().length > 0)
    const targets = from ? valid.slice(startIndex) : valid
    if (targets.length < (from ? 1 : 2)) return null

    const asLocation = (stop: NavStop): string | google.maps.LatLngLiteral =>
      stop.lat && stop.lng ? { lat: stop.lat, lng: stop.lng } : stop.address
    const rest = from ? targets : targets.slice(1)
    const departure = !from && departureTime && new Date(departureTime).getTime() > Date.now() ? new Date(departureTime) : new Date()
    const service = new google.maps.DirectionsService()
    const drivingOptions = { departureTime: departure, trafficModel: google.maps.TrafficModel.BEST_GUESS }

    // A reported closure: ask for alternatives to the next stop and take the first that stays clear of it.
    if (from && avoid.length > 0) {
      const first = targets[0]!
      const alternatives = await service.route({ origin: from, destination: asLocation(first), provideRouteAlternatives: true, travelMode: google.maps.TravelMode.DRIVING, drivingOptions })
      const paths = alternatives.routes.map(route => route.legs.flatMap(leg => leg.steps.flatMap(step => step.path.map(point => ({ lat: point.lat(), lng: point.lng() })))))
      const index = pickAvoidingRoute(paths, avoid)
      if (index >= 0) {
        const chosen = alternatives.routes[index]!
        const later = targets.slice(1)
        const onward = later.length > 0
          ? await service.route({
            origin: asLocation(first),
            destination: asLocation(later[later.length - 1]!),
            waypoints: later.slice(0, -1).map(stop => ({ location: asLocation(stop), stopover: true })),
            optimizeWaypoints: false,
            travelMode: google.maps.TravelMode.DRIVING,
            drivingOptions,
          })
          : null
        const legs = [chosen.legs[0]!, ...(onward?.routes[0]?.legs ?? [])]
        return { result: { ...alternatives, routes: [{ ...chosen, legs }] }, valid, legBase: startIndex, fromHere: true, avoided: true }
      }
    }

    const result = await service.route({
      origin: from ?? asLocation(targets[0]!),
      destination: asLocation(rest[rest.length - 1]!),
      waypoints: rest.slice(0, -1).map(stop => ({ location: asLocation(stop), stopover: true })),
      optimizeWaypoints: false, // Already optimized by our engine
      travelMode: google.maps.TravelMode.DRIVING,
      drivingOptions,
    })
    return { result, valid, legBase: from ? startIndex : 1, fromHere: Boolean(from), ...(from && avoid.length > 0 ? { avoided: false } : {}) }
  }

  const applyRoute = ({ result, valid, legBase, fromHere }: BuiltRoute, { silent = false }: { silent?: boolean } = {}) => {
    const legs = result.routes[0]?.legs || []
    if (!legs.length) return

    const segments: RouteSegment[] = legs.map(leg => ({
      distance: leg.distance?.text || '',
      duration: leg.duration_in_traffic?.text || leg.duration?.text || '',
      steps: leg.steps || [],
    }))
    setRouteSegments(segments)
    routeSegmentsRef.current = segments
    stepIndexRef.current = 0
    projHintRef.current = 0
    traveledIndexRef.current = -1

    const plan = buildRoutePlan(
      legs.map(leg => ({
        durationSeconds: legSeconds(leg),
        steps: (leg.steps || []).map(step => ({ points: (step.path || []).map(point => ({ lat: point.lat(), lng: point.lng() })) })),
      })),
    )
    planRef.current = plan
    simPathRef.current = plan
    routeLineRef.current?.setPath(plan.points)
    routeCasingRef.current?.setPath(plan.points)
    traveledLineRef.current?.setPath([])
    if (simRef.current) {
      simRef.current.meters = 0
      simRef.current.pausedUntil = Date.now() + 1500
      simRef.current.pending = false
      simRef.current.detourUntil = 0
    }

    let totalDist = 0
    let totalDur = 0
    const summaries = legs.map((leg, i) => {
      totalDist += leg.distance?.value || 0
      totalDur += legSeconds(leg)
      return {
        distance: leg.distance?.text || '',
        duration: leg.duration_in_traffic?.text || leg.duration?.text || '',
        from: i === 0 && fromHere ? 'Your position' : valid[legBase + i - 1]?.address || '',
        to: valid[legBase + i]?.address || '',
        toIndex: legBase + i,
      }
    })
    setLegSummaries(summaries)
    progressRef.current = { remainingMeters: totalDist, remainingSeconds: totalDur }

    if (fromHere) {
      // Re-routing keeps the planned totals and the stops already driven; only the road ahead changes.
      setNavState(prev => ({
        ...prev,
        currentLeg: 0,
        totalDistanceRemaining: `${(totalDist / 1609.34).toFixed(1)} mi`,
        totalDurationRemaining: formatDuration(totalDur),
        eta: new Date(Date.now() + totalDur * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      }))
    } else {
      setTotalDistance(plannedDistance !== undefined ? `${plannedDistance.toFixed(1)} mi` : `${(totalDist / 1609.34).toFixed(1)} mi`)
      setTotalDuration(plannedDurationMinutes !== undefined ? formatDuration(plannedDurationMinutes * 60) : formatDuration(totalDur))
      const eta = plannedEndTime ? new Date(plannedEndTime) : new Date(Date.now() + totalDur * 1000)
      setNavState(prev => ({
        ...prev,
        totalDistanceRemaining: `${(totalDist / 1609.34).toFixed(1)} mi`,
        totalDurationRemaining: formatDuration(totalDur),
        eta: eta.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      }))
    }

    // Stops keep the coordinates Google resolved for them; re-routing only refreshes the ones still ahead.
    const resolved = fromHere && resolvedStopsRef.current.length === valid.length ? [...resolvedStopsRef.current] : valid.map(stop => ({ ...stop }))
    if (!fromHere && legs[0]?.start_location) resolved[0] = { ...valid[0]!, lat: legs[0].start_location.lat(), lng: legs[0].start_location.lng() }
    legs.forEach((leg, i) => {
      const index = legBase + i
      if (valid[index] && leg.end_location) resolved[index] = { ...valid[index]!, lat: leg.end_location.lat(), lng: leg.end_location.lng() }
    })
    resolvedStopsRef.current = resolved
    placeMarkers(resolved)
    setRouteLoaded(true)
    setFasterRoute(null)

    if (!fromHere && mapRef.current && result.routes[0]?.bounds && !navStateRef.current.isNavigating) {
      mapRef.current.fitBounds(result.routes[0].bounds, 60)
    }

    if (!silent && segments[0]?.steps[0]) {
      const firstStep = segments[0].steps[0]
      setNavState(prev => ({
        ...prev,
        nextInstruction: stripHtml(firstStep.instructions),
        maneuver: parseManeuver(firstStep.maneuver, stripHtml(firstStep.instructions)),
        distanceRemaining: segments[0]!.distance,
        durationRemaining: segments[0]!.duration,
      }))
    }
  }

  const buildRoute = useCallback(async () => {
    const stops = stopsRef.current
    if (!mapRef.current || !window.google || stops.length < 2) return

    try {
      const built = await requestRoute(null, 1)
      if (built) applyRoute(built)
    } catch (err: any) {
      console.error('Directions error:', err)
      toast('Could not calculate route — check addresses', 'error')
      // Fallback: place markers and draw polyline
      const validStops = stops.filter(s => s.address && s.address.trim().length > 0)
      planRef.current = null
      simPathRef.current = null
      resolvedStopsRef.current = validStops
      placeMarkers(validStops)
      drawFallbackPolyline(validStops)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Info window: the same details the stop strip shows, escaped because addresses are user text.
      const details = navStopDetails(stop, idx, stopsToMark, isCompleted)
      const infoContent = `
        <div style="font-family:system-ui;max-width:260px;">
          <p style="font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#008c82;margin:0;">${escapeHtml(tag ? `${tag} · ${details.kind}` : details.kind)}</p>
          <p style="font-weight:600;margin:2px 0 6px;">${escapeHtml(details.title)}</p>
          ${details.rows.map(row => `<p style="font-size:12px;margin:2px 0;"><span style="color:#6b807e;">${escapeHtml(row.label)}:</span> ${escapeHtml(row.value)}</p>`).join('')}
          ${details.warning ? `<p style="font-size:12px;margin:6px 0 0;padding:6px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;">${escapeHtml(details.warning)}</p>` : ''}
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

  const spokenDistance = (meters: number): string => {
    if (meters < 305) return `${Math.max(50, Math.round((meters * 3.28084) / 50) * 50)} feet`
    const miles = meters / 1609.344
    return miles < 1 ? `${(Math.round(miles * 4) / 4).toFixed(2).replace(/0$/, '')} miles` : `${miles.toFixed(1)} miles`
  }

  // Turns a position along the route into guidance: the next maneuver, what follows it, remaining distance and time.
  // Returns the metres to the next maneuver, which also drives the zoom level.
  const updateGuidance = useCallback((along: number, speedMps: number | null): number | null => {
    const plan = planRef.current
    const nav = navStateRef.current
    const steps = routeSegmentsRef.current[nav.currentLeg]?.steps
    if (!plan || !steps?.length) return null

    const ends = plan.stepEnds[nav.currentLeg] ?? []
    let idx = ends.findIndex(end => end > along + 0.5)
    if (idx === -1) idx = ends.length - 1
    idx = Math.min(Math.max(0, idx), steps.length - 1)
    if (idx !== stepIndexRef.current) stepIndexRef.current = idx

    const metersToManeuver = Math.max(0, (ends[idx] ?? along) - along)
    const upcoming = steps[idx + 1]
    const instruction = upcoming ? htmlToText(upcoming.instructions) : 'Arrive at your stop'
    const maneuver: ManeuverView = upcoming ? parseManeuver(upcoming.maneuver, instruction) : { glyph: 'arrive', side: null }
    const afterwards = steps[idx + 2]
    const then = afterwards ? htmlToText(afterwards.instructions) : ''
    const distance = describeDistance(metersToManeuver)

    const legStart = nav.currentLeg === 0 ? 0 : plan.legEnds[nav.currentLeg - 1] ?? 0
    const legEnd = plan.legEnds[nav.currentLeg] ?? plan.total
    const legFraction = Math.min(1, Math.max(0, (legEnd - along) / Math.max(1, legEnd - legStart)))
    const legSecondsLeft = legFraction * (plan.legDurations[nav.currentLeg] ?? 0)
    const progress = progressAlong(plan, along)
    progressRef.current = { remainingMeters: progress.remainingMeters, remainingSeconds: progress.remainingSeconds }

    // Heads-up before the turn, once per maneuver and distance band. Fast-forwarded simulations stay quiet.
    if ((simRef.current?.speed ?? 1) <= 1) {
      const key = `${steps[idx]!.end_location.lat().toFixed(5)},${steps[idx]!.end_location.lng().toFixed(5)}`
      const farAt = (speedMps ?? 0) > 20 ? 1600 : (speedMps ?? 0) > 11 ? 800 : 450
      const stepLength = (ends[idx] ?? 0) - (idx === 0 ? legStart : ends[idx - 1] ?? 0)
      const band = metersToManeuver <= 220 ? 'near' : metersToManeuver <= farAt && stepLength > farAt * 1.2 ? 'far' : null
      if (band && !announcedRef.current.has(`${key}|${band}`)) {
        announcedRef.current.add(`${key}|${band}`)
        const spoken = instruction.charAt(0).toLowerCase() + instruction.slice(1)
        speakRef.current(upcoming ? `In ${spokenDistance(metersToManeuver)}, ${spoken}` : 'You are arriving at your stop')
      }
    }

    const remainingMiles = `${(progress.remainingMeters / 1609.34).toFixed(1)} mi`
    const remainingTime = formatDuration(progress.remainingSeconds)
    const eta = new Date(Date.now() + progress.remainingSeconds * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const legTime = formatDuration(legSecondsLeft)

    setNavState(prev =>
      prev.nextInstruction === instruction &&
      prev.distanceRemaining === distance &&
      prev.durationRemaining === legTime &&
      prev.thenInstruction === then &&
      prev.totalDistanceRemaining === remainingMiles &&
      prev.totalDurationRemaining === remainingTime &&
      prev.eta === eta &&
      prev.maneuver?.glyph === maneuver.glyph &&
      prev.maneuver?.side === maneuver.side
        ? prev
        : {
          ...prev,
          nextInstruction: instruction,
          distanceRemaining: distance,
          durationRemaining: legTime,
          thenInstruction: then,
          maneuver,
          totalDistanceRemaining: remainingMiles,
          totalDurationRemaining: remainingTime,
          eta,
        }
    )
    return metersToManeuver
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Single entry point for a driver position, whether it came from real GPS or the simulator.
  const applyPosition = useCallback((
    rawPos: Point,
    reportedHeading: number | null,
    extra: { speedMps?: number | null; accuracyMeters?: number | null; simulated?: boolean } = {},
  ) => {
    const nav = navStateRef.current
    const plan = planRef.current
    const map = mapRef.current
    const now = Date.now()
    const accuracy = extra.accuracyMeters ?? null

    // Some browsers never report speed, so fall back to distance over time between fixes.
    let speed = extra.speedMps ?? null
    const previousFix = lastFixTimeRef.current
    if (speed === null && previousFix && now - previousFix.at > 0 && now - previousFix.at < 10_000) {
      speed = metersBetween(previousFix.pos, rawPos) / ((now - previousFix.at) / 1000)
    }
    lastFixTimeRef.current = { pos: rawPos, at: now }

    const moved = headingFromMovement(lastRawRef.current, rawPos)
    if (!lastRawRef.current || moved !== null) lastRawRef.current = rawPos

    // Where the driver is on the planned route, so the marker sits on the road and progress is exact.
    let pos = rawPos
    let along: number | null = null
    let distanceFromPath = 0
    if (plan && nav.isNavigating) {
      const projection = projectOnPath(plan, rawPos, projHintRef.current)
      if (projection) {
        projHintRef.current = projection.index
        along = projection.alongMeters
        distanceFromPath = projection.distanceFromPath
        if (projection.distanceFromPath <= Math.max(30, accuracy ?? 0)) pos = projection.snapped
        if (projection.index !== traveledIndexRef.current) {
          traveledIndexRef.current = projection.index
          traveledLineRef.current?.setPath([...plan.points.slice(0, projection.index + 1), projection.snapped])
        }
      }
    }
    setCurrentDriverPos(pos)

    // The camera loop animates the marker and the map; this only tells it where the car is and which way the road points.
    const speedValue = speed ?? 0
    const onRoute = along !== null && distanceFromPath <= Math.max(30, accuracy ?? 0)
    if (speedValue > 1) {
      const roadHeading = onRoute && plan && along !== null ? routeHeadingAt(plan, along) : null
      headingTargetRef.current = roadHeading ?? reportedHeading ?? moved ?? headingTargetRef.current
    }
    const heading = headingTargetRef.current
    fixStateRef.current = { pos, along: onRoute ? along : null, speed: extra.simulated ? 0 : speedValue, heading, at: now }

    if (!driverMarkerRef.current && map) {
      driverMarkerRef.current = new google.maps.Marker({
        position: pos,
        map,
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
    }

    let metersToManeuver: number | null = null
    alongRef.current = onRoute ? along : null
    if (along !== null) {
      metersToManeuver = updateGuidance(along, speed)

      // A single stray fix never counts: the detector needs several, or one clear departure.
      // Standing still or parking at a stop says nothing about the route, so those fixes leave the state alone.
      const target = resolvedStopsRef.current[nav.currentStopIndex]
      const atStop = isPoint(target) && metersBetween(rawPos, target) < arrivalRadius(target.type)
      const moving = speed === null || speed > 2
      if (moving && !atStop) {
        const state = offRouteDetectorRef.current.update({ distanceFromPath, accuracyMeters: accuracy, at: now })
        if (state !== offRouteStateRef.current) {
          offRouteStateRef.current = state
          if (state === 'on') setRerouteFailed(false)
        }
        offRouteHandlerRef.current(rawPos, distanceFromPath, speed, now, state)
      } else {
        offRouteDetectorRef.current.reset()
      }
    }

    // Suggest "you have arrived" once the driver has been inside the stop's zone and slow for a few seconds.
    if (nav.isNavigating && !extra.simulated) {
      const target = resolvedStopsRef.current[nav.currentStopIndex]
      if (isPoint(target)) {
        const check = checkArrival({ lat: rawPos.lat, lng: rawPos.lng, accuracyMeters: accuracy }, target, arrivalRadius(target.type))
        const ready = arrivalWatcherRef.current.update({ inside: check.verdict === 'verified', speedMps: speed, at: now })
        if (ready && suggestedForRef.current !== nav.currentStopIndex) {
          suggestedForRef.current = nav.currentStopIndex
          setArrivalSuggestion(nav.currentStopIndex)
          speakRef.current('You have arrived. Confirm when you are ready.')
        }
      }
    }

    if (nav.isNavigating) {
      const mph = speed === null ? null : Math.round(speed * 2.23694)
      const acc = accuracy === null ? null : Math.round(accuracy)
      setLiveStats(prev => (prev.speedMph === mph && prev.accuracy === acc ? prev : { speedMph: mph, accuracy: acc }))
    }

    // Zoom for what the driver needs to read; the governor stops speed wobble from pumping the map in and out.
    zoomTargetRef.current = zoomGovernorRef.current.update(
      nav.isNavigating ? adaptiveZoom({ speedMps: speedValue, metersToManeuver }) : 16,
      now,
    )

    const fix: DriverFix = {
      lat: rawPos.lat,
      lng: rawPos.lng,
      heading: reportedHeading ?? moved,
      speedMps: extra.speedMps ?? null,
      accuracyMeters: accuracy,
      at: now,
      simulated: extra.simulated === true,
    }
    latestFixRef.current = fix
    onPositionRef.current?.(fix)
  }, [updateGuidance])

  // One animation loop moves the marker and the camera together, so the car stays put on screen while the map turns under it.
  useEffect(() => {
    if (!mapReady || !mapContainerRef.current) return
    const container = mapContainerRef.current
    viewportHeightRef.current = container.clientHeight || 600
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { viewportHeightRef.current = container.clientHeight || 600 }) : null
    observer?.observe(container)

    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const dt = now - last
      if (dt < FRAME_MS) return
      last = now

      const map = mapRef.current
      const marker = driverMarkerRef.current
      const fix = fixStateRef.current
      if (!map || !marker || !fix) return

      // Between one-second GPS fixes, keep moving along the road at the last known speed.
      const plan = planRef.current
      let predicted: Point = fix.pos
      if (fix.speed > 1) {
        const ahead = (fix.speed * Math.min(Date.now() - fix.at, MAX_PREDICT_MS)) / 1000
        const onPlan = fix.along !== null && plan ? positionAt(plan, fix.along + ahead) : null
        predicted = onPlan ?? (fix.heading !== null ? offsetAhead(fix.pos, fix.heading, ahead) : fix.pos)
      }

      const heading = fix.heading ?? cameraRef.current?.heading ?? 0
      const target: CameraState = { lat: predicted.lat, lng: predicted.lng, heading, zoom: zoomTargetRef.current }
      const zoomHeld = Date.now() < userZoomUntilRef.current
      const previous = cameraRef.current ?? target
      const next = stepCamera(zoomHeld ? { ...previous, zoom: map.getZoom() ?? previous.zoom } : previous, target, Math.min(dt, 200))
      cameraRef.current = next
      marker.setPosition({ lat: next.lat, lng: next.lng })

      const mapHeading = MAP_ID ? map.getHeading() ?? 0 : 0
      const rotation = Math.round(((next.heading - mapHeading) % 360 + 360) % 360)
      const icon = marker.getIcon() as google.maps.Symbol | null
      if (icon && Math.abs(((icon.rotation ?? 0) - rotation + 540) % 360 - 180) >= 2) {
        icon.rotation = rotation
        marker.setIcon(icon)
      }

      if (followRef.current && navStateRef.current.isNavigating) {
        const zoom = zoomHeld ? map.getZoom() ?? next.zoom : next.zoom
        const ahead = metersPerPixel(next.lat, zoom) * viewportHeightRef.current * (MAP_ID ? 0.18 : 0.1)
        map.moveCamera({
          center: offsetAhead(next, next.heading, ahead),
          ...(zoomHeld ? {} : { zoom: MAP_ID ? zoom : Math.round(zoom) }),
          ...(MAP_ID ? { heading: next.heading, tilt: 45 } : {}),
        })
      }
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [mapReady])

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
    if (position) {
      // The detour demo reports a position well off the road, as if the driver missed a turn.
      const detouring = Date.now() < sim.detourUntil
      const reported = detouring ? offsetAhead(position, (position.heading + 90) % 360, SIM_DETOUR_METERS) : position
      applyPosition(reported, position.heading, { speedMps: SIM_BASE_METERS_PER_SECOND * sim.speed, simulated: true })
    }
    if (arrived) {
      sim.pending = true
      sim.pausedUntil = Date.now() + SIM_STOP_PAUSE_MS
    }
  }, [applyPosition, stopSimulation])

  const setSimulationSpeed = (speed: number) => {
    if (simRef.current) simRef.current.speed = speed
    setSimulation({ speed })
  }

  const simulateDetour = () => {
    if (simRef.current) simRef.current.detourUntil = Date.now() + SIM_DETOUR_MS
    toast('Simulated wrong turn. Watch the off-route alert and the recalculation.', 'info')
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
  const resetGuidance = () => {
    stepIndexRef.current = 0
    projHintRef.current = 0
    traveledIndexRef.current = -1
    announcedRef.current.clear()
    userZoomUntilRef.current = 0
    zoomGovernorRef.current.reset()
    cameraRef.current = null
    fixStateRef.current = null
    offRouteDetectorRef.current.reset()
    offRouteStateRef.current = 'on'
    arrivalWatcherRef.current.reset()
    suggestedForRef.current = null
    setRerouteFailed(false)
    setFasterRoute(null)
    setArrivalPrompt(null)
    setArrivalSuggestion(null)
    deviationRef.current = null
    breakUntilRef.current = null
    closuresRef.current = []
    setDeviation(null)
    setBreakMode(false)
    traveledLineRef.current?.setPath([])
  }

  const beginNavState = () => {
    resetGuidance()
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

    simRef.current = { speed: 10, meters: 0, pausedUntil: 0, pending: false, detourUntil: 0 }
    setSimulation({ speed: 10 })
    applyPosition(first, first.heading, { speedMps: SIM_BASE_METERS_PER_SECOND * 10, simulated: true })
    if (simTimerRef.current) clearInterval(simTimerRef.current)
    simTimerRef.current = setInterval(tickSimulation, SIM_TICK_MS)
    toast('Simulated drive started. This is not real GPS.', 'info')
  }

  // Google Maps links hold only a few stops, so a long route is split into parts that chain end to start.
  const openInGoogleMaps = () => {
    const route = resolvedStopsRef.current.length ? resolvedStopsRef.current : stops
    const navigating = navState.isNavigating
    const mobile = isMobileBrowser(navigator.userAgent)
    const from = navigating ? navState.currentStopIndex : route.length > 1 ? 1 : 0
    const targets = route.slice(from).map(stop => ({ address: stop.address, lat: stop.lat, lng: stop.lng, label: stop.label }))
    // Phones start from the device's own location; a computer needs an explicit start.
    const origin = navigating
      ? currentDriverPos ? { address: '', lat: currentDriverPos.lat, lng: currentDriverPos.lng } : null
      : !mobile && route.length > 1 ? { address: route[0]!.address, lat: route[0]!.lat, lng: route[0]!.lng } : null

    const parts = googleMapsRouteParts(targets, { maxWaypoints: mobile ? MOBILE_WAYPOINT_LIMIT : DESKTOP_WAYPOINT_LIMIT, origin })
    if (parts.length === 0) {
      toast('No stops left to navigate to', 'info')
      return
    }
    if (parts.length === 1) {
      window.open(parts[0]!.url, '_blank', 'noopener')
      return
    }
    setExportParts(parts)
  }

  const stopNavigation = () => {
    stopSimulation()
    setNavState(prev => ({
      ...prev,
      isNavigating: false,
    }))
    stopGPSTracking()
    setArrivalPrompt(null)
    setArrivalSuggestion(null)
    setFasterRoute(null)
    finishDeviation('still_off')
    endBreak()
    closuresRef.current = []
    mapRef.current?.setTilt(0)
    mapRef.current?.setHeading(0)
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    toast('Navigation stopped', 'info')
  }

  // Handlers run outside state updaters so a double-invoked updater can never record a stop twice.
  const markStopCompleted = (idx: number, arrival?: ArrivalReport) => {
    const prev = navStateRef.current
    if (prev.completedStops.includes(idx)) return
    stepIndexRef.current = 0
    projHintRef.current = 0
    arrivalWatcherRef.current.reset()
    setArrivalPrompt(null)
    setArrivalSuggestion(null)
    // Reaching a stop closes any open departure from the route.
    finishDeviation('returned')
    endBreak()

    const completed = [...prev.completedStops, idx]
    const nextLeg = Math.min(prev.currentLeg + 1, routeSegments.length - 1)
    const nextStop = idx + 1
    const recordProgress = !simRef.current // A simulated drive never writes real progress.

    if (recordProgress) onStopReached?.(idx, arrival)

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

  // "Arrived" or "Done": the driver's position is checked against the approved stop before it is recorded.
  // Outside the zone, a reason is required, and it is stored with the stop for the dispatcher.
  const requestStopCompletion = (idx: number) => {
    if (simRef.current) {
      markStopCompleted(idx)
      return
    }
    const stop = stops[idx]
    const resolved = resolvedStopsRef.current[idx]
    const target = isPoint(resolved) ? { lat: resolved.lat, lng: resolved.lng } : null
    const radius = arrivalRadius(stop?.type ?? 'stop')
    const latest = latestFixRef.current
    const fix = latest && !latest.simulated && Date.now() - latest.at < FIX_FRESH_MS ? latest : null
    const check = checkArrival(fix ? { lat: fix.lat, lng: fix.lng, accuracyMeters: fix.accuracyMeters } : null, target, radius)

    if (check.verdict === 'verified' || check.verdict === 'unknown_target') {
      markStopCompleted(idx, target ? { target, radiusMeters: radius, fix: fix ? { lat: fix.lat, lng: fix.lng, accuracyMeters: fix.accuracyMeters } : null } : undefined)
      return
    }
    setOverrideCode('')
    setOverrideNote('')
    setArrivalPrompt({ idx, check })
  }

  const confirmArrivalPrompt = () => {
    if (!arrivalPrompt) return
    const { idx, check } = arrivalPrompt
    const resolved = resolvedStopsRef.current[idx]
    if (!isPoint(resolved)) return
    const latest = latestFixRef.current
    const fix = latest && !latest.simulated && Date.now() - latest.at < FIX_FRESH_MS ? latest : null
    markStopCompleted(idx, {
      target: { lat: resolved.lat, lng: resolved.lng },
      radiusMeters: check.radiusMeters,
      fix: fix ? { lat: fix.lat, lng: fix.lng, accuracyMeters: fix.accuracyMeters } : null,
      ...(check.verdict === 'outside' && overrideCode ? { overrideCode } : {}),
      ...(check.verdict === 'outside' && overrideCode && overrideNote.trim() ? { overrideNote: overrideNote.trim() } : {}),
    })
  }

  const resetGuidanceAfterReroute = () => {
    offRouteDetectorRef.current.reset()
    offRouteStateRef.current = 'on'
    setRerouteFailed(false)
  }

  // Every departure from the planned route is recorded with its reason, so a dispatcher can tell a closed road from a lunch stop.
  const emitDeviation = (event: DeviationEvent) => {
    if (!simRef.current) onDeviationRef.current?.(event)
  }

  const startDeviation = (pos: Point, distance: number, now: number) => {
    const record = { id: crypto.randomUUID(), startedAt: now, reason: 'unspecified' as DeviationReason, maxDistance: distance, lat: pos.lat, lng: pos.lng }
    deviationRef.current = record
    setDeviation({ reason: record.reason, distance })
    emitDeviation({ id: record.id, startedAt: now, reason: record.reason, maxDistanceMeters: Math.round(distance), lat: pos.lat, lng: pos.lng })
    speakRef.current('You have left the planned route.')
    return record
  }

  const finishDeviation = (resolution: NonNullable<DeviationEvent['resolution']>, addedMinutes?: number) => {
    const record = deviationRef.current
    if (!record) return
    deviationRef.current = null
    setDeviation(null)
    emitDeviation({
      id: record.id,
      startedAt: record.startedAt,
      endedAt: Date.now(),
      reason: record.reason,
      resolution,
      maxDistanceMeters: Math.round(record.maxDistance),
      ...(addedMinutes !== undefined ? { addedMinutes } : {}),
      lat: record.lat,
      lng: record.lng,
    })
  }

  const setDeviationReason = (reason: DeviationReason) => {
    const record = deviationRef.current
    if (!record) return
    record.reason = reason
    setDeviation(current => (current ? { ...current, reason } : current))
    emitDeviation({ id: record.id, startedAt: record.startedAt, reason, maxDistanceMeters: Math.round(record.maxDistance), lat: record.lat, lng: record.lng })
  }

  const endBreak = () => {
    breakUntilRef.current = null
    setBreakMode(false)
  }

  // Called for each confirmed fix while the car is moving: decides whether to wait, hold, or rebuild the route.
  offRouteHandlerRef.current = (pos, distance, speed, now, state) => {
    if (state === 'off') {
      const record = deviationRef.current ?? startDeviation(pos, distance, now)
      record.maxDistance = Math.max(record.maxDistance, distance)
      setDeviation(current => (current && Math.abs(current.distance - distance) < 50 ? current : { reason: record.reason, distance }))
      const action = decideOffRoute({ now, startedAt: record.startedAt, distanceMeters: distance, speedMps: speed, breakUntil: breakUntilRef.current, reason: record.reason })
      if (action === 'reroute') {
        const resuming = breakUntilRef.current !== null
        if (resuming) endBreak()
        void rerouteFromHere(pos, resuming ? 'resume' : 'off_route')
      }
      return
    }
    if (state === 'on' && deviationRef.current) {
      const wasBreak = breakUntilRef.current !== null
      if (wasBreak) endBreak()
      finishDeviation(wasBreak ? 'break_ended' : 'returned')
      toast('Back on the optimized route', 'success')
    }
  }

  // Re-routing keeps the same stops in the same order and recalculates only the road from where the driver is now.
  const rerouteFromHere = async (from: Point, reason: 'off_route' | 'faster' | 'blocked' | 'resume' = 'off_route') => {
    if (rerouteBusyRef.current || !navStateRef.current.isNavigating) return
    const now = Date.now()
    if (now - lastRerouteAtRef.current < REROUTE_COOLDOWN_MS) return
    lastRerouteAtRef.current = now
    rerouteBusyRef.current = true
    setRerouting(true)
    try {
      const built = await requestRoute(from, navStateRef.current.currentStopIndex, activeClosures(closuresRef.current, Date.now()))
      if (!built) throw new Error('No route found')

      if (reason === 'blocked' && built.avoided === false) {
        toast('No other road around the closure was found. The route is unchanged.', 'warning')
        speakRef.current('No way around the closure was found.')
        setRerouteFailed(false)
        if (offRouteStateRef.current !== 'off') finishDeviation('still_off')
        return
      }

      const legs = built.result.routes[0]?.legs ?? []
      const newSeconds = legs.reduce((sum, leg) => sum + legSeconds(leg), 0)
      const detour = describeDetour(newSeconds, progressRef.current.remainingSeconds)
      const addedMinutes = Math.round((newSeconds - progressRef.current.remainingSeconds) / 60)
      applyRoute(built)
      resetGuidanceAfterReroute()

      if (reason === 'faster') {
        speakRef.current('Switched to the faster route.')
        toast('Switched to the faster route', 'success')
      } else {
        const lead = reason === 'blocked' ? 'Found a way around the closure' : 'New route found'
        speakRef.current(`${lead}. It ${detour.replace(/ min$/, ' minutes')}.`)
        toast(`${lead}: ${detour}`, 'success')
        finishDeviation(reason === 'resume' ? 'break_ended' : 'rerouted', addedMinutes)
      }
    } catch (error) {
      console.error('Re-route failed:', error)
      setRerouteFailed(true)
    } finally {
      rerouteBusyRef.current = false
      setRerouting(false)
    }
  }
  rerouteRef.current = (from: Point) => rerouteFromHere(from)

  const recalculateNow = (reason: 'off_route' | 'faster' | 'blocked' | 'resume' = 'off_route') => {
    const latest = latestFixRef.current
    if (!latest) return
    lastRerouteAtRef.current = 0
    void rerouteFromHere({ lat: latest.lat, lng: latest.lng }, reason)
  }

  // "Personal stop": the driver is choosing to go elsewhere for a while, so guidance and alerts pause instead of nagging.
  const startBreak = () => {
    if (!deviationRef.current) return
    breakUntilRef.current = Date.now() + BREAK_MAX_MS
    setBreakMode(true)
    setDeviationReason('personal_stop')
    speakRef.current('Guidance paused for your stop.')
  }

  const resumeFromBreak = () => {
    endBreak()
    recalculateNow('resume')
  }

  // "Road blocked": remembers the closure ahead and finds another way to the next stop that avoids it.
  const reportBlocked = () => {
    const latest = latestFixRef.current
    const fix = fixStateRef.current
    if (!latest || !fix) {
      toast('Waiting for a GPS position', 'warning')
      return
    }
    const plan = planRef.current
    const along = alongRef.current
    const ahead = along !== null && plan ? positionAt(plan, along + 300) : null
    const point: Point = ahead ?? offsetAhead({ lat: latest.lat, lng: latest.lng }, fix.heading ?? 0, 300)
    closuresRef.current = [...closuresRef.current, { point, until: Date.now() + CLOSURE_MS }]
    if (breakUntilRef.current !== null) endBreak()
    if (!deviationRef.current) startDeviation({ lat: latest.lat, lng: latest.lng }, 0, Date.now())
    setDeviationReason('road_blocked')
    recalculateNow('blocked')
  }

  // Every few minutes, check whether traffic made a quicker way. Nothing changes unless the driver accepts.
  refreshRef.current = async () => {
    const nav = navStateRef.current
    const latest = latestFixRef.current
    if (!nav.isNavigating || simRef.current || rerouteBusyRef.current || offRouteStateRef.current !== 'on' || document.hidden) return
    if (!latest || latest.simulated || Date.now() - latest.at > FIX_FRESH_MS) return
    try {
      const built = await requestRoute({ lat: latest.lat, lng: latest.lng }, nav.currentStopIndex, activeClosures(closuresRef.current, Date.now()))
      const legs = built?.result.routes[0]?.legs ?? []
      if (!built || legs.length === 0 || !navStateRef.current.isNavigating) return
      const newSeconds = legs.reduce((sum, leg) => sum + legSeconds(leg), 0)
      const newMeters = legs.reduce((sum, leg) => sum + (leg.distance?.value ?? 0), 0)
      const { remainingSeconds, remainingMeters } = progressRef.current
      const saved = remainingSeconds - newSeconds
      if (saved >= FASTER_ROUTE_MIN_SECONDS && newSeconds < remainingSeconds * 0.9) {
        setFasterRoute({ minutes: Math.round(saved / 60) })
      } else if (remainingMeters > 0 && Math.abs(newMeters - remainingMeters) / remainingMeters < 0.03) {
        // Same road, fresher traffic: update the times without touching what the driver sees.
        applyRoute(built, { silent: true })
      }
    } catch {
      // A failed refresh just means the current route keeps going.
    }
  }

  useEffect(() => {
    if (!navState.isNavigating) return
    const timer = setInterval(() => { void refreshRef.current() }, TRAFFIC_REFRESH_MS)
    return () => clearInterval(timer)
  }, [navState.isNavigating])

  // Fly the map to a stop picked on the strip, and stop following the car so it stays there.
  const focusStop = (index: number) => {
    const resolved = resolvedStopsRef.current[index] ?? stops[index]
    if (!mapRef.current || !isPoint(resolved)) return
    if (navStateRef.current.isNavigating) holdFollowOff(20_000)
    else setFollow(false)
    mapRef.current.panTo({ lat: resolved.lat, lng: resolved.lng })
    mapRef.current.setZoom(15)
  }

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
    if (voiceEnabled) speak('Route updated from your position.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopsKey])

  // Re-plan reorders the stops still ahead (and may change what comes next); re-route keeps the order and only fixes the road.
  const replan = async () => {
    if (!onReoptimize || replanning) return
    setReplanning(true)
    try {
      const summary = await onReoptimize()
      toast(summary || 'Route re-planned from your position', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not re-plan the route', 'error')
    } finally {
      setReplanning(false)
    }
  }

  // Nudge to re-plan once the stop being driven to is well past its expected time.
  const [clock, setClock] = useState(() => Date.now())
  useEffect(() => {
    if (!navState.isNavigating) return
    const timer = setInterval(() => setClock(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [navState.isNavigating])
  const expectedAt = navState.isNavigating ? stops[navState.currentStopIndex]?.estimatedArrival : undefined
  const minutesBehind = expectedAt ? Math.round((clock - new Date(expectedAt).getTime()) / 60_000) : 0
  const behindSchedule = Boolean(onReoptimize) && !simulation && minutesBehind >= 15

  // ── Recenter Map ─────────────────────────────────────────────────
  const recenterMap = () => {
    if (!mapRef.current) return
    setFollow(true)
    userZoomUntilRef.current = 0
    // While driving the camera loop takes the map back to the car by itself.
    if (navStateRef.current.isNavigating && fixStateRef.current) return
    if (currentDriverPos) {
      mapRef.current.panTo(currentDriverPos)
      mapRef.current.setZoom(16)
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setCurrentDriverPos(loc)
          mapRef.current?.panTo(loc)
          mapRef.current?.setZoom(16)
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
        className={`w-full ${isFullscreen ? 'h-full' : height} ${onClose ? '' : 'rounded-lg border border-gray-200'} overflow-hidden`}
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
              className={`absolute z-10 ${exitAction ? 'right-[5.5rem]' : 'right-3'}`}
              style={{ top: 'calc(0.75rem + env(safe-area-inset-top))', left: 'calc(0.75rem + env(safe-area-inset-left))', ...(exitAction ? {} : { right: 'calc(0.75rem + env(safe-area-inset-right))' }) }}
            >
              {/* Navigation Instruction Banner */}
              {navState.isNavigating && navState.nextInstruction && (
                <div className="bg-gray-900 text-white rounded-lg px-3 py-3 mb-2 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-white/10">
                      <ManeuverIcon view={navState.maneuver} className="h-9 w-9 text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-2xl font-bold leading-none tabular-nums">{navState.distanceRemaining}</p>
                      <p className="mt-1 text-sm font-medium leading-snug">{navState.nextInstruction}</p>
                      <p className="mt-1 text-xs text-gray-300">{navState.durationRemaining} to this stop</p>
                    </div>
                  </div>
                  {navState.thenInstruction && (
                    <p className="mt-2 truncate border-t border-white/10 pt-2 text-xs text-gray-300">Then: {navState.thenInstruction}</p>
                  )}
                </div>
              )}

              {/* Paused for a personal stop: no alerts, no rerouting, until the driver resumes or rejoins the route */}
              {navState.isNavigating && breakMode && (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2.5 text-white shadow-lg">
                  <Coffee className="h-5 w-5 shrink-0" />
                  <p className="min-w-0 flex-1 text-sm font-semibold">Guidance paused for your stop.{trackingStatus?.state === 'on' ? ' Your dispatcher can see this.' : ''}</p>
                  <button type="button" onClick={resumeFromBreak} className="h-9 shrink-0 rounded-md bg-white px-3 text-xs font-bold text-slate-800">Resume route</button>
                </div>
              )}

              {/* Off the optimized route: say so plainly, then let the driver say why instead of guessing */}
              {navState.isNavigating && !breakMode && deviation && (
                <div role="alert" className={`mb-2 rounded-lg px-3 py-2.5 text-white shadow-lg ${rerouting || rerouteFailed ? 'bg-red-600' : 'bg-amber-600'}`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    <p className="min-w-0 flex-1 text-sm font-semibold">
                      {rerouting
                        ? 'Recalculating your route...'
                        : rerouteFailed
                          ? `Could not recalculate. You are ${describeDistance(deviation.distance)} off the optimized route.`
                          : deviation.reason === 'road_blocked'
                            ? 'Closure noted. Looking for another way...'
                            : `You are ${describeDistance(deviation.distance)} off the optimized route. A new route follows if you keep going.`}
                      {!rerouting && trackingStatus?.state === 'on' ? ' Your dispatcher can see this.' : ''}
                    </p>
                  </div>
                  {!rerouting && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={() => recalculateNow()} className="h-9 rounded-md bg-white px-3 text-xs font-bold text-gray-900">{rerouteFailed ? 'Try again' : 'Recalculate now'}</button>
                      <button type="button" onClick={reportBlocked} className="h-9 rounded-md bg-white/20 px-3 text-xs font-bold">Road blocked</button>
                      <button type="button" onClick={startBreak} className="h-9 rounded-md bg-white/20 px-3 text-xs font-bold">Personal stop</button>
                    </div>
                  )}
                </div>
              )}

              {navState.isNavigating && !deviation && !breakMode && fasterRoute && (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-white shadow-lg">
                  <Zap className="h-5 w-5 shrink-0" />
                  <p className="min-w-0 flex-1 text-sm font-semibold">Faster route found: saves about {fasterRoute.minutes} min</p>
                  <button type="button" onClick={() => { setFasterRoute(null); recalculateNow('faster') }} className="h-9 shrink-0 rounded-md bg-white px-3 text-xs font-bold text-emerald-700">Switch</button>
                  <button type="button" onClick={() => setFasterRoute(null)} aria-label="Keep current route" className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-emerald-700"><X className="h-4 w-4" /></button>
                </div>
              )}

              {/* Behind-schedule nudge */}
              {navState.isNavigating && behindSchedule && !deviation && (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2.5 text-gray-900 shadow-lg">
                  <Clock className="h-5 w-5 shrink-0" />
                  <p className="min-w-0 flex-1 text-sm font-semibold">About {minutesBehind} min behind schedule for the next stop</p>
                  <button type="button" onClick={() => void replan()} disabled={replanning} className="h-9 shrink-0 rounded-md bg-gray-900 px-3 text-xs font-bold text-white disabled:opacity-50">
                    {replanning ? 'Re-planning...' : 'Re-plan'}
                  </button>
                </div>
              )}

              {/* Route Summary Bar */}
              <div className="bg-white/95 backdrop-blur rounded-lg px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Route className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold text-gray-900">{navState.isNavigating && navState.totalDistanceRemaining ? navState.totalDistanceRemaining : totalDistance}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span className="font-medium text-gray-700">{navState.isNavigating && navState.totalDurationRemaining ? navState.totalDurationRemaining : totalDuration}</span>
                  </div>
                  {navState.eta && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Target className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-gray-700">ETA {navState.eta}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {navState.isNavigating && liveStats.speedMph !== null && (
                    <span className="text-xs font-bold tabular-nums text-gray-900">{liveStats.speedMph} mph</span>
                  )}
                  {navState.isNavigating && !simulation && liveStats.accuracy !== null && (
                    <span className={`text-[11px] font-semibold ${liveStats.accuracy <= 25 ? 'text-green-600' : liveStats.accuracy <= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                      GPS {liveStats.accuracy <= 25 ? 'good' : liveStats.accuracy <= 75 ? 'fair' : 'weak'}
                    </span>
                  )}
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
            {onClose && fullscreenSupported && (
              <MapControlButton
                icon={deviceFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                title={deviceFullscreen ? 'Leave full screen' : 'Hide the browser bars'}
                onClick={() => void (deviceFullscreen ? exitFullscreen() : enterFullscreen())}
                active={deviceFullscreen}
              />
            )}
          </div>

          {/* ── Bottom Panel ────────────────────────────────────── */}
          <div
            className="absolute z-10"
            style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))', left: 'calc(0.75rem + env(safe-area-inset-left))', right: 'calc(0.75rem + env(safe-area-inset-right))' }}
          >
            {/* Back to the car after looking around the map */}
            {navState.isNavigating && !following && (
              <div className="mb-2 flex justify-end">
                <button type="button" onClick={recenterMap} className="flex h-11 items-center gap-2 rounded-full bg-gray-900 px-4 text-sm font-bold text-white shadow-lg ring-1 ring-white/30">
                  <Locate className="h-4 w-4 text-amber-400" />
                  Re-center
                </button>
              </div>
            )}

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
                  onClick={simulateDetour}
                  className="h-8 rounded-md bg-amber-400 px-2.5 text-xs font-bold text-gray-900"
                >
                  Wrong turn
                </button>
                <button
                  type="button"
                  onClick={stopNavigation}
                  className="h-8 rounded-md bg-violet-900 px-3 text-xs font-bold text-white"
                >
                  End
                </button>
              </div>
            )}

            {/* Auto-detected arrival: a suggestion only, the driver confirms */}
            {navState.isNavigating && !arrivalPrompt && arrivalSuggestion === navState.currentStopIndex && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2.5 text-white shadow-lg">
                <MapPin className="h-5 w-5 shrink-0" />
                <p className="min-w-0 flex-1 text-sm font-semibold">You are at {navStopLabel(stops[navState.currentStopIndex]!, navState.currentStopIndex, stops)}</p>
                <button type="button" onClick={() => requestStopCompletion(navState.currentStopIndex)} className="h-9 shrink-0 rounded-md bg-white px-3 text-xs font-bold text-green-700">Confirm arrival</button>
                <button type="button" onClick={() => setArrivalSuggestion(null)} aria-label="Dismiss" className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-green-700"><X className="h-4 w-4" /></button>
              </div>
            )}

            {/* Arrival check: shown when the driver is not at the approved stop */}
            {arrivalPrompt && (() => {
              const { idx, check } = arrivalPrompt
              const stop = stops[idx]
              const name = stop ? navStopLabel(stop, idx, stops) : 'this stop'
              const outside = check.verdict === 'outside'
              return (
                <div role="dialog" aria-label="Confirm arrival" className="mb-2 max-h-[60vh] overflow-y-auto rounded-lg border border-amber-300 bg-white p-3 shadow-xl">
                  <p className="text-sm font-bold text-gray-900">
                    {outside ? `You are not at ${name}` : "Your position can't be checked"}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    {outside
                      ? `You are ${describeDistance(check.distanceMeters ?? 0)} from the approved stop. Arrivals count within ${describeDistance(check.radiusMeters)}.`
                      : check.distanceMeters === null
                        ? 'There is no recent GPS position, so this arrival cannot be verified. It will be saved as unverified.'
                        : `GPS accuracy is only about ${Math.round(check.accuracyMeters ?? 0)} m, so this arrival cannot be verified. It will be saved as unverified.`}
                  </p>
                  {outside && (
                    <>
                      <fieldset className="mt-2 space-y-1">
                        <legend className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Why are you confirming here?</legend>
                        {OVERRIDE_REASONS.map(reason => (
                          <label key={reason.code} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-xs ${overrideCode === reason.code ? 'border-amber-400 bg-amber-50 font-semibold' : 'border-gray-200'}`}>
                            <input type="radio" name="arrival-reason" value={reason.code} checked={overrideCode === reason.code} onChange={() => setOverrideCode(reason.code)} className="accent-amber-500" />
                            {reason.label}
                          </label>
                        ))}
                      </fieldset>
                      <input
                        value={overrideNote}
                        onChange={event => setOverrideNote(event.target.value)}
                        maxLength={300}
                        placeholder="Add a note (optional)"
                        aria-label="Note about this arrival"
                        className="mt-2 h-10 w-full rounded-md border border-gray-300 px-2.5 text-sm"
                      />
                    </>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => setArrivalPrompt(null)} className="h-11 flex-1 rounded-md border border-gray-300 text-sm font-semibold text-gray-700">Keep driving</button>
                    <button
                      type="button"
                      onClick={confirmArrivalPrompt}
                      disabled={outside && !overrideCode}
                      className="h-11 flex-1 rounded-md bg-green-600 text-sm font-bold text-white disabled:opacity-40"
                    >
                      Confirm arrival
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* Add a shipment on the road */}
            {addingShipment && onAddShipment && (
              <AddShipmentSheet
                onClose={() => setAddingShipment(false)}
                onSubmit={async drafts => {
                  const summary = await onAddShipment(drafts)
                  toast(summary || 'Shipment added', 'success')
                }}
              />
            )}

            {/* Export to Google Maps: split into links Google will accept */}
            {exportParts && (
              <div role="dialog" aria-label="Open in Google Maps" className="mb-2 max-h-[55vh] overflow-y-auto rounded-lg border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-gray-900">Open in Google Maps</p>
                  <button type="button" onClick={() => setExportParts(null)} aria-label="Close" className="grid h-8 w-8 place-items-center text-gray-500"><X className="h-4 w-4" /></button>
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  Google Maps only accepts a few stops per link, so this route is split into {exportParts.length} parts. Open them in order: each one starts where the last one ended.
                </p>
                <ol className="mt-2 space-y-1.5">
                  {exportParts.map(part => (
                    <li key={part.index}>
                      <a
                        href={part.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-11 items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 hover:bg-gray-50"
                      >
                        <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-gray-800 px-1 text-[11px] font-bold text-white">{part.index}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-gray-900">Part {part.index} of {part.total} · {part.stops.length} stop{part.stops.length === 1 ? '' : 's'}</span>
                          <span className="block truncate text-[11px] text-gray-500">Ends at {part.stops[part.stops.length - 1]?.address || 'the last stop'}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                      </a>
                    </li>
                  ))}
                </ol>
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
                        {(() => {
                          const leg = legSummaries.find(summary => summary.toIndex === idx)
                          return leg && !isCompleted ? <span className="text-[11px] text-gray-500 shrink-0">{leg.distance}</span> : null
                        })()}
                        {navState.isNavigating && isCurrent && (
                          <button
                            onClick={() => requestStopCompletion(idx)}
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
              <StopStrip
                stops={stops}
                tags={stopTags}
                completed={navState.completedStops}
                currentIndex={navState.isNavigating ? navState.currentStopIndex : null}
                onSelect={focusStop}
              />
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
                    title="Re-plan: reorder the stops still ahead, starting from where you are now"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    {replanning ? 'Re-planning...' : 'Re-plan'}
                  </button>
                )}

                {navState.isNavigating && !simulation && !deviation && (
                  <button
                    type="button"
                    onClick={reportBlocked}
                    title="Report a closure ahead and find another way"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Road blocked
                  </button>
                )}

                {onAddShipment && navState.isNavigating && !simulation && (
                  <button
                    type="button"
                    onClick={() => setAddingShipment(open => !open)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${addingShipment ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <Package className="h-3.5 w-3.5" />
                    Add shipment
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
                      onClick={() => requestStopCompletion(navState.currentStopIndex)}
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

// Large turn arrows read at a glance; Google's maneuver names choose the shape and the rotation.
function ManeuverIcon({ view, className }: { view: ManeuverView | null; className?: string }) {
  const glyph = view?.glyph ?? 'straight'
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {glyph === 'uturn' ? (
        <path {...stroke} d="M8 21V9a4 4 0 0 1 8 0v6M13 12l3 3 3-3" transform={view?.side === 'right' ? 'translate(24 0) scale(-1 1)' : undefined} />
      ) : glyph === 'roundabout' ? (
        <g {...stroke}>
          <circle cx="12" cy="15" r="5" />
          <path d="M12 10V3M9 6l3-3 3 3" transform={`rotate(${view?.side === 'left' ? -90 : 90} 12 15)`} />
        </g>
      ) : glyph === 'arrive' ? (
        <g {...stroke}>
          <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
          <circle cx="12" cy="10" r="2.5" />
        </g>
      ) : (
        <path
          d="M12 2.5 20 12h-5v9.5H9V12H4z"
          fill="currentColor"
          transform={`rotate(${view ? arrowRotation(view) : 0} 12 12)`}
        />
      )}
    </svg>
  )
}

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
