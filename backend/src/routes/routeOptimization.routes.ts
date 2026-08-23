/**
 * Route Optimization API Routes
 * 
 * Endpoints:
 * POST /api/v1/route-optimization/optimize        - Optimize multi-stop route
 * POST /api/v1/route-optimization/daily-plan       - Generate full daily plan
 * GET  /api/v1/route-optimization/fuel-prices      - Regional fuel price estimates
 * GET  /api/v1/route-optimization/traffic           - Current Carolina traffic conditions
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { supabaseAdmin } from '@lib/supabase';
import { routeOptimizationService, RouteStop } from '../services/RouteOptimizationService';
import { pricingLiveEvidenceService } from '../services/pricingLiveEvidence.service';

const router = Router();

const ROUTABLE_STATUSES = ['accepted', 'assigned', 'picked_up', 'in_transit'];

interface RoutableShipment {
  id: string;
  pickup_address: string;
  delivery_address: string;
  title: string | null;
  status: string;
  driver_offer_amount: number | null;
}

async function loadAuthorizedShipments(shipmentIds: string[], userId: string, role: string) {
  let query = supabaseAdmin
    .from('shipments')
    .select('id, pickup_address, delivery_address, title, status, driver_offer_amount')
    .in('id', shipmentIds)
    .in('status', ROUTABLE_STATUSES);

  if (role !== 'admin') query = query.eq('driver_id', userId);

  const { data, error } = await query;
  if (error) throw new Error(`Unable to load assigned shipments: ${error.message}`);

  const shipments = (data ?? []) as RoutableShipment[];
  if (shipments.length !== shipmentIds.length) {
    return null;
  }

  const byId = new Map(shipments.map(shipment => [shipment.id, shipment]));
  return shipmentIds.map(id => byId.get(id)!);
}

function buildStops(driverLocation: string, shipments: RoutableShipment[]): RouteStop[] {
  const stops: RouteStop[] = [{
    id: 'driver-start',
    address: driverLocation,
    type: 'current_location',
    estimatedDuration: 0,
  }];

  for (const shipment of shipments) {
    if (shipment.status === 'accepted' || shipment.status === 'assigned') {
      stops.push({
        id: `pickup-${shipment.id}`,
        address: shipment.pickup_address,
        type: 'pickup',
        shipmentId: shipment.id,
        vehicleInfo: shipment.title ?? undefined,
        estimatedDuration: 20,
      });
    }
    stops.push({
      id: `delivery-${shipment.id}`,
      address: shipment.delivery_address,
      type: 'delivery',
      shipmentId: shipment.id,
      vehicleInfo: shipment.title ?? undefined,
      estimatedDuration: 15,
    });
  }

  return stops;
}

async function loadRouteEvidence(driverLocation: string, stops: RouteStop[]) {
  const destination = stops.find(stop => stop.type !== 'current_location')?.address;
  if (!destination) return null;
  return pricingLiveEvidenceService.collect(driverLocation, destination);
}

/**
 * POST /api/v1/route-optimization/optimize
 * Optimize a multi-stop route for minimum distance/time/fuel
 * 
 * Body: {
 *   driverLocation: string,
 *   shipmentIds: string[],
 *   options?: { vehicleType, departureTime, returnToOrigin, avoidHighways, prioritizeFuel, maxDetourMinutes }
 * }
 */
router.post('/optimize', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverLocation, shipmentIds, options = {} } = req.body;

    if (!driverLocation || typeof driverLocation !== 'string') {
      res.status(400).json({ error: 'Driver location address is required' });
      return;
    }

    if (!Array.isArray(shipmentIds) || shipmentIds.length === 0 || shipmentIds.some(id => typeof id !== 'string')) {
      res.status(400).json({ error: 'At least one valid shipment ID is required' });
      return;
    }
    const uniqueShipmentIds = [...new Set(shipmentIds as string[])];

    // Only drivers and admins can optimize routes
    if (req.user?.role !== 'driver' && req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Driver or admin access required' });
      return;
    }

    const shipments = await loadAuthorizedShipments(uniqueShipmentIds, req.user.id, req.user.role);
    if (!shipments) {
      res.status(403).json({ error: 'One or more shipments are unavailable or not assigned to this driver' });
      return;
    }

    const stops = buildStops(driverLocation.trim(), shipments);
    const totalAcceptedPayout = shipments.reduce(
      (sum, shipment) => sum + Number(shipment.driver_offer_amount ?? 0),
      0,
    );

    console.log('Route optimization request:', {
      userId: req.user?.id,
      shipmentCount: shipments.length,
      stopCount: stops.length,
      options,
    });

    const result = await routeOptimizationService.optimizeRoute(stops as RouteStop[], options);
    const liveEvidence = await loadRouteEvidence(driverLocation.trim(), result.stops);

    res.status(200).json({
      success: true,
      data: { ...result, totalAcceptedPayout, liveEvidence },
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
 *   shipmentIds: string[],
 *   options?: { vehicleType, departureTime, maxHours, preferHighway }
 * }
 */
router.post('/daily-plan', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverLocation, shipmentIds, options = {} } = req.body;

    if (!driverLocation || typeof driverLocation !== 'string') {
      res.status(400).json({ error: 'Driver location address is required' });
      return;
    }

    if (!Array.isArray(shipmentIds) || shipmentIds.length === 0 || shipmentIds.some(id => typeof id !== 'string')) {
      res.status(400).json({ error: 'At least one valid shipment ID is required' });
      return;
    }
    const uniqueShipmentIds = [...new Set(shipmentIds as string[])];

    // Only drivers and admins
    if (req.user?.role !== 'driver' && req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Driver or admin access required' });
      return;
    }

    const shipments = await loadAuthorizedShipments(uniqueShipmentIds, req.user.id, req.user.role);
    if (!shipments) {
      res.status(403).json({ error: 'One or more shipments are unavailable or not assigned to this driver' });
      return;
    }

    const planShipments = shipments.map(shipment => ({
      id: shipment.id,
      pickupAddress: shipment.pickup_address,
      deliveryAddress: shipment.delivery_address,
      ...(shipment.title ? { vehicleInfo: shipment.title } : {}),
      estimatedPayout: Number(shipment.driver_offer_amount ?? 0),
      status: shipment.status,
    }));

    console.log('Daily plan request:', {
      userId: req.user?.id,
      shipmentCount: shipments.length,
      driverLocation,
    });

    const plan = await routeOptimizationService.generateDailyPlan(
      driverLocation.trim(), planShipments, options
    );
    const firstRoute = plan.routes[0];
    const liveEvidence = firstRoute
      ? await loadRouteEvidence(driverLocation.trim(), firstRoute.stops)
      : null;
    const routes = firstRoute
      ? [{ ...firstRoute, liveEvidence }, ...plan.routes.slice(1)]
      : plan.routes;

    res.status(200).json({
      success: true,
      data: { ...plan, routes, totalAcceptedPayout: plan.totalEarnings },
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
        source: 'Static planning assumptions',
        note: 'Not live station prices. Confirm current prices before making a fuel stop.',
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
        source: 'Typical metro rush-hour schedule, not live traffic incidents',
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
