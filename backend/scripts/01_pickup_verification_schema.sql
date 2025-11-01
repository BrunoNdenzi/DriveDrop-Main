-- ============================================================================
-- DRIVER PICKUP VERIFICATION SYSTEM - Database Schema
-- ============================================================================
-- Phase 1: Database tables, status tracking, and supporting functions
-- Version: 1.0
-- Date: October 29, 2025
-- ============================================================================

-- ============================================================================
-- 1. PICKUP VERIFICATIONS TABLE
-- ============================================================================
-- Stores all driver pickup verification data including photos and decisions

CREATE TABLE IF NOT EXISTS pickup_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Location Data
  pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
  pickup_address_verified BOOLEAN NOT NULL DEFAULT FALSE,
  gps_accuracy_meters NUMERIC,
  distance_from_address_meters NUMERIC, -- How far driver is from actual address
  
  -- Photos
  driver_photos JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{url, type, timestamp, gps}]
  client_photos_reference JSONB NOT NULL DEFAULT '[]'::jsonb, -- Original client photos
  comparison_notes JSONB DEFAULT '{}'::jsonb, -- Notes for each photo comparison
  
  -- Verification Decision
  verification_status TEXT NOT NULL CHECK (verification_status IN ('matches', 'minor_differences', 'major_issues', 'pending')),
  differences_description TEXT,
  cannot_proceed_reason TEXT CHECK (cannot_proceed_reason IN ('not_drivable', 'significant_damage', 'wrong_vehicle', 'safety_concern', 'vehicle_missing', 'other')),
  
  -- Client Response (if minor differences)
  client_notified_at TIMESTAMPTZ,
  client_response TEXT CHECK (client_response IN ('approved', 'disputed', 'no_response', NULL)),
  client_response_notes TEXT,
  client_responded_at TIMESTAMPTZ,
  
  -- Timestamps
  arrival_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verification_started_at TIMESTAMPTZ,
  verification_completed_at TIMESTAMPTZ,
  
  -- Metadata
  app_version TEXT,
  device_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT pickup_verifications_shipment_unique UNIQUE(shipment_id),
  CONSTRAINT pickup_verifications_valid_dates CHECK (verification_completed_at >= verification_started_at),
  CONSTRAINT pickup_verifications_client_response_timing CHECK (
    (client_response IS NULL) OR (client_responded_at IS NOT NULL)
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pickup_verifications_shipment ON pickup_verifications(shipment_id);
CREATE INDEX IF NOT EXISTS idx_pickup_verifications_driver ON pickup_verifications(driver_id);
CREATE INDEX IF NOT EXISTS idx_pickup_verifications_status ON pickup_verifications(verification_status);
CREATE INDEX IF NOT EXISTS idx_pickup_verifications_arrival ON pickup_verifications(arrival_time DESC);

-- RLS Policies
ALTER TABLE pickup_verifications ENABLE ROW LEVEL SECURITY;

-- Driver can view and create their own verifications
CREATE POLICY "Drivers can view own verifications"
  ON pickup_verifications FOR SELECT
  USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can create verifications"
  ON pickup_verifications FOR INSERT
  WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can update own verifications"
  ON pickup_verifications FOR UPDATE
  USING (auth.uid() = driver_id);

-- Client can view verification for their shipments
CREATE POLICY "Clients can view verifications for their shipments"
  ON pickup_verifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shipments
      WHERE shipments.id = pickup_verifications.shipment_id
      AND shipments.client_id = auth.uid()
    )
  );

-- Admins can view all
CREATE POLICY "Admins can view all verifications"
  ON pickup_verifications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- 2. CANCELLATION RECORDS TABLE
-- ============================================================================
-- Tracks all cancellations with detailed reasoning and financial breakdown

