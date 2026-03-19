/**
 * VoiceAgentService — DriveDrop Voice Agent powered by Vapi.ai
 *
 * Handles:
 *  - Outbound carrier recruitment calls
 *  - Inbound 24/7 client support
 *  - Inbound driver support (hands-free, on the road)
 *  - Automated dispatch & status notifications
 *  - Internal admin voice queries
 *
 * Architecture:
 *  - Vapi manages the phone/voice layer (speech-to-text, LLM, text-to-speech)
 *  - This service provides the "function tools" Vapi calls during conversations
 *  - Webhooks from Vapi hit /api/v1/voice/webhook to receive call events
 *  - Outbound calls triggered by our backend hit POST /api/v1/voice/call
 *
 * Docs: https://docs.vapi.ai
 */

import { logger } from '@utils/logger';
import { supabaseAdmin } from '@lib/supabase';
import { calculateQuoteWithDynamicConfig } from './pricing.service';
import { googleMapsService } from './google-maps.service';
import { twilioService } from './twilio.service';

const supabase = supabaseAdmin;

const VAPI_API_KEY    = process.env['VAPI_API_KEY']          || '';
const VAPI_BASE_URL   = 'https://api.vapi.ai';
const APP_URL         = process.env['FRONTEND_URL']          || 'https://www.drivedrop.us.com';
const PHONE_NUMBER_ID = process.env['VAPI_PHONE_NUMBER_ID']  || ''; // Your Vapi-provisioned number
// Webhook this backend exposes — Vapi calls it for function execution & end-of-call reports
const SERVER_URL      = `${process.env['API_URL'] || 'https://drivedrop-main-production.up.railway.app'}/api/v1/voice/webhook`;

// ─────────────────────────────────────────────────────────────────────────────
// Persona & System Prompts
// Each persona is tailored for its use-case while sharing a warm, natural tone.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Operations Knowledge — injected into every persona so the agent knows the
// platform inside-out without needing external retrieval.
// ─────────────────────────────────────────────────────────────────────────────
const OPERATIONS_KNOWLEDGE = `
KEY DRIVEDROP FACTS (use these in your answers):

Company & coverage:
- Based in Charlotte, NC. Serves the full US but strong in the Southeast (I-85, I-77, I-40, I-26, I-95 corridors).
- Website: www.drivedrop.us.com | Carrier sign-up: www.drivedrop.us.com/drivers/register

How it works (end-to-end):
1. Client gets a quote on the website or by calling in
2. Client books & pays upfront (100% — via Stripe card)
3. DriveDrop assigns a verified FMCSA-registered driver
4. Driver picks up the vehicle (photo inspection at pickup)
5. Vehicle transported — real-time GPS tracking for clients
6. Delivery confirmed with photo proof, client signs off

Shipment status meanings (use plain English when speaking):
- Pending → "We're finding you a driver right now"
- Driver Assigned → "A driver has confirmed your job and will contact you soon"
- Driver En Route → "Your driver is on the way to the pickup location"
- Driver Arrived → "Your driver has arrived at the pickup address"
- Picked Up → "Your vehicle is loaded and on the way"
- In Transit → "Your vehicle is on the road"
- Delivered → "Your vehicle has been successfully delivered"

Typical pricing (rough guide, always use the quote tool for exact):
- Sedan: ~$150-400 under 500 miles, $400-800 cross-country
- SUV/pickup: 10-15% more than sedan
- Luxury (BMW, Mercedes, Porsche etc.): ~50% premium
- Motorcycle: $150-500 depending on distance
- Heavy/inoperable: $400-1,200+
- Expedited (ASAP): 25% premium over standard

For carriers:
- No broker markup — carrier keeps the full rate minus small platform fee
- First 90 days: 0% platform fee for new carriers
- Free TMS (transport management system), free AI route planner, free multi-stop optimizer
- Payments guaranteed — collected from client before job starts
- Under 5 minutes to sign up at www.drivedrop.us.com/drivers/register

Cancellation policy:
- Full refund if cancelled before a driver is assigned
- $50 fee if cancelled after driver assignment
- No refund once vehicle is picked up

All drivers are FMCSA-registered, background-checked, and carry cargo insurance.
`.trim();

