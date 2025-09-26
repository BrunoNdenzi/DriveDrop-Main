-- =================================================================
-- SUPABASE USER CREATION DIAGNOSIS SCRIPT
-- =================================================================
-- Run this script in your Supabase SQL Editor to diagnose the 
-- "Database error saving new user" issue
-- =================================================================

-- Check 1: Verify profiles table structure
SELECT 'PROFILES TABLE STRUCTURE' as check_name;
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Check 2: Look for the handle_new_user function
SELECT 'HANDLE_NEW_USER FUNCTION' as check_name;
SELECT 
    proname as function_name,
    prosrc as function_body
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- Check 3: Check for triggers on auth.users table
SELECT 'AUTH.USERS TRIGGERS' as check_name;
SELECT 
    t.tgname as trigger_name,
    t.tgenabled as enabled,
    p.proname as function_name,
    pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'auth.users'::regclass;

-- Check 4: Verify user_role enum exists
SELECT 'USER_ROLE ENUM' as check_name;
SELECT 
    e.enumlabel as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid 
WHERE t.typname = 'user_role'
ORDER BY e.enumsortorder;

-- Check 5: Test profile creation manually (simulating the trigger)
SELECT 'MANUAL PROFILE CREATION TEST' as check_name;
-- This will show what happens when we try to insert a profile manually
-- with the same data the trigger would use

-- First, let's see if we can insert a basic profile
DO $$
DECLARE
    test_id uuid := gen_random_uuid();
    result_message text;
BEGIN
    BEGIN
        INSERT INTO profiles (id, email, first_name, last_name, role, phone)
        VALUES (
            test_id,
            'test@example.com',
            'Test',
            'User',
            'client'::user_role,
            '1234567890'
        );
        
        result_message := 'SUCCESS: Manual profile creation works';
        
        -- Clean up the test record
        DELETE FROM profiles WHERE id = test_id;
        
    EXCEPTION WHEN OTHERS THEN
        result_message := 'ERROR: ' || SQLERRM;
    END;
    
    RAISE NOTICE '%', result_message;
END $$;

-- Check 6: Verify RLS policies on profiles table
SELECT 'PROFILES RLS POLICIES' as check_name;
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
WHERE schemaname = 'public' 
AND tablename = 'profiles';

-- Check 7: Check if RLS is enabled on profiles table
SELECT 'RLS STATUS' as check_name;
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'profiles';

-- Check 8: Look for any constraints that might be failing
SELECT 'PROFILES CONSTRAINTS' as check_name;
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.profiles'::regclass;

-- Check 9: Check auth.users structure to see what metadata fields are available
SELECT 'AUTH.USERS STRUCTURE' as check_name;
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'auth' 
AND table_name = 'users'
ORDER BY ordinal_position;

-- Check 10: Test the exact JSON metadata extraction the trigger would use
SELECT 'METADATA EXTRACTION TEST' as check_name;
-- This simulates how the trigger extracts data from raw_user_meta_data
SELECT 
    'first_name' as field,
    COALESCE('{"first_name":"Test","last_name":"User","role":"client","phone":"1234567890"}'::jsonb->>'first_name', '') as extracted_value
UNION ALL
SELECT 
    'last_name' as field,
    COALESCE('{"first_name":"Test","last_name":"User","role":"client","phone":"1234567890"}'::jsonb->>'last_name', '') as extracted_value
UNION ALL
SELECT 
    'role' as field,
    COALESCE(('{"first_name":"Test","last_name":"User","role":"client","phone":"1234567890"}'::jsonb->>'role')::user_role::text, 'client') as extracted_value
UNION ALL
SELECT 
    'phone' as field,
    '{"first_name":"Test","last_name":"User","role":"client","phone":"1234567890"}'::jsonb->>'phone' as extracted_value;

-- =================================================================
-- SUMMARY SECTION
-- =================================================================
SELECT 'DIAGNOSIS COMPLETE' as check_name;
SELECT 'Check the results above to identify the issue with user creation.' as message;
SELECT 'Common issues:' as message;
SELECT '1. Missing handle_new_user function' as issue;
SELECT '2. Trigger not properly attached to auth.users' as issue;
SELECT '3. RLS policies blocking the insert' as issue;
SELECT '4. Missing user_role enum' as issue;
SELECT '5. Constraint violations (unique, not null, etc.)' as issue;