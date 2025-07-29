-- Create the assign_driver_to_shipment function
CREATE OR REPLACE FUNCTION assign_driver_to_shipment(
  p_shipment_id UUID,
  p_driver_id UUID
) RETURNS boolean AS $$
DECLARE
  current_driver_id UUID;
  valid_statuses text[];
  status_to_use text;
  valid_event_types text[];
  event_type_to_use text;
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
    
  -- Get the enum values for shipment_status
  SELECT array_agg(enumlabel) INTO valid_statuses
  FROM pg_enum
  WHERE enumtypid = 'shipment_status'::regtype;
  
  -- Try to find a suitable status value
  IF array_position(valid_statuses, 'assigned') IS NOT NULL THEN
    status_to_use := 'assigned';
  ELSIF array_position(valid_statuses, 'in_progress') IS NOT NULL THEN
    status_to_use := 'in_progress';
  ELSIF array_position(valid_statuses, 'in_transit') IS NOT NULL THEN
    status_to_use := 'in_transit';
  ELSE
    -- Fallback to the second status in the enum if none of the above exist
    SELECT enumlabel INTO status_to_use
    FROM pg_enum
    WHERE enumtypid = 'shipment_status'::regtype
    OFFSET 1 LIMIT 1;
  END IF;
  
  -- Apply the status change
  EXECUTE format('UPDATE shipments SET status = %L::shipment_status WHERE id = %L', 
                status_to_use, p_shipment_id);
  
  -- Manually add a tracking event without relying on triggers
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tracking_events' AND schemaname = 'public') THEN
    -- Get the enum values for tracking_event_type
    SELECT array_agg(enumlabel) INTO valid_event_types
    FROM pg_enum
    WHERE enumtypid = 'tracking_event_type'::regtype;
    
    -- Choose an appropriate tracking event type
    IF array_position(valid_event_types, 'driver_assigned') IS NOT NULL THEN
      event_type_to_use := 'driver_assigned';
    ELSIF array_position(valid_event_types, 'in_transit') IS NOT NULL THEN
      event_type_to_use := 'in_transit';
    ELSIF array_position(valid_event_types, 'pickup') IS NOT NULL THEN
      event_type_to_use := 'pickup';
    ELSE
      -- Fallback to the first event type in the enum
      SELECT enumlabel INTO event_type_to_use
      FROM pg_enum
      WHERE enumtypid = 'tracking_event_type'::regtype
      LIMIT 1;
    END IF;
    
    -- Insert the tracking event with the proper type
    BEGIN
      EXECUTE format('INSERT INTO tracking_events (
        shipment_id, 
        event_type, 
        description,
        created_at
      ) VALUES (
        %L,
        %L::tracking_event_type,
        %L,
        %L
      )', 
      p_shipment_id, 
      event_type_to_use,
      'Driver assigned to shipment',
      now());
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
