'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { toast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import DriverMapNavigation, { type NavStop } from '@/components/driver/DriverMapNavigation'
import {
  Navigation,
  MapPin,
  Package,
  Truck,
  Clock,
  Route,
  Zap,
  DollarSign,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Play,
  AlertTriangle,
  Fuel,
  Coffee,
  Target,
  ArrowRight,
  CheckCircle,
  Locate,
  Settings,
} from 'lucide-react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Shipment {
  id: string
  title: string
  pickup_address: string
  delivery_address: string
  pickup_lat: number | null
  pickup_lng: number | null
  delivery_lat: number | null
  delivery_lng: number | null
  status: string
  estimated_price: number | null
  distance: number | null
}

interface OptimizedStop {
  id: string
  address: string
  type: 'pickup' | 'delivery' | 'fuel' | 'rest' | 'current_location'
  shipmentId?: string
  vehicleInfo?: string
  order: number
  estimatedArrival: string
  estimatedDeparture: string
  distanceFromPrevious: number
  durationFromPrevious: number
  priority?: string
}

interface OptimizedRoute {
  stops: OptimizedStop[]
  summary: {
    totalDistance: number
    totalDuration: number
    totalFuelCost: number
    totalStops: number
    estimatedStartTime: string
    estimatedEndTime: string
    efficiencyScore: number
  }
  savings: {
    distanceSaved: number
    timeSaved: number
    fuelCostSaved: number
    emptyMilesSaved: number
    percentImprovement: number
  }
  carolinaInsights: Array<{
    type: string
    title: string
    description: string
    severity: string
    affectedSegment?: string
  }>
  fuelStops: Array<{
    name: string
    address: string
    estimatedPrice: number
    afterStopIndex: number
    reason: string
  }>
  benjiTips: string[]
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function DriverNavigationPage() {
  const { user, profile } = useAuth()
  const supabase = getSupabaseBrowserClient()

  // State
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [selectedShipments, setSelectedShipments] = useState<string[]>([])
  const [driverLocation, setDriverLocation] = useState('')
  const [driverCoords, setDriverCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [vehicleType, setVehicleType] = useState('default')
  const [departureTime, setDepartureTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingShipments, setLoadingShipments] = useState(true)
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null)
  const [mapStops, setMapStops] = useState<NavStop[]>([])
  const [showMap, setShowMap] = useState(false)
  const [showConfig, setShowConfig] = useState(true)
  const [completedStops, setCompletedStops] = useState<number[]>([])

  // ── Auth Token ──────────────────────────────────────────────────────
  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not authenticated')
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    }
  }, [supabase])

  // ── Load Shipments ─────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!user?.id) return
      try {
        setLoadingShipments(true)
        const { data, error } = await supabase
          .from('shipments')
          .select('id, title, pickup_address, delivery_address, pickup_lat, pickup_lng, delivery_lat, delivery_lng, status, estimated_price, distance')
          .eq('driver_id', user.id)
          .in('status', ['accepted', 'assigned', 'picked_up', 'in_transit', 'driver_en_route', 'driver_arrived'])
          .order('created_at', { ascending: false })

        if (error) throw error
        const items = data || []
        setShipments(items)
        setSelectedShipments(items.map(s => s.id)) // All selected by default
      } catch (err) {
        console.error('Failed to load shipments:', err)
      } finally {
        setLoadingShipments(false)
      }
    }
    load()
  }, [user?.id, supabase])

  // ── Get Driver Location ────────────────────────────────────────────
  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast('Geolocation not supported by your browser', 'error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setDriverCoords(coords)
        // Reverse geocode
        if (window.google) {
          const geocoder = new google.maps.Geocoder()
          try {
            const result = await geocoder.geocode({ location: coords })
            if (result.results[0]) {
              setDriverLocation(result.results[0].formatted_address)
            } else {
              setDriverLocation(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
            }
          } catch {
            setDriverLocation(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
          }
        } else {
          setDriverLocation(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
        }
        toast('Location detected', 'success')
      },
      () => toast('Could not detect location — enter manually', 'warning'),
      { enableHighAccuracy: true }
    )
  }

  // ── Optimize & Build Map Stops ─────────────────────────────────────
  const optimizeAndNavigate = async () => {
    if (!driverLocation.trim()) {
      toast('Enter your current location first', 'error')
      return
    }
    if (selectedShipments.length === 0) {
      toast('Select at least one shipment', 'error')
      return
    }

    setLoading(true)
    try {
      const headers = await getHeaders()
      const selected = shipments.filter(s => selectedShipments.includes(s.id))

      // Build stops for the route optimization backend
      const stops: any[] = [
        {
          id: 'driver-start',
          address: driverLocation,
          type: 'current_location',
          estimatedDuration: 0,
        },
      ]

      for (const shipment of selected) {
        if (['accepted', 'assigned', 'driver_en_route', 'driver_arrived'].includes(shipment.status)) {
          stops.push({
            id: `pickup-${shipment.id}`,
            address: shipment.pickup_address,
            type: 'pickup',
            shipmentId: shipment.id,
            vehicleInfo: shipment.title,
            estimatedDuration: 20,
          })
        }
        stops.push({
          id: `delivery-${shipment.id}`,
          address: shipment.delivery_address,
          type: 'delivery',
          shipmentId: shipment.id,
          vehicleInfo: shipment.title,
          estimatedDuration: 15,
        })
      }

      const response = await fetch(`${API_BASE_URL}/route-optimization/optimize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          stops,
          options: { vehicleType, departureTime: departureTime || undefined, prioritizeFuel: true },
        }),
      })

      const result = await response.json()

      if (!result.success) {
        // Fallback: use stops in order without optimization
        toast('Optimization unavailable — using manual order', 'warning')
        const fallbackStops: NavStop[] = stops.map((s: any, i: number) => ({
          id: s.id,
          address: s.address,
          type: s.type,
          label: s.vehicleInfo || s.type.replace('_', ' '),
          shipmentId: s.shipmentId,
          vehicleInfo: s.vehicleInfo,
          order: i + 1,
          lat: findLatLng(s, selected)?.lat,
          lng: findLatLng(s, selected)?.lng,
        }))
        setMapStops(fallbackStops)
        setOptimizedRoute(null)
        setShowMap(true)
        setShowConfig(false)
        return
      }

      setOptimizedRoute(result.data)

      // Convert optimized stops to NavStop[]
      const navStops: NavStop[] = result.data.stops.map((s: OptimizedStop) => ({
        id: s.id,
        address: s.address,
        type: s.type,
        label: s.vehicleInfo || s.type.replace('_', ' '),
        shipmentId: s.shipmentId,
        vehicleInfo: s.vehicleInfo,
        order: s.order,
        estimatedArrival: s.estimatedArrival,
        lat: findLatLng(s, selected)?.lat,
        lng: findLatLng(s, selected)?.lng,
      }))

      setMapStops(navStops)
      setShowMap(true)
      setShowConfig(false)
      toast('Route optimized — map ready!', 'success')
    } catch (err: any) {
      console.error('Optimize error:', err)
      toast(err.message || 'Failed to optimize route', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Quick navigate a single shipment (no optimization needed)
  const quickNavigate = (shipment: Shipment) => {
    const navStops: NavStop[] = []

    if (driverCoords) {
      navStops.push({
        id: 'driver-start',
        address: driverLocation || `${driverCoords.lat}, ${driverCoords.lng}`,
        type: 'current_location',
        lat: driverCoords.lat,
        lng: driverCoords.lng,
        order: 1,
        label: 'Your Location',
      })
    }

    if (['accepted', 'assigned', 'driver_en_route', 'driver_arrived'].includes(shipment.status)) {
      navStops.push({
        id: `pickup-${shipment.id}`,
        address: shipment.pickup_address,
        type: 'pickup',
        lat: shipment.pickup_lat ?? undefined,
        lng: shipment.pickup_lng ?? undefined,
        order: navStops.length + 1,
        label: 'Pickup',
        vehicleInfo: shipment.title,
        shipmentId: shipment.id,
      })
    }

    navStops.push({
      id: `delivery-${shipment.id}`,
      address: shipment.delivery_address,
      type: 'delivery',
      lat: shipment.delivery_lat ?? undefined,
      lng: shipment.delivery_lng ?? undefined,
      order: navStops.length + 1,
      label: 'Delivery',
      vehicleInfo: shipment.title,
      shipmentId: shipment.id,
    })

    setMapStops(navStops)
    setOptimizedRoute(null)
    setShowMap(true)
    setShowConfig(false)
  }

  // ── Helpers ────────────────────────────────────────────────────────
  const findLatLng = (stop: any, selected: Shipment[]): { lat?: number; lng?: number } | undefined => {
    if (stop.type === 'current_location') {
      return driverCoords ? { lat: driverCoords.lat, lng: driverCoords.lng } : undefined
    }
    const shipment = selected.find(s => stop.shipmentId === s.id || stop.id?.includes(s.id))
    if (!shipment) return undefined
    if (stop.type === 'pickup') {
      return shipment.pickup_lat && shipment.pickup_lng
        ? { lat: shipment.pickup_lat, lng: shipment.pickup_lng }
        : undefined
    }
    if (stop.type === 'delivery') {
      return shipment.delivery_lat && shipment.delivery_lng
        ? { lat: shipment.delivery_lat, lng: shipment.delivery_lng }
        : undefined
    }
    return undefined
  }

  const toggleShipment = (id: string) => {
    setSelectedShipments(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      accepted: { label: 'Accepted', color: 'bg-blue-50 text-blue-700 border-blue-200' },
      assigned: { label: 'Assigned', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
      driver_en_route: { label: 'En Route', color: 'bg-purple-50 text-purple-700 border-purple-200' },
      driver_arrived: { label: 'At Pickup', color: 'bg-pink-50 text-pink-700 border-pink-200' },
      picked_up: { label: 'Picked Up', color: 'bg-orange-50 text-orange-700 border-orange-200' },
      in_transit: { label: 'In Transit', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    }
    const info = map[status] || { label: status, color: 'bg-gray-50 text-gray-700 border-gray-200' }
    return (
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${info.color}`}>
        {info.label}
      </span>
    )
  }

  const handleStopReached = (idx: number) => {
    setCompletedStops(prev => [...prev, idx])
  }

  const handleNavigationComplete = () => {
    toast('All stops reached! Great job.', 'success')
    setShowMap(false)
    setShowConfig(true)
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Render
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div className="space-y-4">
      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Navigation className="h-6 w-6 text-amber-500" />
            Navigation
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            In-app maps with real-time directions, traffic, and route optimization
          </p>
        </div>
        {showMap && (
          <Button
            variant="outline"
            onClick={() => { setShowMap(false); setShowConfig(true) }}
            className="text-xs"
          >
            <Settings className="h-3.5 w-3.5 mr-1" />
            Configure Route
          </Button>
        )}
      </div>

      {/* ── Config Panel ─────────────────────────────────────── */}
      {showConfig && (
        <div className="space-y-4">
          {/* Location & Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Settings className="h-4 w-4 text-gray-400" />
              Navigation Setup
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Driver Location */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Your Location</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Enter or detect..."
                      value={driverLocation}
                      onChange={e => setDriverLocation(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <button
                    onClick={detectLocation}
                    className="p-2 bg-amber-50 border border-amber-300 rounded-md text-amber-600 hover:bg-amber-100 transition-colors"
                    title="Detect GPS location"
                  >
                    <Locate className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Vehicle Type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle Type</label>
                <select
                  value={vehicleType}
                  onChange={e => setVehicleType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                >
                  <option value="default">Standard</option>
                  <option value="car_hauler_loaded">Car Hauler (Loaded)</option>
                  <option value="car_hauler_empty">Car Hauler (Empty)</option>
                  <option value="enclosed_loaded">Enclosed Trailer</option>
                  <option value="flatbed_loaded">Flatbed</option>
                  <option value="pickup_with_trailer">Pickup + Trailer</option>
                </select>
              </div>

              {/* Departure Time */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Departure Time</label>
                <input
                  type="datetime-local"
                  value={departureTime}
                  onChange={e => setDepartureTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                />
              </div>

              {/* Optimize & Navigate */}
              <div className="flex items-end">
                <Button
                  onClick={optimizeAndNavigate}
                  disabled={loading || selectedShipments.length === 0}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <RotateCcw className="h-4 w-4 animate-spin" />
                      Optimizing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Navigation className="h-4 w-4" />
                      Optimize & Navigate
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Shipment Selection */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Truck className="h-4 w-4 text-amber-500" />
                Active Shipments
                <span className="text-xs font-normal text-gray-500">
                  ({selectedShipments.length} of {shipments.length} selected)
                </span>
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedShipments(shipments.map(s => s.id))}
                  className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedShipments([])}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                >
                  Clear
                </button>
              </div>
            </div>

            {loadingShipments ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
              </div>
            ) : shipments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 mb-1">No active shipments</p>
                <p className="text-xs text-gray-400">Accept jobs to start navigating</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {shipments.map((shipment) => {
                  const isSelected = selectedShipments.includes(shipment.id)
                  return (
                    <div
                      key={shipment.id}
                      className={`flex items-start gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer ${
                        isSelected ? 'bg-amber-50/30' : ''
                      }`}
                      onClick={() => toggleShipment(shipment.id)}
                    >
                      {/* Checkbox */}
                      <div className="pt-0.5">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-amber-500 border-amber-500' : 'border-gray-300'
                        }`}>
                          {isSelected && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                        </div>
                      </div>

                      {/* Shipment Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{shipment.title}</p>
                          {statusBadge(shipment.status)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <MapPin className="h-3 w-3 text-blue-400 shrink-0" />
                            <span className="truncate">{shipment.pickup_address}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <MapPin className="h-3 w-3 text-green-400 shrink-0" />
                            <span className="truncate">{shipment.delivery_address}</span>
                          </div>
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="text-right shrink-0 space-y-1">
                        {shipment.distance && (
                          <p className="text-xs text-gray-500">{shipment.distance} mi</p>
                        )}
                        {shipment.estimated_price && (
                          <p className="text-xs font-semibold text-green-600">${shipment.estimated_price.toFixed(0)}</p>
                        )}
                        {/* Quick navigate single */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            quickNavigate(shipment)
                          }}
                          className="text-[10px] font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1 ml-auto"
                        >
                          <Navigation className="h-3 w-3" />
                          Navigate
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick Tip */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <Zap className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Pro Tip from Benji</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Select multiple shipments and click "Optimize & Navigate" to get the best stop order, 
                save fuel, and avoid Carolina rush hour traffic — all without leaving the app.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Map View ─────────────────────────────────────────── */}
      {showMap && mapStops.length >= 2 && (
        <div className="space-y-4">
          {/* Optimization Summary (if available) */}
          {optimizedRoute && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <SummaryCard
                icon={<Route className="h-5 w-5 text-amber-500" />}
                label="Total Distance"
                value={`${optimizedRoute.summary.totalDistance} mi`}
              />
              <SummaryCard
                icon={<Clock className="h-5 w-5 text-blue-500" />}
                label="Total Time"
                value={`${Math.round(optimizedRoute.summary.totalDuration / 60 * 10) / 10} hrs`}
              />
              <SummaryCard
                icon={<Fuel className="h-5 w-5 text-green-500" />}
                label="Fuel Cost"
                value={`$${optimizedRoute.summary.totalFuelCost.toFixed(2)}`}
              />
              <SummaryCard
                icon={<Target className="h-5 w-5 text-purple-500" />}
                label="Efficiency"
                value={`${optimizedRoute.summary.efficiencyScore}/100`}
              />
              {optimizedRoute.savings.percentImprovement > 0 && (
                <SummaryCard
                  icon={<Zap className="h-5 w-5 text-emerald-500" />}
                  label="Route Savings"
                  value={`${optimizedRoute.savings.percentImprovement}%`}
                  highlight
                />
              )}
            </div>
          )}

          {/* Full Map Navigation */}
          <DriverMapNavigation
            stops={mapStops}
            driverLocation={driverCoords || undefined}
            onStopReached={handleStopReached}
            onNavigationComplete={handleNavigationComplete}
            onClose={() => { setShowMap(false); setShowConfig(true) }}
            height="h-[calc(100vh-320px)]"
            showOverlay={true}
            carolinaInsights={optimizedRoute?.carolinaInsights || []}
            benjiTips={optimizedRoute?.benjiTips || []}
            fuelStops={optimizedRoute?.fuelStops || []}
          />

          {/* Carolina Insights (below map) */}
          {optimizedRoute && optimizedRoute.carolinaInsights.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Carolina Route Insights
              </h4>
              <div className="space-y-2">
                {optimizedRoute.carolinaInsights.map((insight, idx) => (
                  <div key={idx} className={`flex items-start gap-2 p-3 rounded-lg border ${
                    insight.severity === 'critical'
                      ? 'border-red-200 bg-red-50'
                      : insight.severity === 'warning'
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-blue-200 bg-blue-50'
                  }`}>
                    <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${
                      insight.severity === 'critical' ? 'text-red-500' : insight.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'
                    }`} />
                    <div>
                      <p className="text-xs font-medium">{insight.title}</p>
                      <p className="text-[11px] opacity-75">{insight.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fuel Recommendations */}
          {optimizedRoute && optimizedRoute.fuelStops.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-3 flex items-center gap-2">
                <Fuel className="h-4 w-4 text-green-500" />
                Recommended Fuel Stops
              </h4>
              <div className="space-y-2">
                {optimizedRoute.fuelStops.map((fs, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <Fuel className="h-4 w-4 text-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{fs.name}</p>
                      <p className="text-xs text-gray-500 truncate">{fs.address}</p>
                    </div>
                    <p className="text-sm font-semibold text-green-600">~${fs.estimatedPrice.toFixed(2)}/gal</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sub-component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SummaryCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-4 border ${highlight ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className={`text-xl font-bold ${highlight ? 'text-emerald-600' : 'text-gray-900'}`}>{value}</p>
    </div>
  )
}
