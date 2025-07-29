-- Additional procedures for driver application management
-- This file should be executed after the table consolidation migration

-- 1. Create a function to get a driver's applications
CREATE OR REPLACE FUNCTION get_driver_applications(
  p_driver_id UUID,
  p_status TEXT DEFAULT NULL
) RETURNS SETOF job_applications AS $$
BEGIN
  IF p_status IS NULL THEN
    RETURN QUERY 
    SELECT * FROM job_applications
    WHERE driver_id = p_driver_id
    ORDER BY applied_at DESC;
  ELSE
    RETURN QUERY 
    SELECT * FROM job_applications
    WHERE driver_id = p_driver_id AND status = p_status
    ORDER BY applied_at DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create a function to update application status
CREATE OR REPLACE FUNCTION update_application_status(
  p_application_id UUID,
  p_status TEXT
) RETURNS job_applications AS $$
DECLARE
  updated_application job_applications;
BEGIN
  -- Validate the status value
  IF p_status NOT IN ('pending', 'accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %. Status must be pending, accepted, or rejected', p_status;
  END IF;
  
  -- Update the application
  UPDATE job_applications
  SET 
    status = p_status,
    responded_at = CASE WHEN p_status != 'pending' THEN now() ELSE responded_at END,
    updated_at = now()
  WHERE id = p_application_id
  RETURNING * INTO updated_application;
  
  -- If the application is accepted, trigger assignment to the shipment
  IF p_status = 'accepted' AND updated_application.id IS NOT NULL THEN
    -- First reject all other applications for this shipment
    UPDATE job_applications
    SET 
      status = 'rejected',
      responded_at = now(),
      updated_at = now()
    WHERE 
      shipment_id = updated_application.shipment_id AND
      id != p_application_id;
      
    -- Then update the shipment with the driver
    UPDATE shipments
    SET 
      driver_id = updated_application.driver_id,
      status = 'assigned',
      updated_at = now()
    WHERE id = updated_application.shipment_id;
  END IF;
  
  RETURN updated_application;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update the apply_for_shipment function to work with the consolidated job_applications table
CREATE OR REPLACE FUNCTION apply_for_shipment(
  p_shipment_id UUID,
  p_driver_id UUID
) RETURNS jsonb AS $$
DECLARE
  is_available boolean;
  result jsonb;
  existing_application_id UUID;
BEGIN
  -- Check if the shipment is available
  SELECT COUNT(*) > 0 INTO is_available
  FROM shipments
  WHERE 
    id = p_shipment_id AND
    status = 'pending' AND
    driver_id IS NULL;
  
  IF NOT is_available THEN
    -- Check if the shipment exists at all
    IF EXISTS (SELECT 1 FROM shipments WHERE id = p_shipment_id) THEN
      -- Check if it's assigned to a driver
      IF EXISTS (SELECT 1 FROM shipments WHERE id = p_shipment_id AND driver_id IS NOT NULL) THEN
        RAISE EXCEPTION 'This shipment has already been assigned to a driver';
      ELSE
        RAISE EXCEPTION 'This shipment is not available for applications';
      END IF;
    ELSE
      RAISE EXCEPTION 'Shipment not found';
    END IF;
  END IF;
  
  -- Check if the driver has already applied
  SELECT id INTO existing_application_id
  FROM job_applications
  WHERE shipment_id = p_shipment_id AND driver_id = p_driver_id;
  
  IF existing_application_id IS NOT NULL THEN
    -- Return existing application
    SELECT jsonb_build_object(
      'id', id,
      'shipment_id', shipment_id,
      'driver_id', driver_id,
      'status', status,
      'applied_at', applied_at,
      'updated_at', updated_at,
      'message', 'You have already applied for this shipment'
    ) INTO result
    FROM job_applications
    WHERE id = existing_application_id;
    
    RETURN result;
  END IF;
  
  -- Create a new application
  INSERT INTO job_applications (
    shipment_id,
    driver_id,
    status,
    applied_at,
    created_at,
    updated_at
  ) 
  VALUES (
    p_shipment_id,
    p_driver_id,
    'pending',
    now(),
    now(),
    now()
  )
  RETURNING jsonb_build_object(
    'id', id,
    'shipment_id', shipment_id,
    'driver_id', driver_id,
    'status', status,
    'applied_at', applied_at,
    'updated_at', updated_at,
    'message', 'Application submitted successfully'
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update the assign_driver_to_shipment function to handle the job_applications table
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
    status = 'assigned',
    updated_at = now()
  WHERE 
    id = p_shipment_id;
    
  -- Update the application status to 'accepted' for the assigned driver
  -- and 'rejected' for all other applications for this shipment
  -- Accept the selected driver's application
  UPDATE job_applications
  SET 
    status = 'accepted',
    responded_at = now(),
    updated_at = now()
  WHERE 
    shipment_id = p_shipment_id AND
    driver_id = p_driver_id;
    
  -- Reject all other applications
  UPDATE job_applications
  SET 
    status = 'rejected',
    responded_at = now(),
    updated_at = now()
  WHERE 
    shipment_id = p_shipment_id AND
    driver_id != p_driver_id;
  
  -- Create a tracking event if that table exists
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tracking_events' AND schemaname = 'public') THEN
    BEGIN
      INSERT INTO tracking_events (
        shipment_id, 
        event_type, 
        created_by,
        notes,
        created_at
      ) VALUES (
        p_shipment_id,
        'accepted',
        p_driver_id,
        'Driver assigned to shipment',
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      -- Ignore errors with tracking events
      NULL;
    END;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
