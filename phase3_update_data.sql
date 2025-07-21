-- First make absolutely sure the trigger is dropped
DO $$
BEGIN
  -- Drop the trigger if it exists (with CASCADE to force it)
  EXECUTE 'DROP TRIGGER IF EXISTS send_shipment_notification ON shipments CASCADE';
  
  -- Also drop the function to be sure
  EXECUTE 'DROP FUNCTION IF EXISTS send_shipment_notification() CASCADE';
END $$;

-- Fix shipment status for existing shipments
DO $$ 
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
  
  -- Apply the status change to pending shipments with a driver
  EXECUTE format('UPDATE shipments SET status = %L::shipment_status WHERE driver_id IS NOT NULL AND status = ''pending''', 
                status_to_use);
END $$;

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
