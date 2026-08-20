-- Benji Pricing Phase 0: configurable economic-floor shadow evaluation
-- Adds policy-owned fallback cost priors and durable quote-level shadow metrics.

ALTER TABLE pricing_config
  ADD COLUMN IF NOT EXISTS economic_floor_mode TEXT NOT NULL DEFAULT 'shadow'
    CHECK (economic_floor_mode IN ('shadow', 'enforce')),
  ADD COLUMN IF NOT EXISTS target_contribution_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 30.00
    CHECK (target_contribution_margin_percent >= 0 AND target_contribution_margin_percent < 100),
  ADD COLUMN IF NOT EXISTS fallback_fuel_cost_per_mile NUMERIC(10,4) NOT NULL DEFAULT 0.5250
    CHECK (fallback_fuel_cost_per_mile >= 0),
  ADD COLUMN IF NOT EXISTS fallback_driver_cost_per_mile NUMERIC(10,4) NOT NULL DEFAULT 0.6250
    CHECK (fallback_driver_cost_per_mile >= 0),
  ADD COLUMN IF NOT EXISTS fallback_insurance_cost_per_mile NUMERIC(10,4) NOT NULL DEFAULT 0.1500
    CHECK (fallback_insurance_cost_per_mile >= 0),
  ADD COLUMN IF NOT EXISTS fallback_maintenance_cost_per_mile NUMERIC(10,4) NOT NULL DEFAULT 0.2750
    CHECK (fallback_maintenance_cost_per_mile >= 0),
  ADD COLUMN IF NOT EXISTS fallback_tolls_cost_per_mile NUMERIC(10,4) NOT NULL DEFAULT 0.1000
    CHECK (fallback_tolls_cost_per_mile >= 0);

ALTER TABLE quote_history
  ADD COLUMN IF NOT EXISTS estimated_operating_cost NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS target_contribution_margin_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS economic_floor NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS economic_floor_gap NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS economic_floor_mode TEXT
    CHECK (economic_floor_mode IN ('shadow', 'enforce')),
  ADD COLUMN IF NOT EXISTS economic_floor_applied BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cost_source TEXT;

COMMENT ON COLUMN pricing_config.economic_floor_mode IS 'Shadow records floor metrics without changing prices; enforce prevents quotes below the floor.';
COMMENT ON COLUMN pricing_config.target_contribution_margin_percent IS 'Required contribution margin measured as (price - estimated cost) / price.';
COMMENT ON COLUMN pricing_config.fallback_fuel_cost_per_mile IS 'Fallback fuel-cost prior used until a fresh live source is available.';
COMMENT ON COLUMN pricing_config.fallback_driver_cost_per_mile IS 'Fallback carrier/driver compensation prior per route mile.';
COMMENT ON COLUMN pricing_config.fallback_insurance_cost_per_mile IS 'Fallback insurance-cost prior per route mile.';
COMMENT ON COLUMN pricing_config.fallback_maintenance_cost_per_mile IS 'Fallback maintenance-cost prior per route mile.';
COMMENT ON COLUMN pricing_config.fallback_tolls_cost_per_mile IS 'Fallback toll-cost prior per route mile.';
COMMENT ON COLUMN quote_history.economic_floor IS 'Minimum price implied by estimated operating cost and target contribution margin.';
COMMENT ON COLUMN quote_history.economic_floor_gap IS 'Positive amount by which the pre-floor customer price was below the economic floor.';
COMMENT ON COLUMN quote_history.cost_source IS 'Source mode for the cost estimate, such as configured_priors or live_override.';
