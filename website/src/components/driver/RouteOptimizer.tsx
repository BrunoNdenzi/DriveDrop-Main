'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { toast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import DriverMapNavigation, { type NavStop } from '@/components/driver/DriverMapNavigation'
import {
  Navigation,
  MapPin,
  Fuel,
  Clock,
  DollarSign,
  Zap,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Truck,
  Package,
  RotateCcw,
  Play,
  Info,
  Sun,
  Cloud,
  Snowflake,
  Route,
  Target,
  Coffee,
} from 'lucide-react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface RouteStop {
  id: string
  address: string
  type: 'pickup' | 'delivery' | 'fuel' | 'rest' | 'current_location'
  shipmentId?: string
  vehicleInfo?: string
  timeWindow?: { earliest: string; latest: string }
  estimatedDuration?: number
  priority?: 'high' | 'medium' | 'low'
}

interface OptimizedStop extends RouteStop {
  order: number
  estimatedArrival: string
  estimatedDeparture: string
  distanceFromPrevious: number
  durationFromPrevious: number
}

interface RouteSummary {
  totalDistance: number
  totalDuration: number
  totalFuelCost: number
  totalStops: number
  estimatedStartTime: string
  estimatedEndTime: string
  efficiencyScore: number
}

interface RouteSavings {
  distanceSaved: number
  timeSaved: number
  fuelCostSaved: number
  emptyMilesSaved: number
  percentImprovement: number
}

interface CarolinaInsight {
  type: 'corridor' | 'traffic' | 'weather' | 'construction' | 'tip'
  title: string
  description: string
  severity: 'info' | 'warning' | 'critical'
  affectedSegment?: string
}

interface FuelStopRec {
  name: string
  address: string
  estimatedPrice: number
  afterStopIndex: number
  reason: string
}

interface BreakRec {
  afterStopIndex: number
  suggestedLocation: string
  type: 'short_break' | 'meal' | 'rest'
  duration: number
  reason: string
}

interface OptimizedRoute {
  stops: OptimizedStop[]
  summary: RouteSummary
  savings: RouteSavings
  carolinaInsights: CarolinaInsight[]
  fuelStops: FuelStopRec[]
  benjiTips: string[]
}

interface DailyPlan {
  date: string
  driverLocation: string
  routes: OptimizedRoute[]
  totalEarnings: number
  totalMiles: number
  totalHours: number
  breakSchedule: BreakRec[]
  weatherForecast: string
  benjiDailySummary: string
}

interface TrafficCondition {
  metro: string
  status: 'clear' | 'congested'
  delayPercent: number
  rushHour: string | null
  nextRushHour: string | null
}

