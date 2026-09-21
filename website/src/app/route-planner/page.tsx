'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import {
  BookOpen,
  Calendar,
  Clock,
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

type PlannerTab = 'plan' | 'routes' | 'locations'
type StopType = 'current_location' | 'stop' | 'pickup' | 'delivery' | 'fuel' | 'rest'

interface PlannerStop {
  id: string
  name: string
  address: string
  type: StopType
  serviceMinutes: number
  latitude?: number
  longitude?: number
}

interface SavedLocation {
  id: string
  name: string
  address: string
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
  options: Record<string, unknown>
  recurrence: Recurrence | null
  next_run_at: string | null
  is_recurring: boolean
  updated_at: string
}

interface OptimizedRoute {
  stops: Array<PlannerStop & {
    order: number
    vehicleInfo?: string
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
    percentImprovement: number
  }
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

export default function StandaloneRoutePlannerPage() {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<PlannerTab>('plan')
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [onboarded, setOnboarded] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [vehicleType, setVehicleType] = useState('default')
  const [vehicleSlots, setVehicleSlots] = useState(1)
  const [stops, setStops] = useState<PlannerStop[]>([newStop(0, 'draft-origin'), newStop(1, 'draft-stop-2')])
  const [routeName, setRouteName] = useState('')
  const [currentRouteId, setCurrentRouteId] = useState<string | null>(null)
  const [recurring, setRecurring] = useState(false)
  const [frequency, setFrequency] = useState<Recurrence['frequency']>('weekly')
  const [recurrenceStart, setRecurrenceStart] = useState('')
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([])
  const [locations, setLocations] = useState<SavedLocation[]>([])
  const [locationForm, setLocationForm] = useState({ name: '', address: '', notes: '' })
  const [result, setResult] = useState<OptimizedRoute | null>(null)
  const [busy, setBusy] = useState(false)
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
    setResult(null)
  }

  const addStop = (location?: SavedLocation) => {
    const stop = newStop(stops.length)
    setStops(current => [...current, location ? { ...stop, name: location.name, address: location.address } : stop])
    setTab('plan')
    setResult(null)
  }

  const removeStop = (id: string) => {
    setStops(current => current.filter(stop => stop.id !== id).map((stop, index) => ({
      ...stop,
      type: index === 0 ? 'current_location' : stop.type === 'current_location' ? 'stop' : stop.type,
    })))
    setResult(null)
  }

