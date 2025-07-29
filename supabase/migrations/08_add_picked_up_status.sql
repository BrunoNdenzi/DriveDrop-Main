-- Migration: 08_add_picked_up_status.sql
-- Description: Adds 'picked_up' status to shipment_status enum

-- First, create a temporary type with all needed values including 'picked_up'
CREATE TYPE shipment_status_new AS ENUM (
  'pending', 'accepted', 'assigned', 'in_transit', 'in_progress', 'delivered', 'completed', 'cancelled', 'picked_up'
);

-- Remove the default from shipments.status
ALTER TABLE shipments ALTER COLUMN status DROP DEFAULT;

-- Drop triggers referencing shipments.status
DROP TRIGGER IF EXISTS send_shipment_notification ON shipments;
DROP TRIGGER IF EXISTS on_shipment_status_update ON shipments;

-- Drop RLS policies referencing shipments.status
DROP POLICY IF EXISTS "Clients can update their own shipments" ON shipments;
DROP POLICY IF EXISTS "Drivers can view assigned and available shipments" ON shipments;
DROP POLICY IF EXISTS "Drivers can view available shipments" ON shipments;

-- Update all tables that use the current enum to use TEXT temporarily
ALTER TABLE shipments ALTER COLUMN status TYPE TEXT;
ALTER TABLE shipment_status_history ALTER COLUMN status TYPE TEXT;

-- Drop the old enum
DROP TYPE shipment_status;

-- Rename the new enum
ALTER TYPE shipment_status_new RENAME TO shipment_status;

-- Change shipments.status column back to enum
ALTER TABLE shipments ALTER COLUMN status TYPE shipment_status USING status::shipment_status;

-- Restore the default value for shipments.status
ALTER TABLE shipments ALTER COLUMN status SET DEFAULT 'pending';

-- Re-create the necessary trigger functions
CREATE OR REPLACE FUNCTION handle_shipment_status_update()
RETURNS trigger AS $$
BEGIN
  IF old.status IS DISTINCT FROM new.status THEN
    INSERT INTO tracking_events (
      shipment_id,
      event_type,
      notes,
      created_by
    )
    VALUES (
      new.id,
      'status_change',
      'Status changed from ' || old.status || ' to ' || new.status,
      new.updated_by
    );

    -- Update delivered_at timestamp for completed/delivered statuses
    IF (new.status = 'delivered' OR new.status = 'completed') AND 
       (old.status != 'delivered' AND old.status != 'completed') THEN
      UPDATE shipments 
      SET delivered_at = now() 
      WHERE id = new.id;
    END IF;
    
    -- Update picked_up_at timestamp for picked_up status
    IF (new.status = 'picked_up' OR new.status = 'in_transit') AND 
       (old.status != 'picked_up' AND old.status != 'in_transit') THEN
      UPDATE shipments 
      SET pickup_date = now() 
      WHERE id = new.id;
    END IF;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create send_shipment_notification_function
CREATE OR REPLACE FUNCTION send_shipment_notification_function()
RETURNS trigger AS $$
BEGIN
  -- Only send notifications for specific status changes
  IF old.status IS DISTINCT FROM new.status THEN
    -- For assigned status
    IF new.status = 'assigned' AND old.status = 'pending' THEN
      PERFORM pg_notify(
        'shipment_updates',
        json_build_object(
          'event', 'shipment_assigned',
          'shipment_id', new.id,
          'client_id', new.client_id,
          'driver_id', new.driver_id
        )::text
      );
    END IF;
    
    -- For picked_up status
    IF new.status = 'picked_up' THEN
      PERFORM pg_notify(
        'shipment_updates',
        json_build_object(
          'event', 'shipment_picked_up',
          'shipment_id', new.id,
          'client_id', new.client_id,
          'driver_id', new.driver_id
        )::text
      );
    END IF;
    
    -- For in_transit status
    IF new.status = 'in_transit' OR new.status = 'in_progress' THEN
      PERFORM pg_notify(
        'shipment_updates',
        json_build_object(
          'event', 'shipment_in_transit',
          'shipment_id', new.id,
          'client_id', new.client_id,
          'driver_id', new.driver_id
        )::text
      );
    END IF;
    
    -- For delivered or completed status
    IF new.status = 'delivered' OR new.status = 'completed' THEN
      PERFORM pg_notify(
        'shipment_updates',
        json_build_object(
          'event', 'shipment_delivered',
          'shipment_id', new.id,
          'client_id', new.client_id,
          'driver_id', new.driver_id
        )::text
      );
    END IF;
    
    -- For cancelled status
    IF new.status = 'cancelled' THEN
      PERFORM pg_notify(
        'shipment_updates',
        json_build_object(
          'event', 'shipment_cancelled',
          'shipment_id', new.id,
          'client_id', new.client_id,
          'driver_id', new.driver_id
        )::text
      );
    END IF;
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create triggers
CREATE TRIGGER on_shipment_status_update
AFTER UPDATE ON shipments
FOR EACH ROW
WHEN (old.status IS DISTINCT FROM new.status)
EXECUTE FUNCTION handle_shipment_status_update();

CREATE TRIGGER send_shipment_notification
AFTER UPDATE OF status ON shipments
FOR EACH ROW
EXECUTE FUNCTION send_shipment_notification_function();

-- Re-create the dropped RLS policies
CREATE POLICY "Clients can update their own shipments"
  ON shipments
  FOR UPDATE
  TO public
  USING (
    (auth.uid() = client_id)
    AND (status = ANY (ARRAY['pending'::shipment_status, 'cancelled'::shipment_status]))
  );

CREATE POLICY "Drivers can view assigned and available shipments"
  ON shipments
  FOR SELECT
  TO public
  USING (
    (auth.uid() = driver_id)
    OR (
      (driver_id IS NULL)
      AND (status = 'pending'::shipment_status)
      AND (auth.uid() IN (
        SELECT profiles.id
        FROM profiles
        WHERE profiles.role = 'driver'::user_role
      ))
    )
  );

CREATE POLICY "Drivers can view available shipments"
  ON shipments
  FOR SELECT
  TO public
  USING (
    (status = 'pending'::shipment_status)
    AND (driver_id IS NULL)
  );

-- Add a comment explaining the enum values
COMMENT ON TYPE shipment_status IS 'Valid shipment statuses: pending, accepted, assigned, in_transit, in_progress, delivered, completed, cancelled, picked_up';
