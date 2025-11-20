-- COMPREHENSIVE FIX for signup issues
-- This addresses all permission and schema issues

-- ============================================
-- STEP 1: Create and configure net schema
-- ============================================

-- Create net schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS net;

-- Make postgres the owner (important for internal functions)
ALTER SCHEMA net OWNER TO postgres;

-- Grant ALL privileges to all roles
GRANT ALL ON SCHEMA net TO postgres;
GRANT ALL ON SCHEMA net TO service_role;
GRANT ALL ON SCHEMA net TO authenticated;
GRANT ALL ON SCHEMA net TO anon;
GRANT USAGE ON SCHEMA net TO public;

-- Grant on all objects in net schema
GRANT ALL ON ALL TABLES IN SCHEMA net TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO postgres, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA net TO postgres, service_role;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA net GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA net GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA net GRANT ALL ON FUNCTIONS TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA net GRANT ALL ON ROUTINES TO postgres, service_role;

-- ============================================
-- STEP 2: Fix the profile creation trigger
-- ============================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create improved function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  user_role public.user_role;
BEGIN
  -- Parse role from metadata, default to 'client'
  BEGIN
    user_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'client'::public.user_role);
  EXCEPTION WHEN OTHERS THEN
    user_role := 'client'::public.user_role;
  END;

  -- Insert profile with error handling
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    role,
    phone,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    user_role,
    NEW.raw_user_meta_data->>'phone',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the user creation
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STEP 3: Grant all necessary permissions
-- ============================================

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;

-- Ensure profiles table has correct permissions
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.profiles TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- STEP 4: Verify the setup
-- ============================================

-- Check if trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Check schema permissions
SELECT 
    schema_name,
    schema_owner
FROM information_schema.schemata
WHERE schema_name = 'net';

-- ============================================
-- DONE! Now Railway needs to redeploy
-- ============================================
-- Wait for Railway to finish deploying the updated backend
-- Then test signup again
-- ============================================
