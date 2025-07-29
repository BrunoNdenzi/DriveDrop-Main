-- Fix tracking_event_type enum issue
-- Replace 'status_change' with proper enum values based on shipment status

-- First, let's see what tracking event types are valid
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE 'Valid tracking_event_type values:';
    FOR rec IN 
        SELECT enumlabel 
        FROM pg_enum 
        WHERE enumtypid = 'tracking_event_type'::regtype 
        ORDER BY enumsortorder
    LOOP
        RAISE NOTICE '  - %', rec.enumlabel;
    END LOOP;
END $$;

-- Update existing tracking events that have invalid 'status_change' type
-- Map them to appropriate valid enum values
UPDATE public.tracking_events 
SET event_type = CASE 
    WHEN notes LIKE '%to assigned%' THEN 'accepted'::tracking_event_type
    WHEN notes LIKE '%to picked_up%' THEN 'pickup'::tracking_event_type
    WHEN notes LIKE '%to in_transit%' THEN 'in_transit'::tracking_event_type
    WHEN notes LIKE '%to delivered%' THEN 'delivery'::tracking_event_type
    WHEN notes LIKE '%to completed%' THEN 'delivery'::tracking_event_type
    WHEN notes LIKE '%to cancelled%' THEN 'cancelled'::tracking_event_type
    WHEN notes LIKE '%to delayed%' THEN 'delayed'::tracking_event_type
    ELSE 'created'::tracking_event_type  -- Default fallback
END
WHERE event_type::text = 'status_change';

-- Update the trigger function to use proper enum values
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
            NEW.updated_by
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
