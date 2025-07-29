-- Test script to verify the fixed migration resolves function name collision
-- Run this BEFORE applying the migration to simulate the error condition
-- Then run the migration to verify it handles cleanup correctly

-- First, let's see what functions currently exist (if any)
SELECT 
    proname as function_name,
    pronargs as num_args,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname IN (
    'get_driver_applications',
    'update_application_status', 
    'apply_for_shipment',
    'assign_driver_to_shipment'
)
ORDER BY proname, pronargs;

-- Create some dummy functions to simulate the collision scenario
-- (Only run this if you want to test the cleanup functionality)

/*
-- Simulate existing functions that would cause conflicts
CREATE OR REPLACE FUNCTION get_driver_applications(driver_id UUID)
RETURNS TABLE(id UUID) AS $$
BEGIN
    RETURN QUERY SELECT gen_random_uuid();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_driver_applications(driver_id UUID, status TEXT)
RETURNS TABLE(id UUID) AS $$
BEGIN
    RETURN QUERY SELECT gen_random_uuid();
END;
$$ LANGUAGE plpgsql;

-- This would cause the error:
-- ERROR: 42725: function name "get_driver_applications" is not unique
-- HINT: Specify the argument list to select the function unambiguously.
*/

-- Now apply the migration file and it should handle the cleanup automatically

-- After migration, verify only the correct functions exist
-- (Run this after applying the migration)
/*
SELECT 
    proname as function_name,
    pronargs as num_args,
    pg_get_function_arguments(oid) as arguments,
    prosecdef as is_security_definer
FROM pg_proc 
WHERE proname IN (
    'get_driver_applications',
    'update_application_status', 
    'apply_for_shipment',
    'assign_driver_to_shipment'
)
ORDER BY proname, pronargs;

-- Should show exactly 4 functions, one for each name, with SECURITY DEFINER
-- Expected results:
-- get_driver_applications | 2 | p_driver_id uuid, p_status text DEFAULT NULL | t
-- update_application_status | 3 | p_application_id uuid, p_status text, p_notes text DEFAULT NULL | t  
-- apply_for_shipment | 3 | p_shipment_id uuid, p_driver_id uuid, p_notes text DEFAULT NULL | t
-- assign_driver_to_shipment | 3 | p_shipment_id uuid, p_driver_id uuid, p_create_application boolean DEFAULT true | t
*/
