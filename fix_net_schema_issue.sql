-- Fix for "net" schema error during signup
-- This creates the necessary extension and schema

-- 1. Create the net schema (required for network functions)
CREATE SCHEMA IF NOT EXISTS net;

-- 2. Grant usage to authenticated and service roles
GRANT USAGE ON SCHEMA net TO authenticated;
GRANT USAGE ON SCHEMA net TO service_role;
GRANT USAGE ON SCHEMA net TO anon;

-- Done! Now try signing up again.
