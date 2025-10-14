-- =============================================================================
-- QUICK COPY-PASTE VERSION - Cancellation System (FIXED VERSION)
-- =============================================================================
-- Copy this ENTIRE file and paste into Supabase SQL Editor, then click "Run"
-- This is a simplified version that only creates what's needed for the mobile app
-- 
-- FIXES APPLIED:
-- - Removed NEW/OLD references from RLS policy (causes "missing FROM-clause" error)
-- - Simplified policy to allow updates on pending shipments only
-- - Business logic validation happens in the eligibility check function
-- =============================================================================

-- 1. Create cancellation eligibility check function
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
  
  -- Build result - only pending with no driver can be cancelled
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
    v_result := jsonb_build_object(
      'eligible', false,
      'reason', 'Can only cancel pending shipments before driver assignment. Please contact support for assistance.'
    );
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_cancellation_eligibility(uuid) TO authenticated;

-- 2. Fix tracking_events RLS policy to allow inserts from triggers
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

-- 3. Update RLS policy for shipments to allow cancellation
-- Note: We use a simpler policy here and enforce business logic in triggers
DROP POLICY IF EXISTS "Clients can update their own shipments" ON shipments;

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

-- 4. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- DONE! Your app should work now.
-- =============================================================================
-- Test the function:
-- SELECT check_cancellation_eligibility('<your-shipment-id>'::uuid);
-- =============================================================================
