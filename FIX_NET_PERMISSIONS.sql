-- Grant all permissions on net schema and its functions to fix http_post issues

-- Grant USAGE on net schema to all roles
GRANT USAGE ON SCHEMA net TO postgres, service_role, authenticated, anon, authenticator;

-- Grant EXECUTE on ALL functions in net schema
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO postgres, service_role, authenticated, anon, authenticator;

-- Grant ALL on ALL tables in net schema (if any exist)
GRANT ALL ON ALL TABLES IN SCHEMA net TO postgres, service_role, authenticator;

-- Set default privileges for future objects in net schema
ALTER DEFAULT PRIVILEGES IN SCHEMA net GRANT EXECUTE ON FUNCTIONS TO postgres, service_role, authenticated, anon, authenticator;
ALTER DEFAULT PRIVILEGES IN SCHEMA net GRANT ALL ON TABLES TO postgres, service_role, authenticator;

-- Verify permissions
SELECT 
    nsp.nspname as schema_name,
    r.rolname as role_name,
    p.privilege_type
FROM information_schema.role_usage_grants p
JOIN pg_catalog.pg_namespace nsp ON nsp.nspname = p.object_schema
JOIN pg_catalog.pg_roles r ON r.rolname = p.grantee
WHERE p.object_schema = 'net'
ORDER BY schema_name, role_name, privilege_type;
