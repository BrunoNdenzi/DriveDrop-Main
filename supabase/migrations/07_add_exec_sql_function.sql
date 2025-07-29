-- Migration: 07_add_exec_sql_function.sql
-- Description: Adds a function to execute SQL for maintenance/testing purposes

-- Function to execute SQL (admin only)
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void AS $$
BEGIN
    -- Only allow admins to execute this function
    IF NOT (SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    )) THEN
        RAISE EXCEPTION 'Permission denied: only admins can execute SQL';
    END IF;
    
    -- Execute the SQL
    EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
