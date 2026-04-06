/**
 * Voice Agent Routes — /api/v1/voice
 *
 * Webhook:
 *   POST /api/v1/voice/webhook       — Vapi calls this during/after every call (function calls, end-of-call, transcripts)
 *
 * Outbound call triggers (admin only):
 *   POST /api/v1/voice/call/carrier  — Trigger outbound carrier recruitment call
 *   POST /api/v1/voice/call/driver   — Trigger dispatch notification to driver
 *   POST /api/v1/voice/call/client   — Trigger status update notification to client
 *
 * Call management (admin only):
 *   GET  /api/v1/voice/calls         — List calls with optional filters
 *   GET  /api/v1/voice/calls/:id     — Get a specific call's details
 *   GET  /api/v1/voice/calls/:id/transcript — Get call transcript text
 */

import { Router, Request, Response } from 'express';
import { authenticate, authorize }   from '@middlewares/auth.middleware';
import { asyncHandler }              from '@utils/error';
import { successResponse }           from '@utils/response';
import { logger }                    from '@utils/logger';
import { supabaseAdmin }              from '@lib/supabase';
import { voiceAgentService, VoiceAgentTools } from '@services/VoiceAgentService';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Vapi Webhook (public — Vapi calls this, no auth header from Vapi)
//
// Vapi sends different message types:
//   "function-call"   → agent wants to call a tool function mid-conversation
//   "end-of-call-report" → full call summary, transcript, cost
//   "speech-update"   → incremental transcription (usually ignored)
//   "status-update"   → call state changes (ringing, in-progress, ended)
//   "assistant-request" → Vapi asks which assistant to use (for inbound number routing)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/webhook', asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    message?: {
      type: string;
      functionCall?: { name: string; parameters: Record<string, any> };
      call?: {
        id: string;
        type?: string;
        assistantId?: string;
        phoneNumberId?: string;
        customer?: { number?: string; name?: string };
        startedAt?: string;
        endedAt?: string;
        cost?: number;
        metadata?: Record<string, any>;
        recordingUrl?: string;
      };
      transcript?: string;
      summary?: string;
      endedReason?: string;
      cost?: number;
      recordingUrl?: string;
    };
  };

  const msg = body.message;
  if (!msg) {
    res.json({ result: 'ok' });
    return;
  }

  logger.info('Voice webhook received', { type: msg.type, callId: msg.call?.id });

  // ── Handle tool/function calls from the agent ──────────────────────────────
  if (msg.type === 'function-call' && msg.functionCall) {
    const { name, parameters } = msg.functionCall;

    let result: object = { error: 'Unknown function' };

    try {
      switch (name) {
        case 'get_shipment_status':
          result = await VoiceAgentTools.getShipmentStatus(parameters as any);
          break;
        case 'get_price_quote':
          result = await VoiceAgentTools.getPriceQuote(parameters as any);
          break;
        case 'get_available_loads':
          result = await VoiceAgentTools.getAvailableLoads(parameters as any);
          break;
        case 'update_shipment_status':
          result = await VoiceAgentTools.updateShipmentStatus(parameters as any);
          break;
        case 'get_driver_earnings':
          result = await VoiceAgentTools.getDriverEarnings(parameters as any);
          break;
        case 'send_sms_link':
          result = await VoiceAgentTools.sendSmsLink(parameters as any);
          break;
        case 'get_admin_stats':
          result = await VoiceAgentTools.getAdminStats(parameters as any);
          break;
        case 'log_carrier_call_outcome':
          result = await VoiceAgentTools.logCarrierCallOutcome(parameters as any);
          break;
        case 'save_carrier_lead':
          result = await VoiceAgentTools.saveCarrierLead(parameters as any);
          break;
        case 'create_shipment':
          result = await VoiceAgentTools.createShipment(parameters as any);
          break;
        case 'send_confirmation_email':
          result = await VoiceAgentTools.sendConfirmationEmail(parameters as any);
          break;
        default:
          logger.warn(`Unknown voice agent function: ${name}`);
      }
    } catch (err) {
      logger.error('Voice agent tool execution error', { name, err });
      result = { error: 'Tool execution failed. Please continue the conversation.' };
    }

    // Vapi strictly requires result to be a JSON string, not a raw object
    res.json({ result: JSON.stringify(result) });
    return;
  }

  // ── End-of-call report ─────────────────────────────────────────────────────
  if (msg.type === 'end-of-call-report') {
    const call = msg.call;
    const durationSec = call?.startedAt && call?.endedAt
      ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
      : null;

    logger.info('Call ended', {
      callId:      call?.id,
      endedReason: msg.endedReason,
      cost:        msg.cost,
      duration:    durationSec,
      transcript:  msg.transcript?.slice(0, 200),
    });

    const { error: dbError } = await supabaseAdmin.from('voice_call_logs').upsert({
      vapi_call_id:     call?.id,
      direction:        call?.type === 'inboundPhoneCall' ? 'inbound' : 'outbound',
      call_type:        call?.metadata?.['campaign'] ?? 'client_support',
      caller_phone:     call?.customer?.number,
      duration_seconds: durationSec,
      ended_reason:     msg.endedReason,
      cost_usd:         msg.cost ?? call?.cost,
      transcript:       msg.transcript,
      summary:          msg.summary,
      recording_url:    msg.recordingUrl ?? call?.recordingUrl,
      metadata:         call?.metadata ?? {},
      started_at:       call?.startedAt,
      ended_at:         call?.endedAt,
    }, { onConflict: 'vapi_call_id' });
    if (dbError) {
      logger.error('Failed to save call log to Supabase', { error: dbError.message, details: dbError.details, hint: dbError.hint });
    } else {
      logger.info('Call log saved to Supabase', { callId: call?.id });
    }

    res.json({ result: 'ok' });
    return;
  }

  // ── Assistant routing for inbound calls ────────────────────────────────────
  // When you assign your Vapi phone number with "assistant routing" mode,
  // Vapi will POST here and expect { assistant: { ... } } back.
  if (msg.type === 'assistant-request') {
    const { VAPI_TOOLS, VOICE_PERSONAS } = await import('@services/VoiceAgentService');
    const serverUrl = `${process.env['API_URL'] || 'https://drivedrop-main-production.up.railway.app'}/api/v1/voice/webhook`;

    // Try to identify the caller by their phone number so Benji can greet them by name
    // and already knows their shipment history — no need to ask who they are.
    const callerPhone = msg.call?.customer?.number ?? '';
    let callerContext = '';
    let firstMessage = "Hi, you've reached DriveDrop! I'm Benji. How can I help you today — are you looking to ship a vehicle, or checking on an existing order?";

    if (callerPhone) {
      try {
        const phoneDigits = callerPhone.replace(/\D/g, '').slice(-10);
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id, first_name, last_name, email, phone')
          .ilike('phone', `%${phoneDigits}%`)
          .maybeSingle();

        if (profile) {
          // Look up their most recent active / recent shipment
          const { data: recentShipment } = await supabaseAdmin
            .from('shipments')
            .select('id, status, vehicle_make, vehicle_model, vehicle_year, pickup_address, delivery_address')
            .eq('client_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const name = profile.first_name || 'there';

          if (recentShipment) {
            const statusMap: Record<string, string> = {
              pending:          'waiting for a driver to be assigned',
              driver_assigned:  'driver assigned and preparing to pick up',
              driver_en_route:  'driver on the way to pickup',
              driver_arrived:   'driver has arrived at pickup',
              picked_up:        'vehicle picked up and on the way',
              in_transit:       'in transit',
              delivered:        'delivered',
              completed:        'completed',
            };
            const statusReadable = statusMap[recentShipment.status] || recentShipment.status;
            const vehicle = `${recentShipment.vehicle_year} ${recentShipment.vehicle_make} ${recentShipment.vehicle_model}`;
            callerContext = `\n\n[CALLER CONTEXT — inject naturally into the conversation]\nThe caller is an existing DriveDrop client. Profile: ${profile.first_name} ${profile.last_name || ''} | email: ${profile.email} | phone: ${callerPhone}.\nMost recent shipment: ${vehicle} from ${recentShipment.pickup_address} to ${recentShipment.delivery_address} — currently ${statusReadable} (ID: ${recentShipment.id}).\nGreet them by first name straight away. You ALREADY know who they are — do NOT ask for their name or phone number again.`;
            firstMessage = `Hi ${name}! This is Benji from DriveDrop. Good to hear from you — can I help you with your ${vehicle} shipment, or is there something else I can do for you today?`;
          } else {
            callerContext = `\n\n[CALLER CONTEXT]\nThe caller is an existing DriveDrop client with no active shipments: ${profile.first_name} ${profile.last_name || ''} | email: ${profile.email}.\nGreet them by first name. You know who they are — no need to ask.`;
            firstMessage = `Hi ${name}! This is Benji from DriveDrop. How can I help you today?`;
          }
        }
      } catch (lookupErr) {
        logger.warn('Caller profile lookup failed (non-fatal)', { callerPhone, err: lookupErr });
      }
    }

    res.json({
      assistant: {
        name:      'Benji',
        voice:     { provider: 'openai', voiceId: 'shimmer' },
        serverUrl,
        model: {
          provider:    'openai',
          model:       'gpt-4o',
          temperature: 0.7,
          messages:    [{ role: 'system', content: VOICE_PERSONAS.client_support + callerContext }],
          tools:       VAPI_TOOLS,
        },
        firstMessage,
        endCallFunctionEnabled:        true,
        recordingEnabled:              true,
        maxDurationSeconds:            600,
        backchannelingEnabled:         true,
        responseDelaySeconds:          0.4,
        numWordsToInterruptAssistant:  2,
        backgroundSound:               'off',
        silenceTimeoutSeconds:         30,
        messagePlan: {
          idleMessages:       ["Still there?", "Hey, you still with me?"],
          idleTimeoutSeconds: 15,
        },
        transcriber: {
          provider:    'deepgram',
          model:       'nova-2',
          language:    'en-US',
          smartFormat: true,
        },
      },
    });
    return;
  }

  // All other event types (speech-update, status-update, etc.) — acknowledge
  res.json({ result: 'ok' });
}));

