-- Comprehensive verification script for application management procedures
-- Run this after applying 05_application_management_procedures_production.sql

-- Test data setup
DO $$
DECLARE
  v_client_id UUID;
  v_driver_id UUID;
  v_shipment_id UUID;
  v_application_id UUID;
BEGIN
  -- Create test users if needed
  INSERT INTO profiles (id, email, first_name, last_name, role)
  VALUES 
    (gen_random_uuid(), 'testclient@example.com', 'Test', 'Client', 'client')
  RETURNING id INTO v_client_id;
  
  INSERT INTO profiles (id, email, first_name, last_name, role)
  VALUES 
    (gen_random_uuid(), 'testdriver@example.com', 'Test', 'Driver', 'driver')
  RETURNING id INTO v_driver_id;
  
  -- Create test shipment
  INSERT INTO shipments (
    id, 
    client_id, 
    status, 
    title, 
    pickup_address, 
    delivery_address, 
    pickup_location,
    delivery_location,
    estimated_price
  )
  VALUES (
    gen_random_uuid(), 
    v_client_id, 
    'pending', 
    'Test Verification Shipment', 
    '123 Pickup St', 
    '456 Delivery Ave', 
    '{"type": "Point", "coordinates": [0, 0]}'::jsonb,
    '{"type": "Point", "coordinates": [1, 1]}'::jsonb,
    100
  )
  RETURNING id INTO v_shipment_id;
  
  -- Save variables for later tests
  PERFORM set_config('app.test_client_id', v_client_id::text, false);
  PERFORM set_config('app.test_driver_id', v_driver_id::text, false);
  PERFORM set_config('app.test_shipment_id', v_shipment_id::text, false);
  
  RAISE NOTICE 'Test data created: Client ID: %, Driver ID: %, Shipment ID: %', 
    v_client_id, v_driver_id, v_shipment_id;
END $$;

-- 1. Verify function existence and permissions
DO $$
BEGIN
  -- Verify functions exist
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_driver_applications') THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: get_driver_applications function does not exist';
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: get_driver_applications function exists';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_application_status') THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: update_application_status function does not exist';
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: update_application_status function exists';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'apply_for_shipment') THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: apply_for_shipment function does not exist';
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: apply_for_shipment function exists';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'assign_driver_to_shipment') THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: assign_driver_to_shipment function does not exist';
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: assign_driver_to_shipment function exists';
  END IF;
  
  -- Verify security definer on functions
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_driver_applications' AND p.prosecdef = true
  ) THEN
    RAISE WARNING 'SECURITY CHECK: get_driver_applications is not SECURITY DEFINER';
  ELSE
    RAISE NOTICE 'SECURITY CHECK PASSED: get_driver_applications is SECURITY DEFINER';
  END IF;
END $$;

-- 2. Test apply_for_shipment function
DO $$
DECLARE
  v_driver_id UUID := current_setting('app.test_driver_id')::uuid;
  v_shipment_id UUID := current_setting('app.test_shipment_id')::uuid;
  v_result JSONB;
  v_duplicate_result JSONB;
  v_application_id UUID;
BEGIN
  -- Test valid application
  SELECT apply_for_shipment(v_shipment_id, v_driver_id, 'Test application notes') INTO v_result;
  
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: apply_for_shipment returned NULL';
  END IF;
  
  IF NOT (v_result->>'is_new_application')::boolean THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: apply_for_shipment did not indicate new application';
  END IF;
  
  v_application_id := (v_result->>'id')::uuid;
  PERFORM set_config('app.test_application_id', v_application_id::text, false);
  
  RAISE NOTICE 'VERIFICATION PASSED: apply_for_shipment created application: %', v_result;
  
  -- Test duplicate application
  SELECT apply_for_shipment(v_shipment_id, v_driver_id) INTO v_duplicate_result;
  
  IF (v_duplicate_result->>'is_new_application')::boolean THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: apply_for_shipment created duplicate application';
  END IF;
  
  RAISE NOTICE 'VERIFICATION PASSED: apply_for_shipment prevented duplicate application: %', v_duplicate_result;
  
  -- Test error handling (invalid shipment)
  BEGIN
    PERFORM apply_for_shipment('00000000-0000-0000-0000-000000000000', v_driver_id);
    RAISE EXCEPTION 'VERIFICATION FAILED: apply_for_shipment did not throw exception for invalid shipment';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%not found%' THEN
        RAISE NOTICE 'VERIFICATION PASSED: apply_for_shipment correctly validates shipment existence';
      ELSE
        RAISE EXCEPTION 'VERIFICATION FAILED: Unexpected error: %', SQLERRM;
      END IF;
  END;