/** Base personality traits shared across ALL personas */
const BASE_PERSONALITY = `
You are a friendly, confident, and natural-sounding representative of DriveDrop — a vehicle transport marketplace based in Charlotte, NC.

Core personality traits:
- Warm and conversational — sound like a real person, not a robot
- Concise — get to the point without being abrupt
- Honest — never overpromise or make up information
- Helpful — always try to solve the problem or find someone who can
- Professional but relaxed — like talking to a knowledgeable colleague

Speech guidelines:
- Use natural contractions (I'm, we're, you'll, don't)
- Avoid corporate jargon or robotic phrases
- Use brief affirmations: "Got it", "Sure", "Absolutely", "Of course"
- If you don't know something, say so and offer to connect them with a human
- Keep responses short — this is a voice call, not an essay
- Never read out long URLs — instead say "I'll send you a text with the link right now"
`.trim();

export const VOICE_PERSONAS = {

  // ── Carrier Recruitment (Outbound) ──────────────────────────────────────
  carrier_recruitment: `
${BASE_PERSONALITY}

${OPERATIONS_KNOWLEDGE}

Your name is Alex, and you're reaching out on behalf of DriveDrop.

Your goal: Introduce DriveDrop to FMCSA-registered auto transport carriers, spark genuine interest, answer their questions, and get them to sign up or request the sign-up link via text.

Key talking points you naturally weave in:
- DriveDrop is a vehicle transport marketplace — carriers get direct jobs from shippers, no broker taking a cut
- Completely free to join — free TMS, free AI route planner, free multi-stop optimizer
- Payments are guaranteed and collected upfront before the driver moves
- Takes under 5 minutes to sign up at drivedrop.us.com

Common objections and how you handle them:
- "We already use a broker" → "Totally get it — the difference is you keep the full rate instead of splitting with a middleman. A lot of our carriers use us alongside their broker loads."
- "How do you get paid?" → "We charge a small platform fee only after a job is completed — and for new carriers it's zero percent for the first 90 days."
- "Is this legit?" → "Absolutely — we're based in Charlotte, NC and work with FMCSA-registered carriers. Happy to send you our info by text so you can look us up."
- "I'm too busy right now" → "No problem at all — can I just send you a quick text with the link? Takes 30 seconds to glance at later."

Qualification questions to ask naturally during conversation:
1. What states do you typically run?
2. How many trucks are in your fleet?
3. What types of vehicles do you haul?

Always end with one of:
- Sending the sign-up link via SMS
- Booking a callback
- Thanking them and logging their preference to not be contacted

Never be pushy. If they say no twice, respect it: "No worries at all — I'll make a note, and we won't reach out again. Have a great day!"
`.trim(),

  // ── Client Support (Inbound 24/7) ────────────────────────────────────────
  client_support: `
${BASE_PERSONALITY}
${OPERATIONS_KNOWLEDGE}
Your name is Maya, and you're DriveDrop's client support assistant.

Your goal: Help clients with anything related to their vehicle shipments — tracking, quotes, booking, cancellations, payments, or concerns.

When a client calls:
1. Greet them warmly and ask how you can help
2. If they mention a shipment, ask for their name or phone number to look it up
3. Use the available tools to get live data from the system
4. Answer their question clearly and confirm they're satisfied before ending

Things you can do:
- Look up shipment status and location in real-time
- Give a price quote for a new shipment
- Help create a new shipment request (collect pickup, delivery, vehicle, date)
- Explain cancellation policy and refund eligibility
- Provide delivery ETAs
- Escalate to a human for damage claims, disputes, or complex billing

Things you can NOT do (escalate to human):
- Process refunds directly
- Handle dispute resolution
- Access payment card details
- Change a shipment that's already in transit

If you need to escalate: "Let me connect you with one of our team members who can handle this directly — they'll be with you shortly."

Tone: reassuring, patient, calm. The client may be stressed about their car. Acknowledge their feelings before jumping to solutions.
`.trim(),

  // ── Driver Support (Inbound — hands-free optimized) ──────────────────────
  driver_support: `
${BASE_PERSONALITY}
${OPERATIONS_KNOWLEDGE}
Your name is Jake, and you're DriveDrop's driver support assistant.

Your goal: Help drivers manage their work hands-free — they're often on the road and can't look at a screen, so brevity and clarity are critical.

Things you can do:
- Read out available loads near a location
- Report driver status updates (arrived, picked up, delivered)
- Read earnings summaries
- Check upcoming job details
- Answer FMCSA compliance questions
- Walk through BOL completion steps
- Send navigation links via SMS
- Report a delay and notify the client

Critical rules for driver calls:
- Keep responses SHORT — drivers are driving
- Confirm important actions back to them before executing: "Just to confirm — you want me to mark shipment 4892 as picked up. Is that right?"
- Offer to send details by text instead of reading long addresses or IDs aloud
- Never distract with unnecessary detail

If a driver is in an emergency or accident: immediately say "Please pull over safely if you haven't. I'll connect you with emergency support right now." and escalate.
`.trim(),

  // ── Dispatch Notification (Outbound — automated) ─────────────────────────
  dispatch_notification: `
${BASE_PERSONALITY}

Your name is Sam, calling from DriveDrop with a job notification or status update.

Keep it very brief — this is an automated notification call, not a conversation.

Script structure:
1. Introduce yourself and DriveDrop in one sentence
2. Deliver the specific notification concisely
3. Ask for a single action if needed (press 1 to accept, confirm delivery address, etc.)
4. Offer to send details by text
5. End call promptly

Examples:
- "Hi, this is Sam from DriveDrop. You've been matched to a new load — a 2022 Ford Explorer from Charlotte NC to Atlanta GA, paying $420. Press 1 to accept, or press 2 to pass."
- "Hi, this is Sam from DriveDrop. Your vehicle is about 40 miles from delivery and should arrive by 3pm today. I'll send you a text with the tracking link."
- "Hi, this is Sam from DriveDrop. Your payment of $380 for your Charlotte to Atlanta job has been released to your account."
`.trim(),

  // ── Admin Ops (Internal — voice queries) ─────────────────────────────────
  admin_ops: `
${BASE_PERSONALITY}

Your name is Benji, and you're the internal operations voice assistant for DriveDrop.

Your goal: Let the operations team query and control the platform hands-free.

Things you can do:
- Pull live shipment stats (active, pending, completed today)
- Assign a driver to a shipment
- List shipments that haven't moved in X hours
- Read daily revenue totals
- Trigger a follow-up email campaign
- Read out driver application status

Security: Before executing any write action (assignment, status change), always confirm: "Just to confirm — [action]. Should I go ahead?"

Tone: efficient, no fluff. Admin users are busy operators who know the system.
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// Vapi Tool Definitions
// These are the functions Vapi will call during live conversations to fetch
// real data from DriveDrop's platform.
// ─────────────────────────────────────────────────────────────────────────────

export const VAPI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_shipment_status',
      description: 'Look up the current status and location of a shipment by phone number or name of the client.',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: "Client's phone number (with or without country code)" },
          name:  { type: 'string', description: "Client's full name or company name" },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_price_quote',
      description: 'Calculate a shipping price quote between two locations for a specific vehicle type.',
      parameters: {
        type: 'object',
        required: ['pickup_location', 'delivery_location', 'vehicle_type'],
        properties: {
          pickup_location:   { type: 'string', description: 'Pickup city, state or full address' },
          delivery_location: { type: 'string', description: 'Delivery city, state or full address' },
          vehicle_type:      { type: 'string', enum: ['sedan', 'suv', 'pickup', 'luxury', 'motorcycle', 'heavy'], description: 'Type of vehicle to be transported' },
          is_operable:       { type: 'boolean', description: 'Whether the vehicle is operable (drives). Default true.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_available_loads',
      description: 'Get a list of available (unassigned) shipment loads, optionally filtered by location.',
      parameters: {
        type: 'object',
        properties: {
          state:    { type: 'string', description: 'State abbreviation to filter loads (e.g. NC, FL)' },
          limit:    { type: 'number', description: 'Maximum number of loads to return (default 3)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_shipment_status',
      description: "Update the status of a shipment — used by drivers to mark arrived, picked up, or delivered hands-free.",
      parameters: {
        type: 'object',
        required: ['shipment_id', 'new_status', 'driver_id'],
        properties: {
          shipment_id: { type: 'string', description: 'The shipment UUID' },
          new_status:  { type: 'string', enum: ['driver_en_route', 'driver_arrived', 'picked_up', 'in_transit', 'delivered'] },
          driver_id:   { type: 'string', description: 'Driver UUID performing the update' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_driver_earnings',
      description: "Get a driver's earnings summary.",
      parameters: {
        type: 'object',
        required: ['driver_id'],
        properties: {
          driver_id: { type: 'string', description: 'Driver UUID' },
          period:    { type: 'string', enum: ['today', 'this_week', 'this_month', 'all_time'], description: 'Time period. Default: this_week' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_sms_link',
      description: 'Send an SMS to the caller with a link (sign-up link, tracking link, or navigation link).',
      parameters: {
        type: 'object',
        required: ['to_phone', 'link_type'],
        properties: {
          to_phone:  { type: 'string', description: "Recipient's phone number" },
          link_type: { type: 'string', enum: ['signup', 'tracking', 'navigation', 'app_download'], description: 'Type of link to send' },
          shipment_id: { type: 'string', description: 'Required for tracking and navigation link types' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_admin_stats',
      description: 'Get live platform statistics for admin operations queries.',
      parameters: {
        type: 'object',
        properties: {
          stat_type: { type: 'string', enum: ['active_shipments', 'pending_shipments', 'revenue_today', 'driver_count', 'open_applications'], description: 'Which stat to retrieve' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_carrier_call_outcome',
      description: 'Log the result of an outbound carrier recruitment call — interested, not_interested, callback_requested, no_answer, voicemail.',
      parameters: {
        type: 'object',
        required: ['carrier_phone', 'outcome'],
        properties: {
          carrier_phone: { type: 'string' },
          outcome:       { type: 'string', enum: ['interested', 'not_interested', 'callback_requested', 'no_answer', 'voicemail', 'sent_link'] },
          notes:         { type: 'string', description: 'Any additional context from the conversation' },
          callback_date: { type: 'string', description: 'ISO date string if callback was requested' },
          fleet_size:    { type: 'number', description: 'Fleet size mentioned during call' },
          states_served: { type: 'string', description: 'States the carrier operates in, mentioned during call' },
        },
      },
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tool Implementations
// Called by the webhook handler when Vapi invokes a function mid-call.
// ─────────────────────────────────────────────────────────────────────────────

export class VoiceAgentTools {

  /** Look up a shipment by client phone or name */
  static async getShipmentStatus(params: { phone?: string; name?: string }): Promise<object> {
    try {
      let query = supabase
        .from('shipments')
        .select('id, status, pickup_address, delivery_address, vehicle_make, vehicle_model, vehicle_year, estimated_delivery_date, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (params.phone) {
        const normalized = params.phone.replace(/\D/g, '').slice(-10);
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .ilike('phone', `%${normalized}%`)
          .single();
        if (profile) query = query.eq('client_id', profile.id);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return { found: false, message: "I couldn't find a shipment linked to that information." };
      }

      const s = data[0];
      const statusReadable: Record<string, string> = {
        pending: 'waiting for a driver to be assigned',
        driver_assigned: 'a driver has been assigned and is preparing to pick up',
        driver_en_route: 'your driver is on the way to the pickup location',
        driver_arrived: 'your driver has arrived at the pickup location',
        picked_up: 'your vehicle has been picked up and is on its way',
        in_transit: 'your vehicle is in transit',
        delivered: 'your vehicle has been delivered',
        completed: 'delivery complete',
      };

      return {
        found: true,
        shipment_id: s.id,
        status: s.status,
        status_readable: statusReadable[s.status] || s.status,
        vehicle: `${s.vehicle_year} ${s.vehicle_make} ${s.vehicle_model}`,
        route: `${s.pickup_address} to ${s.delivery_address}`,
        estimated_delivery: s.estimated_delivery_date || 'not yet set',
      };
    } catch (err) {
      logger.error('VoiceAgentTools.getShipmentStatus error', { err });
      return { found: false, message: 'Unable to retrieve shipment information right now.' };
    }
  }

  /** Calculate a price quote */
  static async getPriceQuote(params: {
    pickup_location: string;
    delivery_location: string;
    vehicle_type: string;
    is_operable?: boolean;
  }): Promise<object> {
    try {
      const [pickup, delivery] = await Promise.all([
        googleMapsService.geocodeAddress(params.pickup_location),
        googleMapsService.geocodeAddress(params.delivery_location),
      ]);

      if (!pickup || !delivery) {
        return { error: true, message: "I wasn't able to recognize one of those locations. Could you give me a bit more detail?" };
      }

      const matrixResults = await googleMapsService.getDistanceMatrix(
        [`${pickup.latitude},${pickup.longitude}`],
        [`${delivery.latitude},${delivery.longitude}`]
      );

      const distanceResult = matrixResults[0];
      const distanceMiles = distanceResult?.distance?.value ? Math.round(distanceResult.distance.value / 1609.34) : 0;
      if (distanceMiles === 0) {
        return { error: true, message: "I had trouble calculating the distance between those locations." };
      }

      const quote = await calculateQuoteWithDynamicConfig({
        vehicleType: params.vehicle_type as any,
        distanceMiles,
        isAccidentRecovery: !params.is_operable,
      });

      return {
        found: true,
        pickup: params.pickup_location,
        delivery: params.delivery_location,
        vehicle_type: params.vehicle_type,
        distance_miles: distanceMiles,
        quote_usd: quote.total,
        quote_readable: `$${quote.total.toFixed(0)}`,
      };
    } catch (err) {
      logger.error('VoiceAgentTools.getPriceQuote error', { err });
      return { error: true, message: 'Unable to calculate that quote right now.' };
    }
  }

  /** Get available loads */
  static async getAvailableLoads(params: { state?: string; limit?: number }): Promise<object> {
    try {
      let query = supabase
        .from('shipments')
        .select('id, pickup_address, delivery_address, vehicle_make, vehicle_model, vehicle_year, estimated_price')
        .is('driver_id', null)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(params.limit || 3);

      if (params.state) {
        query = query.ilike('pickup_address', `%${params.state}%`);
      }

      const { data, error } = await query;
      if (error || !data) return { found: false, loads: [] };

      return {
        found: true,
        count: data.length,
        loads: data.map((l: any) => ({
          id: l.id,
          vehicle: `${l.vehicle_year} ${l.vehicle_make} ${l.vehicle_model}`,
          route: `${l.pickup_address} → ${l.delivery_address}`,
          pay: l.estimated_price ? `$${Number(l.estimated_price).toFixed(0)}` : 'TBD',
        })),
      };
    } catch (err) {
      logger.error('VoiceAgentTools.getAvailableLoads error', { err });
      return { found: false, loads: [] };
    }
  }

  /** Update a shipment status on behalf of a driver */
  static async updateShipmentStatus(params: {
    shipment_id: string;
    new_status: string;
    driver_id: string;
  }): Promise<object> {
    try {
      const { error } = await supabase.rpc('update_shipment_status_safe', {
        p_shipment_id: params.shipment_id,
        p_new_status: params.new_status,
        p_user_id: params.driver_id,
      });
      if (error) return { success: false, message: 'Status update failed — ' + error.message };
      return { success: true, message: `Shipment marked as ${params.new_status.replace('_', ' ')}.` };
    } catch (err) {
      logger.error('VoiceAgentTools.updateShipmentStatus error', { err });
      return { success: false, message: 'Unable to update status right now.' };
    }
  }

  /** Get driver earnings */
  static async getDriverEarnings(params: { driver_id: string; period?: string }): Promise<object> {
    try {
      const now = new Date();
      let fromDate: Date;
      switch (params.period || 'this_week') {
        case 'today':      fromDate = new Date(now.setHours(0,0,0,0)); break;
        case 'this_month': fromDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case 'all_time':   fromDate = new Date('2020-01-01'); break;
        default:           fromDate = new Date(now.setDate(now.getDate() - now.getDay())); // this week
      }

      const { data, error } = await supabase
        .from('shipments')
        .select('estimated_price')
        .eq('driver_id', params.driver_id)
        .eq('status', 'completed')
        .gte('updated_at', fromDate.toISOString());

      if (error) return { found: false, message: "Couldn't retrieve earnings right now." };

      const total = (data || []).reduce((sum: number, s: any) => sum + Number(s.estimated_price || 0), 0);
      return {
        found: true,
        period: params.period || 'this_week',
        total_usd: total,
        total_readable: `$${total.toFixed(0)}`,
        job_count: (data || []).length,
      };
    } catch (err) {
      logger.error('VoiceAgentTools.getDriverEarnings error', { err });
      return { found: false, message: "Couldn't retrieve earnings right now." };
    }
  }

  /** Send an SMS link to the caller */
  static async sendSmsLink(params: {
    to_phone: string;
    link_type: string;
    shipment_id?: string;
  }): Promise<object> {
    const LINKS: Record<string, string> = {
      signup:       `${APP_URL}/drivers/register?utm_source=voice&utm_campaign=carrier_call`,
      tracking:     params.shipment_id ? `${APP_URL}/track/${params.shipment_id}` : APP_URL,
      navigation:   params.shipment_id ? `${APP_URL}/dashboard/driver/navigation?shipment=${params.shipment_id}` : APP_URL,
      app_download: `${APP_URL}?utm_source=voice&utm_medium=sms`,
    };

    const MESSAGES: Record<string, string> = {
      signup:       `Hey! Here's your DriveDrop carrier sign-up link — takes under 5 minutes: ${LINKS['signup']}`,
      tracking:     `Track your vehicle here: ${LINKS['tracking']}`,
      navigation:   `Navigation link for your delivery: ${LINKS['navigation']}`,
      app_download: `Download the DriveDrop app: ${LINKS['app_download']}`,
    };

    try {
      const message = MESSAGES[params.link_type] ?? (LINKS['signup'] as string);
      await twilioService.sendSMS({ to: params.to_phone, message });
      return { success: true, message: `SMS sent to ${params.to_phone}` };
    } catch (err) {
      logger.error('VoiceAgentTools.sendSmsLink error', { err });
      return { success: false, message: 'SMS could not be sent right now.' };
    }
  }

  /** Get admin platform stats */
  static async getAdminStats(params: { stat_type?: string }): Promise<object> {
    try {
      switch (params.stat_type) {
        case 'active_shipments': {
          const { count } = await supabase.from('shipments').select('*', { count: 'exact', head: true })
            .in('status', ['driver_assigned', 'driver_en_route', 'driver_arrived', 'picked_up', 'in_transit']);
          return { stat: 'active_shipments', value: count ?? 0, readable: `${count} active shipments` };
        }
        case 'pending_shipments': {
          const { count } = await supabase.from('shipments').select('*', { count: 'exact', head: true }).eq('status', 'pending');
          return { stat: 'pending_shipments', value: count ?? 0, readable: `${count} pending shipments waiting for a driver` };
        }
        case 'revenue_today': {
          const today = new Date(); today.setHours(0,0,0,0);
          const { data } = await supabase.from('shipments').select('estimated_price').eq('status', 'completed').gte('updated_at', today.toISOString());
          const total = (data || []).reduce((s: number, r: any) => s + Number(r.estimated_price || 0), 0);
          return { stat: 'revenue_today', value: total, readable: `$${total.toFixed(0)} in completed deliveries today` };
        }
        case 'driver_count': {
          const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'driver').eq('is_verified', true);
          return { stat: 'driver_count', value: count ?? 0, readable: `${count} verified drivers on the platform` };
        }
        case 'open_applications': {
          const { count } = await supabase.from('driver_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending');
          return { stat: 'open_applications', value: count ?? 0, readable: `${count} driver applications awaiting review` };
        }
        default: {
          const [active, pending, drivers] = await Promise.all([
            supabase.from('shipments').select('*', { count: 'exact', head: true }).in('status', ['driver_assigned','driver_en_route','picked_up','in_transit']),
            supabase.from('shipments').select('*', { count: 'exact', head: true }).eq('status','pending'),
            supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role','driver').eq('is_verified',true),
          ]);
          return {
            stat: 'overview',
            active_shipments: active.count ?? 0,
            pending_shipments: pending.count ?? 0,
            verified_drivers: drivers.count ?? 0,
          };
        }
      }
    } catch (err) {
      logger.error('VoiceAgentTools.getAdminStats error', { err });
      return { error: true, message: "Couldn't retrieve stats right now." };
    }
  }

  /** Log the outcome of an outbound carrier recruitment call */
  static async logCarrierCallOutcome(params: {
    carrier_phone: string;
    outcome: string;
    notes?: string;
    callback_date?: string;
    fleet_size?: number;
    states_served?: string;
  }): Promise<object> {
    try {
      const { error } = await supabase.from('carrier_call_logs').insert({
        carrier_phone:  params.carrier_phone,
        outcome:        params.outcome,
        notes:          params.notes || null,
        callback_date:  params.callback_date || null,
        fleet_size:     params.fleet_size || null,
        states_served:  params.states_served || null,
        called_at:      new Date().toISOString(),
      });
      if (error) {
        logger.warn('carrier_call_logs insert failed — table may not exist yet:', error.message);
      }
      return { success: true };
    } catch (err) {
      logger.error('VoiceAgentTools.logCarrierCallOutcome error', { err });
      return { success: false };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vapi API Client — Outbound call management
// ─────────────────────────────────────────────────────────────────────────────

export class VoiceAgentService {

  private async vapiRequest(path: string, method: string, body?: object): Promise<any> {
    if (!VAPI_API_KEY) throw new Error('VAPI_API_KEY is not configured');

    const res = await fetch(`${VAPI_BASE_URL}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Vapi API error ${res.status}: ${JSON.stringify(data)}`);
    return data;
  }

  /**
   * Trigger an outbound call to a carrier for recruitment.
   */
  async callCarrier(params: {
    phone: string;
    companyName: string;
    city: string;
    state: string;
  }): Promise<{ callId: string }> {
    logger.info(`Initiating carrier recruitment call to ${params.companyName} (${params.phone})`);

    const call = await this.vapiRequest('/call', 'POST', {
      phoneNumberId: PHONE_NUMBER_ID,
      customer: {
        number: params.phone,
        name:   params.companyName,
      },
      assistant: {
        name:             'Alex',
        voice:            { provider: 'openai', voiceId: 'echo' },
        serverUrl:        SERVER_URL,
        model: {
          provider: 'openai',
          model:    'gpt-4o',
          messages: [{ role: 'system', content: VOICE_PERSONAS.carrier_recruitment }],
          tools:    VAPI_TOOLS,
        },
        firstMessage: `Hi, is this ${params.companyName}? Great — my name is Alex, I'm calling from DriveDrop. We work with auto transport carriers like yourself, and I just wanted to take 60 seconds to tell you about something that could get you more loads without any broker fees. Is now an okay time?`,
        endCallFunctionEnabled: true,
        recordingEnabled:       true,
        hipaaEnabled:           false,
        maxDurationSeconds:     300,
      },
      metadata: {
        campaign:     'carrier_recruitment',
        company_name: params.companyName,
        state:        params.state,
        city:         params.city,
      },
    });

    return { callId: call.id };
  }

  /**
   * Trigger an outbound dispatch notification call to a driver.
   */
  async notifyDriver(params: {
    phone:      string;
    driverName: string;
    message:    string; // e.g. "You've been matched to a new load..."
    promptAction?: string; // e.g. "Press 1 to accept, 2 to pass"
  }): Promise<{ callId: string }> {
    const call = await this.vapiRequest('/call', 'POST', {
      phoneNumberId: PHONE_NUMBER_ID,
      customer: { number: params.phone, name: params.driverName },
      assistant: {
        name:      'Sam',
        voice:     { provider: 'openai', voiceId: 'nova' },
        serverUrl: SERVER_URL,
        model: {
          provider: 'openai',
          model:    'gpt-4o',
          messages: [{ role: 'system', content: VOICE_PERSONAS.dispatch_notification }],
          tools:    VAPI_TOOLS,
        },
        firstMessage: `Hi ${params.driverName}, this is Sam from DriveDrop. ${params.message}${params.promptAction ? ' ' + params.promptAction : ''}`,
        endCallFunctionEnabled: true,
        recordingEnabled:       true,
        maxDurationSeconds:     120,
      },
      metadata: { campaign: 'dispatch_notification' },
    });
    return { callId: call.id };
  }

  /**
   * Trigger an outbound status update call to a client.
   */
  async notifyClient(params: {
    phone:       string;
    clientName:  string;
    message:     string;
    shipmentId?: string;
  }): Promise<{ callId: string }> {
    const call = await this.vapiRequest('/call', 'POST', {
      phoneNumberId: PHONE_NUMBER_ID,
      customer: { number: params.phone, name: params.clientName },
      assistant: {
        name:      'Maya',
        voice:     { provider: 'openai', voiceId: 'shimmer' },
        serverUrl: SERVER_URL,
        model: {
          provider: 'openai',
          model:    'gpt-4o',
          messages: [{ role: 'system', content: VOICE_PERSONAS.client_support }],
          tools:    VAPI_TOOLS,
        },
        firstMessage: `Hi ${params.clientName}, this is Maya from DriveDrop. ${params.message} I can also send you a tracking link by text if that's helpful.`,
        endCallFunctionEnabled: true,
        recordingEnabled:       true,
        maxDurationSeconds:     180,
      },
      metadata: {
        campaign:    'client_notification',
        shipment_id: params.shipmentId || null,
      },
    });
    return { callId: call.id };
  }

  /**
   * Get details of a specific call.
   */
  async getCall(callId: string): Promise<object> {
    return this.vapiRequest(`/call/${callId}`, 'GET');
  }

  /**
   * List recent calls with optional filters.
   */
  async listCalls(params?: { limit?: number; status?: string }): Promise<object[]> {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.status) qs.set('status', params.status);
    return this.vapiRequest(`/call?${qs.toString()}`, 'GET');
  }

  /**
   * Get the transcript of a completed call.
   */
  async getTranscript(callId: string): Promise<string> {
    const call: any = await this.getCall(callId);
    return call?.transcript || call?.messages?.map((m: any) => `${m.role}: ${m.content}`).join('\n') || '';
  }

  /**
   * One-time setup: creates (or updates) the DriveDrop inbound "Maya" assistant
   * in Vapi and assigns it to the configured phone number.
   * Call POST /api/v1/voice/setup once after first deploy.
   */
  async setupInboundAssistant(): Promise<{ assistantId: string; phoneNumberId: string; message: string }> {
    logger.info('Voice agent setup: creating/updating Maya inbound assistant');

    const assistantPayload = {
      name:      'DriveDrop-Maya',
      voice:     { provider: 'openai', voiceId: 'shimmer' },
      serverUrl: SERVER_URL,
      model: {
        provider: 'openai',
        model:    'gpt-4o',
        messages: [{ role: 'system', content: VOICE_PERSONAS.client_support }],
        tools:    VAPI_TOOLS,
      },
      firstMessage: "Hi, you've reached DriveDrop! I'm Maya. How can I help you today — are you looking to ship a vehicle, or checking on an existing order?",
      endCallFunctionEnabled: true,
      recordingEnabled:       true,
      maxDurationSeconds:     600,
    };

    // Check if a DriveDrop-Maya assistant already exists
    const assistants: any[] = await this.vapiRequest('/assistant?limit=100', 'GET').catch(() => []);
    const existing = Array.isArray(assistants)
      ? assistants.find((a: any) => a.name === 'DriveDrop-Maya')
      : null;

    let assistantId: string;
    if (existing) {
      logger.info(`Updating existing DriveDrop-Maya assistant (${existing.id})`);
      const updated = await this.vapiRequest(`/assistant/${existing.id}`, 'PATCH', assistantPayload);
      assistantId = updated.id;
    } else {
      logger.info('Creating new DriveDrop-Maya assistant');
      const created = await this.vapiRequest('/assistant', 'POST', assistantPayload);
      assistantId = created.id;
    }

    // Assign this assistant to the phone number + set the server URL at phone-number level too
    if (PHONE_NUMBER_ID) {
      await this.vapiRequest(`/phone-number/${PHONE_NUMBER_ID}`, 'PATCH', {
        assistantId,
        serverUrl: SERVER_URL,
      });
      logger.info(`Phone number ${PHONE_NUMBER_ID} → assistant ${assistantId}`);
    }

    return {
      assistantId,
      phoneNumberId: PHONE_NUMBER_ID,
      message: existing
        ? `Updated existing DriveDrop-Maya assistant (${assistantId}) and assigned to phone number.`
        : `Created new DriveDrop-Maya assistant (${assistantId}) and assigned to phone number.`,
    };
  }

  /**
   * Trigger an immediate test call to a given phone number using the Maya persona.
   * Useful for smoke-testing the full stack.
   */
  async testCall(toPhone: string): Promise<{ callId: string }> {
    logger.info(`Triggering test call to ${toPhone}`);
    const call = await this.vapiRequest('/call', 'POST', {
      phoneNumberId: PHONE_NUMBER_ID,
      customer:      { number: toPhone },
      assistant: {
        name:      'Maya',
        voice:     { provider: 'openai', voiceId: 'shimmer' },
        serverUrl: SERVER_URL,
        model: {
          provider: 'openai',
          model:    'gpt-4o',
          messages: [{ role: 'system', content: VOICE_PERSONAS.client_support }],
          tools:    VAPI_TOOLS,
        },
        firstMessage: "Hi! This is Maya from DriveDrop — just running a quick test call. Everything's working great! You can hang up anytime.",
        endCallFunctionEnabled: true,
        recordingEnabled:       true,
        maxDurationSeconds:     120,
      },
    });
    return { callId: call.id };
  }
}

export const voiceAgentService = new VoiceAgentService();
