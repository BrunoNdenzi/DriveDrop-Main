-- ============================================================================
-- FIX: Recreate conversation_summaries view with last_message_at
-- ============================================================================
-- Issue: View is missing last_message_at column
-- This script recreates the view with the correct schema
-- ============================================================================

-- Drop existing view
DROP VIEW IF EXISTS conversation_summaries CASCADE;

-- Recreate with all required columns including last_message_at
CREATE OR REPLACE VIEW conversation_summaries AS
SELECT 
    s.id AS shipment_id,
    s.title AS shipment_title,
    s.status AS shipment_status,
    s.client_id,
    s.driver_id,
    
    -- Client info with NULL handling
    COALESCE(
        NULLIF(TRIM(c.first_name || ' ' || c.last_name), ''),
        c.email,
        'Unknown User'
    ) AS client_name,
    c.avatar_url AS client_avatar,
    
    -- Driver info with NULL handling (for unassigned shipments)
    CASE 
        WHEN s.driver_id IS NULL THEN 'No Driver Assigned'
        ELSE COALESCE(
            NULLIF(TRIM(d.first_name || ' ' || d.last_name), ''),
            d.email,
            'Unknown Driver'
        )
    END AS driver_name,
    d.avatar_url AS driver_avatar,
    
    -- Last message content
    (
        SELECT content 
        FROM messages 
        WHERE shipment_id = s.id 
        ORDER BY created_at DESC 
        LIMIT 1
    ) AS last_message_content,
    
    -- Last message timestamp (THIS IS THE MISSING COLUMN!)
    (
        SELECT created_at 
        FROM messages 
        WHERE shipment_id = s.id 
        ORDER BY created_at DESC 
        LIMIT 1
    ) AS last_message_at,
    
    -- Unread count for current user
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
-- VERIFICATION
-- ============================================================================
-- Run this to verify the view has all columns:

-- Check column names
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'conversation_summaries'
ORDER BY ordinal_position;

-- Test query (should work without errors)
SELECT 
    shipment_id,
    shipment_title,
    client_name,
    driver_name,
    last_message_content,
    last_message_at,  -- This should now exist!
    unread_count
FROM conversation_summaries
LIMIT 5;

-- ============================================================================
-- Expected columns in conversation_summaries:
-- 1. shipment_id
-- 2. shipment_title
-- 3. shipment_status
-- 4. client_id
-- 5. driver_id
-- 6. client_name
-- 7. client_avatar
-- 8. driver_name
-- 9. driver_avatar
-- 10. last_message_content
-- 11. last_message_at       <-- THIS WAS MISSING!
-- 12. unread_count
-- ============================================================================
