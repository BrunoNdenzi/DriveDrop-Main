-- Create a test shipment for messaging testing
-- This script creates a test shipment with proper participants for messaging

-- First, let's ensure we have test users
INSERT INTO profiles (id, first_name, last_name, role, created_at, updated_at)
VALUES 
  ('123e4567-e89b-12d3-a456-426614174001', 'Test', 'Client', 'client', NOW(), NOW()),
  ('123e4567-e89b-12d3-a456-426614174002', 'Test', 'Driver', 'driver', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role,
  updated_at = NOW();

-- Create a test shipment
INSERT INTO shipments (
  id,
  client_id, 
  driver_id,
  pickup_location,
  delivery_location,
  status,
  created_at,
  updated_at
)
VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  '123e4567-e89b-12d3-a456-426614174001', -- test client
  '123e4567-e89b-12d3-a456-426614174002', -- test driver
  'Test Pickup Location',
  'Test Delivery Location', 
  'accepted',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  updated_at = NOW();

-- Verify the test data
SELECT 'Test shipment created:' as info;
SELECT id, client_id, driver_id, status FROM shipments WHERE id = '123e4567-e89b-12d3-a456-426614174000';

SELECT 'Test profiles created:' as info;
SELECT id, first_name, last_name, role FROM profiles WHERE id IN (
  '123e4567-e89b-12d3-a456-426614174001',
  '123e4567-e89b-12d3-a456-426614174002'
);
