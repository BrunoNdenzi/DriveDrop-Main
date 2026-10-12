'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle, Clock, MapPin } from '@/components/icons/streamline-lucide'
import LiveRouteMap from '@/components/route-planner/LiveRouteMap'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'
const POLL_MS = 20_000

interface TrackData {
  business: string | null
  customerName: string | null
  routeStatus: string
  stop: {
    label: string
    address: string
    status: 'pending' | 'arrived' | 'completed' | 'skipped' | 'cancelled'
    estimatedArrival: string | null
    delayMinutes: number | null
    stopsAway: number
    arrivedAt: string | null
    completedAt: string | null
    latitude: number | null
    longitude: number | null
  }
  driver: { latitude: number; longitude: number; heading: number | null; recordedAt: string } | null
  proof: { photos: string[]; signature: string | null; receiverName: string | null; notes: string | null; capturedAt: string } | null
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

function headline(data: TrackData): { title: string; detail: string; tone: string } {
  const { stop } = data
  if (stop.status === 'completed') return { title: 'Delivered', detail: stop.completedAt ? `Completed at ${time(stop.completedAt)}` : 'This stop is complete.', tone: 'bg-emerald-600' }
  if (stop.status === 'skipped') return { title: 'Stop skipped', detail: 'The driver was not able to complete this stop. Please contact the sender.', tone: 'bg-gray-600' }
  if (stop.status === 'cancelled') return { title: 'Route cancelled', detail: 'This delivery is no longer scheduled. Please contact the sender.', tone: 'bg-gray-600' }
  if (stop.status === 'arrived') return { title: 'Your driver has arrived', detail: stop.arrivedAt ? `Arrived at ${time(stop.arrivedAt)}` : '', tone: 'bg-emerald-600' }
  if (data.routeStatus === 'dispatched') return { title: 'Route not started yet', detail: stop.estimatedArrival ? `Planned for about ${time(stop.estimatedArrival)}` : 'The driver has not left yet.', tone: 'bg-[#173f40]' }
  return {
    title: stop.estimatedArrival ? `Arriving about ${time(stop.estimatedArrival)}` : 'On the way',
    detail: stop.stopsAway > 0 ? `${stop.stopsAway} stop${stop.stopsAway === 1 ? '' : 's'} before yours` : 'You are next',
    tone: 'bg-[#173f40]',
  }
}

export default function TrackStopPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<TrackData | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/standalone-route-planner/track/${encodeURIComponent(params.token)}`, { cache: 'no-store' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(response.status === 404 ? 'This tracking link is no longer available.' : body?.error?.message || 'Could not load tracking')
      setData(body.data as TrackData)
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load tracking')
    }
  }, [params.token])

  useEffect(() => {
    void load()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void load() }, POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  const mapStops = useMemo(() => {
    if (!data || data.stop.latitude === null || data.stop.longitude === null) return []
    return [{ id: 'stop', address: data.stop.address, lat: data.stop.latitude, lng: data.stop.longitude, tag: 'D', status: data.stop.status }]
  }, [data])

  if (error && !data) {
    return <main className="grid min-h-screen place-items-center bg-[#eef3f2] p-6"><div className="max-w-sm text-center"><MapPin className="mx-auto h-8 w-8 text-[#7c918f]" /><p className="mt-3 text-sm text-[#486361]">{error}</p></div></main>
  }
  if (!data) return <main className="grid min-h-screen place-items-center bg-[#eef3f2] text-sm text-[#667b79]">Loading...</main>

  const state = headline(data)
  const live = data.driver && data.stop.status === 'pending'

  return (
    <main className="min-h-screen bg-[#eef3f2] text-[#173435]">
      <header className="bg-[#123638] px-4 py-3 text-white">
        <div className="mx-auto max-w-xl">
          <p className="text-xs uppercase tracking-wide text-[#a8c7c3]">Delivery tracking</p>
          <p className="font-semibold">{data.business || 'Your driver'}</p>
        </div>
      </header>

      <div className="mx-auto max-w-xl space-y-4 px-4 py-5">
        <section className={`${state.tone} p-5 text-white`} aria-live="polite">
          <p className="text-2xl font-semibold">{state.title}</p>
          {state.detail && <p className="mt-1 text-sm text-white/85">{state.detail}</p>}
          {data.stop.status === 'pending' && data.stop.delayMinutes !== null && data.stop.delayMinutes >= 10 && (
            <p className="mt-2 flex items-center gap-1.5 text-sm"><Clock className="h-4 w-4" />Running about {data.stop.delayMinutes} min behind the plan</p>
          )}
        </section>

        <section className="border border-[#c6d4d2] bg-white p-4">
          {data.customerName && <p className="text-sm text-[#667b79]">For {data.customerName}</p>}
          <p className="font-semibold">{data.stop.label}</p>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-[#486361]"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{data.stop.address}</p>
        </section>

        {live && mapStops.length > 0 && (
          <section className="overflow-hidden border border-[#c6d4d2] bg-white">
            <div className="h-72"><LiveRouteMap stops={mapStops} driver={{ lat: data.driver!.latitude, lng: data.driver!.longitude, heading: data.driver!.heading }} /></div>
            <p className="px-3 py-2 text-xs text-[#667b79]">Driver location updated {time(data.driver!.recordedAt)}. It is shown only while the driver is on the way.</p>
          </section>
        )}

        {data.proof && (
          <section className="border border-[#c6d4d2] bg-white p-4">
            <p className="flex items-center gap-1.5 font-semibold"><CheckCircle className="h-4 w-4 text-emerald-600" />Proof of delivery</p>
            {data.proof.receiverName && <p className="mt-2 text-sm text-[#486361]">Received by {data.proof.receiverName}</p>}
            {data.proof.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-[#486361]">{data.proof.notes}</p>}
            {data.proof.photos.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {data.proof.photos.map((url, index) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Delivery photo ${index + 1}`} className="h-36 w-full object-cover" />
                  </a>
                ))}
              </div>
            )}
            {data.proof.signature && (
              <div className="mt-3">
                <p className="text-xs text-[#667b79]">Signature</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.proof.signature} alt="Signature" className="mt-1 h-24 border border-[#e1e9e7] bg-white object-contain" />
              </div>
            )}
          </section>
        )}

        {error && <p className="text-center text-xs text-[#9f4740]">Could not refresh. Showing the last update.</p>}
        <p className="text-center text-xs text-[#7c918f]">This page updates by itself. The ETA is an estimate and can change.</p>
      </div>
    </main>
  )
}