// ─────────────────────────────────────────────────────────────────────────────
// Admin routes (require authentication + admin role)
// ─────────────────────────────────────────────────────────────────────────────
router.use(authenticate);
router.use(authorize(['admin']));

// ── POST /call/carrier ────────────────────────────────────────────────────────
// Body: { phone, companyName, city, state }
router.post('/call/carrier', asyncHandler(async (req: Request, res: Response) => {
  const { phone, companyName, city, state } = req.body;
  if (!phone || !companyName) {
    res.status(400).json({ success: false, error: { message: 'phone and companyName are required' } });
    return;
  }
  const result = await voiceAgentService.callCarrier({ phone, companyName, city: city || '', state: state || '' });
  logger.info(`Outbound carrier call initiated`, { companyName, phone, callId: result.callId });
  res.json(successResponse(result));
}));

// ── POST /call/driver ─────────────────────────────────────────────────────────
// Body: { phone, driverName, message, promptAction? }
router.post('/call/driver', asyncHandler(async (req: Request, res: Response) => {
  const { phone, driverName, message, promptAction } = req.body;
  if (!phone || !driverName || !message) {
    res.status(400).json({ success: false, error: { message: 'phone, driverName, and message are required' } });
    return;
  }
  const result = await voiceAgentService.notifyDriver({ phone, driverName, message, promptAction });
  res.json(successResponse(result));
}));

