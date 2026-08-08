-- Phase 2: Add Intelligence Policy Configuration to pricing_config
-- Extends existing pricing_config table with business intelligence policy values
-- These policies control how the Decision Layer applies business rules based on Benji's insights

-- Add policy columns to existing pricing_config table
ALTER TABLE pricing_config
  ADD COLUMN IF NOT EXISTS intelligence_min_confidence INTEGER DEFAULT 50 CHECK (intelligence_min_confidence >= 0 AND intelligence_min_confidence <= 100),
  ADD COLUMN IF NOT EXISTS intelligence_min_data_quality TEXT DEFAULT 'limited' CHECK (intelligence_min_data_quality IN ('insufficient', 'limited', 'good', 'excellent')),
  ADD COLUMN IF NOT EXISTS historical_alignment_weight NUMERIC(3,2) DEFAULT 0.30 CHECK (historical_alignment_weight >= 0 AND historical_alignment_weight <= 1),
  ADD COLUMN IF NOT EXISTS historical_deviation_threshold INTEGER DEFAULT 15 CHECK (historical_deviation_threshold >= 0),
  ADD COLUMN IF NOT EXISTS historical_min_sample_size INTEGER DEFAULT 20 CHECK (historical_min_sample_size >= 0),
  ADD COLUMN IF NOT EXISTS demand_premium_percent NUMERIC(4,2) DEFAULT 5.00 CHECK (demand_premium_percent >= 0),
  ADD COLUMN IF NOT EXISTS demand_discount_percent NUMERIC(4,2) DEFAULT 3.00 CHECK (demand_discount_percent >= 0),
  ADD COLUMN IF NOT EXISTS loyalty_discount_percent NUMERIC(4,2) DEFAULT 3.00 CHECK (loyalty_discount_percent >= 0),
  ADD COLUMN IF NOT EXISTS conversion_boost_percent NUMERIC(4,2) DEFAULT 5.00 CHECK (conversion_boost_percent >= 0),
  ADD COLUMN IF NOT EXISTS momentum_premium_percent NUMERIC(4,2) DEFAULT 3.00 CHECK (momentum_premium_percent >= 0),
  ADD COLUMN IF NOT EXISTS max_price_adjustment_percent NUMERIC(4,2) DEFAULT 20.00 CHECK (max_price_adjustment_percent >= 0);

-- Add comment explaining purpose
COMMENT ON COLUMN pricing_config.intelligence_min_confidence IS 'Minimum confidence score (0-100) required for intelligence-based pricing override';
COMMENT ON COLUMN pricing_config.intelligence_min_data_quality IS 'Minimum data quality level required (insufficient/limited/good/excellent)';
COMMENT ON COLUMN pricing_config.historical_alignment_weight IS 'Weight (0-1) for blending baseline with historical average when deviation exceeds threshold';
COMMENT ON COLUMN pricing_config.historical_deviation_threshold IS 'Minimum % deviation from historical to trigger alignment policy';
COMMENT ON COLUMN pricing_config.historical_min_sample_size IS 'Minimum historical quotes needed to trust historical data';
COMMENT ON COLUMN pricing_config.demand_premium_percent IS 'Premium % applied when high demand is observed';
COMMENT ON COLUMN pricing_config.demand_discount_percent IS 'Discount % applied when low demand is observed';
COMMENT ON COLUMN pricing_config.loyalty_discount_percent IS 'Discount % applied for repeat customers';
COMMENT ON COLUMN pricing_config.conversion_boost_percent IS 'Discount % applied for low-conversion routes';
COMMENT ON COLUMN pricing_config.momentum_premium_percent IS 'Premium % applied for routes with strong booking momentum';
COMMENT ON COLUMN pricing_config.max_price_adjustment_percent IS 'Maximum total % adjustment from baseline (safety cap)';

-- Update existing active config with default policy values (if exists)
UPDATE pricing_config
SET 
  intelligence_min_confidence = 50,
  intelligence_min_data_quality = 'limited',
  historical_alignment_weight = 0.30,
  historical_deviation_threshold = 15,
  historical_min_sample_size = 20,
  demand_premium_percent = 5.00,
  demand_discount_percent = 3.00,
  loyalty_discount_percent = 3.00,
  conversion_boost_percent = 5.00,
  momentum_premium_percent = 3.00,
  max_price_adjustment_percent = 20.00
WHERE is_active = true
  AND intelligence_min_confidence IS NULL;
