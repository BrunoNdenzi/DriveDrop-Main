-- Migration: 20260702120000_benji_events_and_ai_usage.sql
-- Phase: 4 / 4.5D
-- Depends on:
--   - none (standalone Benji V2 event tables)
-- Safe Re-run: Yes

-- ─────────────────────────────────────────────────────────────────────────────
-- benji_events
-- Records every tool lifecycle event (tool_completed / tool_failed) plus
-- safety-critical domain events (payment_authorized, policy_violation, etc.)
-- using the BenjiEventEnvelope format (schemaVersion=1, idempotent on event_id).
--
-- Columns added in Phase 4.5D to support envelope format:
--   event_id        UUID  — globally unique per event (BenjiEventEnvelope.eventId)
--   trace_id        TEXT  — links event to orchestrator trace (I-14)
--   schema_version  INT   — envelope schema version (default 1)
--
-- event_id is the idempotency key — upserts use ON CONFLICT (event_id).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.benji_events (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id       UUID        NOT NULL,
  trace_id       TEXT,
  schema_version INTEGER     NOT NULL DEFAULT 1,
  event_type     TEXT        NOT NULL,
  tool_name      TEXT,
  request_id     TEXT        NOT NULL,
  step_id        TEXT,
  duration_ms    INTEGER,
  success        BOOLEAN,
  user_id        UUID,
  error_code     TEXT,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT benji_events_event_id_unique UNIQUE (event_id)
);

-- Index for trace-level queries (simulation engine failure-rate cache)
CREATE INDEX IF NOT EXISTS benji_events_trace_id_idx
  ON public.benji_events (trace_id);

-- Index for time-windowed monitoring queries
CREATE INDEX IF NOT EXISTS benji_events_occurred_at_idx
  ON public.benji_events (occurred_at);

-- Index for per-tool failure rate queries (monitoring service)
CREATE INDEX IF NOT EXISTS benji_events_tool_name_success_idx
  ON public.benji_events (tool_name, success);

-- RLS: service role bypasses; anon/authenticated never see these rows
ALTER TABLE public.benji_events ENABLE ROW LEVEL SECURITY;

-- No public policies — access is exclusively through service role (supabaseAdmin)

-- ─────────────────────────────────────────────────────────────────────────────
-- ai_usage_logs
-- Token usage + cost attribution for every LLM call.
-- Written by BenjiEventService.onTokenUsage() (fire-and-forget).
-- Used for cost monitoring and rate-limiting analytics.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name        TEXT        NOT NULL,
  model               TEXT        NOT NULL,
  prompt_tokens       INTEGER     NOT NULL,
  completion_tokens   INTEGER     NOT NULL,
  total_tokens        INTEGER     NOT NULL,
  estimated_cost_usd  NUMERIC(10,6),
  duration_ms         INTEGER,
  user_id             UUID,
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user-level cost attribution
CREATE INDEX IF NOT EXISTS ai_usage_logs_user_id_idx
  ON public.ai_usage_logs (user_id);

-- Index for time-windowed cost reports
CREATE INDEX IF NOT EXISTS ai_usage_logs_occurred_at_idx
  ON public.ai_usage_logs (occurred_at);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
-- No public policies — service role access only
