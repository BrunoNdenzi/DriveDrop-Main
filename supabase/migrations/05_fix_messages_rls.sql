-- Migration: 05_fix_messages_rls.sql
-- Description: Fixes row-level security for messages table

-- Drop the existing policy for sending messages
DROP POLICY IF EXISTS "Shipment participants can send messages" ON messages;

-- Create an improved policy that ensures:
-- 1. The sender is the authenticated user
-- 2. The sender is either the client or driver involved in the shipment
-- 3. The receiver (if specified) is also involved in the shipment
CREATE POLICY "Users can send messages for their shipments" 
ON messages FOR INSERT WITH CHECK (
    -- Sender must be the authenticated user
    auth.uid() = sender_id
    AND
    (
        -- User must be involved in the shipment
        EXISTS (
            SELECT 1 FROM shipments 
            WHERE shipments.id = messages.shipment_id
            AND (shipments.client_id = auth.uid() OR shipments.driver_id = auth.uid())
        )
        AND
        -- If receiver_id is specified, they must be involved in the shipment
        (
            receiver_id IS NULL 
            OR 
            EXISTS (
                SELECT 1 FROM shipments 
                WHERE shipments.id = messages.shipment_id
                AND (shipments.client_id = receiver_id OR shipments.driver_id = receiver_id)
            )
        )
    )
);

-- Create a function to properly send messages that handles receiver_id validation
CREATE OR REPLACE FUNCTION send_message(
    p_shipment_id UUID,
    p_content TEXT,
    p_receiver_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_sender_id UUID;
    v_message_id UUID;
    v_is_valid BOOLEAN;
BEGIN
    -- Get the current user ID
    SELECT auth.uid() INTO v_sender_id;
    
    -- Validate the sender is involved in the shipment
    SELECT EXISTS (
        SELECT 1 FROM shipments 
        WHERE id = p_shipment_id
        AND (client_id = v_sender_id OR driver_id = v_sender_id)
    ) INTO v_is_valid;
    
    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'You are not authorized to send messages for this shipment';
    END IF;
    
    -- If receiver_id is provided, validate they are involved in the shipment
    IF p_receiver_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM shipments 
            WHERE id = p_shipment_id
            AND (client_id = p_receiver_id OR driver_id = p_receiver_id)
        ) INTO v_is_valid;
        
        IF NOT v_is_valid THEN
            RAISE EXCEPTION 'The receiver is not involved in this shipment';
        END IF;
    END IF;
    
    -- Insert the message
    INSERT INTO messages (
        shipment_id,
        sender_id,
        receiver_id,
        content
    ) VALUES (
        p_shipment_id,
        v_sender_id,
        p_receiver_id,
        p_content
    ) RETURNING id INTO v_message_id;
    
    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
