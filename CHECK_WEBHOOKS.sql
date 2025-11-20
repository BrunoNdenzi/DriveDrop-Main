-- Check for any webhooks or database triggers that might be calling net.http_post

-- 1. Check all triggers in the database
SELECT 
    trigger_schema,
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY trigger_schema, event_object_table;

-- 2. Check all functions that might call net.http_post
SELECT 
    routine_schema,
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_definition ILIKE '%net.http%'
ORDER BY routine_name;

-- 3. Check if pg_net extension is enabled
SELECT 
    extname,
    extversion,
    extnamespace::regnamespace AS schema
FROM pg_extension
WHERE extname = 'pg_net';

-- 4. List all available functions in net schema (if it exists)
SELECT 
    routine_schema,
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'net'
ORDER BY routine_name;
