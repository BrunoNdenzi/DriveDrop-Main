/**
 * Benji V3 — Core LLM agent service
 *
 * Architecture: LLM-controlled agentic loop with function calling.
 *
 * Pipeline per request:
 *   1. Load or create session (conversation history + logistics context)
 *   2. Build system prompt with current session context injected
 *   3. Append user message to history
 *   4. Agentic loop (max 5 iterations):
 *        a. Call GPT-4o with full history + tool definitions
 *        b. If GPT decides to call tool(s): execute them, append results, loop
 *        c. If GPT returns text: capture response, exit loop
 *   5. Extract any context updates from tool outputs
 *   6. Append assistant response to history
 *   7. Save session
 *   8. Return response + metadata
 *
 * Key inversion vs V2:
 *   V2: rigid step pipeline drives LLM → robotic, can't handle greetings
 *   V3: LLM drives everything → tools are capabilities, not controllers
 */

import { openaiClient }       from '@benji/ai/client/openai.client';
import { v3SessionStore }     from './benji.memory';
import { buildV3SystemPrompt } from './prompts/system.prompt';
import { V3_TOOL_DEFINITIONS, executeV3Tool } from './tools/index';
import { logger }             from '@utils/logger';
import { logV3Audit, createAuditEvent } from './audit/benji.audit';
import type { Response }      from 'express';
import type {
  V3ChatRequest,
  V3ChatResponse,
  V3Session,
  V3LogisticsContext,
  UserType,
} from './benji.types';
import type OpenAI from 'openai';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL           = 'gpt-4o-mini';  // Fast, cheap, great for conversational AI
const MODEL_WITH_TOOLS = 'gpt-4o';      // Stronger reasoning when tools are invoked
const MAX_LOOP        = 5;              // Prevent runaway tool chains
const MAX_TOKENS      = 1024;
const MAX_TOKENS_FAST = 256;            // For greeting/trivial responses — faster
const TEMPERATURE     = 0.65;
const CTX_WINDOW      = 20;            // Max recent messages sent to API (limits token cost)

// ─── Role-based tool filtering ────────────────────────────────────────────────

/**
 * Return only the tools the current user role is allowed to invoke.
 * Sending fewer tools improves routing accuracy and prevents the LLM from calling
 * restricted tools that would be rejected server-side anyway.
 */
function getToolsForRole(userRole: UserType): OpenAI.Chat.Completions.ChatCompletionTool[] {
  // Tools restricted by role (blocked tools per role):
  const BLOCKED: Record<string, string[]> = {
    client: [
      'update_shipment_status',    // clients cannot change status
      'apply_for_shipment',        // clients don't apply for loads
      'list_driver_applications',  // client-irrelevant
      'assign_driver',             // admin only
      'list_users',                // admin only
      'withdraw_application',      // driver only
    ],
    driver: [
      'assign_driver',             // admin only
      'list_users',                // admin only
      'get_payment_info',          // driver cannot see payment records
      'initiate_payment',          // client only
      'get_driver_info',           // client/admin only
    ],
    admin: [
      'apply_for_shipment',        // driver only
      'list_driver_applications',  // driver only
      'withdraw_application',      // driver only
    ],
    broker: [
      'update_shipment_status',    // drivers/admins only
      'apply_for_shipment',        // drivers only
      'list_driver_applications',  // drivers only
      'assign_driver',             // admin only
      'list_users',                // admin only
      'withdraw_application',      // driver only
    ],
  };

  const blocked = BLOCKED[userRole] ?? [];
  return V3_TOOL_DEFINITIONS.filter(tool => {
    const fn = (tool as { function?: { name: string } }).function;
    return fn ? !blocked.includes(fn.name) : true;
  });
}

// ─── Greeting fast-path heuristic ────────────────────────────────────────────

/**
 * Returns true if the message is almost certainly a greeting or purely conversational
 * with no logistics intent. Used to skip loading tool definitions and to reduce
 * max_tokens, cutting latency significantly.
 *
 * Conservative: only fires on very clear non-logistics messages.
 */
