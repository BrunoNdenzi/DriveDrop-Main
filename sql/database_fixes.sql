-- SQL to fix the database issues for DriveDrop

-- 1. Create the job_applications table
CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  UNIQUE (shipment_id, driver_id)
);

CREATE INDEX IF NOT EXISTS job_applications_shipment_id_idx ON job_applications(shipment_id);
CREATE INDEX IF NOT EXISTS job_applications_driver_id_idx ON job_applications(driver_id);

-- 2. Create a view to help with querying
CREATE OR REPLACE VIEW shipment_applications_view AS
SELECT 
  ja.id,
  ja.shipment_id,
  ja.driver_id,
  ja.status,
  ja.applied_at,
  ja.updated_at,
  p.first_name,
  p.last_name,
  p.email,
  p.phone,
  p.avatar_url,
  p.rating
FROM 
  job_applications ja
JOIN 
  profiles p ON ja.driver_id = p.id;

-- 3. Create the exec_sql function
CREATE OR REPLACE FUNCTION exec_sql(sql text) RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create the update_shipment_status function
CREATE OR REPLACE FUNCTION update_shipment_status(
  p_shipment_id UUID,
  p_driver_id UUID,
  p_status TEXT
) RETURNS void AS $$
BEGIN
  UPDATE shipments 
  SET 
    status = p_status::text,
    driver_id = p_driver_id,
    updated_at = now()
  WHERE 
    id = p_shipment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fix shipment_status type if needed
DO $$
BEGIN
  -- Check if type exists and create if it doesn't
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipment_status') THEN
    CREATE TYPE shipment_status AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'cancelled');
  END IF;
  
  -- Check if tracking_event_type exists and create if it doesn't
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tracking_event_type') THEN
    CREATE TYPE tracking_event_type AS ENUM ('pickup', 'delivery', 'in_transit', 'delayed', 'cancelled');
  END IF;
END$$;
