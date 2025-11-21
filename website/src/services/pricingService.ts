/**
 * Pricing service for website (matches mobile exactly)
 * Handles real-time price estimation and quote generation
 */

type VehicleType = 'sedan' | 'suv' | 'truck'

interface PricingBreakdown {
  baseRatePerMile: number
  distanceBand: 'short' | 'mid' | 'long'
  rawBasePrice: number
  bulkDiscountPercent: number
  bulkDiscountAmount: number
  surgeMultiplier: number
  deliveryTypeMultiplier: number
  deliveryType: 'expedited' | 'flexible' | 'standard'
  fuelPricePerGallon: number
  fuelAdjustmentPercent: number
  minimumApplied: boolean
  total: number
}

// Pricing constants (must match mobile/backend)
const MIN_MILES = 100
const MIN_QUOTE = 150
const ACCIDENT_MIN_QUOTE = 80
const BASE_FUEL_PRICE = 3.70 // Base fuel price per gallon
const ROAD_MULTIPLIER = 1.15 // Accounts for actual road routes vs straight line

// Base rates table (must match mobile exactly)
const BASE_RATES: Record<VehicleType, { short: number; mid: number; long: number; accident: number }> = {
  sedan:  { short: 1.80, mid: 0.95, long: 0.60, accident: 2.50 },
  suv:    { short: 2.00, mid: 1.05, long: 0.70, accident: 2.75 },
  truck:  { short: 2.20, mid: 1.15, long: 0.75, accident: 3.00 },
}

class PricingService {
  /**
   * Calculate distance between two coordinates (Haversine formula)
   * Applies 1.15x multiplier to account for actual road routes
   */
  calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 3959 // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    const distance = R * c
    