// ── POST /call/client ─────────────────────────────────────────────────────────
// Body: { phone, clientName, message, shipmentId? }
router.post('/call/client', asyncHandler(async (req: Request, res: Response) => {
  const { phone, clientName, message, shipmentId } = req.body;
  if (!phone || !clientName || !message) {
    res.status(400).json({ success: false, error: { message: 'phone, clientName, and message are required' } });
    return;
  }
  const result = await voiceAgentService.notifyClient({ phone, clientName, message, shipmentId });
  res.json(successResponse(result));
}));

// ── GET /calls ────────────────────────────────────────────────────────────────
// Query: ?limit=20&status=ended
router.get('/calls', asyncHandler(async (req: Request, res: Response) => {
  const limit  = Number(req.query['limit']) || 20;
  const status = req.query['status'] as string | undefined;
  const calls  = await voiceAgentService.listCalls({ limit, ...(status !== undefined && { status }) });
  res.json(successResponse({ calls, count: Array.isArray(calls) ? calls.length : 0 }));
}));

// ── GET /calls/:id ────────────────────────────────────────────────────────────
router.get('/calls/:id', asyncHandler(async (req: Request, res: Response) => {
  const call = await voiceAgentService.getCall(req.params['id']!);
  res.json(successResponse(call));
}));

// ── GET /calls/:id/transcript ─────────────────────────────────────────────────
router.get('/calls/:id/transcript', asyncHandler(async (req: Request, res: Response) => {
  const transcript = await voiceAgentService.getTranscript(req.params['id']!);
  res.json(successResponse({ callId: req.params['id'], transcript }));
}));

// ── POST /setup ───────────────────────────────────────────────────────────────
// Creates or updates the DriveDrop-Maya assistant in Vapi and assigns it to
// the configured phone number. Run once after first deploy (idempotent).
router.post('/setup', asyncHandler(async (_req: Request, res: Response) => {
  const result = await voiceAgentService.setupInboundAssistant();
  logger.info('Voice agent setup complete', result);
  res.json(successResponse(result));
}));

// ── POST /test-call ───────────────────────────────────────────────────────────
// Body: { phone } — triggers a live test call to the given number using Maya.
router.post('/test-call', asyncHandler(async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) {
    res.status(400).json({ success: false, error: { message: 'phone is required' } });
    return;
  }
  const result = await voiceAgentService.testCall(phone);
  logger.info('Test call initiated', { phone, callId: result.callId });
  res.json(successResponse({ ...result, message: `Test call initiated to ${phone}` }));
}));

export default router;
