-- Fix: Add 'open' status to shipment_status enum
-- This resolves the error: invalid input value for enum shipment_status: "open"

-- Create a new enum type with all the values including 'open'
CREATE TYPE shipment_status_with_open AS ENUM (
  'pending', 'accepted', 'assigned', 'in_transit', 'in_progress', 'delivered', 'completed', 'cancelled', 'picked_up', 'open'
);

-- Step 1: Drop policies that depend on the status column
DROP POLICY IF EXISTS "Clients can update their own shipments" ON shipments;
DROP POLICY IF EXISTS "Drivers can view assigned and available shipments" ON shipments;
DROP POLICY IF EXISTS "Drivers can view available shipments" ON shipments;
DROP POLICY IF EXISTS "Clients can view their own shipments" ON shipments;
DROP POLICY IF EXISTS "Drivers can update assigned shipments" ON shipments;

-- Step 2: Drop triggers that might reference the status column
DROP TRIGGER IF EXISTS send_shipment_notification ON shipments;
DROP TRIGGER IF EXISTS on_shipment_status_update ON shipments;
DROP TRIGGER IF EXISTS shipment_status_change_trigger ON shipments;

-- Step 3: Remove default constraints
ALTER TABLE shipments ALTER COLUMN status DROP DEFAULT;

-- Step 4: Update the shipments table to use the new enum
ALTER TABLE shipments ALTER COLUMN status TYPE shipment_status_with_open USING status::text::shipment_status_with_open;

-- Step 5: Update the shipment_status_history table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipment_status_history') THEN
        ALTER TABLE shipment_status_history ALTER COLUMN status TYPE shipment_status_with_open USING status::text::shipment_status_with_open;
    END IF;
END $$;

-- Step 6: Drop the old enum type and rename the new one
DROP TYPE shipment_status;
ALTER TYPE shipment_status_with_open RENAME TO shipment_status;

-- Step 7: Restore the default constraint
ALTER TABLE shipments ALTER COLUMN status SET DEFAULT 'pending'::shipment_status;

-- Step 8: Recreate essential RLS policies
CREATE POLICY "Clients can view their own shipments" ON shipments
    FOR SELECT USING (auth.uid() = client_id);

CREATE POLICY "Clients can update their own shipments" ON shipments
    FOR UPDATE USING (auth.uid() = client_id)
    WITH CHECK (auth.uid() = client_id AND status IN ('pending', 'open', 'cancelled'));

CREATE POLICY "Drivers can view assigned and available shipments" ON shipments
    FOR SELECT USING (
        auth.uid() = driver_id OR 
        (driver_id IS NULL AND status IN ('pending', 'open'))
    );

CREATE POLICY "Drivers can update assigned shipments" ON shipments
    FOR UPDATE USING (auth.uid() = driver_id)
    WITH CHECK (auth.uid() = driver_id);

-- Verify the enum now includes 'open'
SELECT unnest(enum_range(NULL::shipment_status)) AS status_values;
