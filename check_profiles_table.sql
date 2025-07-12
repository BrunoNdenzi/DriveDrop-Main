-- Query to inspect the profiles table structure and policies
SELECT table_schema, table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Get RLS policies for profiles table
SELECT *
FROM pg_policies
WHERE tablename = 'profiles';

-- Check if RLS is enabled on the profiles table
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'profiles' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
