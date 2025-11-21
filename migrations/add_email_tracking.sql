-- ============================================
-- Add Email Tracking for Invoice/Receipt System
-- ============================================
-- Purpose: Track email delivery status for booking confirmations and delivery receipts
-- Run Date: 2025-01-30

-- Add email tracking columns to shipments table
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS upfront_payment_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS final_receipt_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS driver_payout_notified BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN shipments.upfront_payment_sent IS 'True if booking confirmation email (20% payment) was sent';
COMMENT ON COLUMN shipments.final_receipt_sent IS 'True if delivery receipt email (80% payment) was sent to client';
COMMENT ON COLUMN shipments.driver_payout_notified IS 'True if driver payout notification was sent';

-- Create payment_receipts table for tracking all receipts
CREATE TABLE IF NOT EXISTS payment_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  receipt_type VARCHAR(20) NOT NULL CHECK (receipt_type IN ('upfront', 'final', 'refund')),
  amount DECIMAL(10, 2) NOT NULL,
  sent_to_email VARCHAR(255) NOT NULL,
  email_status VARCHAR(20) DEFAULT 'sent' CHECK (email_status IN ('sent', 'delivered', 'failed', 'bounced')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB -- Store additional data like pricing breakdown, payment method last4, etc.
);

-- Add comments
COMMENT ON TABLE payment_receipts IS 'Tracks all email receipts sent for payments';
COMMENT ON COLUMN payment_receipts.receipt_number IS 'Unique receipt number format: DD-{shipmentId}-{sequence}';
COMMENT ON COLUMN payment_receipts.receipt_type IS 'Type: upfront (20%), final (80%), or refund';
COMMENT ON COLUMN payment_receipts.email_status IS 'Email delivery status from email service';
COMMENT ON COLUMN payment_receipts.metadata IS 'JSON data: pricing breakdown, payment details, etc.';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_receipts_shipment ON payment_receipts(shipment_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_type ON payment_receipts(receipt_type);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_email ON payment_receipts(sent_to_email);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_status ON payment_receipts(email_status);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_sent_at ON payment_receipts(sent_at);

-- Create function to generate receipt numbers
CREATE OR REPLACE FUNCTION generate_receipt_number(
  p_shipment_id UUID,
  p_receipt_type VARCHAR
) RETURNS VARCHAR AS $$
DECLARE
  v_sequence INT;
  v_receipt_number VARCHAR;
BEGIN
  -- Determine sequence based on type
  v_sequence := CASE p_receipt_type
    WHEN 'upfront' THEN 1
    WHEN 'final' THEN 2
    WHEN 'refund' THEN 3
    ELSE 0
  END;
  
  -- Generate receipt number: DD-{shipmentId}-{sequence}
  v_receipt_number := 'DD-' || p_shipment_id::TEXT || '-' || LPAD(v_sequence::TEXT, 2, '0');
  
  RETURN v_receipt_number;
END;
$$ LANGUAGE plpgsql;

-- Create helper function to insert receipt record
CREATE OR REPLACE FUNCTION insert_payment_receipt(
  p_shipment_id UUID,
  p_receipt_type VARCHAR,
  p_amount DECIMAL,
  p_sent_to_email VARCHAR,
  p_metadata JSONB DEFAULT '{}'::JSONB
) RETURNS UUID AS $$
DECLARE
  v_receipt_id UUID;
  v_receipt_number VARCHAR;
BEGIN
  -- Generate receipt number
  v_receipt_number := generate_receipt_number(p_shipment_id, p_receipt_type);
  
  -- Insert receipt record
  INSERT INTO payment_receipts (
    shipment_id,
    receipt_number,
    receipt_type,
    amount,
    sent_to_email,
    metadata
  ) VALUES (
    p_shipment_id,
    v_receipt_number,
    p_receipt_type,
    p_amount,
    p_sent_to_email,
    p_metadata
  )
  RETURNING id INTO v_receipt_id;
  
  RETURN v_receipt_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to mark email as sent
CREATE OR REPLACE FUNCTION mark_email_sent(
  p_shipment_id UUID,
  p_email_type VARCHAR -- 'upfront', 'final', or 'driver_payout'
) RETURNS VOID AS $$
BEGIN
  IF p_email_type = 'upfront' THEN
    UPDATE shipments 
    SET upfront_payment_sent = TRUE 
    WHERE id = p_shipment_id;
  ELSIF p_email_type = 'final' THEN
    UPDATE shipments 
    SET final_receipt_sent = TRUE 
    WHERE id = p_shipment_id;
  ELSIF p_email_type = 'driver_payout' THEN
    UPDATE shipments 
    SET driver_payout_notified = TRUE 
    WHERE id = p_shipment_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON payment_receipts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON payment_receipts TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Enable Row Level Security
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own receipts
CREATE POLICY "Users can view their own payment receipts"
ON payment_receipts
FOR SELECT
USING (
  shipment_id IN (
    SELECT id FROM shipments 
    WHERE client_id = auth.uid() 
    OR driver_id = auth.uid()
  )
);

-- RLS Policy: Service role can insert receipts
CREATE POLICY "Service role can insert payment receipts"
ON payment_receipts
FOR INSERT
WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- RLS Policy: Admins can see all receipts
CREATE POLICY "Admins can view all payment receipts"
ON payment_receipts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ============================================
-- Verification Queries
-- ============================================

-- Check if columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'shipments'
AND column_name IN ('upfront_payment_sent', 'final_receipt_sent', 'driver_payout_notified');

-- Check if table was created
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_name = 'payment_receipts';

-- Check if indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'payment_receipts';

-- Check if functions were created
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN ('generate_receipt_number', 'insert_payment_receipt', 'mark_email_sent');

-- ============================================
-- Example Usage
-- ============================================

/*
-- Example 1: Insert upfront payment receipt
SELECT insert_payment_receipt(
  'your-shipment-uuid-here',
  'upfront',
  255.74,
  'client@example.com',
  '{"payment_method": "4242", "charged_date": "2025-01-30", "vehicle": "2020 Toyota Camry"}'::JSONB
);

-- Example 2: Mark upfront email as sent
SELECT mark_email_sent('your-shipment-uuid-here', 'upfront');

-- Example 3: Query receipts for a shipment
SELECT 
  receipt_number,
  receipt_type,
  amount,
  email_status,
  sent_at,
  metadata->>'payment_method' as payment_method
FROM payment_receipts
WHERE shipment_id = 'your-shipment-uuid-here'
ORDER BY sent_at DESC;

-- Example 4: Check email status for all shipments
SELECT 
  s.id,
  s.upfront_payment_sent,
  s.final_receipt_sent,
  s.driver_payout_notified,
  COUNT(pr.id) as receipt_count
FROM shipments s
LEFT JOIN payment_receipts pr ON s.id = pr.shipment_id
GROUP BY s.id;
*/

-- ============================================
-- Rollback Script (if needed)
-- ============================================

/*
-- Drop policies
DROP POLICY IF EXISTS "Users can view their own payment receipts" ON payment_receipts;
DROP POLICY IF EXISTS "Service role can insert payment receipts" ON payment_receipts;
DROP POLICY IF EXISTS "Admins can view all payment receipts" ON payment_receipts;

-- Drop functions
DROP FUNCTION IF EXISTS mark_email_sent(UUID, VARCHAR);
DROP FUNCTION IF EXISTS insert_payment_receipt(UUID, VARCHAR, DECIMAL, VARCHAR, JSONB);
DROP FUNCTION IF EXISTS generate_receipt_number(UUID, VARCHAR);

-- Drop table
DROP TABLE IF EXISTS payment_receipts;

-- Remove columns
ALTER TABLE shipments DROP COLUMN IF EXISTS upfront_payment_sent;
ALTER TABLE shipments DROP COLUMN IF EXISTS final_receipt_sent;
ALTER TABLE shipments DROP COLUMN IF EXISTS driver_payout_notified;
*/

-- ============================================
-- Migration Complete!
-- ============================================
SELECT 'Email tracking migration completed successfully!' AS status;
