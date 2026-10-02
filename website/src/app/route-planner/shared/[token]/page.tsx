'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, Clock, MapPin, Route } from '@/components/icons/streamline-lucide'
import LiveRouteMap from '@/components/route-planner/LiveRouteMap'
import { assignStopTags } from '@/lib/stop-tags'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'
const POLL_MS = 10_000
const STALE_LOCATION_SECONDS = 120

interface PlannedStop {
	id: string
	type?: string
	shipmentId?: string
	latitude?: number
	longitude?: number
}

interface LastLocation {
	latitude: number
	longitude: number
	heading: number | null
	speedMps: number | null
	recordedAt: string
	simulated: boolean
}

interface SharedStop {
	stopId?: string
	id?: string
	order?: number
	name?: string
	vehicleInfo?: string
	address: string
	status?: string
	plannedArrival?: string
	arrivedAt?: string
	completedAt?: string
}

interface SharedRouteData {
	permission: 'view' | 'track'
	route: {
		name: string
		status: string
		current_version: number
		stops: SharedStop[]
		last_optimized_result?: { stops?: SharedStop[]; summary?: { totalDistance?: number; totalDuration?: number } }
		updated_at: string
	}
	execution: null | {
		status: string
		planned_start_at: string | null
		started_at: string | null
		completed_at: string | null
		stop_progress: SharedStop[]
		updated_at: string
		planned_snapshot?: { optimizedResult?: { stops?: PlannedStop[] } }
		last_location?: LastLocation | null
	}
}

const ACTIVE_STATUSES = ['dispatched', 'in_progress']

function ageLabel(seconds: number): string {
	if (seconds < 5) return 'just now'
	if (seconds < 60) return `${seconds}s ago`
	if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
	return `${Math.floor(seconds / 3600)} h ago`
}

