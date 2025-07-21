-- Create job_applications table if it doesn't exist
CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id),
  driver_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  UNIQUE (shipment_id, driver_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS job_applications_shipment_id_idx ON job_applications(shipment_id);
CREATE INDEX IF NOT EXISTS job_applications_driver_id_idx ON job_applications(driver_id);

-- Optional: Create a view to help with querying
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
