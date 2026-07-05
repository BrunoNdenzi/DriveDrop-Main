/**
 * Benji V4 — Tool adapter layer
 *
 * 14 tools covering the full DriveDrop capability matrix:
 *
 *   V3 (existing): get_shipping_quote, parse_shipment_details, create_shipment, track_shipment
 *   V4 (new):      list_shipments, update_shipment_status, apply_for_shipment,
 *                  list_driver_applications, send_message, get_messages,
 *                  get_payment_info, get_profile, assign_driver, list_users
 *
 * Each tool:
 *   1. Has a JSON Schema definition (sent to OpenAI with every request)
 *   2. Has an execute() handler that runs the real backend service
 *   3. Returns V3ToolResult with a human-readable `summary` the LLM quotes
 *   4. Enforces role-based permissions server-side
 *
 * Reuses:
 *   NaturalLanguageShipmentService  — parse + create
 *   pricingService                  — calculate route price
 *   googleMapsService               — distance/duration lookup
 *   supabaseAdmin                   — direct DB access for new tools
 */

import type OpenAI from 'openai';
import NaturalLanguageShipmentService from '../../services/NaturalLanguageShipmentService';
import { pricingService }        from '../../services/pricing.service';
import { googleMapsService }     from '../../services/google-maps.service';
import { estimateDistanceMiles } from './distance.utils';
import type { V3ToolResult, UserType } from '../benji.types';

const _nlService = new NaturalLanguageShipmentService();

// ─── Tool Definitions (JSON Schema sent to OpenAI) ────────────────────────────

