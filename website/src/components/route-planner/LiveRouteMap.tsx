'use client'

import { useEffect, useRef, useState } from 'react'

export interface LiveMapStop {
  id: string
  address: string
  lat?: number | undefined
  lng?: number | undefined
  tag: string
  status?: string | undefined
}

export interface LiveMapDriver {
  lat: number
  lng: number
  heading: number | null
}

type Point = { lat: number; lng: number }

const GLIDE_MS = 900

function stopColor(stop: LiveMapStop): string {
  if (stop.status === 'completed' || stop.status === 'skipped') return '#9CA3AF'
  if (stop.tag.startsWith('P')) return '#3B82F6'
  if (stop.tag.startsWith('D')) return '#10B981'
  return '#173f40'
}

export default function LiveRouteMap({ stops, driver }: { stops: LiveMapStop[]; driver: LiveMapDriver | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const stopMarkersRef = useRef<google.maps.Marker[]>([])
  const driverMarkerRef = useRef<google.maps.Marker | null>(null)
  const glideRef = useRef<number | null>(null)
  const geocodeCache = useRef(new Map<string, Point | null>())
  const fittedRef = useRef(false)
  const followRef = useRef(true)
  const [ready, setReady] = useState(false)
  const [following, setFollowing] = useState(true)

  const stopsKey = JSON.stringify(stops.map(stop => [stop.id, stop.lat, stop.lng, stop.tag, stop.status]))

  useEffect(() => {
    const create = () => {
      if (!containerRef.current || !window.google?.maps?.Map) return false
      const map = new google.maps.Map(containerRef.current, {
        center: { lat: 35.2271, lng: -80.8431 },
        zoom: 10,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: 'greedy',
      })
      map.addListener('dragstart', () => {
        followRef.current = false
        setFollowing(false)
      })
      mapRef.current = map
      setReady(true)
      return true
    }

    if (create()) return
    const timer = setInterval(() => {
      if (create()) clearInterval(timer)
    }, 200)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!ready || !mapRef.current) return
    let cancelled = false

    const place = async () => {
      const map = mapRef.current!
      const geocoder = new google.maps.Geocoder()
      const markers: google.maps.Marker[] = []
      const bounds = new google.maps.LatLngBounds()

      for (const stop of stops) {
        let point: Point | null | undefined = stop.lat !== undefined && stop.lng !== undefined
          ? { lat: stop.lat, lng: stop.lng }
          : geocodeCache.current.get(stop.address)
        if (point === undefined) {
          try {
            const { results } = await geocoder.geocode({ address: stop.address })
            const location = results[0]?.geometry.location
            point = location ? { lat: location.lat(), lng: location.lng() } : null
          } catch {
            point = null
          }
          geocodeCache.current.set(stop.address, point)
        }
        if (cancelled) return
        if (!point) continue

        markers.push(new google.maps.Marker({
          position: point,
          map,
          title: `${stop.tag} ${stop.address}`,
          label: { text: stop.tag, color: '#FFFFFF', fontWeight: 'bold', fontSize: stop.tag.length > 2 ? '10px' : '12px' },
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 13, fillColor: stopColor(stop), fillOpacity: 1, strokeWeight: 2, strokeColor: '#1F2937' },
          zIndex: 10,
        }))
        bounds.extend(point)
      }

      if (cancelled) {
        markers.forEach(marker => marker.setMap(null))
        return
      }
      stopMarkersRef.current.forEach(marker => marker.setMap(null))
      stopMarkersRef.current = markers
      if (!fittedRef.current && !bounds.isEmpty()) {
        map.fitBounds(bounds, 48)
        fittedRef.current = true
      }
    }

    void place()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, stopsKey])

  useEffect(() => {
    if (!ready || !mapRef.current) return
    if (!driver) {
      driverMarkerRef.current?.setMap(null)
      driverMarkerRef.current = null
      return
    }

    const target = { lat: driver.lat, lng: driver.lng }
    const marker = driverMarkerRef.current
    if (!marker) {
      driverMarkerRef.current = new google.maps.Marker({
        position: target,
        map: mapRef.current,
        title: 'Driver',
        icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 7, fillColor: '#F59E0B', fillOpacity: 1, strokeWeight: 2, strokeColor: '#FFFFFF', rotation: driver.heading ?? 0 },
        zIndex: 200,
      })
      mapRef.current.setCenter(target)
      mapRef.current.setZoom(14)
      fittedRef.current = true
    } else {
      const from = marker.getPosition()
      if (glideRef.current !== null) cancelAnimationFrame(glideRef.current)
      if (from) {
        const startedAt = performance.now()
        const tick = (now: number) => {
          const t = Math.min(1, (now - startedAt) / GLIDE_MS)
          marker.setPosition({ lat: from.lat() + (target.lat - from.lat()) * t, lng: from.lng() + (target.lng - from.lng()) * t })
          glideRef.current = t < 1 ? requestAnimationFrame(tick) : null
        }
        glideRef.current = requestAnimationFrame(tick)
      } else {
        marker.setPosition(target)
      }
      const icon = marker.getIcon() as google.maps.Symbol | null
      if (icon && driver.heading !== null) {
        icon.rotation = driver.heading
        marker.setIcon(icon)
      }
      if (followRef.current) mapRef.current.panTo(target)
    }
  }, [ready, driver?.lat, driver?.lng, driver?.heading]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (glideRef.current !== null) cancelAnimationFrame(glideRef.current)
    stopMarkersRef.current.forEach(marker => marker.setMap(null))
    driverMarkerRef.current?.setMap(null)
  }, [])

  const followDriver = () => {
    followRef.current = true
    setFollowing(true)
    if (driver) mapRef.current?.panTo({ lat: driver.lat, lng: driver.lng })
  }

  return (
    <div className="relative">
      <div ref={containerRef} className="h-72 w-full bg-[#dfe8e6] sm:h-96" />
      {!ready && <div className="absolute inset-0 grid place-items-center text-sm text-[#617775]">Loading map...</div>}
      {driver && !following && (
        <button type="button" onClick={followDriver} className="absolute left-3 top-3 h-9 bg-[#173f40] px-3 text-xs font-bold text-white shadow">
          Follow driver
        </button>
      )}
    </div>
  )
}
