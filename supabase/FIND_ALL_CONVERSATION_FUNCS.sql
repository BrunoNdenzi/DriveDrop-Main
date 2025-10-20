-- =====================================================================
-- FIND ALL FUNCTIONS WITH CONVERSATION_ID
-- =====================================================================

-- This will show us EVERY function that mentions conversation_id
SELECT 
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%INSERT INTO messages%' THEN 'INSERTS INTO MESSAGES'
    WHEN pg_get_functiondef(p.oid) LIKE '%INSERT INTO conversations%' THEN 'INSERTS INTO CONVERSATIONS'
    ELSE 'OTHER'
  END as what_it_does
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
AND p.proname NOT LIKE 'st_%'
AND p.proname NOT LIKE '_st_%'
AND pg_get_functiondef(p.oid) LIKE '%conversation_id%'
ORDER BY p.proname;