export const V3_TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_shipping_quote',
      description:
        'Calculate a shipping price estimate for a vehicle between two locations. ' +
        'Use this when the user asks for a quote, price, cost, rate, or estimate. ' +
        'Origin and destination are required. Vehicle make/model are optional — ' +
        'call this tool as soon as you have the route, even if make/model are unknown.',
      parameters: {
        type: 'object',
        properties: {
          vehicle_make:  { type: 'string', description: 'Vehicle manufacturer, e.g. Honda (optional)' },
          vehicle_model: { type: 'string', description: 'Vehicle model, e.g. Civic (optional)' },
          vehicle_year:  { type: 'number', description: 'Four-digit model year, e.g. 2020 (optional)' },
          vehicle_type:  {
            type: 'string',
            enum: ['sedan', 'suv', 'pickup', 'luxury', 'motorcycle', 'golfcart', 'heavy'],
            description: 'Vehicle category. Infer from context or default to sedan.',
          },
          origin:        { type: 'string', description: 'Pickup city/state or full address' },
          destination:   { type: 'string', description: 'Delivery city/state or full address' },
        },
        required: ['origin', 'destination'],
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
      description:
        'Look up the current status and details of an existing shipment. ' +
        'Can find a shipment by its UUID, OR by describing the vehicle/route when the user does not know the ID. ' +
        'If the user says "track my shipment" without an ID, pass the vehicle make/model and locations you know from context. ' +
        'If no information is available, call this tool with no arguments to show the user\'s most recent active shipment.',
      parameters: {
        type: 'object',
        properties: {
          shipment_id: {
            type: 'string',
            description: 'The exact DriveDrop shipment UUID. Omit if using description-based lookup instead.',
          },
          vehicle_make: {
            type: 'string',
            description: 'Vehicle make for description-based lookup, e.g. Toyota.',
          },
          vehicle_model: {
            type: 'string',
            description: 'Vehicle model for description-based lookup, e.g. Camry.',
          },
          origin: {
            type: 'string',
            description: 'Pickup city/state for description-based lookup, e.g. Charlotte, NC.',
          },
          destination: {
            type: 'string',
            description: 'Delivery city/state for description-based lookup, e.g. Dallas, TX.',
          },
        },
        required: [],
      },
    },
  },

  // ── V4 tools ──────────────────────────────────────────────────────────────

  {
    type: 'function',
    function: {
      name: 'list_shipments',
      description:
        'List shipments for the current user. ' +
        'Clients see their own shipments. Drivers see their assigned shipments. Admins see all shipments. ' +
        'Use this when the user wants to view their shipment history, active shipments, or all orders.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'accepted', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'],
            description: 'Filter by status. Omit to return shipments of any status.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (1–20, default 5).',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'update_shipment_status',
      description:
        'Update the status of a shipment. ' +
        'Drivers use this to mark pickup, confirm delivery, or update transit status. ' +
        'Admins can set any status. ' +
        'Clients CANNOT update status — only drivers and admins can. ' +
        'Confirm with the user before updating.',
      parameters: {
        type: 'object',
        properties: {
          shipment_id: {
            type: 'string',
            description: 'The shipment UUID to update.',
          },
          status: {
            type: 'string',
            enum: ['accepted', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'],
            description: 'New status to set.',
          },
          notes: {
            type: 'string',
            description: 'Optional notes about this status update (e.g. "Picked up at origin, vehicle in good condition").',
          },
        },
        required: ['shipment_id', 'status'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'apply_for_shipment',
      description:
        'Apply for a pending shipment as a driver. ' +
        'Only drivers can apply. Use this when a driver wants to pick up or bid on a load.',
      parameters: {
        type: 'object',
        properties: {
          shipment_id: {
            type: 'string',
            description: 'The UUID of the pending shipment to apply for.',
          },
          notes: {
            type: 'string',
            description: 'Optional notes or message to the shipper (e.g. availability, ETA).',
          },
        },
        required: ['shipment_id'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'list_driver_applications',
      description:
        'List the authenticated driver\'s shipment applications and their statuses. ' +
        'Only drivers can use this. Use when a driver asks about their applications, pending loads, or acceptance status.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'accepted', 'rejected', 'cancelled'],
            description: 'Filter by application status. Omit to return all.',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'send_message',
      description:
        'Send a message in a shipment conversation. ' +
        'Use this when a user wants to contact the driver, shipper, or dispatcher about a specific shipment.',
      parameters: {
        type: 'object',
        properties: {
          shipment_id: {
            type: 'string',
            description: 'The UUID of the shipment conversation.',
          },
          content: {
            type: 'string',
            description: 'The message text to send (max 2000 characters).',
          },
          receiver_id: {
            type: 'string',
            description: 'Optional: specific recipient user ID. Omit to send to all participants.',
          },
        },
        required: ['shipment_id', 'content'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_messages',
      description:
        'Retrieve recent messages from a shipment conversation. ' +
        'Use when a user wants to read their conversation history for a shipment.',
      parameters: {
        type: 'object',
        properties: {
          shipment_id: {
            type: 'string',
            description: 'The UUID of the shipment whose messages to retrieve.',
          },
          limit: {
            type: 'number',
            description: 'Number of most recent messages to return (1–50, default 20).',
          },
        },
        required: ['shipment_id'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_payment_info',
      description:
        'Get payment status and details for a shipment. ' +
        'Use when a user asks about their payment, invoice, charges, or refund eligibility. ' +
        'Available to clients (for their own shipments) and admins.',
      parameters: {
        type: 'object',
        properties: {
          shipment_id: {
            type: 'string',
            description: 'The UUID of the shipment to check payment for.',
          },
        },
        required: ['shipment_id'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_profile',
      description:
        'Retrieve the current user\'s profile information including name, email, phone, role, and rating. ' +
        'Use when the user asks about their account, profile, or personal information.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'assign_driver',
      description:
        'Assign a driver to a shipment. Admin only. ' +
        'Use when an admin wants to manually assign or reassign a driver to a specific load.',
      parameters: {
        type: 'object',
        properties: {
          shipment_id: {
            type: 'string',
            description: 'The UUID of the shipment to assign.',
          },
          driver_id: {
            type: 'string',
            description: 'The UUID of the driver to assign.',
          },
        },
        required: ['shipment_id', 'driver_id'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'list_users',
      description:
        'List platform users with optional role filter. Admin only. ' +
        'Use when an admin asks to see users, drivers, clients, or platform members.',
      parameters: {
        type: 'object',
        properties: {
          role: {
            type: 'string',
            enum: ['client', 'driver', 'admin'],
            description: 'Filter by user role. Omit to return all roles.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (1–50, default 10).',
          },
        },
        required: [],
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

  let distanceMiles = 0;
  let isEstimate    = false;

  // ── Primary: Google Maps (real road distance) ─────────────────────────────
  try {
    const directions  = await googleMapsService.getDirections(origin, dest);
    const distText    = directions.distance?.text ?? '';
    const rawValue    = parseFloat(distText.replace(/[^\d.]/g, '')) || 0;
    // Google Maps returns "X mi" for US addresses; convert km if needed
    distanceMiles = /\bkm\b/i.test(distText) ? Math.round(rawValue / 1.60934) : rawValue;
  } catch {
    // ── Fallback: haversine estimate (± 10–15% accuracy) ─────────────────
    const approx = estimateDistanceMiles(origin, dest);
    if (approx !== null) {
      distanceMiles = approx;
      isEstimate    = true;
    }
  }

  if (distanceMiles === 0) {
    return {
      success:      false,
      data:         null,
      summary:      '',
      errorMessage: `I couldn't calculate the distance between ${origin} and ${dest}. Please provide a valid US city and state for both locations (e.g. "Dallas, TX").`,
    };
  }

  const { total } = pricingService.calculateQuote({ vehicleType: vType, distanceMiles });

  const data       = { total, distanceMiles, vehicleType: vType, origin, destination: dest, isEstimate };
  const yearLabel  = args['vehicle_year'] ? `${args['vehicle_year']} ` : '';
  const vehicleStr = make && model ? `${yearLabel}${make} ${model}` : (make || model || `${vType}`);
  const approxNote = isEstimate ? ' (estimated)' : '';
  const summary    = `Estimated shipping cost for a ${vehicleStr} from ${origin} to ${dest}: $${total.toFixed(0)}${approxNote} (${Math.round(distanceMiles)} miles).`;

  return { success: true, data, summary };
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

/**
 * Format a shipment DB row into a V3ToolResult.
 */
function formatShipmentResult(data: Record<string, unknown>): V3ToolResult {
  const id      = String(data['id'] ?? '');
  const vehicle = [data['vehicle_year'], data['vehicle_make'], data['vehicle_model']].filter(Boolean).join(' ') || 'Vehicle';
  const status  = String(data['status'] ?? 'unknown');
  const pickup  = String(data['pickup_address']   ?? data['pickup_location']   ?? '');
  const deliver = String(data['delivery_address'] ?? data['delivery_location'] ?? '');
  const price   = typeof data['estimated_price'] === 'number'
    ? ` | Quoted price: $${(data['estimated_price'] as number).toFixed(0)}`
    : '';

  const summary =
    `Shipment ${id.slice(0, 8)}…: ${vehicle} — ` +
    `Status: ${status}${price}. ` +
    `Route: ${pickup} → ${deliver}. ` +
    `ID: ${id}`;

  return { success: true, data, summary };
}

async function execTrackShipment(
  args:   Record<string, unknown>,
  userId: string,
): Promise<V3ToolResult> {
  const shipmentId   = String(args['shipment_id']   ?? '').trim();
  const vehicleMake  = String(args['vehicle_make']  ?? '').trim();
  const vehicleModel = String(args['vehicle_model'] ?? '').trim();
  const origin       = String(args['origin']        ?? '').trim();
  const destination  = String(args['destination']   ?? '').trim();

  const SELECT =
    'id, status, vehicle_make, vehicle_model, vehicle_year, vehicle_type, ' +
    'pickup_address, delivery_address, estimated_price, created_at, driver_id, client_id';

  try {
    const { supabaseAdmin } = await import('../../lib/supabase');

    // ── Strategy 1: Exact UUID match (all shipments, bypasses RLS) ─────────
    if (shipmentId) {
      const { data } = await supabaseAdmin
        .from('shipments')
        .select(SELECT)
        .eq('id', shipmentId)
        .maybeSingle();

      if (data) return formatShipmentResult(data as Record<string, unknown>);

      // ── Strategy 2: Prefix match (user gave a truncated ID) ─────────────
      // Protect against non-UUID-like strings that would break ilike
      if (shipmentId.length >= 4) {
        const { data: prefixData } = await supabaseAdmin
          .from('shipments')
          .select(SELECT)
          .ilike('id', `${shipmentId}%`)
          .limit(1)
          .maybeSingle();

        if (prefixData) return formatShipmentResult(prefixData as Record<string, unknown>);
      }
    }

    // ── Strategy 3: Description-based lookup scoped to the current user ────
    if (vehicleMake || vehicleModel || origin || destination) {
      // Look across shipments where the user is client OR driver
      let query = supabaseAdmin
        .from('shipments')
        .select(SELECT)
        .order('created_at', { ascending: false })
        .limit(1);

      if (vehicleMake)  query = query.ilike('vehicle_make',  `%${vehicleMake}%`);
      if (vehicleModel) query = query.ilike('vehicle_model', `%${vehicleModel}%`);
      if (origin)       query = query.ilike('pickup_address',   `%${origin}%`);
      if (destination)  query = query.ilike('delivery_address', `%${destination}%`);

      // Restrict to the authenticated user so we don't expose others' shipments
      // Try client_id first
      const { data: clientMatch } = await query.eq('client_id', userId).maybeSingle();
      if (clientMatch) return formatShipmentResult(clientMatch as Record<string, unknown>);

      // Try driver_id (driver looking up their own shipment)
      const { data: driverMatch } = await supabaseAdmin
        .from('shipments')
        .select(SELECT)
        .ilike(vehicleMake  ? 'vehicle_make'       : 'id', vehicleMake  || '%')
        .ilike(vehicleModel ? 'vehicle_model'      : 'id', vehicleModel || '%')
        .eq('driver_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (driverMatch) return formatShipmentResult(driverMatch as Record<string, unknown>);
    }

    // ── Strategy 4: No info given — return most recent active shipment ─────
    if (!shipmentId && !vehicleMake && !vehicleModel && !origin && !destination) {
      const { data: recentData } = await supabaseAdmin
        .from('shipments')
        .select(SELECT)
        .or(`client_id.eq.${userId},driver_id.eq.${userId}`)
        .not('status', 'in', '("delivered","cancelled")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentData) return formatShipmentResult(recentData as Record<string, unknown>);

      // No active shipment — return their most recent one of any status
      const { data: anyData } = await supabaseAdmin
        .from('shipments')
        .select(SELECT)
        .or(`client_id.eq.${userId},driver_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (anyData) return formatShipmentResult(anyData as Record<string, unknown>);

      return {
        success:      false,
        data:         null,
        summary:      '',
        errorMessage: "You don't have any shipments on record yet.",
      };
    }

    // Nothing matched
    const idClue    = shipmentId ? ` with ID "${shipmentId}"` : '';
    const descClue  = [vehicleMake, vehicleModel].filter(Boolean).join(' ');
    const routeClue = [origin, destination].filter(Boolean).join(' → ');
    const clue      = [descClue, routeClue].filter(Boolean).join(', ') || 'those details';

    return {
      success:      false,
      data:         null,
      summary:      '',
      errorMessage: `I couldn't find a shipment${idClue}${descClue ? ` for ${clue}` : ''}. Please double-check the ID or try listing your shipments.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `Tracking failed: ${msg}` };
  }
}

// ─── V4 executors ─────────────────────────────────────────────────────────────

// ─── list_shipments ───────────────────────────────────────────────────────────

async function execListShipments(
  args:     Record<string, unknown>,
  userId:   string,
  userRole: UserType,
): Promise<V3ToolResult> {
  const statusFilter = typeof args['status'] === 'string' ? args['status'] : undefined;
  const limit        = Math.min(Math.max(Number(args['limit'] ?? 5), 1), 20);

  try {
    const { supabaseAdmin } = await import('../../lib/supabase');

    let query = supabaseAdmin
      .from('shipments')
      .select('id, status, vehicle_make, vehicle_model, vehicle_year, vehicle_type, pickup_address, delivery_address, estimated_price, created_at, driver_id, client_id')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Role-based access: clients see their own, drivers see assigned, admins see all
    if (userRole === 'client') {
      query = query.eq('client_id', userId);
    } else if (userRole === 'driver') {
      query = query.eq('driver_id', userId);
    }
    // admin / broker — no additional filter

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, data: null, summary: '', errorMessage: `Failed to fetch shipments: ${error.message}` };
    }

    const rows = data ?? [];
    if (rows.length === 0) {
      const filterDesc = statusFilter ? ` with status "${statusFilter}"` : '';
      return {
        success: true,
        data:    [],
        summary: `No shipments found${filterDesc}.`,
      };
    }

    const lines = rows.map((s: Record<string, unknown>) => {
      const vehicle = [s['vehicle_year'], s['vehicle_make'], s['vehicle_model']].filter(Boolean).join(' ') || String(s['vehicle_type'] ?? 'Vehicle');
      const price   = typeof s['estimated_price'] === 'number' ? ` ($${(s['estimated_price'] as number).toFixed(0)})` : '';
      return `• ID ${String(s['id']).slice(0, 8)}…: ${vehicle} — ${String(s['status'])}${price} | ${String(s['pickup_address'])} → ${String(s['delivery_address'])}`;
    });

    return {
      success: true,
      data:    rows,
      summary: `Found ${rows.length} shipment(s):\n${lines.join('\n')}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `List shipments failed: ${msg}` };
  }
}

// ─── update_shipment_status ───────────────────────────────────────────────────

const VALID_STATUSES = ['accepted', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'] as const;
type ShipStatus = typeof VALID_STATUSES[number];

async function execUpdateShipmentStatus(
  args:     Record<string, unknown>,
  userId:   string,
  userRole: UserType,
): Promise<V3ToolResult> {
  if (userRole !== 'driver' && userRole !== 'admin') {
    return {
      success:      false,
      data:         null,
      summary:      '',
      errorMessage: 'Only drivers and admins can update shipment status.',
    };
  }

  const shipmentId = String(args['shipment_id'] ?? '').trim();
  const newStatus  = String(args['status']      ?? '').trim() as ShipStatus;

  if (!shipmentId) {
    return { success: false, data: null, summary: '', errorMessage: 'Shipment ID is required.' };
  }
  if (!(VALID_STATUSES as readonly string[]).includes(newStatus)) {
    return { success: false, data: null, summary: '', errorMessage: `Invalid status "${newStatus}". Valid values: ${VALID_STATUSES.join(', ')}.` };
  }

  try {
    const { supabaseAdmin } = await import('../../lib/supabase');

    // Drivers may only update shipments assigned to them
    if (userRole === 'driver') {
      const { data: ship } = await supabaseAdmin
        .from('shipments')
        .select('driver_id')
        .eq('id', shipmentId)
        .single();

      if (!ship || ship.driver_id !== userId) {
        return {
          success:      false,
          data:         null,
          summary:      '',
          errorMessage: `You are not assigned to shipment ${shipmentId}.`,
        };
      }
    }

    const updatePayload: Record<string, unknown> = {
      status:     newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === 'delivered')  updatePayload['delivered_at'] = new Date().toISOString();
    if (newStatus === 'accepted')   updatePayload['accepted_at']  = new Date().toISOString();
    if (newStatus === 'picked_up')  updatePayload['picked_up_at'] = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('shipments')
      .update(updatePayload)
      .eq('id', shipmentId)
      .select('id, status, vehicle_make, vehicle_model, pickup_address, delivery_address')
      .single();

    if (error || !data) {
      return { success: false, data: null, summary: '', errorMessage: `Status update failed: ${error?.message ?? 'Unknown error'}.` };
    }

    const vehicle = [data.vehicle_make, data.vehicle_model].filter(Boolean).join(' ') || 'Vehicle';
    const summary = `Shipment ${String(data.id).slice(0, 8)}… (${vehicle}) status updated to "${newStatus}".`;

    return { success: true, data, summary };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `Update failed: ${msg}` };
  }
}

// ─── apply_for_shipment ───────────────────────────────────────────────────────

async function execApplyForShipment(
  args:     Record<string, unknown>,
  userId:   string,
  userRole: UserType,
): Promise<V3ToolResult> {
  if (userRole !== 'driver') {
    return {
      success:      false,
      data:         null,
      summary:      '',
      errorMessage: 'Only drivers can apply for shipments.',
    };
  }

  const shipmentId = String(args['shipment_id'] ?? '').trim();
  if (!shipmentId) {
    return { success: false, data: null, summary: '', errorMessage: 'Shipment ID is required.' };
  }

  const notes = typeof args['notes'] === 'string' ? args['notes'] : null;

  try {
    const { supabase } = await import('../../lib/supabase');
    const { data, error } = await supabase.rpc('apply_for_shipment', {
      p_shipment_id: shipmentId,
      p_driver_id:  userId,
      p_notes:      notes,
    });

    if (error) {
      // Map known RPC error messages to friendly text
      const msg = error.message ?? '';
      if (msg.includes('already been assigned'))    return { success: false, data: null, summary: '', errorMessage: 'This shipment already has a driver assigned.' };
      if (msg.includes('not available'))            return { success: false, data: null, summary: '', errorMessage: 'This shipment is not available for applications.' };
      if (msg.includes('Shipment not found'))       return { success: false, data: null, summary: '', errorMessage: `Shipment ${shipmentId} was not found.` };
      return { success: false, data: null, summary: '', errorMessage: `Application failed: ${msg}` };
    }

    return {
      success: true,
      data,
      summary: `Your application for shipment ${shipmentId.slice(0, 8)}… has been submitted successfully.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `Application failed: ${msg}` };
  }
}

// ─── list_driver_applications ─────────────────────────────────────────────────

async function execListDriverApplications(
  args:     Record<string, unknown>,
  userId:   string,
  userRole: UserType,
): Promise<V3ToolResult> {
  if (userRole !== 'driver') {
    return {
      success:      false,
      data:         null,
      summary:      '',
      errorMessage: 'Only drivers can view their applications.',
    };
  }

  const statusFilter = typeof args['status'] === 'string' ? args['status'] : null;

  try {
    const { supabase } = await import('../../lib/supabase');
    const { data, error } = await supabase.rpc('get_driver_applications', {
      p_driver_id: userId,
      p_status:    statusFilter,
    });

    if (error) {
      return { success: false, data: null, summary: '', errorMessage: `Failed to fetch applications: ${error.message}` };
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    if (rows.length === 0) {
      return { success: true, data: [], summary: 'You have no applications' + (statusFilter ? ` with status "${statusFilter}"` : '') + '.' };
    }

    const lines = rows.map((a) =>
      `• ${String(a['shipment_id'] ?? '').slice(0, 8)}… — ${String(a['status'] ?? '')} | Applied: ${String(a['applied_at'] ?? '').slice(0, 10)}`,
    );

    return {
      success: true,
      data:    rows,
      summary: `You have ${rows.length} application(s):\n${lines.join('\n')}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `Fetch applications failed: ${msg}` };
  }
}

// ─── send_message ─────────────────────────────────────────────────────────────

async function execSendMessage(
  args:   Record<string, unknown>,
  userId: string,
): Promise<V3ToolResult> {
  const shipmentId  = String(args['shipment_id'] ?? '').trim();
  const content     = String(args['content']     ?? '').trim();
  const receiverId  = typeof args['receiver_id'] === 'string' ? args['receiver_id'] : null;

  if (!shipmentId) return { success: false, data: null, summary: '', errorMessage: 'Shipment ID is required to send a message.' };
  if (!content)    return { success: false, data: null, summary: '', errorMessage: 'Message content cannot be empty.' };
  if (content.length > 2000) return { success: false, data: null, summary: '', errorMessage: 'Message is too long (max 2000 characters).' };

  try {
    const { supabase } = await import('../../lib/supabase');
    const { data, error } = await supabase.rpc('send_message_v2', {
      p_shipment_id:  shipmentId,
      p_content:      content,
      p_receiver_id:  receiverId,
      p_message_type: 'text',
    });

    if (error) {
      if (error.message.includes('Access denied')) {
        return { success: false, data: null, summary: '', errorMessage: 'You are not a participant in this shipment conversation.' };
      }
      return { success: false, data: null, summary: '', errorMessage: `Message send failed: ${error.message}` };
    }

    // Attach sender id for context extraction
    const dataWithSender = { ...(typeof data === 'object' && data !== null ? data : {}), sender_id: userId };
    return {
      success: true,
      data:    dataWithSender,
      summary: `Message sent to the conversation for shipment ${shipmentId.slice(0, 8)}….`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `Send message failed: ${msg}` };
  }
}

// ─── get_messages ─────────────────────────────────────────────────────────────

async function execGetMessages(
  args:    Record<string, unknown>,
  _userId: string,
): Promise<V3ToolResult> {
  const shipmentId = String(args['shipment_id'] ?? '').trim();
  const limit      = Math.min(Math.max(Number(args['limit'] ?? 20), 1), 50);

  if (!shipmentId) return { success: false, data: null, summary: '', errorMessage: 'Shipment ID is required to fetch messages.' };

  try {
    const { supabase } = await import('../../lib/supabase');
    const { data, error } = await supabase.rpc('get_conversation_messages', {
      p_shipment_id: shipmentId,
      p_limit:       limit,
      p_offset:      0,
    });

    if (error) {
      if (error.message.includes('Access denied')) {
        return { success: false, data: null, summary: '', errorMessage: 'You do not have access to this shipment\'s conversation.' };
      }
      return { success: false, data: null, summary: '', errorMessage: `Failed to fetch messages: ${error.message}` };
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    if (rows.length === 0) {
      return { success: true, data: [], summary: `No messages yet for shipment ${shipmentId.slice(0, 8)}….` };
    }

    // Format a readable summary of recent messages
    const lines = rows.slice(-5).map((m: Record<string, unknown>) => {
      const sender  = String(m['sender_id'] ?? '').slice(0, 8);
      const content = String(m['content'] ?? '').slice(0, 100);
      const ts      = String(m['created_at'] ?? '').slice(0, 16).replace('T', ' ');
      return `  [${ts}] ${sender}…: ${content}`;
    });

    return {
      success: true,
      data:    rows,
      summary: `Last ${rows.length} message(s) for shipment ${shipmentId.slice(0, 8)}…:\n${lines.join('\n')}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `Get messages failed: ${msg}` };
  }
}

// ─── get_payment_info ─────────────────────────────────────────────────────────

async function execGetPaymentInfo(
  args:     Record<string, unknown>,
  userId:   string,
  userRole: UserType,
): Promise<V3ToolResult> {
  if (userRole !== 'client' && userRole !== 'admin') {
    return {
      success:      false,
      data:         null,
      summary:      '',
      errorMessage: 'Payment information is available to clients and admins only.',
    };
  }

  const shipmentId = String(args['shipment_id'] ?? '').trim();
  if (!shipmentId) return { success: false, data: null, summary: '', errorMessage: 'Shipment ID is required.' };

  try {
    const { supabaseAdmin } = await import('../../lib/supabase');

    let query = supabaseAdmin
      .from('payments')
      .select('id, shipment_id, amount, initial_amount, remaining_amount, status, payment_intent_id, booking_timestamp, refund_deadline')
      .eq('shipment_id', shipmentId);

    // Clients can only see their own payments
    if (userRole === 'client') {
      query = query.eq('client_id', userId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return { success: false, data: null, summary: '', errorMessage: `Failed to fetch payment info: ${error.message}` };
    }

    if (!data) {
      return { success: true, data: null, summary: `No payment record found for shipment ${shipmentId.slice(0, 8)}…. Payment may not have been processed yet.` };
    }

    const totalDollars   = typeof data.amount === 'number' ? (data.amount / 100).toFixed(2) : 'N/A';
    const paidDollars    = typeof data.initial_amount === 'number' ? (data.initial_amount / 100).toFixed(2) : 'N/A';
    const remainDollars  = typeof data.remaining_amount === 'number' ? (data.remaining_amount / 100).toFixed(2) : 'N/A';
    const refundDeadline = data.refund_deadline ? String(data.refund_deadline).slice(0, 16).replace('T', ' ') : 'N/A';

    const summary =
      `Payment for shipment ${shipmentId.slice(0, 8)}…: ` +
      `Status: ${data.status} | Total: $${totalDollars} | ` +
      `Initial (20%) paid: $${paidDollars} | Remaining (80%): $${remainDollars} | ` +
      `Refund deadline: ${refundDeadline} UTC.`;

    return { success: true, data, summary };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `Get payment failed: ${msg}` };
  }
}

// ─── get_profile ──────────────────────────────────────────────────────────────

async function execGetProfile(
  _args:  Record<string, unknown>,
  userId: string,
): Promise<V3ToolResult> {
  try {
    const { supabaseAdmin } = await import('../../lib/supabase');
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, first_name, last_name, phone, role, rating, is_verified, created_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return { success: false, data: null, summary: '', errorMessage: 'Could not retrieve your profile.' };
    }

    const name    = [data.first_name, data.last_name].filter(Boolean).join(' ') || 'Not set';
    const rating  = typeof data.rating === 'number' ? `${data.rating.toFixed(1)}/5` : 'No rating yet';
    const verified = data.is_verified ? 'Verified' : 'Not verified';
    const summary = `Profile: ${name} | ${data.email} | Role: ${data.role} | Phone: ${data.phone ?? 'Not set'} | Rating: ${rating} | ${verified}.`;

    return { success: true, data, summary };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `Get profile failed: ${msg}` };
  }
}

// ─── assign_driver ────────────────────────────────────────────────────────────

async function execAssignDriver(
  args:     Record<string, unknown>,
  _userId:  string,
  userRole: UserType,
): Promise<V3ToolResult> {
  if (userRole !== 'admin') {
    return {
      success:      false,
      data:         null,
      summary:      '',
      errorMessage: 'Only admins can assign drivers to shipments.',
    };
  }

  const shipmentId = String(args['shipment_id'] ?? '').trim();
  const driverId   = String(args['driver_id']   ?? '').trim();

  if (!shipmentId) return { success: false, data: null, summary: '', errorMessage: 'Shipment ID is required.' };
  if (!driverId)   return { success: false, data: null, summary: '', errorMessage: 'Driver ID is required.' };

  try {
    const { supabaseAdmin } = await import('../../lib/supabase');

    const { data, error } = await supabaseAdmin
      .from('shipments')
      .update({
        driver_id:  driverId,
        status:     'assigned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', shipmentId)
      .select('id, status, driver_id, vehicle_make, vehicle_model, pickup_address, delivery_address')
      .single();

    if (error || !data) {
      return { success: false, data: null, summary: '', errorMessage: `Assignment failed: ${error?.message ?? 'Shipment not found'}` };
    }

    const vehicle = [data.vehicle_make, data.vehicle_model].filter(Boolean).join(' ') || 'Vehicle';
    const summary = `Driver ${driverId.slice(0, 8)}… assigned to ${vehicle} shipment ${String(data.id).slice(0, 8)}… (status → assigned).`;

    return { success: true, data, summary };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `Assign driver failed: ${msg}` };
  }
}

// ─── list_users ───────────────────────────────────────────────────────────────

async function execListUsers(
  args:     Record<string, unknown>,
  _userId:  string,
  userRole: UserType,
): Promise<V3ToolResult> {
  if (userRole !== 'admin') {
    return {
      success:      false,
      data:         null,
      summary:      '',
      errorMessage: 'Only admins can list platform users.',
    };
  }

  const roleFilter = typeof args['role'] === 'string' ? args['role'] : undefined;
  const limit      = Math.min(Math.max(Number(args['limit'] ?? 10), 1), 50);

  try {
    const { supabaseAdmin } = await import('../../lib/supabase');

    let query = supabaseAdmin
      .from('profiles')
      .select('id, email, first_name, last_name, phone, role, is_verified, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (roleFilter) {
      query = query.eq('role', roleFilter);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, data: null, summary: '', errorMessage: `Failed to fetch users: ${error.message}` };
    }

    const rows = data ?? [];
    if (rows.length === 0) {
      return { success: true, data: [], summary: `No users found${roleFilter ? ` with role "${roleFilter}"` : ''}.` };
    }

    const lines = rows.map((u: Record<string, unknown>) => {
      const name = [u['first_name'], u['last_name']].filter(Boolean).join(' ') || 'Unnamed';
      return `• ${name} (${String(u['role'])}) — ${String(u['email'])} | ID: ${String(u['id']).slice(0, 8)}… | Verified: ${u['is_verified'] ? 'Yes' : 'No'}`;
    });

    return {
      success: true,
      data:    rows,
      summary: `Found ${rows.length} user(s)${roleFilter ? ` with role "${roleFilter}"` : ''}:\n${lines.join('\n')}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `List users failed: ${msg}` };
  }
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

/**
 * Execute a tool by name with the raw arguments string from OpenAI.
 * Always returns V3ToolResult — never throws.
 *
 * userRole is passed so tools can enforce role-based access server-side.
 */
export async function executeV3Tool(
  toolName: string,
  argsRaw:  string,
  userId:   string,
  userRole: UserType = 'client',
): Promise<V3ToolResult> {
  const args = parseArgs(argsRaw);

  try {
    switch (toolName) {
      // ── V3 tools ───────────────────────────────────────────────────────
      case 'get_shipping_quote':       return await execGetShippingQuote(args);
      case 'parse_shipment_details':   return await execParseShipmentDetails(args, userId);
      case 'create_shipment':          return await execCreateShipment({ ...args, user_id: userId });
      case 'track_shipment':           return await execTrackShipment(args, userId);
      // ── V4 tools ───────────────────────────────────────────────────────
      case 'list_shipments':           return await execListShipments(args, userId, userRole);
      case 'update_shipment_status':   return await execUpdateShipmentStatus(args, userId, userRole);
      case 'apply_for_shipment':       return await execApplyForShipment(args, userId, userRole);
      case 'list_driver_applications': return await execListDriverApplications(args, userId, userRole);
      case 'send_message':             return await execSendMessage(args, userId);
      case 'get_messages':             return await execGetMessages(args, userId);
      case 'get_payment_info':         return await execGetPaymentInfo(args, userId, userRole);
      case 'get_profile':              return await execGetProfile(args, userId);
      case 'assign_driver':            return await execAssignDriver(args, userId, userRole);
      case 'list_users':               return await execListUsers(args, userId, userRole);
      default:
        return { success: false, data: null, summary: '', errorMessage: `Unknown tool: ${toolName}` };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: msg };
  }
}
