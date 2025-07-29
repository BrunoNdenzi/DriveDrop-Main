-- First phase: Drop problematic trigger
DROP TRIGGER IF EXISTS send_shipment_notification ON shipments;

-- Second phase: Create the new tables and functions
CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  UNIQUE (shipment_id, driver_id)
);

CREATE INDEX IF NOT EXISTS job_applications_shipment_id_idx ON job_applications(shipment_id);
CREATE INDEX IF NOT EXISTS job_applications_driver_id_idx ON job_applications(driver_id);

-- Fix messages table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'messages' AND schemaname = 'public') THEN
    CREATE TABLE messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id UUID NOT NULL,
      receiver_id UUID NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      read_at TIMESTAMPTZ,
      related_shipment_id UUID
    );
    
    CREATE INDEX messages_sender_id_idx ON messages(sender_id);
    CREATE INDEX messages_receiver_id_idx ON messages(receiver_id);
    CREATE INDEX messages_related_shipment_id_idx ON messages(related_shipment_id);
  ELSE
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'messages' 
      AND column_name = 'receiver_id'
    ) THEN
      ALTER TABLE messages ADD COLUMN receiver_id UUID;
      CREATE INDEX messages_receiver_id_idx ON messages(receiver_id);
    END IF;
  END IF;
END $$;

-- Fix driver_settings table
DO $$
BEGIN
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

-- Create utility functions
CREATE OR REPLACE FUNCTION table_exists(table_name text) RETURNS boolean AS $$
DECLARE
  exists boolean;
BEGIN
  SELECT COUNT(*) > 0 INTO exists
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename = table_name;
  
  RETURN exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_table_names() RETURNS text[] AS $$
DECLARE
  table_names text[];
BEGIN
  SELECT array_agg(tablename) INTO table_names
  FROM pg_tables
  WHERE schemaname = 'public';
  
  RETURN table_names;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION exec_sql(sql text) RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create application functions
CREATE OR REPLACE FUNCTION is_shipment_available_for_application(
  p_shipment_id UUID
) RETURNS boolean AS $$
DECLARE
  is_available boolean;
BEGIN
  SELECT COUNT(*) > 0 INTO is_available
  FROM shipments
  WHERE id = p_shipment_id AND status = 'pending' AND driver_id IS NULL;
    
  RETURN is_available;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION apply_for_shipment(
  p_shipment_id UUID,
  p_driver_id UUID
) RETURNS jsonb AS $$
DECLARE
  is_available boolean;
  result jsonb;
  existing_application_id UUID;
BEGIN
  SELECT is_shipment_available_for_application(p_shipment_id) INTO is_available;
  
  IF NOT is_available THEN
    IF EXISTS (SELECT 1 FROM shipments WHERE id = p_shipment_id) THEN
      IF EXISTS (SELECT 1 FROM shipments WHERE id = p_shipment_id AND driver_id IS NOT NULL) THEN
        RAISE EXCEPTION 'This shipment has already been assigned to a driver';
      ELSE
        RAISE EXCEPTION 'This shipment is not available for applications';
      END IF;
    ELSE
      RAISE EXCEPTION 'Shipment not found';
    END IF;
  END IF;
  
  SELECT id INTO existing_application_id
  FROM job_applications
  WHERE shipment_id = p_shipment_id AND driver_id = p_driver_id;
  
  IF existing_application_id IS NOT NULL THEN
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

-- Create messaging functions
CREATE OR REPLACE FUNCTION send_message(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_content TEXT,
  p_related_shipment_id UUID DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  new_message_id UUID;
  result jsonb;
BEGIN
  INSERT INTO messages (
    sender_id,
    receiver_id,
    content,
    related_shipment_id
  ) 
  VALUES (
    p_sender_id,
    p_receiver_id,
    p_content,
    p_related_shipment_id
  )
  RETURNING id INTO new_message_id;
  
  SELECT jsonb_build_object(
    'id', m.id,
    'sender_id', m.sender_id,
    'sender', jsonb_build_object(
      'id', s.id,
      'first_name', s.first_name,
      'last_name', s.last_name,
      'avatar_url', s.avatar_url
    ),
    'receiver_id', m.receiver_id,
    'receiver', jsonb_build_object(
      'id', r.id,
      'first_name', r.first_name,
      'last_name', r.last_name,
      'avatar_url', r.avatar_url
    ),
    'content', m.content,
    'created_at', m.created_at,
    'read_at', m.read_at,
    'related_shipment_id', m.related_shipment_id
  ) INTO result
  FROM messages m
  JOIN profiles s ON m.sender_id = s.id
  JOIN profiles r ON m.receiver_id = r.id
  WHERE m.id = new_message_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_messages_between_users(
  p_user1_id UUID,
  p_user2_id UUID,
  p_limit INT DEFAULT 50
) RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'sender_id', m.sender_id,
      'receiver_id', m.receiver_id,
      'content', m.content,
      'created_at', m.created_at,
      'read_at', m.read_at,
      'related_shipment_id', m.related_shipment_id
    )
    ORDER BY m.created_at DESC
  ) INTO result
  FROM messages m
  WHERE 
    (m.sender_id = p_user1_id AND m.receiver_id = p_user2_id) OR
    (m.sender_id = p_user2_id AND m.receiver_id = p_user1_id)
  LIMIT p_limit;
  
  UPDATE messages
  SET read_at = now()
  WHERE 
    receiver_id = p_user1_id AND 
    sender_id = p_user2_id AND
    read_at IS NULL;
    
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create driver settings functions
CREATE OR REPLACE FUNCTION update_driver_settings(
  p_driver_id UUID,
  p_settings jsonb
) RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM driver_settings WHERE driver_id = p_driver_id) THEN
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
