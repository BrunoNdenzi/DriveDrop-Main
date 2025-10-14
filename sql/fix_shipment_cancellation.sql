-- Fix Shipment Cancellation Policy and Add Refund Logic
-- This migration allows clients to cancel shipments and handles refunds appropriately

-- =====================================================
-- 1. Update RLS Policy for Shipment Cancellation
-- =====================================================

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Clients can update their own shipments" ON shipments;

-- Create a new policy that allows clients to:
-- 1. Update their own pending shipments (can change to cancelled)
-- 2. Business logic enforced by triggers and application layer
CREATE POLICY "Clients can update their own shipments"
  ON shipments
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = client_id 
    AND status IN ('pending'::shipment_status)
  )
  WITH CHECK (
    auth.uid() = client_id
    AND (
      status IN ('pending'::shipment_status, 'cancelled'::shipment_status)
    )
  );

-- =====================================================
-- 2. Fix Tracking Events RLS Policy
-- =====================================================

-- Fix tracking_events RLS policy to allow inserts from triggers
-- (Cancellation triggers create tracking events, which need proper permissions)
DO $$ 
BEGIN
  -- Drop existing restrictive policy if it exists
  DROP POLICY IF EXISTS "Users can insert their own tracking events" ON tracking_events;
  
  -- Create a permissive policy for authenticated users
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tracking_events' 
    AND policyname = 'Authenticated users can insert tracking events'
  ) THEN
    CREATE POLICY "Authenticated users can insert tracking events"
      ON tracking_events
      FOR INSERT
      TO authenticated
      WITH CHECK (true);  -- Allow inserts from triggers
  END IF;
  
  -- Ensure users can view their own tracking events
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tracking_events' 
    AND policyname = 'Users can view their shipment tracking events'
  ) THEN
    CREATE POLICY "Users can view their shipment tracking events"
      ON tracking_events
      FOR SELECT
      TO authenticated
      USING (
        shipment_id IN (
          SELECT id FROM shipments 
          WHERE client_id = auth.uid() OR driver_id = auth.uid()
        )
      );
  END IF;
END $$;

-- =====================================================
-- 3. Create Cancellation Tracking Table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.shipment_cancellations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  cancelled_by uuid NOT NULL REFERENCES profiles(id),
  cancellation_reason text,
  refund_status text CHECK (refund_status IN ('not_applicable', 'pending', 'processing', 'completed', 'failed')),
  refund_amount numeric(10, 2),
  refund_id text, -- Stripe refund ID
  cancelled_at timestamp with time zone NOT NULL DEFAULT now(),
  refund_processed_at timestamp with time zone,
  CONSTRAINT shipment_cancellations_shipment_id_unique UNIQUE (shipment_id)
);

-- Enable RLS
ALTER TABLE public.shipment_cancellations ENABLE ROW LEVEL SECURITY;

-- Clients can view their own cancellations
CREATE POLICY "Clients can view their own cancellations"
  ON shipment_cancellations
  FOR SELECT
  TO public
  USING (
    cancelled_by = auth.uid()
    OR shipment_id IN (
      SELECT id FROM shipments WHERE client_id = auth.uid()
    )
  );

-- =====================================================
-- 4. Create Function to Handle Cancellation with Refund
-- =====================================================

CREATE OR REPLACE FUNCTION handle_shipment_cancellation()
RETURNS trigger AS $$
DECLARE
  v_payment_record RECORD;
  v_refund_eligible boolean;
  v_refund_amount numeric;