const LOGISTICS_KEYWORDS = /\b(ship|shipment|shipments|shipping|freight|transport|carrier|pickup|delivery|quote|price|cost|rate|track|tracking|vehicle|car|truck|sedan|suv|toyota|ford|honda|bmw|mercedes|route|mile|haul|load|loads|driver|dispatch|invoice|book|booking|status|schedule|operable|origin|destination|assign|message|messages|conversation|conversations|apply|application|applications|payment|payments|profile|history|earnings|order|orders|cancel|cancelled|cancellation|pending|delivered|transit|accepted|assigned|users|available|jobs|withdraw|abort|detail|terms|term|deposit|refund|enclosed|open|insurance|damage|photo|document|vin|plate|registration|title|receipt|expedited|flexible|deadline)\b/i;

function isConversationalOnly(message: string, ctx: V3LogisticsContext): boolean {
  if (LOGISTICS_KEYWORDS.test(message)) return false;
  // If logistics intent was ever detected in this session, keep tools available.
  // This prevents tool dropout during multi-turn information gathering.
  if (ctx.logisticsIntentActive) return false;
  // If there is active logistics context (active quote, active shipment, vehicle on record),
  // keep tools available even for short follow-up replies like "ok", "yes", "sure", "do it".
  // Without this, an affirmative reply to "Want me to book it?" would never reach create_shipment.
  if (ctx.lastQuote || ctx.activeShipmentId || ctx.lastShipmentId || ctx.vehicle?.make) return false;
  // Only fast-path very short messages (≤5 chars) with no logistics context
  if (message.trim().length <= 5) return true;
  return false;
}

// ─── SMS ↔ Web session continuity ────────────────────────────────────────────

/**
 * When a verified authenticated user opens a web session with no active context,
 * look up their SMS session (by verified phone) and merge its logistics context
 * into the web session. Only logistics facts are merged — not conversation history.
 *
 * Security: only merges if the user's profile has phone_verified_at set (OTP verified).
 */
