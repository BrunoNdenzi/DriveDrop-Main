'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Clock, MapPin, Route } from '@/components/icons/streamline-lucide'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'

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
	}
}

export default function SharedRoutePage({ params }: { params: { token: string } }) {
	const [data, setData] = useState<SharedRouteData | null>(null)
	const [error, setError] = useState('')

	useEffect(() => {
		fetch(`${API_BASE_URL}/standalone-route-planner/shared/${encodeURIComponent(params.token)}`)
			.then(async response => {
				const body = await response.json().catch(() => ({}))
				if (!response.ok) throw new Error(body.error?.message || body.error || 'This route link is unavailable')
				setData(body.data)
			})
			.catch(caught => setError(caught instanceof Error ? caught.message : 'Unable to load shared route'))
	}, [params.token])

	if (error) return <main className="grid min-h-screen place-items-center bg-[#eef3f2] p-6"><div className="max-w-md border border-red-200 bg-white p-6 text-center"><Route className="mx-auto h-8 w-8 text-red-700" /><h1 className="mt-3 text-xl font-semibold text-[#173435]">Route unavailable</h1><p className="mt-2 text-sm text-red-700">{error}</p></div></main>
	if (!data) return <main className="grid min-h-screen place-items-center bg-[#eef3f2] text-sm text-[#617775]">Loading shared route...</main>

	const stops = data.execution?.stop_progress ?? data.route.last_optimized_result?.stops ?? data.route.stops
	const completed = stops.filter(stop => stop.status === 'completed').length

	return (
		<main className="min-h-screen bg-[#eef3f2] text-[#173435]">
			<header className="border-b border-[#bfd0cd] bg-[#123638] text-white"><div className="mx-auto flex min-h-16 max-w-5xl items-center gap-3 px-4 sm:px-6"><Route className="h-6 w-6 text-[#66d3c8]" /><div><p className="font-semibold">DriveDrop Route</p><p className="text-xs text-[#a8c7c3]">Shared {data.permission === 'track' ? 'live progress' : 'plan'}</p></div></div></header>
			<div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
				<section className="border border-[#c6d4d2] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase text-[#008c82]">{data.execution?.status ?? data.route.status}</p><h1 className="mt-1 text-2xl font-semibold">{data.route.name}</h1><p className="mt-2 text-sm text-[#617775]">Version {data.route.current_version} · Updated {new Date(data.execution?.updated_at ?? data.route.updated_at).toLocaleString()}</p></div><div className="border border-[#d8e2e0] px-4 py-3 text-right"><p className="text-xs text-[#687d7b]">Stops complete</p><p className="text-xl font-semibold">{completed}/{stops.length}</p></div></div></section>
				<section className="mt-5 border border-[#c6d4d2] bg-white"><div className="border-b border-[#d8e2e0] px-5 py-4"><h2 className="font-semibold">Route progress</h2></div><ol className="divide-y divide-[#e1e9e7]">{stops.map((stop, index) => <li key={`${stop.stopId ?? stop.id}-${index}`} className="flex gap-4 px-5 py-4"><span className={`grid h-8 w-8 shrink-0 place-items-center ${stop.status === 'completed' ? 'bg-[#dff2ee] text-[#00756d]' : 'bg-[#173f40] text-white'}`}>{stop.status === 'completed' ? <CheckCircle className="h-4 w-4" /> : stop.order ?? index + 1}</span><div className="min-w-0 flex-1"><p className="font-semibold">{stop.name || stop.vehicleInfo || `Stop ${index + 1}`}</p><p className="mt-1 flex items-center gap-1 text-sm text-[#617775]"><MapPin className="h-3.5 w-3.5" />{stop.address}</p>{(stop.arrivedAt || stop.plannedArrival) && <p className="mt-1 flex items-center gap-1 text-xs text-[#718482]"><Clock className="h-3.5 w-3.5" />{stop.arrivedAt ? `Arrived ${new Date(stop.arrivedAt).toLocaleString()}` : `Planned ${new Date(stop.plannedArrival!).toLocaleString()}`}</p>}</div>{stop.status && <span className="text-xs font-semibold uppercase text-[#00756d]">{stop.status}</span>}</li>)}</ol></section>
			</div>
		</main>
	)
}
