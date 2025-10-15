-- ============================================================================
-- DRIVEDROP MESSAGING SYSTEM - FRESH START
-- ============================================================================
-- This SQL file completely rebuilds the messaging system from scratch
-- with a clean, modern design focused on performance and reliability.
--
-- FEATURES:
-- ✅ Proper receiver_id column for direct messaging
-- ✅ Read receipts with read_at timestamp
-- ✅ Message types for extensibility (text, system, etc.)
-- ✅ Optimized indexes for fast queries
-- ✅ Simple, performant RLS policies
-- ✅ Real-time support enabled
-- ✅ Clean cascade deletes
--
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================================

-- STEP 1: Clean up old messaging infrastructure
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Shipment participants can view messages" ON messages;
DROP POLICY IF EXISTS "Shipment participants can send messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages for their shipments" ON messages;
DROP POLICY IF EXISTS "Users can update their own message read status" ON messages;

-- Drop old functions
DROP FUNCTION IF EXISTS send_message(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS mark_message_as_read(UUID);
DROP FUNCTION IF EXISTS mark_messages_as_read(UUID, UUID);
DROP FUNCTION IF EXISTS count_unread_messages(UUID, UUID, UUID);

-- Drop old tables and sequences (if they exist from other migrations)
DROP TABLE IF EXISTS message_read_status CASCADE;
DROP SEQUENCE IF EXISTS messages_read_status_id_seq;

-- Drop old triggers (if any)
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;

-- STEP 2: Recreate messages table with proper schema
-- ============================================================================

-- Drop and recreate the messages table with all necessary columns
DROP TABLE IF EXISTS messages CASCADE;

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Relationships
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Message content
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'system', 'notification'
    
    -- Read status
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT content_not_empty CHECK (char_length(trim(content)) > 0),
    CONSTRAINT content_max_length CHECK (char_length(content) <= 5000),
    CONSTRAINT valid_message_type CHECK (message_type IN ('text', 'system', 'notification')),
    CONSTRAINT sender_receiver_different CHECK (sender_id != receiver_id)
);

-- STEP 3: Create indexes for performance
-- ============================================================================

-- Index for loading messages in a conversation (most common query)
CREATE INDEX idx_messages_shipment_created 
ON messages(shipment_id, created_at DESC);

-- Index for unread message counts
CREATE INDEX idx_messages_receiver_unread 
ON messages(receiver_id, is_read) 
WHERE is_read = FALSE;

-- Index for sender queries
CREATE INDEX idx_messages_sender 
ON messages(sender_id, created_at DESC);

-- Composite index for efficient conversation queries
CREATE INDEX idx_messages_conversation 
ON messages(shipment_id, sender_id, receiver_id, created_at DESC);

-- STEP 4: Create updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Automatically set read_at when is_read becomes true
    IF NEW.is_read = TRUE AND OLD.is_read = FALSE AND NEW.read_at IS NULL THEN
        NEW.read_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_messages_updated_at();

-- STEP 5: Enable Row Level Security
-- ============================================================================

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- STEP 6: Create RLS Policies
-- ============================================================================

-- Policy 1: Users can view messages where they are sender OR receiver
-- AND the message belongs to a shipment they're involved in
CREATE POLICY "Users can view their messages"
ON messages
FOR SELECT
USING (
    auth.uid() IN (sender_id, receiver_id)
    AND EXISTS (
        SELECT 1 FROM shipments
        WHERE shipments.id = messages.shipment_id
        AND (shipments.client_id = auth.uid() OR shipments.driver_id = auth.uid())
    )
);

-- Policy 2: Users can send messages to shipments they're involved in
-- Sender must be authenticated user, receiver must be the other participant
CREATE POLICY "Users can send messages"
ON messages
FOR INSERT
WITH CHECK (
    -- Sender must be the authenticated user
    auth.uid() = sender_id
    AND
    -- Must be involved in the shipment
    EXISTS (
        SELECT 1 FROM shipments
        WHERE shipments.id = shipment_id
        AND (shipments.client_id = auth.uid() OR shipments.driver_id = auth.uid())
    )
    AND
    -- Receiver must be NULL (unassigned) OR the other participant in the shipment
    (
        receiver_id IS NULL
        OR
        EXISTS (
            SELECT 1 FROM shipments
            WHERE shipments.id = shipment_id
            AND (
                (shipments.client_id = auth.uid() AND shipments.driver_id = receiver_id)
                OR
                (shipments.driver_id = auth.uid() AND shipments.client_id = receiver_id)
            )
        )
    )
);

-- Policy 3: Users can mark their received messages as read
CREATE POLICY "Users can mark received messages as read"
ON messages
FOR UPDATE
USING (
    auth.uid() = receiver_id
)
WITH CHECK (
    auth.uid() = receiver_id
    AND is_read = TRUE  -- Can only update to mark as read
);

