-- Check and fix profile creation issues

-- 1. Check if there's an automatic trigger for profile creation
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'profiles'
ORDER BY trigger_name;

-- 2. Check RLS policies on profiles table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- 3. Temporarily disable RLS on profiles for testing (BE CAREFUL!)
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Service role can update profiles" ON profiles;
DROP POLICY IF EXISTS "Service role can select profiles" ON profiles;

-- Create new policies to allow service_role to insert
CREATE POLICY "Service role can insert profiles"
ON profiles
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update profiles"
ON profiles
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can select profiles"
ON profiles
FOR SELECT
TO service_role
USING (true);

-- 5. Grant necessary permissions to service_role
GRANT ALL ON profiles TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
