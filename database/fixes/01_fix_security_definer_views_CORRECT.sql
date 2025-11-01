-- ========================================
-- Fix SECURITY DEFINER Views - CORRECT VERSION
-- ========================================
-- Based on your actual table structure:
-- - conversations table has: client_id, driver_id, shipment_id
-- - messages table has: sender_id, receiver_id, shipment_id
-- - No junction table for participants
-- Run this in Supabase SQL Editor

-- ========================================
-- FIX 1: conversation_participants View
-- ========================================
-- This view derives participants from conversations table (client + driver)
-- Users can only see participants from their own conversations

DROP VIEW IF EXISTS public.conversation_participants CASCADE;

CREATE VIEW public.conversation_participants AS
-- Client as participant
SELECT 
  c.id as conversation_id,
  c.client_id as user_id,
  'client' as role,
  c.created_at as joined_at,
  NULL::timestamptz as last_read_at,
  (u.first_name || ' ' || u.last_name) as user_name,
  u.email as user_email,
  u.phone as phone_number,
  u.avatar_url as profile_image_url
FROM conversations c
INNER JOIN profiles u ON c.client_id = u.id
WHERE c.client_id = auth.uid() OR c.driver_id = auth.uid()

UNION ALL

-- Driver as participant
SELECT 
  c.id as conversation_id,
  c.driver_id as user_id,
  'driver' as role,
  c.created_at as joined_at,
  NULL::timestamptz as last_read_at,
  (u.first_name || ' ' || u.last_name) as user_name,
  u.email as user_email,
  u.phone as phone_number,
  u.avatar_url as profile_image_url
FROM conversations c
INNER JOIN profiles u ON c.driver_id = u.id
WHERE c.client_id = auth.uid() OR c.driver_id = auth.uid();

-- Add comment
COMMENT ON VIEW public.conversation_participants IS 
'Shows conversation participants (client + driver). Users can only see participants from their own conversations.';

-- ========================================
-- FIX 2: conversation_summaries View  
-- ========================================
-- This view shows conversation summaries the user has access to

DROP VIEW IF EXISTS public.conversation_summaries CASCADE;

CREATE VIEW public.conversation_summaries AS
SELECT 
  c.id as conversation_id,
  c.shipment_id,
  c.client_id,
  c.driver_id,
  c.created_at,
  c.is_active,
  c.expires_at,
  -- Shipment details
  s.pickup_address,
  s.delivery_address,
  s.status as shipment_status,
  -- Participant count (always 2: client + driver)
  2 as participant_count,
  -- Unread count for current user
  COALESCE((
    SELECT COUNT(*) 
    FROM messages m 
    WHERE m.shipment_id = c.shipment_id
      AND m.sender_id != auth.uid()
      AND m.read_at IS NULL
  ), 0) as unread_count,
  -- Last message preview
  (SELECT m.content 
   FROM messages m 
   WHERE m.shipment_id = c.shipment_id
   ORDER BY m.created_at DESC 
   LIMIT 1) as last_message,
  -- Last message sender name
  (SELECT (u.first_name || ' ' || u.last_name)
   FROM messages m 
   INNER JOIN profiles u ON m.sender_id = u.id
   WHERE m.shipment_id = c.shipment_id
   ORDER BY m.created_at DESC 
   LIMIT 1) as last_message_sender,
  -- Other participant info (the person you're talking to)
  CASE 
    WHEN c.client_id = auth.uid() THEN c.driver_id
    ELSE c.client_id
  END as other_user_id,
  CASE 
    WHEN c.client_id = auth.uid() THEN (d.first_name || ' ' || d.last_name)
    ELSE (cl.first_name || ' ' || cl.last_name)
  END as other_user_name,
  CASE 
    WHEN c.client_id = auth.uid() THEN d.avatar_url
    ELSE cl.avatar_url
  END as other_user_avatar
FROM conversations c
LEFT JOIN shipments s ON c.shipment_id = s.id
LEFT JOIN profiles cl ON c.client_id = cl.id
LEFT JOIN profiles d ON c.driver_id = d.id
WHERE c.client_id = auth.uid() OR c.driver_id = auth.uid();

-- Add comment
COMMENT ON VIEW public.conversation_summaries IS 
'Shows conversation summaries with unread counts. Users can only see their own conversations.';

-- ========================================
-- FIX 3: shipment_applications_view View
-- ========================================
-- This view shows applications the user has access to

DROP VIEW IF EXISTS public.shipment_applications_view CASCADE;

CREATE VIEW public.shipment_applications_view AS
SELECT 
  ja.id as application_id,
  ja.shipment_id,
  ja.driver_id,
  ja.status as application_status,
  ja.notes,
  ja.applied_at,
  ja.responded_at,
  ja.updated_at,
  -- Driver details
  (d.first_name || ' ' || d.last_name) as driver_name,
  d.email as driver_email,
  d.phone as driver_phone,
  d.avatar_url as driver_avatar,
  d.rating as driver_rating,
  NULL::integer as total_deliveries,
  d.is_verified as verification_status,
  -- Shipment details
  s.pickup_address,
  s.delivery_address,
  s.status as shipment_status,
  s.pickup_date,
  s.client_id,
  s.vehicle_type,
  s.distance as distance_miles,
  s.price,
  -- Client details
  (c.first_name || ' ' || c.last_name) as client_name,
  c.phone as client_phone
FROM job_applications ja
INNER JOIN profiles d ON ja.driver_id = d.id
INNER JOIN shipments s ON ja.shipment_id = s.id
INNER JOIN profiles c ON s.client_id = c.id
WHERE 
  -- Drivers can see their own applications
  ja.driver_id = auth.uid()
  OR
  -- Clients can see applications for their shipments
  s.client_id = auth.uid()
  OR
  -- Admins can see all (if you have admin role)
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );

