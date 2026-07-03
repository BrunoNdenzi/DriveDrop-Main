/**
 * Benji V3 — Tool adapter layer
 *
 * Exposes logistics capabilities as OpenAI function-calling tools.
 * Each tool:
 *   1. Has a JSON Schema definition (sent to OpenAI with every request)
 *   2. Has an execute() handler that runs the real backend service
 *   3. Returns a V3ToolResult with a human-readable `summary` the LLM quotes
 *
 * The LLM decides WHICH tools to call and WHEN — this file only provides the
 * capability, not the routing logic.
 *
 * Reuses:
 *   NaturalLanguageShipmentService  — parse + create
 *   pricingService                  — calculate route price
 *   googleMapsService               — distance/duration lookup
 */

import type OpenAI from 'openai';
import NaturalLanguageShipmentService from '../../services/NaturalLanguageShipmentService';
import { pricingService }   from '../../services/pricing.service';
import { googleMapsService } from '../../services/google-maps.service';
import type { V3ToolResult }  from '../benji.types';

const _nlService = new NaturalLanguageShipmentService();

// ─── Tool Definitions (JSON Schema sent to OpenAI) ────────────────────────────

export const V3_TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_shipping_quote',
      description:
        'Calculate a shipping price estimate for a vehicle between two locations. ' +
        'Use this when the user asks for a quote, price, cost, or rate. ' +
        'All parameters are required — if any are missing, ask the user first.',
      parameters: {
        type: 'object',
        properties: {
          vehicle_make:      { type: 'string', description: 'Vehicle manufacturer, e.g. Honda' },
          vehicle_model:     { type: 'string', description: 'Vehicle model, e.g. Civic' },
          vehicle_year:      { type: 'number', description: 'Four-digit model year, e.g. 2020' },
          vehicle_type:      {
            type: 'string',
            enum: ['sedan', 'suv', 'pickup', 'luxury', 'motorcycle', 'golfcart', 'heavy'],
            description: 'Vehicle category. Infer from make/model when possible.',
          },
          origin:            { type: 'string', description: 'Pickup city/state or full address' },
          destination:       { type: 'string', description: 'Delivery city/state or full address' },
        },
        required: ['vehicle_make', 'vehicle_model', 'origin', 'destination'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'parse_shipment_details',
      description:
        'Extract structured vehicle and location information from a natural language message. ' +
        'Use this when the user describes a shipment in plain English and you need to structure the data. ' +
        'Do NOT use this for simple greetings or generic questions.',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The full user message describing the shipment',
          },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_shipment',
      description:
        'Create a real DriveDrop shipment booking. ' +
        'ONLY call this after: (1) user has confirmed all details, (2) a quote has been shown, (3) user has explicitly said they want to proceed. ' +
        'Requires complete vehicle info, origin, destination, and user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          user_id:         { type: 'string',  description: 'The authenticated user ID' },
          vehicle_make:    { type: 'string' },
          vehicle_model:   { type: 'string' },
          vehicle_year:    { type: 'number' },
          vehicle_vin:     { type: 'string',  description: 'Optional VIN' },
          origin:          { type: 'string',  description: 'Pickup address' },
          destination:     { type: 'string',  description: 'Delivery address' },
          is_operable:     { type: 'boolean', description: 'Whether the vehicle runs and drives' },
          estimated_price: { type: 'number',  description: 'Price from a prior get_shipping_quote call' },
          distance_miles:  { type: 'number',  description: 'Distance from a prior get_shipping_quote call' },
        },
        required: ['user_id', 'vehicle_make', 'vehicle_model', 'origin', 'destination'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'track_shipment',
      description: 'Look up the current status and location of an existing shipment.',
      parameters: {
        type: 'object',
        properties: {
          shipment_id: {
            type: 'string',
            description: 'The DriveDrop shipment ID (UUID or short code)',
          },
        },
        required: ['shipment_id'],
      },
    },
  },
];

// ─── Tool Executors ───────────────────────────────────────────────────────────

