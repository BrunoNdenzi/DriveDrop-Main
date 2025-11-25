-- ============================================================
-- QUICK TEST: Insert Test Driver Location for Tracking Page
-- ============================================================
-- Shipment ID: 3aa90f68-bafd-4e8e-a874-0bba98332daa
--
-- STEP 1: Check if the shipment exists and get details
-- ============================================================

SELECT 
  id as shipment_id,
  driver_id,
  status,
  ST_Y(pickup_location::geometry) as pickup_lat,
  ST_X(pickup_location::geometry) as pickup_lng,
  ST_Y(delivery_location::geometry) as delivery_lat,
  ST_X(delivery_location::geometry) as delivery_lng,
  pickup_address,
  delivery_address
FROM shipments 
WHERE id = '3aa90f68-bafd-4e8e-a874-0bba98332daa';

-- ============================================================
-- STEP 2: Insert test driver location
-- Copy the driver_id from the result above and paste it below
-- ============================================================

-- First, drop the problematic trigger if it exists
DROP TRIGGER IF EXISTS update_driver_locations_updated_at_trigger ON public.driver_locations;
DROP FUNCTION IF EXISTS update_driver_locations_updated_at();

-- Using driver_id from the shipment with fallback coordinates
-- Note: If pickup_location is NULL, we use default Atlanta coordinates
INSERT INTO public.driver_locations (
  driver_id,
  shipment_id,
  latitude,
  longitude,
  accuracy,
  speed,
  heading,
  location_timestamp
)
SELECT
  driver_id,
  id,
  COALESCE(ST_Y(pickup_location::geometry), 33.7490) + 0.001,  -- Default to Atlanta if NULL
  COALESCE(ST_X(pickup_location::geometry), -84.3880) + 0.001,
  10.0,     -- 10 meters accuracy
  15.0,     -- 15 m/s (about 33 mph)
  90.0,     -- Heading east
  NOW()
FROM shipments
WHERE id = '3aa90f68-bafd-4e8e-a874-0bba98332daa'
  AND driver_id IS NOT NULL;

-- ============================================================
-- STEP 3: Verify the location was inserted
-- ============================================================

SELECT * FROM driver_locations 
WHERE shipment_id = '3aa90f68-bafd-4e8e-a874-0bba98332daa'
ORDER BY location_timestamp DESC
LIMIT 1;

-- ============================================================
-- STEP 4: Simulate movement (run this multiple times)
-- ============================================================
-- This updates the location to simulate the driver moving

UPDATE driver_locations 
SET 
  latitude = latitude + 0.001,  -- Move ~100m north
  longitude = longitude + 0.001,  -- Move ~100m east
  heading = 45.0,  -- Northeast
  speed = 20.0,  -- Increase speed
  location_timestamp = NOW()
WHERE shipment_id = '3aa90f68-bafd-4e8e-a874-0bba98332daa'
AND id = (
  SELECT id FROM driver_locations 
  WHERE shipment_id = '3aa90f68-bafd-4e8e-a874-0bba98332daa'
  ORDER BY location_timestamp DESC 
  LIMIT 1
);

-- Check updated location
SELECT 
  latitude, 
  longitude, 
  speed, 
  heading, 
  location_timestamp 
FROM driver_locations 
WHERE shipment_id = '3aa90f68-bafd-4e8e-a874-0bba98332daa'
ORDER BY location_timestamp DESC
LIMIT 1;

-- ============================================================
-- ALTERNATIVE: If you don't have a driver_id yet
-- ============================================================
-- This creates a test driver profile and assigns them to the shipment

-- First, create a test driver user (run this in Supabase Auth if needed)
-- Then insert their profile:

-- INSERT INTO profiles (id, role, first_name, last_name, phone)
-- VALUES (
--   'YOUR_NEW_DRIVER_UUID'::uuid,
--   'driver',
--   'Test',
--   'Driver',
--   '+1234567890'
-- );

-- Update the shipment with the driver
-- UPDATE shipments 
-- SET driver_id = 'YOUR_NEW_DRIVER_UUID'::uuid,
--     status = 'in_transit'
-- WHERE id = '3aa90f68-bafd-4e8e-a874-0bba98332daa';
