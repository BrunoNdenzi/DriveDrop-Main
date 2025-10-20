-- =====================================================================
-- CHECK TRIGGERS ON OTHER TABLES
-- =====================================================================

-- Check triggers on tracking_events table
SELECT 
  t.tgname as trigger_name,
  p.proname as function_name,
  CASE WHEN t.tgenabled = 'O' THEN 'ENABLED' ELSE 'DISABLED' END as status
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'public.tracking_events'::regclass
AND NOT t.tgisinternal
ORDER BY t.tgname;

-- Check triggers on job_applications table
SELECT 
  t.tgname as trigger_name,
  p.proname as function_name,
  CASE WHEN t.tgenabled = 'O' THEN 'ENABLED' ELSE 'DISABLED' END as status
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid  
WHERE t.tgrelid = 'public.job_applications'::regclass
AND NOT t.tgisinternal
ORDER BY t.tgname;
