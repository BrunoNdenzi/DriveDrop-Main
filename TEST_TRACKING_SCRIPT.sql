-- Test Script for Real-Time GPS Tracking System
-- This script inserts test location data to verify the tracking page works

-- INSTRUCTIONS:
-- 1. Get your shipment ID from the URL: localhost:3000/dashboard/client/track/[SHIPMENT_ID]
-- 2. Replace 'YOUR_SHIPMENT_ID_HERE' below with the actual shipment ID
-- 3. Replace 'YOUR_DRIVER_ID_HERE' with the driver_id from the shipments table
-- 4. Run this in Supabase SQL Editor or via psql
-- 5. Refresh the tracking page to see the driver location appear on the map

-- Get shipment and driver info first:
-- SELECT id, driver_id, status, pickup_lat, pickup_lng, delivery_lat, delivery_lng 
-- FROM shipments 
-- WHERE id = 'YOUR_SHIPMENT_ID_HERE';

-- Insert test driver location (slightly offset from pickup location)
-- Replace these UUIDs with your actual shipment_id and driver_id
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
VALUES (
  'YOUR_DRIVER_ID_HERE'::uuid,  -- Replace with actual driver_id from shipments table
  'YOUR_SHIPMENT_ID_HERE'::uuid, -- Replace with your shipment id (from URL)
  33.7490,  -- Example: Atlanta area (adjust based on your shipment's pickup location)
  -84.3880,
  10.0,     -- 10 meters accuracy
  15.0,     -- 15 m/s speed (about 33 mph)
  90.0,     -- Heading: 90 degrees (east)
  NOW()
);

-- Query to verify the location was inserted
SELECT * FROM driver_locations 
WHERE shipment_id = 'YOUR_SHIPMENT_ID_HERE'::uuid
ORDER BY location_timestamp DESC
LIMIT 1;

-- Update the location every few seconds to simulate movement
-- Run this multiple times with different coordinates to see real-time updates

-- Example: Move driver slightly (0.001 degrees ≈ 100 meters)
-- UPDATE driver_locations 
-- SET 
--   latitude = latitude + 0.001,
--   longitude = longitude + 0.001,
--   heading = 45.0,
--   location_timestamp = NOW()
-- WHERE shipment_id = 'YOUR_SHIPMENT_ID_HERE'::uuid
-- AND id = (
--   SELECT id FROM driver_locations 
--   WHERE shipment_id = 'YOUR_SHIPMENT_ID_HERE'::uuid
--   ORDER BY location_timestamp DESC 
--   LIMIT 1
-- );
