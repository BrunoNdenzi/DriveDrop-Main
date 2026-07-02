-- Migration: 20260702120100_benji_policy_violations.sql
-- Phase: 5A (GlobalPolicyGuard)
-- Depends on:
--   - 20260702120000_benji_events_and_ai_usage.sql
-- Safe Re-run: Yes

-- ─────────────────────────────────────────────────────────────────────────────
-- policy_violations
-- Immutable audit log of every Benji policy rule breach.
-- Written by GlobalPolicyGuard._logViolation() (fire-and-forget upsert).
-- Idempotent on (request_id, rule_id, checkpoint) — the same breach cannot
-- be double-logged within a single orchestrator run.
--
-- Rows are never deleted (audit trail).
-- Monitoring queries via benjiMonitoringService.getPolicyViolationCounts().
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.policy_violations (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id     TEXT        NOT NULL,
  checkpoint  TEXT        NOT NULL,
  request_id  TEXT        NOT NULL,
  user_id     UUID,
  reason      TEXT,
  evidence    TEXT,
  severity    TEXT        NOT NULL CHECK (severity IN ('block', 'warn')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT policy_violations_request_rule_checkpoint_unique
    UNIQUE (request_id, rule_id, checkpoint)
);

-- Index for per-rule counts (monitoring service)
CREATE INDEX IF NOT EXISTS policy_violations_rule_id_idx
  ON public.policy_violations (rule_id);

-- Index for per-user audits
CREATE INDEX IF NOT EXISTS policy_violations_user_id_idx
  ON public.policy_violations (user_id);

-- Index for time-windowed monitoring queries
CREATE INDEX IF NOT EXISTS policy_violations_created_at_idx
  ON public.policy_violations (created_at);

ALTER TABLE public.policy_violations ENABLE ROW LEVEL SECURITY;
-- No public policies — service role access only
