/**
 * Benji V4 — Tool adapter layer
 *
 * 21 tools covering the full DriveDrop capability matrix:
 *
 *   V3 (existing): get_shipping_quote, parse_shipment_details, create_shipment, track_shipment
 *   V4 (original): list_shipments, update_shipment_status, apply_for_shipment,
 *                  list_driver_applications, send_message, get_messages,
 *                  get_payment_info, get_profile, assign_driver, list_users, cancel_shipment
 *   Phase 1 (new): get_shipment_detail, get_terms, initiate_payment,
 *                  withdraw_application, process_document, get_driver_info
 *
 * Each tool:
 *   1. Has a JSON Schema definition (sent to OpenAI with every request)
 *   2. Has an execute() handler that runs the real backend service
 *   3. Returns V3ToolResult with a human-readable `summary` the LLM quotes
 *   4. Enforces role-based permissions server-side
 */

import type OpenAI from 'openai';
import NaturalLanguageShipmentService from '../../services/NaturalLanguageShipmentService';
import { pricingService }        from '../../services/pricing.service';
import { googleMapsService }     from '../../services/google-maps.service';
import { estimateDistanceMiles } from './distance.utils';
import type { V3ToolResult, UserType, V3LogisticsContext, WorkflowState } from '../benji.types';
import { notificationEvents }    from '../../lib/notification-events';

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
        'call this tool as soon as you have the route, even if make/model are unknown. ' +
        'Dates affect the price: expedited (delivery within 5 days) costs 25% more; ' +
        'flexible (6+ days) costs 5% less. Pass pickup_date and delivery_date when the user mentions timing.',
      parameters: {
        type: 'object',
        properties: {
          vehicle_make:   { type: 'string', description: 'Vehicle manufacturer, e.g. Honda (optional)' },
          vehicle_model:  { type: 'string', description: 'Vehicle model, e.g. Civic (optional)' },
          vehicle_year:   { type: 'number', description: 'Four-digit model year, e.g. 2020 (optional)' },
          vehicle_type:   {
            type: 'string',
            enum: ['sedan', 'suv', 'pickup', 'luxury', 'motorcycle', 'golfcart', 'heavy'],
            description: 'Vehicle category. Infer from context or default to sedan.',
          },
          origin:         { type: 'string', description: 'Pickup city/state or full address' },
          destination:    { type: 'string', description: 'Delivery city/state or full address' },
          pickup_date:    { type: 'string', description: 'ISO date of pickup e.g. "2026-08-15" (optional). Affects pricing.' },
          delivery_date:  { type: 'string', description: 'ISO date of desired delivery e.g. "2026-08-20" (optional). Affects pricing.' },
          transport_type: {
            type: 'string',
            enum: ['open', 'enclosed'],
            description: 'Transport type. Open is standard (default). Enclosed is for luxury/classic vehicles.',
          },
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
        'ONLY call this after: (1) a quote has been shown, (2) DriveDrop terms have been presented, (3) user explicitly accepts ("yes", "I agree", "book it", "go ahead", "do it", "proceed"). ' +
        'Use vehicle/origin/destination/dates from session context — do NOT ask for details already known. ' +
        'is_operable defaults to true if the user has not said the vehicle is non-operable. ' +
        'vehicle_year is optional — omit it rather than asking. ' +
        'terms_accepted MUST be true — only set it true after user has explicitly agreed to terms. ' +
        'Requires only: vehicle_make, vehicle_model, origin, destination.',
      parameters: {
        type: 'object',
        properties: {
          vehicle_make:    { type: 'string' },
          vehicle_model:   { type: 'string' },
          vehicle_year:    { type: 'number' },
          vehicle_vin:     { type: 'string',  description: 'Optional VIN' },
          vehicle_type:    {
            type: 'string',
            enum: ['sedan', 'suv', 'pickup', 'luxury', 'motorcycle', 'golfcart', 'heavy'],
            description: 'Vehicle category — infer from make/model if not specified',
          },
          origin:          { type: 'string',  description: 'Pickup address or city/state' },
          destination:     { type: 'string',  description: 'Delivery address or city/state' },
          pickup_date:     { type: 'string',  description: 'ISO pickup date e.g. "2026-08-15" (optional)' },
          delivery_date:   { type: 'string',  description: 'ISO desired delivery date e.g. "2026-08-20" (optional)' },
          is_operable:     { type: 'boolean', description: 'Whether the vehicle runs and drives. Default true.' },
          transport_type:  {
            type: 'string',
            enum: ['open', 'enclosed'],
            description: 'Transport type. Default open.',
          },
          estimated_price: { type: 'number',  description: 'Price from a prior get_shipping_quote call' },
          distance_miles:  { type: 'number',  description: 'Distance from a prior get_shipping_quote call' },
          terms_accepted:  { type: 'boolean', description: 'MUST be true — user has explicitly accepted DriveDrop terms.' },
        },
        required: ['vehicle_make', 'vehicle_model', 'origin', 'destination', 'terms_accepted'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'track_shipment',
      description:
        'Look up the current status and details of an existing shipment. ' +
        'ALWAYS call this tool immediately when the user asks where their car/vehicle/shipment is, ' +
        'or asks about status/tracking — even with NO ID provided. ' +
        'Do NOT ask for an ID or vehicle details before calling — call with no arguments and the tool finds the most recent active shipment automatically. ' +
        'Can also find a shipment by UUID or by describing the vehicle/route.',
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
        'Clients see their own shipments. Drivers see their assigned shipments (or use available_loads=true for open jobs). Admins see all shipments. ' +
        'Use this when the user wants to view their shipment history, active shipments, all orders, or — for drivers — available loads to apply for.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'accepted', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'],
            description: 'Filter by status. Omit to return shipments of any status.',
          },
          available_loads: {
            type: 'boolean',
            description:
              'DRIVERS ONLY: When true, returns unassigned pending shipments open for applications. ' +
              'Use when a driver asks to see available loads, open jobs, or new shipments to take on.',
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
        'Call this IMMEDIATELY when a driver says they picked up, delivered, or are in transit — no confirmation needed. ' +
        'Drivers use this to mark pickup, confirm delivery, or update transit status. ' +
        'Admins can set any status. ' +
        'Clients CANNOT update status — only drivers and admins can.',
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
      name: 'cancel_shipment',
      description:
        'Cancel a shipment. ' +
        'THIS TOOL IS AVAILABLE TO ALL ROLES INCLUDING CLIENTS. ' +
        'Clients use cancel_shipment to cancel their own bookings — this is completely separate from update_shipment_status which clients cannot use. ' +
        'Drivers and admins can also cancel shipments. ' +
        'Call this IMMEDIATELY when the user says they want to cancel — no confirmation needed.',
      parameters: {
        type: 'object',
        properties: {
          shipment_id: {
            type: 'string',
            description: 'The UUID of the shipment to cancel.',
          },
          reason: {
            type: 'string',
            description: 'Optional reason for cancellation.',
          },
        },
        required: ['shipment_id'],
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

  // ── Phase 1 tools ─────────────────────────────────────────────────────────

  {
    type: 'function',
    function: {
      name: 'get_shipment_detail',
      description:
        'Get comprehensive details for a specific shipment — vehicle info, route, status timeline, ' +
        'driver profile (if assigned), payment status, and pickup/delivery dates. ' +
        'Use when the user wants full details about a specific shipment rather than just status. ' +
        'Use this for "tell me everything about my shipment", "who is my driver", "when is pickup", etc.',
      parameters: {
        type: 'object',
        properties: {
          shipment_id: {
            type: 'string',
            description: 'The UUID of the shipment. Omit to use the most recent active shipment from session context.',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_terms',
      description:
        'Get the DriveDrop shipping terms and conditions summary. ' +
        'ALWAYS call this before creating a booking when the user has not yet seen or accepted the terms. ' +
        'Present the key points to the user and ask for explicit acceptance before calling create_shipment.',
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
      name: 'initiate_payment',
      description:
        'Create a Stripe payment intent for the 20% deposit on a shipment and return payment instructions. ' +
        'Call this IMMEDIATELY after create_shipment succeeds. ' +
        'The user must complete the 20% deposit to confirm their booking. ' +
        'Returns the amount due, payment instructions, and a payment URL the user should visit.',
      parameters: {
        type: 'object',
        properties: {
          shipment_id: {
            type: 'string',
            description: 'UUID of the shipment to initiate payment for.',
          },
          amount: {
            type: 'number',
            description: 'Total shipment price in USD (the 20% deposit will be calculated).',
          },
        },
        required: ['shipment_id', 'amount'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'withdraw_application',
      description:
        'Withdraw a driver\'s pending application for a shipment. Driver only. ' +
        'Use when a driver wants to cancel, withdraw, or remove their application for a load they applied for.',
      parameters: {
        type: 'object',
        properties: {
          shipment_id: {
            type: 'string',
            description: 'UUID of the shipment whose application to withdraw.',
          },
        },
        required: ['shipment_id'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'process_document',
      description:
        'Extract information from a document or image using AI vision. ' +
        'Use when a user shares an image URL (vehicle photo, title, registration, insurance, BOL, VIN plate, damage photo). ' +
        'Automatically determine document type and extract all useful fields. ' +
        'Examples: extract VIN from VIN plate photo, extract vehicle details from title, identify damage from photo.',
      parameters: {
        type: 'object',
        properties: {
          image_url: {
            type: 'string',
            description: 'A publicly accessible URL to the image or document.',
          },
          document_type: {
            type: 'string',
            enum: ['auto', 'title', 'registration', 'insurance', 'bol', 'vin_plate', 'vehicle_photo', 'damage_photo', 'license', 'invoice'],
            description: 'Hint for document type. Use "auto" to let AI determine it.',
          },
        },
        required: ['image_url'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_driver_info',
      description:
        'Get public profile information for the driver assigned to a shipment. ' +
        'Use when a client or admin asks who their driver is, what their rating is, or wants driver contact info. ' +
        'Returns driver name, rating, phone, and vehicle details.',
      parameters: {
        type: 'object',
        properties: {
          shipment_id: {
            type: 'string',
            description: 'UUID of the shipment to get driver info for.',
          },
        },
        required: ['shipment_id'],
      },
    },
  },

  // ── Sprint 2: Reasoning + Workflow tools ─────────────────────────────────

  {
    type: 'function',
    function: {
      name: 'update_context',
      description:
        'Update the structured conversation context with newly learned information. ' +
        'Call this whenever the user provides vehicle details, locations, dates, or preferences ' +
        'that should be remembered for the current session — even if no other tool is being called. ' +
        'Also use this to advance the workflow state when appropriate. ' +
        'NEVER ask for information that is already in context. ' +
        'After calling this, Benji should acknowledge what it learned and ask the next most useful question.',
      parameters: {
        type: 'object',
        properties: {
          workflowState: {
            type: 'string',
            enum: ['DISCOVERING', 'COLLECTING_INFO', 'QUOTING', 'AWAITING_BOOKING_CONFIRMATION', 'CREATING_DRAFT', 'AWAITING_PAYMENT', 'BOOKED', 'POST_BOOKING_SUPPORT'],
            description: 'Current workflow stage. Only update when the conversation has genuinely moved to a new stage.',
          },
          vehicle_make:  { type: 'string', description: 'Vehicle manufacturer (e.g. Toyota)' },
          vehicle_model: { type: 'string', description: 'Vehicle model (e.g. Camry)' },
          vehicle_year:  { type: 'number', description: 'Model year (e.g. 2022)' },
          vehicle_type:  {
            type: 'string',
            enum: ['sedan', 'suv', 'pickup', 'luxury', 'motorcycle', 'golfcart', 'heavy'],
            description: 'Vehicle category',
          },
          vehicle_vin:   { type: 'string', description: 'VIN if known' },
          pickup_location: { type: 'string', description: 'Pickup city/state or address' },
          pickup_date:     { type: 'string', description: 'ISO pickup date e.g. 2026-08-15' },
          delivery_location: { type: 'string', description: 'Delivery city/state or address' },
          delivery_date:     { type: 'string', description: 'ISO delivery date' },
          transport_type: {
            type: 'string',
            enum: ['open', 'enclosed'],
            description: 'Transport preference',
          },
          is_operable: { type: 'boolean', description: 'Whether the vehicle drives. Defaults to true.' },
          terms_accepted: { type: 'boolean', description: 'Set true when user explicitly accepts T&C.' },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'prepare_booking',
      description:
        'Validate all booking requirements and generate a structured summary for customer confirmation. ' +
        'Call this AFTER the quote has been shown and the user expresses intent to book. ' +
        'This tool validates that all required information is present, identifies any assumptions made, ' +
        'and produces a structured summary that the customer must explicitly confirm. ' +
        'After calling this, present the summary and ask: \'Would you like me to create this booking?\' ' +
        'Only proceed to create_shipment after the customer explicitly confirms.',
      parameters: {
        type: 'object',
        properties: {
          vehicle_make:    { type: 'string', description: 'Vehicle make — must be known before booking' },
          vehicle_model:   { type: 'string', description: 'Vehicle model — must be known before booking' },
          vehicle_year:    { type: 'number', description: 'Year (optional)' },
          vehicle_type:    {
            type: 'string',
            enum: ['sedan', 'suv', 'pickup', 'luxury', 'motorcycle', 'golfcart', 'heavy'],
          },
          origin:          { type: 'string', description: 'Pickup location' },
          destination:     { type: 'string', description: 'Delivery location' },
          pickup_date:     { type: 'string', description: 'ISO pickup date (optional)' },
          delivery_date:   { type: 'string', description: 'ISO delivery date (optional)' },
          transport_type:  { type: 'string', enum: ['open', 'enclosed'] },
          estimated_price: { type: 'number', description: 'Price from get_shipping_quote' },
          distance_miles:  { type: 'number', description: 'Distance from get_shipping_quote' },
          is_operable:     { type: 'boolean', description: 'Vehicle operability. Default true.' },
        },
        required: ['vehicle_make', 'vehicle_model', 'origin', 'destination', 'estimated_price'],
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
  const make         = String(args['vehicle_make']  ?? '');
  const model        = String(args['vehicle_model'] ?? '');
  const origin       = String(args['origin']        ?? '');
  const dest         = String(args['destination']   ?? '');
  const vType        = String(args['vehicle_type']  ?? inferVehicleType(make, model)) as 'sedan' | 'suv' | 'pickup' | 'luxury' | 'motorcycle' | 'golfcart' | 'heavy';
  const pickupDate   = typeof args['pickup_date']   === 'string' ? args['pickup_date']   : undefined;
  const deliveryDate = typeof args['delivery_date'] === 'string' ? args['delivery_date'] : undefined;
  const transportType = typeof args['transport_type'] === 'string' ? args['transport_type'] : 'open';

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

  // Use dynamic pricing config (includes surge, fuel adjustment, delivery type multiplier)
  let total = 0;
  let deliveryType = 'standard';
  let deliveryMultiplier = 1.0;
  try {
    const quoteResult = await pricingService.calculateQuoteWithDynamicConfig({
      vehicleType:  vType,
      distanceMiles,
      pickupDate,
      deliveryDate,
    });
    total              = quoteResult.total;
    deliveryType       = quoteResult.breakdown.deliveryType;
    deliveryMultiplier = quoteResult.breakdown.deliveryTypeMultiplier;
  } catch {
    // Fallback to static pricing
    const fallback = pricingService.calculateQuote({ vehicleType: vType, distanceMiles });
    total = fallback.total;
  }

  // Enclosed transport adds ~30% premium
  if (transportType === 'enclosed') {
    total = Math.round(total * 1.30);
  }

  const data = {
    total, distanceMiles, vehicleType: vType, origin, destination: dest, isEstimate,
    vehicle_make: make, vehicle_model: model, vehicle_year: args['vehicle_year'] ?? null,
    deliveryType, deliveryMultiplier, transportType, pickupDate, deliveryDate,
  };

  const yearLabel    = args['vehicle_year'] ? `${args['vehicle_year']} ` : '';
  const vehicleStr   = make && model ? `${yearLabel}${make} ${model}` : (make || model || `${vType}`);
  const approxNote   = isEstimate ? ' (estimated)' : '';
  const dateNote     = deliveryType !== 'standard'
    ? ` — ${deliveryType === 'expedited' ? 'Expedited (+25%)' : 'Flexible (-5%)'}`
    : '';
  const enclosedNote = transportType === 'enclosed' ? ' | Enclosed transport' : '';
  const summary      = `Estimated shipping cost for a ${vehicleStr} from ${origin} to ${dest}: $${total.toFixed(0)}${approxNote}${dateNote}${enclosedNote} (${Math.round(distanceMiles)} miles).`;

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

async function execCreateShipment(
  args: Record<string, unknown>,
  ctx?: { context: V3LogisticsContext; mergeContext: (patch: Partial<V3LogisticsContext>) => void },
): Promise<V3ToolResult> {
  try {
    // ── Workflow state guard (server-side enforcement) ──────────────────────────
    if (ctx?.context.workflowState === 'AWAITING_PAYMENT') {
      return {
        success:      false,
        data:         { draftShipmentId: ctx.context.draftShipmentId },
        summary:      '',
        errorMessage: `A draft booking already exists (ID: ${ctx.context.draftShipmentId ?? 'unknown'}) and is awaiting payment. To make changes the current draft must be cancelled first. Ask the customer: 'Would you like to cancel the current draft and start over?'`,
      };
    }

    const termsAccepted = args['terms_accepted'] === true;
    if (!termsAccepted) {
      return {
        success:      false,
        data:         null,
        summary:      '',
        errorMessage: 'The user must explicitly accept DriveDrop Terms & Conditions before a booking can be created. Please call get_terms first, present them to the user, and confirm acceptance.',
      };
    }

    // ── Backend validation guard ─────────────────────────────────────────────────
    const missing: string[] = [];
    const make  = String(args['vehicle_make']  ?? '').trim();
    const model = String(args['vehicle_model'] ?? '').trim();
    const origin = String(args['origin'] ?? '').trim();
    const dest   = String(args['destination'] ?? '').trim();
    if (!make)   missing.push('vehicle make');
    if (!model)  missing.push('vehicle model');
    if (!origin) missing.push('pickup location');
    if (!dest)   missing.push('delivery location');
    if (missing.length > 0) {
      return {
        success:       false,
        data:          null,
        summary:       '',
        errorMessage:  `Cannot create shipment — missing required information: ${missing.join(', ')}.`,
        missingFields: missing,
      };
    }

    // ── Duplicate booking protection ─────────────────────────────────────────────
    const userId = String(args['user_id'] ?? '');
    try {
      const { supabaseAdmin } = await import('../../lib/supabase');
      const { data: existingDraft } = await supabaseAdmin
        .from('shipments')
        .select('id, status, payment_intent_id, draft_expires_at')
        .eq('client_id', userId)
        .eq('status', 'draft')
        .ilike('vehicle_make', make)
        .ilike('vehicle_model', model)
        .ilike('pickup_address', `%${origin.split(',')[0]?.trim() ?? origin}%`)
        .ilike('delivery_address', `%${dest.split(',')[0]?.trim() ?? dest}%`)
        .gt('draft_expires_at', new Date().toISOString())
        .maybeSingle();

      if (existingDraft) {
        // Update context to reflect the existing draft
        ctx?.mergeContext({
          draftShipmentId:       String(existingDraft.id),
          workflowState:         'AWAITING_PAYMENT',
          ...(typeof existingDraft?.payment_intent_id === 'string'
            ? { activePaymentIntentId: existingDraft.payment_intent_id as string }
            : {}),
        });
        return {
          success: true,
          data:    { shipment_id: existingDraft.id, reused: true },
          summary: `An existing draft booking for your ${make} ${model} from ${origin} to ${dest} was found (ID: ${String(existingDraft.id).slice(0, 8)}…). Reusing it instead of creating a duplicate. Proceed directly to initiate_payment with the existing shipment ID and amount.`,
        };
      }
    } catch {
      // Non-fatal — proceed with creation if duplicate check fails
    }

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
      Object.fromEntries(Object.entries({
        pickup_date:    typeof args['pickup_date']    === 'string' ? args['pickup_date']    : undefined,
        delivery_date:  typeof args['delivery_date']  === 'string' ? args['delivery_date']  : undefined,
        is_operable:    args['is_operable'] !== false,
        vehicle_type:   typeof args['vehicle_type']   === 'string' ? args['vehicle_type']   : undefined,
        transport_type: (args['transport_type'] === 'enclosed' ? 'enclosed' : 'open') as 'open' | 'enclosed',
        terms_accepted: true as boolean,
        payment_status: 'pending',
        // Create as draft — only becomes active after Stripe payment confirmation
        status: 'draft',
        draft_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      }).filter(([, v]) => v !== undefined)),
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

    ctx?.mergeContext({
      draftShipmentId:   shipmentId,
      workflowState:     'AWAITING_PAYMENT',
    });

    // Emit event so SMS notification listener fires automatically
    notificationEvents.emit('shipment.created', {
      shipmentId,
      clientId: String(args['user_id'] ?? ''),
    });

    return {
      success: true,
      data:    result,
      summary: `Draft booking created! Shipment ID: ${shipmentId}. Proceed to initiate_payment to generate the payment link and complete the booking.`,
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
  const statusFilter   = typeof args['status'] === 'string' ? args['status'] : undefined;
  const availableLoads = args['available_loads'] === true;
  const limit          = Math.min(Math.max(Number(args['limit'] ?? 5), 1), 20);

  try {
    const { supabaseAdmin } = await import('../../lib/supabase');

    let query = supabaseAdmin
      .from('shipments')
      .select('id, status, vehicle_make, vehicle_model, vehicle_year, vehicle_type, pickup_address, delivery_address, estimated_price, created_at, driver_id, client_id')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Role-based access: clients see their own, drivers see assigned OR available, admins see all
    if (userRole === 'client') {
      query = query.eq('client_id', userId);
    } else if (userRole === 'driver') {
      if (availableLoads) {
        // Show unassigned pending shipments the driver can apply for
        query = query.is('driver_id', null).eq('status', 'pending');
      } else {
        // Show shipments this driver is assigned to
        query = query.eq('driver_id', userId);
      }
    }
    // admin / broker — no additional filter

    // Only apply status filter when not in available_loads mode (which forces status=pending)
    if (statusFilter && !availableLoads) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, data: null, summary: '', errorMessage: `Failed to fetch shipments: ${error.message}` };
    }

    const rows = data ?? [];
    if (rows.length === 0) {
      const filterDesc = availableLoads
        ? ' available for applications right now'
        : statusFilter ? ` with status "${statusFilter}"` : '';
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

    const label = availableLoads ? 'available load(s)' : 'shipment(s)';
    return {
      success: true,
      data:    rows,
      summary: `Found ${rows.length} ${label}:\n${lines.join('\n')}`,
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

    // Emit event so SMS notification listener fires automatically
    if (newStatus === 'delivered') {
      notificationEvents.emit('delivered', {
        shipmentId:  String(data.id),
        clientId:    '',
        deliveredAt: new Date().toISOString(),
      });
    } else {
      notificationEvents.emit('status.updated', {
        shipmentId: String(data.id),
        newStatus,
        clientId:   '',
      });
    }

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
      data:    { result: data, shipment_id: shipmentId },
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

// ─── cancel_shipment ──────────────────────────────────────────────────────────

async function execCancelShipment(
  args:     Record<string, unknown>,
  userId:   string,
  userRole: UserType,
): Promise<V3ToolResult> {
  const shipmentId = String(args['shipment_id'] ?? '').trim();
  if (!shipmentId) return { success: false, data: null, summary: '', errorMessage: 'Shipment ID is required to cancel.' };

  try {
    const { supabaseAdmin } = await import('../../lib/supabase');

    // Fetch shipment for permission + state validation
    const { data: ship, error: fetchError } = await supabaseAdmin
      .from('shipments')
      .select('id, status, client_id, driver_id, vehicle_make, vehicle_model')
      .eq('id', shipmentId)
      .maybeSingle();

    if (fetchError || !ship) {
      return { success: false, data: null, summary: '', errorMessage: `Shipment ${shipmentId.slice(0, 8)}… not found.` };
    }

    // Permission check
    if (userRole === 'client' && ship.client_id !== userId) {
      return { success: false, data: null, summary: '', errorMessage: 'You can only cancel your own shipments.' };
    }
    if (userRole === 'driver' && ship.driver_id !== userId) {
      return { success: false, data: null, summary: '', errorMessage: 'You can only cancel shipments assigned to you.' };
    }

    // State guard — can't cancel terminal states
    if (ship.status === 'delivered') {
      return { success: false, data: null, summary: '', errorMessage: 'Cannot cancel a shipment that has already been delivered.' };
    }
    if (ship.status === 'cancelled') {
      return { success: false, data: null, summary: '', errorMessage: 'This shipment is already cancelled.' };
    }

    const { data, error } = await supabaseAdmin
      .from('shipments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', shipmentId)
      .select('id, status, vehicle_make, vehicle_model, estimated_price, created_at')
      .single();

    if (error || !data) {
      return { success: false, data: null, summary: '', errorMessage: `Cancellation failed: ${error?.message ?? 'Unknown error'}.` };
    }

    // Determine refund eligibility based on DriveDrop cancellation policy
    const vehicle = [data.vehicle_make, data.vehicle_model].filter(Boolean).join(' ') || 'Vehicle';
    let refundNote = '';
    const createdAt = data.created_at ? new Date(data.created_at).getTime() : 0;
    const nowMs = Date.now();
    const hoursSinceBooking = (nowMs - createdAt) / (1000 * 60 * 60);

    if (ship.status === 'pending' || ship.status === 'accepted') {
      if (hoursSinceBooking < 48) {
        refundNote = ' Full refund (minus 10% processing fee) will be issued within 3-5 business days.';
      } else {
        refundNote = ' 50% refund will be issued within 3-5 business days (cancellation >48h before pickup).';
      }
    } else {
      refundNote = ' No refund applies at this shipment stage.';
    }

    return {
      success: true,
      data,
      summary: `Shipment ${String(data.id).slice(0, 8)}… (${vehicle}) has been cancelled.${refundNote}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `Cancel shipment failed: ${msg}` };
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

    // Emit event so SMS notification listener fires automatically
    notificationEvents.emit('driver.assigned', {
      shipmentId: String(data.id),
      clientId:   '', // listener will look up client from DB via shipment
      driverId,
    });

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

// ─── Phase 1 executors ────────────────────────────────────────────────────────

// ─── get_shipment_detail ──────────────────────────────────────────────────────

async function execGetShipmentDetail(
  args:     Record<string, unknown>,
  userId:   string,
  userRole: UserType,
): Promise<V3ToolResult> {
  const shipmentId = String(args['shipment_id'] ?? '').trim();

  try {
    const { supabaseAdmin } = await import('../../lib/supabase');

    const SELECT =
      'id, status, vehicle_make, vehicle_model, vehicle_year, vehicle_type, is_operable, ' +
      'pickup_address, delivery_address, pickup_date, delivery_date, estimated_price, distance, ' +
      'created_at, updated_at, driver_id, client_id, terms_accepted, payment_status, ' +
      'picked_up_at, delivered_at, accepted_at, payment_intent_id';

    let query = supabaseAdmin.from('shipments').select(SELECT);

    if (shipmentId) {
      query = query.eq('id', shipmentId) as typeof query;
    } else {
      // Use most recent active shipment for this user
      query = query
        .or(`client_id.eq.${userId},driver_id.eq.${userId}`)
        .not('status', 'in', '("delivered","cancelled")')
        .order('created_at', { ascending: false })
        .limit(1) as typeof query;
    }

    const { data: shipment, error } = await (shipmentId
      ? (query as any).maybeSingle()
      : (query as any).maybeSingle());

    if (error || !shipment) {
      return { success: false, data: null, summary: '', errorMessage: `Shipment not found.` };
    }

    // Permission check for non-admins
    if (userRole !== 'admin') {
      if (shipment.client_id !== userId && shipment.driver_id !== userId) {
        return { success: false, data: null, summary: '', errorMessage: 'You do not have access to this shipment.' };
      }
    }

    // Fetch driver profile if assigned
    let driverProfile: Record<string, unknown> | null = null;
    if (shipment.driver_id) {
      const { data: dp } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, phone, rating, is_verified')
        .eq('id', shipment.driver_id)
        .maybeSingle();
      driverProfile = dp as Record<string, unknown> | null;
    }

    // Fetch payment record
    let paymentRecord: Record<string, unknown> | null = null;
    const { data: pr } = await supabaseAdmin
      .from('payments')
      .select('id, amount, initial_amount, remaining_amount, status, refund_deadline, payment_intent_id')
      .eq('shipment_id', shipment.id)
      .maybeSingle();
    paymentRecord = pr as Record<string, unknown> | null;

    const vehicle    = [shipment.vehicle_year, shipment.vehicle_make, shipment.vehicle_model].filter(Boolean).join(' ') || 'Vehicle';
    const price      = typeof shipment.estimated_price === 'number' ? `$${shipment.estimated_price.toFixed(0)}` : 'N/A';
    const driverStr  = driverProfile
      ? `${driverProfile['first_name']} ${driverProfile['last_name']} (rating: ${typeof driverProfile['rating'] === 'number' ? driverProfile['rating'].toFixed(1) : 'N/A'})`
      : 'Not yet assigned';
    const pickupDate  = shipment.pickup_date   ? String(shipment.pickup_date).slice(0, 10) : 'Not set';
    const delivDate   = shipment.delivery_date  ? String(shipment.delivery_date).slice(0, 10) : 'Not set';
    const paymentStr  = paymentRecord
      ? `Status: ${paymentRecord['status']} | Total: $${typeof paymentRecord['amount'] === 'number' ? (paymentRecord['amount'] as number / 100).toFixed(2) : 'N/A'}`
      : (shipment.payment_status ? `Status: ${shipment.payment_status}` : 'No payment record');

    const summary =
      `Shipment ${String(shipment.id).slice(0, 8)}…\n` +
      `  Vehicle: ${vehicle}\n` +
      `  Route: ${shipment.pickup_address} → ${shipment.delivery_address}\n` +
      `  Status: ${shipment.status} | Price: ${price}\n` +
      `  Pickup date: ${pickupDate} | Delivery date: ${delivDate}\n` +
      `  Driver: ${driverStr}\n` +
      `  Payment: ${paymentStr}`;

    return {
      success: true,
      data:    { shipment, driverProfile, paymentRecord },
      summary,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `Get shipment detail failed: ${msg}` };
  }
}

// ─── get_terms ────────────────────────────────────────────────────────────────

function execGetTerms(): V3ToolResult {
  const terms = `DriveDrop Shipping Terms & Conditions — Key Points

PAYMENT
• A 20% deposit is required at booking to confirm service.
• The remaining 80% is charged upon successful delivery.
• Payment is processed securely through Stripe (PCI-DSS compliant).
• DriveDrop does not store full card numbers or CVV codes.

CANCELLATION POLICY
• 48+ hours before pickup: full refund minus 10% processing fee.
• 24–48 hours before pickup: 50% refund.
• Less than 24 hours before pickup: no refund.
• If driver cancels: full refund to client.

PRICING
• Standard rate based on distance, vehicle type, and shipping speed.
• Expedited shipping: +25% surcharge.
• Flexible timing: -5% discount.
• Enclosed transport: +30% surcharge.

LIABILITY & INSURANCE
• DriveDrop carries cargo insurance covering up to $100,000 per vehicle.
• Any damage must be reported within 24 hours of delivery.
• Document vehicle condition with photos at pickup and delivery.

VEHICLE REQUIREMENTS
• Provide accurate condition description.
• Remove all personal belongings from vehicle.
• Ensure vehicle is accessible for loading.

DRIVER TERMS
• Drivers are independent contractors, not employees of DriveDrop.
• Drivers receive 80% of the shipment fee; DriveDrop retains 20% platform fee.

SMS NOTIFICATIONS
• By booking, you consent to receive transactional SMS updates about your shipment.
• Reply STOP to opt out; reply HELP for support.
• Standard message and data rates may apply.

BENJI AI ASSISTANT
• Quotes and bookings accepted through Benji are legally binding once payment is confirmed.
• Benji may make mistakes — always verify critical details before confirming.

By confirming a booking with Benji or via the platform, you agree to be bound by DriveDrop's full Terms of Service.
Full terms: https://drivedrop.us.com/terms | Privacy Policy: https://drivedrop.us.com/privacy`;

  return {
    success: true,
    data:    { terms },
    summary: terms,
  };
}

// ─── initiate_payment ─────────────────────────────────────────────────────────

async function execInitiatePayment(
  args:     Record<string, unknown>,
  userId:   string,
  userRole: UserType,
): Promise<V3ToolResult> {
  if (userRole !== 'client' && userRole !== 'admin') {
    return { success: false, data: null, summary: '', errorMessage: 'Payment initiation is for clients only.' };
  }

  const shipmentId = String(args['shipment_id'] ?? '').trim();
  const totalAmount = typeof args['amount'] === 'number' ? args['amount'] : 0;

  if (!shipmentId) return { success: false, data: null, summary: '', errorMessage: 'Shipment ID is required.' };
  if (totalAmount <= 0) return { success: false, data: null, summary: '', errorMessage: 'Valid amount is required.' };

  const depositAmount      = Math.round(totalAmount * 0.20);
  const depositAmountCents = Math.round(depositAmount * 100);
  const remainingAmount    = Math.round(totalAmount * 0.80);

  try {
    const { stripeService } = await import('../../services/stripe.service');
    const { supabaseAdmin } = await import('../../lib/supabase');

    // ── Idempotency: check if a valid unpaid payment intent already exists ──────────
    const { data: existingShipment } = await supabaseAdmin
      .from('shipments')
      .select('payment_intent_id, payment_status')
      .eq('id', shipmentId)
      .maybeSingle();

    if (existingShipment?.payment_intent_id) {
      try {
        const existingPI = await stripeService.getPaymentIntent(existingShipment.payment_intent_id);
        // Reuse if still awaiting payment (not succeeded, canceled, or expired)
        if (['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'requires_capture'].includes(existingPI.status)) {
          const frontendUrl = process.env['FRONTEND_URL'] ?? 'https://drivedrop.us.com';
          const paymentUrl  = `${frontendUrl}/dashboard/client/new-shipment/completion?shipmentId=${shipmentId}&mode=payment`;
          return {
            success: true,
            data: {
              shipment_id:       shipmentId,
              payment_intent_id: existingPI.id,
              deposit_amount:    depositAmount,
              total_amount:      totalAmount,
              remaining_amount:  remainingAmount,
              payment_url:       paymentUrl,
              reused:            true,
            },
            summary:
              `Existing payment session found for shipment ${shipmentId.slice(0, 8)}…\n` +
              `  20% deposit due: $${depositAmount.toFixed(2)}\n` +
              `  Complete payment at: ${paymentUrl}`,
          };
        }
        // PI is in a terminal state — fall through to create a new one
      } catch {
        // PI not retrievable — create a fresh one
      }
    }
    const paymentIntent = await stripeService.createPaymentIntent({
      amount:      depositAmountCents,
      currency:    'usd',
      clientId:    userId,
      shipmentId,
      description: `DriveDrop 20% deposit — shipment ${shipmentId.slice(0, 8)}`,
      metadata: {
        shipment_id:       shipmentId,
        client_id:         userId,
        isInitialPayment:  'true',
        totalAmountCents:  String(Math.round(totalAmount * 100)),
        remainingCents:    String(Math.round(remainingAmount * 100)),
      },
    });

    // Create payment record in DB
    const refundDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from('payments')
      .upsert({
        shipment_id:       shipmentId,
        client_id:         userId,
        amount:            Math.round(totalAmount * 100),
        initial_amount:    depositAmountCents,
        remaining_amount:  Math.round(remainingAmount * 100),
        payment_intent_id: paymentIntent.id,
        status:            'pending',
        booking_timestamp: new Date().toISOString(),
        refund_deadline:   refundDeadline,
      }, { onConflict: 'shipment_id' });

    // Update shipment payment status
    await supabaseAdmin
      .from('shipments')
      .update({ payment_status: 'initiated', payment_intent_id: paymentIntent.id })
      .eq('id', shipmentId);

    const frontendUrl = process.env['FRONTEND_URL'] ?? 'https://drivedrop.us.com';
    const paymentUrl  = `${frontendUrl}/dashboard/client/new-shipment/completion?shipmentId=${shipmentId}&mode=payment`;

    return {
      success: true,
      data:    {
        shipment_id:       shipmentId,
        payment_intent_id: paymentIntent.id,
        deposit_amount:    depositAmount,
        total_amount:      totalAmount,
        remaining_amount:  remainingAmount,
        payment_url:       paymentUrl,
      },
      summary:
        `Payment initiated for shipment ${shipmentId.slice(0, 8)}…\n` +
        `  20% deposit due now: $${depositAmount.toFixed(2)}\n` +
        `  Remaining 80% (charged on delivery): $${remainingAmount.toFixed(2)}\n` +
        `  Complete payment at: ${paymentUrl}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `Payment initiation failed: ${msg}` };
  }
}

// ─── withdraw_application ─────────────────────────────────────────────────────

async function execWithdrawApplication(
  args:     Record<string, unknown>,
  userId:   string,
  userRole: UserType,
): Promise<V3ToolResult> {
  if (userRole !== 'driver') {
    return { success: false, data: null, summary: '', errorMessage: 'Only drivers can withdraw applications.' };
  }

  const shipmentId = String(args['shipment_id'] ?? '').trim();
  if (!shipmentId) return { success: false, data: null, summary: '', errorMessage: 'Shipment ID is required.' };

  try {
    const { supabaseAdmin } = await import('../../lib/supabase');

    // Update application status to 'cancelled' for this driver + shipment pair
    const { data, error } = await supabaseAdmin
      .from('driver_applications')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('shipment_id', shipmentId)
      .eq('driver_id', userId)
      .eq('status', 'pending')
      .select('id, shipment_id, status')
      .maybeSingle();

    if (error) {
      return { success: false, data: null, summary: '', errorMessage: `Withdrawal failed: ${error.message}` };
    }

    if (!data) {
      return { success: false, data: null, summary: '', errorMessage: `No pending application found for shipment ${shipmentId.slice(0, 8)}…` };
    }

    return {
      success: true,
      data,
      summary: `Application for shipment ${shipmentId.slice(0, 8)}… has been withdrawn.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `Withdraw application failed: ${msg}` };
  }
}

// ─── process_document ────────────────────────────────────────────────────────

async function execProcessDocument(
  args:   Record<string, unknown>,
  _userId: string,
): Promise<V3ToolResult> {
  const imageUrl     = String(args['image_url']      ?? '').trim();
  const docTypeHint  = String(args['document_type']  ?? 'auto').trim();

  if (!imageUrl) {
    return { success: false, data: null, summary: '', errorMessage: 'An image URL is required for document processing.' };
  }

  // Validate URL format (basic check to prevent SSRF)
  try {
    const parsed = new URL(imageUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { success: false, data: null, summary: '', errorMessage: 'Image URL must use http or https.' };
    }
  } catch {
    return { success: false, data: null, summary: '', errorMessage: 'Invalid image URL.' };
  }

  try {
    const { openaiClient } = await import('@benji/ai/client/openai.client');

    const typeGuidance: Record<string, string> = {
      title:        'Extract: owner name, VIN, year, make, model, lienholder if any.',
      registration: 'Extract: owner name, VIN, plate number, year, make, model, expiry date.',
      insurance:    'Extract: policy number, insurer, insured name, coverage dates, vehicle info.',
      bol:          'Extract: BOL number, shipper, consignee, origin, destination, vehicle info, condition notes.',
      vin_plate:    'Extract: the full 17-character VIN. Spell it out character by character.',
      vehicle_photo: 'Describe vehicle: make, model, color, overall condition, any visible damage.',
      damage_photo: 'Describe damage: location on vehicle, severity, type (scratch/dent/crack/etc.), estimated severity (minor/moderate/severe).',
      license:      'Extract: name, license number, state, expiry date.',
      invoice:      'Extract: invoice number, date, items, amounts, total, payment status.',
      auto:         'Determine document type and extract all relevant fields.',
    };

    const guidance = typeGuidance[docTypeHint] ?? typeGuidance['auto'];

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a document extraction specialist for DriveDrop vehicle transport. ' +
            'Extract structured information from the provided image. ' +
            'Return a JSON object with all extracted fields plus a "document_type" field and a "confidence" field (0-1). ' +
            'If a field is unclear, include it with a note. If you cannot read something, say so.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract information from this document. ${guidance} Return as JSON.`,
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl, detail: 'high' },
            },
          ],
        },
      ],
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    });

    const rawContent = response.choices[0]?.message?.content ?? '{}';
    let extracted: Record<string, unknown> = {};
    try {
      extracted = JSON.parse(rawContent);
    } catch {
      extracted = { raw: rawContent };
    }

    const docType  = String(extracted['document_type'] ?? docTypeHint);
    const confidence = typeof extracted['confidence'] === 'number' ? extracted['confidence'] : null;
    const confStr  = confidence !== null ? ` (confidence: ${(confidence * 100).toFixed(0)}%)` : '';

    // Build a readable summary of extracted fields
    const skip = new Set(['document_type', 'confidence', 'raw']);
    const lines = Object.entries(extracted)
      .filter(([k]) => !skip.has(k))
      .map(([k, v]) => `  ${k}: ${String(v)}`);

    const summary =
      `Document type: ${docType}${confStr}\n` +
      (lines.length > 0 ? lines.join('\n') : '  No structured data extracted.');

    return { success: true, data: extracted, summary };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `Document processing failed: ${msg}` };
  }
}

// ─── get_driver_info ─────────────────────────────────────────────────────────

async function execGetDriverInfo(
  args:     Record<string, unknown>,
  _userId:  string,
  userRole: UserType,
): Promise<V3ToolResult> {
  if (userRole !== 'client' && userRole !== 'admin') {
    return { success: false, data: null, summary: '', errorMessage: 'Driver info is available to clients and admins.' };
  }

  const shipmentId = String(args['shipment_id'] ?? '').trim();
  if (!shipmentId) return { success: false, data: null, summary: '', errorMessage: 'Shipment ID is required.' };

  try {
    const { supabaseAdmin } = await import('../../lib/supabase');

    const { data: shipment, error: se } = await supabaseAdmin
      .from('shipments')
      .select('driver_id, vehicle_make, vehicle_model, status')
      .eq('id', shipmentId)
      .maybeSingle();

    if (se || !shipment) {
      return { success: false, data: null, summary: '', errorMessage: `Shipment ${shipmentId.slice(0, 8)}… not found.` };
    }

    if (!shipment.driver_id) {
      return {
        success: true,
        data:    { assigned: false },
        summary: `No driver has been assigned to shipment ${shipmentId.slice(0, 8)}… yet. Status: ${shipment.status}.`,
      };
    }

    const { data: driver } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, phone, rating, is_verified, created_at')
      .eq('id', shipment.driver_id)
      .maybeSingle();

    if (!driver) {
      return { success: false, data: null, summary: '', errorMessage: 'Driver profile not found.' };
    }

    const name     = [driver.first_name, driver.last_name].filter(Boolean).join(' ') || 'Driver';
    const rating   = typeof driver.rating === 'number' ? `${driver.rating.toFixed(1)}/5` : 'No rating yet';
    const verified = driver.is_verified ? 'Verified ✓' : 'Pending verification';
    const summary  =
      `Driver assigned to shipment ${shipmentId.slice(0, 8)}…\n` +
      `  Name: ${name}\n` +
      `  Phone: ${driver.phone ?? 'Not available'}\n` +
      `  Rating: ${rating} | ${verified}`;

    return { success: true, data: driver, summary };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: `Get driver info failed: ${msg}` };
  }
}

// ─── Sprint 2 executors ───────────────────────────────────────────────────────────

/**
 * update_context — merges partial context into the session via the ctx callback.
 * This is handled specially in benji.service.ts which passes mergeContext.
 */
export function execUpdateContext(
  args:         Record<string, unknown>,
  mergeContext: (patch: Partial<V3LogisticsContext>) => void,
): V3ToolResult {
  const patch: Partial<V3LogisticsContext> = {};

  if (typeof args['workflowState'] === 'string') {
    patch.workflowState = args['workflowState'] as WorkflowState;
  }
  if (typeof args['vehicle_make'] === 'string' || typeof args['vehicle_model'] === 'string' || typeof args['vehicle_year'] === 'number') {
    patch.vehicle = {
      ...(typeof args['vehicle_make']  === 'string' ? { make:  args['vehicle_make']  as string } : {}),
      ...(typeof args['vehicle_model'] === 'string' ? { model: args['vehicle_model'] as string } : {}),
      ...(typeof args['vehicle_year']  === 'number' ? { year:  args['vehicle_year']  as number } : {}),
      ...(typeof args['vehicle_type']  === 'string' ? { type:  args['vehicle_type']  as string } : {}),
      ...(typeof args['vehicle_vin']   === 'string' ? { vin:   args['vehicle_vin']   as string } : {}),
    };
  }
  if (typeof args['pickup_location'] === 'string' || typeof args['pickup_date'] === 'string') {
    patch.pickup = {
      ...(typeof args['pickup_location'] === 'string' ? { location: args['pickup_location'] as string } : {}),
      ...(typeof args['pickup_date']     === 'string' ? { date:     args['pickup_date']     as string } : {}),
    };
  }
  if (typeof args['delivery_location'] === 'string' || typeof args['delivery_date'] === 'string') {
    patch.delivery = {
      ...(typeof args['delivery_location'] === 'string' ? { location: args['delivery_location'] as string } : {}),
      ...(typeof args['delivery_date']     === 'string' ? { date:     args['delivery_date']     as string } : {}),
    };
  }
  if (typeof args['transport_type'] === 'string')  patch.transportType = args['transport_type'] as 'open' | 'enclosed';
  if (typeof args['is_operable']   === 'boolean')  patch.isOperable    = args['is_operable']   as boolean;
  if (typeof args['terms_accepted'] === 'boolean') patch.termsAccepted = args['terms_accepted'] as boolean;

  mergeContext(patch);

  const updated = Object.keys(patch)
    .filter(k => k !== 'workflowState')
    .map(k => k.replace(/_/g, ' '))
    .join(', ');
  const stateNote = patch.workflowState ? ` Workflow advanced to ${patch.workflowState}.` : '';

  return {
    success: true,
    data:    patch,
    summary: `Context updated${updated ? ': ' + updated : ''}.${stateNote}`,
  };
}

/**
 * prepare_booking — validates all required fields and builds a structured booking summary.
 * Sets workflowState to AWAITING_BOOKING_CONFIRMATION.
 */
export function execPrepareBooking(
  args:         Record<string, unknown>,
  mergeContext: (patch: Partial<V3LogisticsContext>) => void,
  context?:     V3LogisticsContext,
): V3ToolResult {
  // ── Workflow state guard ──────────────────────────────────────────────────────
  if (context?.workflowState === 'AWAITING_PAYMENT') {
    return {
      success:      false,
      data:         { draftShipmentId: context.draftShipmentId },
      summary:      '',
      errorMessage: `A draft booking is already awaiting payment (ID: ${context.draftShipmentId ?? 'unknown'}). Cannot prepare a new booking until the existing draft is resolved. Ask the customer if they want to cancel the current draft.`,
    };
  }
  const make          = String(args['vehicle_make']    ?? '').trim();
  const model         = String(args['vehicle_model']   ?? '').trim();
  const origin        = String(args['origin']          ?? '').trim();
  const destination   = String(args['destination']     ?? '').trim();
  const estimatedPrice = typeof args['estimated_price'] === 'number' ? args['estimated_price'] : 0;

  // ── Backend validation guard ──────────────────────────────────────────────────
  const missing: string[] = [];
  if (!make)           missing.push('vehicle make (e.g. Toyota)');
  if (!model)          missing.push('vehicle model (e.g. Camry)');
  if (!origin)         missing.push('pickup location');
  if (!destination)    missing.push('delivery location');
  if (estimatedPrice <= 0) missing.push('estimated price (call get_shipping_quote first)');

  if (missing.length > 0) {
    return {
      success:       false,
      data:          null,
      summary:       '',
      errorMessage:  `Cannot prepare booking summary — missing required information.`,
      missingFields: missing,
    };
  }

  const year          = typeof args['vehicle_year']   === 'number' ? args['vehicle_year']   : null;
  const vehicleType   = String(args['vehicle_type']   ?? inferVehicleType(make, model));
  const transportType = String(args['transport_type'] ?? 'open');
  const isOperable    = args['is_operable'] !== false;
  const pickupDate    = typeof args['pickup_date']    === 'string' ? args['pickup_date']    : null;
  const deliveryDate  = typeof args['delivery_date']  === 'string' ? args['delivery_date']  : null;
  const distanceMiles = typeof args['distance_miles'] === 'number' ? args['distance_miles'] : null;
  const depositAmount = Math.round(estimatedPrice * 0.20);

  // Build assumptions list (things Benji inferred, not explicitly provided)
  const assumptions: string[] = [];
  if (!args['vehicle_type'])   assumptions.push(`Vehicle type assumed to be ${vehicleType} (inferred from make/model)`);
  if (!args['transport_type']) assumptions.push('Open transport assumed (standard)');
  if (isOperable && !Object.prototype.hasOwnProperty.call(args, 'is_operable')) {
    assumptions.push('Vehicle assumed to be operable');
  }

  const vehicleLabel = [year, make, model].filter(Boolean).join(' ');
  const distNote     = distanceMiles ? ` (${Math.round(distanceMiles)} miles)` : '';
  const transportNote = transportType === 'enclosed' ? 'Enclosed transport' : 'Open transport (standard)';
  const pickupNote   = pickupDate   ? `  Pickup date: ${pickupDate}\n` : '';
  const delivNote    = deliveryDate ? `  Delivery date: ${deliveryDate}\n` : '';

  const summary =
    `📋 Booking Summary\n` +
    `  Vehicle: ${vehicleLabel}\n` +
    `  Pickup: ${origin}\n` +
    `  Delivery: ${destination}${distNote}\n` +
    `${pickupNote}` +
    `${delivNote}` +
    `  Transport: ${transportNote}\n` +
    `  Estimated price: $${estimatedPrice.toFixed(2)}\n` +
    `  Deposit required now (20%): $${depositAmount.toFixed(2)}\n` +
    `  Remaining on delivery (80%): $${(estimatedPrice - depositAmount).toFixed(2)}\n` +
    (assumptions.length > 0 ? `  Assumptions: ${assumptions.join('; ')}\n` : '') +
    `\nWould you like me to create this booking?`;

  // Advance workflow state to awaiting confirmation
  mergeContext({ workflowState: 'AWAITING_BOOKING_CONFIRMATION' });

  return {
    success: true,
    data: {
      vehicle_make: make, vehicle_model: model, vehicle_year: year, vehicle_type: vehicleType,
      origin, destination, pickup_date: pickupDate, delivery_date: deliveryDate,
      transport_type: transportType, is_operable: isOperable,
      estimated_price: estimatedPrice, deposit_amount: depositAmount,
      distance_miles: distanceMiles, assumptions,
    },
    summary,
  };
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

/**
 * Execute a tool by name with the raw arguments string from OpenAI.
 * Always returns V3ToolResult — never throws.
 *
 * userRole is passed so tools can enforce role-based access server-side.
 * ctx is passed for stateful operations (update_context, prepare_booking) and
 * backend validation guards on critical tools.
 */
export async function executeV3Tool(
  toolName: string,
  argsRaw:  string,
  userId:   string,
  userRole: UserType = 'client',
  ctx?: {
    context:      V3LogisticsContext;
    mergeContext: (patch: Partial<V3LogisticsContext>) => void;
  },
): Promise<V3ToolResult> {
  const args = parseArgs(argsRaw);

  try {
    switch (toolName) {
      // ── Sprint 2: Reasoning + Workflow tools ─────────────────────────
      case 'update_context': {
        if (!ctx) return { success: false, data: null, summary: '', errorMessage: 'Context not available for update_context.' };
        return execUpdateContext(args, ctx.mergeContext);
      }
      case 'prepare_booking': {
        if (!ctx) return { success: false, data: null, summary: '', errorMessage: 'Context not available for prepare_booking.' };
        return execPrepareBooking(args, ctx.mergeContext, ctx.context);
      }
      // ── V3 tools ───────────────────────────────────────────────────────
      case 'get_shipping_quote':       return await execGetShippingQuote(args);
      case 'parse_shipment_details':   return await execParseShipmentDetails(args, userId);
      case 'create_shipment':          return await execCreateShipment({ ...args, user_id: userId }, ctx);
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
      case 'cancel_shipment':          return await execCancelShipment(args, userId, userRole);
      case 'assign_driver':            return await execAssignDriver(args, userId, userRole);
      case 'list_users':               return await execListUsers(args, userId, userRole);
      // ── Phase 1 tools ──────────────────────────────────────────────────
      case 'get_shipment_detail':      return await execGetShipmentDetail(args, userId, userRole);
      case 'get_terms':                return execGetTerms();
      case 'initiate_payment':         return await execInitiatePayment(args, userId, userRole);
      case 'withdraw_application':     return await execWithdrawApplication(args, userId, userRole);
      case 'process_document':         return await execProcessDocument(args, userId);
      case 'get_driver_info':          return await execGetDriverInfo(args, userId, userRole);
      default:
        return { success: false, data: null, summary: '', errorMessage: `Unknown tool: ${toolName}` };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, summary: '', errorMessage: msg };
  }
}
