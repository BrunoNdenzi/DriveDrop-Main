-- Migration: 01_initial_schema
-- Create extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable RLS on all tables by default
ALTER DATABASE postgres SET row_security = on;

-- Create custom types for enumeration values
CREATE TYPE user_role AS ENUM ('client', 'driver', 'admin');
CREATE TYPE shipment_status AS ENUM ('pending', 'accepted', 'in_transit', 'delivered', 'cancelled');
CREATE TYPE vehicle_type AS ENUM ('car', 'van', 'truck', 'motorcycle');
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');
CREATE TYPE tracking_event_type AS ENUM ('created', 'accepted', 'pickup', 'in_transit', 'delivery', 'cancelled', 'delayed');

-- Create the profiles table (extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'client',
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    rating NUMERIC(3,2) CHECK (rating >= 0 AND rating <= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automatically link new auth.users to profiles
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, first_name, last_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Table for driver applications
CREATE TABLE driver_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    vehicle_type vehicle_type NOT NULL,
    vehicle_make TEXT NOT NULL,
    vehicle_model TEXT NOT NULL,
    vehicle_year INTEGER NOT NULL,
    license_number TEXT NOT NULL,
    license_expiry DATE NOT NULL,
    insurance_provider TEXT NOT NULL,
    insurance_policy_number TEXT NOT NULL,
    insurance_expiry DATE NOT NULL,
    background_check_status TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT vehicle_year_valid CHECK (vehicle_year > 1900 AND vehicle_year <= EXTRACT(YEAR FROM NOW()) + 1)
);

-- Table for vehicle photos
CREATE TABLE vehicle_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_application_id UUID NOT NULL REFERENCES driver_applications(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_type TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for shipments
CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES profiles(id),
    driver_id UUID REFERENCES profiles(id),
    status shipment_status NOT NULL DEFAULT 'pending',
    title TEXT NOT NULL,
    description TEXT,
    pickup_address TEXT NOT NULL,
    pickup_location GEOGRAPHY(POINT) NOT NULL,
    pickup_notes TEXT,
    pickup_time_window TSTZRANGE,
    delivery_address TEXT NOT NULL,
    delivery_location GEOGRAPHY(POINT) NOT NULL,
    delivery_notes TEXT,
    delivery_time_window TSTZRANGE,
    weight_kg NUMERIC(10,2),
    dimensions_cm JSONB, -- {length, width, height}
    item_value NUMERIC(10,2),
    is_fragile BOOLEAN DEFAULT FALSE,
    estimated_distance_km NUMERIC(10,2),
    estimated_price NUMERIC(10,2) NOT NULL,
    final_price NUMERIC(10,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create spatial index for location-based queries
CREATE INDEX shipment_pickup_location_idx ON shipments USING GIST (pickup_location);
CREATE INDEX shipment_delivery_location_idx ON shipments USING GIST (delivery_location);

-- Table for tracking events
CREATE TABLE tracking_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    event_type tracking_event_type NOT NULL,
    created_by UUID NOT NULL REFERENCES profiles(id),
    location GEOGRAPHY(POINT),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id),
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES profiles(id),
    amount NUMERIC(10,2) NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',
    payment_method TEXT,
    payment_intent_id TEXT,
    payment_intent_client_secret TEXT,
    refund_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER set_updated_at_driver_applications
    BEFORE UPDATE ON driver_applications
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER set_updated_at_shipments
    BEFORE UPDATE ON shipments
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER set_updated_at_payments
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
