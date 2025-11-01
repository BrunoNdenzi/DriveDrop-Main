-- Function to extract lat/lng from shipment pickup_location GEOGRAPHY type
CREATE OR REPLACE FUNCTION get_shipment_coordinates(shipment_id uuid)
RETURNS TABLE (lat double precision, lng double precision) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ST_Y(pickup_location::geometry) as lat,
    ST_X(pickup_location::geometry) as lng
  FROM shipments
  WHERE id = shipment_id
    AND pickup_location IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
