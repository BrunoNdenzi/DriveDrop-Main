-- Migration: 02_row_level_security
-- Enable Row Level Security for all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create roles for different user types (if they don't exist already)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'client') THEN
    CREATE ROLE client;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'driver') THEN
    CREATE ROLE driver;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin') THEN
    CREATE ROLE admin;
  END IF;
END
$$;

-- Grant roles to appropriate users
-- These statements are idempotent (can be run multiple times safely)
GRANT anon TO authenticated;
GRANT authenticated TO client;
GRANT authenticated TO driver;
GRANT authenticated TO admin;

-- Define RLS policies for profiles table
-- Anyone can read basic profile information
CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT USING (true);

-- Users can update their own profiles
CREATE POLICY "Users can update their own profiles" 
ON profiles FOR UPDATE USING (auth.uid() = id);

-- Only admins can delete profiles
CREATE POLICY "Only admins can delete profiles" 
ON profiles FOR DELETE USING (
    auth.uid() IN (
        SELECT id FROM profiles WHERE role = 'admin'
    )
);

-- Define RLS policies for driver_applications table
-- Drivers can view their own applications
CREATE POLICY "Drivers can view their own applications" 
ON driver_applications FOR SELECT USING (
    auth.uid() = user_id
);

-- Drivers can create their own applications
CREATE POLICY "Drivers can create their own applications" 
ON driver_applications FOR INSERT WITH CHECK (
    auth.uid() = user_id
);

-- Drivers can update their own applications
CREATE POLICY "Drivers can update their own applications" 
ON driver_applications FOR UPDATE USING (
    auth.uid() = user_id
);

-- Admins can view all applications
CREATE POLICY "Admins can view all applications" 
ON driver_applications FOR SELECT USING (
    auth.uid() IN (
        SELECT id FROM profiles WHERE role = 'admin'
    )
);

-- Admins can update all applications
CREATE POLICY "Admins can update all applications" 
ON driver_applications FOR UPDATE USING (
    auth.uid() IN (
        SELECT id FROM profiles WHERE role = 'admin'
    )
);

-- Define RLS policies for vehicle_photos table
-- Drivers can view their own vehicle photos
CREATE POLICY "Drivers can view their own vehicle photos" 
ON vehicle_photos FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM driver_applications 
        WHERE driver_applications.id = vehicle_photos.driver_application_id
        AND driver_applications.user_id = auth.uid()
    )
);

-- Drivers can upload their own vehicle photos
CREATE POLICY "Drivers can upload their own vehicle photos" 
ON vehicle_photos FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM driver_applications 
        WHERE driver_applications.id = vehicle_photos.driver_application_id
        AND driver_applications.user_id = auth.uid()
    )
);

-- Admins can view all vehicle photos
CREATE POLICY "Admins can view all vehicle photos" 
ON vehicle_photos FOR SELECT USING (
    auth.uid() IN (
        SELECT id FROM profiles WHERE role = 'admin'
    )
);

-- Define RLS policies for shipments table
-- Clients can view their own shipments
CREATE POLICY "Clients can view their own shipments" 
ON shipments FOR SELECT USING (
    auth.uid() = client_id
);

-- Drivers can view assigned shipments and available shipments
CREATE POLICY "Drivers can view assigned and available shipments" 
ON shipments FOR SELECT USING (
    auth.uid() = driver_id OR 
    (driver_id IS NULL AND status = 'pending' AND 
     auth.uid() IN (SELECT id FROM profiles WHERE role = 'driver'))
);

-- Clients can create shipments
CREATE POLICY "Clients can create shipments" 
ON shipments FOR INSERT WITH CHECK (
    auth.uid() = client_id
);

-- Clients can update their own shipments
CREATE POLICY "Clients can update their own shipments" 
ON shipments FOR UPDATE USING (
    auth.uid() = client_id AND 
    status IN ('pending', 'cancelled')
);

-- Drivers can update shipments assigned to them
CREATE POLICY "Drivers can update assigned shipments" 
ON shipments FOR UPDATE USING (
    auth.uid() = driver_id
);

-- Admins can view and update all shipments
CREATE POLICY "Admins can view all shipments" 
ON shipments FOR SELECT USING (
    auth.uid() IN (
        SELECT id FROM profiles WHERE role = 'admin'
    )
);

CREATE POLICY "Admins can update all shipments" 
ON shipments FOR UPDATE USING (
    auth.uid() IN (
        SELECT id FROM profiles WHERE role = 'admin'
    )
);

-- Define RLS policies for tracking_events table
-- Anyone involved in a shipment can view its tracking events
CREATE POLICY "Shipment participants can view tracking events" 
ON tracking_events FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM shipments 
        WHERE shipments.id = tracking_events.shipment_id
        AND (shipments.client_id = auth.uid() OR shipments.driver_id = auth.uid())
    )
);

-- Only the driver or admin can create tracking events
CREATE POLICY "Only drivers and admins can create tracking events" 
ON tracking_events FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM shipments 
        WHERE shipments.id = tracking_events.shipment_id
        AND shipments.driver_id = auth.uid()
    ) OR
    auth.uid() IN (
        SELECT id FROM profiles WHERE role = 'admin'
    )
);

-- Define RLS policies for messages table
-- Only participants in a shipment can view its messages
CREATE POLICY "Shipment participants can view messages" 
ON messages FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM shipments 
        WHERE shipments.id = messages.shipment_id
        AND (shipments.client_id = auth.uid() OR shipments.driver_id = auth.uid())
    )
);

-- Only participants in a shipment can send messages
CREATE POLICY "Shipment participants can send messages" 
ON messages FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM shipments 
        WHERE shipments.id = messages.shipment_id
        AND (shipments.client_id = auth.uid() OR shipments.driver_id = auth.uid())
    ) AND
    auth.uid() = sender_id
);

-- Define RLS policies for payments table
-- Clients can view their own payments
CREATE POLICY "Clients can view their own payments" 
ON payments FOR SELECT USING (
    auth.uid() = client_id
);

-- Drivers can view payments for their assigned shipments
CREATE POLICY "Drivers can view payments for assigned shipments" 
ON payments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM shipments 
        WHERE shipments.id = payments.shipment_id
        AND shipments.driver_id = auth.uid()
    )
);

-- Only the system can create and update payments (handled through secure functions)
CREATE POLICY "Only admins can manage payments" 
ON payments FOR ALL USING (
    auth.uid() IN (
        SELECT id FROM profiles WHERE role = 'admin'
    )
);
