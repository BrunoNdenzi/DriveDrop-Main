'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import RouteOperations from '@/components/route-planner/RouteOperations'
import PlannerBilling from '@/components/route-planner/PlannerBilling'
import DriverMapNavigation, { type ArrivalReport, type DeviationEvent, type DriverFix, type NavStop } from '@/components/driver/DriverMapNavigation'
import { describeReplan } from '@/lib/replan-summary'
import { geocodeUsAddress } from '@/lib/address-resolve'
import { enterFullscreen, exitFullscreen } from '@/lib/fullscreen'
import type { AddedStopDraft } from '@/components/route-planner/AddShipmentSheet'
import { assignStopTags } from '@/lib/stop-tags'
import NumericInput from '@/components/route-planner/NumericInput'
import CollapsibleSection from '@/components/route-planner/CollapsibleSection'
import OptimizedStopList from '@/components/route-planner/OptimizedStopList'
import { createPingGate, createTravelTracker, queueAction, readQueue, replayQueue } from '@/lib/planner-sync'
import {
  BookOpen,
  Calendar,
  Clock,
  CreditCard,
  Crosshair,
  Fuel,
  LogOut,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Route,
  Save,
  Trash2,
  Upload,
} from '@/components/icons/streamline-lucide'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'

type PlannerTab = 'plan' | 'routes' | 'operations' | 'locations' | 'billing'
type StopType = 'current_location' | 'stop' | 'pickup' | 'delivery' | 'fuel' | 'rest'

interface PlannerStop {
  id: string
  name: string
  address: string
  type: StopType
  referenceId?: string
  serviceMinutes: number
  latitude?: number
  longitude?: number
  timeWindow?: { earliest: string; latest: string }
}

interface RoutePlannerOptions {
  vehicleType: string
  vehicleSlots: number
  departureTime?: string
  prioritizeFuel: boolean
  returnToOrigin: boolean
  avoidHighways: boolean
  preferHighway: boolean
  maxHours?: number
  maxDetourMinutes?: number
  commercialVehicle?: {
    heightFeet: number
    widthFeet: number
    lengthFeet: number
    grossWeightPounds: number
    axleCount: number
    hazmatTypes: string[]
  }
}

interface SavedLocation {
  id: string
  name: string
  address: string
  latitude?: number | null
  longitude?: number | null
  notes: string | null
}

interface Recurrence {
  frequency: 'daily' | 'weekly' | 'monthly'
  interval: number
  startsAt: string
}

interface SavedRoute {
  id: string
  name: string
  stops: PlannerStop[]
  options: Partial<RoutePlannerOptions>
  recurrence: Recurrence | null
  next_run_at: string | null
  is_recurring: boolean
  status: 'draft' | 'planned' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled'
  current_version: number
  last_optimized_result: OptimizedRoute | null
  updated_at: string
}

interface OptimizedRoute {
  stops: Array<PlannerStop & {
    order: number
    shipmentId?: string
    vehicleInfo?: string
    isReturn?: boolean
    estimatedDuration?: number
    estimatedArrival: string
    distanceFromPrevious: number
    durationFromPrevious: number
  }>
  summary: {
    totalDistance: number
    totalDuration: number
    totalFuelCost: number
    efficiencyScore: number
    estimatedEndTime: string
  }
  savings: {
    distanceSaved: number
    timeSaved: number
    fuelCostSaved: number
    emptyMilesSaved: number
    percentImprovement: number
  }
  liveEvidence: {
    traffic: EvidenceSource<{ delaySeconds: number; delayPercent: number; evaluatedLegs: number; totalLegs: number }>
    tolls: EvidenceSource<{ currency: string; estimatedAmount: number; tollCount: number }>
    weather: EvidenceSource<{ condition: string; temperatureFahrenheit: number; windSpeedMph: number; precipitationOneHourInches: number }>
    fuel: EvidenceSource<{ pricePerGallon: number; currency: string; geographicLevel: string; stationName?: string }>
  } | null
  carolinaInsights: Array<{ type: string; title: string; description: string; severity: 'info' | 'warning' | 'critical'; affectedSegment?: string }>
  fuelStops: Array<{ name: string; address: string; estimatedPrice: number; afterStopIndex: number; reason: string }>
  benjiTips: string[]
  constraintWarnings: string[]
  commercialCompliance: {
    status: 'verified' | 'profile_required' | 'not_requested'
    provider: 'here' | null
    restrictions: string[]
  }
}

interface EvidenceSource<T> {
  status: 'available' | 'unavailable' | 'error'
  provider: string
  observedAt: string
  freshUntil: string
  evidence?: T
  errorCode?: string
}

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record
  const { [key]: _removed, ...rest } = record
  return rest
}

function newStop(index: number, id = crypto.randomUUID()): PlannerStop {
  return {
    id,
    name: index === 0 ? 'Start' : `Stop ${index + 1}`,
    address: '',
    type: index === 0 ? 'current_location' : 'stop',
    serviceMinutes: index === 0 ? 0 : 10,
  }
}

function localDateTime(date = new Date(Date.now() + 60 * 60 * 1000)): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function navigationStops(result: OptimizedRoute): NavStop[] {
  return result.stops.map(stop => ({
    id: stop.id,
    address: stop.address,
    lat: stop.latitude,
    lng: stop.longitude,
    type: stop.type,
    shipmentId: stop.shipmentId ?? stop.referenceId,
    label: stop.vehicleInfo || stop.name,
    order: stop.order,
    estimatedArrival: stop.estimatedArrival,
    ...(stop.name ? { name: stop.name } : {}),
    ...(stop.isReturn ? { isReturn: true } : {}),
    ...(stop.estimatedDuration !== undefined ? { serviceMinutes: stop.estimatedDuration } : {}),
    distanceFromPrevious: stop.distanceFromPrevious,
    durationFromPrevious: stop.durationFromPrevious,
    ...(stop.timeWindow ? { timeWindow: stop.timeWindow } : {}),
  }))
}

