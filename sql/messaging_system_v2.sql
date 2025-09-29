-- NEW MESSAGING SYSTEM V2 - Complete Redesign
-- Re-implementation from scratch maintaining design and functionality

-- Drop existing messaging components
DROP TABLE IF EXISTS messages CASCADE;
DROP FUNCTION IF EXISTS send_message CASCADE;
DROP FUNCTION IF EXISTS send_message_v2 CASCADE;
DROP FUNCTION IF EXISTS get_conversation_messages CASCADE;
DROP FUNCTION IF EXISTS get_user_conversations CASCADE;
DROP FUNCTION IF EXISTS mark_message_as_read CASCADE;
DROP FUNCTION IF EXISTS is_messaging_allowed CASCADE;
DROP FUNCTION IF EXISTS check_messaging_status CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_conversations CASCADE;

-- Create new conversations table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL UNIQUE REFERENCES shipments(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- Set when shipment completes
    CONSTRAINT valid_participants CHECK (client_id != driver_id)
);

-- Create new messages table with enhanced features
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (LENGTH(content) > 0 AND LENGTH(content) <= 2000),
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'notification')),
    
    -- Message status tracking
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    
    -- Metadata for enhanced features
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_content CHECK (TRIM(content) != ''),
    CONSTRAINT valid_timestamps CHECK (
        sent_at <= COALESCE(delivered_at, sent_at) AND 
        COALESCE(delivered_at, sent_at) <= COALESCE(read_at, COALESCE(delivered_at, sent_at))
    )
);

-- Create indexes for optimal performance
CREATE INDEX idx_conversations_shipment_id ON conversations(shipment_id);
CREATE INDEX idx_conversations_client_id ON conversations(client_id);
CREATE INDEX idx_conversations_driver_id ON conversations(driver_id);
CREATE INDEX idx_conversations_active ON conversations(is_active) WHERE is_active = true;

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_unread ON messages(conversation_id, read_at) WHERE read_at IS NULL;

-- Function to create conversation when driver is assigned
CREATE OR REPLACE FUNCTION create_conversation_on_assignment()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create conversation when driver is assigned (was NULL, now has value)
    IF OLD.driver_id IS NULL AND NEW.driver_id IS NOT NULL THEN
        INSERT INTO conversations (shipment_id, client_id, driver_id)
        VALUES (NEW.id, NEW.client_id, NEW.driver_id)
        ON CONFLICT (shipment_id) DO NOTHING;
        
        -- Send system message about assignment
        INSERT INTO messages (
            conversation_id, 
            sender_id, 
            content, 
            message_type,
            delivered_at
        )
        SELECT 
            c.id,
            NEW.driver_id,
            'Driver has been assigned to this shipment. You can now communicate directly.',
            'system',
            NOW()
        FROM conversations c 
        WHERE c.shipment_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to expire conversation when shipment completes
CREATE OR REPLACE FUNCTION expire_conversation_on_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- When shipment status changes to 'delivered', expire the conversation
    IF OLD.status != 'delivered' AND NEW.status = 'delivered' THEN
        UPDATE conversations 
        SET 
            is_active = FALSE,
            expires_at = NOW() + INTERVAL '24 hours' -- 24 hour grace period
        WHERE shipment_id = NEW.id;
        
        -- Send system message about completion
        INSERT INTO messages (
            conversation_id, 
            sender_id, 
            content, 
            message_type,
            delivered_at
        )
        SELECT 
            c.id,
            NEW.driver_id,
            'Shipment has been completed. This conversation will expire in 24 hours.',
            'system',
            NOW()
        FROM conversations c 
        WHERE c.shipment_id = NEW.id AND c.is_active = TRUE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_create_conversation ON shipments;
CREATE TRIGGER trigger_create_conversation
    AFTER UPDATE ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION create_conversation_on_assignment();

DROP TRIGGER IF EXISTS trigger_expire_conversation ON shipments;
CREATE TRIGGER trigger_expire_conversation
    AFTER UPDATE ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION expire_conversation_on_completion();

