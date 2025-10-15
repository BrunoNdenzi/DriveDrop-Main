-- ============================================================================
-- FIX MESSAGING ERRORS - Critical Patches
-- ============================================================================
-- This fixes 4 critical issues:
-- 1. "Unknown Driver" display issue (NULL name handling)
-- 2. Aggregate functions error in mark_shipment_messages_read
-- 3. Invalid UUID error for undefined otherUserId
-- 4. RLS policy violation when sending messages to unassigned shipments
-- ============================================================================

-- ISSUE 1 & 3: Fix conversation view to handle NULL names and NULL driver_id
-- ============================================================================
DROP VIEW IF EXISTS conversation_summaries;

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

GRANT SELECT ON conversation_summaries TO authenticated;

-- ISSUE 2: Fix aggregate function error in mark_shipment_messages_read
-- ============================================================================
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
    
    -- Correct way to get row count in PostgreSQL
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    RETURN COALESCE(v_updated_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ISSUE 4: Fix RLS policy to allow NULL receiver_id (unassigned shipments)
-- ============================================================================
DROP POLICY IF EXISTS "Users can send messages" ON messages;

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

-- ============================================================================
-- VERIFICATION QUERIES (Optional - run to verify fixes)
-- ============================================================================

-- Check conversation view works
-- SELECT * FROM conversation_summaries LIMIT 5;

-- Check function works
-- SELECT mark_shipment_messages_read('your-shipment-uuid-here');

-- Check RLS policy
-- SELECT * FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can send messages';

-- ============================================================================
-- DONE! All messaging errors should now be fixed
-- ============================================================================
