-- Messaging System Redesign
-- This script creates a clean, comprehensive messaging system

-- Drop existing messaging tables and functions to start fresh
-- Drop all variations of send_message function
DROP FUNCTION IF EXISTS send_message(UUID, TEXT, UUID, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS send_message(UUID, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS send_message(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS send_message CASCADE;

-- Drop other existing functions
DROP FUNCTION IF EXISTS mark_message_as_read(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS mark_message_as_read(UUID) CASCADE;
DROP FUNCTION IF EXISTS mark_message_as_read CASCADE;
DROP FUNCTION IF EXISTS get_messages_between_users CASCADE;
DROP FUNCTION IF EXISTS count_unread_messages CASCADE;
DROP FUNCTION IF EXISTS is_messaging_allowed CASCADE;
DROP FUNCTION IF EXISTS get_conversation_messages CASCADE;
DROP FUNCTION IF EXISTS get_user_conversations CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_messages CASCADE;

-- Drop existing tables
DROP TABLE IF EXISTS message_read_status CASCADE;
DROP TABLE IF EXISTS messages CASCADE;

-- Create improved messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (LENGTH(content) > 0 AND LENGTH(content) <= 2000),
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'notification')),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT valid_content CHECK (TRIM(content) != ''),
    CONSTRAINT future_expiry CHECK (expires_at > created_at)
);

-- Create indexes for optimal performance
CREATE INDEX idx_messages_shipment_id ON messages(shipment_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_expires_at ON messages(expires_at);
CREATE INDEX idx_messages_unread ON messages(is_read, receiver_id) WHERE is_read = FALSE;

-- Create conversation participants view for easier querying
CREATE OR REPLACE VIEW conversation_participants AS
SELECT DISTINCT
    s.id as shipment_id,
    s.client_id,
    s.driver_id,
    s.status as shipment_status,
    s.created_at as shipment_created_at,
    s.updated_at as shipment_updated_at,
    -- Admin users can participate in any conversation
    (SELECT array_agg(p.id) FROM profiles p WHERE p.role = 'admin') as admin_ids
FROM shipments s
WHERE s.driver_id IS NOT NULL;

-- Function to check if messaging is allowed between users for a shipment
CREATE OR REPLACE FUNCTION is_messaging_allowed(
    p_shipment_id UUID,
    p_user1_id UUID,
    p_user2_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_shipment RECORD;
    v_user1_role user_role;
    v_user2_role user_role;
    v_hours_since_completion INTEGER;
BEGIN
    -- Get shipment details
    SELECT * INTO v_shipment
    FROM shipments 
    WHERE id = p_shipment_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Get user roles
    SELECT role INTO v_user1_role FROM profiles WHERE id = p_user1_id;
    SELECT role INTO v_user2_role FROM profiles WHERE id = p_user2_id;
    
    -- Admin can always message
    IF v_user1_role = 'admin' OR v_user2_role = 'admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Check if shipment is completed and beyond 24 hour limit
    IF v_shipment.status = 'delivered' THEN
        SELECT EXTRACT(EPOCH FROM (NOW() - v_shipment.updated_at)) / 3600 INTO v_hours_since_completion;
        IF v_hours_since_completion > 24 THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Check if users are participants in the shipment
    IF NOT (
        (p_user1_id = v_shipment.client_id OR p_user1_id = v_shipment.driver_id) AND
        (p_user2_id IS NULL OR p_user2_id = v_shipment.client_id OR p_user2_id = v_shipment.driver_id)
    ) THEN
        RETURN FALSE;
    END IF;
    
    -- Messaging only allowed for assigned shipments (not pending)
    IF v_shipment.status = 'pending' OR v_shipment.driver_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send a message with comprehensive validation
CREATE OR REPLACE FUNCTION send_message_v2(
    p_shipment_id UUID,
    p_content TEXT,
    p_receiver_id UUID DEFAULT NULL,
    p_message_type VARCHAR(20) DEFAULT 'text'
) RETURNS JSONB AS $$
DECLARE
    v_sender_id UUID;
    v_message_id UUID;
    v_shipment RECORD;
    v_other_participant_id UUID;
    result JSONB;
BEGIN
    -- Get authenticated user
    v_sender_id := auth.uid();
    
    IF v_sender_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to send messages';
    END IF;
    
    -- Validate content
    IF TRIM(p_content) = '' OR LENGTH(p_content) > 2000 THEN
        RAISE EXCEPTION 'Message content must be between 1 and 2000 characters';
    END IF;
    
    -- Get shipment info
    SELECT * INTO v_shipment FROM shipments WHERE id = p_shipment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shipment not found';
    END IF;
    
    -- Determine receiver if not specified
    IF p_receiver_id IS NULL THEN
        IF v_sender_id = v_shipment.client_id THEN
            v_other_participant_id := v_shipment.driver_id;
        ELSIF v_sender_id = v_shipment.driver_id THEN
            v_other_participant_id := v_shipment.client_id;
        ELSE
            -- For admin users, they need to specify receiver
            RAISE EXCEPTION 'Admin users must specify receiver_id';
        END IF;
    ELSE
        v_other_participant_id := p_receiver_id;
    END IF;
    
    -- Check if messaging is allowed
    IF NOT is_messaging_allowed(p_shipment_id, v_sender_id, v_other_participant_id) THEN
        RAISE EXCEPTION 'Messaging not allowed for this shipment or time period has expired';
    END IF;
    
    -- Insert message
    INSERT INTO messages (
        shipment_id,
        sender_id,
        receiver_id,
        content,
        message_type,
        expires_at
    ) VALUES (
        p_shipment_id,
        v_sender_id,
        v_other_participant_id,
        TRIM(p_content),
        p_message_type,
        CASE 
            WHEN v_shipment.status = 'delivered' THEN v_shipment.updated_at + INTERVAL '24 hours'
            ELSE NOW() + INTERVAL '24 hours'
        END
    ) RETURNING id INTO v_message_id;
    
    -- Return message details
    SELECT jsonb_build_object(
        'id', m.id,
        'shipment_id', m.shipment_id,
        'sender_id', m.sender_id,
        'receiver_id', m.receiver_id,
        'content', m.content,
        'message_type', m.message_type,
        'is_read', m.is_read,
        'created_at', m.created_at,
        'expires_at', m.expires_at,
        'sender', jsonb_build_object(
            'id', sp.id,
            'first_name', sp.first_name,
            'last_name', sp.last_name,
            'avatar_url', sp.avatar_url,
            'role', sp.role
        ),
        'receiver', CASE 
            WHEN rp.id IS NOT NULL THEN jsonb_build_object(
                'id', rp.id,
                'first_name', rp.first_name,
                'last_name', rp.last_name,
                'avatar_url', rp.avatar_url,
                'role', rp.role
            )
            ELSE NULL
        END
    ) INTO result
    FROM messages m
    JOIN profiles sp ON m.sender_id = sp.id
    LEFT JOIN profiles rp ON m.receiver_id = rp.id
    WHERE m.id = v_message_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_message_as_read(
    p_message_id UUID,
    p_user_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    UPDATE messages
    SET is_read = TRUE,
        read_at = NOW()
    WHERE id = p_message_id
        AND receiver_id = v_user_id
        AND is_read = FALSE;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get conversation messages
CREATE OR REPLACE FUNCTION get_conversation_messages(
    p_shipment_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    result JSONB;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;
    
    -- Check if user can access this conversation
    IF NOT is_messaging_allowed(p_shipment_id, v_user_id) THEN
        RAISE EXCEPTION 'Access denied to this conversation';
    END IF;
    
    -- Mark unread messages as read for the current user
    UPDATE messages 
    SET is_read = TRUE, read_at = NOW()
    WHERE shipment_id = p_shipment_id
        AND receiver_id = v_user_id
        AND is_read = FALSE
        AND expires_at > NOW();
    
    -- Get messages
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', m.id,
            'shipment_id', m.shipment_id,
            'sender_id', m.sender_id,
            'receiver_id', m.receiver_id,
            'content', m.content,
            'message_type', m.message_type,
            'is_read', m.is_read,
            'read_at', m.read_at,
            'created_at', m.created_at,
            'expires_at', m.expires_at,
            'sender', jsonb_build_object(
                'id', sp.id,
                'first_name', sp.first_name,
                'last_name', sp.last_name,
                'avatar_url', sp.avatar_url,
                'role', sp.role
            ),
            'receiver', CASE 
                WHEN rp.id IS NOT NULL THEN jsonb_build_object(
                    'id', rp.id,
                    'first_name', rp.first_name,
                    'last_name', rp.last_name,
                    'avatar_url', rp.avatar_url,
                    'role', rp.role
                )
                ELSE NULL
            END
        ) ORDER BY m.created_at ASC
    ) INTO result
    FROM messages m
    JOIN profiles sp ON m.sender_id = sp.id
    LEFT JOIN profiles rp ON m.receiver_id = rp.id
    WHERE m.shipment_id = p_shipment_id
        AND m.expires_at > NOW()
    ORDER BY m.created_at ASC
    LIMIT p_limit OFFSET p_offset;
    
    RETURN COALESCE(result, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's conversations
CREATE OR REPLACE FUNCTION get_user_conversations(
    p_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    result JSONB;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;
    
    SELECT jsonb_agg(
        jsonb_build_object(
            'shipment_id', conv.shipment_id,
            'shipment_title', s.title,
            'shipment_status', s.status,
            'other_participant', jsonb_build_object(
                'id', op.id,
                'first_name', op.first_name,
                'last_name', op.last_name,
                'avatar_url', op.avatar_url,
                'role', op.role
            ),
            'last_message', jsonb_build_object(
                'content', conv.last_message_content,
                'created_at', conv.last_message_at,
                'sender_id', conv.last_message_sender_id
            ),
            'unread_count', conv.unread_count,
            'messaging_allowed', is_messaging_allowed(conv.shipment_id, v_user_id),
            'expires_at', CASE 
                WHEN s.status = 'delivered' THEN s.updated_at + INTERVAL '24 hours'
                ELSE NULL
            END
        ) ORDER BY conv.last_message_at DESC
    ) INTO result
    FROM (
        SELECT 
            m.shipment_id,
            CASE 
                WHEN m.sender_id = v_user_id THEN m.receiver_id
                ELSE m.sender_id
            END as other_participant_id,
            MAX(m.content) FILTER (WHERE m.created_at = MAX(m.created_at)) as last_message_content,
            MAX(m.created_at) as last_message_at,
            MAX(m.sender_id) FILTER (WHERE m.created_at = MAX(m.created_at)) as last_message_sender_id,
            COUNT(*) FILTER (WHERE m.receiver_id = v_user_id AND m.is_read = FALSE) as unread_count
        FROM messages m
        WHERE (m.sender_id = v_user_id OR m.receiver_id = v_user_id)
            AND m.expires_at > NOW()
        GROUP BY m.shipment_id, 
            CASE 
                WHEN m.sender_id = v_user_id THEN m.receiver_id
                ELSE m.sender_id
            END
    ) conv
    JOIN shipments s ON conv.shipment_id = s.id
    JOIN profiles op ON conv.other_participant_id = op.id
    WHERE conv.last_message_at IS NOT NULL;
    
    RETURN COALESCE(result, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired messages
CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM messages 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Set up Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy for viewing messages
CREATE POLICY "Users can view their messages" ON messages FOR SELECT
USING (
    auth.uid() = sender_id 
    OR auth.uid() = receiver_id 
    OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Policy for inserting messages (handled by function)
CREATE POLICY "Users can send messages through function" ON messages FOR INSERT
WITH CHECK (
    auth.uid() = sender_id
    AND is_messaging_allowed(shipment_id, auth.uid(), receiver_id)
);

-- Policy for updating messages (only mark as read)
CREATE POLICY "Users can mark their messages as read" ON messages FOR UPDATE
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

-- Create scheduled job to clean up expired messages (if pg_cron is available)
-- This would typically be set up by an admin
-- SELECT cron.schedule('cleanup-expired-messages', '0 */6 * * *', 'SELECT cleanup_expired_messages();');

-- Grant permissions
GRANT EXECUTE ON FUNCTION send_message_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION mark_message_as_read TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_messages TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_conversations TO authenticated;
GRANT EXECUTE ON FUNCTION is_messaging_allowed TO authenticated;

-- Create triggers for automatic cleanup and notifications
CREATE OR REPLACE FUNCTION notify_new_message() RETURNS TRIGGER AS $$
BEGIN
    -- Perform real-time notification
    PERFORM pg_notify(
        'new_message',
        json_build_object(
            'shipment_id', NEW.shipment_id,
            'sender_id', NEW.sender_id,
            'receiver_id', NEW.receiver_id,
            'message_id', NEW.id
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER message_notification_trigger
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_message();

-- Comment the table for documentation
COMMENT ON TABLE messages IS 'Real-time messaging system with 24-hour expiry and role-based access control';
COMMENT ON FUNCTION send_message_v2 IS 'Send a message with validation for shipment participants and time limits';
COMMENT ON FUNCTION is_messaging_allowed IS 'Check if messaging is allowed between users for a shipment based on business rules';
