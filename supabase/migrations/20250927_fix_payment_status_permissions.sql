-- Migration: fix payment_status update permissions
-- Description: Add a specific policy allowing service-role to update payment_status field

-- First, let's add a policy that allows the service role client to update payment_status
CREATE POLICY "Service role can update payment_status on shipments"
ON public.shipments
FOR UPDATE
TO service_role
USING (true);

-- Add a comment explaining this policy
COMMENT ON POLICY "Service role can update payment_status on shipments" ON public.shipments
IS 'Allows service role to update payment_status field for webhook processing';