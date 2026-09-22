'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { CheckCircle, Download, Navigation, RefreshCw, Share2, Trash2 } from '@/components/icons/streamline-lucide'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'
const OFFLINE_QUEUE_KEY = 'drivedrop-driver-route-offline-actions'

interface DriverRoute {
  id: string
  name: string
  status: string
  current_version: number
  shipment_ids: string[]
  updated_at: string
}

interface StopProgress {
  stopId: string
  shipmentId?: string
  type: string
  order: number
  name?: string
  address: string
  status: 'pending' | 'arrived' | 'completed' | 'skipped'
  plannedArrival?: string
}

interface Execution {
  id: string
  route_id: string
  status: 'dispatched' | 'in_progress' | 'completed' | 'cancelled'
  version_number: number
  stop_progress: StopProgress[]
}

interface Version {
  id: string
  version_number: number
  change_type: string
  created_at: string
}

interface Report {
  plannedDistanceMiles: number
  actualDistanceMiles: number | null
  plannedDurationMinutes: number
  actualDurationMinutes: number | null
  completedStops: number
  skippedStops: number
}

interface QueuedAction {
  path: string
  method: string
  body: string
}

export default function DriverRouteOperations({ refreshKey = 0 }: { refreshKey?: number }) {
  const supabase = getSupabaseBrowserClient()
  const [routes, setRoutes] = useState<DriverRoute[]>([])
  const [routeId, setRouteId] = useState('')
  const [executions, setExecutions] = useState<Execution[]>([])
  const [versions, setVersions] = useState<Version[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [podUrls, setPodUrls] = useState<Record<string, string>>({})
  const [shareUrl, setShareUrl] = useState('')
  const [online, setOnline] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const api = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Your session expired. Sign in again.')
    const response = await fetch(`${API_BASE_URL}/driver-routes${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...init?.headers },
    })
    if (response.status === 204) return undefined as T
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error?.message || body.error || 'Request failed')
    return body.data as T
  }, [supabase])

  const loadRoutes = useCallback(async () => {
    const data = await api<DriverRoute[]>('/routes')
    setRoutes(data)
    setRouteId(current => data.some(route => route.id === current) ? current : data[0]?.id ?? '')
  }, [api])

  const loadRoute = useCallback(async (selectedId: string) => {
    if (!selectedId) {
      setExecutions([])
      setVersions([])
      return
    }
    const [executionData, versionData] = await Promise.all([
      api<Execution[]>(`/executions?routeId=${selectedId}`),
      api<Version[]>(`/routes/${selectedId}/versions`),
    ])
    setExecutions(executionData)
    setVersions(versionData)
  }, [api])

  useEffect(() => {
    void loadRoutes().catch(caught => setError(caught instanceof Error ? caught.message : 'Unable to load routes'))
  }, [loadRoutes, refreshKey])

  useEffect(() => {
    setReport(null)
    setShareUrl('')
    void loadRoute(routeId).catch(caught => setError(caught instanceof Error ? caught.message : 'Unable to load route operations'))
  }, [loadRoute, routeId])

  useEffect(() => {
    setOnline(navigator.onLine)
    const replay = async () => {
      setOnline(true)
      const queued = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]') as QueuedAction[]
      const remaining: QueuedAction[] = []
      for (const action of queued) {
        try {
          await api(action.path, { method: action.method, body: action.body })
        } catch {
          remaining.push(action)
        }
      }
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining))
      if (queued.length > remaining.length) {
        setMessage(`Synced ${queued.length - remaining.length} offline update${queued.length - remaining.length === 1 ? '' : 's'}.`)
        await Promise.all([loadRoutes(), loadRoute(routeId)])
      }
    }
    const offline = () => setOnline(false)
    window.addEventListener('online', replay)
    window.addEventListener('offline', offline)
    if (navigator.onLine) void replay()
    return () => {
      window.removeEventListener('online', replay)
      window.removeEventListener('offline', offline)
    }
  }, [api, loadRoute, loadRoutes, routeId])

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true)
    setError('')
    try {
      await action()
      setMessage(success)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Operation failed')
    } finally {
      setBusy(false)
    }
  }

  const refresh = async () => Promise.all([loadRoutes(), loadRoute(routeId)])
  const selectedRoute = routes.find(route => route.id === routeId)
  const activeExecution = executions.find(execution => execution.status === 'dispatched' || execution.status === 'in_progress')
  const displayedExecution = activeExecution ?? executions[0]

  const dispatch = () => run(async () => {
    await api(`/routes/${routeId}/dispatch`, { method: 'POST', body: JSON.stringify({ plannedStartAt: new Date().toISOString() }) })
    await refresh()
  }, 'Route dispatched')

  const start = () => run(async () => {
    await api(`/executions/${activeExecution!.id}/start`, { method: 'POST', body: '{}' })
    await refresh()
  }, 'Route started')

  const updateStop = (stop: StopProgress, action: 'arrived' | 'completed' | 'skipped') => run(async () => {
    const coordinates = await new Promise<Record<string, number>>(resolve => {
      if (!navigator.geolocation || action === 'skipped') return resolve({})
      navigator.geolocation.getCurrentPosition(
        position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, gpsAccuracyMeters: position.coords.accuracy }),
        () => resolve({}),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 30_000 },
      )
    })
    const path = `/executions/${activeExecution!.id}/stops/${encodeURIComponent(stop.stopId)}`
    const body = JSON.stringify({
      action,
      timestamp: new Date().toISOString(),
      ...(podUrls[stop.stopId]?.trim() ? { proofOfDeliveryUrls: [podUrls[stop.stopId].trim()] } : {}),
      ...coordinates,
    })
    if (!navigator.onLine) {
      const queued = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]') as QueuedAction[]
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([...queued, { path, method: 'PATCH', body }]))
      setOnline(false)
      return
    }
    await api(path, { method: 'PATCH', body })
    await refresh()
  }, navigator.onLine ? `Stop ${action}` : 'Saved offline for sync')

  const reoptimize = () => run(async () => {
    const currentLocation = await new Promise<Record<string, number>>(resolve => {
      if (!navigator.geolocation) return resolve({})
      navigator.geolocation.getCurrentPosition(
        position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        () => resolve({}),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 30_000 },
      )
    })
    await api(`/executions/${activeExecution!.id}/reoptimize`, { method: 'POST', body: JSON.stringify({ currentLocation }) })
    await refresh()
  }, 'Remaining route reoptimized')

  const restore = (version: number) => run(async () => {
    await api(`/routes/${routeId}/versions/${version}/restore`, { method: 'POST', body: '{}' })
    await refresh()
  }, `Version ${version} restored`)

  const share = () => run(async () => {
    const data = await api<{ token: string }>(`/routes/${routeId}/shares`, { method: 'POST', body: JSON.stringify({ permission: 'track' }) })
    const url = `${window.location.origin}/route-planner/driver/shared/${data.token}`
    setShareUrl(url)
    await navigator.clipboard?.writeText(url)
  }, 'Tracking link copied')

  const download = async (format: 'csv' | 'json') => {
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(`${API_BASE_URL}/driver-routes/routes/${routeId}/export?format=${format}`, { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } })
      if (!response.ok) throw new Error('Export failed')
      const blobUrl = URL.createObjectURL(await response.blob())
      const anchor = document.createElement('a')
      anchor.href = blobUrl
      anchor.download = `${selectedRoute?.name || 'driver-route'}.${format}`
      anchor.click()
      URL.revokeObjectURL(blobUrl)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = () => run(async () => {
    await api(`/routes/${routeId}`, { method: 'DELETE' })
    setRouteId('')
    await loadRoutes()
  }, 'Route deleted')

  if (routes.length === 0) {
    return <div className="border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Optimize assigned shipments to create your first saved route.</div>
  }

  return (
    <div className="space-y-5">
      {(message || error) && <div className={`border p-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || message}</div>}
      <section className="border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-64 flex-1"><span className="mb-1 flex justify-between text-xs font-semibold text-gray-600"><span>Saved route</span><span className={online ? 'text-emerald-700' : 'text-amber-700'}>{online ? 'Online' : 'Offline queue active'}</span></span><select value={routeId} onChange={event => setRouteId(event.target.value)} className="h-10 w-full border border-gray-300 bg-white px-3 text-sm">{routes.map(route => <option key={route.id} value={route.id}>{route.name} · {route.status} · v{route.current_version}</option>)}</select></label>
          <button onClick={() => void download('csv')} disabled={busy} className="flex h-10 items-center gap-2 border border-gray-300 px-3 text-sm font-semibold"><Download className="h-4 w-4" />CSV</button>
          <button onClick={() => void download('json')} disabled={busy} className="flex h-10 items-center gap-2 border border-gray-300 px-3 text-sm font-semibold"><Download className="h-4 w-4" />JSON</button>
          <button onClick={share} disabled={busy} className="flex h-10 items-center gap-2 border border-amber-400 px-3 text-sm font-semibold text-amber-700"><Share2 className="h-4 w-4" />Share</button>
          {!activeExecution && <button onClick={dispatch} disabled={busy || selectedRoute?.status === 'draft'} className="flex h-10 items-center gap-2 bg-amber-500 px-4 text-sm font-bold text-white disabled:opacity-40"><Navigation className="h-4 w-4" />Dispatch</button>}
          <button onClick={remove} disabled={busy || !!activeExecution} title="Delete route" className="grid h-10 w-10 place-items-center border border-red-200 text-red-700 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 text-xs text-gray-500">{selectedRoute?.shipment_ids.length ?? 0} assigned shipment{selectedRoute?.shipment_ids.length === 1 ? '' : 's'}</p>
        {shareUrl && <input aria-label="Driver route tracking URL" readOnly value={shareUrl} className="mt-3 h-9 w-full border border-gray-300 bg-gray-50 px-3 text-xs" />}
      </section>

      {displayedExecution && <section className="border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4"><div><h3 className="font-semibold">{activeExecution ? 'Current execution' : 'Latest execution'}</h3><p className="text-xs text-gray-500">{displayedExecution.status} · route version {displayedExecution.version_number}</p></div><div className="flex flex-wrap gap-2">{displayedExecution.status === 'dispatched' && <button onClick={start} disabled={busy} className="h-9 bg-gray-900 px-3 text-sm font-bold text-white">Start route</button>}{displayedExecution.status === 'in_progress' && <button onClick={reoptimize} disabled={busy} className="flex h-9 items-center gap-2 border border-amber-400 px-3 text-sm font-semibold text-amber-700"><RefreshCw className="h-4 w-4" />Reoptimize</button>}<button onClick={() => run(async () => setReport(await api(`/executions/${displayedExecution.id}/report`)), 'Report refreshed')} disabled={busy} className="h-9 border border-gray-300 px-3 text-sm font-semibold">Report</button></div></div>
        <div className="divide-y divide-gray-100">{displayedExecution.stop_progress.filter(stop => stop.type !== 'current_location').map(stop => <div key={stop.stopId} className="grid gap-3 px-5 py-4 md:grid-cols-[32px_minmax(0,1fr)_minmax(180px,.5fr)_auto] md:items-center"><span className="grid h-7 w-7 place-items-center bg-amber-100 text-xs font-bold text-amber-800">{stop.order}</span><div><p className="font-semibold">{stop.name || stop.address}</p><p className="text-xs text-gray-500">{stop.type} · {stop.address}</p><p className="mt-1 text-xs font-semibold uppercase text-amber-700">{stop.status}</p></div><input aria-label={`POD URL for ${stop.name || stop.address}`} value={podUrls[stop.stopId] ?? ''} onChange={event => setPodUrls(current => ({ ...current, [stop.stopId]: event.target.value }))} placeholder="Proof-of-delivery URL" disabled={!activeExecution} className="h-9 min-w-0 border border-gray-300 px-2 text-xs disabled:bg-gray-50" /><div className="flex gap-1">{activeExecution && <><button onClick={() => updateStop(stop, 'arrived')} disabled={busy || stop.status !== 'pending'} className="h-8 border border-gray-300 px-2 text-xs font-semibold disabled:opacity-30">Arrive</button><button onClick={() => updateStop(stop, 'completed')} disabled={busy || stop.status === 'completed' || stop.status === 'skipped'} className="h-8 bg-amber-500 px-2 text-xs font-bold text-white disabled:opacity-30">Done</button><button onClick={() => updateStop(stop, 'skipped')} disabled={busy || stop.status === 'completed' || stop.status === 'skipped'} className="h-8 px-2 text-xs font-semibold text-red-700 disabled:opacity-30">Skip</button></>}</div></div>)}</div>
      </section>}

      {report && <section className="border border-gray-200 bg-white p-5"><h3 className="font-semibold">Planned vs actual</h3><div className="mt-4 grid gap-3 sm:grid-cols-4"><Metric label="Planned miles" value={report.plannedDistanceMiles.toFixed(1)} /><Metric label="Actual miles" value={report.actualDistanceMiles?.toFixed(1) ?? 'Pending'} /><Metric label="Planned minutes" value={String(Math.round(report.plannedDurationMinutes))} /><Metric label="Actual minutes" value={report.actualDurationMinutes === null ? 'Pending' : String(report.actualDurationMinutes)} /></div></section>}

      <section className="border border-gray-200 bg-white"><div className="border-b border-gray-200 px-5 py-4"><h3 className="font-semibold">Version history</h3></div><div className="divide-y divide-gray-100">{versions.map(version => <div key={version.id} className="flex items-center gap-3 px-5 py-3"><CheckCircle className="h-4 w-4 text-emerald-600" /><div className="flex-1"><p className="text-sm font-semibold">Version {version.version_number} · {version.change_type}</p><p className="text-xs text-gray-500">{new Date(version.created_at).toLocaleString()}</p></div><button onClick={() => restore(version.version_number)} disabled={busy || !!activeExecution || version.version_number === selectedRoute?.current_version} className="h-8 border border-gray-300 px-2 text-xs font-semibold disabled:opacity-30">Restore</button></div>)}</div></section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border border-gray-200 p-3"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>
}