CREATE TABLE IF NOT EXISTS cancellation_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  cancelled_by UUID NOT NULL REFERENCES profiles(id),
  canceller_role TEXT NOT NULL CHECK (canceller_role IN ('client', 'driver', 'admin')),
  
  -- Cancellation Type & Timing
  cancellation_type TEXT NOT NULL CHECK (cancellation_type IN (
    'before_driver_accepts',
    'after_accept_before_arrival',
    'at_pickup_mismatch',
    'at_pickup_fraud',
    'in_transit_emergency',
    'admin_intervention'
  )),
  cancellation_stage TEXT NOT NULL CHECK (cancellation_stage IN (
    'pending',           -- Initial shipment state
    'accepted',          -- Driver accepted
    'en_route',          -- Driver heading to pickup
    'arrived',           -- Driver at pickup location
    'pickup_verified',   -- Verification complete
    'picked_up',         -- Vehicle loaded
    'in_transit',        -- Delivery in progress
    'delivered'          -- Should not be cancellable
  )),
  
  -- Reason & Evidence
  reason_category TEXT NOT NULL CHECK (reason_category IN (
    'vehicle_mismatch',
    'not_drivable',
    'significant_damage',
    'wrong_vehicle',
    'safety_concern',
    'client_fraud',
    'driver_no_show',
    'client_request',
    'emergency',
    'other'
  )),
  reason_description TEXT NOT NULL,
  evidence_photos JSONB DEFAULT '[]'::jsonb,
  pickup_verification_id UUID REFERENCES pickup_verifications(id),
  
  -- Financial Breakdown
  original_amount NUMERIC(10, 2) NOT NULL,
  client_refund_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  driver_compensation_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  platform_fee_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  
  -- Refund Processing
  refund_status TEXT NOT NULL DEFAULT 'pending' CHECK (refund_status IN ('pending', 'processing', 'completed', 'failed')),
  refund_processed_at TIMESTAMPTZ,
  refund_transaction_id TEXT, -- Stripe refund ID
  payment_status_before_cancel TEXT, -- Track original payment status
  
  -- Admin Review
  requires_admin_review BOOLEAN DEFAULT FALSE,
  admin_reviewed BOOLEAN DEFAULT FALSE,
  admin_reviewer_id UUID REFERENCES profiles(id),
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  fraud_confirmed BOOLEAN DEFAULT FALSE,
  user_banned BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT cancellation_amounts_valid CHECK (
    original_amount >= 0 AND
    client_refund_amount >= 0 AND
    driver_compensation_amount >= 0 AND
    platform_fee_amount >= 0
  ),
  CONSTRAINT cancellation_amounts_match CHECK (
    ABS(original_amount - (client_refund_amount + driver_compensation_amount + platform_fee_amount)) < 0.01
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cancellation_records_shipment ON cancellation_records(shipment_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_records_cancelled_by ON cancellation_records(cancelled_by);
CREATE INDEX IF NOT EXISTS idx_cancellation_records_type ON cancellation_records(cancellation_type);
CREATE INDEX IF NOT EXISTS idx_cancellation_records_admin_review ON cancellation_records(admin_reviewed, requires_admin_review);
CREATE INDEX IF NOT EXISTS idx_cancellation_records_refund_status ON cancellation_records(refund_status);
CREATE INDEX IF NOT EXISTS idx_cancellation_records_fraud ON cancellation_records(fraud_confirmed, cancelled_at DESC);

-- RLS Policies
ALTER TABLE cancellation_records ENABLE ROW LEVEL SECURITY;

-- Users can view their own cancellations
CREATE POLICY "Users can view own cancellations"
  ON cancellation_records FOR SELECT
  USING (
    auth.uid() = cancelled_by OR
    EXISTS (
      SELECT 1 FROM shipments
      WHERE shipments.id = cancellation_records.shipment_id
      AND (shipments.client_id = auth.uid() OR shipments.driver_id = auth.uid())
    )
  );

-- Drivers/clients can create cancellation records
CREATE POLICY "Users can create cancellation records"
  ON cancellation_records FOR INSERT
  WITH CHECK (auth.uid() = cancelled_by);

-- Admins can do everything
CREATE POLICY "Admins can manage cancellations"
  ON cancellation_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- 3. UPDATE SHIPMENTS TABLE
-- ============================================================================
-- Add new columns for pickup verification tracking

ALTER TABLE shipments 
  ADD COLUMN IF NOT EXISTS driver_arrival_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pickup_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_verification_status TEXT CHECK (pickup_verification_status IN ('pending', 'verified', 'issues_reported', 'cancelled')),
  ADD COLUMN IF NOT EXISTS actual_pickup_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estimated_delivery_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_delivery_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS delivery_photos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cancellation_record_id UUID REFERENCES cancellation_records(id);

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_shipments_pickup_verification ON shipments(pickup_verification_status, driver_id);

-- ============================================================================
-- 4. SHIPMENT STATUS ENUM UPDATE
-- ============================================================================
-- Ensure all necessary statuses exist

-- Check if we need to add new statuses (PostgreSQL enum handling)
DO $$ 
BEGIN
  -- Add new statuses if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'driver_en_route' AND enumtypid = 'shipment_status'::regtype) THEN
    ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'driver_en_route';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'driver_arrived' AND enumtypid = 'shipment_status'::regtype) THEN
    ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'driver_arrived';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pickup_verification_pending' AND enumtypid = 'shipment_status'::regtype) THEN
    ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'pickup_verification_pending';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pickup_verified' AND enumtypid = 'shipment_status'::regtype) THEN
    ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'pickup_verified';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'picked_up' AND enumtypid = 'shipment_status'::regtype) THEN
    ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'picked_up';
  END IF;
