-- Create a new sequence for tracking message read status
CREATE SEQUENCE IF NOT EXISTS messages_read_status_id_seq;

-- Add real-time notification tables
CREATE TABLE IF NOT EXISTS message_read_status (
    id BIGINT PRIMARY KEY DEFAULT nextval('messages_read_status_id_seq'),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT message_read_status_unique UNIQUE (message_id, user_id)
);

-- Set up a function to mark a message as read
CREATE OR REPLACE FUNCTION mark_message_as_read(p_message_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_message_exists BOOLEAN;
    v_already_read BOOLEAN;
BEGIN
    -- Check if message exists
    SELECT EXISTS (
        SELECT 1 FROM messages WHERE id = p_message_id
    ) INTO v_message_exists;
    
    IF NOT v_message_exists THEN
        RETURN FALSE;
    END IF;
    
    -- Check if already marked as read
    SELECT EXISTS (
        SELECT 1 FROM message_read_status 
        WHERE message_id = p_message_id AND user_id = p_user_id AND is_read = TRUE
    ) INTO v_already_read;
    
    IF v_already_read THEN
        RETURN TRUE; -- Already read, no action needed
    END IF;
    
    -- Insert or update read status
    INSERT INTO message_read_status (message_id, user_id, is_read, read_at)
    VALUES (p_message_id, p_user_id, TRUE, NOW())
    ON CONFLICT (message_id, user_id)
    DO UPDATE SET 
        is_read = TRUE,
        read_at = NOW();
    
    -- Also update the is_read flag in the original messages table
    -- This is for backward compatibility
    UPDATE messages 
    SET is_read = TRUE
    WHERE id = p_message_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to count unread messages
CREATE OR REPLACE FUNCTION count_unread_messages(p_user_id UUID, p_contact_id UUID DEFAULT NULL, p_shipment_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM messages m
    LEFT JOIN message_read_status mrs ON m.id = mrs.message_id AND mrs.user_id = p_user_id
    WHERE (mrs.is_read IS NULL OR mrs.is_read = FALSE)
    AND m.sender_id != p_user_id -- Only count messages sent to the user
    AND (p_contact_id IS NULL OR m.sender_id = p_contact_id)
    AND (p_shipment_id IS NULL OR m.shipment_id = p_shipment_id);
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set up RLS policies for message_read_status
ALTER TABLE message_read_status ENABLE ROW LEVEL SECURITY;

-- Users can only see their own read status
CREATE POLICY read_own_read_status ON message_read_status
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Users can only update their own read status
CREATE POLICY update_own_read_status ON message_read_status
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

-- Users can only insert their own read status
CREATE POLICY insert_own_read_status ON message_read_status
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Allow admin to see all read statuses
CREATE POLICY admin_read_all_read_status ON message_read_status
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
