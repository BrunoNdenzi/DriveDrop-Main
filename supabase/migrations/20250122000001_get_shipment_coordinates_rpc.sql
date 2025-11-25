-- Drop existing function first
DROP FUNCTION IF EXISTS get_shipment_coordinates(uuid);

-- Create RPC function to extract pickup and delivery coordinates from shipment
CREATE OR REPLACE FUNCTION get_shipment_coordinates(shipment_id uuid)
RETURNS TABLE (
  pickup_lat double precision,
  pickup_lng double precision,
  delivery_lat double precision,
  delivery_lng double precision
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ST_Y(pickup_location::geometry) as pickup_lat,
    ST_X(pickup_location::geometry) as pickup_lng,
    ST_Y(delivery_location::geometry) as delivery_lat,
    ST_X(delivery_location::geometry) as delivery_lng
  FROM shipments
  WHERE id = shipment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_shipment_coordinates(uuid) TO authenticated;

COMMENT ON FUNCTION get_shipment_coordinates IS 'Extracts latitude and longitude from PostGIS geometry columns for a shipment';
