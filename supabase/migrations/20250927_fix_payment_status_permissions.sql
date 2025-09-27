-- Migration: fix payment_status update permissions
-- Description: Add specific policies allowing service-role to manage payment_status field

-- First make sure RLS is enabled on the shipments table
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- Explicitly grant all privileges to the service role
GRANT ALL ON TABLE public.shipments TO service_role;

-- Add a policy that allows the service role client to update shipments
-- This is necessary for webhook processing
CREATE POLICY "Service role can manage all shipments"
ON public.shipments
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- Add a comment explaining this policy
COMMENT ON POLICY "Service role can manage all shipments" ON public.shipments
IS 'Allows service role to perform all operations on shipments, particularly for webhook processing';

-- Create a function to update payment status that bypasses RLS
CREATE OR REPLACE FUNCTION update_shipment_payment_status(
  p_shipment_id UUID,
  p_payment_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- This runs with the privileges of the function creator (superuser)
AS $$
BEGIN
  UPDATE public.shipments
  SET 
    payment_status = p_payment_status::payment_status,
    updated_at = NOW()
  WHERE id = p_shipment_id;
END;
$$;