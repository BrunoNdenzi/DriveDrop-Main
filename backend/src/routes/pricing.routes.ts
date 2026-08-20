import { Router, Request, Response } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { asyncHandler, createError } from '@utils/error';
import { successResponse } from '@utils/response';
import { VehicleType } from '@services/pricing.service';
import { pricingDecisionService } from '@services/pricingDecision.service';

const router = Router();

// POST /api/v1/pricing/calculate - Public endpoint for website quote calculator
// Body: { vehicle_type, distance_miles, pickup_date?, delivery_date?, is_accident_recovery?, vehicle_count?, route_origin?, route_destination? }
router.post('/calculate', asyncHandler(async (req: Request, res: Response) => {
  const { 
    vehicle_type, 
    distance_miles, 
    pickup_date, 
    delivery_date, 
    is_accident_recovery, 
    vehicle_count,
    route_origin,
    route_destination,
  } = req.body;

  if (!vehicle_type || !distance_miles) {
    throw createError('vehicle_type and distance_miles are required', 400, 'MISSING_FIELDS');
  }

  // Route through Phase 2 Decision Layer
  const result = await pricingDecisionService.generateQuote({
    vehicleType: vehicle_type as VehicleType,
    distanceMiles: Number(distance_miles),
    pickupDate: pickup_date || undefined,
    deliveryDate: delivery_date || undefined,
    isAccidentRecovery: Boolean(is_accident_recovery),
    vehicleCount: vehicle_count ? Number(vehicle_count) : 1,
    ...(route_origin && { routeOrigin: route_origin }),
    ...(route_destination && { routeDestination: route_destination }),
    intelligenceMode: 'shadow',
    logToHistory: true,         // Log all quotes to quote_history
    requestSource: 'website',
  });

  // Backwards-compatible response format
  const quote = {
    total: result.total,
    breakdown: result.breakdown,
    expiresAt: result.expiresAt,
    validityWindowHours: result.validityWindowHours,
    quoteId: result.quoteId,
  };

  res.status(200).json(successResponse(quote));
}));

// POST /api/v1/pricing/quote - Authenticated endpoint for mobile app
// Body: { vehicle_type, distance_miles, pickup_date?, delivery_date?, is_accident_recovery?, vehicle_count?, route_origin?, route_destination?, enable_intelligence? }
router.post('/quote', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { 
    vehicle_type, 
    distance_miles, 
    pickup_date, 
    delivery_date, 
    is_accident_recovery, 
    vehicle_count,
    route_origin,
    route_destination,
  } = req.body;

  if (!vehicle_type || !distance_miles) {
    throw createError('vehicle_type and distance_miles are required', 400, 'MISSING_FIELDS');
  }

  // Route through Phase 2 Decision Layer
  const result = await pricingDecisionService.generateQuote({
    vehicleType: vehicle_type as VehicleType,
    distanceMiles: Number(distance_miles),
    pickupDate: pickup_date || undefined,
    deliveryDate: delivery_date || undefined,
    isAccidentRecovery: Boolean(is_accident_recovery),
    vehicleCount: vehicle_count ? Number(vehicle_count) : 1,
    ...(route_origin && { routeOrigin: route_origin }),
    ...(route_destination && { routeDestination: route_destination }),
    intelligenceMode: 'shadow',
    logToHistory: true,
    requestSource: 'mobile',
    ...(req.user?.id && { userId: req.user.id }),
  });

  // Backwards-compatible response format
  const quote = {
    total: result.total,
    breakdown: result.breakdown,
    expiresAt: result.expiresAt,
    validityWindowHours: result.validityWindowHours,
    quoteId: result.quoteId,
  };

  res.status(200).json(successResponse(quote));
}));

export default router;
