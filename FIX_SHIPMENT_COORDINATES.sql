-- ============================================================
-- Fix Shipment Coordinates for Tracking
-- ============================================================
-- This updates the shipment with proper PostGIS geometry from known coordinates

-- For shipment: 3aa90f68-bafd-4e8e-a874-0bba98332daa
-- Pickup: San Diego, CA 92116, USA (approx: 32.7631, -117.1245)
-- Delivery: 11000 Wilshire Blvd, Los Angeles, CA 90024, USA (approx: 34.0592, -118.4441)

UPDATE shipments
SET 
  pickup_location = ST_GeographyFromText('POINT(-117.1245 32.7631)'),
  delivery_location = ST_GeographyFromText('POINT(-118.4441 34.0592)')
WHERE id = '3aa90f68-bafd-4e8e-a874-0bba98332daa';

-- Verify the update
SELECT 
  id,
  status,
  pickup_address,
  delivery_address,
  ST_Y(pickup_location::geometry) as pickup_lat,
  ST_X(pickup_location::geometry) as pickup_lng,
  ST_Y(delivery_location::geometry) as delivery_lat,
  ST_X(delivery_location::geometry) as delivery_lng
FROM shipments 
WHERE id = '3aa90f68-bafd-4e8e-a874-0bba98332daa';

-- Note: These are approximate coordinates for the addresses.
-- In production, you should use a geocoding service (Google Maps Geocoding API)
-- to get exact coordinates from addresses.
