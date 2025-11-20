-- Fix the send_welcome_email function to properly use net.http_post
-- The issue is with parameter types - net.http_post expects specific types

DROP FUNCTION IF EXISTS public.send_welcome_email() CASCADE;

CREATE OR REPLACE FUNCTION public.send_welcome_email()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth, net
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
BEGIN
  -- Use net.http_post with proper type casting
  SELECT INTO request_id net.http_post(
    url := 'https://drivedrop-main-production.up.railway.app/api/v1/notifications/welcome'::text,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := json_build_object(
      'email', NEW.email,
      'firstName', COALESCE(NEW.raw_user_meta_data->>'first_name', 'there')
    )::text
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail user creation
  RAISE WARNING 'Failed to send welcome email for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_user_signup ON auth.users;

CREATE TRIGGER on_user_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.send_welcome_email();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.send_welcome_email() TO service_role;
GRANT EXECUTE ON FUNCTION public.send_welcome_email() TO authenticated;

-- Verify the trigger was created
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_user_signup';
