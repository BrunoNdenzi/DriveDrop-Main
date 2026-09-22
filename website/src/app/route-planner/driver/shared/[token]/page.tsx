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
  type?: string
  status?: string
  plannedArrival?: string
  arrivedAt?: string
}

interface SharedData {
  permission: 'view' | 'track'
  route: {
    name: string
    status: string
    current_version: number
    stops: SharedStop[]
    last_optimized_result?: { stops?: SharedStop[] }
    updated_at: string
  }
  execution: null | {
    status: string
    stop_progress: SharedStop[]
    updated_at: string
  }
}

export default function SharedDriverRoutePage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<SharedData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API_BASE_URL}/driver-routes/shared/${encodeURIComponent(params.token)}`)
      .then(async response => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error?.message || body.error || 'This tracking link is unavailable')
        setData(body.data)
      })
      .catch(caught => setError(caught instanceof Error ? caught.message : 'Unable to load route'))
  }, [params.token])

  if (error) return <main className="grid min-h-screen place-items-center bg-gray-100 p-6"><div className="max-w-md border border-red-200 bg-white p-6 text-center"><Route className="mx-auto h-8 w-8 text-red-700" /><h1 className="mt-3 text-xl font-semibold">Route unavailable</h1><p className="mt-2 text-sm text-red-700">{error}</p></div></main>
  if (!data) return <main className="grid min-h-screen place-items-center bg-gray-100 text-sm text-gray-600">Loading driver route...</main>

  const stops = (data.execution?.stop_progress ?? data.route.last_optimized_result?.stops ?? data.route.stops).filter(stop => stop.type !== 'current_location')
  const completed = stops.filter(stop => stop.status === 'completed').length

  return <main className="min-h-screen bg-gray-100 text-gray-900">
    <header className="border-b border-gray-800 bg-gray-950 text-white"><div className="mx-auto flex min-h-16 max-w-5xl items-center gap-3 px-4 sm:px-6"><Route className="h-6 w-6 text-amber-400" /><div><p className="font-semibold">DriveDrop Driver Route</p><p className="text-xs text-gray-400">Shared {data.permission === 'track' ? 'live progress' : 'plan'}</p></div></div></header>
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <section className="border border-gray-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase text-amber-700">{data.execution?.status ?? data.route.status}</p><h1 className="mt-1 text-2xl font-semibold">{data.route.name}</h1><p className="mt-2 text-sm text-gray-500">Version {data.route.current_version} · Updated {new Date(data.execution?.updated_at ?? data.route.updated_at).toLocaleString()}</p></div><div className="border border-gray-200 px-4 py-3 text-right"><p className="text-xs text-gray-500">Stops complete</p><p className="text-xl font-semibold">{completed}/{stops.length}</p></div></div></section>
      <section className="mt-5 border border-gray-200 bg-white"><div className="border-b border-gray-200 px-5 py-4"><h2 className="font-semibold">Route progress</h2></div><ol className="divide-y divide-gray-100">{stops.map((stop, index) => <li key={`${stop.stopId ?? stop.id}-${index}`} className="flex gap-4 px-5 py-4"><span className={`grid h-8 w-8 shrink-0 place-items-center ${stop.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-900 text-white'}`}>{stop.status === 'completed' ? <CheckCircle className="h-4 w-4" /> : stop.order ?? index + 1}</span><div className="min-w-0 flex-1"><p className="font-semibold">{stop.name || stop.vehicleInfo || `Stop ${index + 1}`}</p><p className="mt-1 flex items-center gap-1 text-sm text-gray-600"><MapPin className="h-3.5 w-3.5" />{stop.address}</p>{(stop.arrivedAt || stop.plannedArrival) && <p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><Clock className="h-3.5 w-3.5" />{stop.arrivedAt ? `Arrived ${new Date(stop.arrivedAt).toLocaleString()}` : `Planned ${new Date(stop.plannedArrival!).toLocaleString()}`}</p>}</div>{stop.status && <span className="text-xs font-semibold uppercase text-amber-700">{stop.status}</span>}</li>)}</ol></section>
    </div>
  </main>
}
