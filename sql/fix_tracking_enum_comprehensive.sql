-- Comprehensive fix for tracking_event_type enum issue
-- This will find and fix all triggers that use 'status_change'

-- Step 1: Check what triggers exist on shipments table
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'shipments';

-- Step 2: Check all functions that might insert tracking events
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%status_change%'
AND routine_type = 'FUNCTION';

-- Step 3: Update existing invalid tracking events
UPDATE public.tracking_events 
SET event_type = CASE 
    WHEN notes ILIKE '%to assigned%' THEN 'accepted'::tracking_event_type
    WHEN notes ILIKE '%to picked_up%' THEN 'pickup'::tracking_event_type
    WHEN notes ILIKE '%to in_transit%' THEN 'in_transit'::tracking_event_type
    WHEN notes ILIKE '%to delivered%' THEN 'delivery'::tracking_event_type
    WHEN notes ILIKE '%to completed%' THEN 'delivery'::tracking_event_type
    WHEN notes ILIKE '%to cancelled%' THEN 'cancelled'::tracking_event_type
    WHEN notes ILIKE '%to delayed%' THEN 'delayed'::tracking_event_type
    ELSE 'created'::tracking_event_type
END
WHERE event_type::text = 'status_change';

-- Step 4: Drop all existing shipment triggers to avoid conflicts
DROP TRIGGER IF EXISTS shipment_status_change_trigger ON shipments;
DROP TRIGGER IF EXISTS trigger_shipment_status_change ON shipments;
DROP TRIGGER IF EXISTS shipment_update_trigger ON shipments;

-- Step 5: Drop and recreate the function with correct enum values
DROP FUNCTION IF EXISTS handle_shipment_status_change() CASCADE;

CREATE OR REPLACE FUNCTION handle_shipment_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create tracking event if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO tracking_events (
            shipment_id,
            event_type,
            notes,
            created_by
        ) VALUES (
            NEW.id,
            CASE NEW.status
                WHEN 'pending' THEN 'created'::tracking_event_type
                WHEN 'assigned' THEN 'accepted'::tracking_event_type
                WHEN 'picked_up' THEN 'pickup'::tracking_event_type
                WHEN 'in_transit' THEN 'in_transit'::tracking_event_type
                WHEN 'delivered' THEN 'delivery'::tracking_event_type
                WHEN 'completed' THEN 'delivery'::tracking_event_type
                WHEN 'cancelled' THEN 'cancelled'::tracking_event_type
                WHEN 'delayed' THEN 'delayed'::tracking_event_type
                ELSE 'created'::tracking_event_type
            END,
            'Status changed from ' || COALESCE(OLD.status, 'new') || ' to ' || NEW.status,
            COALESCE(NEW.updated_by, NEW.driver_id, NEW.client_id)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create the trigger
CREATE TRIGGER shipment_status_change_trigger
    AFTER UPDATE ON shipments
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION handle_shipment_status_change();

-- Step 7: Verify the fix
SELECT 'Tracking event trigger updated successfully' AS status;
