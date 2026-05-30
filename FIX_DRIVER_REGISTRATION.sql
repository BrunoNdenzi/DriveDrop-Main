-- ===============================================
-- FIX: Driver Registration 500 Error
-- Issue: ssn_encrypted column is NOT NULL but code tries to insert NULL
-- Solution: Make ssn_encrypted nullable (SSN is now optional in form)
-- Date: May 12, 2026
-- ===============================================

-- Check current column definition
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'driver_applications' 
  AND column_name = 'ssn_encrypted';

-- Make ssn_encrypted column nullable
ALTER TABLE public.driver_applications 
  ALTER COLUMN ssn_encrypted DROP NOT NULL;

-- Add comment to document the change
COMMENT ON COLUMN public.driver_applications.ssn_encrypted IS 
  'Encrypted SSN (optional) - Removed from application form on 2026-02-06. Can be collected later during onboarding if needed for background checks.';

-- Verify the change
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'driver_applications' 
  AND column_name = 'ssn_encrypted';

-- ===============================================
-- ADDITIONAL CHECKS: Verify storage buckets exist
-- ===============================================
-- Run these queries to check if storage buckets are created:

SELECT 
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE name IN ('driver-licenses', 'proof-of-address', 'insurance-documents')
ORDER BY name;

-- If buckets don't exist, run:
-- INSERT INTO storage.buckets (id, name, public) VALUES 
--   ('driver-licenses', 'driver-licenses', false),
--   ('proof-of-address', 'proof-of-address', false),
--   ('insurance-documents', 'insurance-documents', false);

-- ===============================================
-- Test with a sample query (optional)
-- ===============================================
-- This should now work without error:
-- INSERT INTO public.driver_applications (
--   full_name, date_of_birth, email, phone, address,
--   ssn_encrypted, -- NULL is now allowed
--   license_number, license_state, license_expiration,
--   insurance_provider, insurance_policy_number, 
--   insurance_expiration, coverage_amount,
--   background_check_consent, data_use_consent,
--   insurance_consent, terms_accepted
-- ) VALUES (
--   'Test Driver', '1990-01-01', 'test@example.com', '555-0100', 
--   '{"street": "123 Test St", "city": "Test City", "state": "NC", "zip": "27601"}',
--   NULL, -- SSN is now optional
--   'D12345678', 'NC', '2028-12-31',
--   'Test Insurance', 'POL123456', '2027-12-31', '$100,000',
--   true, true, true, true
-- );
