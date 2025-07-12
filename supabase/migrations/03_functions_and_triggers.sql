-- Migration: 03_functions_and_triggers
-- Functions for managing shipments

-- Function to accept a shipment (for drivers)
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
    UPDATE shipments
    SET 
        driver_id = v_driver_id,
        status = 'accepted',
        updated_at = NOW()
    WHERE 
        id = shipment_id
        AND status = 'pending'
        AND driver_id IS NULL
    RETURNING * INTO v_shipment;
    
    IF v_shipment IS NULL THEN
        RAISE EXCEPTION 'Shipment not found or already accepted';
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

-- Function to create a tracking event
CREATE OR REPLACE FUNCTION create_tracking_event(
    p_shipment_id UUID,
    p_event_type tracking_event_type,
    p_location GEOGRAPHY(POINT) DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_shipment_id UUID;
    v_event_id UUID;
BEGIN
    -- Get the user ID
    v_user_id := auth.uid();
    
    -- Check if the user is allowed to create this tracking event
    SELECT id INTO v_shipment_id
    FROM shipments
    WHERE id = p_shipment_id
    AND (
        driver_id = v_user_id
        OR v_user_id IN (SELECT id FROM profiles WHERE role = 'admin')
    );
    
    IF v_shipment_id IS NULL THEN
        RAISE EXCEPTION 'Not authorized to create tracking events for this shipment';
    END IF;
    
    -- Create the tracking event
    INSERT INTO tracking_events (
        shipment_id,
        event_type,
        created_by,
        location,
        notes
    ) VALUES (
        p_shipment_id,
        p_event_type,
        v_user_id,
        p_location,
        p_notes
    ) RETURNING id INTO v_event_id;
    
    -- Update shipment status based on event type
    IF p_event_type = 'pickup' THEN
        UPDATE shipments SET status = 'in_transit' WHERE id = p_shipment_id;
    ELSIF p_event_type = 'delivery' THEN
        UPDATE shipments SET status = 'delivered' WHERE id = p_shipment_id;
    ELSIF p_event_type = 'cancelled' THEN
        UPDATE shipments SET status = 'cancelled' WHERE id = p_shipment_id;
    END IF;
    
    RETURN v_event_id;
END;
$$;

-- Function to get nearby available shipments for a driver
CREATE OR REPLACE FUNCTION get_nearby_shipments(
    p_lat NUMERIC,
    p_lng NUMERIC,
    p_distance_km INTEGER DEFAULT 50
)
RETURNS SETOF shipments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_user_role user_role;
    v_point GEOGRAPHY;
BEGIN
    -- Get the user ID and role
    v_user_id := auth.uid();
    
    SELECT role INTO v_user_role
    FROM profiles
    WHERE id = v_user_id;
    
    IF v_user_role != 'driver' THEN
        RAISE EXCEPTION 'Only drivers can use this function';
    END IF;
    
    -- Create a point from the coordinates
    v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY;
    
    -- Return nearby shipments
    RETURN QUERY
    SELECT *
    FROM shipments
    WHERE 
        status = 'pending'
        AND driver_id IS NULL
        AND ST_DWithin(pickup_location, v_point, p_distance_km * 1000)
    ORDER BY 
        ST_Distance(pickup_location, v_point) ASC;
END;
$$;

-- Function to mark a message as read
CREATE OR REPLACE FUNCTION mark_message_read(p_message_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_message_exists BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    -- Check if the user is a participant in the shipment for this message
    UPDATE messages
    SET is_read = TRUE
    WHERE 
        id = p_message_id
        AND EXISTS (
            SELECT 1 FROM shipments s
            WHERE s.id = messages.shipment_id
            AND (s.client_id = v_user_id OR s.driver_id = v_user_id)
        )
        AND sender_id != v_user_id  -- Only mark as read if the current user is not the sender
    RETURNING TRUE INTO v_message_exists;
    
    RETURN COALESCE(v_message_exists, FALSE);
END;
$$;

-- Function to handle driver verification
CREATE OR REPLACE FUNCTION verify_driver(p_driver_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_user_role user_role;
    v_success BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    -- Check if the current user is an admin
    SELECT role INTO v_user_role
    FROM profiles
    WHERE id = v_user_id;
    
    IF v_user_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can verify drivers';
    END IF;
    
    -- Update the driver's application status and profile
    UPDATE driver_applications
    SET status = 'approved'
    WHERE user_id = p_driver_id;
    
    UPDATE profiles
    SET 
        role = 'driver',
        is_verified = TRUE
    WHERE id = p_driver_id
    RETURNING TRUE INTO v_success;
    
    RETURN COALESCE(v_success, FALSE);
END;
$$;

-- Create a secure function for updating payment status
CREATE OR REPLACE FUNCTION update_payment_status(
    p_payment_id UUID,
    p_status payment_status,
    p_payment_intent_id TEXT DEFAULT NULL,
    p_payment_intent_client_secret TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS SETOF payments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_payment record;
BEGIN
    v_user_id := auth.uid();
    
    -- Check if the user is authorized (client who owns the payment or admin)
    IF NOT EXISTS (
        SELECT 1 FROM payments
        WHERE id = p_payment_id
        AND (client_id = v_user_id OR v_user_id IN (SELECT id FROM profiles WHERE role = 'admin'))
    ) THEN
        RAISE EXCEPTION 'Not authorized to update this payment';
    END IF;
    
    -- Update the payment
    UPDATE payments
    SET 
        status = p_status,
        payment_intent_id = COALESCE(p_payment_intent_id, payment_intent_id),
        payment_intent_client_secret = COALESCE(p_payment_intent_client_secret, payment_intent_client_secret),
        metadata = COALESCE(p_metadata, metadata),
        updated_at = NOW()
    WHERE id = p_payment_id
    RETURNING * INTO v_payment;
    
    -- If payment is completed, update the shipment
    IF p_status = 'completed' THEN
        -- Future: handle driver payout, commission, etc.
        NULL; -- Placeholder for future implementation
    END IF;
    
    RETURN QUERY SELECT * FROM payments WHERE id = p_payment_id;
END;
$$;
