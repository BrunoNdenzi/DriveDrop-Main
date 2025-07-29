-- Fix for driver settings issues

-- First, ensure the driver_settings table exists with the right structure
DO $$
BEGIN
  -- Create driver_settings table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'driver_settings' AND schemaname = 'public') THEN
    CREATE TABLE driver_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      driver_id UUID UNIQUE NOT NULL,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ
    );
    
    CREATE INDEX driver_settings_driver_id_idx ON driver_settings(driver_id);
  END IF;
END $$;

-- Create function to get driver settings
CREATE OR REPLACE FUNCTION get_driver_settings(
  p_driver_id UUID
) RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'driver_id', driver_id,
    'settings', settings,
    'updated_at', updated_at
  ) INTO result
  FROM driver_settings
  WHERE driver_id = p_driver_id;
  
  IF result IS NULL THEN
    -- Return default settings if none exist
    RETURN jsonb_build_object(
      'driver_id', p_driver_id,
      'settings', '{
        "notifications": {
          "newJobs": true,
          "statusUpdates": true,
          "messages": true
        },
        "location": {
          "shareWhileActive": true,
          "shareWhileInactive": false
        },
        "preferences": {
          "maxDistance": 50,
          "jobTypes": ["all"],
          "autoApply": false
        }
      }'::jsonb,
      'updated_at', null
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to safely update driver settings
CREATE OR REPLACE FUNCTION update_driver_settings(
  p_driver_id UUID,
  p_settings jsonb
) RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  -- First check if settings exist for this driver
  IF EXISTS (SELECT 1 FROM driver_settings WHERE driver_id = p_driver_id) THEN
    -- Update existing settings
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
  ELSE
    -- Insert new settings
    INSERT INTO driver_settings (
      driver_id,
      settings,
      updated_at
    )
    VALUES (
      p_driver_id,
      p_settings,
      now()
    )
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
