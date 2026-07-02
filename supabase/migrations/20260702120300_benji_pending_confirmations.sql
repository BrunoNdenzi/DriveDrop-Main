-- Migration: 20260702120300_benji_pending_confirmations.sql
-- Phase: 6C / 6.1 hardening
-- Depends on:
--   - 20260702120200_benji_traces.sql
-- Safe Re-run: Yes

-- ─────────────────────────────────────────────────────────────────────────────
-- benji_pending_confirmations
-- Persists suspended orchestrator plans awaiting user confirmation.
-- Created by benjiOrchestrator when SimulationEngine returns gate='confirm'
-- (risk score 0.70–0.85). Consumed atomically by resumeOrchestrator.
--
-- Phase 6.1 design:
--   - plan stored as JSONB (not serialized TEXT) — safe round-trip, no JSON.parse risk
--   - schema_version enables future backward-compatible format migration
--   - consume() uses DELETE...RETURNING for atomic single-use guarantee
--     (concurrent confirm requests: only one wins the DELETE, other gets null)
--   - TTL enforced by expires_at; cleanup job prunes expired rows every 15 min
--
-- trace_id is TEXT (not UUID) to match the orchestrator request ID string format.
-- user_id is the security check in consume() — prevents cross-user plan hijacking.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.benji_pending_confirmations (
  trace_id          TEXT        NOT NULL PRIMARY KEY,
  user_id           UUID        NOT NULL,
  plan              JSONB       NOT NULL,
  simulation_result JSONB       NOT NULL,
  schema_version    INTEGER     NOT NULL DEFAULT 1,
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for per-user pending plan lookup
CREATE INDEX IF NOT EXISTS benji_pending_confirmations_user_id_idx
  ON public.benji_pending_confirmations (user_id);

-- Index for cleanup job (DELETE WHERE expires_at < NOW())
CREATE INDEX IF NOT EXISTS benji_pending_confirmations_expires_at_idx
  ON public.benji_pending_confirmations (expires_at);

ALTER TABLE public.benji_pending_confirmations ENABLE ROW LEVEL SECURITY;
-- No public policies — service role access only (consume is DELETE...RETURNING via supabaseAdmin)
