-- Add sample data for testing

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