interface Shipment {
  id: string
  pickup_address: string
  delivery_address: string
  title: string
  status: string
  estimated_price?: number
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function RouteOptimizer({ driverId }: { driverId: string }) {
  const supabase = getSupabaseBrowserClient()

  // State
  const [activeShipments, setActiveShipments] = useState<Shipment[]>([])
  const [driverLocation, setDriverLocation] = useState('')
  const [vehicleType, setVehicleType] = useState('default')
  const [departureTime, setDepartureTime] = useState('')
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null)
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null)
  const [trafficConditions, setTrafficConditions] = useState<TrafficCondition[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingTraffic, setLoadingTraffic] = useState(false)
  const [activeTab, setActiveTab] = useState<'optimize' | 'daily-plan' | 'traffic'>('optimize')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    stops: true,
    savings: true,
    insights: false,
    benji: true,
    fuel: false,
  })
  const [benjiQuery, setBenjiQuery] = useState('')
  const [benjiResponse, setBenjiResponse] = useState<{ answer: string; suggestions: string[] } | null>(null)
  const [loadingBenji, setLoadingBenji] = useState(false)
  const [showInAppMap, setShowInAppMap] = useState(false)

  // ── Auth Token ──────────────────────────────────────────────────────

  const getAuthToken = useCallback(async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not authenticated')
    return session.access_token
  }, [supabase])

  const getHeaders = useCallback(async () => {
    const token = await getAuthToken()
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  }, [getAuthToken])

  // ── Load Active Shipments ──────────────────────────────────────────

  useEffect(() => {
    const loadShipments = async () => {
      try {
        const { data, error } = await supabase
          .from('shipments')
          .select('id, pickup_address, delivery_address, title, status, estimated_price')
          .in('status', ['accepted', 'assigned', 'picked_up', 'in_transit'])
          .eq('driver_id', driverId)
          .order('created_at', { ascending: false })

        if (error) throw error
        setActiveShipments(data || [])
      } catch (err) {
        console.error('Failed to load shipments:', err)
      }
    }
    loadShipments()
  }, [driverId, supabase])

  // ── Load Traffic on mount ──────────────────────────────────────────

  useEffect(() => {
    loadTraffic()
  }, [])

  // ── API Calls ─────────────────────────────────────────────────────

  const optimizeRoute = async () => {
    if (!driverLocation.trim()) {
      toast('Enter your current location', 'error')
      return
    }
    if (activeShipments.length === 0) {
      toast('No active shipments to optimize', 'error')
      return
    }

    setLoading(true)
    try {
      const headers = await getHeaders()

      // Build stops from active shipments
      const stops: RouteStop[] = [
        {
          id: 'driver-start',
          address: driverLocation,
          type: 'current_location',
          estimatedDuration: 0,
        },
      ]

      for (const shipment of activeShipments) {
        if (['accepted', 'assigned'].includes(shipment.status)) {
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
          options: {
            vehicleType,
            departureTime: departureTime || undefined,
            prioritizeFuel: true,
          },
        }),
      })

      const result = await response.json()
      if (!result.success) throw new Error(result.error || 'Optimization failed')

      setOptimizedRoute(result.data)
      toast('Route optimized!', 'success')
    } catch (err: any) {
      console.error('Optimization error:', err)
      toast(err.message || 'Failed to optimize route', 'error')
    } finally {
      setLoading(false)
    }
  }

  const generateDailyPlan = async () => {
    if (!driverLocation.trim()) {
      toast('Enter your current location', 'error')
      return
    }
    if (activeShipments.length === 0) {
      toast('No active shipments for daily plan', 'error')
      return
    }

    setLoading(true)
    try {
      const headers = await getHeaders()

      const shipments = activeShipments.map(s => ({
        id: s.id,
        pickupAddress: s.pickup_address,
        deliveryAddress: s.delivery_address,
        vehicleInfo: s.title,
        estimatedPayout: s.estimated_price || 0,
      }))

      const response = await fetch(`${API_BASE_URL}/route-optimization/daily-plan`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          driverLocation,
          shipments,
          options: {
            vehicleType,
            departureTime: departureTime || undefined,
          },
        }),
      })

      const result = await response.json()
      if (!result.success) throw new Error(result.error || 'Plan generation failed')

      setDailyPlan(result.data)
      if (result.data.routes?.[0]) {
        setOptimizedRoute(result.data.routes[0])
      }
      toast('Daily plan ready!', 'success')
    } catch (err: any) {
      console.error('Daily plan error:', err)
      toast(err.message || 'Failed to generate plan', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadTraffic = async () => {
    setLoadingTraffic(true)
    try {
      const headers = await getHeaders()
      const response = await fetch(`${API_BASE_URL}/route-optimization/traffic`, { headers })
      const result = await response.json()
      if (result.success) {
        setTrafficConditions(result.data.conditions || [])
      }
    } catch (err) {
      console.error('Traffic load error:', err)
    } finally {
      setLoadingTraffic(false)
    }
  }

  const askBenji = async (question?: string) => {
    const q = question || benjiQuery
    if (!q.trim()) return

    setLoadingBenji(true)
    try {
      const headers = await getHeaders()
      const response = await fetch(`${API_BASE_URL}/route-optimization/benji-assist`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: q,
          context: {
            driverLocation,
            activeShipments: activeShipments.map(s => ({
              id: s.id,
              pickup: s.pickup_address,
              delivery: s.delivery_address,
              status: s.status,
            })),
            currentRoute: optimizedRoute || undefined,
          },
        }),
      })

      const result = await response.json()
      if (result.success) {
        setBenjiResponse({ answer: result.answer, suggestions: result.suggestions || [] })
      }
    } catch (err) {
      console.error('Benji assist error:', err)
    } finally {
      setLoadingBenji(false)
      setBenjiQuery('')
    }
  }

  // ── UI Helpers ────────────────────────────────────────────────────

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const stopTypeIcon = (type: string) => {
    switch (type) {
      case 'pickup': return <Package className="h-4 w-4 text-blue-500" />
      case 'delivery': return <MapPin className="h-4 w-4 text-green-500" />
      case 'fuel': return <Fuel className="h-4 w-4 text-yellow-500" />
      case 'rest': return <Coffee className="h-4 w-4 text-purple-500" />
      default: return <Navigation className="h-4 w-4 text-amber-500" />
    }
  }

  const stopTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      pickup: 'bg-blue-50 text-blue-700 border-blue-200',
      delivery: 'bg-green-50 text-green-700 border-green-200',
      fuel: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      rest: 'bg-purple-50 text-purple-700 border-purple-200',
      current_location: 'bg-amber-50 text-amber-700 border-amber-200',
    }
    return colors[type] || 'bg-gray-50 text-gray-700 border-gray-200'
  }

  const insightIcon = (type: string) => {
    switch (type) {
      case 'corridor': return <Route className="h-4 w-4" />
      case 'traffic': return <AlertTriangle className="h-4 w-4" />
      case 'weather': return <Cloud className="h-4 w-4" />
      case 'tip': return <Zap className="h-4 w-4" />
      default: return <Info className="h-4 w-4" />
    }
  }

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-300 bg-red-50 text-red-800'
      case 'warning': return 'border-amber-300 bg-amber-50 text-amber-800'
      default: return 'border-blue-200 bg-blue-50 text-blue-800'
    }
  }

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Render
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div className="space-y-6">

      {/* ── Tab Navigation ────────────────────────────────────────── */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {[
            { key: 'optimize' as const, label: 'Route Optimizer', icon: Navigation },
            { key: 'daily-plan' as const, label: 'Daily Plan', icon: Target },
            { key: 'traffic' as const, label: 'Traffic', icon: AlertTriangle },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Configuration Panel ───────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Route Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Driver Location */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Your Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Charlotte, NC"
                value={driverLocation}
                onChange={e => setDriverLocation(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
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

          {/* Action Buttons */}
          <div className="flex items-end gap-2">
            {activeTab === 'optimize' ? (
              <Button
                onClick={optimizeRoute}
                disabled={loading}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-medium"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 animate-spin" />
                    Optimizing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Optimize
                  </span>
                )}
              </Button>
            ) : activeTab === 'daily-plan' ? (
              <Button
                onClick={generateDailyPlan}
                disabled={loading}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-medium"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 animate-spin" />
                    Planning...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Generate Plan
                  </span>
                )}
              </Button>
            ) : (
              <Button
                onClick={loadTraffic}
                disabled={loadingTraffic}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-medium"
              >
                <span className="flex items-center gap-2">
                  <RotateCcw className={`h-4 w-4 ${loadingTraffic ? 'animate-spin' : ''}`} />
                  Refresh
                </span>
              </Button>
            )}
          </div>
        </div>

        {/* Active Shipments Badge */}
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
          <Truck className="h-4 w-4" />
          <span>
            <span className="font-semibold text-gray-900">{activeShipments.length}</span> active shipment{activeShipments.length !== 1 ? 's' : ''} loaded
          </span>
          {activeShipments.length === 0 && (
            <span className="text-xs text-amber-600 ml-2">Pick up loads from Available Jobs first</span>
          )}
        </div>
      </div>

      {/* ── Optimize Tab Content ──────────────────────────────────── */}
      {activeTab === 'optimize' && optimizedRoute && (
        <>
          {/* Summary Cards */}
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
            <SummaryCard
              icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
              label="Saved"
              value={`${optimizedRoute.savings.percentImprovement}%`}
              highlight
            />
          </div>

          {/* Savings Breakdown */}
          {optimizedRoute.savings.percentImprovement > 0 && (
            <CollapsibleSection
              title="Savings Breakdown"
              icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
              expanded={expandedSections.savings}
              onToggle={() => toggleSection('savings')}
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                  <p className="text-xs text-emerald-600 font-medium">Distance Saved</p>
                  <p className="text-xl font-bold text-emerald-700">{optimizedRoute.savings.distanceSaved} mi</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-xs text-blue-600 font-medium">Time Saved</p>
                  <p className="text-xl font-bold text-blue-700">{optimizedRoute.savings.timeSaved} min</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <p className="text-xs text-green-600 font-medium">Fuel Cost Saved</p>
                  <p className="text-xl font-bold text-green-700">${optimizedRoute.savings.fuelCostSaved.toFixed(2)}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <p className="text-xs text-amber-600 font-medium">Deadhead Miles Cut</p>
                  <p className="text-xl font-bold text-amber-700">{optimizedRoute.savings.emptyMilesSaved} mi</p>
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* Optimized Stop Order */}
          <CollapsibleSection
            title={`Optimized Route (${optimizedRoute.stops.length} stops)`}
            icon={<Navigation className="h-5 w-5 text-amber-500" />}
            expanded={expandedSections.stops}
            onToggle={() => toggleSection('stops')}
          >
            <div className="space-y-2">
              {optimizedRoute.stops.map((stop, idx) => (
                <div key={stop.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  {/* Order number */}
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold">
                      {stop.order}
                    </div>
                    {idx < optimizedRoute.stops.length - 1 && (
                      <div className="w-0.5 h-8 bg-gray-200 mt-1" />
                    )}
                  </div>

                  {/* Stop details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {stopTypeIcon(stop.type)}
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${stopTypeBadge(stop.type)}`}>
                        {stop.type.replace('_', ' ')}
                      </span>
                      {stop.priority === 'high' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                          Priority
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">{stop.address}</p>
                    {stop.vehicleInfo && (
                      <p className="text-xs text-gray-500 mt-0.5">{stop.vehicleInfo}</p>
                    )}
                  </div>

                  {/* ETA & Distance */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-900">{formatTime(stop.estimatedArrival)}</p>
                    {stop.distanceFromPrevious > 0 && (
                      <p className="text-xs text-gray-500">
                        {stop.distanceFromPrevious} mi · {stop.durationFromPrevious} min
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Navigate buttons */}
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <Button
                onClick={() => setShowInAppMap(true)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
              >
                <span className="flex items-center justify-center gap-2">
                  <Play className="h-4 w-4" />
                  Navigate In-App
                </span>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const waypoints = optimizedRoute.stops
                    .filter(s => s.type !== 'current_location')
                    .map(s => encodeURIComponent(s.address))
                  const origin = encodeURIComponent(optimizedRoute.stops[0]?.address || '')
                  const dest = encodeURIComponent(optimizedRoute.stops[optimizedRoute.stops.length - 1]?.address || '')
                  const waypointStr = waypoints.slice(0, -1).join('|')
                  const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${waypointStr}&travelmode=driving`
                  window.open(url, '_blank')
                }}
                className="w-full text-gray-600"
              >
                <span className="flex items-center justify-center gap-2">
                  <Navigation className="h-4 w-4" />
                  Open in Google Maps
                </span>
              </Button>
            </div>
          </CollapsibleSection>

          {/* Benji Tips */}
          {optimizedRoute.benjiTips.length > 0 && (
            <CollapsibleSection
              title="Benji's Tips"
              icon={<Zap className="h-5 w-5 text-amber-500" />}
              expanded={expandedSections.benji}
              onToggle={() => toggleSection('benji')}
            >
              <div className="space-y-3">
                {optimizedRoute.benjiTips.map((tip, idx) => (
                  <div key={idx} className="flex gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="shrink-0 mt-0.5">
                      <Zap className="h-4 w-4 text-amber-500" />
                    </div>
                    <p className="text-sm text-amber-900">{tip}</p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Carolina Insights */}
          {optimizedRoute.carolinaInsights.length > 0 && (
            <CollapsibleSection
              title="Carolina Insights"
              icon={<Info className="h-5 w-5 text-blue-500" />}
              expanded={expandedSections.insights}
              onToggle={() => toggleSection('insights')}
            >
              <div className="space-y-2">
                {optimizedRoute.carolinaInsights.map((insight, idx) => (
                  <div key={idx} className={`flex gap-3 p-3 rounded-lg border ${severityColor(insight.severity)}`}>
                    <div className="shrink-0 mt-0.5">{insightIcon(insight.type)}</div>
                    <div>
                      <p className="text-sm font-medium">{insight.title}</p>
                      <p className="text-xs mt-0.5 opacity-80">{insight.description}</p>
                      {insight.affectedSegment && (
                        <p className="text-xs mt-1 opacity-60">Segment: {insight.affectedSegment}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Fuel Stops */}
          {optimizedRoute.fuelStops.length > 0 && (
            <CollapsibleSection
              title="Fuel Stops"
              icon={<Fuel className="h-5 w-5 text-green-500" />}
              expanded={expandedSections.fuel}
              onToggle={() => toggleSection('fuel')}
            >
              <div className="space-y-2">
                {optimizedRoute.fuelStops.map((fs, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <Fuel className="h-5 w-5 text-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{fs.name}</p>
                      <p className="text-xs text-gray-500 truncate">{fs.address}</p>
                      <p className="text-xs text-gray-500">{fs.reason}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-green-600">~${fs.estimatedPrice.toFixed(2)}/gal</p>
                      <p className="text-xs text-gray-500">After stop #{fs.afterStopIndex + 1}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </>
      )}

      {/* ── Daily Plan Tab Content ────────────────────────────────── */}
      {activeTab === 'daily-plan' && dailyPlan && (
        <div className="space-y-4">
          {/* Daily Summary Card */}
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg p-5 text-white">
            <h3 className="text-lg font-bold mb-3">Daily Plan — {dailyPlan.date}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-amber-100">Total Miles</p>
                <p className="text-2xl font-bold">{dailyPlan.totalMiles}</p>
              </div>
              <div>
                <p className="text-xs text-amber-100">Total Hours</p>
                <p className="text-2xl font-bold">{dailyPlan.totalHours}</p>
              </div>
              <div>
                <p className="text-xs text-amber-100">Est. Earnings</p>
                <p className="text-2xl font-bold">${dailyPlan.totalEarnings.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-amber-100">Shipments</p>
                <p className="text-2xl font-bold">{activeShipments.length}</p>
              </div>
            </div>
          </div>

          {/* Benji Daily Summary */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800 mb-1">Benji's Daily Briefing</p>
                <p className="text-sm text-amber-900 whitespace-pre-line">{dailyPlan.benjiDailySummary}</p>
              </div>
            </div>
          </div>

          {/* Weather */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
            <Cloud className="h-5 w-5 text-blue-500 shrink-0" />
            <p className="text-sm text-blue-800">{dailyPlan.weatherForecast}</p>
          </div>

          {/* Break Schedule */}
          {dailyPlan.breakSchedule.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Coffee className="h-4 w-4 text-purple-500" />
                Break Schedule (FMCSA Compliant)
              </h4>
              <div className="space-y-2">
                {dailyPlan.breakSchedule.map((brk, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 bg-purple-50 rounded-md border border-purple-200">
                    <Coffee className="h-4 w-4 text-purple-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-purple-800 font-medium">
                        {brk.type === 'short_break' ? '30-Min Break' : brk.type === 'meal' ? 'Meal Break' : 'Rest Period'}
                      </p>
                      <p className="text-xs text-purple-600">{brk.reason}</p>
                    </div>
                    <span className="text-xs text-purple-700 font-medium">
                      After stop #{brk.afterStopIndex + 1} · {brk.duration} min
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Route details are shared with optimize tab */}
          {optimizedRoute && (
            <CollapsibleSection
              title={`Route Details (${optimizedRoute.stops.length} stops)`}
              icon={<Navigation className="h-5 w-5 text-amber-500" />}
              expanded={true}
              onToggle={() => {}}
            >
              <div className="space-y-2">
                {optimizedRoute.stops.map((stop, idx) => (
                  <div key={stop.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {stop.order}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {stopTypeIcon(stop.type)}
                        <span className="text-sm font-medium text-gray-900 truncate">{stop.address}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">{formatTime(stop.estimatedArrival)}</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>
      )}

      {/* ── Traffic Tab Content ───────────────────────────────────── */}
      {activeTab === 'traffic' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Carolina Metro Traffic</h3>
              <span className="text-xs text-gray-500">
                Updated: {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {trafficConditions.map((tc, idx) => (
                <div key={idx} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${tc.status === 'congested' ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tc.metro}</p>
                      {tc.nextRushHour && (
                        <p className="text-xs text-gray-500">{tc.nextRushHour}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {tc.status === 'congested' ? (
                      <div>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-200">
                          <AlertTriangle className="h-3 w-3" />
                          {tc.rushHour} rush · +{tc.delayPercent}%
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
                        <CheckCircle className="h-3 w-3" />
                        Clear
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {trafficConditions.length === 0 && !loadingTraffic && (
                <div className="px-5 py-8 text-center text-sm text-gray-500">
                  No traffic data available. Click Refresh to load.
                </div>
              )}
              {loadingTraffic && (
                <div className="px-5 py-8 text-center text-sm text-gray-500">
                  <RotateCcw className="h-5 w-5 animate-spin mx-auto mb-2 text-amber-500" />
                  Loading traffic data...
                </div>
              )}
            </div>
          </div>

          {/* Traffic Tips */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Carolina Traffic Tips</h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>• <strong>Charlotte I-77/I-85:</strong> Worst congestion 4:00-6:30 PM. Use I-485 bypass or depart after 7 PM.</p>
              <p>• <strong>Greensboro "Death Valley":</strong> I-85/I-40 interchange is tight. Plan extra 10-15 min during rush.</p>
              <p>• <strong>Raleigh I-40/I-440:</strong> Morning rush 7-9 AM. US-64 bypass can save time.</p>
              <p>• <strong>Weekends:</strong> All Carolina interstates are significantly lighter — great for long hauls.</p>
              <p>• <strong>Construction zones:</strong> Check NCDOT 511 before departing for current lane closures.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Benji Route Assistant (always visible) ────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Ask Benji About Your Route</h3>
        </div>

        {/* Benji Response */}
        {benjiResponse && (
          <div className="mb-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-900">{benjiResponse.answer}</p>
            {benjiResponse.suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {benjiResponse.suggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => askBenji(sug)}
                    className="text-xs px-3 py-1.5 bg-white border border-amber-300 text-amber-700 rounded-full hover:bg-amber-100 transition-colors"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={benjiQuery}
            onChange={e => setBenjiQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && askBenji()}
            placeholder="e.g., Optimize my route, Find cheap fuel, Avoid traffic..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
          />
          <Button
            onClick={() => askBenji()}
            disabled={loadingBenji || !benjiQuery.trim()}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4"
          >
            {loadingBenji ? (
              <RotateCcw className="h-4 w-4 animate-spin" />
            ) : (
              'Ask'
            )}
          </Button>
        </div>

        {/* Quick Suggestions */}
        <div className="flex flex-wrap gap-2 mt-3">
          {['Optimize my route', 'Find cheap fuel', 'Avoid traffic', 'Plan my day', 'Cost savings tips'].map(q => (
            <button
              key={q}
              onClick={() => askBenji(q)}
              className="text-xs px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-full hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* ── In-App Map Navigation ─────────────────────────────── */}
      {showInAppMap && optimizedRoute && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Navigation className="h-4 w-4 text-amber-500" />
              Live Map Navigation
            </h3>
            <button
              onClick={() => setShowInAppMap(false)}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium"
            >
              Close Map
            </button>
          </div>
          <DriverMapNavigation
            stops={optimizedRoute.stops.map(s => ({
              id: s.id,
              address: s.address,
              type: s.type,
              label: s.vehicleInfo || s.type.replace('_', ' '),
              shipmentId: s.shipmentId,
              vehicleInfo: s.vehicleInfo,
              order: s.order,
              estimatedArrival: s.estimatedArrival,
            }))}
            onClose={() => setShowInAppMap(false)}
            height="h-[500px]"
            showOverlay={true}
            carolinaInsights={optimizedRoute.carolinaInsights}
            benjiTips={optimizedRoute.benjiTips}
            fuelStops={optimizedRoute.fuelStops}
          />
        </div>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sub-components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SummaryCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
}) {
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

function CollapsibleSection({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string
  icon: React.ReactNode
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-gray-900">{title}</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {expanded && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}
