/**
 * Enhanced pricing service based on DriveDropQuote Python model
 * Implements sophisticated pricing with distance tiers, vehicle types, and adjustments
 */

import { logger } from '@utils/logger';
import {
  EnhancedVehicleType,
  VehicleType,
  DistanceTier,
  PricingRequest,
  PricingResponse,
  PricingBreakdown
} from '../types/api.types';

interface PricingInput {
  vehicleType: EnhancedVehicleType;
  distanceMiles: number;
  isAccidentRecovery?: boolean;
  vehicleCount?: number;
  surgeMultiplier?: number;
}

// Pricing rates per mile by vehicle type and distance tier
const PRICING_RATES: Record<EnhancedVehicleType, Record<DistanceTier | 'accident', number>> = {
  [EnhancedVehicleType.SEDAN]: {
    [DistanceTier.SHORT]: 1.80,
    [DistanceTier.MID]: 0.95,
    [DistanceTier.LONG]: 0.60,
    accident: 2.50
  },
  [EnhancedVehicleType.SUV]: {
    [DistanceTier.SHORT]: 2.00,
    [DistanceTier.MID]: 1.05,
    [DistanceTier.LONG]: 0.70,
    accident: 2.75
  },
  [EnhancedVehicleType.TRUCK]: {
    [DistanceTier.SHORT]: 2.20,
    [DistanceTier.MID]: 1.15,
    [DistanceTier.LONG]: 0.75,
    accident: 3.00
  }
};

// Configuration constants
const PRICING_CONFIG = {
  MIN_MILES: 100,
  MIN_QUOTE: 150,
  ACCIDENT_MIN_QUOTE: 80,
  DEFAULT_FUEL_PRICE: 3.70,
  DISTANCE_TIERS: {
    SHORT_MAX: 500,
    MID_MAX: 1500
  }
};

/**
 * Enhanced pricing service class
 */
export class PricingService {
  /**
   * Determine distance tier based on mileage
   */
  private determineDistanceTier(miles: number): DistanceTier {
    if (miles <= PRICING_CONFIG.DISTANCE_TIERS.SHORT_MAX) {
      return DistanceTier.SHORT;
    } else if (miles <= PRICING_CONFIG.DISTANCE_TIERS.MID_MAX) {
      return DistanceTier.MID;
    } else {
      return DistanceTier.LONG;
    }
  }

  /**
   * Calculate bulk discount percentage
   */
  private getBulkDiscountPercent(count: number): number {
    if (count <= 2) return 0;
    if (count <= 5) return 10;
    if (count <= 9) return 15;
    return 20;
  }

  /**
   * Calculate enhanced quote with proper PricingBreakdown structure
   */
  calculateQuote(input: PricingInput): { total: number; breakdown: PricingBreakdown } {
    const {
      vehicleType,
      distanceMiles,
      isAccidentRecovery = false,
      vehicleCount = 1,
      surgeMultiplier = 1,
    } = input;

    const distanceTier = this.determineDistanceTier(distanceMiles);
    const vehicleRates = PRICING_RATES[vehicleType];
    
    const baseRatePerMile = isAccidentRecovery ? 
      vehicleRates.accident : 
      vehicleRates[distanceTier];

    const rawBasePrice = baseRatePerMile * distanceMiles * vehicleCount;
    const bulkDiscountPercent = this.getBulkDiscountPercent(vehicleCount);
    const bulkDiscountAmount = (rawBasePrice * bulkDiscountPercent) / 100;
    const subtotal = (rawBasePrice - bulkDiscountAmount) * surgeMultiplier;

    let total = subtotal;
    const minimumApplied = isAccidentRecovery 
      ? total < PRICING_CONFIG.ACCIDENT_MIN_QUOTE
      : distanceMiles < PRICING_CONFIG.MIN_MILES && total < PRICING_CONFIG.MIN_QUOTE;

    if (isAccidentRecovery) {
      total = Math.max(total, PRICING_CONFIG.ACCIDENT_MIN_QUOTE);
    } else if (distanceMiles < PRICING_CONFIG.MIN_MILES) {
      total = Math.max(total, PRICING_CONFIG.MIN_QUOTE);
    }

    total = Math.round(total * 100) / 100;

    const breakdown: PricingBreakdown = {
      base_cost: parseFloat(rawBasePrice.toFixed(2)),
      distance_miles: distanceMiles,
      rate_per_mile: parseFloat(baseRatePerMile.toFixed(2)),
      distance_tier: distanceTier,
      vehicle_multiplier: 1.0, // Based on vehicle type already in rate
      delivery_type_multiplier: surgeMultiplier,
      fuel_adjustment: 0, // Could be enhanced later
      urgency_adjustment: 0, // Could be enhanced later
      minimum_applied: minimumApplied,
      ...(minimumApplied && { 
        minimum_amount: isAccidentRecovery ? PRICING_CONFIG.ACCIDENT_MIN_QUOTE : PRICING_CONFIG.MIN_QUOTE 
      }),
    };

    return { total, breakdown };
  }

  /**
   * Calculate real-time estimate with proper PricingResponse structure
   */
  async calculateRealTimeEstimate(request: PricingRequest): Promise<PricingResponse> {
    try {
      // Calculate distance from zip codes (placeholder - would use actual mapping service)
      const estimatedDistance = 200; // Placeholder distance
      
      const vehicleType = request.vehicle_type;
      
      const result = this.calculateQuote({
        vehicleType,
        distanceMiles: estimatedDistance,
        isAccidentRecovery: request.is_accident_recovery || false,
        vehicleCount: request.vehicle_count || 1,
        surgeMultiplier: 1.0, // Could be enhanced with real-time demand
      });

      const response: PricingResponse = {
        total: result.total,
        breakdown: result.breakdown,
        quote_id: `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        confidence_level: 'medium',
        distance_miles: estimatedDistance,
        fuel_price_used: request.fuel_price || PRICING_CONFIG.DEFAULT_FUEL_PRICE,
        ...(request.pickup_date && { estimated_pickup_time: request.pickup_date }),
      };

      return response;
    } catch (error) {
      logger.error('Error calculating real-time estimate:', { error: String(error) });
      throw new Error('Failed to calculate pricing estimate');
    }
  }

  /**
   * Get current surge multiplier (placeholder implementation)
   */
  getCurrentSurgeMultiplier(_vehicleType?: VehicleType, _region?: string): number {
    // Placeholder implementation - would integrate with real-time demand data
    return 1.0;
  }

  /**
   * Get current fuel cost (placeholder implementation)
   */
  getCurrentFuelCost(): number {
    // Placeholder implementation - would integrate with fuel price APIs
    return PRICING_CONFIG.DEFAULT_FUEL_PRICE;
  }
}

// Create singleton instance
export const pricingService = new PricingService();