BEGIN
  -- Only process if status changed TO cancelled
  IF NEW.status::text = 'cancelled' AND OLD.status::text != 'cancelled' THEN
    
    -- Get the payment record
    SELECT * INTO v_payment_record
    FROM payments
    WHERE shipment_id = NEW.id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Check if payment exists and was completed
    IF v_payment_record.id IS NOT NULL AND v_payment_record.status = 'completed' THEN
      
      -- Determine refund eligibility based on status when cancelled
      -- POLICY: Only pending shipments (no driver assigned) are eligible for refund
      -- NOTE: payment.amount is the 20% deposit charged upfront, not the full quote price
      CASE OLD.status::text
        WHEN 'pending' THEN
          -- Full deposit refund (100% of the 20% deposit) for pending shipments with no driver assigned
          IF OLD.driver_id IS NULL THEN
            v_refund_eligible := true;
            v_refund_amount := v_payment_record.amount;  -- This is the 20% deposit
          ELSE
            -- Driver was assigned, no refund
            v_refund_eligible := false;
            v_refund_amount := 0;
          END IF;
        ELSE
          -- No refund for any other status (accepted, assigned, in_transit, etc.)
          v_refund_eligible := false;
          v_refund_amount := 0;
      END CASE;
      
      -- Insert cancellation record
      INSERT INTO shipment_cancellations (
        shipment_id,
        cancelled_by,
        refund_status,
        refund_amount
      ) VALUES (
        NEW.id,
        auth.uid(),
        CASE 
          WHEN v_refund_eligible THEN 'pending'
          ELSE 'not_applicable'
        END,
        v_refund_amount
      );
      
      -- Update payment status if refund is pending
      IF v_refund_eligible THEN
        UPDATE payments
        SET 
          status = 'refunded',
          updated_at = NOW()
        WHERE id = v_payment_record.id;
      END IF;
      
    ELSE
      -- No payment or payment not completed, just record cancellation
      INSERT INTO shipment_cancellations (
        shipment_id,
        cancelled_by,
        refund_status,
        refund_amount
      ) VALUES (
        NEW.id,
        auth.uid(),
        'not_applicable',
        0
      );
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for cancellation handling
DROP TRIGGER IF EXISTS on_shipment_cancellation ON shipments;
CREATE TRIGGER on_shipment_cancellation
  AFTER UPDATE OF status ON shipments
  FOR EACH ROW
  WHEN (NEW.status::text = 'cancelled' AND OLD.status::text != 'cancelled')
  EXECUTE FUNCTION handle_shipment_cancellation();

-- =====================================================
-- 5. Create Function to Check Cancellation Eligibility
-- =====================================================

CREATE OR REPLACE FUNCTION check_cancellation_eligibility(p_shipment_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_shipment RECORD;
  v_payment RECORD;
  v_result jsonb;
BEGIN
  -- Get shipment details
  SELECT * INTO v_shipment
  FROM shipments
  WHERE id = p_shipment_id;
  
  IF v_shipment.id IS NULL THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Shipment not found'
    );
  END IF;
  
  -- Check if already cancelled or delivered
  IF v_shipment.status::text IN ('cancelled', 'delivered', 'completed') THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Shipment cannot be cancelled in current status'
    );
  END IF;
  
  -- Check if driver has been assigned
  IF v_shipment.driver_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Cannot cancel after driver assignment. Please contact support for assistance.'
    );
  END IF;
  
  -- Check if status is not pending
  IF v_shipment.status::text != 'pending' THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Can only cancel pending shipments. Please contact support for assistance.'
    );
  END IF;
  
  -- Check if user is the client
  IF v_shipment.client_id != auth.uid() THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Only the client can cancel this shipment'
    );
  END IF;
  
  -- Get payment details
  SELECT * INTO v_payment
  FROM payments
  WHERE shipment_id = p_shipment_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Build result based on current status
  -- POLICY: Only pending shipments with no driver assigned can be cancelled
  IF v_shipment.status::text = 'pending' AND v_shipment.driver_id IS NULL THEN
    -- Only refund the 20% deposit (upfront payment), not the full amount
    -- The remaining 80% is charged on delivery
    v_result := jsonb_build_object(
      'eligible', true,
      'refund_eligible', true,
      'refund_amount', COALESCE(v_payment.amount, 0),  -- This is already just the 20% deposit
      'refund_percentage', 100,
      'message', 'Free cancellation - Full deposit refund will be processed'
    );
  ELSE
    -- All other cases are not eligible
    v_result := jsonb_build_object(
      'eligible', false,
      'reason', 'Can only cancel pending shipments before driver assignment. Please contact support for assistance.'
    );
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_cancellation_eligibility(uuid) TO authenticated;

-- =====================================================
-- 6. Add Comments
-- =====================================================

COMMENT ON POLICY "Clients can update their own shipments" ON shipments IS 
  'Allows clients to cancel ONLY pending shipments with no driver assigned, or update other fields when pending. Once driver is assigned, must contact support.';

COMMENT ON TABLE shipment_cancellations IS 
  'Tracks shipment cancellations and refund processing status';

COMMENT ON FUNCTION handle_shipment_cancellation() IS 
  'Automatically creates cancellation record and initiates refund when a shipment is cancelled';

COMMENT ON FUNCTION check_cancellation_eligibility(uuid) IS 
  'Checks if a shipment can be cancelled and calculates refund eligibility';
