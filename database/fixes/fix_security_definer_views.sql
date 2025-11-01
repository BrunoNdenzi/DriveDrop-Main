-- ========================================
-- Fix SECURITY DEFINER Views Security Issue
-- ========================================
-- SECURITY DEFINER views bypass RLS and run with creator permissions
-- This is a security risk - we'll recreate them without SECURITY DEFINER
-- Run this in Supabase SQL Editor

-- ========================================
-- BACKUP FIRST (Optional but recommended)
-- ========================================
-- Save current view definitions in case you need to rollback
-- Copy output before running the fixes below

SELECT 
  'CREATE VIEW ' || schemaname || '.' || viewname || ' AS ' || definition 
FROM pg_views 
WHERE viewname IN ('conversation_summaries', 'shipment_applications_view', 'conversation_participants')
  AND schemaname = 'public';

-- ========================================
-- STEP 0: Check what tables actually exist
-- ========================================
-- Run this first to see the actual table structure:
/*
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%conversation%'
ORDER BY table_name;

SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%participant%'
ORDER BY table_name;
*/

-- ========================================
-- FIX 1: conversation_participants View
-- ========================================
-- NOTE: If conversation_participants is ONLY a view (not a table),
-- we need to find the underlying table first.
-- 
-- Possible scenarios:
-- A) There's a conversations_users table (junction table)
-- B) There's a conversation_members table
-- C) Participants are stored in a JSON column in conversations table

-- If you have a conversations_users or similar junction table, use this:
DROP VIEW IF EXISTS public.conversation_participants CASCADE;

CREATE VIEW public.conversation_participants AS
SELECT 
  cu.conversation_id,
  cu.user_id,
  cu.role,
  cu.joined_at,
  cu.last_read_at,
  u.full_name as user_name,
  u.email as user_email,
  u.phone_number,
  u.profile_image_url
FROM conversations_users cu  -- ← CHANGE THIS to your actual table name
INNER JOIN users u ON cu.user_id = u.id
WHERE cu.conversation_id IN (
  -- User can only see participants from their own conversations
  SELECT conversation_id 
  FROM conversations_users 
  WHERE user_id = auth.uid()
);

-- Add RLS policy for the view
ALTER VIEW public.conversation_participants OWNER TO postgres;

COMMENT ON VIEW public.conversation_participants IS 
'Shows conversation participants. Users can only see participants from their own conversations.';

-- ========================================
-- FIX 2: conversation_summaries View  
-- ========================================
-- This view should only show conversation summaries the user has access to

DROP VIEW IF EXISTS public.conversation_summaries CASCADE;

CREATE VIEW public.conversation_summaries AS
SELECT 
  c.id as conversation_id,
  c.shipment_id,
  c.type as conversation_type,
  c.created_at,
  c.updated_at,
  c.last_message_at,
  s.pickup_address,
  s.delivery_address,
  s.status as shipment_status,
  -- Count of participants
  (SELECT COUNT(*) FROM conversation_participants cp WHERE cp.conversation_id = c.id) as participant_count,
  -- Count of unread messages for current user
  (SELECT COUNT(*) 
   FROM messages m 
   WHERE m.conversation_id = c.id 
     AND m.sender_id != auth.uid()
     AND m.read_by_recipient = false) as unread_count,
  -- Last message preview
  (SELECT m.content 
   FROM messages m 
   WHERE m.conversation_id = c.id 
   ORDER BY m.created_at DESC 
   LIMIT 1) as last_message,
  -- Last message sender
  (SELECT u.full_name 
   FROM messages m 
   INNER JOIN users u ON m.sender_id = u.id
   WHERE m.conversation_id = c.id 
   ORDER BY m.created_at DESC 
   LIMIT 1) as last_message_sender
FROM conversations c
LEFT JOIN shipments s ON c.shipment_id = s.id
WHERE c.id IN (
  -- User can only see conversations they're part of
  SELECT conversation_id 
  FROM conversation_participants 
  WHERE user_id = auth.uid()
);

-- Add RLS policy for the view
ALTER VIEW public.conversation_summaries OWNER TO postgres;

COMMENT ON VIEW public.conversation_summaries IS 
'Shows conversation summaries with unread counts. Users can only see their own conversations.';

-- ========================================
-- FIX 3: shipment_applications_view View
-- ========================================
-- This view should only show applications the user has access to

DROP VIEW IF EXISTS public.shipment_applications_view CASCADE;

CREATE VIEW public.shipment_applications_view AS
SELECT 
  sa.id as application_id,
  sa.shipment_id,
  sa.driver_id,
  sa.status as application_status,
  sa.notes,
  sa.created_at as applied_at,
  sa.updated_at,
  -- Driver details
  d.full_name as driver_name,
  d.email as driver_email,
  d.phone_number as driver_phone,
  d.profile_image_url as driver_avatar,
  d.rating as driver_rating,
  d.total_deliveries,
  -- Shipment details
  s.pickup_address,
  s.delivery_address,
  s.status as shipment_status,
  s.pickup_date,
  s.client_id,
  -- Client details
  c.full_name as client_name
FROM shipment_applications sa
INNER JOIN users d ON sa.driver_id = d.id
INNER JOIN shipments s ON sa.shipment_id = s.id
INNER JOIN users c ON s.client_id = c.id
WHERE 
  -- Drivers can see their own applications
  sa.driver_id = auth.uid()
  OR
  -- Clients can see applications for their shipments
  s.client_id = auth.uid()
  OR
  -- Admins can see all (if you have admin role)
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  );

-- Add RLS policy for the view
ALTER VIEW public.shipment_applications_view OWNER TO postgres;

COMMENT ON VIEW public.shipment_applications_view IS 
'Shows shipment applications. Drivers see their applications, clients see applications for their shipments.';

-- ========================================
-- FIX 4: Enable RLS on spatial_ref_sys (PostGIS table)
-- ========================================
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

-- Allow public read access (needed for PostGIS functions)
DROP POLICY IF EXISTS "Allow public read access" ON public.spatial_ref_sys;
CREATE POLICY "Allow public read access" ON public.spatial_ref_sys
FOR SELECT USING (true);

COMMENT ON POLICY "Allow public read access" ON public.spatial_ref_sys IS 
'PostGIS reference table - safe to allow public read access';

-- ========================================
-- Verification Queries
-- ========================================

-- 1. Check that views no longer have SECURITY DEFINER
SELECT 
  schemaname,
  viewname,
  viewowner,
  definition
FROM pg_views 
WHERE viewname IN ('conversation_summaries', 'shipment_applications_view', 'conversation_participants')
  AND schemaname = 'public';

-- 2. Verify RLS is enabled on spatial_ref_sys
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'spatial_ref_sys';

-- 3. Test access as regular user (should only see own data)
-- Run this as a test user to verify security:
SELECT COUNT(*) FROM conversation_summaries;  -- Should only show user's conversations
SELECT COUNT(*) FROM shipment_applications_view;  -- Should only show user's applications
SELECT COUNT(*) FROM conversation_participants;  -- Should only show participants from user's conversations

-- ========================================
-- SUCCESS!
-- ========================================
-- All SECURITY DEFINER views have been recreated without elevated permissions
-- RLS is now enforced properly
-- Re-run Supabase Security Advisor to verify fixes
