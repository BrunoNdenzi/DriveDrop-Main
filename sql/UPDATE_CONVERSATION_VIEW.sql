-- ============================================================================
-- QUICK FIX: Update conversation_summaries view with NULL name handling
-- ============================================================================
-- Run this in Supabase SQL Editor if you already ran the main migration
-- This fixes the "Unknown User" issue by adding COALESCE for NULL names
-- ============================================================================

-- Drop and recreate the view with proper NULL handling
DROP VIEW IF EXISTS conversation_summaries;

CREATE OR REPLACE VIEW conversation_summaries AS
SELECT 
    s.id AS shipment_id,
    s.title AS shipment_title,
    s.status AS shipment_status,
    s.client_id,
    s.driver_id,
    COALESCE(c.first_name || ' ' || c.last_name, c.email, 'Unknown User') AS client_name,
    c.avatar_url AS client_avatar,
    COALESCE(d.first_name || ' ' || d.last_name, d.email, 'Unknown Driver') AS driver_name,
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

-- Grant permissions
GRANT SELECT ON conversation_summaries TO authenticated;

-- ============================================================================
-- DONE! Now refresh your app and the names should appear correctly
-- ============================================================================
