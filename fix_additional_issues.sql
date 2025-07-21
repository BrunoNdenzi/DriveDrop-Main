-- Fix for additional issues found in logs

-- 1. Fix shipment status - update shipments that have a driver_id but are still "pending"
UPDATE shipments
SET status = 'assigned'::shipment_status
WHERE driver_id IS NOT NULL AND status = 'pending';

-- 2. Fix for the messages table - add receiver_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages' 
    AND column_name = 'receiver_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN receiver_id UUID;
    
    -- Create an index on receiver_id
    CREATE INDEX IF NOT EXISTS messages_receiver_id_idx ON messages(receiver_id);
    
    -- Optionally add a foreign key constraint if appropriate
    -- (Commented out because we don't know which table it should reference)
    -- ALTER TABLE messages 
    --   ADD CONSTRAINT messages_receiver_id_fkey 
    --   FOREIGN KEY (receiver_id) REFERENCES profiles(id);
  END IF;
END $$;

-- 3. Create a function to check if a shipment is available for application
CREATE OR REPLACE FUNCTION is_shipment_available_for_application(
  p_shipment_id UUID
) RETURNS boolean AS $$
DECLARE
  is_available boolean;
BEGIN
  -- Check if the shipment exists, is pending, and doesn't have a driver assigned
  SELECT 
    COUNT(*) > 0 INTO is_available
  FROM 
    shipments
  WHERE 
    id = p_shipment_id AND
    status = 'pending' AND
    driver_id IS NULL;
    
  RETURN is_available;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create a function to safely apply for a shipment
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
  SELECT is_shipment_available_for_application(p_shipment_id) INTO is_available;
  
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
    applied_at
  ) 
  VALUES (
    p_shipment_id,
    p_driver_id,
    'pending',
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

-- 5. Fix the duplicate key issue in driver_settings
-- Create a function to safely upsert driver settings
CREATE OR REPLACE FUNCTION upsert_driver_settings(
  p_driver_id UUID,
  p_settings jsonb
) RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  -- Try to update first
  UPDATE driver_settings
  SET 
    settings = p_settings,
    updated_at = now()
  WHERE driver_id = p_driver_id
  RETURNING jsonb_build_object(
    'driver_id', driver_id,
    'settings', settings,
    'updated_at', updated_at,
    'message', 'Settings updated'
  ) INTO result;
  
  -- If no row was updated, insert a new one
  IF result IS NULL THEN
    INSERT INTO driver_settings (
      driver_id,
      settings
    )
    VALUES (
      p_driver_id,
      p_settings
    )
    ON CONFLICT (driver_id) DO UPDATE
    SET 
      settings = p_settings,
      updated_at = now()
    RETURNING jsonb_build_object(
      'driver_id', driver_id,
      'settings', settings,
      'updated_at', updated_at,
      'message', 'Settings created'
    ) INTO result;
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
