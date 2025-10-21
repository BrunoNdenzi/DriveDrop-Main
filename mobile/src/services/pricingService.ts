/**
 * Pricing service for mobile app
 * Handles real-time price estimation and quote generation
 */

interface PriceEstimate {
  total: number;
  range: { min: number; max: number };
  confidence: 'low' | 'medium' | 'high';
  type: 'estimate' | 'quote';
}

interface PricingBreakdown {
  baseRatePerMile: number;
  distanceBand: 'short' | 'mid' | 'long';
  rawBasePrice: number;
  bulkDiscountPercent: number;
  bulkDiscountAmount: number;
  surgeMultiplier: number;
  deliveryTypeMultiplier: number; // 1.25 for expedited, 0.95 for flexible, 1.0 for standard
  deliveryType: 'expedited' | 'flexible' | 'standard';
  fuelPricePerGallon: number;
  fuelAdjustmentPercent: number;
  minimumApplied: boolean;
  total: number;
}

interface PricingData {
  estimate: PriceEstimate;
  breakdown: PricingBreakdown;
  distance: {
    miles: number;
    source: 'haversine' | 'google_maps' | 'user_provided';
    confidence: 'low' | 'medium' | 'high';
  };
  factors: {
    has_accurate_distance: boolean;
    has_coordinates: boolean;
    has_addresses: boolean;
  };
  expires_at?: string;
}

type VehicleType = 'sedan' | 'suv' | 'truck';

// Pricing constants
const MIN_MILES = 100;
const MIN_QUOTE = 150;
const ACCIDENT_MIN_QUOTE = 80;
const BASE_FUEL_PRICE = 3.70; // Base fuel price per gallon for adjustment calculation

// Base rates table - simplified for current implementation
const BASE_RATES: Record<VehicleType, { short: number; mid: number; long: number; accident: number }> = {
  sedan:  { short: 1.80, mid: 0.95, long: 0.60, accident: 2.50 },
  suv:    { short: 2.00, mid: 1.05, long: 0.70, accident: 2.75 },
  truck:  { short: 2.20, mid: 1.15, long: 0.75, accident: 3.00 },
};