END $$;

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Function: Calculate refund amounts based on cancellation policy
CREATE OR REPLACE FUNCTION calculate_cancellation_refund(
  p_original_amount NUMERIC,
  p_cancellation_type TEXT,
  p_fraud_confirmed BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  client_refund NUMERIC,
  driver_compensation NUMERIC,
  platform_fee NUMERIC
) AS $$
BEGIN
  -- Fraud case: No refund
  IF p_fraud_confirmed THEN
    RETURN QUERY SELECT 
      0::NUMERIC AS client_refund,
      (p_original_amount * 0.40)::NUMERIC AS driver_compensation,
      (p_original_amount * 0.60)::NUMERIC AS platform_fee;
    RETURN;
  END IF;

  -- Normal cancellation cases
  CASE p_cancellation_type
    -- Before driver accepts: 95% refund
    WHEN 'before_driver_accepts' THEN
      RETURN QUERY SELECT 
        (p_original_amount * 0.95)::NUMERIC,
        0::NUMERIC,
        (p_original_amount * 0.05)::NUMERIC;
    
    -- After accept, before arrival: 80% refund, 10% driver
    WHEN 'after_accept_before_arrival' THEN
      RETURN QUERY SELECT 
        (p_original_amount * 0.80)::NUMERIC,
        (p_original_amount * 0.10)::NUMERIC,
        (p_original_amount * 0.10)::NUMERIC;
    
    -- At pickup - vehicle mismatch: 70% refund, 20% driver
    WHEN 'at_pickup_mismatch' THEN
      RETURN QUERY SELECT 
        (p_original_amount * 0.70)::NUMERIC,
        (p_original_amount * 0.20)::NUMERIC,
        (p_original_amount * 0.10)::NUMERIC;
    
    -- Admin intervention: Case by case (default 80/10/10)
    WHEN 'admin_intervention' THEN
      RETURN QUERY SELECT 
        (p_original_amount * 0.80)::NUMERIC,
        (p_original_amount * 0.10)::NUMERIC,
        (p_original_amount * 0.10)::NUMERIC;
    
    -- Default: 90% refund (conservative)
    ELSE
      RETURN QUERY SELECT 
        (p_original_amount * 0.90)::NUMERIC,
        0::NUMERIC,
        (p_original_amount * 0.10)::NUMERIC;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Update shipment status with validation
