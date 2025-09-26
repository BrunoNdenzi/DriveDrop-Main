-- Migration: Add user_vehicles table for vehicle profiles
-- Created: Task 4 - Vehicle Profiles Feature

-- Table for user saved vehicles
CREATE TABLE user_vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    vehicle_type vehicle_type NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    color TEXT,
    license_plate TEXT,
    nickname TEXT, -- Optional friendly name like "My Red Honda"
    is_primary BOOLEAN NOT NULL DEFAULT FALSE, -- Mark as default vehicle
    is_active BOOLEAN NOT NULL DEFAULT TRUE, -- Soft delete capability
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT vehicle_year_valid CHECK (year >= 1900 AND year <= EXTRACT(YEAR FROM NOW()) + 2),
    CONSTRAINT unique_user_nickname UNIQUE (user_id, nickname),
    CONSTRAINT license_plate_format CHECK (license_plate IS NULL OR length(license_plate) BETWEEN 2 AND 15)
);

-- Indexes for performance
CREATE INDEX user_vehicles_user_id_idx ON user_vehicles(user_id);
CREATE INDEX user_vehicles_active_idx ON user_vehicles(user_id, is_active) WHERE is_active = true;
CREATE INDEX user_vehicles_primary_idx ON user_vehicles(user_id, is_primary) WHERE is_primary = true;

-- Updated_at trigger
CREATE TRIGGER set_updated_at_user_vehicles
    BEFORE UPDATE ON user_vehicles
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Function to ensure only one primary vehicle per user
CREATE OR REPLACE FUNCTION ensure_single_primary_vehicle()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting a vehicle as primary, unset all other primary vehicles for this user
    IF NEW.is_primary = TRUE THEN
        UPDATE user_vehicles 
        SET is_primary = FALSE 
        WHERE user_id = NEW.user_id 
        AND id != NEW.id 
        AND is_primary = TRUE;
    END IF;
    
    -- If this is the user's first vehicle, make it primary
    IF NOT EXISTS (
        SELECT 1 FROM user_vehicles 
        WHERE user_id = NEW.user_id 
        AND id != NEW.id 
        AND is_active = TRUE
    ) THEN
        NEW.is_primary = TRUE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_primary_vehicle_trigger
    BEFORE INSERT OR UPDATE ON user_vehicles
    FOR EACH ROW EXECUTE PROCEDURE ensure_single_primary_vehicle();

-- Row Level Security (RLS) policies
ALTER TABLE user_vehicles ENABLE ROW LEVEL SECURITY;

-- Users can only see their own vehicles
CREATE POLICY "Users can view own vehicles" ON user_vehicles
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own vehicles
CREATE POLICY "Users can insert own vehicles" ON user_vehicles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own vehicles
CREATE POLICY "Users can update own vehicles" ON user_vehicles
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own vehicles (soft delete via is_active)
CREATE POLICY "Users can delete own vehicles" ON user_vehicles
    FOR DELETE USING (auth.uid() = user_id);

-- Admins can see all vehicles
CREATE POLICY "Admins can view all vehicles" ON user_vehicles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );