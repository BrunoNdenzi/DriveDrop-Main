-- Alternative approach: Directly update using raw SQL without the trigger
-- Use this file instead of phase3_update_data.sql if you're still getting trigger errors

-- First drop the trigger and function completely
DROP TRIGGER IF EXISTS send_shipment_notification ON shipments CASCADE;
DROP FUNCTION IF EXISTS send_shipment_notification() CASCADE;

-- Use a direct SQL statement to update shipment status
UPDATE shipments 
SET status = 'in_transit'
WHERE driver_id IS NOT NULL AND status = 'pending';

-- Create sample job applications if none exist
INSERT INTO job_applications (shipment_id, driver_id, status, applied_at)
SELECT 
    s.id AS shipment_id,
    p.id AS driver_id,
    'pending' AS status,
    now() - (random() * interval '2 days') AS applied_at
FROM 
    shipments s
CROSS JOIN (
    SELECT id FROM profiles WHERE role = 'driver' LIMIT 2
) p
WHERE 
    s.status = 'pending' 
    AND s.driver_id IS NULL
    AND NOT EXISTS (
        SELECT 1 FROM job_applications
    )
LIMIT 2;
