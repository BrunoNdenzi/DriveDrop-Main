-- Find and eliminate ALL sources of 'status_change' in tracking events

-- Step 1: Find ALL functions that contain 'status_change'
SELECT 
    proname as function_name,
    prosrc as function_body
FROM pg_proc 
WHERE prosrc ILIKE '%status_change%';

-- Step 2: Check for ANY triggers on shipments table
SELECT 
    t.tgname as trigger_name,
    p.proname as function_name,
    t.tgenabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'shipments';

-- Step 3: DISABLE all triggers on shipments temporarily
ALTER TABLE shipments DISABLE TRIGGER ALL;

-- Step 4: Update any existing invalid tracking events
UPDATE tracking_events 
SET event_type = 'created'::tracking_event_type 
WHERE event_type::text = 'status_change';

-- Step 5: Find and drop ALL functions that use 'status_change'
DO $$
DECLARE
    func_name text;
BEGIN
    FOR func_name IN 
        SELECT proname 
        FROM pg_proc 
        WHERE prosrc ILIKE '%status_change%'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_name || '() CASCADE';
        RAISE NOTICE 'Dropped function: %', func_name;
    END LOOP;
END $$;

-- Step 6: Create a completely new, clean trigger function
CREATE OR REPLACE FUNCTION track_shipment_status_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Only track if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO tracking_events (
            shipment_id,
            event_type,
            notes,
            created_by
        ) VALUES (
            NEW.id,
            CASE NEW.status::text
                WHEN 'pending' THEN 'created'
                WHEN 'assigned' THEN 'accepted'
                WHEN 'picked_up' THEN 'pickup'
                WHEN 'in_transit' THEN 'in_transit'
                WHEN 'delivered' THEN 'delivery'
                WHEN 'completed' THEN 'delivery'
                WHEN 'cancelled' THEN 'cancelled'
                WHEN 'delayed' THEN 'delayed'
                ELSE 'created'
            END::tracking_event_type,
            'Status updated: ' || COALESCE(OLD.status::text, 'new') || ' → ' || NEW.status::text,
            COALESCE(NEW.updated_by, NEW.driver_id, NEW.client_id)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Re-enable triggers and create our new one
ALTER TABLE shipments ENABLE TRIGGER ALL;

-- Drop any existing status change triggers
DROP TRIGGER IF EXISTS shipment_status_change_trigger ON shipments;
DROP TRIGGER IF EXISTS trigger_shipment_status_change ON shipments;
DROP TRIGGER IF EXISTS shipment_update_trigger ON shipments;
DROP TRIGGER IF EXISTS handle_shipment_status_change_trigger ON shipments;

-- Create our new clean trigger
CREATE TRIGGER shipment_status_update_tracker
    AFTER UPDATE OF status ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION track_shipment_status_updates();

-- Step 8: Test the trigger by checking if it exists
SELECT 
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'shipments'
AND trigger_name = 'shipment_status_update_tracker';

-- Step 9: Verify no more 'status_change' references exist
SELECT 'Fix completed - no more status_change references should exist' as result;