END $$;

-- 3. Test get_driver_applications function
DO $$
DECLARE
  v_driver_id UUID := current_setting('app.test_driver_id')::uuid;
  v_applications RECORD;
  v_count INTEGER;
BEGIN
  -- Count all applications
  SELECT COUNT(*) INTO v_count FROM get_driver_applications(v_driver_id);
  
  IF v_count = 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: get_driver_applications returned no applications';
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: get_driver_applications returned % application(s)', v_count;
  END IF;
  
  -- Test status filtering
  SELECT COUNT(*) INTO v_count FROM get_driver_applications(v_driver_id, 'pending');
  
  IF v_count = 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: get_driver_applications status filtering returned no applications';
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: get_driver_applications with status filtering returned % application(s)', v_count;
  END IF;
  
  -- Test error handling (invalid status)
  BEGIN
    PERFORM get_driver_applications(v_driver_id, 'invalid_status');
    RAISE EXCEPTION 'VERIFICATION FAILED: get_driver_applications did not throw exception for invalid status';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Invalid status%' THEN
        RAISE NOTICE 'VERIFICATION PASSED: get_driver_applications correctly validates status parameter';
      ELSE
        RAISE EXCEPTION 'VERIFICATION FAILED: Unexpected error: %', SQLERRM;
      END IF;
  END;
END $$;

-- 4. Test update_application_status function
DO $$
DECLARE
  v_application_id UUID := current_setting('app.test_application_id')::uuid;
  v_updated_application job_applications;
  v_shipment_id UUID;
  v_shipment_status TEXT;
  v_shipment_driver_id UUID;
BEGIN
  -- Update the application status to accepted
  SELECT * INTO v_updated_application 
  FROM update_application_status(v_application_id, 'accepted', 'Accepted for testing');
  
  IF v_updated_application IS NULL THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: update_application_status returned NULL';
  END IF;
  
  IF v_updated_application.status != 'accepted' THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: update_application_status did not update status correctly';
  END IF;
  
  RAISE NOTICE 'VERIFICATION PASSED: update_application_status updated application status: %', v_updated_application.status;
  
  -- Verify shipment was updated
  v_shipment_id := v_updated_application.shipment_id;
  
  SELECT status, driver_id INTO v_shipment_status, v_shipment_driver_id
  FROM shipments
  WHERE id = v_shipment_id;
  
  IF v_shipment_status != 'assigned' THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Shipment status not updated to assigned (current: %)', v_shipment_status;
  END IF;
  
  IF v_shipment_driver_id != v_updated_application.driver_id THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Shipment driver_id not updated correctly';
  END IF;
  
  RAISE NOTICE 'VERIFICATION PASSED: Shipment was automatically assigned to driver';
  
  -- Test error handling (invalid status)
  BEGIN
    PERFORM update_application_status(v_application_id, 'invalid_status');
    RAISE EXCEPTION 'VERIFICATION FAILED: update_application_status did not throw exception for invalid status';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Invalid status%' THEN
        RAISE NOTICE 'VERIFICATION PASSED: update_application_status correctly validates status parameter';
      ELSE
        RAISE EXCEPTION 'VERIFICATION FAILED: Unexpected error: %', SQLERRM;
      END IF;
  END;