export default function SharedRoutePage({ params }: { params: { token: string } }) {
	const [data, setData] = useState<SharedRouteData | null>(null)
	const [error, setError] = useState('')
	const [connectionLost, setConnectionLost] = useState(false)
	const [now, setNow] = useState(() => Date.now())

	const load = useCallback(async () => {
		try {
			const response = await fetch(`${API_BASE_URL}/standalone-route-planner/shared/${encodeURIComponent(params.token)}`)
			const body = await response.json().catch(() => ({}))
			if (!response.ok) throw new Error(body.error?.message || body.error || 'This route link is unavailable')
			setData(body.data)
			setConnectionLost(false)
			setError('')
		} catch (caught) {
			// Keep showing the last good data when a refresh fails.
			setData(current => {
				if (current) setConnectionLost(true)
				else setError(caught instanceof Error ? caught.message : 'Unable to load shared route')
				return current
			})
		}
	}, [params.token])

	useEffect(() => { void load() }, [load])

	const live = data?.permission === 'track' && ACTIVE_STATUSES.includes(data.execution?.status ?? '')
	useEffect(() => {
		if (!live) return
		const refresh = () => { if (document.visibilityState === 'visible') void load() }
		const poll = setInterval(refresh, POLL_MS)
		const clock = setInterval(() => setNow(Date.now()), 1000)
		document.addEventListener('visibilitychange', refresh)
		return () => {
			clearInterval(poll)
			clearInterval(clock)
			document.removeEventListener('visibilitychange', refresh)
		}
	}, [live, load])

	if (error) return <main className="grid min-h-screen place-items-center bg-[#eef3f2] p-6"><div className="max-w-md border border-red-200 bg-white p-6 text-center"><Route className="mx-auto h-8 w-8 text-red-700" /><h1 className="mt-3 text-xl font-semibold text-[#173435]">Route unavailable</h1><p className="mt-2 text-sm text-red-700">{error}</p></div></main>
	if (!data) return <main className="grid min-h-screen place-items-center bg-[#eef3f2] text-sm text-[#617775]">Loading shared route...</main>

	const stops = data.execution?.stop_progress ?? data.route.last_optimized_result?.stops ?? data.route.stops
	const completed = stops.filter(stop => stop.status === 'completed').length

	const plannedById = new Map((data.execution?.planned_snapshot?.optimizedResult?.stops ?? []).map(stop => [stop.id, stop]))
	const stopKey = (stop: SharedStop, index: number) => stop.stopId ?? stop.id ?? `stop-${index}`
	const stopTags = assignStopTags(stops.map((stop, index) => {
		const planned = plannedById.get(stopKey(stop, index))
		return { id: stopKey(stop, index), type: planned?.type ?? 'stop', shipmentId: planned?.shipmentId }
	}))
	const mapStops = stops.flatMap((stop, index) => {
		const id = stopKey(stop, index)
		const planned = plannedById.get(id)
		if (planned?.type === 'current_location') return []
		return [{ id, address: stop.address, lat: planned?.latitude, lng: planned?.longitude, tag: stopTags.get(id) ?? String(stop.order ?? index + 1), status: stop.status }]
	})

	const location = data.execution?.last_location ?? null
	const locationAge = location ? Math.max(0, Math.round((now - new Date(location.recordedAt).getTime()) / 1000)) : null
	const locationStale = locationAge !== null && locationAge > STALE_LOCATION_SECONDS

	return (
		<main className="min-h-screen bg-[#eef3f2] text-[#173435]">
			<header className="border-b border-[#bfd0cd] bg-[#123638] text-white"><div className="mx-auto flex min-h-16 max-w-5xl items-center gap-3 px-4 sm:px-6"><Route className="h-6 w-6 text-[#66d3c8]" /><div><p className="font-semibold">DriveDrop Route</p><p className="text-xs text-[#a8c7c3]">Shared {data.permission === 'track' ? 'live progress' : 'plan'}</p></div></div></header>
			<div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
				{connectionLost && <p role="status" className="mb-4 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Connection lost. Showing the last update and retrying.</p>}
				{live && (
					<section className="mb-5 border border-[#c6d4d2] bg-white">
						<div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d8e2e0] px-5 py-3">
							<h2 className="font-semibold">Live location</h2>
							<p className={`text-xs font-semibold ${location && !locationStale ? 'text-[#00756d]' : 'text-amber-700'}`}>
								{location && locationAge !== null ? `Updated ${ageLabel(locationAge)}` : 'Waiting for the driver\'s first location'}
							</p>
						</div>
						{location?.simulated && <p className="bg-violet-50 px-5 py-2 text-xs font-semibold text-violet-700">Simulated drive. This is test data, not a real vehicle.</p>}
						{locationStale && <p className="bg-amber-50 px-5 py-2 text-xs text-amber-800">No new location for a while. The driver may be offline or the phone locked. Showing the last known position.</p>}
						<LiveRouteMap stops={mapStops} driver={location ? { lat: location.latitude, lng: location.longitude, heading: location.heading } : null} />
					</section>
				)}
				<section className="border border-[#c6d4d2] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase text-[#008c82]">{data.execution?.status ?? data.route.status}</p><h1 className="mt-1 text-2xl font-semibold">{data.route.name}</h1><p className="mt-2 text-sm text-[#617775]">Version {data.route.current_version} · Updated {new Date(data.execution?.updated_at ?? data.route.updated_at).toLocaleString()}</p></div><div className="border border-[#d8e2e0] px-4 py-3 text-right"><p className="text-xs text-[#687d7b]">Stops complete</p><p className="text-xl font-semibold">{completed}/{stops.length}</p></div></div></section>
				<section className="mt-5 border border-[#c6d4d2] bg-white"><div className="border-b border-[#d8e2e0] px-5 py-4"><h2 className="font-semibold">Route progress</h2></div><ol className="divide-y divide-[#e1e9e7]">{stops.map((stop, index) => <li key={`${stop.stopId ?? stop.id}-${index}`} className="flex gap-4 px-5 py-4"><span className={`grid h-8 min-w-8 shrink-0 place-items-center px-1 text-xs font-bold ${stop.status === 'completed' ? 'bg-[#dff2ee] text-[#00756d]' : 'bg-[#173f40] text-white'}`}>{stop.status === 'completed' ? <CheckCircle className="h-4 w-4" /> : stopTags.get(stopKey(stop, index)) ?? stop.order ?? index + 1}</span><div className="min-w-0 flex-1"><p className="font-semibold">{stop.name || stop.vehicleInfo || `Stop ${index + 1}`}</p><p className="mt-1 flex items-center gap-1 text-sm text-[#617775]"><MapPin className="h-3.5 w-3.5" />{stop.address}</p>{(stop.arrivedAt || stop.plannedArrival) && <p className="mt-1 flex items-center gap-1 text-xs text-[#718482]"><Clock className="h-3.5 w-3.5" />{stop.arrivedAt ? `Arrived ${new Date(stop.arrivedAt).toLocaleString()}` : `Planned ${new Date(stop.plannedArrival!).toLocaleString()}`}</p>}</div>{stop.status && <span className="text-xs font-semibold uppercase text-[#00756d]">{stop.status}</span>}</li>)}</ol></section>
			</div>
		</main>
	)
}
