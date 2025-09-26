-- =================================================================
-- CONSTRAINT VIOLATION DIAGNOSIS SCRIPT
-- =================================================================
-- This script will identify the specific constraint causing the
-- "Database error saving new user" issue
-- =================================================================

-- Check 1: Detailed profiles table constraints
SELECT 'PROFILES TABLE CONSTRAINTS DETAILS' as check_name;
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    tc.is_deferrable,
    tc.initially_deferred,
    rc.match_option AS match_type,
    rc.update_rule,
    rc.delete_rule,
    ccu.table_name AS references_table,
    ccu.column_name AS references_field
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
    ON tc.constraint_catalog = kcu.constraint_catalog
    AND tc.constraint_schema = kcu.constraint_schema
    AND tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.referential_constraints rc
    ON tc.constraint_catalog = rc.constraint_catalog
    AND tc.constraint_schema = rc.constraint_schema
    AND tc.constraint_name = rc.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu
    ON rc.unique_constraint_catalog = ccu.constraint_catalog
    AND rc.unique_constraint_schema = ccu.constraint_schema
    AND rc.unique_constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public'
AND tc.table_name = 'profiles'
ORDER BY tc.constraint_type, tc.constraint_name;

-- Check 2: Test each potential constraint violation individually
SELECT 'CONSTRAINT VIOLATION TESTS' as check_name;

-- Test 1: Check if ID constraint fails (primary key)
DO $$
DECLARE
    test_id uuid := '00000000-0000-0000-0000-000000000000'; -- Known invalid UUID format
    result_message text;
BEGIN
    BEGIN
        INSERT INTO profiles (id, email, first_name, last_name, role)
        VALUES (test_id, 'test1@example.com', 'Test', 'User', 'client');
        result_message := 'ID constraint: PASSED';
        DELETE FROM profiles WHERE id = test_id;
    EXCEPTION WHEN OTHERS THEN
        result_message := 'ID constraint: FAILED - ' || SQLERRM;
    END;
    RAISE NOTICE '%', result_message;
END $$;

-- Test 2: Check if email uniqueness constraint fails
DO $$
DECLARE
    test_id1 uuid := gen_random_uuid();
    test_id2 uuid := gen_random_uuid();
    result_message text;
BEGIN
    BEGIN
        -- Insert first record
        INSERT INTO profiles (id, email, first_name, last_name, role)
        VALUES (test_id1, 'duplicate@example.com', 'Test1', 'User1', 'client');
        
        -- Try to insert duplicate email
        INSERT INTO profiles (id, email, first_name, last_name, role)
        VALUES (test_id2, 'duplicate@example.com', 'Test2', 'User2', 'client');
        
        result_message := 'Email uniqueness: PASSED (no constraint)';
        DELETE FROM profiles WHERE id IN (test_id1, test_id2);
    EXCEPTION WHEN OTHERS THEN
        result_message := 'Email uniqueness: FAILED - ' || SQLERRM;
        DELETE FROM profiles WHERE id = test_id1;
    END;
    RAISE NOTICE '%', result_message;
END $$;

-- Test 3: Check if NOT NULL constraints fail
DO $$
DECLARE
    test_id uuid := gen_random_uuid();
    result_message text;
BEGIN
    BEGIN
        -- Try inserting with NULL email
        INSERT INTO profiles (id, email, first_name, last_name, role)
        VALUES (test_id, NULL, 'Test', 'User', 'client');
        result_message := 'Email NOT NULL: PASSED (allows NULL)';
        DELETE FROM profiles WHERE id = test_id;
    EXCEPTION WHEN OTHERS THEN
        result_message := 'Email NOT NULL: FAILED - ' || SQLERRM;
    END;
    RAISE NOTICE '%', result_message;
END $$;

-- Test 4: Check role enum constraint
DO $$
DECLARE
    test_id uuid := gen_random_uuid();
    result_message text;
