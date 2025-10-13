import { Router, Request, Response } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { asyncHandler, createError } from '@utils/error';
import { successResponse } from '@utils/response';
import { pricingService, VehicleType } from '@services/pricing.service';

const router = Router();

// POST /api/v1/pricing/quote
// Body: { vehicle_type, distance_miles, pickup_date?, delivery_date?, is_accident_recovery?, vehicle_count?, surge_multiplier?, fuel_cost_per_mile?, fuel_price_per_gallon? }
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
  } = req.body;

  if (!vehicle_type || !distance_miles) {
    throw createError('vehicle_type and distance_miles are required', 400, 'MISSING_FIELDS');
  }

  const quote = pricingService.calculateQuote({
    vehicleType: vehicle_type as VehicleType,
    distanceMiles: Number(distance_miles),
    pickupDate: pickup_date || undefined,
    deliveryDate: delivery_date || undefined,
    isAccidentRecovery: Boolean(is_accident_recovery),
    vehicleCount: vehicle_count ? Number(vehicle_count) : 1,
    surgeMultiplier: surge_multiplier ? Number(surge_multiplier) : 1,
    dynamicFuelCostPerMile: fuel_cost_per_mile !== undefined && fuel_cost_per_mile !== null && fuel_cost_per_mile !== '' ? Number(fuel_cost_per_mile) : undefined,
    fuelPricePerGallon: fuel_price_per_gallon !== undefined && fuel_price_per_gallon !== null && fuel_price_per_gallon !== '' ? Number(fuel_price_per_gallon) : undefined,
  });

  res.status(200).json(successResponse(quote));
}));

export default router;