/** Parse arguments coming from OpenAI (might be a string or already an object). */
function parseArgs(raw: string): Record<string, unknown> {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, unknown>);
  } catch {
    return {};
  }
}

/** Infer a VehicleType from make/model string. */
function inferVehicleType(make: string, model: string): string {
  const m = make.toLowerCase();
  const mod = model.toLowerCase();
  if (['bmw', 'mercedes', 'audi', 'lexus', 'porsche', 'tesla', 'jaguar', 'maserati'].some(b => m.includes(b))) return 'luxury';
  if (['harley', 'yamaha', 'kawasaki', 'suzuki', 'ducati'].some(b => m.includes(b))) return 'motorcycle';
  if (['f-150', 'f150', 'silverado', 'ram', 'tundra', 'tacoma', 'ranger', 'colorado'].some(b => mod.includes(b))) return 'pickup';
  if (['explorer', 'tahoe', 'suburban', 'yukon', 'expedition', 'pilot', 'highlander', '4runner', 'traverse'].some(b => mod.includes(b))) return 'suv';
  return 'sedan';
}

// ─── get_shipping_quote ───────────────────────────────────────────────────────

async function execGetShippingQuote(args: Record<string, unknown>): Promise<V3ToolResult> {
  const make   = String(args['vehicle_make']  ?? '');
  const model  = String(args['vehicle_model'] ?? '');
  const origin = String(args['origin']        ?? '');
  const dest   = String(args['destination']   ?? '');
  const vType  = String(args['vehicle_type']  ?? inferVehicleType(make, model)) as 'sedan' | 'suv' | 'pickup' | 'luxury' | 'motorcycle' | 'golfcart' | 'heavy';

  if (!origin || !dest) {
    return { success: false, data: null, summary: '', errorMessage: 'Origin and destination are required to generate a quote.' };
  }

  try {
    // Use getDirections which returns distance in the leg
    const directions = await googleMapsService.getDirections(origin, dest);
    const distanceText = directions.distance?.text ?? '';
    // Convert "123.4 mi" → number
    const distanceMiles = parseFloat(distanceText.replace(/[^\d.]/g, '')) || 0;

    if (distanceMiles === 0) {
      return {
        success:      false,
        data:         null,
        summary:      '',
        errorMessage: `I couldn't find a route between ${origin} and ${dest}. Please verify the locations.`,
      };
    }

    const { total } = pricingService.calculateQuote({
      vehicleType:   vType,
      distanceMiles,
    });

    const data = { total, distanceMiles, vehicleType: vType, origin, destination: dest };
    const yearLabel = args['vehicle_year'] ? `${args['vehicle_year']} ` : '';
    const summary   = `Estimated shipping cost for a ${yearLabel}${make} ${model} from ${origin} to ${dest}: $${total.toFixed(0)} (${distanceMiles.toFixed(0)} miles).`;

    return { success: true, data, summary };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `Quote failed: ${msg}` };
  }
}

// ─── parse_shipment_details ───────────────────────────────────────────────────

