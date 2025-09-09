-- Test script for messaging system functions
-- Run this after applying the main migration

-- Test 1: Check if functions exist
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname IN ('send_message_v2', 'is_messaging_allowed', 'get_conversation_messages', 'get_user_conversations', 'mark_message_as_read')
ORDER BY proname;

-- Test 2: Check if messages table exists with correct structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'messages'
ORDER BY ordinal_position;

-- Test 3: Check if indexes were created
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'messages'
ORDER BY indexname;

-- Test 4: Check RLS policies
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'messages'
ORDER BY policyname;

-- Test 5: Test messaging permission function (example - replace with actual IDs)
-- SELECT is_messaging_allowed('some-shipment-id'::uuid, 'some-user-id'::uuid);

-- Test 6: Check if trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'messages';

COMMENT ON SCRIPT 'test_messaging_functions.sql' IS 'Verification script for messaging system setup';