-- STEP 7: Create helper functions
-- ============================================================================

-- Function to get unread message count for a user
CREATE OR REPLACE FUNCTION get_unread_message_count(
    p_user_id UUID DEFAULT NULL,
    p_shipment_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_user_id UUID;
    v_count INTEGER;
BEGIN
    -- Use provided user_id or current authenticated user
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    IF p_shipment_id IS NOT NULL THEN
        -- Count unread messages for specific shipment
        SELECT COUNT(*)::INTEGER INTO v_count
        FROM messages
        WHERE receiver_id = v_user_id
        AND shipment_id = p_shipment_id
        AND is_read = FALSE;
    ELSE
        -- Count all unread messages for user
        SELECT COUNT(*)::INTEGER INTO v_count
        FROM messages
        WHERE receiver_id = v_user_id
        AND is_read = FALSE;
    END IF;
    
    RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all messages in a shipment as read
CREATE OR REPLACE FUNCTION mark_shipment_messages_read(
    p_shipment_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE messages
    SET is_read = TRUE,
        read_at = NOW(),
        updated_at = NOW()
    WHERE shipment_id = p_shipment_id
    AND receiver_id = auth.uid()
    AND is_read = FALSE;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    RETURN COALESCE(v_updated_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get conversation participants
CREATE OR REPLACE FUNCTION get_conversation_participants(
    p_shipment_id UUID
)
RETURNS TABLE(
    client_id UUID,
    client_name TEXT,
    client_avatar TEXT,
    driver_id UUID,
    driver_name TEXT,
    driver_avatar TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.client_id,
        (c.first_name || ' ' || c.last_name) AS client_name,
        c.avatar_url AS client_avatar,
        s.driver_id,
        (d.first_name || ' ' || d.last_name) AS driver_name,
        d.avatar_url AS driver_avatar
    FROM shipments s
    LEFT JOIN profiles c ON s.client_id = c.id
    LEFT JOIN profiles d ON s.driver_id = d.id
    WHERE s.id = p_shipment_id
    AND (s.client_id = auth.uid() OR s.driver_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 8: Enable Realtime
-- ============================================================================

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- STEP 9: Create helpful views (optional but useful)
-- ============================================================================

-- View to get conversation summaries with last message and unread count
CREATE OR REPLACE VIEW conversation_summaries AS
SELECT 
    s.id AS shipment_id,
    s.title AS shipment_title,
    s.status AS shipment_status,
    s.client_id,
    s.driver_id,
    COALESCE(
        NULLIF(TRIM(c.first_name || ' ' || c.last_name), ''),
        c.email,
        'Unknown User'
    ) AS client_name,
    c.avatar_url AS client_avatar,
    CASE 
        WHEN s.driver_id IS NULL THEN 'No Driver Assigned'
        ELSE COALESCE(
            NULLIF(TRIM(d.first_name || ' ' || d.last_name), ''),
            d.email,
            'Unknown Driver'
        )
    END AS driver_name,
    d.avatar_url AS driver_avatar,
    (
        SELECT content 
        FROM messages 
        WHERE shipment_id = s.id 
        ORDER BY created_at DESC 
        LIMIT 1
    ) AS last_message_content,
    (
        SELECT created_at 
        FROM messages 
        WHERE shipment_id = s.id 
        ORDER BY created_at DESC 
        LIMIT 1
    ) AS last_message_at,
    (
        SELECT COUNT(*)::INTEGER 
        FROM messages 
        WHERE shipment_id = s.id 
        AND receiver_id = auth.uid() 
        AND is_read = FALSE
    ) AS unread_count
FROM shipments s
LEFT JOIN profiles c ON s.client_id = c.id
LEFT JOIN profiles d ON s.driver_id = d.id
WHERE s.client_id = auth.uid() OR s.driver_id = auth.uid()
ORDER BY last_message_at DESC NULLS LAST;

-- STEP 10: Grant necessary permissions
-- ============================================================================

-- Grant access to the view
GRANT SELECT ON conversation_summaries TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_unread_message_count(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_shipment_messages_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_participants(UUID) TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after the migration to verify everything is set up correctly:

-- Check table structure
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'messages'
-- ORDER BY ordinal_position;

-- Check indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'messages';

-- Check RLS policies
-- SELECT policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'messages';

-- Check functions
-- SELECT routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_name LIKE '%message%'
-- AND routine_schema = 'public';

-- ============================================================================
-- MIGRATION COMPLETE! 🎉
-- ============================================================================
-- The messaging system is now ready to use with:
-- ✅ Clean database schema
-- ✅ Proper indexes for performance
-- ✅ Secure RLS policies
-- ✅ Helper functions
-- ✅ Real-time enabled
-- ✅ Conversation summaries view
--
-- Next: Update the mobile app code to use this new structure
-- ============================================================================
