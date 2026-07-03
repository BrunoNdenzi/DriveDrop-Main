/**
 * Benji V2 — Step Input Resolver
 * Phase 8.8
 *
 * Derives the correct tool input for each step based on the current
 * OrchestratorRequest and prior tool outputs. Called by both
 * BenjiOrchestrator.executeSteps() and StreamingOrchestrator's inline
 * step loop, avoiding duplicated input-building logic.
 *
 * Design:
 *   - Pure function — no side effects, no DB access
 *   - Falls back to step.input (if the plan builder set it) or {} for unknown tools
 *   - Prior outputs allow downstream tools (e.g. validate.input) to consume
 *     the result of upstream tools (e.g. shipment.parse)
 */

import type { OrchestratorRequest } from '@benji/core/types/orchestrator.types';
import type { ToolResult }           from '@benji/core/types/tool.types';
import type { VehicleType }          from '../../services/pricing.service';

// ─── Prior-output extractor ───────────────────────────────────────────────────

/**
 * Extract the structured data produced by tool:shipment.parse from prior outputs.
 * Used by tool:validate.input to validate the parsed shipment fields.
 */
function _extractParsedData(
  priorOutputs: Record<string, ToolResult<unknown>>,
): Record<string, unknown> {
  for (const r of Object.values(priorOutputs)) {
    const stamped = r as ToolResult<unknown> & { _stepAction?: string };
    if (stamped._stepAction === 'tool:shipment.parse' && r.success && r.data !== undefined) {
      return (r.data as Record<string, unknown>);
    }
  }
  return {};
}

/**
 * Extract the output produced by tool:pricing.calculate from prior outputs.
 */
function _extractPricingOutput(
  priorOutputs: Record<string, ToolResult<unknown>>,
): { total?: number; distanceMiles?: number } {
  for (const r of Object.values(priorOutputs)) {
    const stamped = r as ToolResult<unknown> & { _stepAction?: string };
    if (stamped._stepAction === 'tool:pricing.calculate' && r.success && r.data !== undefined) {
      const d = r.data as Record<string, unknown>;
      const result: { total?: number; distanceMiles?: number } = {};
      if (typeof d['total']         === 'number') result.total         = d['total'];
      if (typeof d['distanceMiles'] === 'number') result.distanceMiles = d['distanceMiles'];
      return result;
    }
  }
  return {};
}

// ─── Vehicle-type inference ───────────────────────────────────────────────────

const _LUXURY_BRANDS = ['bmw', 'mercedes', 'audi', 'lexus', 'porsche', 'tesla', 'jaguar', 'maserati', 'bentley'];
const _MOTO_BRANDS   = ['harley', 'yamaha', 'kawasaki', 'suzuki', 'ducati'];
const _PICKUP_MODELS = ['f-150', 'f150', 'silverado', 'ram', 'tundra', 'tacoma', 'ranger', 'colorado', 'titan', 'frontier'];
const _HEAVY_MODELS  = ['semi', 'box truck', 'cargo van', 'sprinter'];
const _SUV_MODELS    = ['explorer', 'tahoe', 'suburban', 'yukon', 'expedition', 'pilot', 'highlander', 'pathfinder', '4runner', 'traverse', 'durango'];

function _inferVehicleType(vehicle: Record<string, unknown> | undefined): VehicleType {
  const make  = String(vehicle?.['make']  ?? '').toLowerCase();
  const model = String(vehicle?.['model'] ?? '').toLowerCase();
  const type  = String(vehicle?.['type']  ?? '').toLowerCase();

  // Honour explicit type if it's already a valid pricing tier
  const VALID: ReadonlySet<string> = new Set(['sedan','suv','pickup','luxury','motorcycle','golfcart','heavy']);
  if (VALID.has(type)) return type as VehicleType;

  if (_LUXURY_BRANDS.some(b => make.includes(b))) return 'luxury';
  if (_MOTO_BRANDS.some(b => make.includes(b)) || type.includes('motorcycle')) return 'motorcycle';
  if (type.includes('golfcart') || type.includes('golf cart')) return 'golfcart';
  if (_PICKUP_MODELS.some(m => model.includes(m)) || type.includes('pickup') || type.includes('truck')) return 'pickup';
  if (_HEAVY_MODELS.some(m => model.includes(m) || type.includes(m)))  return 'heavy';
  if (_SUV_MODELS.some(m => model.includes(m)) || type.includes('suv')) return 'suv';
  return 'sedan';
}

// ─── Public resolver ──────────────────────────────────────────────────────────

/**
 * Build the input record for a given tool action.
 *
 * @param action        Registered tool name (e.g. 'tool:chat.respond')
 * @param stepInput     Optional step-level input already set by the plan builder — used as-is if set
 * @param request       The originating orchestrator request
 * @param priorOutputs  Outputs from steps that have already executed this session
 * @param intent        The classified intent for the current request
 */
export function resolveStepInput(
  action:       string,
  stepInput:    unknown,
  request:      OrchestratorRequest,
  priorOutputs: Record<string, ToolResult<unknown>>,
  intent:       string | undefined,
): Record<string, unknown> {
  // If the plan builder explicitly set an input, honour it
  if (stepInput !== undefined && stepInput !== null && typeof stepInput === 'object') {
    const keys = Object.keys(stepInput as object);
    if (keys.length > 0) return stepInput as Record<string, unknown>;
  }

  switch (action) {
    case 'tool:validate.input': {
      // Unwrap parsed_data from the NLParseResult envelope (tool:shipment.parse must run first)
      const nlResult   = _extractParsedData(priorOutputs);
      const parsedData = (nlResult['parsed_data'] ?? nlResult) as Record<string, unknown>;
      return {
        intent: intent ?? (request._classifiedIntent ?? 'general.inquiry'),
        data:   parsedData,
      };
    }

    case 'tool:shipment.parse':
      return {
        user_id:      request.userId,
        input_text:   request.message,
        input_method: 'text',
      };

    case 'tool:pricing.calculate': {
      const nlResult    = _extractParsedData(priorOutputs);
      const parsedData  = (nlResult['parsed_data'] ?? nlResult) as Record<string, unknown>;
      return {
        vehicleType:      _inferVehicleType(parsedData['vehicle'] as Record<string, unknown> | undefined),
        pickupLocation:   String((parsedData['pickup']   as Record<string, unknown> | undefined)?.['location']  ?? ''),
        deliveryLocation: String((parsedData['delivery'] as Record<string, unknown> | undefined)?.['location'] ?? ''),
      };
    }

    case 'tool:shipment.create': {
      const nlResult   = _extractParsedData(priorOutputs);
      const parsedData = (nlResult['parsed_data'] ?? nlResult) as Record<string, unknown>;
      const pricing    = _extractPricingOutput(priorOutputs);
      return {
        userId:         request.userId,
        parsedData,
        ...(pricing.total         !== undefined ? { estimatedPrice: pricing.total }         : {}),
        ...(pricing.distanceMiles !== undefined ? { distanceMiles:  pricing.distanceMiles } : {}),
      };
    }

    case 'tool:chat.respond':
      return {
        messages: [{ role: 'user', content: request.message }],
        context: {
          userId:   request.userId,
          userType: request.userType,
          ...(request.sessionId !== undefined ? { currentPage: request.sessionId } : {}),
        },
      };

    case 'tool:memory.read':
      return { userId: request.userId };

    default:
      // tool:memory.write and any custom tools must have their input
      // set via step.input in the plan builder.
      return {};
  }
}