async function execParseShipmentDetails(args: Record<string, unknown>, userId: string): Promise<V3ToolResult> {
  const text = String(args['text'] ?? '');
  if (!text) {
    return { success: false, data: null, summary: '', errorMessage: 'No text to parse.' };
  }

  try {
    const result = await _nlService.parseShipment({
      user_id:      userId,
      input_text:   text,
      input_method: 'text',
    });

    if (!result.success || !result.parsed_data) {
      return {
        success:      false,
        data:         null,
        summary:      '',
        errorMessage: 'I had trouble parsing the shipment details. Could you provide the vehicle year, make, model, and the pickup and delivery locations?',
      };
    }

    const d = result.parsed_data;
    const vehicleStr = [d.vehicle?.year, d.vehicle?.make, d.vehicle?.model].filter(Boolean).join(' ');
    const parts: string[] = [];
    if (vehicleStr)             parts.push(`Vehicle: ${vehicleStr}`);
    if (d.pickup?.location)     parts.push(`Pickup: ${d.pickup.location}`);
    if (d.delivery?.location)   parts.push(`Delivery: ${d.delivery.location}`);

    return {
      success: true,
      data:    result.parsed_data,
      summary: parts.length > 0 ? `Parsed: ${parts.join(' | ')}.` : 'Shipment details partially extracted.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `Parse failed: ${msg}` };
  }
}

// ─── create_shipment ──────────────────────────────────────────────────────────

async function execCreateShipment(args: Record<string, unknown>): Promise<V3ToolResult> {
  try {
    const parsedData = {
      vehicle: {
        make:      String(args['vehicle_make']  ?? ''),
        model:     String(args['vehicle_model'] ?? ''),
        ...(args['vehicle_year'] !== undefined ? { year: Number(args['vehicle_year']) } : {}),
        ...(typeof args['vehicle_vin'] === 'string' ? { vin: args['vehicle_vin'] } : {}),
        condition: (args['is_operable'] === false ? 'non_running' : 'running') as 'running' | 'non_running',
      },
      pickup:   { location: String(args['origin']      ?? '') },
      delivery: { location: String(args['destination'] ?? '') },
    };

    const result = await _nlService.createShipment(
      String(args['user_id'] ?? ''),
      parsedData,
      typeof args['estimated_price'] === 'number' ? args['estimated_price'] : undefined,
      typeof args['distance_miles']  === 'number' ? args['distance_miles']  : undefined,
    );

    const shipmentId = (result as Record<string, unknown>)['shipment_id'] as string | undefined;
    if (!shipmentId) {
      return {
        success:      false,
        data:         result,
        summary:      '',
        errorMessage: 'Shipment creation succeeded but no ID was returned.',
      };
    }

    return {
      success: true,
      data:    result,
      summary: `Shipment created successfully! Your shipment ID is ${shipmentId}.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `Shipment creation failed: ${msg}` };
  }
}

// ─── track_shipment ───────────────────────────────────────────────────────────

async function execTrackShipment(args: Record<string, unknown>): Promise<V3ToolResult> {
  const shipmentId = String(args['shipment_id'] ?? '').trim();
  if (!shipmentId) {
    return { success: false, data: null, summary: '', errorMessage: 'Shipment ID is required for tracking.' };
  }

  try {
    // Import supabase lazily to avoid circular deps at module load
    const { supabaseAdmin } = await import('../../lib/supabase');
    const { data, error } = await supabaseAdmin
      .from('shipments')
      .select('id, status, vehicle_make, vehicle_model, vehicle_year, pickup_address, delivery_address, created_at, driver_id')
      .eq('id', shipmentId)
      .single();

    if (error || !data) {
      return {
        success:      false,
        data:         null,
        summary:      '',
        errorMessage: `I couldn't find shipment ${shipmentId}. Please double-check the ID.`,
      };
    }

    const vehicle = [data.vehicle_year, data.vehicle_make, data.vehicle_model].filter(Boolean).join(' ');
    const summary = `Shipment ${shipmentId}: ${vehicle} — Status: ${data.status}. Pickup: ${data.pickup_address} → Delivery: ${data.delivery_address}.`;

    return { success: true, data, summary };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `Tracking failed: ${msg}` };
  }
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

/**
 * Execute a tool by name with the raw arguments string from OpenAI.
 * Always returns V3ToolResult — never throws.
 */
export async function executeV3Tool(
  toolName: string,
  argsRaw:  string,
  userId:   string,
): Promise<V3ToolResult> {
  const args = parseArgs(argsRaw);

  try {
    switch (toolName) {
      case 'get_shipping_quote':     return await execGetShippingQuote(args);
      case 'parse_shipment_details': return await execParseShipmentDetails(args, userId);
      case 'create_shipment':        return await execCreateShipment({ ...args, user_id: userId });
      case 'track_shipment':         return await execTrackShipment(args);
      default:
        return { success: false, data: null, summary: '', errorMessage: `Unknown tool: ${toolName}` };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: msg };
  }
}
