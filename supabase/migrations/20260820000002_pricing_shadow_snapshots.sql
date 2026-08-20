-- Persist the evidence needed to evaluate shadow pricing recommendations.

ALTER TABLE quote_history
  ADD COLUMN IF NOT EXISTS intelligence_mode TEXT NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS feature_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS intelligence_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS recommendation_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS source_health_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS intelligence_generated_at TIMESTAMPTZ;

ALTER TABLE quote_history
  DROP CONSTRAINT IF EXISTS quote_history_intelligence_mode_check,
  ADD CONSTRAINT quote_history_intelligence_mode_check
    CHECK (intelligence_mode IN ('off', 'shadow', 'recommend'));

CREATE INDEX IF NOT EXISTS idx_quote_history_intelligence_mode
  ON quote_history (intelligence_mode, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_history_intelligence_snapshot
  ON quote_history USING GIN (intelligence_snapshot)
  WHERE intelligence_snapshot IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quote_history_source_health
  ON quote_history USING GIN (source_health_snapshot)
  WHERE source_health_snapshot IS NOT NULL;

COMMENT ON COLUMN quote_history.feature_snapshot IS
  'Deterministic request, route, vehicle, timing, baseline, cost, and policy features captured at quote time.';
COMMENT ON COLUMN quote_history.intelligence_snapshot IS
  'Shadow observation, analysis, insights, confidence, and generation metadata.';
COMMENT ON COLUMN quote_history.recommendation_snapshot IS
  'Policy-constrained recommendation compared with the unchanged customer-facing baseline.';
COMMENT ON COLUMN quote_history.source_health_snapshot IS
  'Provider status, freshness, latency, and error codes captured for each shadow quote.';