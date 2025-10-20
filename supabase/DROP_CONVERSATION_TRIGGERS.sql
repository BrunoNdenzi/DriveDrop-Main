-- =====================================================================
-- DISABLE THE PROBLEMATIC TRIGGERS PERMANENTLY
-- =====================================================================
-- Even though they show as DISABLED, let's drop them completely

-- Drop the conversation triggers
DROP TRIGGER IF EXISTS trigger_create_conversation ON public.shipments;
DROP TRIGGER IF EXISTS trigger_expire_conversation ON public.shipments;

-- Drop the problematic functions
DROP FUNCTION IF EXISTS create_conversation_on_assignment() CASCADE;
DROP FUNCTION IF EXISTS expire_conversation_on_completion() CASCADE;

-- Verify they're gone
SELECT 'Triggers and functions removed' as status;

-- List remaining triggers
SELECT 
  t.tgname as remaining_triggers,
  p.proname as function_name,
  CASE WHEN t.tgenabled = 'O' THEN 'ENABLED' ELSE 'DISABLED' END as status
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'public.shipments'::regclass
AND NOT t.tgisinternal
ORDER BY t.tgname;
