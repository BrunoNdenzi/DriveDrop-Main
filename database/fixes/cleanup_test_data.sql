-- ========================================
-- CLEAN UP TEST DATA BEFORE PRODUCTION LAUNCH
-- ========================================
-- ⚠️ WARNING: This deletes ALL user data except specified admin accounts
-- 
-- PREREQUISITES:
-- 1. Download a backup from Supabase Dashboard → Settings → Database
-- 2. Replace 'YOUR_ADMIN_EMAIL@example.com' below with your actual admin email
-- 3. Test in a transaction first (ROLLBACK if anything looks wrong)
--
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/tgdewxxmfmbvvcelngeg/sql/new
-- ========================================

BEGIN;

-- ========================================
-- STEP 1: Verify What Will Be Deleted
-- ========================================

-- Review users that will be DELETED
SELECT 
  id, 
  email, 
  created_at,
  '⚠️ WILL BE DELETED' as status
FROM auth.users 
WHERE email NOT IN (
  'YOUR_ADMIN_EMAIL@example.com'  -- ⚠️ REPLACE THIS WITH YOUR REAL ADMIN EMAIL!
  -- Add more emails to keep (optional):
  -- , 'another-keeper@example.com'
);

-- Review users that will be KEPT
SELECT 
  id, 
  email, 
  created_at,
  '✅ WILL BE KEPT' as status
FROM auth.users 
WHERE email IN (
  'YOUR_ADMIN_EMAIL@example.com'  -- ⚠️ REPLACE THIS!
);

-- If the above looks wrong, run: ROLLBACK;
-- Then fix the email addresses and try again.

-- ========================================
-- STEP 2: Delete User Data in Correct Order
-- ========================================
-- Foreign keys require us to delete child records before parent records

-- Get list of user IDs to delete (everyone except admin)
CREATE TEMP TABLE users_to_delete AS
SELECT id 
FROM auth.users 
WHERE email NOT IN (
  'YOUR_ADMIN_EMAIL@example.com'  -- ⚠️ REPLACE THIS!
);

-- Delete in dependency order (child → parent):

-- 1. Delete messages (references profiles via sender_id/receiver_id)
DELETE FROM public.messages 
WHERE sender_id IN (SELECT id FROM users_to_delete)
   OR receiver_id IN (SELECT id FROM users_to_delete);

-- 2. Delete conversations (references profiles via client_id/driver_id)
DELETE FROM public.conversations 
WHERE client_id IN (SELECT id FROM users_to_delete)
   OR driver_id IN (SELECT id FROM users_to_delete);

-- 3. Delete driver ratings (references profiles)
DELETE FROM public.driver_ratings 
WHERE driver_id IN (SELECT id FROM users_to_delete)
   OR client_id IN (SELECT id FROM users_to_delete);

-- 4. Delete driver locations (references profiles)
DELETE FROM public.driver_locations 
WHERE driver_id IN (SELECT id FROM users_to_delete);

-- 5. Delete job applications (references profiles)
DELETE FROM public.job_applications 
WHERE driver_id IN (SELECT id FROM users_to_delete);

-- 6. Delete shipment status history (references profiles via changed_by)
DELETE FROM public.shipment_status_history 
WHERE changed_by IN (SELECT id FROM users_to_delete);

-- 7. Delete tracking events (references profiles via created_by)
DELETE FROM public.tracking_events 
WHERE created_by IN (SELECT id FROM users_to_delete);

-- 8. Delete payments (references profiles via client_id)
DELETE FROM public.payments 
WHERE client_id IN (SELECT id FROM users_to_delete);

-- 9. Delete pricing config history (references profiles via changed_by)
-- Note: This preserves the pricing config itself, only deletes the audit trail
DELETE FROM public.pricing_config_history 
WHERE changed_by IN (SELECT id FROM users_to_delete);

-- 10. Delete pricing configs created/updated by test users
-- Note: Only delete if created_by or updated_by are test users
-- This won't delete active pricing config unless a test user created it
DELETE FROM public.pricing_config 
WHERE created_by IN (SELECT id FROM users_to_delete)
   OR updated_by IN (SELECT id FROM users_to_delete);

-- 11. Delete shipments (references profiles via client_id/driver_id/updated_by)
DELETE FROM public.shipments 
WHERE client_id IN (SELECT id FROM users_to_delete)
   OR driver_id IN (SELECT id FROM users_to_delete)
   OR updated_by IN (SELECT id FROM users_to_delete);

-- 12. Delete driver applications (not linked to profiles directly, but user data)
DELETE FROM public.driver_applications 
WHERE email IN (
  SELECT email FROM auth.users WHERE id IN (SELECT id FROM users_to_delete)
);

-- 13. Delete user vehicles
DELETE FROM public.user_vehicles 
WHERE user_id IN (SELECT id FROM users_to_delete);

-- 14. Delete driver vehicles (references auth.users)
DELETE FROM public.driver_vehicles 
WHERE driver_id IN (SELECT id FROM users_to_delete);

-- 15. Delete client addresses
DELETE FROM public.client_addresses 
WHERE client_id IN (SELECT id FROM users_to_delete);

