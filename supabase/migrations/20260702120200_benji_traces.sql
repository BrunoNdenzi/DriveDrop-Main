-- Migration: 20260702120200_benji_traces.sql
-- Phase: 5C (BenjiTraceService)
-- Depends on:
--   - 20260702120100_benji_policy_violations.sql
-- Safe Re-run: Yes

-- ─────────────────────────────────────────────────────────────────────────────
-- benji_traces
-- One row per orchestrator run. Captures intent, safety state progression,
-- and final outcome. Used by BenjiTraceService and for I-14 replay validation.
--
-- final_outcome values (set by orchestrator finalize()):
--   'success'                 — COMPLETE, all steps executed
--   'blocked'                 — BLOCKED by policy or simulation
--   'simulation_blocked'      — SimulationEngine gate='block'
--   'awaiting_confirmation'   — halted at AWAIT_CONFIRMATION
--   'resumed_success'         — resumed after confirmation, COMPLETE
--   'error'                   — unhandled exception
--   'validation_error'        — bad request (400)
--   'clarification_loop'      — returned CLARIFICATION_LOOP to client
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.benji_traces (
  trace_id      UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        NOT NULL,
  request_id    TEXT        NOT NULL,
  intent        TEXT,
  state         TEXT        NOT NULL DEFAULT 'IDLE',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  final_outcome TEXT,
  step_count    INTEGER     NOT NULL DEFAULT 0
);

-- Index for per-user trace history
CREATE INDEX IF NOT EXISTS benji_traces_user_id_idx
  ON public.benji_traces (user_id);

-- Index for time-windowed latency / volume queries
CREATE INDEX IF NOT EXISTS benji_traces_started_at_idx
  ON public.benji_traces (started_at);

-- Index for outcome-based filtering (monitoring service)
CREATE INDEX IF NOT EXISTS benji_traces_final_outcome_idx
  ON public.benji_traces (final_outcome);

ALTER TABLE public.benji_traces ENABLE ROW LEVEL SECURITY;
-- No public policies — service role access only

-- ─────────────────────────────────────────────────────────────────────────────
-- benji_trace_steps
-- One row per tool execution within a trace.
-- Input/output SHA-256 hashes enable I-14 replay determinism validation.
-- policy_decision stores the PolicyGuardResult JSONB for the step.
-- Upserted on (trace_id, step_id) — safe to retry.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.benji_trace_steps (
  step_id         TEXT        NOT NULL,
  trace_id        UUID        NOT NULL REFERENCES public.benji_traces (trace_id) ON DELETE CASCADE,
  tool_name       TEXT,
  input_hash      TEXT,
  output_hash     TEXT,
  policy_decision JSONB,
  success         BOOLEAN,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT benji_trace_steps_pkey PRIMARY KEY (trace_id, step_id)
);

-- Index for chronological step replay
CREATE INDEX IF NOT EXISTS benji_trace_steps_trace_id_timestamp_idx
  ON public.benji_trace_steps (trace_id, timestamp);

ALTER TABLE public.benji_trace_steps ENABLE ROW LEVEL SECURITY;
-- No public policies — service role access only
