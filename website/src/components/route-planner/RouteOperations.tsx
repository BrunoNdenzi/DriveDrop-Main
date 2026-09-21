'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { CheckCircle, Download, Navigation, RefreshCw, Share2 } from '@/components/icons/streamline-lucide'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'
const OFFLINE_QUEUE_KEY = 'drivedrop-planner-offline-actions'

type RouteStatus = 'draft' | 'planned' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled'

export interface OperationalRoute {
  id: string
  name: string
  status: RouteStatus
  current_version: number
  stops: Array<{ id: string; name?: string; address: string }>
  updated_at: string
}

interface RouteVersion {
  id: string
  version_number: number
  change_type: string
  created_at: string
}

interface StopProgress {
  stopId: string
  order: number
  name?: string
  address: string
  status: 'pending' | 'arrived' | 'completed' | 'skipped'
  plannedArrival?: string
  arrivedAt?: string
  completedAt?: string
  proofOfDeliveryUrls?: string[]
}

interface RouteExecution {
  id: string
  route_id: string
  status: 'dispatched' | 'in_progress' | 'completed' | 'cancelled'
  version_number: number
  planned_start_at: string | null
  started_at: string | null
  completed_at: string | null
  stop_progress: StopProgress[]
  reoptimizations: Array<{ reoptimizedAt: string; remainingStops: number }>
  actual_distance_miles: number | null
}

interface RouteReport {
  plannedDistanceMiles: number
  actualDistanceMiles: number | null
  plannedDurationMinutes: number
  actualDurationMinutes: number | null
  completedStops: number
  skippedStops: number
  stopAnalysis: Array<StopProgress & { arrivalVarianceMinutes: number | null; onTime: boolean | null }>
}

interface Props {
  routes: OperationalRoute[]
  onRoutesChanged: () => Promise<void>
}

interface QueuedAction {
  path: string
  method: string
  body: string
  queuedAt: string
}

