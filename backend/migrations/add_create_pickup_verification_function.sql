-- Function to create pickup verification record with PostGIS location
CREATE OR REPLACE FUNCTION create_pickup_verification(
  p_shipment_id uuid,
  p_driver_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy numeric
)
RETURNS void AS $$
BEGIN
  INSERT INTO pickup_verifications (
    shipment_id,
    driver_id,
    pickup_location,
    gps_accuracy_meters,
    verification_status,
    driver_photos,
    client_photos_reference
  ) VALUES (
    p_shipment_id,
    p_driver_id,
    ST_GeographyFromText('POINT(' || p_lng || ' ' || p_lat || ')'),
    p_accuracy,
    'pending',
    '[]'::jsonb,
    '[]'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
