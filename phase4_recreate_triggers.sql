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

-- Only create the trigger if tracking_events table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tracking_events' AND schemaname = 'public') THEN
    -- Create the trigger
    CREATE TRIGGER send_shipment_notification
    AFTER UPDATE OF status ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION send_shipment_notification();
  END IF;
END $$;
