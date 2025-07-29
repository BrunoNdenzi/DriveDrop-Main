-- Migration: Fix User ID vs Client ID Inconsistency
-- Fix the naming inconsistency between user_id and client_id in database functions

-- Fix the create_final_payment function to use client_id instead of user_id
CREATE OR REPLACE FUNCTION create_final_payment(
  p_shipment_id UUID,
  p_user_id UUID,
  p_parent_payment_id UUID
)
RETURNS TABLE(
  payment_intent_amount INTEGER,
  payment_intent_description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  parent_payment RECORD;
  final_payment_id UUID;
BEGIN
  -- Get parent payment details
  SELECT 
    remaining_amount,
    shipment_id
  INTO parent_payment
  FROM payments
  WHERE id = p_parent_payment_id
    AND client_id = p_user_id
    AND payment_type = 'initial'
    AND status = 'completed';
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid parent payment or payment not completed';
  END IF;
  
  -- Check if final payment already exists
  IF EXISTS (
    SELECT 1 FROM payments 
    WHERE parent_payment_id = p_parent_payment_id 
    AND payment_type = 'final'
  ) THEN
    RAISE EXCEPTION 'Final payment already processed for this shipment';
  END IF;
  
  -- Return payment intent details
  RETURN QUERY SELECT 
    parent_payment.remaining_amount,
    'Final 80% payment for DriveDrop shipment ' || p_shipment_id::TEXT;
END;
$$;

-- Fix the check_refund_eligibility function if it uses user_id instead of client_id
CREATE OR REPLACE FUNCTION check_refund_eligibility(payment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payment_record RECORD;
BEGIN
  SELECT 
    refund_deadline,
    is_refundable,
    status,
    payment_type
  INTO payment_record
  FROM payments
  WHERE id = payment_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Can only refund initial payments
  IF payment_record.payment_type != 'initial' THEN
    RETURN FALSE;
  END IF;
  
  -- Must be within refund deadline
  IF NOW() > payment_record.refund_deadline THEN
    RETURN FALSE;
  END IF;
  
  -- Must be refundable and completed
  IF NOT payment_record.is_refundable OR payment_record.status != 'completed' THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;
