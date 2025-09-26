import { Router, Request, Response } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { asyncHandler, createError } from '@utils/error';
import { successResponse } from '@utils/response';
import { pricingService } from '@services/pricing.service';
import { EnhancedVehicleType, VehicleType } from '../types/api.types';

// Helper function to map vehicle types to EnhancedVehicleType
const mapVehicleType = (vehicleType: string): EnhancedVehicleType => {
  const mapping: Record<string, EnhancedVehicleType> = {
    'sedan': EnhancedVehicleType.SEDAN,
    'suv': EnhancedVehicleType.SUV,
    'truck': EnhancedVehicleType.TRUCK,
    'pickup': EnhancedVehicleType.TRUCK,
    'luxury': EnhancedVehicleType.SEDAN,
    'motorcycle': EnhancedVehicleType.SEDAN,
    'heavy': EnhancedVehicleType.TRUCK,
  };
  return mapping[vehicleType.toLowerCase()] || EnhancedVehicleType.SEDAN;
};

// Helper function to extract ZIP code from address
const extractZipFromAddress = (address: string): string | null => {
  const zipMatch = address.match(/\b\d{5}(-\d{4})?\b/);
  return zipMatch ? zipMatch[0].split('-')[0] || null : null;
};

const router = Router();

// POST /api/v1/pricing/quote
// Body: { vehicle_type, distance_miles, is_accident_recovery?, vehicle_count?, surge_multiplier?, fuel_cost_per_mile? }
router.post('/quote', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { vehicle_type, distance_miles, is_accident_recovery, vehicle_count, surge_multiplier } = req.body;

  if (!vehicle_type || !distance_miles) {
    throw createError('vehicle_type and distance_miles are required', 400, 'MISSING_FIELDS');
  }

  const quote = pricingService.calculateQuote({
    vehicleType: mapVehicleType(vehicle_type),
    distanceMiles: Number(distance_miles),
    isAccidentRecovery: Boolean(is_accident_recovery),
    vehicleCount: vehicle_count ? Number(vehicle_count) : 1,
    surgeMultiplier: surge_multiplier ? Number(surge_multiplier) : 1,
  });

  res.status(200).json(successResponse(quote));
}));

/**
 * Real-time pricing estimate endpoint
 * @route POST /api/v1/pricing/estimate
 * @desc Get real-time pricing estimate with progressive accuracy
 * @access Private
 */
router.post('/estimate', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const {
    pickup_address,
    delivery_address,
    pickup_location,
    delivery_location,
    vehicle_type,
    vehicle_count,
    is_accident_recovery
  } = req.body;

  if (!vehicle_type) {
    throw createError('vehicle_type is required', 400, 'MISSING_FIELDS');
  }

  // Validate coordinates if provided
  if (pickup_location && (!pickup_location.lat || !pickup_location.lng)) {
    throw createError('pickup_location must have lat and lng properties', 400, 'INVALID_COORDINATES');
  }

  if (delivery_location && (!delivery_location.lat || !delivery_location.lng)) {
    throw createError('delivery_location must have lat and lng properties', 400, 'INVALID_COORDINATES');
  }

  // At least one location method must be provided
  if (!pickup_address && !pickup_location && !delivery_address && !delivery_location) {
    throw createError('At least pickup or delivery location information is required', 400, 'INSUFFICIENT_DATA');
  }

  // Extract ZIP codes from addresses if available
  const pickup_zip = pickup_address ? extractZipFromAddress(pickup_address) : null;
  const delivery_zip = delivery_address ? extractZipFromAddress(delivery_address) : null;

  const estimate = await pricingService.calculateRealTimeEstimate({
    pickup_zip: extractZipFromAddress(pickup_zip || '') || '',
    delivery_zip: extractZipFromAddress(delivery_zip || '') || '',
    vehicle_type: mapVehicleType(vehicle_type),
    vehicle_count: vehicle_count ? Number(vehicle_count) : 1,
    is_accident_recovery: Boolean(is_accident_recovery),
  });

  res.status(200).json(successResponse(estimate));
}));

/**
 * Quick pricing estimate for minimal data
 * @route POST /api/v1/pricing/quick-estimate
 * @desc Get a quick estimate with minimal data (for early form feedback)
 * @access Private
 */
router.post('/quick-estimate', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { vehicle_type, pickup_zip, delivery_zip, pickup_state, delivery_state } = req.body;

  if (!vehicle_type) {
    throw createError('vehicle_type is required', 400, 'MISSING_FIELDS');
  }

  // Estimate distance based on ZIP codes or states
  let estimatedDistance = 500; // Default fallback

  if (pickup_zip && delivery_zip) {
    // Same ZIP code = local delivery (estimated 10-50 miles)
    if (pickup_zip === delivery_zip) {
      estimatedDistance = 25;
    } else {
      // Different ZIP codes = regional delivery (estimated 100-500 miles)
      estimatedDistance = 250;
    }
  } else if (pickup_state && delivery_state) {
    // Same state = intrastate (estimated 200-400 miles)
    if (pickup_state === delivery_state) {
      estimatedDistance = 300;
    } else {
      // Different states = interstate (estimated 500-1200 miles)
      estimatedDistance = 800;
    }
  }

  const estimate = await pricingService.calculateRealTimeEstimate({
    pickup_zip: extractZipFromAddress(pickup_zip || '') || '',
    delivery_zip: extractZipFromAddress(delivery_zip || '') || '',
    vehicle_type: mapVehicleType(vehicle_type),
    vehicle_count: 1,
    is_accident_recovery: false,
  });

  // Create response with estimated distance and calculated pricing
  const responseData = {
    total: estimate.total,
    breakdown: estimate.breakdown,
    quote_id: estimate.quote_id,
    expires_at: estimate.expires_at,
    confidence_level: 'low',
    distance_miles: estimatedDistance,
    range: {
      min: Math.round(estimate.total * 0.6 * 100) / 100,
      max: Math.round(estimate.total * 1.4 * 100) / 100
    }
  };

  res.status(200).json(successResponse(responseData));
}));

/**
 * Get current surge pricing and market factors
 * @route GET /api/v1/pricing/factors
 * @desc Get current pricing factors (surge, fuel costs, etc.)
 * @access Private
 */
router.get('/factors', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { vehicle_type, region } = req.query;

  const factors = {
    surge_multiplier: pricingService.getCurrentSurgeMultiplier(
      vehicle_type as VehicleType, 
      region as string
    ),
    current_fuel_cost: pricingService.getCurrentFuelCost(),
    last_updated: new Date().toISOString(),
    market_conditions: {
      demand: 'normal', // TODO: Implement real demand tracking
      availability: 'good', // TODO: Implement real availability tracking
      weather_impact: 'none' // TODO: Integrate weather data
    }
  };

  res.status(200).json(successResponse(factors));
}));

export default router;
