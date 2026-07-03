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
import type {
  V3ChatRequest,
  V3ChatResponse,
  V3Session,
  V3LogisticsContext,
} from './benji.types';
import type OpenAI from 'openai';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL           = 'gpt-4o-mini';  // Fast, cheap, great for conversational AI
const MODEL_WITH_TOOLS = 'gpt-4o';      // Stronger reasoning when tools are invoked
const MAX_LOOP        = 5;              // Prevent runaway tool chains
const MAX_TOKENS      = 1024;
const TEMPERATURE     = 0.65;

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
          total:        d['total']        as number,
          distanceMiles: d['distanceMiles'] as number,
          vehicleType:   typeof d['vehicleType'] === 'string' ? d['vehicleType'] as string : 'sedan',
        };
      }
      if (typeof d['origin']      === 'string') patch.pickup   = { location: d['origin']      as string };
      if (typeof d['destination'] === 'string') patch.delivery = { location: d['destination'] as string };
      v3SessionStore.mergeContext(session.sessionId, patch);
      break;
    }

    case 'create_shipment': {
      const shipmentId = d['shipment_id'] as string | undefined;
      if (shipmentId) {
        v3SessionStore.mergeContext(session.sessionId, {
          lastShipmentId: shipmentId,
          shipmentCreated: true,
        });
      }
      break;
    }

    case 'track_shipment':
      // No context mutation for tracking
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

    try {
      console.log('[BENJI_V3_REQUEST]', {
        sessionId: req.sessionId,
        userId:    req.userId,
        userType:  req.userType,
        msgLen:    req.message.length,
        ts:        new Date().toISOString(),
      });

      // ── 1. Session ─────────────────────────────────────────────────────
      const session = v3SessionStore.getOrCreate(req.sessionId, req.userId, req.userType);

      // ── 2. System prompt with injected context ─────────────────────────
      const systemPrompt = buildV3SystemPrompt(req.userType, session.context);

      // ── 3. Append user message ─────────────────────────────────────────
      const userMsg: OpenAI.Chat.Completions.ChatCompletionUserMessageParam = {
        role:    'user',
        content: req.message,
      };
      session.messages.push(userMsg);

      // ── 4. Agentic loop ────────────────────────────────────────────────
      // Build the messages array for the API call (system + history)
      const apiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...session.messages,
      ];

      let finalResponse = '';
      let loopCount     = 0;
      // Use stronger model only when we already have tool calls in-flight
      let useStrongModel = false;

      while (loopCount < MAX_LOOP) {
        loopCount++;

        const completion = await openaiClient.chat.completions.create({
          model:       useStrongModel ? MODEL_WITH_TOOLS : MODEL,
          messages:    apiMessages,
          tools:       V3_TOOL_DEFINITIONS,
          tool_choice: 'auto',
          max_tokens:  MAX_TOKENS,
          temperature: TEMPERATURE,
        });

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

            const result = await executeV3Tool(toolName, toolCall.function.arguments, req.userId);

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
      v3SessionStore.save(session);

      const latencyMs = Date.now() - startTime;

      console.log('[BENJI_V3_RESPONSE]', {
        sessionId: req.sessionId,
        latencyMs,
        toolsUsed,
        loops:     loopCount,
        ts:        new Date().toISOString(),
      });

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
        sessionId: req.sessionId,
        userId:    req.userId,
        error:     msg,
      });

      return {
        response:  "I ran into an issue on my end. Could you try again? If it keeps happening, contact DriveDrop support.",
        sessionId: req.sessionId,
        toolsUsed,
        latencyMs,
      };
    }
  }
}

/** Singleton. */
export const benjiV3Service = new BenjiV3Service();
