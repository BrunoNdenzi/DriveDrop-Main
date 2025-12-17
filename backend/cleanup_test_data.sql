-- ========================================
-- DriveDrop Test Data Cleanup Script
-- ========================================
-- Run this in Supabase SQL Editor to clean all test data
-- This preserves schema but removes all user data for fresh testing

-- ========================================
-- STEP 1: DELETE ALL TRANSACTIONAL DATA
-- ========================================
-- Note: Only deleting from tables that exist
-- Wrapped in DO block to skip tables that don't exist

DO $$
BEGIN
  -- Delete all messages
  DELETE FROM public.messages;
  RAISE NOTICE 'Deleted messages';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table messages does not exist, skipping';
END $$;

DO $$
BEGIN
  -- Delete all shipment photos
  DELETE FROM public.shipment_photos;
  RAISE NOTICE 'Deleted shipment_photos';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table shipment_photos does not exist, skipping';
END $$;

DO $$
BEGIN
  -- Delete all broker assignments
  DELETE FROM public.broker_assignments;
  RAISE NOTICE 'Deleted broker_assignments';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table broker_assignments does not exist, skipping';
END $$;

DO $$
BEGIN
  -- Delete all broker payouts
  DELETE FROM public.broker_payouts;
  RAISE NOTICE 'Deleted broker_payouts';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table broker_payouts does not exist, skipping';
END $$;

DO $$
BEGIN
  -- Delete all broker documents
  DELETE FROM public.broker_documents;
  RAISE NOTICE 'Deleted broker_documents';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table broker_documents does not exist, skipping';
END $$;

DO $$
BEGIN
  -- Delete all broker carriers
  DELETE FROM public.broker_carriers;
  RAISE NOTICE 'Deleted broker_carriers';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table broker_carriers does not exist, skipping';
END $$;

DO $$
BEGIN
  -- Delete all job applications
  DELETE FROM public.job_applications;
  RAISE NOTICE 'Deleted job_applications';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table job_applications does not exist, skipping';
END $$;

DO $$
BEGIN
  -- Delete all driver verifications
  DELETE FROM public.driver_verifications;
  RAISE NOTICE 'Deleted driver_verifications';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table driver_verifications does not exist, skipping';
END $$;

DO $$
BEGIN
  -- Delete all driver documents
  DELETE FROM public.driver_documents;
  RAISE NOTICE 'Deleted driver_documents';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table driver_documents does not exist, skipping';
END $$;

DO $$
BEGIN
  -- Delete all shipments
  DELETE FROM public.shipments;
  RAISE NOTICE 'Deleted shipments';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table shipments does not exist, skipping';
END $$;

DO $$
BEGIN
  -- Delete all payment methods
  DELETE FROM public.payment_methods;
  RAISE NOTICE 'Deleted payment_methods';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table payment_methods does not exist, skipping';
END $$;

DO $$
BEGIN
  -- Delete all vehicles
  DELETE FROM public.vehicles;
  RAISE NOTICE 'Deleted vehicles';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table vehicles does not exist, skipping';
END $$;

DO $$
BEGIN
  -- Delete all onboarding records
  DELETE FROM public.user_onboarding;
  RAISE NOTICE 'Deleted user_onboarding';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table user_onboarding does not exist, skipping';
END $$;

DO $$
BEGIN
  -- Delete all account deletion requests
  DELETE FROM public.account_deletion_requests;
  RAISE NOTICE 'Deleted account_deletion_requests';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table account_deletion_requests does not exist, skipping';
END $$;

DO $$
BEGIN
  -- Delete all cancellation records (must be before profiles)
  DELETE FROM public.cancellation_records;
  RAISE NOTICE 'Deleted cancellation_records';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table cancellation_records does not exist, skipping';
END $$;

DO $$
BEGIN
  -- Delete all driver settings (must be before profiles)
  DELETE FROM public.driver_settings;
  RAISE NOTICE 'Deleted driver_settings';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table driver_settings does not exist, skipping';
END $$;

DO $$
BEGIN
  -- Delete all tracking events (must be before profiles)
  DELETE FROM public.tracking_events;
  RAISE NOTICE 'Deleted tracking_events';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table tracking_events does not exist, skipping';
END $$;

-- ========================================
-- STEP 2: DELETE ALL USER PROFILES
-- ========================================

DO $$
BEGIN
  -- Delete all broker profiles
  DELETE FROM public.broker_profiles;
  RAISE NOTICE 'Deleted broker_profiles';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table broker_profiles does not exist, skipping';
END $$;

DO $$
BEGIN
  -- Delete all profiles (client, driver, admin)
  DELETE FROM public.profiles;
  RAISE NOTICE 'Deleted profiles';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table profiles does not exist, skipping';
END $$;

-- ========================================
-- STEP 3: DELETE ALL AUTH USERS
-- ========================================
-- This removes all authentication records
-- WARNING: This will log out all users and delete all accounts

DO $$
BEGIN
  DELETE FROM auth.users;
  RAISE NOTICE 'Deleted auth.users';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Schema auth.users does not exist, skipping';
END $$;

-- ========================================
-- STEP 4: RESET SEQUENCES (Optional)
-- ========================================
-- Uncomment if you want to reset auto-increment counters

-- ALTER SEQUENCE IF EXISTS shipments_id_seq RESTART WITH 1;
-- (Add other sequences if needed)

-- ========================================
-- VERIFICATION QUERIES
-- ========================================
-- Run these to verify cleanup was successful
-- Shows count for each table that exists

DO $$
DECLARE
  rec RECORD;
  result_count BIGINT;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CLEANUP VERIFICATION RESULTS';
  RAISE NOTICE '========================================';
  
  -- Check each table and show count
  FOR rec IN 
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_schema IN ('public', 'auth')
      AND table_name IN (
        'users', 'profiles', 'broker_profiles', 'shipments', 
        'job_applications', 'driver_documents', 'vehicles',
        'payment_methods', 'messages', 'user_onboarding',
        'account_deletion_requests', 'broker_assignments',
        'broker_payouts', 'broker_carriers', 'shipment_photos',
        'driver_verifications'
      )
    ORDER BY table_name
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I.%I', rec.table_schema, rec.table_name) INTO result_count;
    RAISE NOTICE '% records in %.%', result_count, rec.table_schema, rec.table_name;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'All counts should be 0';
  RAISE NOTICE '========================================';
END $$;

-- ========================================
-- EXPECTED RESULT
-- ========================================
-- All counts should be 0
-- Database is now clean and ready for fresh test accounts
