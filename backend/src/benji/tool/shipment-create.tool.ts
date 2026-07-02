/**
 * Benji V2 — tool:shipment.create
 * Phase 9.2
 *
 * Creates a DriveDrop shipment from parsed natural language data.
 * This is the terminal mutation in the shipment.create plan.
 *
 * Idempotency:
 *   The confirmation store's atomic DELETE...RETURNING prevents the resume
 *   orchestrator from executing this tool more than once per confirmation.
 *   A trace_id→shipment_id mapping is stored in the tool output (benji_trace_steps)
 *   so replay audits can verify the created shipment without re-creating it.
 *
 * Governance: I-8A (mutation via approved service), I-10, I-13, I-14
 *
 * writeNamespaces declared so memory service can persist the new shipment ID
 * into user.history on Phase 9.x memory-write step (not wired yet).
 */

import NaturalLanguageShipmentService from '../../services/NaturalLanguageShipmentService';
import type { ParsedShipmentData } from '../../services/NaturalLanguageShipmentService';
import type { ToolDefinition, ToolContext } from '@benji/core/types/tool.types';

// ─── I/O Types ────────────────────────────────────────────────────────────────

export interface ShipmentCreateInput {
  /** Authenticated user ID — taken from OrchestratorRequest.userId via resolver. */
  userId:         string;
  /** Structured data from tool:shipment.parse (NLParseResult.parsed_data). */
  parsedData:     ParsedShipmentData;
  /**
   * Pre-computed price from tool:pricing.calculate.
   * When provided, createShipment skips internal pricing recalculation.
   */
  estimatedPrice?: number;
  /**
   * Pre-computed distance from tool:pricing.calculate.
   * When provided, createShipment skips the Google Maps directions call.
   */
  distanceMiles?:  number;
}

export interface ShipmentCreateOutput {
  shipment_id:     string;
  estimatedPrice:  number;
  distanceMiles:   number;
  vehicle:         string;   // "year make model" label
  pickupAddress:   string;
  deliveryAddress: string;
}

// ─── Service instance ─────────────────────────────────────────────────────────

const _nlService = new NaturalLanguageShipmentService();

// ─── Input guard ──────────────────────────────────────────────────────────────

function isShipmentCreateInput(input: unknown): input is ShipmentCreateInput {
  if (typeof input !== 'object' || input === null) return false;
  const obj = input as Record<string, unknown>;
  return typeof obj['userId']     === 'string' &&
         typeof obj['parsedData'] === 'object' && obj['parsedData'] !== null;
}

// ─── Tool definition ──────────────────────────────────────────────────────────

export const shipmentCreateTool: ToolDefinition<ShipmentCreateInput, ShipmentCreateOutput> = {
  name:        'tool:shipment.create',
  description: 'Create a DriveDrop shipment row from parsed vehicle/location data.',
  isMutation:  true,
  namespaceAccess: { read: ['user.history'], write: ['user.history'] },
  validate:    isShipmentCreateInput,

  execute: async (input: ShipmentCreateInput, _ctx: ToolContext): Promise<ShipmentCreateOutput> => {
    const result = await _nlService.createShipment(
      input.userId,
      input.parsedData,
      input.estimatedPrice,
      input.distanceMiles,
    );

    if (!result.success || !result.shipment_id) {
      throw new Error(result.error ?? 'shipment creation failed');
    }

    const v = input.parsedData.vehicle;
    const vehicleLabel = [v?.year, v?.make, v?.model].filter(Boolean).join(' ') || 'Vehicle';

    return {
      shipment_id:     result.shipment_id,
      estimatedPrice:  result.shipment?.estimated_price ?? input.estimatedPrice ?? 0,
      distanceMiles:   result.shipment?.distance        ?? input.distanceMiles  ?? 0,
      vehicle:         vehicleLabel,
      pickupAddress:   result.shipment?.pickup_address  ?? input.parsedData.pickup?.location  ?? '',
      deliveryAddress: result.shipment?.delivery_address ?? input.parsedData.delivery?.location ?? '',
    };
  },
};
