-- =====================================================
-- MANUAL DRIVER CONSENT TRACKING SOLUTION
-- =====================================================
-- This adds proper consent tracking for manually added drivers

-- Step 1: Add consent tracking fields to driver_applications table
ALTER TABLE driver_applications 
ADD COLUMN IF NOT EXISTS consents_method TEXT CHECK (consents_method IN ('online_form', 'manual_admin', 'pending')) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS consents_signed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS consents_signed_ip TEXT,
ADD COLUMN IF NOT EXISTS consents_document_url TEXT,
ADD COLUMN IF NOT EXISTS consents_verified_by UUID REFERENCES auth.users(id);

-- Step 2: Update existing manually created drivers to show pending consents
UPDATE driver_applications 
SET consents_method = 'pending',
    consents_signed_at = NULL
WHERE approval_notes LIKE '%In-house driver created by admin%'
  AND consents_signed_at IS NULL;

-- Step 3: Create view to identify drivers with pending consents
CREATE OR REPLACE VIEW drivers_pending_consents AS
SELECT 
  da.id as application_id,
  da.email,
  da.full_name,
  p.id as user_id,
  p.first_name,
  p.last_name,
  da.status,
  da.consents_method,
  da.consents_signed_at,
  da.created_at,
  CASE 
    WHEN da.consents_method = 'pending' THEN true
    WHEN da.consents_signed_at IS NULL THEN true
    ELSE false
  END as needs_consent_signature
FROM driver_applications da
JOIN profiles p ON p.email = da.email
WHERE da.status = 'approved'
  AND (da.consents_method = 'pending' OR da.consents_signed_at IS NULL)
ORDER BY da.created_at DESC;

-- Step 4: Query to check which drivers need to sign consents
SELECT * FROM drivers_pending_consents;

-- =====================================================
-- MANUAL CONSENT VERIFICATION SCRIPT
-- =====================================================
-- Run this AFTER driver has signed physical/email consent forms

-- Mark consents as signed for a specific driver
-- Replace 'driver@example.com' with actual email
UPDATE driver_applications 
SET 
  consents_method = 'manual_admin',
  consents_signed_at = NOW(),
  consents_verified_by = (SELECT id FROM auth.users WHERE email = 'your-admin@email.com'),
  consents_document_url = 'https://drive.google.com/file/consent-forms/driver-name-signed.pdf' -- Optional: link to signed PDF
WHERE email = 'driver@example.com'
AND status = 'approved';

-- =====================================================
-- QUERIES FOR MONITORING
-- =====================================================

-- 1. Check consent status for specific driver
SELECT 
  email,
  full_name,
  status,
  consents_method,
  consents_signed_at,
  background_check_consent,
  data_use_consent,
  insurance_consent,
  terms_accepted
FROM driver_applications
WHERE email = 'driver@example.com';

-- 2. List all drivers with pending consents
SELECT * FROM drivers_pending_consents;

-- 3. Count of drivers by consent status
SELECT 
  consents_method,
  COUNT(*) as driver_count
FROM driver_applications
WHERE status = 'approved'
GROUP BY consents_method;

-- 4. Drivers who can't accept shipments yet (no signed consents)
SELECT 
  da.email,
  da.full_name,
  p.id as user_id,
  da.consents_method,
  da.created_at,
  EXTRACT(DAY FROM NOW() - da.created_at) as days_pending
FROM driver_applications da
JOIN profiles p ON p.email = da.email
WHERE da.status = 'approved'
  AND (da.consents_method = 'pending' OR da.consents_signed_at IS NULL)
ORDER BY da.created_at ASC;

-- =====================================================
-- CLEANUP/ROLLBACK (if needed)
-- =====================================================

-- Remove the new columns (only if you want to undo)
-- ALTER TABLE driver_applications 
-- DROP COLUMN IF EXISTS consents_method,
-- DROP COLUMN IF EXISTS consents_signed_at,
-- DROP COLUMN IF EXISTS consents_signed_ip,
-- DROP COLUMN IF EXISTS consents_document_url,
-- DROP COLUMN IF EXISTS consents_verified_by;

-- DROP VIEW IF EXISTS drivers_pending_consents;
