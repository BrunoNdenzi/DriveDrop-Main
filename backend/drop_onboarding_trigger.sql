-- Drop onboarding trigger that's causing signup failures
-- Run this in Supabase SQL Editor

DROP TRIGGER IF EXISTS on_auth_user_created_onboarding ON auth.users;
DROP FUNCTION IF EXISTS create_user_onboarding_on_signup();

-- Optional: Drop the onboarding table if not needed
-- DROP TABLE IF EXISTS public.user_onboarding CASCADE;

-- Verify trigger is gone
SELECT 
  trigger_name, 
  event_object_table, 
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created_onboarding';
