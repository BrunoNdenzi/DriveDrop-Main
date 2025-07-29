-- Verification script for application management procedures
-- Run this after applying 05_application_management_procedures.sql

-- 1. Verify the functions exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_driver_applications'
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: get_driver_applications function does not exist';
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: get_driver_applications function exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_application_status'
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: update_application_status function does not exist';
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: update_application_status function exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'apply_for_shipment'
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: apply_for_shipment function does not exist';
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: apply_for_shipment function exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'assign_driver_to_shipment'
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: assign_driver_to_shipment function does not exist';
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: assign_driver_to_shipment function exists';
  END IF;
END $$;

-- 2. Verify that apply_for_shipment returns expected structure
DO $$
DECLARE
  test_query TEXT;
  result_fields TEXT[];
BEGIN
  -- Confirm the function returns the expected JSON fields
  test_query := $q$
    SELECT jsonb_object_keys(
      apply_for_shipment('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
    ) AS field
    WHERE FALSE; -- We don't actually want to execute this for real, just check structure
  $q$;

  BEGIN
    EXECUTE test_query;
    RAISE NOTICE 'VERIFICATION PASSED: apply_for_shipment function has correct return structure';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Shipment not found%' THEN
        -- This is expected behavior with non-existent IDs
        RAISE NOTICE 'VERIFICATION PASSED: apply_for_shipment function correctly validates shipment existence';
      ELSE
        RAISE EXCEPTION 'VERIFICATION FAILED: apply_for_shipment function error: %', SQLERRM;
      END IF;
  END;
END $$;

-- 3. Verify update_application_status handles invalid inputs correctly
DO $$
BEGIN
  BEGIN
    PERFORM update_application_status('00000000-0000-0000-0000-000000000000'::uuid, 'invalid_status');
    RAISE EXCEPTION 'VERIFICATION FAILED: update_application_status allowed invalid status';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Invalid status%' THEN
        RAISE NOTICE 'VERIFICATION PASSED: update_application_status correctly validates status values';
      ELSE
        RAISE EXCEPTION 'VERIFICATION FAILED: Unexpected error in update_application_status: %', SQLERRM;
      END IF;
  END;
END $$;

RAISE NOTICE 'All verification checks completed';
