-- Check what's actually on auth.users table that might be calling net.http_post

-- 1. Check ALL triggers on auth.users (including system triggers)
SELECT 
    trigger_schema,
    trigger_name,
    event_object_table,
    action_statement,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE event_object_table = 'users'
AND trigger_schema = 'auth'
ORDER BY trigger_name;

-- 2. Get the actual function definitions for triggers on auth.users
SELECT 
    t.trigger_name,
    t.action_statement,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM information_schema.triggers t
LEFT JOIN pg_proc p ON p.proname = regexp_replace(t.action_statement, '.*EXECUTE (?:FUNCTION|PROCEDURE) ([^(]+).*', '\1')
WHERE t.event_object_table = 'users'
AND t.trigger_schema = 'auth';

-- 3. Check pg_trigger directly for more details
SELECT 
    tgname as trigger_name,
    tgtype,
    tgenabled,
    pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass;