BEGIN
    BEGIN
        -- Try inserting invalid role
        INSERT INTO profiles (id, email, first_name, last_name, role)
        VALUES (test_id, 'test4@example.com', 'Test', 'User', 'invalid_role');
        result_message := 'Role enum: PASSED (no constraint)';
        DELETE FROM profiles WHERE id = test_id;
    EXCEPTION WHEN OTHERS THEN
        result_message := 'Role enum: FAILED - ' || SQLERRM;
    END;
    RAISE NOTICE '%', result_message;
END $$;

-- Test 5: Check phone constraint (if any)
DO $$
DECLARE
    test_id uuid := gen_random_uuid();
    result_message text;
BEGIN
    BEGIN
        -- Try inserting with very long phone number
        INSERT INTO profiles (id, email, first_name, last_name, role, phone)
        VALUES (test_id, 'test5@example.com', 'Test', 'User', 'client', 'this_is_a_very_long_phone_number_that_might_exceed_limits_1234567890123456789012345678901234567890');
        result_message := 'Phone constraint: PASSED';
        DELETE FROM profiles WHERE id = test_id;
    EXCEPTION WHEN OTHERS THEN
        result_message := 'Phone constraint: FAILED - ' || SQLERRM;
    END;
    RAISE NOTICE '%', result_message;
END $$;

-- Check 3: Look for existing data that might cause conflicts
SELECT 'EXISTING DATA CONFLICTS' as check_name;

-- Check for existing emails that might conflict
SELECT 
    'Email conflicts' as conflict_type,
    email,
    COUNT(*) as count
FROM profiles 
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1;

-- Check for existing phone numbers that might conflict
SELECT 
    'Phone conflicts' as conflict_type,
    phone,
    COUNT(*) as count
FROM profiles 
WHERE phone IS NOT NULL
GROUP BY phone
HAVING COUNT(*) > 1;

-- Check 4: Test the exact insert the trigger would perform
SELECT 'TRIGGER INSERT SIMULATION' as check_name;

DO $$
DECLARE
    test_user_id uuid := gen_random_uuid();
    test_email text := 'trigger_test_' || extract(epoch from now()) || '@example.com';
    result_message text;
BEGIN
    BEGIN
        -- Simulate exactly what the handle_new_user trigger does
        INSERT INTO profiles (id, email, first_name, last_name, role, phone)
        VALUES (
            test_user_id,
            test_email,
            COALESCE('{"first_name":"Test","last_name":"User","role":"client","phone":"1234567890"}'::jsonb->>'first_name', ''),
            COALESCE('{"first_name":"Test","last_name":"User","role":"client","phone":"1234567890"}'::jsonb->>'last_name', ''),
            COALESCE(('{"first_name":"Test","last_name":"User","role":"client","phone":"1234567890"}'::jsonb->>'role')::user_role, 'client'),
            '{"first_name":"Test","last_name":"User","role":"client","phone":"1234567890"}'::jsonb->>'phone'
        );
        
        result_message := 'TRIGGER SIMULATION: SUCCESS - The insert works!';
        
        -- Clean up
        DELETE FROM profiles WHERE id = test_user_id;
        
    EXCEPTION WHEN OTHERS THEN
        result_message := 'TRIGGER SIMULATION: FAILED - ' || SQLERRM;
    END;
    
    RAISE NOTICE '%', result_message;
END $$;

-- Check 5: Verify handle_new_user function exists and is correct
SELECT 'HANDLE_NEW_USER FUNCTION CHECK' as check_name;
SELECT 
    proname as function_name,
    CASE 
        WHEN prosrc IS NOT NULL THEN 'EXISTS'
        ELSE 'MISSING'
    END as status,
    CASE 
        WHEN prosrc LIKE '%INSERT INTO profiles%' THEN 'Has INSERT statement'
        ELSE 'Missing INSERT statement'
    END as has_insert
FROM pg_proc 
WHERE proname = 'handle_new_user'
UNION ALL
SELECT 
    'handle_new_user' as function_name,
    'MISSING' as status,
    'Function does not exist' as has_insert
WHERE NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user');

-- =================================================================
-- SUMMARY AND RECOMMENDATIONS
-- =================================================================
SELECT 'CONSTRAINT DIAGNOSIS COMPLETE' as check_name;
SELECT 'Look for FAILED tests above to identify the specific constraint issue.' as message;