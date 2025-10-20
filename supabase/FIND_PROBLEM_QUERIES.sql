-- =====================================================================
-- FIND THE CONVERSATION_ID PROBLEM - QUERY VERSION
-- =====================================================================
-- This version uses SELECT queries so you can see the results
-- =====================================================================

-- Query 1: List all triggers on shipments table
SELECT 
  t.tgname as trigger_name,
  p.proname as function_name,
  CASE WHEN t.tgenabled = 'O' THEN 'ENABLED' ELSE 'DISABLED' END as status
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'public.shipments'::regclass
AND NOT t.tgisinternal
ORDER BY t.tgname;

-- Query 2: Check if assign_driver_to_shipment references conversation_id
SELECT 
  proname as function_name,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%conversation_id%' THEN '⚠️ PROBLEM: References conversation_id'
    ELSE '✓ OK'
  END as status
FROM pg_proc
WHERE proname = 'assign_driver_to_shipment'
LIMIT 1;

-- Query 3: Find ALL functions that reference conversation_id in messages
SELECT 
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  '⚠️ PROBLEM' as alert
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
AND p.proname NOT LIKE 'st_%'
AND p.proname NOT LIKE '_st_%'
AND pg_get_functiondef(p.oid) LIKE '%INSERT INTO messages%'
AND pg_get_functiondef(p.oid) LIKE '%conversation_id%'
ORDER BY p.proname;

-- Query 4: Check messages table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'messages'
ORDER BY ordinal_position;

-- Query 5: Check if conversation_id column exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'conversation_id'
    ) THEN '⚠️ conversation_id EXISTS (should not!)'
    ELSE '✓ conversation_id does NOT exist (correct)'
  END as conversation_id_status;
