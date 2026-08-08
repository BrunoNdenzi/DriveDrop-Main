-- Phase 3: Operational Memory Infrastructure
-- Performance Snapshots Table Migration
-- 
-- Purpose: Store daily snapshots of pricing performance for trend analysis
-- Infrastructure only - does not affect pricing behavior
--
-- Created: 2026-01-30

-- Create pricing_performance_snapshots table
CREATE TABLE IF NOT EXISTS pricing_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Snapshot Metadata
  snapshot_date DATE NOT NULL,
  time_window_days INTEGER NOT NULL DEFAULT 30,
  
  -- Volume Metrics
  total_quotes INTEGER NOT NULL DEFAULT 0,
  baseline_quotes INTEGER NOT NULL DEFAULT 0,
  intelligent_quotes INTEGER NOT NULL DEFAULT 0,
  total_bookings INTEGER NOT NULL DEFAULT 0,
  baseline_bookings INTEGER NOT NULL DEFAULT 0,
  intelligent_bookings INTEGER NOT NULL DEFAULT 0,
  
  -- Conversion Metrics
  overall_conversion_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  baseline_conversion_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  intelligent_conversion_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  
  -- Revenue Metrics
  total_revenue NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  avg_quote_value NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  baseline_avg_revenue NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  intelligent_avg_revenue NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  
  -- Confidence Calibration Metrics
  high_confidence_accuracy NUMERIC(5,2) DEFAULT NULL,
  medium_confidence_accuracy NUMERIC(5,2) DEFAULT NULL,
  low_confidence_accuracy NUMERIC(5,2) DEFAULT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_performance_snapshots_date 
  ON pricing_performance_snapshots(snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_performance_snapshots_created 
  ON pricing_performance_snapshots(created_at DESC);

-- Unique constraint: one snapshot per date per time window
CREATE UNIQUE INDEX IF NOT EXISTS idx_performance_snapshots_unique 
  ON pricing_performance_snapshots(snapshot_date, time_window_days);

-- Row-level security (RLS)
ALTER TABLE pricing_performance_snapshots ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can read all snapshots
CREATE POLICY "Admins can read performance snapshots"
  ON pricing_performance_snapshots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.role = 'admin'
    )
  );

-- Policy: System can insert snapshots
CREATE POLICY "System can insert performance snapshots"
  ON pricing_performance_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: System can update snapshots
CREATE POLICY "System can update performance snapshots"
  ON pricing_performance_snapshots
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_performance_snapshots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_performance_snapshots_updated_at
  BEFORE UPDATE ON pricing_performance_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION update_performance_snapshots_updated_at();

-- Comments for documentation
COMMENT ON TABLE pricing_performance_snapshots IS 
  'Phase 3: Daily snapshots of pricing performance metrics for trend analysis. Infrastructure only - does not affect pricing behavior.';

COMMENT ON COLUMN pricing_performance_snapshots.snapshot_date IS 
  'Date of the snapshot (unique per time_window_days)';

COMMENT ON COLUMN pricing_performance_snapshots.time_window_days IS 
  'Number of days of data included in this snapshot (e.g., 30 for rolling 30-day metrics)';

COMMENT ON COLUMN pricing_performance_snapshots.total_quotes IS 
  'Total number of quotes generated in the time window';

COMMENT ON COLUMN pricing_performance_snapshots.baseline_quotes IS 
  'Number of quotes using baseline pricing (decision_maker = "baseline")';

COMMENT ON COLUMN pricing_performance_snapshots.intelligent_quotes IS 
  'Number of quotes using intelligent pricing (decision_maker = "benji_intelligence")';

COMMENT ON COLUMN pricing_performance_snapshots.overall_conversion_rate IS 
  'Overall booking rate as percentage (0-100)';

COMMENT ON COLUMN pricing_performance_snapshots.baseline_conversion_rate IS 
  'Baseline pricing booking rate as percentage (0-100)';

COMMENT ON COLUMN pricing_performance_snapshots.intelligent_conversion_rate IS 
  'Intelligent pricing booking rate as percentage (0-100)';

COMMENT ON COLUMN pricing_performance_snapshots.high_confidence_accuracy IS 
  'Actual booking rate for high-confidence intelligent quotes (70-100%)';

COMMENT ON COLUMN pricing_performance_snapshots.medium_confidence_accuracy IS 
  'Actual booking rate for medium-confidence intelligent quotes (40-69%)';

COMMENT ON COLUMN pricing_performance_snapshots.low_confidence_accuracy IS 
  'Actual booking rate for low-confidence intelligent quotes (0-39%)';
