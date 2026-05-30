-- ===============================================
-- CLEANUP TEST DRIVER APPLICATION
-- Email: btrading456@gmail.com
-- Run this in Supabase SQL Editor
-- ===============================================

-- Step 1: Find the application and user
SELECT 
  da.id as application_id,
  da.email,
  da.full_name,
  da.status,
  da.submitted_at,
  p.id as profile_id,
  au.id as auth_user_id
FROM driver_applications da
LEFT JOIN profiles p ON p.email = da.email
LEFT JOIN auth.users au ON au.email = da.email
WHERE da.email = 'btrading456@gmail.com';

-- Step 2: Delete driver application
DELETE FROM driver_applications
WHERE email = 'btrading456@gmail.com';

-- Step 3: Delete profile (if exists)
DELETE FROM profiles
WHERE email = 'btrading456@gmail.com';

-- Step 4: Delete auth user (if exists)
-- Note: This uses Supabase's admin API, might need to be done from dashboard
-- or you can use this query to get the user_id and delete via dashboard
SELECT id, email, created_at
FROM auth.users
WHERE email = 'btrading456@gmail.com';

-- If you need to delete the auth user via SQL (requires service_role):
-- Use this format (replace USER_ID with actual ID from query above):
-- DELETE FROM auth.users WHERE id = 'USER_ID_HERE';

-- Step 5: Verify cleanup
SELECT 'driver_applications' as table_name, COUNT(*) as remaining
FROM driver_applications
WHERE email = 'btrading456@gmail.com'
UNION ALL
SELECT 'profiles', COUNT(*)
FROM profiles
WHERE email = 'btrading456@gmail.com'
UNION ALL
SELECT 'auth.users', COUNT(*)
FROM auth.users
WHERE email = 'btrading456@gmail.com';

-- ===============================================
-- EXPECTED RESULT: All counts should be 0
-- ===============================================

-- ALTERNATIVE: Delete by application ID (if you know it)
-- DELETE FROM driver_applications WHERE id = 'APPLICATION_ID_HERE';
