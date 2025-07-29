-- Create the driver_locations table for real-time location tracking
-- Note: Using location_timestamp instead of timestamp to avoid SQL reserved keyword conflict
CREATE TABLE IF NOT EXISTS driver_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES profiles(id),
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    heading FLOAT,
    speed FLOAT,
    accuracy FLOAT,
    location_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT driver_locations_shipment_driver_unique UNIQUE (shipment_id, driver_id, location_timestamp)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_driver_locations_shipment_id ON driver_locations(shipment_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id ON driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_location_timestamp ON driver_locations(location_timestamp);

-- Create a spatial index for PostGIS queries (if used in the future)
CREATE INDEX IF NOT EXISTS idx_driver_locations_position 
ON driver_locations USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326));

-- Set up RLS (Row Level Security) policies
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- Policy for drivers - can only insert their own locations
CREATE POLICY driver_insert_own_location
ON driver_locations
FOR INSERT
TO authenticated
WITH CHECK (
    driver_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM shipments 
        WHERE shipments.id = driver_locations.shipment_id 
        AND shipments.driver_id = auth.uid()
    )
);

-- Policy for clients - can only view locations for their shipments
CREATE POLICY client_view_own_shipment_locations
ON driver_locations
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM shipments 
        WHERE shipments.id = driver_locations.shipment_id 
        AND shipments.client_id = auth.uid()
    )
);

-- Policy for drivers - can view their own locations
CREATE POLICY driver_view_own_locations
ON driver_locations
FOR SELECT
TO authenticated
USING (driver_id = auth.uid());

-- Policy for admins - full access
CREATE POLICY admin_full_access_locations
ON driver_locations
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Add trigger to clean up old location data (keeping only the most recent 100 entries per shipment)
CREATE OR REPLACE FUNCTION cleanup_old_driver_locations()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete all but the most recent 100 locations for the shipment
    DELETE FROM driver_locations
    WHERE id IN (
        SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (
                PARTITION BY shipment_id 
                ORDER BY location_timestamp DESC
            ) as row_num
            FROM driver_locations
            WHERE shipment_id = NEW.shipment_id
        ) ranked
        WHERE row_num > 100
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_driver_locations_trigger
AFTER INSERT ON driver_locations
FOR EACH ROW
EXECUTE FUNCTION cleanup_old_driver_locations();

-- Create a function to get the latest driver location for a shipment
CREATE OR REPLACE FUNCTION get_latest_driver_location(p_shipment_id UUID)
RETURNS TABLE (
    id UUID,
    shipment_id UUID,
    driver_id UUID,
    latitude FLOAT,
    longitude FLOAT,
    heading FLOAT,
    speed FLOAT,
    accuracy FLOAT,
    location_timestamp TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM driver_locations
    WHERE shipment_id = p_shipment_id
    ORDER BY location_timestamp DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;
