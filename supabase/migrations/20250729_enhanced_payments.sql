-- Migration: Enhanced Payment Table for Split Payments
-- Add support for 20%/80% payment split and refund policies

-- First, check if the payments table exists and modify it
DO $$
BEGIN
  -- Add new columns to payments table if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'initial_amount') THEN
    ALTER TABLE payments ADD COLUMN initial_amount INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'remaining_amount') THEN
    ALTER TABLE payments ADD COLUMN remaining_amount INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'booking_timestamp') THEN
    ALTER TABLE payments ADD COLUMN booking_timestamp TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'refund_deadline') THEN
    ALTER TABLE payments ADD COLUMN refund_deadline TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'is_refundable') THEN
    ALTER TABLE payments ADD COLUMN is_refundable BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'payment_type') THEN
    ALTER TABLE payments ADD COLUMN payment_type VARCHAR(20) DEFAULT 'initial';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'parent_payment_id') THEN
    ALTER TABLE payments ADD COLUMN parent_payment_id UUID REFERENCES payments(id);
  END IF;
END $$;

-- Add comments to explain the columns
COMMENT ON COLUMN payments.initial_amount IS 'Initial 20% payment amount in cents';
COMMENT ON COLUMN payments.remaining_amount IS 'Remaining 80% payment amount in cents';
COMMENT ON COLUMN payments.booking_timestamp IS 'When the initial payment was made';
COMMENT ON COLUMN payments.refund_deadline IS 'Deadline for refund eligibility (1 hour after booking)';
COMMENT ON COLUMN payments.is_refundable IS 'Whether this payment can still be refunded';
COMMENT ON COLUMN payments.payment_type IS 'Type: initial (20%) or final (80%)';
COMMENT ON COLUMN payments.parent_payment_id IS 'Reference to initial payment for final payments';

-- Create function to check refund eligibility
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

-- Create function to process final payment (80%)
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
    AND user_id = p_user_id
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

-- Update trigger to automatically mark payments as non-refundable after deadline
CREATE OR REPLACE FUNCTION update_refund_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Auto-update refundability when deadline passes
  IF NEW.refund_deadline IS NOT NULL AND NOW() > NEW.refund_deadline THEN
    NEW.is_refundable = FALSE;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_refund_status ON payments;
CREATE TRIGGER trigger_update_refund_status
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_refund_status();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_refund_deadline ON payments(refund_deadline) WHERE is_refundable = true;
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_parent ON payments(parent_payment_id) WHERE parent_payment_id IS NOT NULL;