class PricingService {
  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    // Apply road distance multiplier (1.15x accounts for actual road routes vs straight line)
    // This is calibrated to match Google Maps distances (e.g., Dallas to San Diego)
    const roadMultiplier = 1.15;
    return Math.round(distance * roadMultiplier * 100) / 100;
  }

  /**
   * Determine distance band
   */
  private determineDistanceBand(miles: number): 'short' | 'mid' | 'long' {
    if (miles <= 500) return 'short';
    if (miles <= 1500) return 'mid';
    return 'long';
  }

  /**
   * Determine delivery type based on pickup and delivery dates
   * Expedited: blank delivery date OR delivery within 7 days of pickup (1.25x multiplier)
   * Flexible: delivery 7+ days from pickup (0.95x multiplier)
   * Standard: no dates provided (1.0x multiplier)
   */
  private determineDeliveryType(pickupDate?: string, deliveryDate?: string): {
    type: 'expedited' | 'flexible' | 'standard';
    multiplier: number;
  } {
    // No dates provided - standard pricing
    if (!pickupDate) {
      return { type: 'standard', multiplier: 1.0 };
    }

    // Blank delivery date means expedited (ASAP)
    if (!deliveryDate) {
      return { type: 'expedited', multiplier: 1.25 };
    }

    try {
      const pickup = new Date(pickupDate);
      const delivery = new Date(deliveryDate);
      
      // Calculate days between pickup and delivery
      const daysDiff = Math.ceil((delivery.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24));
      
      // Less than 7 days = expedited, 7+ days = flexible
      if (daysDiff < 7) {
        return { type: 'expedited', multiplier: 1.25 };
      } else {
        return { type: 'flexible', multiplier: 0.95 };
      }
    } catch (error) {
      console.warn('Error parsing dates for delivery type, using standard', { pickupDate, deliveryDate, error });
      return { type: 'standard', multiplier: 1.0 };
    }
  }

  /**
   * Calculate bulk discount
   */
  private getBulkDiscountPercent(count: number): number {
    if (count <= 2) return 0;
    if (count <= 5) return 10;
    if (count <= 9) return 15;
    return 20;
  }

  /**
   * Extract ZIP code from address string
   */
  private extractZipFromAddress(address: string): string | null {
    // Match 5-digit ZIP code, optionally followed by -4 digits
    const zipRegex = /\b(\d{5})(?:-\d{4})?\b/;
    const match = address.match(zipRegex);
    return match ? match[1] : null;
  }

  /**
   * Estimate distance from available data
   */
  private estimateDistance(data: {
    pickupAddress?: string;
    deliveryAddress?: string;
    pickupLocation?: { lat: number; lng: number };
    deliveryLocation?: { lat: number; lng: number };
    pickupZip?: string;
    deliveryZip?: string;
    pickupState?: string;
    deliveryState?: string;
  }): { miles: number; source: 'haversine' | 'google_maps' | 'user_provided'; confidence: 'low' | 'medium' | 'high' } {
    // If we have coordinates, use haversine distance
    if (data.pickupLocation && data.deliveryLocation) {
      const miles = this.calculateDistance(
        data.pickupLocation.lat,
        data.pickupLocation.lng,
        data.deliveryLocation.lat,
        data.deliveryLocation.lng
      );
      
      return {
        miles,
        source: 'haversine',
        confidence: 'high'
      };
    }

    // Try to extract ZIP codes from addresses if not provided
    let pickupZip = data.pickupZip;
    let deliveryZip = data.deliveryZip;
    
    if (!pickupZip && data.pickupAddress) {
      pickupZip = this.extractZipFromAddress(data.pickupAddress) || undefined;
    }
    if (!deliveryZip && data.deliveryAddress) {
      deliveryZip = this.extractZipFromAddress(data.deliveryAddress) || undefined;
    }

    // If we have ZIP codes, try to look up coordinates
    if (pickupZip && deliveryZip) {
      try {
        const pickupCoords = this.lookupZipCoordinates(pickupZip);
        const deliveryCoords = this.lookupZipCoordinates(deliveryZip);
        
        if (pickupCoords && deliveryCoords) {
          const miles = this.calculateDistance(
            pickupCoords.lat,
            pickupCoords.lng,
            deliveryCoords.lat,
            deliveryCoords.lng
          );
          
          return {
            miles,
            source: 'haversine',
            confidence: 'high'
          };
        }
      } catch (error) {
        console.warn('ZIP lookup failed, using fallback estimation:', error);
      }
    }

    // Fallback estimates based on states
    if (data.pickupState && data.deliveryState) {
      if (data.pickupState === data.deliveryState) {
        return { miles: 300, source: 'user_provided', confidence: 'low' };
      } else {
        return { miles: 800, source: 'user_provided', confidence: 'low' };
      }
    }

    // Address parsing fallback
    if (data.pickupAddress && data.deliveryAddress) {
      const pickupState = this.extractStateFromAddress(data.pickupAddress);
      const deliveryState = this.extractStateFromAddress(data.deliveryAddress);
      
      if (pickupState && deliveryState) {
        if (pickupState === deliveryState) {
          return { miles: 300, source: 'user_provided', confidence: 'low' };
        } else {
          return { miles: 800, source: 'user_provided', confidence: 'low' };
        }
      }
    }

    // Absolute fallback
    return { miles: 500, source: 'user_provided', confidence: 'low' };
  }

  /**
   * Look up coordinates for a ZIP code
   * This is a simple hardcoded map for common ZIP codes
   * TODO: Load from uszips.csv for production
   */
  private lookupZipCoordinates(zip: string): { lat: number; lng: number } | null {
    // Hardcoded coordinates for common ZIP codes
    // In production, this should load from uszips.csv
    const zipMap: Record<string, { lat: number; lng: number }> = {
      // Texas
      '75202': { lat: 32.7767, lng: -96.7970 }, // Dallas
      '77001': { lat: 29.7604, lng: -95.3698 }, // Houston
      '78701': { lat: 30.2672, lng: -97.7431 }, // Austin
      
      // California
      '92116': { lat: 32.7157, lng: -117.1611 }, // San Diego
      '90001': { lat: 33.9731, lng: -118.2479 }, // Los Angeles
      '94102': { lat: 37.7793, lng: -122.4193 }, // San Francisco
      
      // New York
      '10001': { lat: 40.7506, lng: -73.9971 }, // New York City
      
      // Florida
      '33101': { lat: 25.7753, lng: -80.2089 }, // Miami
      
      // Illinois
      '60601': { lat: 41.8851, lng: -87.6214 }, // Chicago
      
      // Add more as needed...
    };
    
    return zipMap[zip] || null;
  }

  /**
   * Extract state abbreviation from address string
   */
  private extractStateFromAddress(address: string): string | null {
    const stateRegex = /\b([A-Z]{2})\b/g;
    const matches = address.match(stateRegex);
    if (!matches || matches.length === 0) return null;
    const lastMatch = matches[matches.length - 1];
    return lastMatch || null;
  }

  /**
   * Calculate price range based on confidence
   */
  private calculatePriceRange(basePrice: number, confidence: 'low' | 'medium' | 'high'): { min: number; max: number } {
    const rangeFactors = {
      high: 0.05,   // ┬▒5%
      medium: 0.15, // ┬▒15%
      low: 0.30     // ┬▒30%
    };
    
    const factor = rangeFactors[confidence];
    const min = Math.round(basePrice * (1 - factor) * 100) / 100;
    const max = Math.round(basePrice * (1 + factor) * 100) / 100;
    
    return { min, max };
  }

  /**
   * Determine pricing confidence based on available data
   */
  private determinePricingConfidence(
    data: any,
    distanceEstimate: any
  ): 'low' | 'medium' | 'high' {
    if (data.pickupLocation && data.deliveryLocation && 
        data.pickupAddress && data.deliveryAddress) {
      return distanceEstimate.confidence === 'high' ? 'high' : 'medium';
    }
    
    if ((data.pickupLocation && data.deliveryLocation) ||
        (data.pickupAddress && data.deliveryAddress)) {
      return distanceEstimate.confidence === 'high' ? 'medium' : 'low';
    }
    
    return 'low';
  }

  /**
   * Get progressive estimate based on available data
   */
  async getProgressiveEstimate(data: {
    pickupAddress?: string;
    deliveryAddress?: string;
    pickupLocation?: { lat: number; lng: number };
    deliveryLocation?: { lat: number; lng: number };
    pickupZip?: string;
    deliveryZip?: string;
    pickupState?: string;
    deliveryState?: string;
    vehicleType: string;
    vehicleCount?: number;
    isAccidentRecovery?: boolean;
    pickupDate?: string;
    deliveryDate?: string;
    fuelPricePerGallon?: number;
  }): Promise<PricingData> {
    // Estimate distance from available data
    const distanceEstimate = this.estimateDistance(data);
    
    // Determine confidence level
    const confidence = this.determinePricingConfidence(data, distanceEstimate);
    
    // Map vehicle type
    const vehicleType = this.mapVehicleType(data.vehicleType);
    
    // Calculate base pricing
    const quote = this.calculateQuote({
      vehicleType,
      distanceMiles: distanceEstimate.miles,
      isAccidentRecovery: data.isAccidentRecovery || false,
      vehicleCount: data.vehicleCount || 1,
      pickupDate: data.pickupDate,
      deliveryDate: data.deliveryDate,
      fuelPricePerGallon: data.fuelPricePerGallon,
    });
    
    // Calculate price range
    const range = this.calculatePriceRange(quote.total, confidence);
    
    const result: PricingData = {
      estimate: {
        total: quote.total,
        range,
        confidence,
        type: 'estimate'
      },
      breakdown: quote.breakdown,
      distance: distanceEstimate,
      factors: {
        has_accurate_distance: distanceEstimate.confidence === 'high',
        has_coordinates: !!(data.pickupLocation && data.deliveryLocation),
        has_addresses: !!(data.pickupAddress && data.deliveryAddress)
      }
    };
    
    return result;
  }

  /**
   * Map vehicle type from form to pricing service format
   */
  private mapVehicleType(vehicleType: string): VehicleType {
    const mapping: Record<string, VehicleType> = {
      'sedan': 'sedan',
      'suv': 'suv',
      'truck': 'truck',
      'pickup': 'truck', // Map pickup to truck
    };
    
    return mapping[vehicleType.toLowerCase()] || 'sedan';
  }

  /**
   * Calculate quote (matches backend logic exactly)
   */
  private calculateQuote(input: {
    vehicleType: VehicleType;
    distanceMiles: number;
    isAccidentRecovery?: boolean;
    vehicleCount?: number;
    surgeMultiplier?: number;
    pickupDate?: string;
    deliveryDate?: string;
    fuelPricePerGallon?: number;
  }): { total: number; breakdown: PricingBreakdown } {
    const {
      vehicleType,
      distanceMiles,
      isAccidentRecovery = false,
      vehicleCount = 1,
      surgeMultiplier = 1,
      pickupDate,
      deliveryDate,
      fuelPricePerGallon = BASE_FUEL_PRICE, // Default to $3.70/gallon
    } = input;

    // Determine delivery type and multiplier
    const deliveryTypeInfo = this.determineDeliveryType(pickupDate, deliveryDate);

    const distanceBand = this.determineDistanceBand(distanceMiles);
    const baseRates = BASE_RATES[vehicleType];
    const baseRatePerMile = isAccidentRecovery ? baseRates.accident : baseRates[distanceBand];
    const rawBasePrice = baseRatePerMile * distanceMiles;

    // Bulk discount
    const bulkDiscountPercent = this.getBulkDiscountPercent(vehicleCount);
    const bulkDiscountAmount = (rawBasePrice * bulkDiscountPercent) / 100;

    // Apply surge, delivery type multiplier, and subtract discount
    let subtotal = (rawBasePrice - bulkDiscountAmount) * surgeMultiplier * deliveryTypeInfo.multiplier;
    
    // Calculate fuel price adjustment (5% per $1 deviation from base price)
    // Formula: (current_fuel - base_fuel) × 0.05
    // Example: If fuel is $4.70 (+$1), adjustment is +5% → multiply by 1.05
    // Example: If fuel is $2.70 (-$1), adjustment is -5% → multiply by 0.95
    const fuelAdjustmentPercent = (fuelPricePerGallon - BASE_FUEL_PRICE) * 5; // Convert to percentage
    const fuelAdjustmentMultiplier = 1 + (fuelAdjustmentPercent / 100);
    subtotal = subtotal * fuelAdjustmentMultiplier;
    
    // Apply minimum quote logic AFTER fuel adjustment
    let minimumApplied = false;
    
    if (isAccidentRecovery) {
      // Accident recovery minimum
      if (subtotal < ACCIDENT_MIN_QUOTE) {
        subtotal = ACCIDENT_MIN_QUOTE;
        minimumApplied = true;
      }
    } else if (distanceMiles < MIN_MILES) {
      // Standard minimum for trips under MIN_MILES
      if (subtotal < MIN_QUOTE) {
        subtotal = MIN_QUOTE;
        minimumApplied = true;
      }
    }

    const total = Math.max(0, parseFloat(subtotal.toFixed(2)));

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
    };

    return { total, breakdown };
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
    }).format(price);
  }

  /**
   * Format price range for display
   */
  formatPriceRange(range: { min: number; max: number }): string {
    const minFormatted = this.formatPrice(range.min);
    const maxFormatted = this.formatPrice(range.max);
    return `${minFormatted} - ${maxFormatted}`;
  }

  /**
   * Get confidence description
   */
  getConfidenceDescription(confidence: 'low' | 'medium' | 'high'): string {
    switch (confidence) {
      case 'high':
        return 'This estimate is based on accurate location data and should be very close to the final price.';
      case 'medium':
        return 'This estimate is based on good location data. The final price may vary slightly.';
      case 'low':
        return 'This estimate is based on limited location data. The final price may vary significantly.';
      default:
        return 'Price estimate confidence unknown.';
    }
  }

  /**
   * Get quick estimate for minimal data
   */
  async getQuickEstimate(data: {
    vehicleType: string;
    pickupZip?: string;
    deliveryZip?: string;
    pickupState?: string;
    deliveryState?: string;
  }): Promise<PricingData> {
    return this.getProgressiveEstimate({
      ...data,
      vehicleCount: 1,
      isAccidentRecovery: false,
    });
  }

  /**
   * Get accurate pricing from backend API (uses server-side logic with minimums and delivery type calculations)
   */
  async getBackendPricing(data: {
    vehicleType: string;
    distanceMiles: number;
    pickupDate?: string;
    deliveryDate?: string;
    isAccidentRecovery?: boolean;
    vehicleCount?: number;
    surgeMultiplier?: number;
    fuelPricePerGallon?: number; // Default: $3.70/gallon
  }): Promise<{ total: number; breakdown: any }> {
    try {
      // Import dependencies
      const { supabase } = await import('../lib/supabase');
      const { getApiUrl } = await import('../utils/environment');

      // Get the user session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('User not authenticated');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/v1/pricing/quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          vehicle_type: data.vehicleType.toLowerCase(),
          distance_miles: data.distanceMiles,
          pickup_date: data.pickupDate,
          delivery_date: data.deliveryDate,
          is_accident_recovery: data.isAccidentRecovery || false,
          vehicle_count: data.vehicleCount || 1,
          surge_multiplier: data.surgeMultiplier || 1.0,
          fuel_price_per_gallon: data.fuelPricePerGallon || 3.70, // Default: $3.70/gallon
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Backend pricing API error:', errorData);
        throw new Error(errorData.message || 'Failed to get backend pricing');
      }

      const responseData = await response.json();
      console.log('Backend pricing API response:', responseData);
      
      // Extract data from response - handle nested data structure
      if (responseData.data) {
        return responseData.data;
      }
      
      return responseData;
    } catch (error) {
      console.error('Error calling backend pricing API:', error);
      throw error;
    }
  }
}

export const pricingService = new PricingService();
export type { PricingData, PriceEstimate, PricingBreakdown };
