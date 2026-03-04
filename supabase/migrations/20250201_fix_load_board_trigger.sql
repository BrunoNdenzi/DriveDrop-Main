-- =====================================================
-- FIX: auto_publish_to_load_board trigger
-- The original trigger tried to insert columns that don't exist on load_board
-- (broker_id, pickup_city, vehicle_make, etc.)
-- The load_board table uses: shipment_id, posted_by, visibility, load_status,
-- bidding_enabled, suggested_carrier_payout, max_broker_commission, expires_at
-- =====================================================

-- Drop old trigger first
DROP TRIGGER IF EXISTS trigger_auto_publish_to_load_board ON broker_shipments;
DROP FUNCTION IF EXISTS auto_publish_to_load_board();

-- Create corrected function
CREATE OR REPLACE FUNCTION auto_publish_to_load_board()
RETURNS TRIGGER AS $$
DECLARE
  new_shipment_id UUID;
BEGIN
  -- When broker shipment status changes to 'booked' and not yet on load board
  IF NEW.status = 'booked' AND (OLD.status IS NULL OR OLD.status != 'booked') AND NEW.load_board_id IS NULL THEN
    
    -- First create a mirror shipment in the main shipments table
    -- (load_board references shipments via shipment_id FK)
    INSERT INTO shipments (
      client_id,
      pickup_address,
      dropoff_address,
      vehicle_year,
      vehicle_make,
      vehicle_model,
      vehicle_type,
      vehicle_condition,
      transport_type,
      is_operable,
      distance,
      estimated_price,
      status,
      special_instructions
    ) VALUES (
      NEW.broker_id,  -- broker acts as client for the mirror shipment
      COALESCE(NEW.pickup_address, '') || ', ' || COALESCE(NEW.pickup_city, '') || ', ' || COALESCE(NEW.pickup_state, '') || ' ' || COALESCE(NEW.pickup_zip, ''),
      COALESCE(NEW.delivery_address, '') || ', ' || COALESCE(NEW.delivery_city, '') || ', ' || COALESCE(NEW.delivery_state, '') || ' ' || COALESCE(NEW.delivery_zip, ''),
      NEW.vehicle_year,
      NEW.vehicle_make,
      NEW.vehicle_model,
      NEW.vehicle_type,
      COALESCE(NEW.vehicle_condition, 'running'),
      COALESCE(NEW.transport_type, 'open'),
      COALESCE(NEW.is_operable, true),
      COALESCE(NEW.distance_miles, 0),
      COALESCE(NEW.estimated_price, 0),
      'quoted',
      NEW.notes
    )
    RETURNING id INTO new_shipment_id;

    -- Now insert into load_board with correct columns
    INSERT INTO load_board (
      shipment_id,
      posted_by,
      visibility,
      load_status,
      bidding_enabled,
      suggested_carrier_payout,
      max_broker_commission,
      expires_at
    ) VALUES (
      new_shipment_id,
      NEW.broker_id,
      'public',
      'available',
      true,
      COALESCE(NEW.estimated_price, 0) - COALESCE(NEW.broker_commission, 0) - COALESCE(NEW.platform_fee, 0),
      COALESCE(NEW.broker_commission, 0),
      NOW() + INTERVAL '7 days'
    )
    RETURNING id INTO NEW.load_board_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_auto_publish_to_load_board
  BEFORE UPDATE ON broker_shipments
  FOR EACH ROW
  EXECUTE FUNCTION auto_publish_to_load_board();

-- Add helpful comments
COMMENT ON FUNCTION auto_publish_to_load_board() IS 'Automatically publishes broker shipment to load board when status changes to booked';
