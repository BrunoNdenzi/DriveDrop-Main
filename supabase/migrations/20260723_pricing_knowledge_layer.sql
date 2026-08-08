-- Phase 2: Knowledge Layer Foundation for Pricing Intelligence
-- Migration: 20260723_pricing_knowledge_layer.sql
-- Purpose: Establish foundational data structures for Benji's operational intelligence
--          Enables historical analysis, decision tracking, and continuous learning

-- ============================================================================
-- 1. QUOTE HISTORY (Every Quote Generated)
-- ============================================================================
-- Purpose: Log all pricing quotes whether booked or not
-- Enables: Win/loss analysis, conversion rate tracking, price sensitivity analysis
-- Future: ML training data for demand forecasting

CREATE TABLE IF NOT EXISTS quote_history (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_key TEXT UNIQUE NOT NULL, -- Format: {userId}:{route}:{vehicleType}:{timestamp}
  
  -- Request Context
  user_id UUID REFERENCES profiles(id),
  request_id TEXT,  -- Links to Benji trace if initiated via AI
  session_id TEXT,  -- Browser/app session identifier
  
  -- Route Details
  route_origin TEXT NOT NULL,
  route_destination TEXT NOT NULL,
  distance_miles INTEGER NOT NULL,
  
  -- Vehicle Details
  vehicle_type TEXT NOT NULL,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  vehicle_count INTEGER DEFAULT 1,
  
  -- Timing
  pickup_date DATE,
  delivery_date DATE,
  delivery_type TEXT, -- 'expedited', 'flexible', 'standard'
  
  -- Pricing Breakdown
  baseline_price NUMERIC(10,2) NOT NULL,  -- Pure calculation from Pricing Engine
  intelligent_price NUMERIC(10,2),        -- Benji recommendation (NULL if not used)
  quoted_price NUMERIC(10,2) NOT NULL,    -- Final price shown to customer
  
  -- Pricing Components (for analysis)
  base_rate_per_mile NUMERIC(10,2) NOT NULL,
  distance_band TEXT NOT NULL,  -- 'short', 'mid', 'long'
  surge_multiplier NUMERIC(5,2) DEFAULT 1.00,
  delivery_type_multiplier NUMERIC(5,2) DEFAULT 1.00,
  fuel_adjustment_percent NUMERIC(5,2) DEFAULT 0.00,
  bulk_discount_percent NUMERIC(5,2) DEFAULT 0.00,
  minimum_applied BOOLEAN DEFAULT false,
  
  -- Decision Context
  decision_maker TEXT NOT NULL, -- 'baseline', 'benji_intelligence', 'admin_override'
  benji_confidence_score INTEGER, -- 0-100, how confident Benji was in recommendation
  benji_reasoning TEXT,           -- Human-readable explanation from Benji
  override_reason TEXT,           -- If admin manually adjusted, why?
  
  -- Market Context (captured at quote time)
  competitor_prices JSONB,  -- [{competitor: 'uship', price: 450}, ...]
  demand_indicator INTEGER, -- 0-100 snapshot (future: from operational metrics)
  supply_indicator INTEGER, -- 0-100 snapshot (future: driver availability)
  
  -- Outcome Tracking
  was_booked BOOLEAN DEFAULT false,
  booked_at TIMESTAMPTZ,
  time_to_booking_ms BIGINT,  -- Milliseconds from quote to booking decision
  shipment_id UUID REFERENCES shipments(id), -- Links to actual shipment if booked
  booking_price NUMERIC(10,2), -- Actual price at booking (may differ if quote expired)
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- Quote validity window
  ip_address INET,         -- For fraud detection
  user_agent TEXT          -- Browser/app identification
);

-- Indexes for common queries
CREATE INDEX idx_quote_history_user ON quote_history(user_id);
CREATE INDEX idx_quote_history_route ON quote_history(route_origin, route_destination);
CREATE INDEX idx_quote_history_created ON quote_history(created_at DESC);
CREATE INDEX idx_quote_history_booked ON quote_history(was_booked, created_at DESC);
CREATE INDEX idx_quote_history_shipment ON quote_history(shipment_id) WHERE shipment_id IS NOT NULL;
CREATE INDEX idx_quote_history_decision_maker ON quote_history(decision_maker);

-- ============================================================================
-- 2. PRICING EVENTS (Event Sourcing)
-- ============================================================================
-- Purpose: Immutable log of all pricing-related events
-- Enables: Audit trail, replay capability, continuous learning pipeline
-- Pattern: Event sourcing for pricing decisions

CREATE TABLE IF NOT EXISTS pricing_events (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,  -- 'quote_generated', 'intelligence_analyzed', 'decision_made', etc.
  event_version INTEGER DEFAULT 1,  -- Schema versioning for event evolution
  
  -- Event Context
  aggregate_id UUID NOT NULL,  -- quote_id, shipment_id, etc.
  aggregate_type TEXT NOT NULL, -- 'quote', 'shipment', 'config_change'
  trace_id TEXT,  -- Links to benji_traces if part of AI interaction
  user_id UUID,
  
  -- Event Payload (flexible JSONB)
  event_payload JSONB NOT NULL,
  
  -- Metadata
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Source Tracking
  source_service TEXT DEFAULT 'pricing_service',  -- Which service emitted event
  source_version TEXT  -- Service version for debugging
);

