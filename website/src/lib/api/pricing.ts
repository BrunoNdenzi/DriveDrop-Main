import { getSupabaseBrowserClient } from '@/lib/supabase-client'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://drivedrop-main-production.up.railway.app/api/v1'

export interface PricingConfig {
  id: string
  min_quote: number
  accident_min_quote: number
  min_miles: number
  base_fuel_price: number
  current_fuel_price: number
  fuel_adjustment_per_dollar: number
  surge_multiplier: number
  surge_enabled: boolean
  expedited_multiplier: number
  flexible_multiplier: number
  standard_multiplier: number
  short_distance_max: number
  mid_distance_max: number
  expedited_service_enabled: boolean
  flexible_service_enabled: boolean
  bulk_discount_enabled: boolean
  economic_floor_mode: 'shadow' | 'enforce'
  target_contribution_margin_percent: number
  fallback_fuel_cost_per_mile: number
  fallback_driver_cost_per_mile: number
  fallback_insurance_cost_per_mile: number
  fallback_maintenance_cost_per_mile: number
  fallback_tolls_cost_per_mile: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ShipmentQuote {
  total: number
  quoteId: string
  expiresAt: string
  validityWindowHours: number
  breakdown: {
    baseRatePerMile: number
    distanceBand: string
    rawBasePrice: number
    deliveryType: string
    deliveryTypeMultiplier: number
    fuelAdjustmentPercent: number
    minimumApplied: boolean
    total: number
  }
}

async function getHeaders(): Promise<HeadersInit> {
  const supabase = getSupabaseBrowserClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Your session has expired. Please sign in again.')
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body?.error?.message || 'Pricing configuration request failed')
  }
  return body.data as T
}

export async function getActivePricingConfig(): Promise<PricingConfig> {
  const response = await fetch(`${API_BASE_URL}/admin/pricing/config`, {
    headers: await getHeaders(),
  })
  return parseResponse<PricingConfig>(response)
}

export async function createPricingConfig(
  config: Omit<PricingConfig, 'id' | 'created_at' | 'updated_at'>
): Promise<PricingConfig> {
  const response = await fetch(`${API_BASE_URL}/admin/pricing/config`, {
    method: 'POST',
    headers: await getHeaders(),
    body: JSON.stringify({ ...config, set_as_active: true }),
  })
  return parseResponse<PricingConfig>(response)
}

export async function updatePricingConfig(
  id: string,
  updates: Partial<PricingConfig>,
  changeReason: string
): Promise<PricingConfig> {
  const response = await fetch(`${API_BASE_URL}/admin/pricing/config/${id}`, {
    method: 'PUT',
    headers: await getHeaders(),
    body: JSON.stringify({ ...updates, change_reason: changeReason }),
  })
  return parseResponse<PricingConfig>(response)
}

export async function calculateShipmentQuote(
  input: {
    vehicleType: string
    distanceMiles: number
    pickupDate?: string
    deliveryDate?: string
    routeOrigin?: string
    routeDestination?: string
  },
  signal?: AbortSignal
): Promise<ShipmentQuote> {
  const vehicleTypeMap: Record<string, string> = {
    sedan: 'sedan',
    suv: 'suv',
    truck: 'pickup',
    pickup: 'pickup',
    coupe: 'sedan',
    hatchback: 'sedan',
    van: 'suv',
    crossover: 'suv',
    motorcycle: 'motorcycle',
  }

  const response = await fetch(`${API_BASE_URL}/pricing/quote`, {
    method: 'POST',
    headers: await getHeaders(),
    signal,
    body: JSON.stringify({
      vehicle_type: vehicleTypeMap[input.vehicleType.toLowerCase()] || 'sedan',
      distance_miles: input.distanceMiles,
      pickup_date: input.pickupDate || undefined,
      delivery_date: input.deliveryDate || undefined,
      route_origin: input.routeOrigin || undefined,
      route_destination: input.routeDestination || undefined,
      is_accident_recovery: false,
      vehicle_count: 1,
    }),
  })

  return parseResponse<ShipmentQuote>(response)
}
