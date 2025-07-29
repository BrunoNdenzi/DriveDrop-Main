-- Additional database functions needed for dbUtils

-- Function to check if a table exists
CREATE OR REPLACE FUNCTION table_exists(table_name text) RETURNS boolean AS $$
DECLARE
  exists boolean;
BEGIN
  SELECT COUNT(*) > 0 INTO exists
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename = table_name;
  
  RETURN exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all table names in the public schema
CREATE OR REPLACE FUNCTION get_table_names() RETURNS text[] AS $$
DECLARE
  table_names text[];
BEGIN
  SELECT array_agg(tablename) INTO table_names
  FROM pg_tables
  WHERE schemaname = 'public';
  
  RETURN table_names;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