END $$;

-- 5. Test assign_driver_to_shipment function
DO $$
DECLARE
  v_client_id UUID := current_setting('app.test_client_id')::uuid;
  v_driver_id UUID := current_setting('app.test_driver_id')::uuid;
  v_new_shipment_id UUID;
  v_result JSONB;
BEGIN
  -- Create another test shipment
  INSERT INTO shipments (
    id, 
    client_id, 
    status, 
    title, 
    pickup_address, 
    delivery_address,
    pickup_location,
    delivery_location,
    estimated_price
  )
  VALUES (
    gen_random_uuid(), 
    v_client_id, 
    'pending', 
    'Test Assignment Shipment', 
    '123 Pickup St', 
    '456 Delivery Ave',
    '{"type": "Point", "coordinates": [0, 0]}'::jsonb,
    '{"type": "Point", "coordinates": [1, 1]}'::jsonb,
    100
  )
  RETURNING id INTO v_new_shipment_id;
  
  -- Test direct assignment
  SELECT assign_driver_to_shipment(v_new_shipment_id, v_driver_id) INTO v_result;
  
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: assign_driver_to_shipment returned NULL';
  END IF;
  
  IF NOT (v_result->>'success')::boolean THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: assign_driver_to_shipment did not indicate success';
  END IF;
  
  RAISE NOTICE 'VERIFICATION PASSED: assign_driver_to_shipment result: %', v_result;
  
  -- Verify shipment was updated
  DECLARE
    v_shipment_status TEXT;
    v_shipment_driver_id UUID;
  BEGIN
    SELECT status, driver_id INTO v_shipment_status, v_shipment_driver_id
    FROM shipments
    WHERE id = v_new_shipment_id;
    
    IF v_shipment_status != 'assigned' THEN
      RAISE EXCEPTION 'VERIFICATION FAILED: Shipment status not updated to assigned (current: %)', v_shipment_status;
    END IF;
    
    IF v_shipment_driver_id != v_driver_id THEN
      RAISE EXCEPTION 'VERIFICATION FAILED: Shipment driver_id not updated correctly';
    END IF;
    
    RAISE NOTICE 'VERIFICATION PASSED: Shipment was correctly assigned to driver';
  END;
  
  -- Test error handling (already assigned shipment)
  BEGIN
    PERFORM assign_driver_to_shipment(v_new_shipment_id, gen_random_uuid());
    RAISE EXCEPTION 'VERIFICATION FAILED: assign_driver_to_shipment did not throw exception for already assigned shipment';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%already been assigned%' THEN
        RAISE NOTICE 'VERIFICATION PASSED: assign_driver_to_shipment correctly prevents reassignment';
      ELSE
        RAISE EXCEPTION 'VERIFICATION FAILED: Unexpected error: %', SQLERRM;
      END IF;
  END;
END $$;

-- Clean up test data
DO $$
DECLARE
  v_client_id UUID := current_setting('app.test_client_id')::uuid;
  v_driver_id UUID := current_setting('app.test_driver_id')::uuid;
BEGIN
  -- Only uncomment for actual cleanup in dev environments
  -- DELETE FROM job_applications WHERE driver_id = v_driver_id;
  -- DELETE FROM shipments WHERE client_id = v_client_id;
  -- DELETE FROM profiles WHERE id IN (v_client_id, v_driver_id);
  
  RAISE NOTICE 'Test complete. Test data has been left in the database for inspection.';
  RAISE NOTICE 'To clean up test data, run:';
  RAISE NOTICE $cleanup$
    DELETE FROM job_applications WHERE driver_id = '%s';
    DELETE FROM shipments WHERE client_id = '%s';
    DELETE FROM profiles WHERE id IN ('%s', '%s');
  $cleanup$, v_driver_id, v_client_id, v_client_id, v_driver_id;
END $$;

RAISE NOTICE 'All verification checks completed';
