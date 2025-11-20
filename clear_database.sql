-- ============================================
-- DriveDrop Database Data Cleanup Script
-- This script deletes ALL data but preserves table structures
-- ============================================

-- Start transaction
BEGIN;

-- Disable triggers temporarily to avoid cascade issues
SET session_replication_role = 'replica';

-- 1. Delete all messages (if table exists)
DELETE FROM messages WHERE true;

-- 2. Delete all conversations (if table exists)
DELETE FROM conversations WHERE true;

-- 3. Delete all driver locations (if table exists)
DELETE FROM driver_locations WHERE true;

-- 4. Delete all pickup verifications (if table exists)
DELETE FROM pickup_verifications WHERE true;

-- 5. Delete all payments (if table exists)
DELETE FROM payments WHERE true;

-- 6. Delete all shipment status history (if table exists)
DELETE FROM shipment_status_history WHERE true;

-- 7. Delete all job applications (if table exists)
DELETE FROM job_applications WHERE true;

-- 8. Delete all shipments
DELETE FROM shipments WHERE true;

-- 9. Delete pricing configuration history (keep the active config)
DELETE FROM pricing_config_history WHERE true;

-- Note: We keep pricing_config table with current settings

-- 10. Delete all profiles EXCEPT admin
DELETE FROM profiles WHERE role != 'admin';

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Commit transaction
COMMIT;

-- ============================================
-- Verification Queries
-- ============================================

-- Check remaining data counts
SELECT 'messages' as table_name, COUNT(*) as remaining_rows FROM messages
UNION ALL
SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL
SELECT 'driver_locations', COUNT(*) FROM driver_locations
UNION ALL
SELECT 'pickup_verifications', COUNT(*) FROM pickup_verifications
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'shipment_status_history', COUNT(*) FROM shipment_status_history
UNION ALL
SELECT 'job_applications', COUNT(*) FROM job_applications
UNION ALL
SELECT 'shipments', COUNT(*) FROM shipments
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'pricing_config', COUNT(*) FROM pricing_config
ORDER BY table_name;

-- Show remaining admin users
SELECT 
    email, 
    first_name, 
    last_name, 
    role,
    created_at
FROM profiles 
WHERE role = 'admin'
ORDER BY created_at;

-- ============================================
-- DONE! Database cleaned successfully
-- ============================================
-- Next steps:
-- 1. Go to Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Paste and run this script
-- 4. Verify the results
-- 5. Start fresh testing!
-- ============================================
