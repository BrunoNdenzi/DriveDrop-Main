-- Migration: Make SSN optional in driver_applications table
-- Date: February 6, 2026
-- Reason: SSN field removed from driver registration form for privacy and user experience

-- Make ssn_encrypted column nullable
ALTER TABLE public.driver_applications 
  ALTER COLUMN ssn_encrypted DROP NOT NULL;

-- Add comment to document the change
COMMENT ON COLUMN public.driver_applications.ssn_encrypted IS 
  'Encrypted SSN (optional) - Removed from application form on 2026-02-06. Can be collected later during onboarding if needed for background checks.';
