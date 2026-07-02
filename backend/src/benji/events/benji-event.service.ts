/**
 * Benji V2 — BenjiEventService
 * Phase 4 / Phase 4.5
 *
 * Persists benji system events to Supabase using BenjiEventEnvelope (I-14).
 * Registered as:
 *   1. ToolEventHook on benjiToolRegistry (fires for every mutation tool — I-8)
 *   2. TokenUsageHook on openai.client.ts (fires for every LLM call — cost attribution)
 *
 * Idempotency (4.5D): all inserts upsert on `event_id` so retries are safe.
 *
 * Event durability (4.5B):
 *   - Tool events ('tool_completed', 'tool_failed') are 'async' per EVENT_DURABILITY.
 *     Persistence failures are logged; the caller is not blocked.
 *   - Safety-critical domain events ('await' durability) are persisted synchronously
 *     by the orchestrator via emit(), not through the hook system.
 *
 * Required schema:
 * ─────────────────────────────────────────────────────────────────
 *   -- Existing columns (Phase 4) plus new columns (Phase 4.5D):
 *   ALTER TABLE benji_events ADD COLUMN IF NOT EXISTS event_id uuid;
 *   UPDATE benji_events SET event_id = gen_random_uuid() WHERE event_id IS NULL;
 *   ALTER TABLE benji_events ALTER COLUMN event_id SET NOT NULL;
 *   ALTER TABLE benji_events ADD CONSTRAINT benji_events_event_id_unique UNIQUE (event_id);
 *   ALTER TABLE benji_events ADD COLUMN IF NOT EXISTS trace_id text;
 *   ALTER TABLE benji_events ADD COLUMN IF NOT EXISTS schema_version integer DEFAULT 1;
 *
 *   CREATE TABLE IF NOT EXISTS ai_usage_logs (
 *     id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
 *     service_name       TEXT        NOT NULL,
 *     model              TEXT        NOT NULL,
 *     prompt_tokens      INTEGER     NOT NULL,
 *     completion_tokens  INTEGER     NOT NULL,
 *     total_tokens       INTEGER     NOT NULL,
 *     estimated_cost_usd NUMERIC(10,6),
 *     duration_ms        INTEGER,
 *     user_id            UUID,
 *     occurred_at        TIMESTAMPTZ DEFAULT NOW()
 *   );
 * ─────────────────────────────────────────────────────────────────
 */

import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';
import { createEnvelope } from '@benji/core/events/event.types';
import type { ToolEventPayload } from '@benji/tool/tool.registry';
import type { TokenUsageEvent } from '@benji/ai/client/openai.client';

const BENJI_EVENTS_TABLE  = 'benji_events';
const AI_USAGE_LOGS_TABLE = 'ai_usage_logs';

// ─── Service ──────────────────────────────────────────────────────────────────

export class BenjiEventService {
  /**
   * Persist a tool lifecycle event to benji_events using envelope format.
   * Implements ToolEventHook — registered via events/index.ts.
   * Upserts on event_id for idempotency (4.5D).
   */
  async onToolEvent(event: ToolEventPayload): Promise<void> {
    try {
      await this._persistToolEvent(event);
    } catch (err: unknown) {
      logger.warn('BenjiEventService.onToolEvent: persistence failed', {
        toolName:  event.toolName,
        eventType: event.eventType,
        requestId: event.requestId,
        error:     err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Persist a token usage record to ai_usage_logs.
   * Implements TokenUsageHook — must be sync (return void) per the hook contract.
   * DB write is fire-and-forget internally.
   */
  onTokenUsage(event: TokenUsageEvent): void {
    void this._persistTokenUsage(event).catch((err: unknown) => {
      logger.warn('BenjiEventService.onTokenUsage: persistence failed', {
        serviceName: event.serviceName,
        model:       event.model,
        error:       err instanceof Error ? err.message : String(err),
      });
    });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async _persistToolEvent(event: ToolEventPayload): Promise<void> {
    const envelope = createEnvelope(event.eventType, event, event.traceId, event.stepId);

    const { error } = await supabaseAdmin
      .from(BENJI_EVENTS_TABLE)
      .upsert({
        event_id:       envelope.eventId,
        trace_id:       envelope.traceId,
        schema_version: envelope.schemaVersion,
        event_type:     event.eventType,
        tool_name:      event.toolName,
        request_id:     event.requestId,
        step_id:        event.stepId,
        duration_ms:    event.durationMs,
        success:        event.success,
        occurred_at:    envelope.timestamp,
        ...(event.userId    !== undefined ? { user_id:    event.userId    } : {}),
        ...(event.errorCode !== undefined ? { error_code: event.errorCode } : {}),
      }, { onConflict: 'event_id', ignoreDuplicates: true });

    if (error) {
      throw new Error(String(error));
    }
  }

  private async _persistTokenUsage(event: TokenUsageEvent): Promise<void> {
    const { error } = await supabaseAdmin
      .from(AI_USAGE_LOGS_TABLE)
      .insert({
        service_name:       event.serviceName,
        model:              event.model,
        prompt_tokens:      event.promptTokens,
        completion_tokens:  event.completionTokens,
        total_tokens:       event.totalTokens,
        estimated_cost_usd: event.estimatedCostUsd,
        duration_ms:        event.durationMs,
        occurred_at:        new Date().toISOString(),
        ...(event.userId !== undefined ? { user_id: event.userId } : {}),
      });

    if (error) {
      throw new Error(String(error));
    }
  }
}
