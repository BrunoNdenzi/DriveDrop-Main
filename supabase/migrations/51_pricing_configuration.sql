-- Dynamic Pricing Configuration System
-- Allows admins to adjust pricing parameters without code changes

-- Pricing configuration table
CREATE TABLE IF NOT EXISTS pricing_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Minimum prices
  min_quote NUMERIC(10,2) NOT NULL DEFAULT 150.00,
  accident_min_quote NUMERIC(10,2) NOT NULL DEFAULT 80.00,
  min_miles INTEGER NOT NULL DEFAULT 100,
  
  -- Fuel pricing
  base_fuel_price NUMERIC(10,2) NOT NULL DEFAULT 3.70,
  current_fuel_price NUMERIC(10,2) NOT NULL DEFAULT 3.70,
  fuel_adjustment_per_dollar NUMERIC(5,2) NOT NULL DEFAULT 5.00, -- Percentage per $1 deviation
  
  -- Surge/demand multiplier
  surge_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  surge_enabled BOOLEAN NOT NULL DEFAULT false,
  surge_reason TEXT, -- e.g., "Holiday Season", "High Demand"
  
  -- Delivery type multipliers
  expedited_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.25,
  standard_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  flexible_multiplier NUMERIC(5,2) NOT NULL DEFAULT 0.95,
  
  -- Distance band thresholds (in miles)
  short_distance_max INTEGER NOT NULL DEFAULT 500,
  mid_distance_max INTEGER NOT NULL DEFAULT 1500,
  
  -- Feature toggles
  bulk_discount_enabled BOOLEAN NOT NULL DEFAULT true,
  expedited_service_enabled BOOLEAN NOT NULL DEFAULT true,
  flexible_service_enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id),
  notes TEXT -- Admin notes about the configuration
);

-- Pricing configuration history (audit trail)
CREATE TABLE IF NOT EXISTS pricing_config_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_id UUID REFERENCES pricing_config(id) ON DELETE CASCADE,
  
  -- Snapshot of all values at time of change
  config_snapshot JSONB NOT NULL,
  
  -- Change metadata
  changed_by UUID REFERENCES profiles(id),
  change_reason TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Track what fields were changed
  changed_fields TEXT[]
);

-- Indexes
CREATE INDEX idx_pricing_config_active ON pricing_config(is_active) WHERE is_active = true;
CREATE INDEX idx_pricing_config_history_config_id ON pricing_config_history(config_id);
CREATE INDEX idx_pricing_config_history_changed_at ON pricing_config_history(changed_at DESC);

-- RLS Policies
ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_config_history ENABLE ROW LEVEL SECURITY;

-- Only admins can read pricing config
CREATE POLICY "Admins can view pricing config"
  ON pricing_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can insert/update pricing config
CREATE POLICY "Admins can manage pricing config"
  ON pricing_config
  FOR ALL
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

-- Only admins can view pricing history
CREATE POLICY "Admins can view pricing history"
  ON pricing_config_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can insert pricing history (system does this automatically)
CREATE POLICY "Admins can create pricing history"
  ON pricing_config_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to create history entry when config is updated
CREATE OR REPLACE FUNCTION create_pricing_config_history()
RETURNS TRIGGER AS $$
DECLARE
  changed_fields_array TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Track which fields changed
  IF OLD.min_quote IS DISTINCT FROM NEW.min_quote THEN
    changed_fields_array := array_append(changed_fields_array, 'min_quote');
  END IF;
  IF OLD.accident_min_quote IS DISTINCT FROM NEW.accident_min_quote THEN
    changed_fields_array := array_append(changed_fields_array, 'accident_min_quote');
  END IF;
  IF OLD.current_fuel_price IS DISTINCT FROM NEW.current_fuel_price THEN
    changed_fields_array := array_append(changed_fields_array, 'current_fuel_price');
  END IF;
  IF OLD.surge_multiplier IS DISTINCT FROM NEW.surge_multiplier THEN
    changed_fields_array := array_append(changed_fields_array, 'surge_multiplier');
  END IF;
  IF OLD.surge_enabled IS DISTINCT FROM NEW.surge_enabled THEN
    changed_fields_array := array_append(changed_fields_array, 'surge_enabled');
  END IF;
  IF OLD.expedited_multiplier IS DISTINCT FROM NEW.expedited_multiplier THEN
    changed_fields_array := array_append(changed_fields_array, 'expedited_multiplier');
  END IF;
  IF OLD.flexible_multiplier IS DISTINCT FROM NEW.flexible_multiplier THEN
    changed_fields_array := array_append(changed_fields_array, 'flexible_multiplier');
  END IF;
  
  -- Create history entry with snapshot
  INSERT INTO pricing_config_history (
    config_id,
    config_snapshot,
    changed_by,
    changed_fields
  ) VALUES (
    NEW.id,
    row_to_json(NEW)::JSONB,
    NEW.updated_by,
    changed_fields_array
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create history on update
CREATE TRIGGER pricing_config_history_trigger
  AFTER UPDATE ON pricing_config
  FOR EACH ROW
  EXECUTE FUNCTION create_pricing_config_history();

-- Function to get active pricing config (used by backend)
CREATE OR REPLACE FUNCTION get_active_pricing_config()
RETURNS pricing_config AS $$
DECLARE
  config pricing_config;
BEGIN
  SELECT * INTO config
  FROM pricing_config
  WHERE is_active = true
  ORDER BY updated_at DESC
  LIMIT 1;
  
  -- If no active config exists, return defaults
  IF config IS NULL THEN
    SELECT * INTO config
    FROM pricing_config
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  
  RETURN config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default pricing configuration
INSERT INTO pricing_config (
  min_quote,
  accident_min_quote,
  min_miles,
  base_fuel_price,
  current_fuel_price,
  fuel_adjustment_per_dollar,
  surge_multiplier,
  surge_enabled,
  expedited_multiplier,
  standard_multiplier,
  flexible_multiplier,
  short_distance_max,
  mid_distance_max,
  bulk_discount_enabled,
  expedited_service_enabled,
  flexible_service_enabled,
  is_active,
  notes
) VALUES (
  150.00,  -- min_quote
  80.00,   -- accident_min_quote
  100,     -- min_miles
  3.70,    -- base_fuel_price
  3.70,    -- current_fuel_price (same as base initially)
  5.00,    -- fuel_adjustment_per_dollar (5% per $1)
  1.00,    -- surge_multiplier (no surge initially)
  false,   -- surge_enabled
  1.25,    -- expedited_multiplier
  1.00,    -- standard_multiplier
  0.95,    -- flexible_multiplier
  500,     -- short_distance_max
  1500,    -- mid_distance_max
  true,    -- bulk_discount_enabled
  true,    -- expedited_service_enabled
  true,    -- flexible_service_enabled
  true,    -- is_active
  'Default pricing configuration - Initial setup'
);

-- Comments
COMMENT ON TABLE pricing_config IS 'Dynamic pricing configuration that can be adjusted by admins';
COMMENT ON TABLE pricing_config_history IS 'Audit trail of all pricing configuration changes';
COMMENT ON COLUMN pricing_config.min_quote IS 'Minimum quote price in dollars';
COMMENT ON COLUMN pricing_config.surge_multiplier IS 'Multiplier applied during high demand (e.g., 1.5 = 50% increase)';
COMMENT ON COLUMN pricing_config.current_fuel_price IS 'Current average fuel price per gallon used for adjustments';
