/**
 * Shared geospatial math utilities for Benji V2.
 *
 * Extracted from BenjiDispatcherService and BenjiLoadRecommendationService
 * where haversineDistance, toRad, and areCitiesNear were duplicated verbatim.
 *
 * calculateRouteFit has TWO strategies because the original services used
 * genuinely different formulas — see audit notes below.
 *
 * Rules: pure functions except calculateRouteFit (requires DB lookup).
 * No OpenAI, no HTTP calls.
 */
import { supabase } from '@lib/supabase';
import { ROUTE_FIT_STRATEGY, type RouteFitStrategy } from '@benji/core/constants/route';

/** PostGIS-style GeoJSON point as stored in the shipments table */
export type GeoPoint = { coordinates: [number, number] } | null | undefined;

export interface LoadLocations {
  pickup_location: GeoPoint;
  delivery_location: GeoPoint;
}

// Fallback distance when coordinates are missing or invalid (miles)
const FALLBACK_DISTANCE_MILES = 50;

/**
 * Convert degrees to radians.
 */
export function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Haversine distance between two PostGIS points (in miles).
 * Returns FALLBACK_DISTANCE_MILES when either point is null/undefined/invalid.
 * Previously duplicated as `calculateDistance` in BenjiDispatcherService
 * and BenjiLoadRecommendationService.
 */
export function haversineDistance(point1: GeoPoint, point2: GeoPoint): number {
  if (!point1?.coordinates || !point2?.coordinates) return FALLBACK_DISTANCE_MILES;

  const [lon1, lat1] = point1.coordinates;
  const [lon2, lat2] = point2.coordinates;

  if (!isFinite(lon1) || !isFinite(lat1) || !isFinite(lon2) || !isFinite(lat2)) {
    return FALLBACK_DISTANCE_MILES;
  }

  const R = 3958.8; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Returns true if two locations are within the same city/region.
 * Default threshold: 30 miles (matches original services).
 */
export function areCitiesNear(
  loc1: GeoPoint,
  loc2: GeoPoint,
  thresholdMiles = 30,
): boolean {
  if (!loc1?.coordinates || !loc2?.coordinates) return false;
  return haversineDistance(loc1, loc2) < thresholdMiles;
}

/**
 * Strategy selector for calculateRouteFit.
 *
 * The two original services used DIFFERENT formulas (discovered in Phase 1 audit):
 *
 *   'dispatcher':
 *     Math.min(100, (similarRoutes / (totalRoutes * 2)) * 100 * 1.2)
 *     = similarRoutes * 60 / totalRoutes
 *     Used by: BenjiDispatcherService
 *
 *   'recommendation':
 *     Math.min(100, (similarRoutes / totalRoutes) * 75)
 *     = similarRoutes * 75 / totalRoutes
 *     Used by: BenjiLoadRecommendationService
 *
 * Example with 8 similar out of 10 total routes:
 *   dispatcher    → 48
 *   recommendation → 60
 *
 * DO NOT unify these formulas — they are intentionally different and changing
 * either silently alters scores in production.
 */
export type { RouteFitStrategy };

/**
 * Score how well a load fits a driver's historical routes (0–100).
 * Returns 50 for new drivers (no history) and on DB errors.
 *
 * Pass the appropriate strategy for the calling service to preserve the
 * original production formula exactly.
 */
export async function calculateRouteFit(
  driverId: string,
  load: LoadLocations,
  strategy: RouteFitStrategy,
): Promise<number> {
  try {
    const { data: pastShipments } = await supabase
      .from('shipments')
      .select('pickup_address, delivery_address, pickup_location, delivery_location')
      .eq('driver_id', driverId)
      .eq('status', 'completed')
      .limit(20);

    if (!pastShipments || pastShipments.length === 0) {
      return 50; // Neutral score for new drivers
    }

    let similarRoutes = 0;
    const totalRoutes = pastShipments.length;

    for (const past of pastShipments) {
      const pickupMatch = areCitiesNear(
        load.pickup_location as GeoPoint,
        past.pickup_location as GeoPoint,
      );
      const deliveryMatch = areCitiesNear(
        load.delivery_location as GeoPoint,
        past.delivery_location as GeoPoint,
      );

      if (pickupMatch && deliveryMatch) {
        similarRoutes += 2; // Exact corridor match
      } else if (pickupMatch || deliveryMatch) {
        similarRoutes += 1; // Partial match
      }
    }

    if (strategy === ROUTE_FIT_STRATEGY.DISPATCH) {
      // Original BenjiDispatcherService formula:
      // Normalises by (totalRoutes * 2) = max possible similarRoutes, then boosts 20%
      const fitScore = (similarRoutes / (totalRoutes * 2)) * 100;
      return Math.min(100, fitScore * 1.2);
    } else {
      // Original BenjiLoadRecommendationService formula:
      // Normalises by totalRoutes only, multiplied by 75 (no boost needed)
      return Math.min(100, (similarRoutes / totalRoutes) * 75);
    }
  } catch {
    return 50; // Default neutral score on error
  }
}
