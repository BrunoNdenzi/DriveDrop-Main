-- Create broker_shipments table for brokers to manage shipments on behalf of clients
-- This allows brokers to create shipments for their contracted clients and manage them through the platform

CREATE TABLE IF NOT EXISTS broker_shipments (
  -- Primary identifier
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Broker reference
  broker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Client Information (the broker's customer)
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  
  -- Pickup Location
  pickup_address TEXT NOT NULL,
  pickup_city TEXT NOT NULL,
  pickup_state TEXT NOT NULL,
  pickup_zip TEXT NOT NULL,
  pickup_latitude NUMERIC(10, 7),
  pickup_longitude NUMERIC(10, 7),
  
  -- Delivery Location
  delivery_address TEXT NOT NULL,
  delivery_city TEXT NOT NULL,
  delivery_state TEXT NOT NULL,
  delivery_zip TEXT NOT NULL,
  delivery_latitude NUMERIC(10, 7),
  delivery_longitude NUMERIC(10, 7),
  
  -- Vehicle Information
  vehicle_year INTEGER NOT NULL,
  vehicle_make TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  vehicle_type TEXT NOT NULL, -- sedan, suv, truck, motorcycle, etc.
  vehicle_condition TEXT NOT NULL DEFAULT 'running', -- running, non-running
  vehicle_vin TEXT,
  
  -- Shipment Details
  distance_miles NUMERIC(10, 2) NOT NULL DEFAULT 0,
  estimated_price NUMERIC(10, 2) NOT NULL,
  broker_commission NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Amount broker earns
  platform_fee NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Platform's 10% fee
  
  -- Dates
  pickup_date DATE,
  delivery_date DATE,
  
  -- Transport Options
  transport_type TEXT NOT NULL DEFAULT 'open', -- open, enclosed
  is_operable BOOLEAN NOT NULL DEFAULT true,
  
  -- Status Tracking
  status TEXT NOT NULL DEFAULT 'pending_quote', 
  -- pending_quote: Broker created, needs pricing confirmation
  -- quoted: Price confirmed, awaiting client approval
  -- booked: Client approved, ready for load board
  -- assigned: Carrier assigned
  -- in_transit: Vehicle being transported
  -- delivered: Completed
  -- cancelled: Cancelled by broker or client
  
  -- Load Board Assignment (when published to carriers)
  load_board_id UUID REFERENCES load_board(id) ON DELETE SET NULL,
  assigned_carrier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Notes and Additional Info
  notes TEXT,
  special_instructions TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  booked_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_broker_shipments_broker_id ON broker_shipments(broker_id);
CREATE INDEX IF NOT EXISTS idx_broker_shipments_status ON broker_shipments(status);
CREATE INDEX IF NOT EXISTS idx_broker_shipments_created_at ON broker_shipments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broker_shipments_client_email ON broker_shipments(client_email);
CREATE INDEX IF NOT EXISTS idx_broker_shipments_load_board_id ON broker_shipments(load_board_id);
CREATE INDEX IF NOT EXISTS idx_broker_shipments_assigned_carrier_id ON broker_shipments(assigned_carrier_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_broker_shipments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_broker_shipments_updated_at
  BEFORE UPDATE ON broker_shipments
  FOR EACH ROW
  EXECUTE FUNCTION update_broker_shipments_updated_at();

-- Enable Row Level Security
ALTER TABLE broker_shipments ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Brokers can view their own shipments
CREATE POLICY "Brokers can view their own shipments"
  ON broker_shipments
  FOR SELECT
  USING (
    auth.uid() = broker_id
    OR 
    -- Admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Brokers can create their own shipments
CREATE POLICY "Brokers can create shipments"
  ON broker_shipments
  FOR INSERT
  WITH CHECK (
    auth.uid() = broker_id
    AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'broker'
    )
  );

-- Brokers can update their own shipments
CREATE POLICY "Brokers can update their own shipments"
  ON broker_shipments
  FOR UPDATE
  USING (
    auth.uid() = broker_id
    OR
    -- Admins can update any
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Brokers can delete their own shipments (soft delete by status change is recommended)
CREATE POLICY "Brokers can delete their own shipments"
  ON broker_shipments
  FOR DELETE
  USING (
    auth.uid() = broker_id
  );

-- Carriers can view shipments assigned to them
CREATE POLICY "Carriers can view assigned shipments"
  ON broker_shipments
  FOR SELECT
  USING (
    auth.uid() = assigned_carrier_id
    AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'driver'
    )
  );

-- Function to automatically publish to load board when status changes to 'booked'
CREATE OR REPLACE FUNCTION auto_publish_to_load_board()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to 'booked' and not yet on load board
  IF NEW.status = 'booked' AND OLD.status != 'booked' AND NEW.load_board_id IS NULL THEN
    -- Insert into load_board table
    INSERT INTO load_board (
      broker_id,
      shipment_id,
      pickup_city,
      pickup_state,
      pickup_zip,
      delivery_city,
      delivery_state,
      delivery_zip,
      vehicle_year,
      vehicle_make,
      vehicle_model,
      vehicle_type,
      distance_miles,
      estimated_price,
      commission_rate,
      status,
      pickup_date,
      notes
    ) VALUES (
      NEW.broker_id,
      NEW.id,
      NEW.pickup_city,
      NEW.pickup_state,
      NEW.pickup_zip,
      NEW.delivery_city,
      NEW.delivery_state,
      NEW.delivery_zip,
      NEW.vehicle_year,
      NEW.vehicle_make,
      NEW.vehicle_model,
      NEW.vehicle_type,
      NEW.distance_miles,
      NEW.estimated_price - NEW.broker_commission - NEW.platform_fee, -- Carrier payment
      10.0, -- Platform commission rate for carriers
      'available',
      NEW.pickup_date,
      NEW.notes
    )
    RETURNING id INTO NEW.load_board_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_publish_to_load_board
  BEFORE UPDATE ON broker_shipments
  FOR EACH ROW
  EXECUTE FUNCTION auto_publish_to_load_board();

-- Comments
COMMENT ON TABLE broker_shipments IS 'Stores shipments created by brokers on behalf of their clients';
COMMENT ON COLUMN broker_shipments.broker_commission IS 'Commission earned by the broker (percentage of total price)';
COMMENT ON COLUMN broker_shipments.platform_fee IS 'Platform fee (10% of total price)';
COMMENT ON COLUMN broker_shipments.load_board_id IS 'Reference to load board entry when published for carriers';
COMMENT ON COLUMN broker_shipments.status IS 'Shipment lifecycle: pending_quote → quoted → booked → assigned → in_transit → delivered';
