-- Migration: Fix accept_shipment function to handle 'assigned' status
-- When an admin assigns a shipment, the status is 'assigned' and driver_id is already set
-- The driver must still explicitly accept the shipment to proceed

-- Drop and recreate the function with updated logic
DROP FUNCTION IF EXISTS accept_shipment(UUID);

CREATE OR REPLACE FUNCTION accept_shipment(shipment_id UUID)
RETURNS SETOF shipments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
    v_shipment record;
BEGIN
    -- Get the driver ID from the current user
    SELECT id INTO v_driver_id FROM profiles 
    WHERE id = auth.uid() AND role = 'driver';
    
    IF v_driver_id IS NULL THEN
        RAISE EXCEPTION 'Only drivers can accept shipments';
    END IF;
    
    -- Update the shipment
    -- Accept both 'pending' (driver self-assigns) and 'assigned' (admin assigned) statuses
    UPDATE shipments
    SET 
        driver_id = v_driver_id,  -- Set driver_id if pending, or keep existing if assigned
        status = 'accepted',
        updated_at = NOW()
    WHERE 
        id = shipment_id
        AND status IN ('pending', 'assigned')  -- Accept both statuses
        AND (
            driver_id IS NULL               -- Pending shipment (no driver yet)
            OR driver_id = v_driver_id      -- Assigned shipment (must be assigned to this driver)
        )
    RETURNING * INTO v_shipment;
    
    IF v_shipment IS NULL THEN
        RAISE EXCEPTION 'Shipment not found, already accepted, or not assigned to you';
    END IF;
    
    -- Create tracking event
    INSERT INTO tracking_events (
        shipment_id,
        event_type,
        created_by,
        notes
    ) VALUES (
        shipment_id,
        'accepted',
        v_driver_id,
        'Shipment accepted by driver'
    );
    
    RETURN QUERY SELECT * FROM shipments WHERE id = shipment_id;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION accept_shipment(UUID) IS 
'Allows a driver to accept a shipment. Handles two cases:
1. Pending shipment (status=pending, driver_id=NULL) - Driver self-assigns
2. Assigned shipment (status=assigned, driver_id set by admin) - Driver must explicitly accept
Returns error if shipment is already accepted or assigned to another driver.';
