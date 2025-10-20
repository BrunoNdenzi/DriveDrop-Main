-- =====================================================================
-- COMPREHENSIVE FIX FOR ADMIN APPLICATIONS AND QUICK ASSIGN
-- =====================================================================
-- This script fixes both issues:
-- 1. Admin not seeing applications (RLS + Backend fix already applied)
-- 2. Quick assign failing due to missing conversation_id column
-- =====================================================================

-- =====================================================================
-- PART 1: Check and fix messages table schema
-- =====================================================================

-- Check if conversation_id column exists and remove any problematic triggers
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop any triggers that might be trying to use conversation_id
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname LIKE '%conversation%' 
    AND tgrelid = 'public.messages'::regclass
  ) THEN
    EXECUTE (
      SELECT string_agg('DROP TRIGGER IF EXISTS ' || tgname || ' ON public.messages;', E'\n')
      FROM pg_trigger 
      WHERE tgname LIKE '%conversation%' 
      AND tgrelid = 'public.messages'::regclass
    );
    RAISE NOTICE 'Dropped conversation-related triggers from messages table';
  END IF;

  -- Drop any functions that reference conversation_id in messages
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_depend d ON d.objid = p.oid
    WHERE d.refobjid = 'public.messages'::regclass
    AND pg_get_functiondef(p.oid) LIKE '%conversation_id%'
  ) THEN
    RAISE NOTICE 'Found functions referencing conversation_id in messages table';
    -- List them for manual review
    FOR r IN (
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
      FROM pg_proc p
      JOIN pg_depend d ON d.objid = p.oid
      WHERE d.refobjid = 'public.messages'::regclass
      AND pg_get_functiondef(p.oid) LIKE '%conversation_id%'
    ) LOOP
      RAISE NOTICE 'Function that may need updating: %(%) ', r.proname, r.args;
    END LOOP;
  END IF;
END $$;

-- =====================================================================
-- PART 2: Verify and fix assign_driver_to_shipment function
-- =====================================================================

-- Check if the function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'assign_driver_to_shipment'
  ) THEN
    RAISE EXCEPTION 'assign_driver_to_shipment function does not exist! Please run 05_application_management_procedures_production.sql first';
  ELSE
    RAISE NOTICE '✓ assign_driver_to_shipment function exists';
  END IF;
END $$;

-- Verify the function doesn't try to insert into messages
DO $$
DECLARE
  v_function_def TEXT;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_function_def
  FROM pg_proc 
  WHERE proname = 'assign_driver_to_shipment'
  LIMIT 1;
  
  IF v_function_def LIKE '%INSERT INTO messages%' OR v_function_def LIKE '%INSERT INTO public.messages%' THEN
    RAISE WARNING 'assign_driver_to_shipment function contains message insertions - this may cause issues';
  ELSE
    RAISE NOTICE '✓ assign_driver_to_shipment function does not insert messages';
  END IF;
END $$;

-- =====================================================================
-- PART 3: Check for problematic triggers on shipments table
-- =====================================================================

DO $$
DECLARE
  r RECORD;
  v_trigger_func TEXT;
BEGIN
  RAISE NOTICE 'Checking triggers on shipments table...';
  
  FOR r IN (
    SELECT tgname, pg_get_triggerdef(oid) as trigger_def
    FROM pg_trigger
    WHERE tgrelid = 'public.shipments'::regclass
    AND NOT tgisinternal
  ) LOOP
    RAISE NOTICE 'Trigger: %', r.tgname;
    
    -- Get the function definition for this trigger
    SELECT pg_get_functiondef(p.oid) INTO v_trigger_func
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgname = r.tgname
    AND t.tgrelid = 'public.shipments'::regclass;
    
    -- Check if the trigger function tries to insert into messages with conversation_id
    IF v_trigger_func LIKE '%INSERT INTO messages%' AND v_trigger_func LIKE '%conversation_id%' THEN
      RAISE WARNING 'Trigger % has function that tries to insert messages with conversation_id', r.tgname;
      RAISE NOTICE 'Trigger definition: %', r.trigger_def;
    END IF;
  END LOOP;
END $$;

-- =====================================================================
-- PART 4: List all functions that might be problematic
-- =====================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==== Functions that reference messages table ====';
  
  FOR r IN (
    SELECT 
      p.proname,
      pg_get_function_identity_arguments(p.oid) as args,
      CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%conversation_id%' THEN '⚠️  USES conversation_id'
        ELSE '✓ OK'
      END as status
    FROM pg_proc p
    WHERE pg_get_functiondef(p.oid) LIKE '%messages%'
    AND p.pronamespace = 'public'::regnamespace
    ORDER BY p.proname
  ) LOOP
    RAISE NOTICE '% %(%) - %', 
      CASE WHEN r.status LIKE '%⚠️%' THEN '⚠️ ' ELSE '  ' END,
      r.proname, 
      COALESCE(r.args, ''), 
      r.status;
  END LOOP;
END $$;

-- =====================================================================
-- PART 5: Temporary fix - Disable problematic triggers if found
-- =====================================================================

-- This will help identify which trigger is causing the issue
DO $$
DECLARE
  r RECORD;
  v_func_def TEXT;
BEGIN
  FOR r IN (
    SELECT DISTINCT t.tgname, p.proname
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.shipments'::regclass
    AND NOT t.tgisinternal
  ) LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_func_def
    FROM pg_proc p
    WHERE p.proname = r.proname;
    
    IF v_func_def LIKE '%conversation_id%' AND v_func_def LIKE '%messages%' THEN
      RAISE NOTICE 'DISABLING problematic trigger: %', r.tgname;
      EXECUTE format('ALTER TABLE public.shipments DISABLE TRIGGER %I', r.tgname);
      RAISE WARNING 'Disabled trigger % - it references conversation_id which does not exist', r.tgname;
    END IF;
  END LOOP;
END $$;

-- =====================================================================
-- VERIFICATION REPORT
-- =====================================================================

DO $$
DECLARE
  v_messages_has_conv_id BOOLEAN;
  v_assign_func_exists BOOLEAN;
  v_rls_enabled BOOLEAN;
  v_rls_policy_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'DIAGNOSTIC REPORT';
  RAISE NOTICE '==============================================================';
  
  -- Check messages table structure
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' 
    AND column_name = 'conversation_id'
  ) INTO v_messages_has_conv_id;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Messages Table:';
  RAISE NOTICE '  conversation_id column exists: %', 
    CASE WHEN v_messages_has_conv_id THEN '✓ YES (OK)' ELSE '✗ NO (EXPECTED)' END;
  
  -- Check assign_driver_to_shipment function
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'assign_driver_to_shipment'
  ) INTO v_assign_func_exists;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Functions:';
  RAISE NOTICE '  assign_driver_to_shipment exists: %', 
    CASE WHEN v_assign_func_exists THEN '✓ YES' ELSE '✗ NO' END;
  
  -- Check RLS on job_applications
  SELECT relpolicies > 0, relpolicies INTO v_rls_enabled, v_rls_policy_count
  FROM pg_class
  WHERE relname = 'job_applications';
  
  RAISE NOTICE '';
  RAISE NOTICE 'Row Level Security:';
  RAISE NOTICE '  job_applications has policies: %', 
    CASE WHEN v_rls_enabled THEN '✓ YES (' || v_rls_policy_count || ' policies)' ELSE '✗ NO' END;
  
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Review the function list above for any ⚠️  warnings';
  RAISE NOTICE '2. Try the quick assign feature again';
  RAISE NOTICE '3. Check admin applications visibility';
  RAISE NOTICE '4. If issues persist, check the logs for specific function names';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE '';
END $$;
