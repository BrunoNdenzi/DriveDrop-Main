-- =====================================================================
-- CHECK TRIGGERS AND THEIR FUNCTIONS
-- =====================================================================

-- Step 1: List all triggers on shipments
SELECT 
  t.tgname as trigger_name,
  p.proname as function_name,
  CASE WHEN t.tgenabled = 'O' THEN 'ENABLED' ELSE 'DISABLED' END as status,
  pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'public.shipments'::regclass
AND NOT t.tgisinternal
ORDER BY t.tgname;

-- Step 2: Get the definition of each trigger function
-- Run this after seeing which functions are being called by triggers
-- Replace 'FUNCTION_NAME_HERE' with the actual function name from Step 1

-- Example: If you see a function called 'handle_shipment_status_update', run:
-- SELECT pg_get_functiondef(oid) as function_definition
-- FROM pg_proc
-- WHERE proname = 'handle_shipment_status_update';
