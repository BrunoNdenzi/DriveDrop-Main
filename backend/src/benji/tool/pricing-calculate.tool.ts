/**
 * Benji V2 — tool:pricing.calculate
 * Phase 9.2
 *
 * Computes a shipping price quote by:
 *   1. Calling Google Maps Directions API to derive distanceMiles from addresses
 *   2. Running the live dynamic pricing calculator
 *
 * Read-only — no DB writes, no events.
 *
 * Input is built by step-input.resolver.ts from the prior tool:shipment.parse output.
 * Output (total + distanceMiles) is forwarded to tool:shipment.create via resolver,
 * avoiding a second Google Maps + pricing call inside NaturalLanguageShipmentService.
 */

import { calculateQuoteWithDynamicConfig, type VehicleType } from '../../services/pricing.service';
import { googleMapsService } from '../../services/google-maps.service';
import type { ToolDefinition, ToolContext } from '@benji/core/types/tool.types';

// ─── I/O Types ────────────────────────────────────────────────────────────────

export interface PricingCalculateInput {
  vehicleType:       VehicleType;
  /** Full address string, e.g. "Charlotte, NC" */
  pickupLocation:    string;
  /** Full address string, e.g. "Atlanta, GA" */
  deliveryLocation:  string;
  isAccidentRecovery?: boolean;
  vehicleCount?:     number;
}

export interface PricingCalculateOutput {
  total:         number;
  distanceMiles: number;
  vehicleType:   VehicleType;
  breakdown:     {
    baseRatePerMile:   number;
    distanceBand:      'short' | 'mid' | 'long';
    surgeMultiplier:   number;
    deliveryType:      'expedited' | 'flexible' | 'standard';
    minimumApplied:    boolean;
  };
}

// ─── Valid vehicle types (mirrors pricing.service VehicleType) ─────────────────

const VALID_VEHICLE_TYPES: ReadonlySet<string> = new Set<VehicleType>([
  'sedan', 'suv', 'pickup', 'luxury', 'motorcycle', 'golfcart', 'heavy',
]);

function isVehicleType(v: unknown): v is VehicleType {
  return typeof v === 'string' && VALID_VEHICLE_TYPES.has(v);
}

// ─── Input guard ──────────────────────────────────────────────────────────────

function isPricingCalculateInput(input: unknown): input is PricingCalculateInput {
  if (typeof input !== 'object' || input === null) return false;
  const obj = input as Record<string, unknown>;
  return isVehicleType(obj['vehicleType']) &&
         typeof obj['pickupLocation']   === 'string' && (obj['pickupLocation']   as string).length > 0 &&
         typeof obj['deliveryLocation'] === 'string' && (obj['deliveryLocation'] as string).length > 0;
}

// ─── Tool definition ──────────────────────────────────────────────────────────

export const pricingCalculateTool: ToolDefinition<PricingCalculateInput, PricingCalculateOutput> = {
  name:        'tool:pricing.calculate',
  description: 'Compute dynamic shipping price quote: derives distance via Google Maps, then runs dynamic pricing.',
  isMutation:  false,
  validate:    isPricingCalculateInput,

  execute: async (input: PricingCalculateInput, _ctx: ToolContext): Promise<PricingCalculateOutput> => {
    // 1. Derive route distance
    let distanceMiles = 500; // safe fallback if Google Maps is unavailable
    try {
      const directions = await googleMapsService.getDirections(
        input.pickupLocation,
        input.deliveryLocation,
      );
      distanceMiles = Math.round(directions.distance.value * 0.000621371); // meters → miles
    } catch {
      // Non-critical: pricing continues with fallback distance
    }

    // 2. Calculate price
    const { total, breakdown } = await calculateQuoteWithDynamicConfig({
      vehicleType:        input.vehicleType,
      distanceMiles,
      isAccidentRecovery: input.isAccidentRecovery ?? false,
      vehicleCount:       input.vehicleCount ?? 1,
    });

    return {
      total,
      distanceMiles,
      vehicleType: input.vehicleType,
      breakdown: {
        baseRatePerMile: breakdown.baseRatePerMile,
        distanceBand:    breakdown.distanceBand,
        surgeMultiplier: breakdown.surgeMultiplier,
        deliveryType:    breakdown.deliveryType,
        minimumApplied:  breakdown.minimumApplied,
      },
    };
  },
};
