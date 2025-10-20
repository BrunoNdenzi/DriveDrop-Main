-- =====================================================================
-- CHECK THE CONVERSATION FUNCTIONS
-- =====================================================================

-- Check create_conversation_on_assignment
SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'create_conversation_on_assignment'
LIMIT 1;