-- 16. Delete client payment methods
DELETE FROM public.client_payment_methods 
WHERE client_id IN (SELECT id FROM users_to_delete);

-- 17. Delete settings tables
DELETE FROM public.client_settings WHERE client_id IN (SELECT id FROM users_to_delete);
DELETE FROM public.driver_settings WHERE driver_id IN (SELECT id FROM users_to_delete);
DELETE FROM public.driver_security_settings WHERE driver_id IN (SELECT id FROM users_to_delete);
DELETE FROM public.driver_privacy_preferences WHERE driver_id IN (SELECT id FROM users_to_delete);
DELETE FROM public.privacy_settings WHERE user_id IN (SELECT id FROM users_to_delete);

-- 18. Delete notifications
DELETE FROM public.push_tokens WHERE user_id IN (SELECT id FROM users_to_delete);
DELETE FROM public.notification_preferences WHERE user_id IN (SELECT id FROM users_to_delete);

-- 19. Delete support tickets
DELETE FROM public.support_tickets WHERE user_id IN (SELECT id FROM users_to_delete);

-- 20. Now safe to delete profiles (all child records deleted)
DELETE FROM public.profiles 
WHERE id IN (SELECT id FROM users_to_delete);

-- 21. Finally, delete auth.users (all related data deleted)
DELETE FROM auth.users 
WHERE id IN (SELECT id FROM users_to_delete);

-- Clean up temp table
DROP TABLE users_to_delete;

-- ========================================
-- STEP 3: Reset Auto-Increment Sequences
-- ========================================
-- This makes the first real shipment be #1 instead of #247

-- Find all sequences and reset them
DO $$
DECLARE
  seq_record RECORD;
BEGIN
  FOR seq_record IN 
    SELECT sequencename 
    FROM pg_sequences 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER SEQUENCE public.%I RESTART WITH 1', seq_record.sequencename);
    RAISE NOTICE 'Reset sequence: %', seq_record.sequencename;
  END LOOP;
END $$;

-- ========================================
-- STEP 4: Verify Cleanup
-- ========================================

SELECT 
  'Users (auth.users)' as table_name, 
  COUNT(*)::text as remaining,
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ Perfect (1 admin)'
    WHEN COUNT(*) < 5 THEN '✅ Good (kept test accounts)'
    ELSE '⚠️ Review (many kept)'
  END as status
FROM auth.users

UNION ALL

SELECT 
  'Profiles', 
  COUNT(*)::text,
  CASE WHEN COUNT(*) <= 1 THEN '✅ Clean' ELSE '⚠️ Check' END
FROM public.profiles

UNION ALL

SELECT 
  'Shipments', 
  COUNT(*)::text,
  CASE WHEN COUNT(*) = 0 THEN '✅ Clean' ELSE '⚠️ Has data' END
FROM public.shipments

UNION ALL

SELECT 
  'Payments', 
  COUNT(*)::text,
  CASE WHEN COUNT(*) = 0 THEN '✅ Clean' ELSE '⚠️ Has data' END
FROM public.payments

UNION ALL

SELECT 
  'Messages', 
  COUNT(*)::text,
  CASE WHEN COUNT(*) = 0 THEN '✅ Clean' ELSE '⚠️ Has data' END
FROM public.messages

UNION ALL

SELECT 
  'Conversations', 
  COUNT(*)::text,
  CASE WHEN COUNT(*) = 0 THEN '✅ Clean' ELSE '⚠️ Has data' END
FROM public.conversations

UNION ALL

SELECT 
  'Job Applications', 
  COUNT(*)::text,
  CASE WHEN COUNT(*) = 0 THEN '✅ Clean' ELSE '⚠️ Has data' END
FROM public.job_applications

UNION ALL

SELECT 
  'Driver Applications', 
  COUNT(*)::text,
  CASE WHEN COUNT(*) = 0 THEN '✅ Clean' ELSE '⚠️ Has data' END
FROM public.driver_applications

UNION ALL

SELECT 
  'Driver Locations', 
  COUNT(*)::text,
  CASE WHEN COUNT(*) = 0 THEN '✅ Clean' ELSE '⚠️ Has data' END
FROM public.driver_locations;

-- ========================================
-- STEP 5: Commit or Rollback
-- ========================================

-- Review the verification results above.
-- If everything looks good (all ✅ Clean):
COMMIT;

-- If something looks wrong:
-- ROLLBACK;

-- ========================================
-- STEP 6: Post-Cleanup Verification
-- ========================================

-- After COMMIT, verify sequences were reset:
SELECT 
  schemaname,
  sequencename,
  last_value,
  CASE 
    WHEN last_value = 1 THEN '✅ Reset to 1'
    ELSE '⚠️ Value: ' || last_value::text
  END as status
FROM pg_sequences 
WHERE schemaname = 'public'
ORDER BY sequencename;

-- ========================================
-- SUCCESS!
-- ========================================
-- Your database is now clean and ready for production!
-- 
-- Next steps:
-- 1. Test app login with your admin account
-- 2. Create a test shipment (should be ID #1)
-- 3. Delete the test shipment
-- 4. Download a fresh backup (clean state)
-- 5. Ready to launch! 🚀
