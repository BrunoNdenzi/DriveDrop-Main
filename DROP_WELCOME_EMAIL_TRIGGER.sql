-- FOUND THE ISSUE: on_user_signup trigger calling send_welcome_email()
-- This function is likely trying to use net.http_post to send emails

-- Option 1: Drop the problematic trigger (RECOMMENDED for now)
DROP TRIGGER IF EXISTS on_user_signup ON auth.users;

-- Option 2: Check what the function does (run this to see)
SELECT pg_get_functiondef('send_welcome_email'::regproc);

-- Option 3: Drop the function entirely if you don't need welcome emails
-- DROP FUNCTION IF EXISTS send_welcome_email() CASCADE;

-- After dropping the trigger, verify it's gone
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_user_signup';

-- Verify our profile creation trigger still exists
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