-- Indexes for event sourcing queries
CREATE INDEX idx_pricing_events_type ON pricing_events(event_type);
CREATE INDEX idx_pricing_events_aggregate ON pricing_events(aggregate_id, aggregate_type);
CREATE INDEX idx_pricing_events_occurred ON pricing_events(occurred_at DESC);
CREATE INDEX idx_pricing_events_trace ON pricing_events(trace_id) WHERE trace_id IS NOT NULL;

-- GIN index for JSONB queries (future: query by nested payload fields)
CREATE INDEX idx_pricing_events_payload ON pricing_events USING GIN (event_payload);

-- ============================================================================
-- 3. SHIPMENT COSTS (Actual Cost Tracking)
-- ============================================================================
-- Purpose: Record actual costs incurred per shipment
-- Enables: Profit margin analysis, cost variance detection, pricing model refinement
-- Future: Train models to predict actual costs vs estimates

CREATE TABLE IF NOT EXISTS shipment_costs (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE UNIQUE,
  
  -- Cost Breakdown (actual amounts from receipts/payments)
  fuel_cost NUMERIC(10,2),          -- Gas receipts, fuel cards
  driver_payout NUMERIC(10,2),      -- What driver was paid
  insurance_cost NUMERIC(10,2),     -- Insurance premium charged
  toll_cost NUMERIC(10,2),          -- Toll receipts
  maintenance_cost NUMERIC(10,2),   -- Post-shipment maintenance
  platform_fee NUMERIC(10,2),       -- DriveDrop commission
  payment_processing_fee NUMERIC(10,2), -- Stripe fees
  other_costs NUMERIC(10,2),        -- Miscellaneous
  
  -- Totals
  total_cost NUMERIC(10,2) NOT NULL,
  revenue NUMERIC(10,2) NOT NULL,    -- What customer paid
  gross_profit NUMERIC(10,2) NOT NULL,  -- revenue - total_cost
  profit_margin_percent NUMERIC(5,2),   -- (gross_profit / revenue) * 100
  
  -- Comparison to Quote
  quoted_price NUMERIC(10,2),
  price_variance NUMERIC(10,2),     -- quoted_price - revenue
  cost_variance NUMERIC(10,2),      -- estimated_cost - total_cost
  
  -- Cost Per Mile Actuals
  fuel_cost_per_mile NUMERIC(10,4),
  driver_cost_per_mile NUMERIC(10,4),
  insurance_cost_per_mile NUMERIC(10,4),
  total_cost_per_mile NUMERIC(10,4),
  
  -- Metadata
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,  -- Any exceptional circumstances
  created_by UUID REFERENCES profiles(id)
);

-- Indexes
CREATE INDEX idx_shipment_costs_shipment ON shipment_costs(shipment_id);
CREATE INDEX idx_shipment_costs_finalized ON shipment_costs(finalized_at DESC);
CREATE INDEX idx_shipment_costs_margin ON shipment_costs(profit_margin_percent);

-- ============================================================================
-- 4. ROUTE ANALYTICS (Pre-Aggregated Performance Metrics)
-- ============================================================================
-- Purpose: Materialized view of route performance over time
-- Enables: Fast dashboard queries, trend analysis, route profitability reports
-- Update Strategy: Daily batch job + incremental updates on quote/booking events

CREATE TABLE IF NOT EXISTS route_analytics (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Route Definition
  route_key TEXT NOT NULL,  -- Format: {origin}:{destination}:{vehicleType}
  route_origin TEXT NOT NULL,
  route_destination TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  
  -- Time Period (for trend analysis)
  time_period TEXT NOT NULL,  -- '2026-07' (month), '2026-Q3' (quarter), '2026' (year)
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Volume Metrics
  total_quotes INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  total_shipments_completed INTEGER DEFAULT 0,
  conversion_rate NUMERIC(5,2),  -- (bookings / quotes) * 100
  
  -- Pricing Metrics
  avg_quoted_price NUMERIC(10,2),
  min_quoted_price NUMERIC(10,2),
  max_quoted_price NUMERIC(10,2),
  median_quoted_price NUMERIC(10,2),
  
  avg_booked_price NUMERIC(10,2),
  avg_actual_cost NUMERIC(10,2),
  avg_profit_margin NUMERIC(10,2),
  avg_profit_margin_percent NUMERIC(5,2),
  
  -- Decision Intelligence Metrics
  benji_usage_count INTEGER DEFAULT 0,  -- How many quotes used Benji intelligence
  benji_conversion_rate NUMERIC(5,2),   -- Conversion rate when Benji was used
  baseline_conversion_rate NUMERIC(5,2), -- Conversion rate for baseline pricing
  
  -- Market Context
  competitor_avg_price NUMERIC(10,2),
  our_price_vs_market_percent NUMERIC(5,2),  -- (our_price - competitor_avg) / competitor_avg * 100
  
  -- Performance Indicators
  route_profitability_score INTEGER, -- 0-100 composite score
  demand_score INTEGER,  -- 0-100 relative demand
  supply_score INTEGER,  -- 0-100 driver availability
  
  -- Metadata
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sample_size INTEGER,  -- Number of data points used for aggregation
  
  UNIQUE(route_key, time_period)
);

