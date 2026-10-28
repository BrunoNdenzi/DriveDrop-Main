import { Router, Request, Response } from 'express';
import { asyncHandler, createError } from '@utils/error';
import { logger } from '@utils/logger';
import { createRateLimiter } from '../services/plannerVoice';
import { LiveRouteUnavailableError, parseLiveRouteRequest, requestLiveRoute, type LiveRouteRequest } from '../services/plannerTruckRoute';

export const plannerTruckRouteRouter = Router();

const limiter = createRateLimiter(120, 5 * 60_000);

// Road guidance for a loaded truck or trailer while driving: same routing the plan was built with, not car roads.
plannerTruckRouteRouter.post('/live-route', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw createError('Authentication required', 401, 'UNAUTHORIZED');
  if (!limiter.allow(userId)) throw createError('Too many route requests. Try again in a minute.', 429, 'LIVE_ROUTE_RATE_LIMITED');

  let request: LiveRouteRequest;
  try {
    request = parseLiveRouteRequest(req.body);
  } catch (error) {
    throw createError(error instanceof Error ? error.message : 'Invalid route request', 400, 'INVALID_INPUT');
  }

  try {
    const route = await requestLiveRoute(request);
    res.json({ success: true, data: { route } });
  } catch (error) {
    if (error instanceof LiveRouteUnavailableError) throw createError(error.message, 503, 'TRUCK_ROUTING_UNAVAILABLE');
    logger.error('Truck live route failed', { error: error instanceof Error ? error.message : String(error) });
    throw createError('Truck routing is unavailable right now', 502, 'TRUCK_ROUTING_FAILED');
  }
}));
