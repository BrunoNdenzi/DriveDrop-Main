-- ========================================
-- DIAGNOSTIC: Find Actual Table Structure
-- ========================================
-- Run this FIRST to understand your database structure
-- Then we can create the correct fix scripts

-- ========================================
-- 1. List all conversation-related tables and views
-- ========================================
SELECT 
  table_name,
  table_type,
  CASE 
    WHEN table_type = 'VIEW' THEN '📊 View'
    WHEN table_type = 'BASE TABLE' THEN '📁 Table'
    ELSE table_type
  END as type_icon
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%conversation%' OR table_name LIKE '%message%')
ORDER BY table_type, table_name;

-- ========================================
-- 2. Check for junction/pivot tables
-- ========================================
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (
    table_name LIKE '%_users' 
    OR table_name LIKE '%_members'
    OR table_name LIKE '%participant%'
  )
ORDER BY table_name;

-- ========================================
-- 3. Show columns in conversations table
-- ========================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'conversations'
ORDER BY ordinal_position;

-- ========================================
-- 4. Check if there's a messages table structure
-- ========================================
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'messages'
ORDER BY ordinal_position;

-- ========================================
-- 5. Find all SECURITY DEFINER views
-- ========================================
SELECT 
  schemaname,
  viewname,
  viewowner,
  LEFT(definition, 200) as definition_preview  -- First 200 chars
FROM pg_views 
WHERE schemaname = 'public'
  AND definition LIKE '%SECURITY DEFINER%'
ORDER BY viewname;

-- ========================================
-- 6. Alternative: Check pg_views for the problematic views
-- ========================================
SELECT 
  viewname,
  definition
FROM pg_views 
WHERE schemaname = 'public'
  AND viewname IN ('conversation_participants', 'conversation_summaries', 'shipment_applications_view')
ORDER BY viewname;

-- ========================================
-- 7. Find relationships (foreign keys)
-- ========================================
SELECT
    tc.table_name as from_table,
    kcu.column_name as from_column,
    ccu.table_name AS to_table,
    ccu.column_name AS to_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
  AND (tc.table_name LIKE '%conversation%' OR tc.table_name LIKE '%message%')
ORDER BY tc.table_name;

-- ========================================
-- RESULTS INTERPRETATION GUIDE
-- ========================================
/*
After running this, you should see:

SCENARIO A: If you see a table like "conversations_users" or "conversation_members"
  → This is your junction table for many-to-many relationship
  → Use this table name in the fix scripts

SCENARIO B: If conversations table has columns like "client_id" and "driver_id"
  → Participants are stored as direct columns
  → We need a different approach (UNION query)

SCENARIO C: If you see only the VIEW "conversation_participants"
  → Check the view definition to see what table it queries
  → Copy the output from query #6 above

NEXT STEPS:
1. Run all queries above
2. Copy the results
3. Share with me so I can create the correct fix script
4. Or use the template below based on your scenario
*/

-- ========================================
-- QUICK FIX TEMPLATES (use after diagnosis)
-- ========================================

-- Template A: If you have conversations_users table
/*
DROP VIEW IF EXISTS public.conversation_participants CASCADE;
CREATE VIEW public.conversation_participants AS
SELECT 
  cu.conversation_id,
  cu.user_id,
  u.full_name,
  u.email
FROM conversations_users cu
INNER JOIN users u ON cu.user_id = u.id
WHERE cu.user_id = auth.uid();
*/

-- Template B: If conversations has client_id and driver_id columns
/*
DROP VIEW IF EXISTS public.conversation_participants CASCADE;
CREATE VIEW public.conversation_participants AS
SELECT DISTINCT
  c.id as conversation_id,
  u.id as user_id,
  u.full_name,
  u.email
FROM conversations c
CROSS JOIN users u
WHERE (c.client_id = u.id OR c.driver_id = u.id)
  AND (c.client_id = auth.uid() OR c.driver_id = auth.uid());
*/

-- Template C: If messages table has sender_id/recipient_id
/*
DROP VIEW IF EXISTS public.conversation_participants CASCADE;
CREATE VIEW public.conversation_participants AS
SELECT DISTINCT
  m.conversation_id,
  u.id as user_id,
  u.full_name,
  u.email
FROM messages m
CROSS JOIN users u
WHERE (m.sender_id = u.id OR m.recipient_id = u.id)
  AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid());
*/
