import { Router, Request, Response } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { asyncHandler, createError } from '@utils/error';
import { successResponse } from '@utils/response';
import { pricingService, VehicleType } from '@services/pricing.service';

const router = Router();

// POST /api/v1/pricing/calculate - Public endpoint for website quote calculator
// Body: { vehicle_type, distance_miles, pickup_date?, delivery_date?, is_accident_recovery?, vehicle_count? }
router.post('/calculate', asyncHandler(async (req: Request, res: Response) => {
  const { 
    vehicle_type, 
    distance_miles, 
    pickup_date, 
    delivery_date, 
    is_accident_recovery, 
    vehicle_count,
  } = req.body;

  if (!vehicle_type || !distance_miles) {
    throw createError('vehicle_type and distance_miles are required', 400, 'MISSING_FIELDS');
  }

  const input = {
    vehicleType: vehicle_type as VehicleType,
    distanceMiles: Number(distance_miles),
    pickupDate: pickup_date || undefined,
    deliveryDate: delivery_date || undefined,
    isAccidentRecovery: Boolean(is_accident_recovery),
    vehicleCount: vehicle_count ? Number(vehicle_count) : 1,
  };

  // Use dynamic pricing config for public quotes
  const quote = await pricingService.calculateQuoteWithDynamicConfig(input);

  res.status(200).json(successResponse(quote));
}));

// POST /api/v1/pricing/quote - Authenticated endpoint for mobile app
// Body: { vehicle_type, distance_miles, pickup_date?, delivery_date?, is_accident_recovery?, vehicle_count?, surge_multiplier?, fuel_cost_per_mile?, fuel_price_per_gallon?, use_dynamic_config? }
router.post('/quote', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { 
    vehicle_type, 
    distance_miles, 
    pickup_date, 
    delivery_date, 
    is_accident_recovery, 
    vehicle_count, 
    surge_multiplier, 
    fuel_cost_per_mile,
    fuel_price_per_gallon, // NEW: Fuel price per gallon (default: $3.70)
    use_dynamic_config = true, // NEW: Use dynamic pricing config by default
  } = req.body;

  if (!vehicle_type || !distance_miles) {
    throw createError('vehicle_type and distance_miles are required', 400, 'MISSING_FIELDS');
  }

  const input = {
    vehicleType: vehicle_type as VehicleType,
    distanceMiles: Number(distance_miles),
    pickupDate: pickup_date || undefined,
    deliveryDate: delivery_date || undefined,
    isAccidentRecovery: Boolean(is_accident_recovery),
    vehicleCount: vehicle_count ? Number(vehicle_count) : 1,
    surgeMultiplier: surge_multiplier ? Number(surge_multiplier) : undefined,
    dynamicFuelCostPerMile: fuel_cost_per_mile !== undefined && fuel_cost_per_mile !== null && fuel_cost_per_mile !== '' ? Number(fuel_cost_per_mile) : undefined,
    fuelPricePerGallon: fuel_price_per_gallon !== undefined && fuel_price_per_gallon !== null && fuel_price_per_gallon !== '' ? Number(fuel_price_per_gallon) : undefined,
  };

  // Use dynamic pricing config by default, fallback to static if disabled
  const quote = use_dynamic_config 
    ? await pricingService.calculateQuoteWithDynamicConfig(input)
    : pricingService.calculateQuote(input);

  res.status(200).json(successResponse(quote));
}));

export default router;