-- Function to check if user can access conversation
CREATE OR REPLACE FUNCTION can_access_conversation(
    p_conversation_id UUID,
    p_user_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_conversation RECORD;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get user role
    SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
    
    -- Admins can access any conversation
    IF v_user_role = 'admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Get conversation details
    SELECT * INTO v_conversation 
    FROM conversations 
    WHERE id = p_conversation_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check if user is participant
    IF v_user_id = v_conversation.client_id OR v_user_id = v_conversation.driver_id THEN
        -- Check if conversation is still active or within grace period
        IF v_conversation.is_active = TRUE THEN
            RETURN TRUE;
        ELSIF v_conversation.expires_at IS NOT NULL AND v_conversation.expires_at > NOW() THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send message
CREATE OR REPLACE FUNCTION send_message_v2(
    p_conversation_id UUID,
    p_content TEXT,
    p_message_type TEXT DEFAULT 'text'
) RETURNS JSONB AS $$
DECLARE
    v_sender_id UUID;
    v_sender_role TEXT;
    v_message_id UUID;
    v_conversation RECORD;
    result JSONB;
BEGIN
    v_sender_id := auth.uid();
    
    IF v_sender_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;
    
    -- Get sender role
    SELECT role INTO v_sender_role FROM profiles WHERE id = v_sender_id;
    
    -- Check if user can access this conversation
    IF NOT can_access_conversation(p_conversation_id, v_sender_id) THEN
        RAISE EXCEPTION 'Access denied to this conversation';
    END IF;
    
    -- Get conversation details
    SELECT * INTO v_conversation FROM conversations WHERE id = p_conversation_id;
    
    -- For non-admin users, check if conversation is still active
    IF v_sender_role != 'admin' AND v_conversation.is_active = FALSE AND 
       (v_conversation.expires_at IS NULL OR v_conversation.expires_at <= NOW()) THEN
        RAISE EXCEPTION 'This conversation has expired';
    END IF;
    
    -- Insert message
    INSERT INTO messages (
        conversation_id,
        sender_id,
        content,
        message_type,
        delivered_at
    ) VALUES (
        p_conversation_id,
        v_sender_id,
        TRIM(p_content),
        p_message_type,
        NOW()
    ) RETURNING id INTO v_message_id;
    
    -- Return message with sender details
    SELECT jsonb_build_object(
        'id', m.id,
        'conversation_id', m.conversation_id,
        'sender_id', m.sender_id,
        'content', m.content,
        'message_type', m.message_type,
        'sent_at', m.sent_at,
        'delivered_at', m.delivered_at,
        'read_at', m.read_at,
        'created_at', m.created_at,
        'sender', jsonb_build_object(
            'id', p.id,
            'first_name', p.first_name,
            'last_name', p.last_name,
            'avatar_url', p.avatar_url,
            'role', p.role
        )
    ) INTO result
    FROM messages m
    JOIN profiles p ON m.sender_id = p.id
    WHERE m.id = v_message_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get conversation messages
CREATE OR REPLACE FUNCTION get_conversation_messages_v2(
    p_conversation_id UUID,
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
    
    -- Check access
    IF NOT can_access_conversation(p_conversation_id, v_user_id) THEN
        RAISE EXCEPTION 'Access denied to this conversation';
    END IF;
    
    -- Get messages
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', m.id,
            'conversation_id', m.conversation_id,
            'sender_id', m.sender_id,
            'content', m.content,
            'message_type', m.message_type,
            'sent_at', m.sent_at,
            'delivered_at', m.delivered_at,
            'read_at', m.read_at,
            'created_at', m.created_at,
            'sender', jsonb_build_object(
                'id', sp.id,
                'first_name', sp.first_name,
                'last_name', sp.last_name,
                'avatar_url', sp.avatar_url,
                'role', sp.role
            )
        ) ORDER BY m.created_at ASC
    ) INTO result
    FROM messages m
    JOIN profiles sp ON m.sender_id = sp.id
    WHERE m.conversation_id = p_conversation_id
    ORDER BY m.created_at ASC
    LIMIT p_limit OFFSET p_offset;
    
    RETURN COALESCE(result, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's conversations
CREATE OR REPLACE FUNCTION get_user_conversations_v2(
    p_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    result JSONB;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;
    
    -- Get user role
    SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
    
    -- For admin users, get all active conversations
    IF v_user_role = 'admin' THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', c.id,
                'shipment_id', c.shipment_id,
                'is_active', c.is_active,
                'created_at', c.created_at,
                'expires_at', c.expires_at,
                'shipment', jsonb_build_object(
                    'id', s.id,
                    'title', s.title,
                    'status', s.status,
                    'pickup_address', s.pickup_address,
                    'delivery_address', s.delivery_address
                ),
                'client', jsonb_build_object(
                    'id', client.id,
                    'first_name', client.first_name,
                    'last_name', client.last_name,
                    'avatar_url', client.avatar_url
                ),
                'driver', jsonb_build_object(
                    'id', driver.id,
                    'first_name', driver.first_name,
                    'last_name', driver.last_name,
                    'avatar_url', driver.avatar_url
                ),
                'last_message', CASE 
                    WHEN lm.id IS NOT NULL THEN jsonb_build_object(
                        'content', lm.content,
                        'created_at', lm.created_at,
                        'sender_id', lm.sender_id
                    )
                    ELSE NULL
                END,
                'unread_count', COALESCE(unread.count, 0)
            ) ORDER BY COALESCE(lm.created_at, c.created_at) DESC
        ) INTO result
        FROM conversations c
        JOIN shipments s ON c.shipment_id = s.id
        JOIN profiles client ON c.client_id = client.id
        JOIN profiles driver ON c.driver_id = driver.id
        LEFT JOIN LATERAL (
            SELECT m.* FROM messages m 
            WHERE m.conversation_id = c.id 
            ORDER BY m.created_at DESC 
            LIMIT 1
        ) lm ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*) as count 
            FROM messages m 
            WHERE m.conversation_id = c.id 
            AND m.sender_id != v_user_id 
            AND m.read_at IS NULL
        ) unread ON true
        WHERE c.is_active = TRUE OR (c.expires_at IS NOT NULL AND c.expires_at > NOW());
    ELSE
        -- For regular users, get their conversations
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', c.id,
                'shipment_id', c.shipment_id,
                'is_active', c.is_active,
                'created_at', c.created_at,
                'expires_at', c.expires_at,
                'shipment', jsonb_build_object(
                    'id', s.id,
                    'title', s.title,
                    'status', s.status,
                    'pickup_address', s.pickup_address,
                    'delivery_address', s.delivery_address
                ),
                'other_participant', CASE 
                    WHEN c.client_id = v_user_id THEN jsonb_build_object(
                        'id', driver.id,
                        'first_name', driver.first_name,
                        'last_name', driver.last_name,
                        'avatar_url', driver.avatar_url,
                        'role', driver.role
                    )
                    ELSE jsonb_build_object(
                        'id', client.id,
                        'first_name', client.first_name,
                        'last_name', client.last_name,
                        'avatar_url', client.avatar_url,
                        'role', client.role
                    )
                END,
                'last_message', CASE 
                    WHEN lm.id IS NOT NULL THEN jsonb_build_object(
                        'content', lm.content,
                        'created_at', lm.created_at,
                        'sender_id', lm.sender_id
                    )
                    ELSE NULL
                END,
                'unread_count', COALESCE(unread.count, 0)
            ) ORDER BY COALESCE(lm.created_at, c.created_at) DESC
        ) INTO result
        FROM conversations c
        JOIN shipments s ON c.shipment_id = s.id
        JOIN profiles client ON c.client_id = client.id
        JOIN profiles driver ON c.driver_id = driver.id
        LEFT JOIN LATERAL (
            SELECT m.* FROM messages m 
            WHERE m.conversation_id = c.id 
            ORDER BY m.created_at DESC 
            LIMIT 1
        ) lm ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*) as count 
            FROM messages m 
            WHERE m.conversation_id = c.id 
            AND m.sender_id != v_user_id 
            AND m.read_at IS NULL
        ) unread ON true
        WHERE (c.client_id = v_user_id OR c.driver_id = v_user_id)
        AND (c.is_active = TRUE OR (c.expires_at IS NOT NULL AND c.expires_at > NOW()));
    END IF;
    
    RETURN COALESCE(result, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark message as read
CREATE OR REPLACE FUNCTION mark_message_as_read_v2(
    p_message_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_conversation_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get conversation ID for access check
    SELECT conversation_id INTO v_conversation_id 
    FROM messages 
    WHERE id = p_message_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check access
    IF NOT can_access_conversation(v_conversation_id, v_user_id) THEN
        RETURN FALSE;
    END IF;
    
    -- Mark as read (only if user is not the sender)
    UPDATE messages
    SET read_at = NOW()
    WHERE id = p_message_id
    AND sender_id != v_user_id
    AND read_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get conversation by shipment ID
CREATE OR REPLACE FUNCTION get_conversation_by_shipment(
    p_shipment_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    result JSONB;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;
    
    SELECT jsonb_build_object(
        'id', c.id,
        'shipment_id', c.shipment_id,
        'is_active', c.is_active,
        'created_at', c.created_at,
        'expires_at', c.expires_at,
        'can_access', can_access_conversation(c.id, v_user_id)
    ) INTO result
    FROM conversations c
    WHERE c.shipment_id = p_shipment_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired conversations
CREATE OR REPLACE FUNCTION cleanup_expired_conversations()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete conversations that have expired beyond grace period
    DELETE FROM conversations 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view their own conversations"
ON conversations FOR SELECT
USING (
    auth.uid() = client_id OR 
    auth.uid() = driver_id OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "No direct insert into conversations"
ON conversations FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct update of conversations"
ON conversations FOR UPDATE
USING (false);

CREATE POLICY "No direct delete of conversations"
ON conversations FOR DELETE
USING (false);

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their conversations"
ON messages FOR SELECT
USING (can_access_conversation(conversation_id));

CREATE POLICY "No direct insert into messages"
ON messages FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct update of messages"
ON messages FOR UPDATE
USING (false);

CREATE POLICY "No direct delete of messages"
ON messages FOR DELETE
USING (false);

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON conversations TO authenticated;
GRANT SELECT ON messages TO authenticated;
GRANT EXECUTE ON FUNCTION send_message_v2(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_messages_v2(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_conversations_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_message_as_read_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_by_shipment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_access_conversation(UUID, UUID) TO authenticated;

-- Create a scheduled job to cleanup expired conversations (run daily)
-- This would typically be done via cron or a similar scheduler
-- SELECT cron.schedule('cleanup-expired-conversations', '0 2 * * *', 'SELECT cleanup_expired_conversations();');

-- Initial data migration (if needed)
-- This would move existing data from old messages table to new structure
-- We'll skip this for a fresh implementation

COMMIT;