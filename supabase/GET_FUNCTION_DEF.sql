-- =====================================================================
-- GET ACTUAL FUNCTION DEFINITION
-- =====================================================================
-- This will show you the exact code of assign_driver_to_shipment
-- that's currently in your database
-- =====================================================================

SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'assign_driver_to_shipment'
LIMIT 1;
