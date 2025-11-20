-- FINAL FIX: Enable pg_net extension
-- This is what Supabase uses for HTTP requests (webhooks, etc.)

-- Drop the net schema we created earlier (the extension will recreate it)
DROP SCHEMA IF EXISTS net CASCADE;

-- Enable the pg_net extension (this will create the net schema)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant usage on net schema
GRANT USAGE ON SCHEMA net TO postgres, service_role, authenticated, anon;

-- Grant execute on all functions in net schema
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO postgres, service_role, authenticated, anon;

-- Set default privileges for future functions
ALTER DEFAULT PRIVILEGES IN SCHEMA net GRANT EXECUTE ON FUNCTIONS TO postgres, service_role, authenticated, anon;

-- Verify the extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- Verify net.http_post function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'net'
AND routine_name LIKE 'http%';