CREATE OR REPLACE FUNCTION update_shipment_status_safe(
  p_shipment_id UUID,
  p_new_status shipment_status,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_status shipment_status;
  v_driver_id UUID;
  v_client_id UUID;
  v_user_role TEXT;
BEGIN
  -- Get current shipment info
  SELECT status, driver_id, client_id
  INTO v_current_status, v_driver_id, v_client_id
  FROM shipments
  WHERE id = p_shipment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shipment not found';
  END IF;

  -- Get user role
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = p_user_id;

  -- Validate status transitions
  -- Driver-only transitions
  IF p_new_status IN ('driver_en_route', 'driver_arrived', 'pickup_verification_pending', 'picked_up', 'in_transit') THEN
    IF v_driver_id IS NULL OR p_user_id != v_driver_id THEN
      RAISE EXCEPTION 'Only assigned driver can update to this status';
    END IF;
  END IF;

  -- Valid status flow
  IF NOT is_valid_status_transition(v_current_status, p_new_status) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', v_current_status, p_new_status;
  END IF;

  -- Update status
  UPDATE shipments
  SET 
    status = p_new_status,
    updated_at = NOW(),
    updated_by = p_user_id
  WHERE id = p_shipment_id;

  -- Log status change
  INSERT INTO shipment_status_history (shipment_id, status, changed_by, notes)
  VALUES (p_shipment_id, p_new_status, p_user_id, 'Status updated via update_shipment_status_safe');

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Validate status transitions
CREATE OR REPLACE FUNCTION is_valid_status_transition(
  p_current_status shipment_status,
  p_new_status shipment_status
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Define valid transitions
  RETURN CASE
    -- From pending
    WHEN p_current_status = 'pending' THEN
      p_new_status IN ('accepted', 'cancelled')
    
    -- From accepted
    WHEN p_current_status = 'accepted' THEN
      p_new_status IN ('driver_en_route', 'cancelled')
    
    -- From driver_en_route
    WHEN p_current_status = 'driver_en_route' THEN
      p_new_status IN ('driver_arrived', 'cancelled')
    
    -- From driver_arrived
    WHEN p_current_status = 'driver_arrived' THEN
      p_new_status IN ('pickup_verification_pending', 'cancelled')
    
    -- From pickup_verification_pending
    WHEN p_current_status = 'pickup_verification_pending' THEN
      p_new_status IN ('pickup_verified', 'cancelled')
    
    -- From pickup_verified
    WHEN p_current_status = 'pickup_verified' THEN
      p_new_status IN ('picked_up', 'cancelled')
    
    -- From picked_up
    WHEN p_current_status = 'picked_up' THEN
      p_new_status IN ('in_transit', 'cancelled')
    
    -- From in_transit
    WHEN p_current_status = 'in_transit' THEN
      p_new_status IN ('delivered', 'cancelled')
    
    -- From delivered (should not change)
    WHEN p_current_status = 'delivered' THEN
      FALSE
    
    -- From cancelled (should not change)
    WHEN p_current_status = 'cancelled' THEN
      FALSE
    
    ELSE FALSE
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
DROP TRIGGER IF EXISTS update_pickup_verifications_updated_at ON pickup_verifications;
CREATE TRIGGER update_pickup_verifications_updated_at
  BEFORE UPDATE ON pickup_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cancellation_records_updated_at ON cancellation_records;
CREATE TRIGGER update_cancellation_records_updated_at
  BEFORE UPDATE ON cancellation_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. VERIFICATION QUERIES
-- ============================================================================

-- Verify tables created
SELECT 
  'pickup_verifications' AS table_name,
  COUNT(*) AS row_count
FROM pickup_verifications
UNION ALL
SELECT 
  'cancellation_records',
  COUNT(*)
FROM cancellation_records;

-- Check new shipment columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'shipments'
AND column_name IN (
  'driver_arrival_time',
  'pickup_verified',
  'pickup_verified_at',
  'pickup_verification_status',
  'actual_pickup_time',
  'cancellation_record_id'
)
ORDER BY column_name;

-- Test refund calculation function
SELECT * FROM calculate_cancellation_refund(500.00, 'at_pickup_mismatch', FALSE);
SELECT * FROM calculate_cancellation_refund(500.00, 'at_pickup_fraud', TRUE);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Create API endpoints for pickup verification
-- 2. Build mobile UI components
-- 3. Integrate Stripe refund logic
-- 4. Add admin dashboard features
-- ============================================================================
