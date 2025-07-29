-- Migration: 04_fix_shipment_status_enum.sql
-- Description: Fixes shipment_status enum to include values used in the app while safely handling all dependencies

-- 1. Drop triggers that reference shipments.status
DROP TRIGGER IF EXISTS send_shipment_notification ON shipments;
DROP TRIGGER IF EXISTS on_shipment_status_update ON shipments;

-- 2. Optionally drop the trigger functions if you want to redefine them (uncomment if needed)
-- DROP FUNCTION IF EXISTS send_shipment_notification_function;
-- DROP FUNCTION IF EXISTS handle_shipment_status_update;

-- 3. Drop RLS policies that reference shipments.status
DROP POLICY IF EXISTS "Clients can update their own shipments" ON shipments;
DROP POLICY IF EXISTS "Drivers can view assigned and available shipments" ON shipments;
DROP POLICY IF EXISTS "Drivers can view available shipments" ON shipments;

-- 4. Remove the default from shipments.status
ALTER TABLE shipments ALTER COLUMN status DROP DEFAULT;

-- 5. Create new enum type with all required values
CREATE TYPE shipment_status_new AS ENUM (
  'pending', 'accepted', 'assigned', 'in_transit', 'in_progress', 'delivered', 'completed', 'cancelled'
);

-- 6. Alter columns to TEXT to prepare for enum swap
ALTER TABLE shipments ALTER COLUMN status TYPE TEXT;
ALTER TABLE shipment_status_history ALTER COLUMN status TYPE TEXT;

-- 7. Drop the old enum type
DROP TYPE shipment_status;

-- 8. Rename the new enum type
ALTER TYPE shipment_status_new RENAME TO shipment_status;

-- 9. Change shipments.status column back to enum
ALTER TABLE shipments ALTER COLUMN status TYPE shipment_status USING status::shipment_status;

-- 10. Restore the default value for shipments.status
ALTER TABLE shipments ALTER COLUMN status SET DEFAULT 'pending';

-- 11. Leave status_history.status as TEXT for flexibility
-- (Skip converting shipment_status_history.status back to enum for flexibility)

-- 12. Re-create the necessary trigger functions
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

    IF (new.status = 'delivered' OR new.status = 'completed') AND 
       (old.status != 'delivered' AND old.status != 'completed') THEN
      UPDATE shipments 
      SET delivered_at = now() 
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

-- 13. Re-create triggers
CREATE TRIGGER send_shipment_notification
AFTER UPDATE OF status ON shipments
FOR EACH ROW
EXECUTE FUNCTION send_shipment_notification_function();

CREATE TRIGGER on_shipment_status_update
AFTER UPDATE ON shipments
FOR EACH ROW
WHEN (old.status IS DISTINCT FROM new.status)
EXECUTE FUNCTION handle_shipment_status_update();

-- 14. Re-create the dropped RLS policies
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

-- 15. Add a comment explaining the enum values
COMMENT ON TYPE shipment_status IS 'Valid shipment statuses: pending, accepted, assigned, in_transit, in_progress, delivered, completed, cancelled';