-- Indexes
CREATE INDEX idx_route_analytics_route ON route_analytics(route_key);
CREATE INDEX idx_route_analytics_period ON route_analytics(time_period, period_start);
CREATE INDEX idx_route_analytics_conversion ON route_analytics(conversion_rate DESC);
CREATE INDEX idx_route_analytics_profitability ON route_analytics(route_profitability_score DESC);

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================
-- Security: Control access to sensitive pricing data

ALTER TABLE quote_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_analytics ENABLE ROW LEVEL SECURITY;

-- Quote History: Users can view their own quotes, admins can view all
CREATE POLICY "Users can view own quotes"
  ON quote_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all quotes"
  ON quote_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert quotes"
  ON quote_history FOR INSERT
  TO authenticated
  WITH CHECK (true);  -- Any authenticated service can log quotes

-- Pricing Events: Admin-only access (audit trail)
CREATE POLICY "Admins can view pricing events"
  ON pricing_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert pricing events"
  ON pricing_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Shipment Costs: Admin-only (sensitive financial data)
CREATE POLICY "Admins can view shipment costs"
  ON shipment_costs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Route Analytics: Read-only for all authenticated users (public insights)
CREATE POLICY "Authenticated users can view route analytics"
  ON route_analytics FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to update route analytics (called by batch job or trigger)
CREATE OR REPLACE FUNCTION update_route_analytics(
  p_route_key TEXT,
  p_time_period TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO route_analytics (
    route_key,
    route_origin,
    route_destination,
    vehicle_type,
    time_period,
    period_start,
    period_end,
    total_quotes,
    total_bookings,
    conversion_rate,
    avg_quoted_price,
    benji_usage_count,
    last_updated,
    sample_size
  )
  SELECT
    p_route_key,
    route_origin,
    route_destination,
    vehicle_type,
    p_time_period,
    MIN(created_at::date),
    MAX(created_at::date),
    COUNT(*),
    COUNT(*) FILTER (WHERE was_booked = true),
    (COUNT(*) FILTER (WHERE was_booked = true)::numeric / NULLIF(COUNT(*), 0) * 100),
    AVG(quoted_price),
    COUNT(*) FILTER (WHERE decision_maker = 'benji_intelligence'),
    NOW(),
    COUNT(*)
  FROM quote_history
  WHERE route_origin || ':' || route_destination || ':' || vehicle_type = p_route_key
    AND created_at >= (SELECT period_start FROM route_analytics WHERE route_key = p_route_key AND time_period = p_time_period LIMIT 1)
  GROUP BY route_origin, route_destination, vehicle_type
  ON CONFLICT (route_key, time_period)
  DO UPDATE SET
    total_quotes = EXCLUDED.total_quotes,
    total_bookings = EXCLUDED.total_bookings,
    conversion_rate = EXCLUDED.conversion_rate,
    avg_quoted_price = EXCLUDED.avg_quoted_price,
    benji_usage_count = EXCLUDED.benji_usage_count,
    last_updated = NOW(),
    sample_size = EXCLUDED.sample_size;
END;
$$;

-- ============================================================================
-- 7. COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE quote_history IS 'Phase 2: Comprehensive log of all pricing quotes for analysis and ML training';
COMMENT ON TABLE pricing_events IS 'Phase 2: Event sourcing log for pricing decisions - enables audit and replay';
COMMENT ON TABLE shipment_costs IS 'Phase 2: Actual cost tracking per shipment for profit analysis and model refinement';
COMMENT ON TABLE route_analytics IS 'Phase 2: Pre-aggregated route performance metrics for fast dashboard queries';

COMMENT ON COLUMN quote_history.decision_maker IS 'Who made the pricing decision: baseline (pure math), benji_intelligence (AI recommendation), admin_override (manual)';
COMMENT ON COLUMN quote_history.benji_confidence_score IS 'Benji operational intelligence confidence level (0-100) in the recommendation';
COMMENT ON COLUMN quote_history.benji_reasoning IS 'Human-readable explanation from Benji about why this price was recommended';
COMMENT ON COLUMN pricing_events.event_payload IS 'Flexible JSONB storage for event-specific data - schema varies by event_type';
COMMENT ON COLUMN shipment_costs.cost_variance IS 'Difference between estimated and actual costs - used to improve cost models';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next Steps:
-- 1. Create BenjiOperationalIntelligence service (backend/src/benji/intelligence/pricing.intelligence.ts)
-- 2. Update pricing.service.ts to emit pricing_events
-- 3. Create event types in benji/core/events/event.types.ts
-- 4. Implement analytics dashboard queries
