-- Combined fixes for DriveDrop

-- =================================
-- Table: job_applications
-- =================================
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

-- =================================
-- Table: messages
-- =================================
DO $$
BEGIN
  -- Create messages table if it doesn't exist
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
    -- Check if receiver_id column exists and add it if not
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

-- =================================
-- Table: driver_settings
-- =================================
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

-- =================================
-- Utility Functions
-- =================================
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

-- =================================
-- Shipment Functions
-- =================================
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
    
  -- Set the status based on available enum values
  -- First check what values are available in the enum
  DO $inner$ 
  DECLARE
    valid_statuses text[];
    status_to_use text;
  BEGIN
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
  END $inner$;
  
  -- Create a tracking event if that table exists
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tracking_events' AND schemaname = 'public') THEN
    BEGIN
      -- First determine a valid tracking_event_type value
      DO $innertracking$ 
      DECLARE
        valid_event_types text[];
        event_type_to_use text;
      BEGIN
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
      END $innertracking$;
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

-- =================================
-- Messaging Functions
-- =================================
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
  
  -- Get the full message object
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
  
  -- Mark messages as read
  UPDATE messages
  SET read_at = now()
  WHERE 
    receiver_id = p_user1_id AND 
    sender_id = p_user2_id AND
    read_at IS NULL;
    
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =================================
-- Driver Settings Functions
-- =================================
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

-- =================================
-- Fix Existing Data
-- =================================
-- Fix shipment status - update shipments that have a driver_id but are still "pending"
DO $$ 
DECLARE
  valid_statuses text[];
  status_to_use text;
  trigger_exists boolean;
BEGIN
  -- First check if the problematic trigger exists and drop it temporarily
  SELECT EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'send_shipment_notification'
  ) INTO trigger_exists;
  
  IF trigger_exists THEN
    EXECUTE 'DROP TRIGGER IF EXISTS send_shipment_notification ON shipments';
  END IF;

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
  
  -- Apply the status change to pending shipments with a driver
  EXECUTE format('UPDATE shipments SET status = %L::shipment_status WHERE driver_id IS NOT NULL AND status = ''pending''', 
                status_to_use);
END $$;

-- =================================
-- Create Sample Data
-- =================================
-- Create sample job applications if none exist
DO $$
DECLARE
  application_count integer;
  shipment_count integer;
  driver_count integer;
  test_shipment_id uuid;
  test_driver_id uuid;
BEGIN
  -- Check if we already have applications
  SELECT COUNT(*) INTO application_count FROM job_applications;
  
  IF application_count = 0 THEN
    -- Get pending shipments
    SELECT COUNT(*) INTO shipment_count 
    FROM shipments 
    WHERE status = 'pending';
    
    -- Get available drivers
    SELECT COUNT(*) INTO driver_count 
    FROM profiles 
    WHERE role = 'driver';
    
    IF shipment_count > 0 AND driver_count > 0 THEN
      -- Get a shipment ID to use for sample data
      SELECT id INTO test_shipment_id 
      FROM shipments 
      WHERE status = 'pending' AND driver_id IS NULL
      LIMIT 1;
      
      -- Create applications for two random drivers
      IF test_shipment_id IS NOT NULL THEN
        FOR test_driver_id IN 
          SELECT id FROM profiles WHERE role = 'driver' LIMIT 2
        LOOP
          INSERT INTO job_applications (
            shipment_id,
            driver_id,
            status,
            applied_at
          ) VALUES (
            test_shipment_id,
            test_driver_id,
            'pending',
            now() - (random() * interval '2 days')
          );
        END LOOP;
      END IF;
    END IF;
  END IF;
END $$;

-- =================================
-- Fix Problematic Triggers
-- =================================
-- First check for and drop the problematic trigger completely
DO $$
DECLARE
  trigger_exists boolean;
BEGIN
  -- Check if the trigger exists
  SELECT EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'send_shipment_notification'
  ) INTO trigger_exists;
  
  -- If trigger exists, drop it completely for now
  IF trigger_exists THEN
    EXECUTE 'DROP TRIGGER IF EXISTS send_shipment_notification ON shipments';
  END IF;
END $$;

-- Create a fixed version of the trigger function
CREATE OR REPLACE FUNCTION send_shipment_notification()
RETURNS TRIGGER AS $$
DECLARE
  valid_event_types text[];
  event_type_to_use text;
BEGIN
  -- Don't do anything for initial inserts
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  
  -- Only proceed if status has changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get valid tracking event types
  SELECT array_agg(enumlabel) INTO valid_event_types
  FROM pg_enum
  WHERE enumtypid = 'tracking_event_type'::regtype;
  
  -- Map shipment_status to an appropriate tracking_event_type
  CASE NEW.status::text
    WHEN 'pending' THEN
      IF array_position(valid_event_types, 'created') IS NOT NULL THEN
        event_type_to_use := 'created';
      END IF;
    WHEN 'assigned' THEN
      IF array_position(valid_event_types, 'driver_assigned') IS NOT NULL THEN
        event_type_to_use := 'driver_assigned';
      ELSIF array_position(valid_event_types, 'pickup') IS NOT NULL THEN
        event_type_to_use := 'pickup';
      END IF;
    WHEN 'in_transit' THEN
      IF array_position(valid_event_types, 'in_transit') IS NOT NULL THEN
        event_type_to_use := 'in_transit';
      END IF;
    WHEN 'delivered' THEN
      IF array_position(valid_event_types, 'delivered') IS NOT NULL THEN
        event_type_to_use := 'delivered';
      END IF;
    WHEN 'completed' THEN
      IF array_position(valid_event_types, 'completed') IS NOT NULL THEN
        event_type_to_use := 'completed';
      ELSIF array_position(valid_event_types, 'delivered') IS NOT NULL THEN
        event_type_to_use := 'delivered';
      END IF;
    WHEN 'cancelled' THEN
      IF array_position(valid_event_types, 'cancelled') IS NOT NULL THEN
        event_type_to_use := 'cancelled';
      END IF;
    ELSE
      -- For any other status, try to find a matching event type or use 'other'
      IF array_position(valid_event_types, NEW.status::text) IS NOT NULL THEN
        event_type_to_use := NEW.status::text;
      ELSIF array_position(valid_event_types, 'other') IS NOT NULL THEN
        event_type_to_use := 'other';
      ELSE
        -- If no matching type and no 'other', use the first event type
        SELECT enumlabel INTO event_type_to_use
        FROM pg_enum
        WHERE enumtypid = 'tracking_event_type'::regtype
        LIMIT 1;
      END IF;
  END CASE;
  
  -- Only insert tracking event if we found a valid event type
  IF event_type_to_use IS NOT NULL THEN
    EXECUTE format('INSERT INTO tracking_events(
      shipment_id, 
      event_type, 
      created_by, 
      notes
    ) VALUES (
      %L, 
      %L::tracking_event_type, 
      %L, 
      %L
    )', 
    NEW.id, 
    event_type_to_use, 
    COALESCE(NEW.driver_id, OLD.driver_id), 
    'Shipment status updated to ' || NEW.status);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create the trigger only after all status updates are done
DO $$
BEGIN
  -- Only create the trigger if the tracking_events table exists
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tracking_events' AND schemaname = 'public') THEN
    -- Create the trigger
    CREATE TRIGGER send_shipment_notification
    AFTER UPDATE OF status ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION send_shipment_notification();
  END IF;
END $$;
