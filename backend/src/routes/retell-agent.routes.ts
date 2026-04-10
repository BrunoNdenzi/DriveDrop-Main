/**
 * Retell AI Agent Routes — /api/v1/retell
 *
 * Tool webhook (Retell calls this mid-conversation when a tool is invoked):
 *   POST /api/v1/retell/tools
 *     Body:    { call_id, agent_id, name, arguments: {...} }
 *     Returns: { result: string }
 *
 * Post-call webhook (Retell posts lifecycle events here):
 *   POST /api/v1/retell/webhook
 *     Events: call_started | call_ended | call_analyzed
 *
 * Outbound call trigger (admin only):
 *   POST /api/v1/retell/call/carrier
 */

import { Router, Request, Response }  from 'express';
import { authenticate, authorize }     from '@middlewares/auth.middleware';
import { asyncHandler }                from '@utils/error';
import { logger }                      from '@utils/logger';
import { supabaseAdmin }               from '@lib/supabase';
import { VoiceAgentTools }             from '@services/VoiceAgentService';

const router = Router();

const RETELL_API_KEY = process.env['RETELL_API_KEY'] || '';
const RETELL_BASE    = 'https://api.retellai.com';

// ─────────────────────────────────────────────────────────────────────────────
// Tool dispatcher (public — Retell POSTs here each time the agent calls a tool)
//
// Retell POST format:
//   { call_id: string, agent_id: string, name: string, arguments: {...} }
//
// Required response:
//   { result: string }   ← Retell injects this back into the LLM as tool output
// ─────────────────────────────────────────────────────────────────────────────
router.post('/tools', asyncHandler(async (req: Request, res: Response) => {
  const {
    call_id,
    name,
    arguments: args = {},
  } = req.body as {
    call_id?: string;
    agent_id?: string;
    name: string;
    arguments: Record<string, any>;
  };

  logger.info('Retell tool call', { name, call_id });

  let result: object = { error: 'Unknown function' };

  try {
    switch (name) {
      case 'save_carrier_lead':
        result = await VoiceAgentTools.saveCarrierLead(args as any);
        break;
      case 'log_carrier_call_outcome':
        result = await VoiceAgentTools.logCarrierCallOutcome(args as any);
        break;
      case 'send_sms_link':
        result = await VoiceAgentTools.sendSmsLink(args as any);
        break;
      case 'get_shipment_status':
        result = await VoiceAgentTools.getShipmentStatus(args as any);
        break;
      case 'get_price_quote':
        result = await VoiceAgentTools.getPriceQuote(args as any);
        break;
      case 'get_available_loads':
        result = await VoiceAgentTools.getAvailableLoads(args as any);
        break;
      case 'create_shipment':
        result = await VoiceAgentTools.createShipment(args as any);
        break;
      case 'send_confirmation_email':
        result = await VoiceAgentTools.sendConfirmationEmail(args as any);
        break;
      default:
        logger.warn('Unknown Retell tool', { name, call_id });
        result = { error: `Unknown function: ${name}. Continue the conversation.` };
    }
  } catch (err) {
    logger.error('Retell tool execution error', { name, call_id, err });
    result = { error: 'Tool failed. Continue the conversation naturally.' };
  }

  // Retell requires the result as a plain string
  res.json({ result: JSON.stringify(result) });
}));

// ─────────────────────────────────────────────────────────────────────────────
// Post-call webhook (public — Retell POSTs lifecycle events after/during calls)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/webhook', asyncHandler(async (req: Request, res: Response) => {
  const { event, call } = req.body as {
    event: 'call_started' | 'call_ended' | 'call_analyzed';
    call?: Record<string, any>;
  };

  // Acknowledge immediately — Retell expects a quick 200
  res.json({ received: true });

  logger.info('Retell webhook event', { event, call_id: call?.['call_id'] });

  if (event === 'call_ended' && call) {
    const durationMs =
      call['end_timestamp'] && call['start_timestamp']
        ? Number(call['end_timestamp']) - Number(call['start_timestamp'])
        : null;

    try {
      const { error: dbErr } = await supabaseAdmin.from('voice_call_logs').upsert(
        {
          vapi_call_id:     call['call_id'],           // reuse column — stores Retell call ID
          direction:        call['direction'] ?? 'outbound',
          call_type:        call['metadata']?.['campaign'] ?? 'carrier_recruitment',
          caller_phone:     call['to_number'] ?? call['from_number'] ?? null,
          duration_seconds: durationMs ? Math.round(durationMs / 1000) : null,
          ended_reason:     call['disconnection_reason'] ?? null,
          transcript:       call['transcript']    ?? null,
          recording_url:    call['recording_url'] ?? null,
          metadata:         call['metadata']      ?? {},
          started_at:       call['start_timestamp']
            ? new Date(Number(call['start_timestamp'])).toISOString()
            : null,
          ended_at:         call['end_timestamp']
            ? new Date(Number(call['end_timestamp'])).toISOString()
            : null,
        },
        { onConflict: 'vapi_call_id' },
      );

      if (dbErr) {
        logger.error('Retell: failed to save call log', { error: dbErr.message, call_id: call['call_id'] });
      } else {
        logger.info('Retell call log saved', { call_id: call['call_id'], duration_s: durationMs ? Math.round(durationMs / 1000) : null });
      }
    } catch (e) {
      logger.error('Retell: exception saving call log', { call_id: call['call_id'], err: e });
    }
  }
}));

// ─────────────────────────────────────────────────────────────────────────────
// Trigger outbound carrier recruitment call (admin only)
// POST /api/v1/retell/call/carrier
// Body: { phone, company_name, city, state, opening_line? }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/call/carrier', authenticate, authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { phone, company_name, city, state, opening_line } = req.body as {
    phone:         string;
    company_name?: string;
    city?:         string;
    state?:        string;
    opening_line?: string;
  };

  if (!phone) {
    res.status(400).json({ error: 'phone is required' });
    return;
  }

  const agentId = process.env['RETELL_AGENT_ID'];
  if (!agentId) {
    res.status(500).json({ error: 'RETELL_AGENT_ID not configured in environment' });
    return;
  }

  const fromNumber = process.env['RETELL_PHONE_NUMBER'] || process.env['TWILIO_PHONE_NUMBER'] || '';

  const OPENERS = [
    'Hey — quick question. Do you guys run auto transport at all?',
    'Hi — am I catching you at a bad time? Real quick: do you move vehicles?',
    'Hey, this is Alex with DriveDrop out of Charlotte — do you haul cars?',
  ];

  const callRes = await fetch(`${RETELL_BASE}/v2/create-phone-call`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from_number:          fromNumber,
      to_number:            phone,
      override_agent_id:    agentId,
      retell_llm_dynamic_variables: {
        opening_line:  opening_line ?? OPENERS[Math.floor(Math.random() * OPENERS.length)],
        company_name:  company_name ?? '',
      },
      metadata: {
        campaign:     'carrier_recruitment',
        company_name: company_name,
        city,
        state,
      },
    }),
  });

  const callData = await callRes.json() as Record<string, any>;
  if (!callRes.ok) {
    logger.error('Retell outbound call failed', { status: callRes.status, data: callData });
    res.status(callRes.status).json({ error: callData });
    return;
  }

  logger.info('Retell outbound call initiated', { call_id: callData['call_id'], to: phone });
  res.json({ success: true, message: 'Outbound call initiated', data: callData });
}));

export default router;