export default function StandaloneRoutePlannerPage() {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const stopInputRefs = useRef(new Map<string, HTMLInputElement>())
  const stopAutocompleteRefs = useRef(new Map<string, { autocomplete: google.maps.places.Autocomplete; input: HTMLInputElement }>())
  const locationInputRef = useRef<HTMLInputElement>(null)
  const [addressNotes, setAddressNotes] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<PlannerTab>('plan')
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [onboarded, setOnboarded] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [vehicleType, setVehicleType] = useState('default')
  const [vehicleSlots, setVehicleSlots] = useState(1)
  const [departureTime, setDepartureTime] = useState(localDateTime())
  const [prioritizeFuel, setPrioritizeFuel] = useState(true)
  const [routingPreference, setRoutingPreference] = useState<'fastest' | 'preferHighway' | 'avoidHighways'>('fastest')
  const [returnToOrigin, setReturnToOrigin] = useState(false)
  const [maxHours, setMaxHours] = useState('')
  const [maxDetourMinutes, setMaxDetourMinutes] = useState('')
  const [verifyCommercialRoute, setVerifyCommercialRoute] = useState(true)
  const [commercialVehicle, setCommercialVehicle] = useState({
    heightFeet: '13.5', widthFeet: '8.5', lengthFeet: '75', grossWeightPounds: '80000', axleCount: '5', hazmatTypes: '',
  })
  const [stops, setStops] = useState<PlannerStop[]>([newStop(0, 'draft-origin'), newStop(1, 'draft-stop-2')])
  const stopsRef = useRef(stops)
  stopsRef.current = stops
  const startDriving = () => {
    setDrivingMode(true)
    void enterFullscreen()
  }
  const [routeName, setRouteName] = useState('')
  const [currentRouteId, setCurrentRouteId] = useState<string | null>(null)
  const [recurring, setRecurring] = useState(false)
  const [frequency, setFrequency] = useState<Recurrence['frequency']>('weekly')
  const [recurrenceStart, setRecurrenceStart] = useState('')
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([])
  const [locations, setLocations] = useState<SavedLocation[]>([])
  const [locationForm, setLocationForm] = useState<{ name: string; address: string; notes: string; latitude?: number; longitude?: number }>({ name: '', address: '', notes: '' })
  const [result, setResult] = useState<OptimizedRoute | null>(null)
  const [busy, setBusy] = useState(false)
  const [detectingOrigin, setDetectingOrigin] = useState(false)
  const [drivingMode, setDrivingMode] = useState(false)
  useEffect(() => {
    if (!drivingMode) return
    document.documentElement.classList.add('driving-lock')
    return () => {
      document.documentElement.classList.remove('driving-lock')
      void exitFullscreen()
    }
  }, [drivingMode])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const api = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Your session expired. Sign in again.')
    const response = await fetch(`${API_BASE_URL}/standalone-route-planner${path}`, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${session.access_token}`,
        ...init?.headers,
      },
    })
    if (response.status === 204) return undefined as T
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(body.error?.message || body.error || 'Request failed')
    }
    return body.data as T
  }, [supabase])

  const refreshLibrary = useCallback(async () => {
    const [routeData, locationData] = await Promise.all([
      api<SavedRoute[]>('/routes'),
      api<SavedLocation[]>('/locations'),
    ])
    setSavedRoutes(routeData)
    setLocations(locationData)
  }, [api])

  useEffect(() => {
    setRecurrenceStart(current => current || localDateTime())
    const load = async () => {
      try {
        const profile = await api<{
          business_name: string | null
          default_vehicle_type: string
          default_vehicle_slots: number
          onboarding_completed: boolean
        } | null>('/profile')
        if (profile) {
          setBusinessName(profile.business_name || '')
          setVehicleType(profile.default_vehicle_type)
          setVehicleSlots(profile.default_vehicle_slots)
          setOnboarded(profile.onboarding_completed)
        }
        await refreshLibrary()
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load planner')
      } finally {
        setProfileLoaded(true)
      }
    }
    void load()
  }, [api, refreshLibrary])

  const flash = (text: string) => {
    setMessage(text)
    setError(null)
    window.setTimeout(() => setMessage(null), 3000)
  }

  const fail = (caught: unknown) => {
    setError(caught instanceof Error ? caught.message : 'Something went wrong')
    setMessage(null)
  }

  // ── Tracked run: driving mode saves progress and shares the driver's live position ──
  const [tracking, setTracking] = useState<{ state: 'off' | 'pending' | 'on' | 'error'; label: string } | null>(null)
  const trackedExecutionRef = useRef<string | null>(null)
  const latestFixRef = useRef<DriverFix | null>(null)
  const pingGateRef = useRef(createPingGate())
  const travelRef = useRef(createTravelTracker())
  const pingBusyRef = useRef(false)
  const pingFailuresRef = useRef(0)
  const syncChainRef = useRef<Promise<unknown>>(Promise.resolve())

  const runSerial = <T,>(task: () => Promise<T>): Promise<T> => {
    const next = syncChainRef.current.catch(() => undefined).then(task)
    syncChainRef.current = next
    return next
  }

  const writeProgress = (path: string, method: string, payload: object) => runSerial(async (): Promise<boolean> => {
    const body = JSON.stringify(payload)
    const saveLocally = () => {
      queueAction({ path, method, body, queuedAt: new Date().toISOString() })
      setTracking({ state: 'pending', label: 'Offline: progress saved on this device' })
      return false
    }
    if (!navigator.onLine) return saveLocally()
    try {
      await api(path, { method, body })
      return true
    } catch (caught) {
      if (caught instanceof TypeError) return saveLocally()
      throw caught
    }
  })

  const trackingFailed = (caught: unknown) => {
    setTracking({ state: 'error', label: `Progress not saved: ${caught instanceof Error ? caught.message : 'try again'}` })
  }

  useEffect(() => {
    const flush = () => {
      void replayQueue(async action => { await api(action.path, { method: action.method, body: action.body }) })
    }
    flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [api])

  const startTrackedRun = async () => {
    if (!currentRouteId) {
      setTracking({ state: 'off', label: 'Route not saved: progress is not recorded' })
      return
    }
    setTracking({ state: 'pending', label: 'Starting tracked run...' })
    try {
      type RunSummary = { id: string; status: string; stop_progress: Array<{ stopId: string; status: string }> }
      const runs = await api<RunSummary[]>(`/executions?routeId=${currentRouteId}`)
      let run = runs.find(item => item.status === 'dispatched' || item.status === 'in_progress')
      if (!run) {
        const saved = await api<SavedRoute>(`/routes/${currentRouteId}`)
        if (!saved.last_optimized_result) throw new Error('optimize the saved route first')
        run = await api<RunSummary>(`/routes/${currentRouteId}/dispatch`, { method: 'POST', body: JSON.stringify({ plannedStartAt: new Date().toISOString() }) })
      }
      if (run.status === 'dispatched') run = await api<RunSummary>(`/executions/${run.id}/start`, { method: 'POST', body: '{}' })

      trackedExecutionRef.current = run.id
      pingGateRef.current.reset()
      travelRef.current = createTravelTracker()

      const originId = result?.stops[0]?.id
      const origin = run.stop_progress.find(stop => stop.stopId === originId)
      if (origin?.status === 'pending') {
        const fix = latestFixRef.current
        await writeProgress(`/executions/${run.id}/stops/${encodeURIComponent(origin.stopId)}`, 'PATCH', {
          action: 'completed',
          timestamp: new Date().toISOString(),
          ...(fix && !fix.simulated ? { latitude: fix.lat, longitude: fix.lng } : {}),
        })
      }
      setTracking({ state: 'on', label: 'Tracking on' })
      void refreshLibrary()
    } catch (caught) {
      trackedExecutionRef.current = null
      setTracking({ state: 'error', label: `Not tracked: ${caught instanceof Error ? caught.message : 'try again'}` })
    }
  }

  // A simulated drive only reports position, and only to a run that is already active.
  const attachActiveRun = async () => {
    if (!currentRouteId || trackedExecutionRef.current) return
    const runs = await api<Array<{ id: string; status: string }>>(`/executions?routeId=${currentRouteId}`)
    const run = runs.find(item => item.status === 'dispatched' || item.status === 'in_progress')
    if (!run) return
    trackedExecutionRef.current = run.id
    pingGateRef.current.reset()
  }

  const recordStopReached = (index: number, arrival?: ArrivalReport) => {
    const executionId = trackedExecutionRef.current
    const stop = result?.stops[index]
    if (!executionId || !stop) return
    // The position the driver confirmed from travels with the arrival so the server can check it itself.
    const fix = arrival ? arrival.fix : (() => { const latest = latestFixRef.current; return latest && !latest.simulated ? { lat: latest.lat, lng: latest.lng, accuracyMeters: latest.accuracyMeters } : null })()
    writeProgress(`/executions/${executionId}/stops/${encodeURIComponent(stop.id)}`, 'PATCH', {
      action: 'completed',
      timestamp: new Date().toISOString(),
      ...(fix ? { latitude: fix.lat, longitude: fix.lng, ...(fix.accuracyMeters != null ? { gpsAccuracyMeters: fix.accuracyMeters } : {}) } : {}),
      ...(arrival ? {
        arrivalTarget: { latitude: arrival.target.lat, longitude: arrival.target.lng, radiusMeters: arrival.radiusMeters },
        ...(arrival.overrideCode ? { overrideCode: arrival.overrideCode } : {}),
        ...(arrival.overrideNote ? { overrideNote: arrival.overrideNote } : {}),
      } : {}),
    }).catch(trackingFailed)
  }

  const finishTrackedRun = () => {
    const executionId = trackedExecutionRef.current
    if (!executionId) return
    const miles = Math.round(travelRef.current.miles * 10) / 10
    writeProgress(`/executions/${executionId}/complete`, 'POST', {
      completedAt: new Date().toISOString(),
      ...(miles > 0 ? { actualDistanceMiles: miles } : {}),
    })
      .then(sent => { if (sent) setTracking({ state: 'off', label: 'Run saved' }) })
      .catch(trackingFailed)
      .finally(() => {
        trackedExecutionRef.current = null
        void refreshLibrary()
      })
  }

  const recordPosition = (fix: DriverFix) => {
    latestFixRef.current = fix
    if (!fix.simulated) travelRef.current.add({ lat: fix.lat, lng: fix.lng, at: fix.at, accuracyMeters: fix.accuracyMeters })

    const executionId = trackedExecutionRef.current
    if (!executionId || pingBusyRef.current || !pingGateRef.current.shouldSend({ lat: fix.lat, lng: fix.lng, at: fix.at })) return

    pingBusyRef.current = true
    api(`/executions/${executionId}/location`, {
      method: 'POST',
      body: JSON.stringify({
        latitude: fix.lat,
        longitude: fix.lng,
        recordedAt: new Date(fix.at).toISOString(),
        simulated: fix.simulated,
        ...(fix.heading !== null ? { heading: fix.heading } : {}),
        ...(fix.speedMps !== null ? { speedMps: fix.speedMps } : {}),
        ...(fix.accuracyMeters !== null ? { accuracyMeters: fix.accuracyMeters } : {}),
        ...(!fix.simulated ? { actualDistanceMiles: Math.round(travelRef.current.miles * 100) / 100 } : {}),
      }),
    })
      .then(() => {
        if (pingFailuresRef.current >= 3) setTracking({ state: 'on', label: 'Tracking on' })
        pingFailuresRef.current = 0
      })
      .catch(() => {
        pingFailuresRef.current += 1
        if (pingFailuresRef.current === 3) setTracking({ state: 'error', label: 'Live location is not reaching the server' })
      })
      .finally(() => { pingBusyRef.current = false })
  }

  const currentPosition = () => new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This device cannot share its location'))
    navigator.geolocation.getCurrentPosition(
      position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => reject(new Error('Allow location access to re-plan from where you are')),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15_000 },
    )
  })

  const replanFromHere = async (addStops?: AddedStopDraft[]) => {
    const executionId = trackedExecutionRef.current
    if (!executionId) throw new Error(currentRouteId ? 'Tap Start Navigation first so finished stops are recorded' : 'Save the route to re-plan from your position')

    await syncChainRef.current.catch(() => undefined)
    await replayQueue(async action => { await api(action.path, { method: action.method, body: action.body }) })
    if (readQueue().length > 0) throw new Error('Waiting to sync offline updates. Try again when you have signal')

    const fix = latestFixRef.current
    const here = fix && !fix.simulated && Date.now() - fix.at < 60_000 ? { latitude: fix.lat, longitude: fix.lng } : await currentPosition()
    const previous = { stops: result?.stops ?? [], endTime: result?.summary.estimatedEndTime }
    const data = await api<{ optimizedRoute: OptimizedRoute }>(`/executions/${executionId}/reoptimize`, {
      method: 'POST',
      body: JSON.stringify({ currentLocation: here, ...(addStops?.length ? { addStops } : {}) }),
    })
    setResult(data.optimizedRoute)
    void refreshLibrary()
    const summary = describeReplan(previous, { stops: data.optimizedRoute.stops, endTime: data.optimizedRoute.summary.estimatedEndTime })
    return addStops?.length ? `Shipment added. ${summary.replace('Re-planned from your position. ', '')}` : summary
  }

  // Idempotent by id, so the start, the reason and the end of one departure all update the same record.
  const recordDeviation = (event: DeviationEvent) => {
    const executionId = trackedExecutionRef.current
    if (!executionId) return
    writeProgress(`/executions/${executionId}/deviations/${event.id}`, 'PUT', {
      startedAt: new Date(event.startedAt).toISOString(),
      reason: event.reason,
      maxDistanceMeters: event.maxDistanceMeters,
      latitude: event.lat,
      longitude: event.lng,
      ...(event.endedAt ? { endedAt: new Date(event.endedAt).toISOString() } : {}),
      ...(event.resolution ? { resolution: event.resolution } : {}),
      ...(event.addedMinutes !== undefined ? { addedMinutes: event.addedMinutes } : {}),
    }).catch(() => undefined)
  }

  const trackingProps = {
    onDeviation: recordDeviation,
    onNavigationStart: startTrackedRun,
    onSimulationStart: attachActiveRun,
    onStopReached: recordStopReached,
    onNavigationComplete: finishTrackedRun,
    onPosition: recordPosition,
    onReoptimize: () => replanFromHere(),
    onAddShipment: (added: AddedStopDraft[]) => replanFromHere(added),
    trackingStatus: tracking ?? (currentRouteId
      ? { state: 'off' as const, label: 'Tracking starts with Start Navigation' }
      : { state: 'off' as const, label: 'Route not saved: progress is not recorded' }),
  }

  const completeOnboarding = async () => {
    setBusy(true)
    try {
      await api('/profile', {
        method: 'PUT',
        body: JSON.stringify({ businessName, defaultVehicleType: vehicleType, defaultVehicleSlots: vehicleSlots, onboardingCompleted: true }),
      })
      setOnboarded(true)
      flash('Planner workspace is ready')
    } catch (caught) {
      fail(caught)
    } finally {
      setBusy(false)
    }
  }

  const updateStop = (id: string, patch: Partial<PlannerStop>) => {
    setStops(current => current.map(stop => stop.id === id ? { ...stop, ...patch } : stop))
    if (patch.address !== undefined) setAddressNotes(current => withoutKey(current, id))
    setResult(null)
  }

  // Typed or saved addresses without coordinates are looked up here, so the route never depends on ambiguous text like "charlotte".
  const resolveStopAddress = async (id: string) => {
    const stop = stopsRef.current.find(item => item.id === id)
    if (!stop || !stop.address.trim() || stop.latitude !== undefined || !window.google?.maps) return null
    const typed = stop.address
    try {
      const found = await geocodeUsAddress(typed)
      const current = stopsRef.current.find(item => item.id === id)
      if (!current || current.address !== typed || current.latitude !== undefined) return null
      if (!found) {
        setAddressNotes(notes => ({ ...notes, [id]: 'We could not find this address. Pick one of the suggestions.' }))
        return null
      }
      const patch = { address: found.address, latitude: found.latitude, longitude: found.longitude }
      stopsRef.current = stopsRef.current.map(item => item.id === id ? { ...item, ...patch } : item)
      setStops(list => list.map(item => item.id === id && item.address === typed ? { ...item, ...patch } : item))
      setAddressNotes(notes => found.approximate
        ? { ...notes, [id]: 'Only the area was found. Add a street address for accurate routing.' }
        : withoutKey(notes, id))
      return found
    } catch {
      // The backend geocodes any stop still without coordinates.
      return null
    }
  }

  const resolveMissingAddresses = async () => {
    const missing = stopsRef.current.filter(stop => stop.address.trim() && stop.latitude === undefined).map(stop => stop.id)
    for (let index = 0; index < missing.length; index += 5) {
      await Promise.all(missing.slice(index, index + 5).map(resolveStopAddress))
    }
  }

  // Autocomplete is bound to a specific input element, so it must be re-attached whenever the inputs are re-created (tab switches).
  useEffect(() => {
    const initialize = () => {
      if (!window.google?.maps?.places) return false
      const activeIds = new Set(tab === 'plan' ? stops.map(stop => stop.id) : [])
      for (const [stopId, entry] of stopAutocompleteRefs.current) {
        if (activeIds.has(stopId) && stopInputRefs.current.get(stopId) === entry.input) continue
        google.maps.event.clearInstanceListeners(entry.autocomplete)
        stopAutocompleteRefs.current.delete(stopId)
      }
      for (const stop of stops) {
        const input = stopInputRefs.current.get(stop.id)
        if (tab !== 'plan' || !input || stopAutocompleteRefs.current.has(stop.id)) continue
        const autocomplete = new google.maps.places.Autocomplete(input, {
          types: ['geocode', 'establishment'],
          componentRestrictions: { country: 'us' },
          fields: ['formatted_address', 'geometry'],
        })
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          const location = place.geometry?.location
          if (!place.formatted_address) return
          setStops(current => current.map(item => item.id === stop.id ? {
            ...item,
            address: place.formatted_address!,
            ...(location ? { latitude: location.lat(), longitude: location.lng() } : {}),
          } : item))
          setAddressNotes(current => withoutKey(current, stop.id))
          setResult(null)
        })
        stopAutocompleteRefs.current.set(stop.id, { autocomplete, input })
      }
      return tab !== 'plan' || stops.every(stop => stopAutocompleteRefs.current.has(stop.id))
    }

    if (initialize()) return
    const interval = window.setInterval(() => {
      if (initialize()) window.clearInterval(interval)
    }, 250)
    return () => window.clearInterval(interval)
  }, [stops, tab])

  // The address book gets the same suggestions so saved locations carry real coordinates.
  useEffect(() => {
    if (tab !== 'locations') return
    let autocomplete: google.maps.places.Autocomplete | null = null
    const attach = () => {
      const input = locationInputRef.current
      if (!window.google?.maps?.places || !input) return false
      autocomplete = new google.maps.places.Autocomplete(input, {
        types: ['geocode', 'establishment'],
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'geometry'],
      })
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete!.getPlace()
        const location = place.geometry?.location
        if (!place.formatted_address || !location) return
        setLocationForm(current => ({ ...current, address: place.formatted_address!, latitude: location.lat(), longitude: location.lng() }))
      })
      return true
    }
    let interval: number | undefined
    if (!attach()) interval = window.setInterval(() => { if (attach()) window.clearInterval(interval) }, 250)
    return () => {
      window.clearInterval(interval)
      if (autocomplete) google.maps.event.clearInstanceListeners(autocomplete)
    }
  }, [tab])

  const detectCurrentOrigin = () => {
    if (!navigator.geolocation) return fail(new Error('Geolocation is unavailable in this browser'))
    setDetectingOrigin(true)
    navigator.geolocation.getCurrentPosition(async position => {
      const latitude = position.coords.latitude
      const longitude = position.coords.longitude
      let address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
      if (window.google?.maps) {
        try {
          const geocoded = await new google.maps.Geocoder().geocode({ location: { lat: latitude, lng: longitude } })
          address = geocoded.results[0]?.formatted_address || address
        } catch {
          // Coordinates remain usable when reverse geocoding is unavailable.
        }
      }
      const origin = stops[0]
      if (origin) updateStop(origin.id, { address, latitude, longitude })
      setDetectingOrigin(false)
    }, () => {
      setDetectingOrigin(false)
      fail(new Error('Unable to detect your current location'))
    }, { enableHighAccuracy: true, timeout: 10_000 })
  }

  const addShipment = () => {
    const used = new Set(stopsRef.current.map(stop => stop.referenceId?.trim()))
    let number = 1
    while (used.has(`shipment-${number}`)) number += 1
    const referenceId = `shipment-${number}`
    const base = stopsRef.current.length
    const pickup: PlannerStop = { ...newStop(base), type: 'pickup', name: `Pickup ${number}`, referenceId }
    const delivery: PlannerStop = { ...newStop(base + 1), type: 'delivery', name: `Delivery ${number}`, referenceId }
    stopsRef.current = [...stopsRef.current, pickup, delivery]
    setStops(current => [...current, pickup, delivery])
    setResult(null)
  }

  const addStop = (location?: SavedLocation) => {
    const stop = newStop(stops.length)
    const hasCoordinates = typeof location?.latitude === 'number' && typeof location.longitude === 'number'
    const added: PlannerStop = location
      ? {
        ...stop,
        name: location.name,
        address: location.address,
        ...(hasCoordinates ? { latitude: location.latitude!, longitude: location.longitude! } : {}),
      }
      : stop
    stopsRef.current = [...stopsRef.current, added]
    setStops(current => [...current, added])
    setTab('plan')
    setResult(null)
    // Older saved locations have no coordinates: look them up once and save them back to the address book.
    if (location && !hasCoordinates) {
      void resolveStopAddress(added.id).then(found => {
        if (found) void api(`/locations/${location.id}`, { method: 'PATCH', body: JSON.stringify({ latitude: found.latitude, longitude: found.longitude }) }).then(refreshLibrary).catch(() => undefined)
      })
    }
  }

  const removeStop = (id: string) => {
    setStops(current => current.filter(stop => stop.id !== id).map((stop, index) => ({
      ...stop,
      type: index === 0 ? 'current_location' : stop.type === 'current_location' ? 'stop' : stop.type,
    })))
    setResult(null)
  }

  const routeOptions = (): RoutePlannerOptions => ({
    vehicleType,
    vehicleSlots,
    ...(departureTime ? { departureTime: new Date(departureTime).toISOString() } : {}),
    prioritizeFuel,
    returnToOrigin,
    avoidHighways: routingPreference === 'avoidHighways',
    preferHighway: routingPreference === 'preferHighway',
    ...(maxHours ? { maxHours: Number(maxHours) } : {}),
    ...(maxDetourMinutes ? { maxDetourMinutes: Number(maxDetourMinutes) } : {}),
    ...(verifyCommercialRoute ? {
      commercialVehicle: {
        heightFeet: Number(commercialVehicle.heightFeet),
        widthFeet: Number(commercialVehicle.widthFeet),
        lengthFeet: Number(commercialVehicle.lengthFeet),
        grossWeightPounds: Number(commercialVehicle.grossWeightPounds),
        axleCount: Number(commercialVehicle.axleCount),
        hazmatTypes: commercialVehicle.hazmatTypes.split(',').map(value => value.trim()).filter(Boolean),
      },
    } : {}),
  })

  const routePayload = () => ({
    name: routeName.trim(),
    stops: stopsRef.current,
    options: routeOptions(),
    recurrence: recurring ? {
      frequency,
      interval: 1,
      startsAt: new Date(recurrenceStart).toISOString(),
    } : null,
  })

  const validateRoute = (requireName = false) => {
    if (stops.length < 2) throw new Error('Add at least two stops')
    if (stops.some(stop => !stop.address.trim())) throw new Error('Every stop needs an address')
    if (requireName && !routeName.trim()) throw new Error('Give this route a name')
    if (maxHours && (!Number.isFinite(Number(maxHours)) || Number(maxHours) <= 0)) throw new Error('Maximum hours must be greater than zero')
    if (maxDetourMinutes && (!Number.isFinite(Number(maxDetourMinutes)) || Number(maxDetourMinutes) < 0)) throw new Error('Maximum detour cannot be negative')
    for (const stop of stops) {
      if (stop.timeWindow && new Date(stop.timeWindow.earliest) > new Date(stop.timeWindow.latest)) {
        throw new Error(`${stop.name || stop.address} has an invalid time window`)
      }
    }
    const delivered = new Set(stops.filter(stop => stop.type === 'delivery' && stop.referenceId?.trim()).map(stop => stop.referenceId!.trim()))
    for (const stop of stops) {
      const reference = stop.referenceId?.trim()
      if (stop.type === 'pickup' && !reference) throw new Error(`${stop.name || stop.address} is a pickup without a shipment reference`)
      if (stop.type === 'pickup' && reference && !delivered.has(reference)) throw new Error(`Shipment ${reference} has a pickup but no delivery`)
    }
  }

  const optimize = async () => {
    setBusy(true)
    try {
      validateRoute()
      await resolveMissingAddresses()
      const data = await api<OptimizedRoute>('/optimize', {
        method: 'POST',
        body: JSON.stringify({ stops: stopsRef.current, options: routeOptions(), routeId: currentRouteId }),
      })
      setResult(data)
      flash('Route optimized')
    } catch (caught) {
      fail(caught)
    } finally {
      setBusy(false)
    }
  }

  const saveRoute = async () => {
    setBusy(true)
    try {
      validateRoute(true)
      await resolveMissingAddresses()
      const saved = await api<SavedRoute>(currentRouteId ? `/routes/${currentRouteId}` : '/routes', {
        method: currentRouteId ? 'PATCH' : 'POST',
        body: JSON.stringify(routePayload()),
      })
      setCurrentRouteId(saved.id)
      await refreshLibrary()
      flash(currentRouteId ? 'Route updated' : 'Route saved')
    } catch (caught) {
      fail(caught)
    } finally {
      setBusy(false)
    }
  }

  const loadRoute = (route: SavedRoute) => {
    setCurrentRouteId(route.id)
    setRouteName(route.name)
    setStops(route.stops)
    setVehicleType(route.options.vehicleType ?? vehicleType)
    setVehicleSlots(route.options.vehicleSlots ?? vehicleSlots)
    setDepartureTime(route.options.departureTime ? localDateTime(new Date(route.options.departureTime)) : localDateTime())
    setPrioritizeFuel(route.options.prioritizeFuel !== false)
    setRoutingPreference(route.options.avoidHighways ? 'avoidHighways' : route.options.preferHighway ? 'preferHighway' : 'fastest')
    setReturnToOrigin(route.options.returnToOrigin === true)
    setMaxHours(route.options.maxHours === undefined ? '' : String(route.options.maxHours))
    setMaxDetourMinutes(route.options.maxDetourMinutes === undefined ? '' : String(route.options.maxDetourMinutes))
    setVerifyCommercialRoute(Boolean(route.options.commercialVehicle))
    if (route.options.commercialVehicle) {
      setCommercialVehicle({
        heightFeet: String(route.options.commercialVehicle.heightFeet),
        widthFeet: String(route.options.commercialVehicle.widthFeet),
        lengthFeet: String(route.options.commercialVehicle.lengthFeet),
        grossWeightPounds: String(route.options.commercialVehicle.grossWeightPounds),
        axleCount: String(route.options.commercialVehicle.axleCount),
        hazmatTypes: route.options.commercialVehicle.hazmatTypes.join(', '),
      })
    }
    setRecurring(route.is_recurring)
    setFrequency(route.recurrence?.frequency ?? 'weekly')
    setRecurrenceStart(route.recurrence?.startsAt ? localDateTime(new Date(route.recurrence.startsAt)) : localDateTime())
    setResult(route.last_optimized_result)
    setTab('plan')
  }

  const deleteRoute = async (id: string) => {
    if (!window.confirm('Delete this saved route?')) return
    try {
      await api(`/routes/${id}`, { method: 'DELETE' })
      if (currentRouteId === id) {
        setCurrentRouteId(null)
        setRouteName('')
      }
      await refreshLibrary()
      flash('Route deleted')
    } catch (caught) {
      fail(caught)
    }
  }

  const importCsv = async (file: File) => {
    setBusy(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const imported = await api<{ stops: PlannerStop[]; importedCount: number; shipmentCount: number }>('/import', {
        method: 'POST',
        body: formData,
      })
      const importedStops = imported.stops.map(stop => ({ ...stop, id: crypto.randomUUID() }))
      const origin = stops[0] ?? newStop(0, 'draft-origin')
      setStops([{ ...origin, type: 'current_location' }, ...importedStops])
      setResult(null)
      flash(imported.shipmentCount > 0
        ? `Imported ${imported.shipmentCount} shipments as ${imported.importedCount} pickup and delivery stops`
        : `Imported ${imported.importedCount} stops`)
    } catch (caught) {
      fail(caught)
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const saveLocation = async () => {
    try {
      let { latitude, longitude } = locationForm
      if (latitude === undefined || longitude === undefined) {
        const found = window.google?.maps ? await geocodeUsAddress(locationForm.address).catch(() => null) : null
        if (found) ({ latitude, longitude } = found)
      }
      await api('/locations', {
        method: 'POST',
        body: JSON.stringify({ ...locationForm, ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {}) }),
      })
      setLocationForm({ name: '', address: '', notes: '' })
      await refreshLibrary()
      flash('Location saved')
    } catch (caught) {
      fail(caught)
    }
  }

  const deleteLocation = async (id: string) => {
    try {
      await api(`/locations/${id}`, { method: 'DELETE' })
      await refreshLibrary()
      flash('Location removed')
    } catch (caught) {
      fail(caught)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login?redirect=/route-planner')
    router.refresh()
  }

  if (!profileLoaded) {
    return <div className="grid min-h-screen place-items-center bg-[#eef3f2] text-sm font-semibold text-[#526c6b]">Loading planner...</div>
  }

  if (!onboarded) {
    return (
      <main className="min-h-screen bg-[#eef3f2] px-4 py-12 text-[#173435]">
        <section className="mx-auto max-w-2xl border border-[#bdcecb] bg-white p-7 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#008c82]">Route planner setup</p>
          <h1 className="mt-2 text-3xl font-semibold">Set your planning defaults</h1>
          <p className="mt-3 text-sm leading-6 text-[#617775]">These defaults shape capacity and fuel estimates. You can change them for each route.</p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-semibold">Business or team name</span>
              <input value={businessName} onChange={event => setBusinessName(event.target.value)} placeholder="Optional" className="h-11 w-full border border-[#b9c9c7] px-3 outline-none focus:border-[#008c82]" />
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold">Vehicle type</span>
              <select value={vehicleType} onChange={event => setVehicleType(event.target.value)} className="h-11 w-full border border-[#b9c9c7] bg-white px-3 outline-none focus:border-[#008c82]">
                <option value="default">Standard vehicle</option>
                <option value="car_hauler_loaded">Loaded car hauler</option>
                <option value="pickup_with_trailer">Pickup with trailer</option>
                <option value="flatbed_loaded">Loaded flatbed</option>
                <option value="enclosed_loaded">Enclosed trailer</option>
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold">Vehicle capacity</span>
              <NumericInput aria-label="Vehicle capacity" min={1} max={100} value={vehicleSlots} onCommit={setVehicleSlots} className="h-11 w-full border border-[#b9c9c7] px-3 outline-none focus:border-[#008c82]" />
            </label>
          </div>
          {error && <p className="mt-5 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button onClick={completeOnboarding} disabled={busy} className="mt-7 flex h-11 items-center gap-2 bg-[#008c82] px-5 text-sm font-bold text-white hover:bg-[#00756d] disabled:opacity-50">
            <Navigation className="h-4 w-4" />{busy ? 'Saving...' : 'Open route planner'}
          </button>
        </section>
      </main>
    )
  }

  const stopTags = result ? assignStopTags(result.stops.map(stop => ({ ...stop, shipmentId: stop.shipmentId ?? stop.referenceId }))) : null

  return (
    <main className="min-h-screen bg-[#eef3f2] text-[#173435]">
      <header className="border-b border-[#bfd0cd] bg-[#123638] text-white">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3"><Route className="h-6 w-6 text-[#66d3c8]" /><div><p className="font-semibold">DriveDrop Route Planner</p><p className="text-xs text-[#a8c7c3]">{businessName || 'Personal workspace'}</p></div></div>
          <div className="flex items-center gap-2"><Link href="/dashboard" className="hidden px-3 py-2 text-sm text-[#c6dbd8] hover:text-white sm:block">DriveDrop dashboard</Link><button onClick={signOut} title="Sign out" className="grid h-9 w-9 place-items-center border border-white/20 hover:bg-white/10"><LogOut className="h-4 w-4" /></button></div>
        </div>
      </header>

      {drivingMode && result && <div className="fixed inset-0 z-50 bg-[#101d1e]"><DriverMapNavigation
        stops={navigationStops(result)}
        plannedDistance={result.summary.totalDistance}
        plannedDurationMinutes={result.summary.totalDuration}
        plannedEndTime={result.summary.estimatedEndTime}
        departureTime={departureTime ? new Date(departureTime).toISOString() : undefined}
        carolinaInsights={result.carolinaInsights}
        benjiTips={result.benjiTips}
        fuelStops={result.fuelStops}
        onClose={() => setDrivingMode(false)}
        height="h-[100dvh]"
        {...trackingProps}
      /></div>}

      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#bfd0cd]">
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#008c82]">Planning workspace</p><h1 className="mt-1 text-2xl font-semibold">Build today&apos;s route</h1></div>
          <nav className="flex w-full max-w-full overflow-x-auto sm:w-auto" aria-label="Planner views">
            {([['plan', Navigation, 'Plan'], ['routes', Calendar, 'Saved routes'], ['operations', RefreshCw, 'Operations'], ['locations', BookOpen, 'Address book'], ['billing', CreditCard, 'Billing']] as const).map(([key, Icon, label]) => (
              <button key={key} onClick={() => setTab(key)} className={`flex h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${tab === key ? 'border-[#008c82] text-[#006e67]' : 'border-transparent text-[#617775]'}`}><Icon className="h-4 w-4" />{label}</button>
            ))}
          </nav>
        </div>

        {(message || error) && <div className={`mt-4 border p-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || message}</div>}

        {tab === 'plan' && (
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(380px,.75fr)]">
            <section className="border border-[#c6d4d2] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8e2e0] px-5 py-4">
                <div><h2 className="font-semibold">Origin and shipments</h2><p className="text-xs text-[#6b807e]">Start with where your truck is now, then add or import each load&apos;s pickup and delivery.</p></div>
                <div className="flex flex-wrap gap-2">
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void importCsv(file) }} />
                  <button onClick={detectCurrentOrigin} disabled={detectingOrigin} title="Use current GPS location as the origin" className="flex h-9 items-center gap-2 border border-[#b9c9c7] px-3 text-sm font-semibold hover:bg-[#f3f7f6] disabled:opacity-50"><Crosshair className={`h-4 w-4 ${detectingOrigin ? 'animate-spin' : ''}`} />{detectingOrigin ? 'Locating...' : 'Use my location'}</button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex h-9 items-center gap-2 border border-[#b9c9c7] px-3 text-sm font-semibold hover:bg-[#f3f7f6]"><Upload className="h-4 w-4" />Import file</button>
                  <a href="/templates/route-planner-five-shipments.csv" download className="flex h-9 items-center border border-[#b9c9c7] px-3 text-sm font-semibold text-[#486361] hover:bg-[#f3f7f6]">Sample CSV</a>
                  <button onClick={() => addStop()} className="flex h-9 items-center gap-2 border border-[#173f40] px-3 text-sm font-semibold text-[#173f40] hover:bg-[#f3f7f6]"><Plus className="h-4 w-4" />Add stop</button>
                  <button onClick={addShipment} title="Adds a pickup and its delivery together" className="flex h-9 items-center gap-2 bg-[#173f40] px-3 text-sm font-semibold text-white hover:bg-[#0f3031]"><Plus className="h-4 w-4" />Add shipment</button>
                </div>
              </div>
              <div className="divide-y divide-[#e4ebe9]">
                {stops.map((stop, index) => (
                  <div key={stop.id} className="px-5 py-4">
                    <div className="grid gap-3 md:grid-cols-[34px_minmax(120px,.45fr)_minmax(220px,1fr)_110px_36px] md:items-center">
                      <span className="grid h-8 w-8 place-items-center bg-[#e4f3f1] text-sm font-bold text-[#00756d]">{index + 1}</span>
                      <div>{index === 0 ? <span className="mb-1 block text-[10px] font-bold uppercase text-[#64807d]">Origin</span> : <select aria-label={`Stop ${index + 1} type`} value={stop.type} onChange={event => updateStop(stop.id, { type: event.target.value as StopType })} className="mb-1 block h-5 border-0 bg-transparent p-0 text-[10px] font-bold uppercase text-[#64807d]"><option value="stop">Stop</option><option value="pickup">Pickup</option><option value="delivery">Delivery</option><option value="fuel">Fuel</option><option value="rest">Rest</option></select>}<input aria-label={`Stop ${index + 1} name`} value={stop.name} onChange={event => updateStop(stop.id, { name: event.target.value })} placeholder="Stop name" className="h-10 w-full border border-[#c6d4d2] px-3 text-sm outline-none focus:border-[#008c82]" /></div>
                      <div className="relative"><MapPin className="absolute left-3 top-3 h-4 w-4 text-[#708482]" /><input ref={element => { if (element) stopInputRefs.current.set(stop.id, element); else stopInputRefs.current.delete(stop.id) }} aria-label={`Stop ${index + 1} address`} list="saved-locations" value={stop.address} onChange={event => { const typed = event.target.value; const saved = locations.find(location => location.address === typed && typeof location.latitude === 'number' && typeof location.longitude === 'number'); updateStop(stop.id, { address: typed, latitude: saved?.latitude ?? undefined, longitude: saved?.longitude ?? undefined }) }} onBlur={() => window.setTimeout(() => void resolveStopAddress(stop.id), 250)} placeholder={index === 0 ? 'Starting address' : 'Street, city, state'} className="h-10 w-full border border-[#c6d4d2] pl-9 pr-3 text-sm outline-none focus:border-[#008c82]" />{addressNotes[stop.id] && <p className="mt-1 text-xs font-medium text-amber-700">{addressNotes[stop.id]}</p>}</div>
                      <label className="flex items-center gap-2 text-xs text-[#617775]"><NumericInput aria-label={`Stop ${index + 1} service minutes`} min={0} max={1440} value={stop.serviceMinutes} onCommit={minutes => updateStop(stop.id, { serviceMinutes: minutes })} className="h-10 w-16 border border-[#c6d4d2] px-2 text-sm" /> min</label>
                      <button onClick={() => removeStop(stop.id)} disabled={stops.length <= 2 || index === 0} title="Remove stop" className="grid h-9 w-9 place-items-center text-[#8a5c58] hover:bg-red-50 disabled:opacity-25"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 pl-0 md:pl-[46px]">
                      {(stop.type === 'pickup' || stop.type === 'delivery') && <input aria-label={`Stop ${index + 1} shipment reference`} value={stop.referenceId ?? ''} onChange={event => updateStop(stop.id, { referenceId: event.target.value })} placeholder="Shipment reference (pairs pickup and delivery)" className="h-9 w-64 border border-[#c6d4d2] px-2 text-xs" />}
                      <label className="flex items-center gap-2 text-xs font-semibold text-[#617775]"><input type="checkbox" checked={Boolean(stop.timeWindow)} onChange={event => updateStop(stop.id, { timeWindow: event.target.checked ? { earliest: new Date().toISOString(), latest: new Date(Date.now() + 2 * 60 * 60_000).toISOString() } : undefined })} className="h-4 w-4 accent-[#008c82]" />Time window</label>
                      {stop.timeWindow && <><input aria-label={`Stop ${index + 1} earliest time`} type="datetime-local" value={localDateTime(new Date(stop.timeWindow.earliest))} onChange={event => updateStop(stop.id, { timeWindow: { ...stop.timeWindow!, earliest: new Date(event.target.value).toISOString() } })} className="h-9 border border-[#c6d4d2] px-2 text-xs" /><span className="text-xs text-[#718482]">to</span><input aria-label={`Stop ${index + 1} latest time`} type="datetime-local" value={localDateTime(new Date(stop.timeWindow.latest))} onChange={event => updateStop(stop.id, { timeWindow: { ...stop.timeWindow!, latest: new Date(event.target.value).toISOString() } })} className="h-9 border border-[#c6d4d2] px-2 text-xs" /></>}
                    </div>
                  </div>
                ))}
              </div>
              <datalist id="saved-locations">{locations.map(location => <option key={location.id} value={location.address}>{location.name}</option>)}</datalist>
              {result && !drivingMode && <div className="border-t border-[#d8e2e0] p-4"><DriverMapNavigation
                stops={navigationStops(result)}
                plannedDistance={result.summary.totalDistance}
                plannedDurationMinutes={result.summary.totalDuration}
                plannedEndTime={result.summary.estimatedEndTime}
                departureTime={departureTime ? new Date(departureTime).toISOString() : undefined}
                carolinaInsights={result.carolinaInsights}
                benjiTips={result.benjiTips}
                fuelStops={result.fuelStops}
                height="h-[460px]"
              /></div>}
            </section>

            <aside className="space-y-5">
              <section className="border border-[#c6d4d2] bg-white p-5">
                <h2 className="font-semibold">Route settings</h2>
                <label className="mt-4 block"><span className="mb-1 block text-xs font-semibold text-[#617775]">Route name</span><input value={routeName} onChange={event => setRouteName(event.target.value)} placeholder="Monday deliveries" className="h-10 w-full border border-[#c6d4d2] px-3 text-sm outline-none focus:border-[#008c82]" /></label>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label><span className="mb-1 block text-xs font-semibold text-[#617775]">Vehicle</span><select value={vehicleType} onChange={event => setVehicleType(event.target.value)} className="h-10 w-full border border-[#c6d4d2] bg-white px-2 text-sm"><option value="default">Standard</option><option value="car_hauler_loaded">Car hauler</option><option value="pickup_with_trailer">Pickup + trailer</option><option value="flatbed_loaded">Flatbed</option><option value="enclosed_loaded">Enclosed</option></select></label>
                  <label><span className="mb-1 block text-xs font-semibold text-[#617775]">Capacity</span><NumericInput aria-label="Vehicle capacity" min={1} max={100} value={vehicleSlots} onCommit={setVehicleSlots} className="h-10 w-full border border-[#c6d4d2] px-3 text-sm" /></label>
                </div>
                <label className="mt-4 block"><span className="mb-1 block text-xs font-semibold text-[#617775]">Routing mode</span><select value={routingPreference} onChange={event => setRoutingPreference(event.target.value as typeof routingPreference)} className="h-10 w-full border border-[#c6d4d2] bg-white px-2 text-sm"><option value="fastest">Fastest available</option><option value="preferHighway">Prefer highways</option><option value="avoidHighways">Avoid highways</option></select></label>
                <label className="mt-3 block"><span className="mb-1 block text-xs font-semibold text-[#617775]">Departure time</span><input type="datetime-local" value={departureTime} onChange={event => setDepartureTime(event.target.value)} className="h-10 w-full border border-[#c6d4d2] px-2 text-sm" /></label>
                <label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={prioritizeFuel} onChange={event => setPrioritizeFuel(event.target.checked)} className="h-4 w-4 accent-[#008c82]" />Recommend fuel stops</label>
                <label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={returnToOrigin} onChange={event => setReturnToOrigin(event.target.checked)} className="h-4 w-4 accent-[#008c82]" />Return to origin</label>
                <div className="mt-3 grid grid-cols-2 gap-3"><label><span className="mb-1 block text-xs font-semibold text-[#617775]">Maximum hours</span><input type="number" min="0.1" step="0.5" value={maxHours} onChange={event => setMaxHours(event.target.value)} placeholder="No limit" className="h-10 w-full border border-[#c6d4d2] px-2 text-sm" /></label><label><span className="mb-1 block text-xs font-semibold text-[#617775]">Maximum detour</span><div className="flex items-center gap-2"><input type="number" min="0" value={maxDetourMinutes} onChange={event => setMaxDetourMinutes(event.target.value)} placeholder="No limit" className="h-10 min-w-0 flex-1 border border-[#c6d4d2] px-2 text-sm" /><span className="text-xs text-[#617775]">min</span></div></label></div>
                <label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={verifyCommercialRoute} onChange={event => setVerifyCommercialRoute(event.target.checked)} className="h-4 w-4 accent-[#008c82]" />Verify commercial road restrictions</label>
                {verifyCommercialRoute && <div className="mt-3 grid grid-cols-2 gap-3 border-l-2 border-[#008c82] pl-3"><label><span className="mb-1 block text-xs text-[#617775]">Height (ft)</span><input type="number" min="1" step="0.1" value={commercialVehicle.heightFeet} onChange={event => setCommercialVehicle(current => ({ ...current, heightFeet: event.target.value }))} className="h-9 w-full border border-[#c6d4d2] px-2 text-sm" /></label><label><span className="mb-1 block text-xs text-[#617775]">Width (ft)</span><input type="number" min="1" step="0.1" value={commercialVehicle.widthFeet} onChange={event => setCommercialVehicle(current => ({ ...current, widthFeet: event.target.value }))} className="h-9 w-full border border-[#c6d4d2] px-2 text-sm" /></label><label><span className="mb-1 block text-xs text-[#617775]">Length (ft)</span><input type="number" min="1" step="0.1" value={commercialVehicle.lengthFeet} onChange={event => setCommercialVehicle(current => ({ ...current, lengthFeet: event.target.value }))} className="h-9 w-full border border-[#c6d4d2] px-2 text-sm" /></label><label><span className="mb-1 block text-xs text-[#617775]">Gross weight (lb)</span><input type="number" min="1" value={commercialVehicle.grossWeightPounds} onChange={event => setCommercialVehicle(current => ({ ...current, grossWeightPounds: event.target.value }))} className="h-9 w-full border border-[#c6d4d2] px-2 text-sm" /></label><label><span className="mb-1 block text-xs text-[#617775]">Axles</span><input type="number" min="1" step="1" value={commercialVehicle.axleCount} onChange={event => setCommercialVehicle(current => ({ ...current, axleCount: event.target.value }))} className="h-9 w-full border border-[#c6d4d2] px-2 text-sm" /></label><label><span className="mb-1 block text-xs text-[#617775]">Hazmat types</span><input value={commercialVehicle.hazmatTypes} onChange={event => setCommercialVehicle(current => ({ ...current, hazmatTypes: event.target.value }))} placeholder="flammable, gas" className="h-9 w-full border border-[#c6d4d2] px-2 text-sm" /></label></div>}
                <label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={recurring} onChange={event => setRecurring(event.target.checked)} className="h-4 w-4 accent-[#008c82]" />Repeat this route</label>
                {recurring && <div className="mt-3 grid grid-cols-2 gap-3"><select value={frequency} onChange={event => setFrequency(event.target.value as Recurrence['frequency'])} className="h-10 border border-[#c6d4d2] bg-white px-2 text-sm"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select><input type="datetime-local" value={recurrenceStart} onChange={event => setRecurrenceStart(event.target.value)} className="h-10 border border-[#c6d4d2] px-2 text-xs" /></div>}
                <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={saveRoute} disabled={busy} className="flex h-10 items-center justify-center gap-2 border border-[#008c82] text-sm font-bold text-[#00756d] hover:bg-[#edf8f6] disabled:opacity-50"><Save className="h-4 w-4" />{currentRouteId ? 'Update' : 'Save'}</button><button onClick={optimize} disabled={busy} className="flex h-10 items-center justify-center gap-2 bg-[#008c82] text-sm font-bold text-white hover:bg-[#00756d] disabled:opacity-50"><Navigation className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Optimize</button></div>
                <p className="mt-3 text-xs leading-5 text-[#718482]">Shipment CSV/XLSX: <strong>reference_id, name, pickup_address, delivery_address</strong>. Generic stop files can use address, name, service_minutes, type, and notes.</p>
              </section>

              {result && <section className="border border-[#9fc7c2] bg-[#f8fbfa] p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Optimized route</h2><span className="bg-[#dff2ee] px-2 py-1 text-xs font-bold text-[#00756d]">{result.summary.efficiencyScore}/100</span></div><div className="mt-4 grid grid-cols-2 gap-px bg-[#cbd8d6]"><Metric icon={Route} label="Distance" value={`${result.summary.totalDistance} mi`} /><Metric icon={Clock} label="Duration" value={`${Math.round(result.summary.totalDuration / 6) / 10} hr`} /><Metric icon={Fuel} label="Fuel" value={`$${result.summary.totalFuelCost.toFixed(2)}`} /><Metric icon={Navigation} label="Finish" value={new Date(result.summary.estimatedEndTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} /></div>{result.commercialCompliance.status === 'verified' && <p className="mt-3 border border-emerald-200 bg-emerald-50 p-2 text-xs font-semibold text-emerald-800">Commercial route verified by HERE for {result.commercialCompliance.restrictions.join(', ')}.</p>}{result.constraintWarnings.map(warning => <p key={warning} className="mt-2 border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">{warning}</p>)}<OptimizedStopList stops={result.stops} tags={stopTags} /></section>}
              {result && <><RouteIntelligence result={result} onDrive={startDriving} /><RouteCoach result={result} /></>}
            </aside>
          </div>
        )}

        {tab === 'routes' && <section className="mt-5 border border-[#c6d4d2] bg-white"><div className="border-b border-[#d8e2e0] px-5 py-4"><h2 className="font-semibold">Reusable routes</h2><p className="text-xs text-[#6b807e]">Saved drafts and reusable plans retain a complete version history.</p></div>{savedRoutes.length === 0 ? <EmptyState icon={Route} text="No saved routes yet" action={() => setTab('plan')} actionLabel="Create a route" /> : <div className="divide-y divide-[#e1e9e7]">{savedRoutes.map(route => <div key={route.id} className="flex flex-wrap items-center gap-4 px-5 py-4"><div className="min-w-0 flex-1"><p className="font-semibold">{route.name}</p><p className="mt-1 text-xs text-[#687d7b]">{route.stops.length} stops · Version {route.current_version} · Updated {new Date(route.updated_at).toLocaleDateString()}{route.next_run_at ? ` · Next run ${new Date(route.next_run_at).toLocaleString()}` : ''}</p></div><span className="bg-[#edf3f2] px-2 py-1 text-xs font-semibold uppercase text-[#486361]">{route.status}</span>{route.is_recurring && <span className="bg-[#e8f4f2] px-2 py-1 text-xs font-semibold text-[#00756d]">{route.recurrence?.frequency}</span>}<button onClick={() => loadRoute(route)} className="flex h-9 items-center gap-2 border border-[#aebfbc] px-3 text-sm font-semibold hover:bg-[#f2f6f5]"><RefreshCw className="h-4 w-4" />Load</button><button onClick={() => void deleteRoute(route.id)} title="Delete route" className="grid h-9 w-9 place-items-center text-[#9f4740] hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>)}</div>}</section>}

        {tab === 'operations' && <RouteOperations routes={savedRoutes} onRoutesChanged={refreshLibrary} />}

        {tab === 'billing' && <PlannerBilling />}

        {tab === 'locations' && <div className="mt-5 grid gap-5 lg:grid-cols-[380px_1fr]"><section className="border border-[#c6d4d2] bg-white p-5"><h2 className="font-semibold">Save a location</h2><div className="mt-4 space-y-3"><input value={locationForm.name} onChange={event => setLocationForm(current => ({ ...current, name: event.target.value }))} placeholder="Location name" className="h-10 w-full border border-[#c6d4d2] px-3 text-sm" /><input ref={locationInputRef} value={locationForm.address} onChange={event => setLocationForm(current => { const { latitude: _lat, longitude: _lng, ...rest } = current; return { ...rest, address: event.target.value } })} placeholder="Full address" className="h-10 w-full border border-[#c6d4d2] px-3 text-sm" /><textarea value={locationForm.notes} onChange={event => setLocationForm(current => ({ ...current, notes: event.target.value }))} placeholder="Access notes (optional)" className="min-h-24 w-full border border-[#c6d4d2] p-3 text-sm" /><button onClick={saveLocation} disabled={!locationForm.name.trim() || !locationForm.address.trim()} className="flex h-10 items-center gap-2 bg-[#008c82] px-4 text-sm font-bold text-white disabled:opacity-40"><Save className="h-4 w-4" />Save location</button></div></section><section className="border border-[#c6d4d2] bg-white"><div className="border-b border-[#d8e2e0] px-5 py-4"><h2 className="font-semibold">Address book</h2></div>{locations.length === 0 ? <EmptyState icon={MapPin} text="No saved locations yet" /> : <div className="divide-y divide-[#e1e9e7]">{locations.map(location => <div key={location.id} className="flex items-center gap-4 px-5 py-4"><MapPin className="h-5 w-5 shrink-0 text-[#008c82]" /><div className="min-w-0 flex-1"><p className="font-semibold">{location.name}</p><p className="truncate text-sm text-[#667b79]">{location.address}</p></div><button onClick={() => addStop(location)} className="flex h-9 items-center gap-2 border border-[#aebfbc] px-3 text-sm font-semibold"><Plus className="h-4 w-4" />Add to route</button><button onClick={() => void deleteLocation(location.id)} title="Delete location" className="grid h-9 w-9 place-items-center text-[#9f4740] hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>)}</div>}</section></div>}
      </div>
    </main>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof Route; label: string; value: string }) {
  return <div className="bg-white p-3"><Icon className="h-4 w-4 text-[#008c82]" /><p className="mt-2 text-xs text-[#6b807e]">{label}</p><p className="font-semibold">{value}</p></div>
}

function RouteIntelligence({ result, onDrive }: { result: OptimizedRoute; onDrive: () => void }) {
  const traffic = result.liveEvidence?.traffic.evidence
  const tolls = result.liveEvidence?.tolls.evidence
  const weather = result.liveEvidence?.weather.evidence
  const fuel = result.liveEvidence?.fuel.evidence

  return <section className="border border-[#b9d8d4] bg-white p-5 text-xs">
    <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-[#254947]">Costs and savings</h2><p className="mt-1 text-[#667b79]">Compared with the legal pickup-before-delivery baseline.</p></div><button onClick={onDrive} className="flex h-9 shrink-0 items-center gap-2 bg-[#173f40] px-3 text-sm font-bold text-white"><Navigation className="h-4 w-4" />Driving mode</button></div>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <IntelligenceMetric label="Planned fuel cost" value={`$${result.summary.totalFuelCost.toFixed(2)}`} />
      <IntelligenceMetric label="Efficiency" value={`${result.summary.efficiencyScore}/100`} />
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <IntelligenceMetric label="Distance saved" value={`${result.savings.distanceSaved} mi`} />
      <IntelligenceMetric label="Time saved" value={`${Math.round(result.savings.timeSaved)} min`} />
      <IntelligenceMetric label="Fuel saved" value={`$${result.savings.fuelCostSaved.toFixed(2)}`} />
      <IntelligenceMetric label="Empty miles saved" value={`${result.savings.emptyMilesSaved} mi`} />
    </div>
    <div className="mt-3 border border-[#d6e1df] bg-[#f8fbfa] p-3">
      <p className="font-bold text-[#254947]">Live route evidence</p>
      <div className="mt-2 grid gap-1 text-[#5f7472]">
        <p>Traffic: {traffic ? `${Math.round(traffic.delaySeconds / 60)} min delay across ${traffic.evaluatedLegs}/${traffic.totalLegs} legs` : result.liveEvidence?.traffic.errorCode || 'Unavailable'}</p>
        <p>Tolls: {tolls ? `${tolls.currency} ${tolls.estimatedAmount.toFixed(2)} - ${tolls.tollCount} tolls` : result.liveEvidence?.tolls.errorCode || 'Unavailable'}</p>
        <p>Weather: {weather ? `${weather.condition} - ${Math.round(weather.temperatureFahrenheit)} F - ${Math.round(weather.windSpeedMph)} mph wind` : result.liveEvidence?.weather.errorCode || 'Unavailable'}</p>
        <p>Diesel: {fuel ? `$${fuel.pricePerGallon.toFixed(2)}/gal${fuel.stationName ? ` - ${fuel.stationName}` : ''}` : result.liveEvidence?.fuel.errorCode || 'Unavailable'}</p>
      </div>
    </div>
    {result.carolinaInsights.length > 0 && <CollapsibleSection storageKey="regional-intelligence" title="Regional route intelligence" count={result.carolinaInsights.length} className="mt-3 border border-[#d6e1df] p-3">{result.carolinaInsights.map(insight => <div key={`${insight.title}-${insight.affectedSegment || ''}`} className="mt-2"><p className="font-semibold">{insight.title}</p><p className="text-[#617775]">{insight.description}</p></div>)}</CollapsibleSection>}
    {result.fuelStops.length > 0 && <CollapsibleSection storageKey="fuel-stops" title="Recommended fuel stops" count={result.fuelStops.length} className="mt-3 border border-[#d6e1df] p-3">{result.fuelStops.map(stop => <div key={`${stop.name}-${stop.address}`} className="mt-2"><p className="font-semibold">{stop.name} - ${stop.estimatedPrice.toFixed(2)}/gal</p><p className="text-[#617775]">{stop.reason}</p></div>)}</CollapsibleSection>}
    {result.benjiTips.length > 0 && <CollapsibleSection storageKey="route-guidance" title="Route guidance" count={result.benjiTips.length} className="mt-3 border border-[#b9d8d4] bg-[#edf8f6] p-3"><ul className="space-y-1 text-[#496764]">{result.benjiTips.map(tip => <li key={tip}>- {tip}</li>)}</ul></CollapsibleSection>}
  </section>
}

function IntelligenceMetric({ label, value }: { label: string; value: string }) {
  return <div className="border border-[#d6e1df] bg-[#f8fbfa] p-2"><p className="text-[#6b807e]">{label}</p><p className="mt-1 font-bold text-[#254947]">{value}</p></div>
}

function RouteCoach({ result }: { result: OptimizedRoute }) {
  const supabase = getSupabaseBrowserClient()
  const sessionId = useRef(`standalone-route-${crypto.randomUUID()}`)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  const ask = async () => {
    if (!question.trim()) return
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Your session expired. Sign in again.')
      const routeContext = result.stops.map(stop => `${stop.order}. ${stop.address}`).join('\n')
      const response = await fetch(`${API_BASE_URL}/benji-v3/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          sessionId: sessionId.current,
          message: `${question.trim()}\nOptimized standalone route:\n${routeContext}\nDistance: ${result.summary.totalDistance} miles. Duration: ${result.summary.totalDuration} minutes.`,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Route coaching is unavailable')
      setAnswer(body.response || 'No guidance returned.')
      setQuestion('')
    } catch (caught) {
      setAnswer(caught instanceof Error ? caught.message : 'Route coaching is unavailable')
    } finally {
      setLoading(false)
    }
  }

  return <section className="border border-[#b9d8d4] bg-[#edf8f6] p-5">
    <h2 className="font-semibold text-[#254947]">Ask Benji about this route</h2>
    <div className="mt-3 flex gap-2"><input value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void ask() }} placeholder="Traffic, fuel, timing, or route advice" className="h-10 min-w-0 flex-1 border border-[#b9cbc8] bg-white px-3 text-sm" /><button onClick={() => void ask()} disabled={loading || !question.trim()} className="h-10 bg-[#173f40] px-4 text-sm font-bold text-white disabled:opacity-40">{loading ? 'Asking...' : 'Ask'}</button></div>
    {answer && <p className="mt-3 whitespace-pre-wrap border-t border-[#c7ddda] pt-3 text-sm leading-6 text-[#496764]">{answer}</p>}
  </section>
}

function EmptyState({ icon: Icon, text, action, actionLabel }: { icon: typeof Route; text: string; action?: () => void; actionLabel?: string }) {
  return <div className="grid min-h-48 place-items-center p-6 text-center"><div><Icon className="mx-auto h-7 w-7 text-[#7c918f]" /><p className="mt-3 text-sm text-[#667b79]">{text}</p>{action && <button onClick={action} className="mt-3 text-sm font-bold text-[#00756d] hover:underline">{actionLabel}</button>}</div></div>
}