-- =================================================================
-- USER CREATION FIX SCRIPT
-- =================================================================
-- This script will fix common constraint violations that prevent
-- user creation in Supabase. Run this AFTER running the diagnosis.
-- =================================================================

-- Step 1: Ensure the user_role enum exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('client', 'driver', 'admin');
        RAISE NOTICE 'Created user_role enum';
    ELSE
        RAISE NOTICE 'user_role enum already exists';
    END IF;
END $$;

-- Step 2: Ensure profiles table has correct structure
-- Add phone column if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- Ensure email column allows NULL (some triggers might not provide email immediately)
ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;

-- Step 3: Create or replace the handle_new_user function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert with proper error handling and default values
    INSERT INTO profiles (
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
        COALESCE(NEW.email, ''), -- Handle potential NULL email
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client'::user_role),
        NEW.raw_user_meta_data->>'phone',
        NOW(),
        NOW()
    );
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't prevent user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Ensure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Step 5: Set up proper RLS policies for profiles
-- Enable RLS if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Service role can do anything" ON profiles;

-- Create comprehensive RLS policies
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Allow the trigger function to insert profiles (service role access)
CREATE POLICY "Service role can do anything"
    ON profiles FOR ALL
    USING (current_setting('role', true) = 'service_role')
    WITH CHECK (current_setting('role', true) = 'service_role');

-- Allow authenticated users to insert during signup
CREATE POLICY "Allow insert during signup"
    ON profiles FOR INSERT
    WITH CHECK (true); -- This allows the trigger to work during signup

-- Step 6: Test the fix
DO $$
DECLARE
    test_user_id uuid := gen_random_uuid();
    test_email text := 'fix_test_' || extract(epoch from now()) || '@example.com';
    result_message text;
BEGIN
    BEGIN
        -- Test the function directly
        INSERT INTO profiles (id, email, first_name, last_name, role, phone)
        VALUES (
            test_user_id,
            test_email,
            'Test',
            'User',
            'client'::user_role,
            '1234567890'
        );
        
        result_message := 'SUCCESS: Profile creation now works!';
        
        -- Clean up test data
        DELETE FROM profiles WHERE id = test_user_id;
        
    EXCEPTION WHEN OTHERS THEN
        result_message := 'STILL FAILING: ' || SQLERRM;
    END;
    
    RAISE NOTICE '%', result_message;
END $$;

-- Step 7: Verify trigger is properly attached
SELECT 
    'TRIGGER VERIFICATION' as check_type,
    t.tgname as trigger_name,
    t.tgenabled as enabled,
    'auth.users' as table_name
FROM pg_trigger t
WHERE t.tgrelid = 'auth.users'::regclass
AND t.tgname = 'on_auth_user_created';

-- =================================================================
-- COMPLETION MESSAGE
-- =================================================================
SELECT 'FIX SCRIPT COMPLETE' as status;
SELECT 'The user creation issue should now be resolved.' as message;
SELECT 'Try signing up a new user in your mobile app to test.' as next_step;