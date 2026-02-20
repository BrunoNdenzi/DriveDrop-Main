/**
 * Route Optimization API Routes
 * 
 * Endpoints:
 * POST /api/v1/route-optimization/optimize        - Optimize multi-stop route
 * POST /api/v1/route-optimization/daily-plan       - Generate full daily plan
 * POST /api/v1/route-optimization/benji-assist     - Benji natural language route help
 * GET  /api/v1/route-optimization/fuel-prices      - Regional fuel price estimates
 * GET  /api/v1/route-optimization/traffic           - Current Carolina traffic conditions
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { routeOptimizationService, RouteStop } from '../services/RouteOptimizationService';

const router = Router();

/**
 * POST /api/v1/route-optimization/optimize
 * Optimize a multi-stop route for minimum distance/time/fuel
 * 
 * Body: {
 *   stops: RouteStop[],
 *   options?: { vehicleType, departureTime, returnToOrigin, avoidHighways, prioritizeFuel, maxDetourMinutes }
 * }
 */
router.post('/optimize', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { stops, options = {} } = req.body;

    if (!stops || !Array.isArray(stops) || stops.length < 2) {
      res.status(400).json({ 
        error: 'At least 2 stops are required',
        details: 'Provide an array of stops with at least id, address, and type fields'
      });
      return;
    }

    // Validate stops  
    for (const stop of stops) {
      if (!stop.id || !stop.address || !stop.type) {
        res.status(400).json({ 
          error: 'Each stop must have id, address, and type',
          details: 'Type must be: pickup, delivery, fuel, rest, or current_location'
        });
        return;
      }
    }

    // Only drivers and admins can optimize routes
    if (req.user?.role !== 'driver' && req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Driver or admin access required' });
      return;
    }

    console.log('Route optimization request:', {
      userId: req.user?.id,
      stopCount: stops.length,
      options,
    });

    const result = await routeOptimizationService.optimizeRoute(stops as RouteStop[], options);

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Route optimization error:', error);
    res.status(500).json({
      error: 'Failed to optimize route',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/route-optimization/daily-plan
 * Generate a comprehensive daily driving plan
 * 
 * Body: {
 *   driverLocation: string,
 *   shipments: Array<{ id, pickupAddress, deliveryAddress, vehicleInfo?, pickupWindow?, deliveryWindow?, priority?, estimatedPayout? }>,
 *   options?: { vehicleType, departureTime, maxHours, preferHighway }
 * }
 */
router.post('/daily-plan', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverLocation, shipments, options = {} } = req.body;

    if (!driverLocation || typeof driverLocation !== 'string') {
      res.status(400).json({ error: 'Driver location address is required' });
      return;
    }

    if (!shipments || !Array.isArray(shipments) || shipments.length === 0) {
      res.status(400).json({ error: 'At least one shipment is required' });
      return;
    }

    // Validate shipments
    for (const shipment of shipments) {
      if (!shipment.id || !shipment.pickupAddress || !shipment.deliveryAddress) {
        res.status(400).json({ 
          error: 'Each shipment must have id, pickupAddress, and deliveryAddress' 
        });
        return;
      }
    }

    // Only drivers and admins
    if (req.user?.role !== 'driver' && req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Driver or admin access required' });
      return;
    }

    console.log('Daily plan request:', {
      userId: req.user?.id,
      shipmentCount: shipments.length,
      driverLocation,
    });

    const plan = await routeOptimizationService.generateDailyPlan(
      driverLocation, shipments, options
    );

    res.status(200).json({
      success: true,
      data: plan,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Daily plan error:', error);
    res.status(500).json({
      error: 'Failed to generate daily plan',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/route-optimization/benji-assist
 * Natural language route assistance from Benji AI
 * 
 * Body: {
 *   query: string,
 *   context?: { driverLocation, activeShipments, currentRoute }
 * }
 */
router.post('/benji-assist', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, context = {} } = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    console.log('Benji route assist:', {
      userId: req.user?.id,
      query,
    });

    const response = await routeOptimizationService.benjiRouteAssist(query, context);

    res.status(200).json({
      success: true,
      ...response,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Benji route assist error:', error);
    res.status(500).json({
      error: 'Benji could not process your route question',
      details: error.message,
    });
  }
});

/**
 * GET /api/v1/route-optimization/fuel-prices
 * Get current regional fuel price estimates for Carolinas
 */
router.get('/fuel-prices', authenticate, async (_req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      data: {
        prices: {
          NC: { state: 'North Carolina', pricePerGallon: 3.25, currency: 'USD' },
          SC: { state: 'South Carolina', pricePerGallon: 3.05, currency: 'USD' },
          VA: { state: 'Virginia', pricePerGallon: 3.35, currency: 'USD' },
          GA: { state: 'Georgia', pricePerGallon: 3.15, currency: 'USD' },
          TN: { state: 'Tennessee', pricePerGallon: 3.10, currency: 'USD' },
        },
        lastUpdated: new Date().toISOString(),
        note: 'Estimates based on regional averages. Actual prices vary by station.',
        tip: 'South Carolina consistently has the lowest fuel prices in the region. Fill up when crossing the state line!',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get fuel prices', details: error.message });
  }
});

/**
 * GET /api/v1/route-optimization/traffic
 * Get current Carolina traffic conditions and metro rush hour status
 */
router.get('/traffic', authenticate, async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;

    const metros = [
      { name: 'Charlotte', morningPeak: [7, 9], eveningPeak: [16, 18.5], delay: 30 },
      { name: 'Raleigh-Durham', morningPeak: [7, 9], eveningPeak: [16.5, 18.5], delay: 25 },
      { name: 'Greensboro', morningPeak: [7, 8.5], eveningPeak: [16.5, 18], delay: 15 },
      { name: 'Columbia SC', morningPeak: [7, 9], eveningPeak: [16, 18], delay: 20 },
      { name: 'Charleston SC', morningPeak: [7, 9], eveningPeak: [16, 18], delay: 20 },
    ];

    const conditions = metros.map(metro => {
      const mp0 = metro.morningPeak[0] as number;
      const mp1 = metro.morningPeak[1] as number;
      const ep0 = metro.eveningPeak[0] as number;
      const ep1 = metro.eveningPeak[1] as number;
      const inMorning = hour >= mp0 && hour <= mp1;
      const inEvening = hour >= ep0 && hour <= ep1;
      const status = (inMorning || inEvening) ? 'congested' : 'clear';

      return {
        metro: metro.name,
        status,
        delayPercent: status === 'congested' ? metro.delay : 0,
        rushHour: status === 'congested' 
          ? (inMorning ? 'morning' : 'evening') 
          : null,
        nextRushHour: getNextRushHour(hour, metro),
      };
    });

    res.status(200).json({
      success: true,
      data: {
        currentTime: now.toISOString(),
        conditions,
        overallStatus: conditions.some(c => c.status === 'congested') ? 'some_congestion' : 'all_clear',
        tip: conditions.some(c => c.status === 'congested')
          ? 'Some metros have active rush hour. Consider alternate routes or waiting 30-60 min.'
          : 'All clear across Carolina metros! Great time to drive.',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get traffic conditions', details: error.message });
  }
});

// Helper for traffic endpoint
function getNextRushHour(
  currentHour: number,
  metro: { morningPeak: number[]; eveningPeak: number[] }
): string | null {
  const mp0 = metro.morningPeak[0] as number;
  const mp1 = metro.morningPeak[1] as number;
  const ep0 = metro.eveningPeak[0] as number;
  const ep1 = metro.eveningPeak[1] as number;
  if (currentHour < mp0) {
    return `Morning rush starts at ${formatHour(mp0)}`;
  }
  if (currentHour > mp1 && currentHour < ep0) {
    return `Evening rush starts at ${formatHour(ep0)}`;
  }
  if (currentHour > ep1) {
    return `Next rush: tomorrow morning at ${formatHour(mp0)}`;
  }
  return null;
}

function formatHour(h: number): string {
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours > 12 ? hours - 12 : hours;
  return minutes ? `${displayHour}:${String(minutes).padStart(2, '0')} ${ampm}` : `${displayHour}:00 ${ampm}`;
}

export default router;