async function mergeSmsContinuityContext(userId: string, webSessionId: string): Promise<void> {
  const { supabaseAdmin } = await import('../lib/supabase');

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('phone, phone_verified_at')
    .eq('id', userId)
    .maybeSingle();

  if (!profile?.phone || !profile?.phone_verified_at) return;

  const phone        = profile.phone as string;
  const smsSessionId = `sms:${phone}`;

  const { data: smsRow } = await supabaseAdmin
    .from('benji_sessions')
    .select('context')
    .eq('session_id', smsSessionId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (!smsRow?.context) return;

  const sms = smsRow.context as Record<string, unknown>;
  const hasUsefulContext =
    sms['vehicle'] || sms['lastQuote'] || sms['draftShipmentId'] || sms['lastShipmentId'];

  if (!hasUsefulContext) return;

  const patch: Partial<V3LogisticsContext> = {};
  if (sms['vehicle'] != null)         patch.vehicle               = sms['vehicle']               as NonNullable<V3LogisticsContext['vehicle']>;
  if (sms['pickup'] != null)           patch.pickup                = sms['pickup']                as NonNullable<V3LogisticsContext['pickup']>;
  if (sms['delivery'] != null)         patch.delivery              = sms['delivery']              as NonNullable<V3LogisticsContext['delivery']>;
  if (sms['lastQuote'] != null)        patch.lastQuote             = sms['lastQuote']             as NonNullable<V3LogisticsContext['lastQuote']>;
  if (sms['draftShipmentId'])          patch.draftShipmentId       = sms['draftShipmentId']       as string;
  if (sms['lastShipmentId'])           patch.lastShipmentId        = sms['lastShipmentId']        as string;
  if (sms['transportType'])            patch.transportType         = sms['transportType']         as 'open' | 'enclosed';
  if (sms['termsAccepted'])            patch.termsAccepted         = sms['termsAccepted']         as boolean;
  if (sms['workflowState'])            patch.workflowState         = sms['workflowState']         as import('./benji.types').WorkflowState;
  if (sms['activePaymentIntentId'])    patch.activePaymentIntentId = sms['activePaymentIntentId'] as string;

  v3SessionStore.mergeContext(webSessionId, patch);
  logger.info('[BENJI] SMS context merged into web session', { userId, fieldsmerged: Object.keys(patch) });
}

// ─── Context extraction helpers ───────────────────────────────────────────────

/**
 * After tool execution, merge any newly learned logistics context into the session.
 * This prevents Benji from re-asking for details the user already gave.
 */
function extractContextFromToolOutput(
  toolName: string,
  toolData: unknown,
  session:  V3Session,
): void {
  if (typeof toolData !== 'object' || toolData === null) return;
  const d = toolData as Record<string, unknown>;

  switch (toolName) {
    case 'parse_shipment_details': {
      // toolData is ParsedShipmentData
      const vehicle  = d['vehicle']  as Record<string, unknown> | undefined;
      const pickup   = d['pickup']   as Record<string, unknown> | undefined;
      const delivery = d['delivery'] as Record<string, unknown> | undefined;

      const patch: Partial<V3LogisticsContext> = {};
      if (vehicle) {
        patch.vehicle = {
          ...(session.context.vehicle ?? {}),
          ...(typeof vehicle['year']  === 'number' ? { year:  vehicle['year']  as number } : {}),
          ...(typeof vehicle['make']  === 'string' ? { make:  vehicle['make']  as string } : {}),
          ...(typeof vehicle['model'] === 'string' ? { model: vehicle['model'] as string } : {}),
          ...(typeof vehicle['vin']   === 'string' ? { vin:   vehicle['vin']   as string } : {}),
        };
      }
      if (typeof pickup?.['location']   === 'string') patch.pickup   = { location: pickup['location'] };
      if (typeof delivery?.['location'] === 'string') patch.delivery = { location: delivery['location'] };

      v3SessionStore.mergeContext(session.sessionId, patch);
      break;
    }

    case 'get_shipping_quote': {
      const patch: Partial<V3LogisticsContext> = {};
      if (typeof d['total']         === 'number' &&
          typeof d['distanceMiles'] === 'number') {
        patch.lastQuote = {
          total:             d['total']          as number,
          distanceMiles:     d['distanceMiles']  as number,
          vehicleType:       typeof d['vehicleType']      === 'string' ? d['vehicleType']      as string : 'sedan',
          deliveryType:      typeof d['deliveryType']     === 'string' ? d['deliveryType']     as string : 'standard',
          deliveryMultiplier: typeof d['deliveryMultiplier'] === 'number' ? d['deliveryMultiplier'] as number : 1.0,
        };
      }
      if (typeof d['origin']      === 'string') patch.pickup   = { location: d['origin']      as string };
      if (typeof d['destination'] === 'string') patch.delivery = { location: d['destination'] as string };
      // Store vehicle info from quote so follow-up booking can use context
      if (typeof d['vehicle_make'] === 'string' || typeof d['vehicle_model'] === 'string') {
        const v: Partial<NonNullable<V3LogisticsContext['vehicle']>> = { ...(session.context.vehicle ?? {}) };
        if (typeof d['vehicle_make']  === 'string' && d['vehicle_make'])  v.make  = d['vehicle_make']  as string;
        if (typeof d['vehicle_model'] === 'string' && d['vehicle_model']) v.model = d['vehicle_model'] as string;
        if (typeof d['vehicle_year']  === 'number')                       v.year  = d['vehicle_year']  as number;
        patch.vehicle = v;
      }
      // Store dates and transport type from quote
      if (typeof d['pickupDate']    === 'string') {
        patch.pickup   = { ...(patch.pickup   ?? {}), date: d['pickupDate']    as string };
      }
      if (typeof d['deliveryDate']  === 'string') {
        patch.delivery = { ...(patch.delivery ?? {}), date: d['deliveryDate']  as string };
      }
      if (d['transportType'] === 'enclosed' || d['transportType'] === 'open') {
        patch.transportType = d['transportType'] as 'open' | 'enclosed';
      }
      v3SessionStore.mergeContext(session.sessionId, patch);
      break;
    }

    case 'create_shipment': {
      const shipmentId = d['shipment_id'] as string | undefined;
      if (shipmentId) {
        v3SessionStore.mergeContext(session.sessionId, {
          lastShipmentId:  shipmentId,
          draftShipmentId: shipmentId,
          shipmentCreated: true,
          workflowState:   'AWAITING_PAYMENT',
        });
      }
      break;
    }

    case 'track_shipment':
      // Store the looked-up shipment as the active one for follow-up turns
      if (d['id'] && typeof d['id'] === 'string') {
        v3SessionStore.mergeContext(session.sessionId, { activeShipmentId: d['id'] as string });
      }
      // Also pull vehicle and route into context if not already set
      {
        const patch: Partial<V3LogisticsContext> = {};
        if (!session.context.vehicle?.make || !session.context.vehicle?.model) {
          const v: Partial<V3LogisticsContext['vehicle']> = {};
          if (typeof d['vehicle_make']  === 'string') v.make  = d['vehicle_make']  as string;
          if (typeof d['vehicle_model'] === 'string') v.model = d['vehicle_model'] as string;
          if (typeof d['vehicle_year']  === 'number') v.year  = d['vehicle_year']  as number;
          if (Object.keys(v).length > 0) patch.vehicle = { ...session.context.vehicle, ...v };
        }
        if (typeof d['pickup_address']   === 'string' && !session.context.pickup?.location)
          patch.pickup   = { location: d['pickup_address']   as string };
        if (typeof d['delivery_address'] === 'string' && !session.context.delivery?.location)
          patch.delivery = { location: d['delivery_address'] as string };
        if (Object.keys(patch).length > 0) v3SessionStore.mergeContext(session.sessionId, patch);
      }
      break;

    case 'list_shipments': {
      // If only one result came back, treat it as the active shipment
      const rows = Array.isArray(d) ? d as Record<string, unknown>[] : null;
      if (rows && rows.length === 1 && typeof rows[0]?.['id'] === 'string') {
        v3SessionStore.mergeContext(session.sessionId, { activeShipmentId: rows[0]['id'] as string });
      }
      break;
    }

    case 'initiate_payment': {
      const paymentIntentId = d['payment_intent_id'] as string | undefined;
      if (paymentIntentId) {
        v3SessionStore.mergeContext(session.sessionId, {
          paymentInitiated:       true,
          activePaymentIntentId:  paymentIntentId,
          workflowState:          'AWAITING_PAYMENT',
        });
      }
      break;
    }

    case 'get_messages':
    case 'send_message': {
      // Keep the shipment_id in context so follow-up messages don't re-ask
      const sid = d['shipment_id'] ?? (Array.isArray(d) ? (d[0] as Record<string, unknown>)?.['shipment_id'] : undefined);
      if (typeof sid === 'string') {
        v3SessionStore.mergeContext(session.sessionId, { activeShipmentId: sid });
      }
      break;
    }

    case 'update_shipment_status': {
      // Store the updated shipment as the active one
      const sid = d['id'];
      if (typeof sid === 'string') {
        v3SessionStore.mergeContext(session.sessionId, { activeShipmentId: sid });
      }
      break;
    }

    case 'apply_for_shipment': {
      // execApplyForShipment includes shipment_id in the returned data
      const sid = d['shipment_id'];
      if (typeof sid === 'string') {
        v3SessionStore.mergeContext(session.sessionId, { activeShipmentId: sid });
      }
      break;
    }

    case 'cancel_shipment': {
      // Store the cancelled shipment ID for follow-up context
      const sid = d['id'];
      if (typeof sid === 'string') {
        v3SessionStore.mergeContext(session.sessionId, { activeShipmentId: sid });
      }
      break;
    }

    case 'assign_driver':
    case 'get_payment_info':
    case 'list_driver_applications':
    case 'list_users':
    case 'get_profile':
      // No additional context mutation needed for these tools
      break;

    case 'get_terms': {
      // User received T&C — mark as presented (actual acceptance confirmed by conversation)
      break;
    }

    case 'initiate_payment': {
      // Mark payment as initiated in session context
      if (d['shipment_id'] && typeof d['shipment_id'] === 'string') {
        v3SessionStore.mergeContext(session.sessionId, {
          activeShipmentId: d['shipment_id'] as string,
          paymentInitiated: true,
        });
      }
      break;
    }

    case 'get_shipment_detail': {
      // Extract from the nested 'shipment' object in returned data
      const shipment = d['shipment'] as Record<string, unknown> | undefined;
      if (shipment && typeof shipment['id'] === 'string') {
        const patch: Partial<V3LogisticsContext> = { activeShipmentId: shipment['id'] as string };
        // Update vehicle if not already in context
        if (!session.context.vehicle?.make) {
          const v: Partial<NonNullable<V3LogisticsContext['vehicle']>> = {};
          if (typeof shipment['vehicle_make']  === 'string') v.make  = shipment['vehicle_make']  as string;
          if (typeof shipment['vehicle_model'] === 'string') v.model = shipment['vehicle_model'] as string;
          if (typeof shipment['vehicle_year']  === 'number') v.year  = shipment['vehicle_year']  as number;
          if (Object.keys(v).length > 0) patch.vehicle = v;
        }
        v3SessionStore.mergeContext(session.sessionId, patch);
      }
      break;
    }

    case 'withdraw_application':
    case 'get_driver_info':
    case 'process_document':
      // No context mutation needed
      break;
  }
}

// ─── BenjiV3Service ───────────────────────────────────────────────────────────

class BenjiV3Service {
  /**
   * Process one user turn in the V3 agentic loop.
   * Never throws — all errors are returned as a conversational response.
   */
  async chat(req: V3ChatRequest): Promise<V3ChatResponse> {
    const startTime = Date.now();
    const toolsUsed: string[] = [];
    const audit     = createAuditEvent({ sessionId: req.sessionId, userId: req.userId, userType: req.userType, streaming: false });
    let totalPromptTokens     = 0;
    let totalCompletionTokens = 0;

    try {
      console.log('[BENJI_V3_REQUEST]', {
        sessionId: req.sessionId,
        userId:    req.userId,
        userType:  req.userType,
        msgLen:    req.message.length,
        ts:        new Date().toISOString(),
      });

      // ── 1. Session ─────────────────────────────────────────────────────
      const session = await v3SessionStore.getOrCreate(req.sessionId, req.userId, req.userType);

      // ── 1b. SMS ↔ Web continuity ───────────────────────────────────────
      // If this is a web/mobile session and the user has no active context,
      // check if they have a verified phone with an active SMS session.
      // Only merge logistics context (not conversation history) — privacy-safe.
      if (
        req.userType === 'client' &&
        session.channel !== 'sms' &&
        !session.context.workflowState &&
        !session.context.lastShipmentId
      ) {
        try {
          await mergeSmsContinuityContext(req.userId, session.sessionId);
        } catch {
          // Non-fatal — web session continues normally if SMS lookup fails
        }
      }

      // ── 1c. Sticky logistics intent ────────────────────────────────────
      // Once logistics keywords are detected, set a persistent flag.
      // This prevents tool dropout during multi-turn information gathering.
      if (!session.context.logisticsIntentActive && LOGISTICS_KEYWORDS.test(req.message)) {
        v3SessionStore.mergeContext(session.sessionId, { logisticsIntentActive: true });
      }

      // ── 2. System prompt with injected context ─────────────────────────
      const systemPrompt = buildV3SystemPrompt(req.userType, session.context);

      // ── 3. Append user message ─────────────────────────────────────────
      // Build user message — support multimodal (text + image_url) if images provided
      let userMsg: OpenAI.Chat.Completions.ChatCompletionUserMessageParam;
      if (req.images && req.images.length > 0) {
        // Multimodal message: text + images
        const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
          { type: 'text', text: req.message },
          ...req.images.map(img => ({
            type: 'image_url' as const,
            image_url: { url: img.url, detail: img.detail ?? 'auto' },
          })),
        ];
        userMsg = { role: 'user', content };
      } else {
        userMsg = { role: 'user', content: req.message };
      }
      session.messages.push(userMsg);

      // ── 4. Agentic loop ────────────────────────────────────────────────
      // Limit context window to last CTX_WINDOW messages (performance + cost)
      const recentMessages = session.messages.slice(-CTX_WINDOW);

      // Build the messages array for the API call (system + history)
      const apiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...recentMessages,
      ];

      // Fast-path: if message is pure conversation (no logistics keywords, no active context),
      // skip tool definitions entirely → saves ~200 tokens + routing overhead
      const fastPath    = isConversationalOnly(req.message, session.context);
      const roleTools   = getToolsForRole(req.userType);

      let finalResponse = '';
      let loopCount     = 0;
      // Use stronger model only when we already have tool calls in-flight
      let useStrongModel = false;

      while (loopCount < MAX_LOOP) {
        loopCount++;

        const completion = await openaiClient.chat.completions.create({
          model:       useStrongModel ? MODEL_WITH_TOOLS : MODEL,
          messages:    apiMessages,
          tools:       fastPath ? [] : roleTools,
          tool_choice: fastPath ? 'none' : ('auto' as const),
          max_tokens:  fastPath && !useStrongModel ? MAX_TOKENS_FAST : MAX_TOKENS,
          temperature: TEMPERATURE,
        });

        // Track token usage
        if (completion.usage) {
          totalPromptTokens     += completion.usage.prompt_tokens;
          totalCompletionTokens += completion.usage.completion_tokens;
        }
        audit.model = useStrongModel ? MODEL_WITH_TOOLS : MODEL;

        const choice = completion.choices[0];
        if (!choice) break;

        // ── Tool calls ───────────────────────────────────────────────────
        if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
          useStrongModel = true; // Subsequent passes use the stronger model

          // Append the assistant message with tool_calls to history
          apiMessages.push(choice.message);

          for (const rawToolCall of choice.message.tool_calls) {
            // Cast to the concrete type — OpenAI SDK union includes a 'custom' variant
            const toolCall = rawToolCall as { id: string; function: { name: string; arguments: string } };
            const toolName = toolCall.function.name;
            toolsUsed.push(toolName);

            console.log('[BENJI_V3_TOOL]', {
              sessionId: req.sessionId,
              tool:      toolName,
              args:      toolCall.function.arguments.slice(0, 200),
              ts:        new Date().toISOString(),
            });

            const result = await executeV3Tool(
              toolName,
              toolCall.function.arguments,
              req.userId,
              req.userType,
              {
                context:      session.context,
                mergeContext: (patch) => v3SessionStore.mergeContext(session.sessionId, patch),
              },
            );

            // Extract context updates from successful tool results
            if (result.success) {
              extractContextFromToolOutput(toolName, result.data, session);
            }

            // Build the tool result message
            const toolResultContent = result.success
              ? JSON.stringify({ success: true, summary: result.summary, data: result.data })
              : JSON.stringify({ success: false, error: result.errorMessage });

            apiMessages.push({
              role:         'tool',
              tool_call_id: toolCall.id,
              content:      toolResultContent,
            } as OpenAI.Chat.Completions.ChatCompletionToolMessageParam);
          }

          // Loop back — LLM sees tool results and generates final response
          continue;
        }

        // ── Final text response ──────────────────────────────────────────
        if (choice.finish_reason === 'stop' || choice.finish_reason === 'length') {
          finalResponse = choice.message.content ?? '';
          // Append assistant response to history
          session.messages.push({ role: 'assistant', content: finalResponse });
          break;
        }

        // Unexpected finish_reason — break to avoid infinite loop
        logger.warn('BenjiV3Service: unexpected finish_reason', {
          reason:    choice.finish_reason,
          sessionId: req.sessionId,
          loop:      loopCount,
        });
        break;
      }

      if (!finalResponse) {
        finalResponse = "I'm sorry, I couldn't generate a response. Please try again.";
        session.messages.push({ role: 'assistant', content: finalResponse });
      }

      // ── 5. Save session ────────────────────────────────────────────────
      await v3SessionStore.save(session);

      const latencyMs = Date.now() - startTime;

      console.log('[BENJI_V3_RESPONSE]', {
        sessionId: req.sessionId,
        latencyMs,
        toolsUsed,
        loops:     loopCount,
        ts:        new Date().toISOString(),
      });

      // ── Emit production audit ──────────────────────────────────────────
      audit.latencyMs          = latencyMs;
      audit.toolsUsed          = toolsUsed;
      audit.promptTokens       = totalPromptTokens;
      audit.completionTokens   = totalCompletionTokens;
      audit.totalTokens        = totalPromptTokens + totalCompletionTokens;
      audit.loopCount          = loopCount;
      audit.responseStatus     = 'success';
      audit.ts                 = new Date().toISOString();
      logV3Audit(audit);

      return {
        response:  finalResponse,
        sessionId: session.sessionId,
        toolsUsed,
        latencyMs,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const latencyMs = Date.now() - startTime;

      console.error('[BENJI_V3_ERROR]', {
        sessionId: req.sessionId,
        userId:    req.userId,
        error:     msg,
        latencyMs,
        ts:        new Date().toISOString(),
      });

      logger.warn('BenjiV3Service.chat: unhandled error', {
        sessionId: req.userId,
        userId:    req.userId,
        error:     msg,
      });

      // ── Emit failure audit ─────────────────────────────────────────────
      audit.latencyMs      = latencyMs;
      audit.toolsUsed      = toolsUsed;
      audit.responseStatus = 'error';
      audit.failureReason  = msg;
      audit.ts             = new Date().toISOString();
      logV3Audit(audit);

      return {
        response:  "I ran into an issue on my end. Could you try again? If it keeps happening, contact DriveDrop support.",
        sessionId: req.sessionId,
        toolsUsed,
        latencyMs,
      };
    }
  }

  // ─── Streaming chat ──────────────────────────────────────────────────────────

  /**
   * Stream the final LLM response token-by-token via SSE.
   *
   * SSE event types:
   *   {"type":"start","sessionId":"..."}
   *   {"type":"tool","name":"get_shipping_quote"}   (one per tool called)
   *   {"type":"token","content":"Hello"}            (streamed text tokens)
   *   {"type":"end","sessionId":"...","toolsUsed":[],"latencyMs":1200}
   *   {"type":"error","message":"..."}              (on failure)
   *
   * Tool calls in the agentic loop run synchronously before streaming begins.
   * Only the final LLM text response is streamed.
   */
  async chatStream(req: V3ChatRequest, res: Response): Promise<void> {
    const startTime = Date.now();
    const toolsUsed: string[] = [];

    // ── SSE headers ────────────────────────────────────────────────────────
    res.set({
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',   // Disable nginx buffering
    });
    res.flushHeaders();

    const send = (data: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const sendDone = () => {
      res.write('data: [DONE]\n\n');
      res.end();
    };

    try {
      console.log('[BENJI_V3_STREAM_REQUEST]', {
        sessionId: req.sessionId, userId: req.userId, userType: req.userType,
        msgLen: req.message.length, ts: new Date().toISOString(),
      });

      send({ type: 'start', sessionId: req.sessionId });

      // ── Session + prompt ───────────────────────────────────────────────
      const session      = await v3SessionStore.getOrCreate(req.sessionId, req.userId, req.userType);
      // SMS ↔ Web continuity (same logic as non-streaming path)
      if (req.userType === 'client' && session.channel !== 'sms' && !session.context.workflowState && !session.context.lastShipmentId) {
        try { await mergeSmsContinuityContext(req.userId, session.sessionId); } catch { /* non-fatal */ }
      }
      // Sticky logistics intent (same logic as non-streaming path)
      if (!session.context.logisticsIntentActive && LOGISTICS_KEYWORDS.test(req.message)) {
        v3SessionStore.mergeContext(session.sessionId, { logisticsIntentActive: true });
      }
      const systemPrompt = buildV3SystemPrompt(req.userType, session.context);
      // Support multimodal in streaming path
      if (req.images && req.images.length > 0) {
        const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
          { type: 'text', text: req.message },
          ...req.images.map(img => ({
            type: 'image_url' as const,
            image_url: { url: img.url, detail: img.detail ?? 'auto' },
          })),
        ];
        session.messages.push({ role: 'user', content } as OpenAI.Chat.Completions.ChatCompletionUserMessageParam);
      } else {
        session.messages.push({ role: 'user', content: req.message } as OpenAI.Chat.Completions.ChatCompletionUserMessageParam);
      }

      const recentMessages = session.messages.slice(-CTX_WINDOW);
      const fastPath       = isConversationalOnly(req.message, session.context);

      const apiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...recentMessages,
      ];

      // ── Agentic loop (non-streaming) for tool calls ────────────────────
      let useStrongModel = false;
      let loopCount      = 0;

      while (loopCount < MAX_LOOP) {
        loopCount++;

        // Non-streaming for tool resolution; switch to streaming only for final response
        const completion = await openaiClient.chat.completions.create({
          model:       useStrongModel ? MODEL_WITH_TOOLS : MODEL,
          messages:    apiMessages,
          tools:       fastPath ? [] : getToolsForRole(req.userType),
          tool_choice: fastPath ? 'none' : ('auto' as const),
          max_tokens:  fastPath && !useStrongModel ? MAX_TOKENS_FAST : MAX_TOKENS,
          temperature: TEMPERATURE,
          stream:      false,
        });

        const choice = completion.choices[0];
        if (!choice) break;

        if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
          useStrongModel = true;
          apiMessages.push(choice.message);

          for (const rawToolCall of choice.message.tool_calls) {
            const toolCall = rawToolCall as { id: string; function: { name: string; arguments: string } };
            const toolName = toolCall.function.name;
            toolsUsed.push(toolName);

            // Notify frontend that a tool is running
            send({ type: 'tool', name: toolName });

            console.log('[BENJI_V3_TOOL]', { sessionId: req.sessionId, tool: toolName });
            const result = await executeV3Tool(
              toolName,
              toolCall.function.arguments,
              req.userId,
              req.userType,
              {
                context:      session.context,
                mergeContext: (patch) => v3SessionStore.mergeContext(session.sessionId, patch),
              },
            );

            if (result.success) {
              extractContextFromToolOutput(toolName, result.data, session);
            }

            apiMessages.push({
              role:         'tool',
              tool_call_id: toolCall.id,
              content:      result.success
                ? JSON.stringify({ success: true, summary: result.summary, data: result.data })
                : JSON.stringify({ success: false, error: result.errorMessage }),
            } as OpenAI.Chat.Completions.ChatCompletionToolMessageParam);
          }
          continue;
        }

        // ── Final response — reuse the already-generated content ────────
        if (choice.finish_reason === 'stop' || choice.finish_reason === 'length') {
          const content = choice.message.content ?? '';

          // Emit what the non-streaming call already produced — this eliminates
          // a redundant second API round-trip and guarantees the streamed text
          // is identical to what the model computed with full tool context.
          if (content) send({ type: 'token', content });

          // Save to session history
          session.messages.push({ role: 'assistant', content });
          await v3SessionStore.save(session);

          const latencyMs = Date.now() - startTime;
          console.log('[BENJI_V3_STREAM_RESPONSE]', {
            sessionId: req.sessionId, latencyMs, toolsUsed, loops: loopCount,
          });

          send({ type: 'end', sessionId: req.sessionId, toolsUsed, latencyMs });
          sendDone();
          return;
        }

        break; // unexpected finish_reason
      }

      // Fallback — shouldn't reach here
      send({ type: 'token', content: "I couldn't generate a response. Please try again." });
      send({ type: 'end', sessionId: req.sessionId, toolsUsed, latencyMs: Date.now() - startTime });
      sendDone();

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const latencyMs = Date.now() - startTime;
      console.error('[BENJI_V3_STREAM_ERROR]', { sessionId: req.sessionId, error: msg, latencyMs });

      try {
        send({ type: 'error', message: "I ran into a problem. Please try again." });
        send({ type: 'end', sessionId: req.sessionId, toolsUsed, latencyMs });
        sendDone();
      } catch {
        res.end();
      }
    }
  }
}

/** Singleton. */
export const benjiV3Service = new BenjiV3Service();