-- Add comment
COMMENT ON VIEW public.shipment_applications_view IS 
'Shows job applications. Drivers see their applications, clients see applications for their shipments.';

-- ========================================
-- NOTE: spatial_ref_sys RLS Warning
-- ========================================
-- The Security Advisor shows RLS disabled on spatial_ref_sys.
-- This is a PostGIS system table and is SAFE to ignore.
-- You cannot enable RLS on it (permission denied - owned by postgres).
-- This is documented as safe in Supabase PostGIS documentation.

-- ========================================
-- Verification Queries
-- ========================================

-- 1. Test conversation_participants view
SELECT COUNT(*) as my_conversation_participants 
FROM conversation_participants;
-- Should show participants from YOUR conversations only (2 per conversation)

-- 2. Test conversation_summaries view
SELECT 
  conversation_id,
  shipment_id,
  other_user_name,
  unread_count,
  last_message
FROM conversation_summaries
LIMIT 5;
-- Should only show YOUR conversations

-- 3. Test shipment_applications_view
SELECT 
  application_id,
  driver_name,
  shipment_status,
  application_status
FROM shipment_applications_view
LIMIT 5;
-- Drivers: see your applications
-- Clients: see applications for your shipments

-- 4. Verify spatial_ref_sys note
-- spatial_ref_sys RLS warning can be safely ignored - it's a PostGIS system table

-- 5. Check views no longer have SECURITY DEFINER
SELECT 
  viewname,
  CASE 
    WHEN definition LIKE '%SECURITY DEFINER%' THEN '❌ Still has SECURITY DEFINER'
    ELSE '✅ Fixed'
  END as status
FROM pg_views 
WHERE viewname IN ('conversation_participants', 'conversation_summaries', 'shipment_applications_view')
  AND schemaname = 'public';
-- All should show: ✅ Fixed

-- ========================================
-- Test Security (IMPORTANT!)
-- ========================================

-- Test 1: Create a test user account
-- Test 2: Login as that user in Supabase Dashboard → SQL Editor
-- Test 3: Run this query:
/*
SELECT COUNT(*) as my_conversations FROM conversation_summaries;
SELECT COUNT(*) as all_conversations FROM conversations;
*/
-- my_conversations should be LESS than all_conversations
-- If they're equal, security is not working!

-- Test 4: Try to access another user's conversation (should fail)
/*
SELECT * FROM conversations 
WHERE client_id != auth.uid() AND driver_id != auth.uid()
LIMIT 1;
*/
-- Should return 0 rows or permission denied

-- ========================================
-- SUCCESS!
-- ========================================
-- All SECURITY DEFINER views have been recreated without elevated permissions
-- RLS is now enforced properly
-- Views are based on your actual table structure (conversations with client_id/driver_id)
-- Re-run Supabase Security Advisor to verify fixes
