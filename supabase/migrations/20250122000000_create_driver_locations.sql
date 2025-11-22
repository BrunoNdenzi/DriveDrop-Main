-- Create driver_locations table for real-time GPS tracking
CREATE TABLE IF NOT EXISTS public.driver_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION, -- meters
  speed DOUBLE PRECISION, -- meters/second
  heading DOUBLE PRECISION, -- degrees (0-360)
  location_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS driver_locations_driver_id_idx ON public.driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS driver_locations_shipment_id_idx ON public.driver_locations(shipment_id);
CREATE INDEX IF NOT EXISTS driver_locations_timestamp_idx ON public.driver_locations(location_timestamp DESC);

-- Enable Row Level Security
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Drivers can insert own location" ON public.driver_locations;
DROP POLICY IF EXISTS "Drivers can update own location" ON public.driver_locations;
DROP POLICY IF EXISTS "Clients can view location after pickup" ON public.driver_locations;
DROP POLICY IF EXISTS "Drivers can view own location" ON public.driver_locations;

-- Drivers can insert their own locations
CREATE POLICY "Drivers can insert own location"
  ON public.driver_locations FOR INSERT
  WITH CHECK (auth.uid() = driver_id);

-- Drivers can update their own locations
CREATE POLICY "Drivers can update own location"
  ON public.driver_locations FOR UPDATE
  USING (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

-- Clients can view locations for their shipments (only after pickup)
CREATE POLICY "Clients can view location after pickup"
  ON public.driver_locations FOR SELECT
  USING (
    shipment_id IN (
      SELECT id FROM public.shipments 
      WHERE client_id = auth.uid() 
      AND status IN ('pickup_verified', 'picked_up', 'in_transit')
    )
  );

-- Drivers can view their own location history
CREATE POLICY "Drivers can view own location"
  ON public.driver_locations FOR SELECT
  USING (auth.uid() = driver_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_driver_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_driver_locations_updated_at_trigger ON public.driver_locations;
CREATE TRIGGER update_driver_locations_updated_at_trigger
  BEFORE UPDATE ON public.driver_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_locations_updated_at();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.driver_locations TO authenticated;

-- Add comment
COMMENT ON TABLE public.driver_locations IS 'Real-time GPS location tracking for drivers during active shipments. Privacy-focused: only tracks between pickup and delivery.';
