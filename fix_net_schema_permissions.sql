-- Fix net schema permissions

-- 1. Grant ALL permissions on net schema to service_role
GRANT ALL ON SCHEMA net TO service_role;
GRANT ALL ON SCHEMA net TO authenticated;
GRANT ALL ON SCHEMA net TO anon;
GRANT ALL ON SCHEMA net TO postgres;

-- 2. Grant usage and all privileges on all objects in net schema
GRANT USAGE ON SCHEMA net TO service_role;
GRANT USAGE ON SCHEMA net TO authenticated;
GRANT USAGE ON SCHEMA net TO anon;
GRANT USAGE ON SCHEMA net TO postgres;

-- 3. If there are any tables/functions in net schema, grant access
GRANT ALL ON ALL TABLES IN SCHEMA net TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO service_role;

-- 4. Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA net GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA net GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA net GRANT ALL ON FUNCTIONS TO service_role;

-- Done! Try signing up again.
