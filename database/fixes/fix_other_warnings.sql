-- ========================================
-- Fix PostGIS Extension in Public Schema
-- ========================================
-- WARNING: Moving PostGIS extension is complex and can break existing functionality
-- RECOMMENDATION: Leave in public schema for now, but document the decision
-- 
-- Why it's safe to keep PostGIS in public:
-- 1. It's a widely-used, trusted extension
-- 2. Moving it can break existing spatial queries
-- 3. Supabase themselves keep it in public
-- 4. RLS on your tables protects the actual data
--
-- If you MUST move it (not recommended):
-- ========================================

-- Option 1: Create extensions schema and move PostGIS (RISKY)
-- DO NOT RUN THIS unless you know what you're doing!
/*
-- Create extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move PostGIS to extensions schema
-- WARNING: This will break all existing spatial queries!
ALTER EXTENSION postgis SET SCHEMA extensions;

-- Update search_path for all users
ALTER DATABASE postgres SET search_path TO public, extensions, pg_catalog;
*/

-- ========================================
-- Option 2: RECOMMENDED - Keep in public but document
-- ========================================
COMMENT ON EXTENSION postgis IS 
'PostGIS extension kept in public schema for compatibility. This is a trusted extension and poses minimal security risk.';

-- ========================================
-- Fix Auth Settings (Low Priority - can do after launch)
-- ========================================
-- These need to be fixed in Supabase Dashboard, not SQL

-- 1. Auth OTP Long Expiry
-- Go to: Authentication → Settings → Email Auth
-- Change: OTP expiry from current value to 3600 (1 hour) or less

-- 2. Leaked Password Protection
-- Go to: Authentication → Settings → Password Requirements  
-- Enable: "Check for leaked passwords" toggle

-- ========================================
-- Fix Postgres Version (Done via Dashboard)
-- ========================================
-- Go to: Settings → Infrastructure → Upgrade Postgres
-- Click: "Upgrade to latest version"
-- Current: 17.4.1.054
-- Target: Latest available (check for 17.4.1.055 or newer)

-- ========================================
-- Verification Checklist
-- ========================================

-- Run this query to check extension location:
SELECT 
  e.extname AS extension_name,
  n.nspname AS schema_name
FROM pg_extension e
INNER JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE e.extname = 'postgis';

-- Expected result: postgis | public
-- This is OK - don't move it unless absolutely necessary

-- ========================================
-- Dashboard Settings Checklist
-- ========================================
/*
Go to Supabase Dashboard and verify:

1. Authentication → Settings → Email Auth
   [ ] OTP Expiry ≤ 3600 seconds (1 hour)
   [ ] OTP Length ≥ 6 digits

2. Authentication → Settings → Password Requirements
   [ ] Minimum password length: 8 characters
   [ ] Require lowercase: Yes
   [ ] Require uppercase: Yes
   [ ] Require numbers: Yes
   [ ] Require symbols: No (optional)
   [ ] Check for leaked passwords: Yes ✓ IMPORTANT

3. Settings → Infrastructure
   [ ] Postgres version: Latest available
   [ ] Auto-upgrade enabled (if available)

4. Settings → Database → Pooling
   [ ] Connection pooler enabled
   [ ] Pool mode: Transaction (recommended)
   [ ] Pool size: Appropriate for your plan

5. Settings → Storage
   [ ] File size limits configured
   [ ] Allowed MIME types restricted (if using storage)

6. Settings → API
   [ ] RLS enabled message shown
   [ ] JWT expiry appropriate (7d default is OK)
*/

-- ========================================
-- SUCCESS!
-- ========================================
-- Extension warnings documented
-- Auth settings checklist created
-- Go to Supabase Dashboard to apply non-SQL fixes