  const routePayload = () => ({
    name: routeName.trim(),
    stops,
    options: { vehicleType, vehicleSlots },
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
  }

  const optimize = async () => {
    setBusy(true)
    try {
      validateRoute()
      const data = await api<OptimizedRoute>('/optimize', {
        method: 'POST',
        body: JSON.stringify({ stops, options: { vehicleType, vehicleSlots }, routeId: currentRouteId }),
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
    setRecurring(route.is_recurring)
    setFrequency(route.recurrence?.frequency ?? 'weekly')
    setRecurrenceStart(route.recurrence?.startsAt ? localDateTime(new Date(route.recurrence.startsAt)) : localDateTime())
    setResult(null)
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
      const imported = await api<{ stops: PlannerStop[]; importedCount: number }>('/import', {
        method: 'POST',
        body: formData,
      })
      const importedStops = imported.stops.map(stop => ({ ...stop, id: crypto.randomUUID(), type: 'stop' as StopType }))
      if (stops[0]?.address) {
        setStops([stops[0], ...importedStops])
      } else {
        setStops(importedStops.map((stop, index) => ({ ...stop, type: index === 0 ? 'current_location' : 'stop' })))
      }
      setResult(null)
      flash(`Imported ${imported.importedCount} stops`)
    } catch (caught) {
      fail(caught)
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const saveLocation = async () => {
    try {
      await api('/locations', { method: 'POST', body: JSON.stringify(locationForm) })
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
              <input type="number" min={1} max={100} value={vehicleSlots} onChange={event => setVehicleSlots(Number(event.target.value))} className="h-11 w-full border border-[#b9c9c7] px-3 outline-none focus:border-[#008c82]" />
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

  return (
    <main className="min-h-screen bg-[#eef3f2] text-[#173435]">
      <header className="border-b border-[#bfd0cd] bg-[#123638] text-white">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3"><Route className="h-6 w-6 text-[#66d3c8]" /><div><p className="font-semibold">DriveDrop Route Planner</p><p className="text-xs text-[#a8c7c3]">{businessName || 'Personal workspace'}</p></div></div>
          <div className="flex items-center gap-2"><Link href="/dashboard" className="hidden px-3 py-2 text-sm text-[#c6dbd8] hover:text-white sm:block">DriveDrop dashboard</Link><button onClick={signOut} title="Sign out" className="grid h-9 w-9 place-items-center border border-white/20 hover:bg-white/10"><LogOut className="h-4 w-4" /></button></div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#bfd0cd]">
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#008c82]">Planning workspace</p><h1 className="mt-1 text-2xl font-semibold">Build today&apos;s route</h1></div>
          <nav className="flex" aria-label="Planner views">
            {([['plan', Navigation, 'Plan'], ['routes', Calendar, 'Saved routes'], ['locations', BookOpen, 'Address book']] as const).map(([key, Icon, label]) => (
              <button key={key} onClick={() => setTab(key)} className={`flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${tab === key ? 'border-[#008c82] text-[#006e67]' : 'border-transparent text-[#617775]'}`}><Icon className="h-4 w-4" />{label}</button>
            ))}
          </nav>
        </div>

        {(message || error) && <div className={`mt-4 border p-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || message}</div>}

        {tab === 'plan' && (
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(380px,.75fr)]">
            <section className="border border-[#c6d4d2] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8e2e0] px-5 py-4">
                <div><h2 className="font-semibold">Stops</h2><p className="text-xs text-[#6b807e]">First address is fixed as the route origin.</p></div>
                <div className="flex gap-2">
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void importCsv(file) }} />
                  <button onClick={() => fileInputRef.current?.click()} className="flex h-9 items-center gap-2 border border-[#b9c9c7] px-3 text-sm font-semibold hover:bg-[#f3f7f6]"><Upload className="h-4 w-4" />Import file</button>
                  <button onClick={() => addStop()} className="flex h-9 items-center gap-2 bg-[#173f40] px-3 text-sm font-semibold text-white hover:bg-[#0f3031]"><Plus className="h-4 w-4" />Add stop</button>
                </div>
              </div>
              <div className="divide-y divide-[#e4ebe9]">
                {stops.map((stop, index) => (
                  <div key={stop.id} className="grid gap-3 px-5 py-4 md:grid-cols-[34px_minmax(120px,.45fr)_minmax(220px,1fr)_110px_36px] md:items-center">
                    <span className="grid h-8 w-8 place-items-center bg-[#e4f3f1] text-sm font-bold text-[#00756d]">{index + 1}</span>
                    <input aria-label={`Stop ${index + 1} name`} value={stop.name} onChange={event => updateStop(stop.id, { name: event.target.value })} placeholder="Stop name" className="h-10 border border-[#c6d4d2] px-3 text-sm outline-none focus:border-[#008c82]" />
                    <div className="relative"><MapPin className="absolute left-3 top-3 h-4 w-4 text-[#708482]" /><input aria-label={`Stop ${index + 1} address`} list="saved-locations" value={stop.address} onChange={event => updateStop(stop.id, { address: event.target.value, latitude: undefined, longitude: undefined })} placeholder={index === 0 ? 'Starting address' : 'Street, city, state'} className="h-10 w-full border border-[#c6d4d2] pl-9 pr-3 text-sm outline-none focus:border-[#008c82]" /></div>
                    <label className="flex items-center gap-2 text-xs text-[#617775]"><input aria-label={`Stop ${index + 1} service minutes`} type="number" min={0} max={1440} value={stop.serviceMinutes} onChange={event => updateStop(stop.id, { serviceMinutes: Number(event.target.value) })} className="h-10 w-16 border border-[#c6d4d2] px-2 text-sm" /> min</label>
                    <button onClick={() => removeStop(stop.id)} disabled={stops.length <= 2 || index === 0} title="Remove stop" className="grid h-9 w-9 place-items-center text-[#8a5c58] hover:bg-red-50 disabled:opacity-25"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <datalist id="saved-locations">{locations.map(location => <option key={location.id} value={location.address}>{location.name}</option>)}</datalist>
            </section>

            <aside className="space-y-5">
              <section className="border border-[#c6d4d2] bg-white p-5">
                <h2 className="font-semibold">Route settings</h2>
                <label className="mt-4 block"><span className="mb-1 block text-xs font-semibold text-[#617775]">Route name</span><input value={routeName} onChange={event => setRouteName(event.target.value)} placeholder="Monday deliveries" className="h-10 w-full border border-[#c6d4d2] px-3 text-sm outline-none focus:border-[#008c82]" /></label>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label><span className="mb-1 block text-xs font-semibold text-[#617775]">Vehicle</span><select value={vehicleType} onChange={event => setVehicleType(event.target.value)} className="h-10 w-full border border-[#c6d4d2] bg-white px-2 text-sm"><option value="default">Standard</option><option value="car_hauler_loaded">Car hauler</option><option value="pickup_with_trailer">Pickup + trailer</option><option value="flatbed_loaded">Flatbed</option><option value="enclosed_loaded">Enclosed</option></select></label>
                  <label><span className="mb-1 block text-xs font-semibold text-[#617775]">Capacity</span><input type="number" min={1} max={100} value={vehicleSlots} onChange={event => setVehicleSlots(Number(event.target.value))} className="h-10 w-full border border-[#c6d4d2] px-3 text-sm" /></label>
                </div>
                <label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={recurring} onChange={event => setRecurring(event.target.checked)} className="h-4 w-4 accent-[#008c82]" />Repeat this route</label>
                {recurring && <div className="mt-3 grid grid-cols-2 gap-3"><select value={frequency} onChange={event => setFrequency(event.target.value as Recurrence['frequency'])} className="h-10 border border-[#c6d4d2] bg-white px-2 text-sm"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select><input type="datetime-local" value={recurrenceStart} onChange={event => setRecurrenceStart(event.target.value)} className="h-10 border border-[#c6d4d2] px-2 text-xs" /></div>}
                <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={saveRoute} disabled={busy} className="flex h-10 items-center justify-center gap-2 border border-[#008c82] text-sm font-bold text-[#00756d] hover:bg-[#edf8f6] disabled:opacity-50"><Save className="h-4 w-4" />{currentRouteId ? 'Update' : 'Save'}</button><button onClick={optimize} disabled={busy} className="flex h-10 items-center justify-center gap-2 bg-[#008c82] text-sm font-bold text-white hover:bg-[#00756d] disabled:opacity-50"><Navigation className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Optimize</button></div>
                <p className="mt-3 text-xs leading-5 text-[#718482]">CSV/XLSX headers: <strong>address</strong>, with optional name, service_minutes, type, and notes.</p>
              </section>

              {result && <section className="border border-[#9fc7c2] bg-[#f8fbfa] p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Optimized route</h2><span className="bg-[#dff2ee] px-2 py-1 text-xs font-bold text-[#00756d]">{result.summary.efficiencyScore}/100</span></div><div className="mt-4 grid grid-cols-2 gap-px bg-[#cbd8d6]"><Metric icon={Route} label="Distance" value={`${result.summary.totalDistance} mi`} /><Metric icon={Clock} label="Duration" value={`${Math.round(result.summary.totalDuration / 6) / 10} hr`} /><Metric icon={Fuel} label="Fuel" value={`$${result.summary.totalFuelCost.toFixed(2)}`} /><Metric icon={Navigation} label="Finish" value={new Date(result.summary.estimatedEndTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} /></div><ol className="mt-4 space-y-3">{result.stops.map(stop => <li key={stop.id} className="flex gap-3 text-sm"><span className="grid h-6 w-6 shrink-0 place-items-center bg-[#173f40] text-xs font-bold text-white">{stop.order}</span><div><p className="font-semibold">{stop.vehicleInfo || stop.name || stop.address}</p><p className="text-xs text-[#657a78]">{stop.address}</p></div></li>)}</ol></section>}
            </aside>
          </div>
        )}

        {tab === 'routes' && <section className="mt-5 border border-[#c6d4d2] bg-white"><div className="border-b border-[#d8e2e0] px-5 py-4"><h2 className="font-semibold">Reusable routes</h2><p className="text-xs text-[#6b807e]">Load a template, change its stops, then optimize again.</p></div>{savedRoutes.length === 0 ? <EmptyState icon={Route} text="No saved routes yet" action={() => setTab('plan')} actionLabel="Create a route" /> : <div className="divide-y divide-[#e1e9e7]">{savedRoutes.map(route => <div key={route.id} className="flex flex-wrap items-center gap-4 px-5 py-4"><div className="min-w-0 flex-1"><p className="font-semibold">{route.name}</p><p className="mt-1 text-xs text-[#687d7b]">{route.stops.length} stops · Updated {new Date(route.updated_at).toLocaleDateString()}{route.next_run_at ? ` · Next run ${new Date(route.next_run_at).toLocaleString()}` : ''}</p></div>{route.is_recurring && <span className="bg-[#e8f4f2] px-2 py-1 text-xs font-semibold text-[#00756d]">{route.recurrence?.frequency}</span>}<button onClick={() => loadRoute(route)} className="flex h-9 items-center gap-2 border border-[#aebfbc] px-3 text-sm font-semibold hover:bg-[#f2f6f5]"><RefreshCw className="h-4 w-4" />Load</button><button onClick={() => void deleteRoute(route.id)} title="Delete route" className="grid h-9 w-9 place-items-center text-[#9f4740] hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>)}</div>}</section>}

        {tab === 'locations' && <div className="mt-5 grid gap-5 lg:grid-cols-[380px_1fr]"><section className="border border-[#c6d4d2] bg-white p-5"><h2 className="font-semibold">Save a location</h2><div className="mt-4 space-y-3"><input value={locationForm.name} onChange={event => setLocationForm(current => ({ ...current, name: event.target.value }))} placeholder="Location name" className="h-10 w-full border border-[#c6d4d2] px-3 text-sm" /><input value={locationForm.address} onChange={event => setLocationForm(current => ({ ...current, address: event.target.value }))} placeholder="Full address" className="h-10 w-full border border-[#c6d4d2] px-3 text-sm" /><textarea value={locationForm.notes} onChange={event => setLocationForm(current => ({ ...current, notes: event.target.value }))} placeholder="Access notes (optional)" className="min-h-24 w-full border border-[#c6d4d2] p-3 text-sm" /><button onClick={saveLocation} disabled={!locationForm.name.trim() || !locationForm.address.trim()} className="flex h-10 items-center gap-2 bg-[#008c82] px-4 text-sm font-bold text-white disabled:opacity-40"><Save className="h-4 w-4" />Save location</button></div></section><section className="border border-[#c6d4d2] bg-white"><div className="border-b border-[#d8e2e0] px-5 py-4"><h2 className="font-semibold">Address book</h2></div>{locations.length === 0 ? <EmptyState icon={MapPin} text="No saved locations yet" /> : <div className="divide-y divide-[#e1e9e7]">{locations.map(location => <div key={location.id} className="flex items-center gap-4 px-5 py-4"><MapPin className="h-5 w-5 shrink-0 text-[#008c82]" /><div className="min-w-0 flex-1"><p className="font-semibold">{location.name}</p><p className="truncate text-sm text-[#667b79]">{location.address}</p></div><button onClick={() => addStop(location)} className="flex h-9 items-center gap-2 border border-[#aebfbc] px-3 text-sm font-semibold"><Plus className="h-4 w-4" />Add to route</button><button onClick={() => void deleteLocation(location.id)} title="Delete location" className="grid h-9 w-9 place-items-center text-[#9f4740] hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>)}</div>}</section></div>}
      </div>
    </main>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof Route; label: string; value: string }) {
  return <div className="bg-white p-3"><Icon className="h-4 w-4 text-[#008c82]" /><p className="mt-2 text-xs text-[#6b807e]">{label}</p><p className="font-semibold">{value}</p></div>
}

function EmptyState({ icon: Icon, text, action, actionLabel }: { icon: typeof Route; text: string; action?: () => void; actionLabel?: string }) {
  return <div className="grid min-h-48 place-items-center p-6 text-center"><div><Icon className="mx-auto h-7 w-7 text-[#7c918f]" /><p className="mt-3 text-sm text-[#667b79]">{text}</p>{action && <button onClick={action} className="mt-3 text-sm font-bold text-[#00756d] hover:underline">{actionLabel}</button>}</div></div>
}