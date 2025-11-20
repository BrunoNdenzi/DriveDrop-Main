-- First, let's see what send_welcome_email() function actually does
SELECT pg_get_functiondef('send_welcome_email'::regproc);

-- Also check if it exists in public schema
SELECT 
    routine_schema,
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_name = 'send_welcome_email';
