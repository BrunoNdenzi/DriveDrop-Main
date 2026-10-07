'use client'

import { useEffect, useRef, useState } from 'react'
import { geocodeUsAddress } from '@/lib/address-resolve'
import { X } from '@/components/icons/streamline-lucide'

export interface AddedStopDraft {
  id: string
  name: string
  address: string
  type: 'pickup' | 'delivery'
  latitude?: number
  longitude?: number
  referenceId?: string
  serviceMinutes: number
}

interface Props {
  onSubmit: (stops: AddedStopDraft[]) => Promise<void>
  onClose: () => void
}

interface Place {
  address: string
  latitude?: number
  longitude?: number
}

// Each field gets Google suggestions so the new stops carry real coordinates.
function usePlaceInput(onPlace: (place: Place) => void) {
  const ref = useRef<HTMLInputElement>(null)
  const callback = useRef(onPlace)
  callback.current = onPlace

  useEffect(() => {
    let autocomplete: google.maps.places.Autocomplete | null = null
    let timer: number | undefined
    const attach = () => {
      if (!ref.current || !window.google?.maps?.places) return false
      autocomplete = new google.maps.places.Autocomplete(ref.current, {
        types: ['geocode', 'establishment'],
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'geometry'],
      })
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete!.getPlace()
        const location = place.geometry?.location
        if (!place.formatted_address) return
        callback.current({ address: place.formatted_address, ...(location ? { latitude: location.lat(), longitude: location.lng() } : {}) })
      })
      return true
    }
    if (!attach()) timer = window.setInterval(() => { if (attach()) window.clearInterval(timer) }, 250)
    return () => {
      window.clearInterval(timer)
      if (autocomplete) google.maps.event.clearInstanceListeners(autocomplete)
    }
  }, [])

  return ref
}

export default function AddShipmentSheet({ onSubmit, onClose }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [pickup, setPickup] = useState<Place>({ address: '' })
  const [delivery, setDelivery] = useState<Place>({ address: '' })
  const [reference, setReference] = useState('')
  const [pickupMinutes, setPickupMinutes] = useState(10)
  const [deliveryMinutes, setDeliveryMinutes] = useState(10)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pickupRef = usePlaceInput(setPickup)
  const deliveryRef = usePlaceInput(setDelivery)

  const resolve = async (place: Place): Promise<Place> => {
    if (place.latitude !== undefined || !place.address.trim() || !window.google?.maps) return place
    try {
      const found = await geocodeUsAddress(place.address)
      return found ? { address: found.address, latitude: found.latitude, longitude: found.longitude } : place
    } catch {
      return place
    }
  }

  const submit = async () => {
    setError('')
    if (!delivery.address.trim() || (!loaded && !pickup.address.trim())) {
      setError(loaded ? 'Enter the delivery address.' : 'Enter both the pickup and the delivery address.')
      return
    }
    setBusy(true)
    try {
      const [from, to] = await Promise.all([loaded ? Promise.resolve(pickup) : resolve(pickup), resolve(delivery)])
      const referenceId = reference.trim() || undefined
      const stops: AddedStopDraft[] = [
        ...(loaded ? [] : [{ id: crypto.randomUUID(), name: referenceId ? `Pickup ${referenceId}` : 'Pickup', address: from.address, type: 'pickup' as const, serviceMinutes: pickupMinutes, ...(from.latitude !== undefined ? { latitude: from.latitude, longitude: from.longitude } : {}), ...(referenceId ? { referenceId } : {}) }]),
        { id: crypto.randomUUID(), name: referenceId ? `Delivery ${referenceId}` : 'Delivery', address: to.address, type: 'delivery' as const, serviceMinutes: deliveryMinutes, ...(to.latitude !== undefined ? { latitude: to.latitude, longitude: to.longitude } : {}), ...(referenceId ? { referenceId } : {}) },
      ]
      await onSubmit(stops)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add the shipment')
    } finally {
      setBusy(false)
    }
  }

  const field = 'h-11 w-full rounded-md border border-gray-300 px-3 text-sm'
  return (
    <div role="dialog" aria-label="Add a shipment" className="mb-2 max-h-[70vh] overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-gray-900">Add a shipment</p>
          <p className="text-xs text-gray-600">The remaining stops are re-planned from where you are, including this one.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center text-gray-500"><X className="h-4 w-4" /></button>
      </div>

      <label className="mt-3 flex min-h-10 items-center gap-2 text-xs font-semibold text-gray-700">
        <input type="checkbox" checked={loaded} onChange={event => setLoaded(event.target.checked)} className="h-4 w-4 accent-amber-500" />
        Already on board (delivery only)
      </label>

      <div className="mt-2 space-y-2">
        {!loaded && (
          <input ref={pickupRef} value={pickup.address} onChange={event => setPickup({ address: event.target.value })} placeholder="Pickup address" aria-label="Pickup address" className={field} />
        )}
        <input ref={deliveryRef} value={delivery.address} onChange={event => setDelivery({ address: event.target.value })} placeholder="Delivery address" aria-label="Delivery address" className={field} />
        <input value={reference} onChange={event => setReference(event.target.value)} maxLength={60} placeholder="Reference (optional)" aria-label="Shipment reference" className={field} />
        <div className="flex items-center gap-3 text-xs text-gray-600">
          {!loaded && (
            <label className="flex items-center gap-1.5">Pickup
              <input type="number" min={0} max={240} value={pickupMinutes} onChange={event => setPickupMinutes(Math.max(0, Math.min(240, Number(event.target.value) || 0)))} className="h-10 w-16 rounded-md border border-gray-300 px-2 text-sm" /> min
            </label>
          )}
          <label className="flex items-center gap-1.5">Delivery
            <input type="number" min={0} max={240} value={deliveryMinutes} onChange={event => setDeliveryMinutes(Math.max(0, Math.min(240, Number(event.target.value) || 0)))} className="h-10 w-16 rounded-md border border-gray-300 px-2 text-sm" /> min
          </label>
        </div>
      </div>

      {error && <p role="alert" className="mt-2 text-xs font-medium text-red-700">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onClose} className="h-11 flex-1 rounded-md border border-gray-300 text-sm font-semibold text-gray-700">Cancel</button>
        <button type="button" onClick={() => void submit()} disabled={busy} className="h-11 flex-1 rounded-md bg-amber-500 text-sm font-bold text-gray-900 disabled:opacity-50">
          {busy ? 'Re-planning...' : 'Add and re-plan'}
        </button>
      </div>
    </div>
  )
}
