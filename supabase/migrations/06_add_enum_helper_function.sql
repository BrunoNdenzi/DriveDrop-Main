-- Migration: 06_add_enum_helper_function.sql
-- Description: Adds a function to get enum values

-- Function to list values in an enum type
CREATE OR REPLACE FUNCTION get_enum_values(enum_name text)
RETURNS text[] AS $$
DECLARE
    enum_values text[];
BEGIN
    -- Get the enum values
    EXECUTE format('SELECT array_agg(e.enumlabel) FROM pg_enum e
                    JOIN pg_type t ON e.enumtypid = t.oid
                    WHERE t.typname = %L', enum_name)
    INTO enum_values;
    
    RETURN enum_values;
END;
$$ LANGUAGE plpgsql;
