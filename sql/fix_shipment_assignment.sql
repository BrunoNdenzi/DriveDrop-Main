-- Fix for shipment status assignment issues

-- Create a new function for assigning drivers that avoids type casting issues
CREATE OR REPLACE FUNCTION assign_driver_to_shipment(
  p_shipment_id UUID,
  p_driver_id UUID
) RETURNS boolean AS $$
DECLARE
  current_driver_id UUID;
BEGIN
  -- Check if the shipment already has a driver assigned
  SELECT driver_id INTO current_driver_id 
  FROM shipments 
  WHERE id = p_shipment_id;
  
  IF current_driver_id IS NOT NULL AND current_driver_id != p_driver_id THEN
    RAISE EXCEPTION 'This shipment has already been assigned to a driver';
  END IF;
  
  -- Update the shipment with the driver ID
  UPDATE shipments 
  SET 
    driver_id = p_driver_id,
    updated_at = now()
  WHERE 
    id = p_shipment_id;
    
  -- Set the status separately with proper casting to handle the enum type
  UPDATE shipments 
  SET 
    status = 'assigned'::shipment_status
  WHERE 
    id = p_shipment_id;
    
  -- Create a tracking event if that table exists
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tracking_events' AND schemaname = 'public') THEN
    BEGIN
      INSERT INTO tracking_events (
        shipment_id, 
        event_type, 
        description,
        created_at
      ) VALUES (
        p_shipment_id,
        'in_transit'::tracking_event_type,  -- Cast explicitly to tracking_event_type
        'Driver assigned to shipment',
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      -- Ignore errors with tracking events
      NULL;
    END;
  END IF;
  
  -- Update the application status to 'accepted' for the assigned driver
  -- and 'rejected' for all other applications for this shipment
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'job_applications' AND schemaname = 'public') THEN
    -- Accept the selected driver's application
    UPDATE job_applications
    SET 
      status = 'accepted',
      updated_at = now()
    WHERE 
      shipment_id = p_shipment_id AND
      driver_id = p_driver_id;
      
    -- Reject all other applications
    UPDATE job_applications
    SET 
      status = 'rejected',
      updated_at = now()
    WHERE 
      shipment_id = p_shipment_id AND
      driver_id != p_driver_id;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
