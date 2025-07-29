-- Verification script for application table consolidation
-- Run this after applying 04_consolidate_application_tables.sql

-- 1. Verify that shipment_applications table no longer exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'shipment_applications'
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: shipment_applications table still exists';
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: shipment_applications table has been removed';
  END IF;
END $$;

-- 2. Verify that job_applications table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'job_applications'
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: job_applications table does not exist';
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: job_applications table exists';
  END IF;
END $$;

-- 3. Verify that shipment_applications_view exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'shipment_applications_view'
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: shipment_applications_view does not exist';
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: shipment_applications_view exists';
  END IF;
END $$;

-- 4. Verify that all required indexes exist on job_applications
DO $$
DECLARE
  missing_indexes TEXT := '';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND tablename = 'job_applications' AND indexname = 'job_applications_shipment_id_idx'
  ) THEN
    missing_indexes := missing_indexes || ' job_applications_shipment_id_idx';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND tablename = 'job_applications' AND indexname = 'job_applications_driver_id_idx'
  ) THEN
    missing_indexes := missing_indexes || ' job_applications_driver_id_idx';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND tablename = 'job_applications' AND indexname = 'job_applications_status_idx'
  ) THEN
    missing_indexes := missing_indexes || ' job_applications_status_idx';
  END IF;
  
  IF LENGTH(missing_indexes) > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Missing indexes on job_applications: %', missing_indexes;
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: All required indexes exist on job_applications';
  END IF;
END $$;

-- 5. Verify that the view returns expected columns
DO $$
DECLARE
  view_columns RECORD;
  expected_columns TEXT[] := ARRAY['id', 'shipment_id', 'driver_id', 'status', 'applied_at', 'created_at', 'updated_at'];
  missing_columns TEXT := '';
BEGIN
  FOR view_columns IN 
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'shipment_applications_view'
  LOOP
    expected_columns := array_remove(expected_columns, view_columns.column_name);
  END LOOP;
  
  IF array_length(expected_columns, 1) > 0 THEN
    FOREACH missing_columns IN ARRAY expected_columns
    LOOP
      missing_columns := missing_columns || ' ' || missing_columns;
    END LOOP;
    RAISE EXCEPTION 'VERIFICATION FAILED: The shipment_applications_view is missing columns: %', missing_columns;
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: The shipment_applications_view has all expected columns';
  END IF;
END $$;

-- 6. Test view query works
DO $$
BEGIN
  PERFORM * FROM shipment_applications_view LIMIT 1;
  RAISE NOTICE 'VERIFICATION PASSED: The shipment_applications_view returns results';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Error querying shipment_applications_view: %', SQLERRM;
END $$;

RAISE NOTICE 'All verification checks completed';