export default function RouteOperations({ routes, onRoutesChanged }: Props) {
  const supabase = getSupabaseBrowserClient()
  const [routeId, setRouteId] = useState('')
  const [versions, setVersions] = useState<RouteVersion[]>([])
  const [executions, setExecutions] = useState<RouteExecution[]>([])
  const [report, setReport] = useState<RouteReport | null>(null)
  const [shareUrl, setShareUrl] = useState('')
  const [podUrl, setPodUrl] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [online, setOnline] = useState(true)

  const api = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Your session expired. Sign in again.')
    const response = await fetch(`${API_BASE_URL}/standalone-route-planner${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...init?.headers },
    })
    const body = response.status === 204 ? null : await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body?.error?.message || body?.error || 'Request failed')
    return body?.data as T
  }, [supabase])

  const selectedRoute = routes.find(route => route.id === routeId)
  const activeExecution = executions.find(execution => execution.status === 'in_progress' || execution.status === 'dispatched')
  const displayedExecution = activeExecution ?? executions[0]

  const refresh = useCallback(async (selectedId: string) => {
    if (!selectedId) return
    const [versionData, executionData] = await Promise.all([
      api<RouteVersion[]>(`/routes/${selectedId}/versions`),
      api<RouteExecution[]>(`/executions?routeId=${selectedId}`),
    ])
    setVersions(versionData)
    setExecutions(executionData)
  }, [api])

  const notify = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body })
  }

  const queueAction = (action: QueuedAction) => {
    const queued = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]') as QueuedAction[]
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([...queued, action]))
  }

  const mutateOrQueue = async (path: string, init: RequestInit): Promise<boolean> => {
    if (!navigator.onLine) {
      queueAction({ path, method: init.method ?? 'POST', body: String(init.body ?? '{}'), queuedAt: new Date().toISOString() })
      setMessage('Saved offline. This update will sync when connectivity returns.')
      return false
    }
    await api(path, init)
    return true
  }

  const currentCoordinates = () => new Promise<Record<string, number>>(resolve => {
    if (!navigator.geolocation) return resolve({})
    navigator.geolocation.getCurrentPosition(
      position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, gpsAccuracyMeters: position.coords.accuracy }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 30_000 },
    )
  })

  useEffect(() => {
    const nextId = routes.some(route => route.id === routeId) ? routeId : routes[0]?.id ?? ''
    setRouteId(nextId)
    if (nextId) void refresh(nextId).catch(caught => setError(caught instanceof Error ? caught.message : 'Unable to load operations'))
  }, [refresh, routeId, routes])

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
        if (routeId) await refresh(routeId)
      }
    }
    const markOffline = () => setOnline(false)
    window.addEventListener('online', replay)
    window.addEventListener('offline', markOffline)
    if (navigator.onLine) void replay()
    return () => {
      window.removeEventListener('online', replay)
      window.removeEventListener('offline', markOffline)
    }
  }, [api, refresh, routeId])

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

  const dispatch = () => run(async () => {
    await api(`/routes/${routeId}/dispatch`, { method: 'POST', body: JSON.stringify({ plannedStartAt: new Date().toISOString() }) })
    await Promise.all([refresh(routeId), onRoutesChanged()])
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
    notify('Route dispatched', selectedRoute?.name ?? 'Your route is ready to start.')
  }, 'Route dispatched')

  const start = () => run(async () => {
    await api(`/executions/${activeExecution!.id}/start`, { method: 'POST', body: '{}' })
    await Promise.all([refresh(routeId), onRoutesChanged()])
  }, 'Route started')

  const updateStop = (stop: StopProgress, action: 'arrived' | 'completed' | 'skipped') => run(async () => {
    const proofOfDeliveryUrls = podUrl[stop.stopId]?.trim() ? [podUrl[stop.stopId].trim()] : undefined
    const coordinates = action === 'skipped' ? {} : await currentCoordinates()
    const synced = await mutateOrQueue(`/executions/${activeExecution!.id}/stops/${encodeURIComponent(stop.stopId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, timestamp: new Date().toISOString(), proofOfDeliveryUrls, ...coordinates }),
    })
    if (synced) {
      await Promise.all([refresh(routeId), onRoutesChanged()])
      notify(action === 'completed' ? 'Stop completed' : 'Route progress updated', stop.name || stop.address)
    }
  }, action === 'completed' ? 'Stop completed' : action === 'arrived' ? 'Arrival recorded' : 'Stop skipped')

  const reoptimize = () => run(async () => {
    await api(`/executions/${activeExecution!.id}/reoptimize`, { method: 'POST', body: '{}' })
    await Promise.all([refresh(routeId), onRoutesChanged()])
  }, 'Remaining route reoptimized')

  const complete = () => run(async () => {
    await api(`/executions/${activeExecution!.id}/complete`, { method: 'POST', body: '{}' })
    await Promise.all([refresh(routeId), onRoutesChanged()])
  }, 'Route completed')

  const restore = (version: number) => run(async () => {
    await api(`/routes/${routeId}/versions/${version}/restore`, { method: 'POST', body: '{}' })
    await Promise.all([refresh(routeId), onRoutesChanged()])
  }, `Version ${version} restored as a new draft`)

  const loadReport = () => run(async () => {
    setReport(await api<RouteReport>(`/executions/${displayedExecution!.id}/report`))
  }, 'Report refreshed')

  const createShare = () => run(async () => {
    const share = await api<{ token: string }>(`/routes/${routeId}/shares`, { method: 'POST', body: JSON.stringify({ permission: 'track' }) })
    const url = `${window.location.origin}/route-planner/shared/${share.token}`
    setShareUrl(url)
    await navigator.clipboard?.writeText(url)
  }, 'Tracking link copied')

  const download = async (format: 'csv' | 'json') => {
    setBusy(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(`${API_BASE_URL}/standalone-route-planner/routes/${routeId}/export?format=${format}`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      if (!response.ok) throw new Error('Export failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${selectedRoute?.name || 'route'}.${format}`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  if (routes.length === 0) return <div className="mt-5 border border-[#c6d4d2] bg-white p-8 text-center text-sm text-[#667b79]">Save a route before dispatching it.</div>

  return (
    <div className="mt-5 space-y-5">
      {(message || error) && <div className={`border p-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || message}</div>}
      <section className="border border-[#c6d4d2] bg-white p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1"><span className="mb-1 flex items-center justify-between text-xs font-semibold text-[#617775]"><span>Operational route</span><span className={online ? 'text-emerald-700' : 'text-amber-700'}>{online ? 'Online' : 'Offline queue active'}</span></span><select value={routeId} onChange={event => { setRouteId(event.target.value); setReport(null); void refresh(event.target.value) }} className="h-10 w-full border border-[#c6d4d2] bg-white px-3 text-sm">{routes.map(route => <option key={route.id} value={route.id}>{route.name} · {route.status} · v{route.current_version}</option>)}</select></label>
          <button onClick={() => void download('csv')} disabled={busy} className="flex h-10 items-center gap-2 border border-[#aebfbc] px-3 text-sm font-semibold"><Download className="h-4 w-4" />CSV</button>
          <button onClick={() => void download('json')} disabled={busy} className="flex h-10 items-center gap-2 border border-[#aebfbc] px-3 text-sm font-semibold"><Download className="h-4 w-4" />JSON</button>
          <button onClick={createShare} disabled={busy} className="flex h-10 items-center gap-2 border border-[#008c82] px-3 text-sm font-semibold text-[#00756d]"><Share2 className="h-4 w-4" />Share tracking</button>
          {!activeExecution && <button onClick={dispatch} disabled={busy || selectedRoute?.status === 'draft'} className="flex h-10 items-center gap-2 bg-[#008c82] px-4 text-sm font-bold text-white disabled:opacity-40"><Navigation className="h-4 w-4" />Dispatch</button>}
        </div>
        {selectedRoute?.status === 'draft' && <p className="mt-3 text-xs text-amber-700">Optimize this draft before dispatching it.</p>}
        {shareUrl && <input aria-label="Share URL" readOnly value={shareUrl} className="mt-3 h-9 w-full border border-[#c6d4d2] bg-[#f6f9f8] px-3 text-xs" />}
      </section>

      {displayedExecution && (
        <section className="border border-[#c6d4d2] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8e2e0] px-5 py-4"><div><h2 className="font-semibold">{activeExecution ? 'Current execution' : 'Latest execution'}</h2><p className="text-xs text-[#687d7b]">{displayedExecution.status} · route version {displayedExecution.version_number}</p></div><div className="flex flex-wrap gap-2">{displayedExecution.status === 'dispatched' && <button onClick={start} disabled={busy} className="h-9 bg-[#173f40] px-3 text-sm font-bold text-white">Start route</button>}{displayedExecution.status === 'in_progress' && <button onClick={reoptimize} disabled={busy} className="flex h-9 items-center gap-2 border border-[#008c82] px-3 text-sm font-semibold text-[#00756d]"><RefreshCw className="h-4 w-4" />Reoptimize remaining</button>}<button onClick={loadReport} disabled={busy} className="h-9 border border-[#aebfbc] px-3 text-sm font-semibold">Report</button>{activeExecution && <button onClick={complete} disabled={busy} className="h-9 border border-[#a7d8c5] px-3 text-sm font-semibold text-[#17603f]">Complete route</button>}</div></div>
          <div className="divide-y divide-[#e1e9e7]">{displayedExecution.stop_progress.map(stop => <div key={stop.stopId} className="grid gap-3 px-5 py-4 md:grid-cols-[32px_minmax(0,1fr)_minmax(180px,.5fr)_auto] md:items-center"><span className="grid h-7 w-7 place-items-center bg-[#e4f3f1] text-xs font-bold text-[#00756d]">{stop.order}</span><div><p className="font-semibold">{stop.name || stop.address}</p><p className="text-xs text-[#687d7b]">{stop.address}</p><p className="mt-1 text-xs font-semibold uppercase text-[#00756d]">{stop.status}</p></div><input aria-label={`POD URL for ${stop.name || stop.address}`} value={podUrl[stop.stopId] ?? ''} onChange={event => setPodUrl(current => ({ ...current, [stop.stopId]: event.target.value }))} placeholder="Proof-of-delivery URL" disabled={!activeExecution} className="h-9 min-w-0 border border-[#c6d4d2] px-2 text-xs disabled:bg-[#f3f6f5]" /><div className="flex gap-1">{activeExecution && <><button onClick={() => updateStop(stop, 'arrived')} disabled={busy || stop.status !== 'pending'} className="h-8 border border-[#aebfbc] px-2 text-xs font-semibold disabled:opacity-30">Arrive</button><button onClick={() => updateStop(stop, 'completed')} disabled={busy || stop.status === 'completed' || stop.status === 'skipped'} className="h-8 bg-[#008c82] px-2 text-xs font-bold text-white disabled:opacity-30">Done</button><button onClick={() => updateStop(stop, 'skipped')} disabled={busy || stop.status === 'completed' || stop.status === 'skipped'} className="h-8 px-2 text-xs font-semibold text-[#9f4740] disabled:opacity-30">Skip</button></>}</div></div>)}</div>
        </section>
      )}

      {report && <section className="border border-[#c6d4d2] bg-white p-5"><h2 className="font-semibold">Planned vs actual</h2><div className="mt-4 grid gap-3 sm:grid-cols-4"><ReportMetric label="Planned miles" value={report.plannedDistanceMiles.toFixed(1)} /><ReportMetric label="Actual miles" value={report.actualDistanceMiles?.toFixed(1) ?? 'Pending'} /><ReportMetric label="Planned minutes" value={String(Math.round(report.plannedDurationMinutes))} /><ReportMetric label="Actual minutes" value={report.actualDurationMinutes === null ? 'Pending' : String(report.actualDurationMinutes)} /></div><div className="mt-4 space-y-2">{report.stopAnalysis.map(stop => <div key={stop.stopId} className="flex items-center justify-between border-t border-[#e1e9e7] pt-2 text-sm"><span>{stop.name || stop.address}</span><span className={stop.onTime === false ? 'font-semibold text-red-700' : 'text-[#617775]'}>{stop.arrivalVarianceMinutes === null ? 'No actual arrival' : `${stop.arrivalVarianceMinutes > 0 ? '+' : ''}${stop.arrivalVarianceMinutes} min`}</span></div>)}</div></section>}

      <section className="border border-[#c6d4d2] bg-white"><div className="border-b border-[#d8e2e0] px-5 py-4"><h2 className="font-semibold">Version history</h2></div><div className="divide-y divide-[#e1e9e7]">{versions.map(version => <div key={version.id} className="flex items-center gap-3 px-5 py-3"><CheckCircle className="h-4 w-4 text-[#008c82]" /><div className="flex-1"><p className="text-sm font-semibold">Version {version.version_number} · {version.change_type}</p><p className="text-xs text-[#687d7b]">{new Date(version.created_at).toLocaleString()}</p></div><button onClick={() => restore(version.version_number)} disabled={busy || version.version_number === selectedRoute?.current_version} className="h-8 border border-[#aebfbc] px-2 text-xs font-semibold disabled:opacity-30">Restore</button></div>)}</div></section>
    </div>
  )
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return <div className="border border-[#d8e2e0] p-3"><p className="text-xs text-[#687d7b]">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>
}
