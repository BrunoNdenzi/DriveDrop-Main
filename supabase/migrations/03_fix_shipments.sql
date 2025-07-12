-- Fix shipment table issues for better compatibility
-- This migration makes pickup_location and delivery_location optional
-- and adds better defaults for easier testing

-- Make geography columns nullable for easier development
ALTER TABLE shipments ALTER COLUMN pickup_location DROP NOT NULL;
ALTER TABLE shipments ALTER COLUMN delivery_location DROP NOT NULL;

-- Add simplified location fields for testing (can be removed in production)
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS pickup_city TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS pickup_state TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS pickup_zip TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS delivery_city TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS delivery_state TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS delivery_zip TEXT;

-- Create shipment_applications table if it doesn't exist
CREATE TABLE IF NOT EXISTS shipment_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(shipment_id, driver_id)
);

-- Add RLS for shipment_applications
ALTER TABLE shipment_applications ENABLE ROW LEVEL SECURITY;

-- RLS policies for shipment_applications
CREATE POLICY "Users can view their own applications" ON shipment_applications
  FOR SELECT USING (driver_id = auth.uid());

CREATE POLICY "Drivers can apply for shipments" ON shipment_applications
  FOR INSERT WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Clients can view applications for their shipments" ON shipment_applications
  FOR SELECT USING (
    shipment_id IN (
      SELECT id FROM shipments WHERE client_id = auth.uid()
    )
  );

-- Update shipment policies to be more permissive for development
DROP POLICY IF EXISTS "Users can view their own shipments" ON shipments;
CREATE POLICY "Users can view their own shipments" ON shipments
  FOR SELECT USING (client_id = auth.uid() OR driver_id = auth.uid());

DROP POLICY IF EXISTS "Clients can create shipments" ON shipments;
CREATE POLICY "Clients can create shipments" ON shipments
  FOR INSERT WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their shipments" ON shipments;
CREATE POLICY "Users can update their shipments" ON shipments
  FOR UPDATE USING (client_id = auth.uid() OR driver_id = auth.uid());

-- Allow drivers to view all pending shipments for job browsing
DROP POLICY IF EXISTS "Drivers can view available shipments" ON shipments;
CREATE POLICY "Drivers can view available shipments" ON shipments
  FOR SELECT USING (status = 'pending' AND driver_id IS NULL);