    // Apply road distance multiplier (matches mobile)
    return Math.round(distance * ROAD_MULTIPLIER * 100) / 100
  }

  /**
   * Determine distance band
   */
  private determineDistanceBand(miles: number): 'short' | 'mid' | 'long' {
    if (miles <= 500) return 'short'
    if (miles <= 1500) return 'mid'
    return 'long'
  }

  /**
   * Determine delivery type based on pickup and delivery dates
   * Expedited: blank delivery date OR delivery within 7 days of pickup (1.25x multiplier)
   * Flexible: delivery 7+ days from pickup (0.95x multiplier)
   * Standard: no dates provided (1.0x multiplier)
   */
  private determineDeliveryType(pickupDate?: string, deliveryDate?: string): {
    type: 'expedited' | 'flexible' | 'standard'
    multiplier: number
  } {
    // No dates provided - standard pricing
    if (!pickupDate) {
      return { type: 'standard', multiplier: 1.0 }
    }

    // Blank delivery date means expedited (ASAP)
    if (!deliveryDate) {
      return { type: 'expedited', multiplier: 1.25 }
    }

    try {
      const pickup = new Date(pickupDate)
      const delivery = new Date(deliveryDate)
      
      // Calculate days between pickup and delivery
      const daysDiff = Math.ceil((delivery.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24))
      
      // Less than 7 days = expedited, 7+ days = flexible
      if (daysDiff < 7) {
        return { type: 'expedited', multiplier: 1.25 }
      } else {
        return { type: 'flexible', multiplier: 0.95 }
      }
    } catch (error) {
      console.warn('Error parsing dates for delivery type, using standard', { pickupDate, deliveryDate, error })
      return { type: 'standard', multiplier: 1.0 }
    }
  }

  /**
   * Calculate bulk discount
   */
  private getBulkDiscountPercent(count: number): number {
    if (count <= 2) return 0
    if (count <= 5) return 10
    if (count <= 9) return 15
    return 20
  }

  /**
   * Map vehicle type from form to pricing service format
   */
  private mapVehicleType(vehicleType: string): VehicleType {
    const mapping: Record<string, VehicleType> = {
      'sedan': 'sedan',
      'suv': 'suv',
      'truck': 'truck',
      'pickup': 'truck',
      'coupe': 'sedan',
      'hatchback': 'sedan',
      'van': 'suv',
      'crossover': 'suv',
    }
    
    return mapping[vehicleType.toLowerCase()] || 'sedan'
  }

  /**
   * Calculate quote (matches backend/mobile logic exactly)
   */
  calculateQuote(input: {
    vehicleType: string
    distanceMiles: number
    isAccidentRecovery?: boolean
    vehicleCount?: number
    surgeMultiplier?: number
    pickupDate?: string
    deliveryDate?: string
    fuelPricePerGallon?: number
  }): { total: number; breakdown: PricingBreakdown } {
    const {
      distanceMiles,
      isAccidentRecovery = false,
      vehicleCount = 1,
      surgeMultiplier = 1,
      pickupDate,
      deliveryDate,
      fuelPricePerGallon = BASE_FUEL_PRICE,
    } = input

    const vehicleType = this.mapVehicleType(input.vehicleType)

    // Determine delivery type and multiplier
    const deliveryTypeInfo = this.determineDeliveryType(pickupDate, deliveryDate)

    const distanceBand = this.determineDistanceBand(distanceMiles)
    const baseRates = BASE_RATES[vehicleType]
    const baseRatePerMile = isAccidentRecovery ? baseRates.accident : baseRates[distanceBand]
    const rawBasePrice = baseRatePerMile * distanceMiles

    // Bulk discount
    const bulkDiscountPercent = this.getBulkDiscountPercent(vehicleCount)
    const bulkDiscountAmount = (rawBasePrice * bulkDiscountPercent) / 100

    // Apply surge, delivery type multiplier, and subtract discount
    let subtotal = (rawBasePrice - bulkDiscountAmount) * surgeMultiplier * deliveryTypeInfo.multiplier
    
    // Calculate fuel price adjustment (5% per $1 deviation from base price)
    // Formula: (current_fuel - base_fuel) × 0.05
    // Example: If fuel is $4.70 (+$1), adjustment is +5% → multiply by 1.05
    // Example: If fuel is $2.70 (-$1), adjustment is -5% → multiply by 0.95
    const fuelAdjustmentPercent = (fuelPricePerGallon - BASE_FUEL_PRICE) * 5
    const fuelAdjustmentMultiplier = 1 + (fuelAdjustmentPercent / 100)
    subtotal = subtotal * fuelAdjustmentMultiplier
    
    // Apply minimum quote logic AFTER fuel adjustment
    let minimumApplied = false
    
    if (isAccidentRecovery) {
      // Accident recovery minimum
      if (subtotal < ACCIDENT_MIN_QUOTE) {
        subtotal = ACCIDENT_MIN_QUOTE
        minimumApplied = true
      }
    } else if (distanceMiles < MIN_MILES) {
      // Standard minimum for trips under MIN_MILES
      if (subtotal < MIN_QUOTE) {
        subtotal = MIN_QUOTE
        minimumApplied = true
      }
    }

    const total = Math.max(0, parseFloat(subtotal.toFixed(2)))

    const breakdown: PricingBreakdown = {
      baseRatePerMile,
      distanceBand,
      rawBasePrice: parseFloat(rawBasePrice.toFixed(2)),
      bulkDiscountPercent,
      bulkDiscountAmount: parseFloat(bulkDiscountAmount.toFixed(2)),
      surgeMultiplier,
      deliveryTypeMultiplier: deliveryTypeInfo.multiplier,
      deliveryType: deliveryTypeInfo.type,
      fuelPricePerGallon: parseFloat(fuelPricePerGallon.toFixed(2)),
      fuelAdjustmentPercent: parseFloat(fuelAdjustmentPercent.toFixed(2)),
      minimumApplied,
      total,
    }

    return { total, breakdown }
  }

  /**
   * Format price for display
   */
  formatPrice(price: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }
}

// Export singleton instance
export const pricingService = new PricingService()
