-- =====================================================================
-- QUICK ASSIGN FIX - SIMPLE DIAGNOSTIC
-- =====================================================================
-- This script diagnoses the conversation_id error in a simpler way
-- =====================================================================

-- =====================================================================
-- PART 1: Basic Checks
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'DIAGNOSTIC REPORT - QUICK ASSIGN ISSUE';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE '';
END $$;

-- Check 1: Does conversation_id column exist?
DO $$
DECLARE
  v_has_column BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'messages' 
    AND column_name = 'conversation_id'
  ) INTO v_has_column;
  
  RAISE NOTICE 'Check 1: Messages table structure';
  RAISE NOTICE '  conversation_id column exists: %', 
    CASE WHEN v_has_column THEN '✓ YES' ELSE '✗ NO (EXPECTED - column should not exist)' END;
  
  IF v_has_column THEN
    RAISE NOTICE '  ⚠️  WARNING: conversation_id column exists but should not!';
  END IF;
END $$;

-- Check 2: Does assign_driver_to_shipment function exist?
DO $$
DECLARE
  v_func_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'assign_driver_to_shipment'
  ) INTO v_func_exists;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Check 2: Required functions';
  RAISE NOTICE '  assign_driver_to_shipment exists: %', 
    CASE WHEN v_func_exists THEN '✓ YES' ELSE '✗ NO (PROBLEM!)' END;
END $$;

-- Check 3: List triggers on shipments table
DO $$
DECLARE
  r RECORD;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Check 3: Triggers on shipments table';
  
  FOR r IN (
    SELECT t.tgname, t.tgenabled
    FROM pg_trigger t
    WHERE t.tgrelid = 'public.shipments'::regclass
    AND NOT t.tgisinternal
    ORDER BY t.tgname
  ) LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  - % (enabled: %)', r.tgname, 
      CASE WHEN r.tgenabled = 'O' THEN 'YES' ELSE 'NO' END;
  END LOOP;
  
  IF v_count = 0 THEN
    RAISE NOTICE '  (No triggers found)';
  END IF;
END $$;

-- Check 4: Find functions that insert into messages
DO $$
DECLARE
  r RECORD;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Check 4: Functions that insert into messages table';
  
  FOR r IN (
    SELECT 
      p.proname,
      pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
    AND pg_get_functiondef(p.oid) LIKE '%INSERT INTO messages%'
    AND p.proname NOT LIKE 'st_%'  -- Exclude PostGIS functions
    AND p.proname NOT LIKE '_st_%'
    ORDER BY p.proname
  ) LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  - %(%)', r.proname, COALESCE(r.args, '');
  END LOOP;
  
  IF v_count = 0 THEN
    RAISE NOTICE '  (No functions found that insert into messages)';
  END IF;
END $$;

-- =====================================================================
-- PART 2: Check specific function definitions
-- =====================================================================

DO $$
DECLARE
  v_func_def TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Check 5: Inspecting assign_driver_to_shipment function';
  
  SELECT pg_get_functiondef(oid) INTO v_func_def
  FROM pg_proc 
  WHERE proname = 'assign_driver_to_shipment'
  LIMIT 1;
  
  IF v_func_def IS NULL THEN
    RAISE NOTICE '  ✗ Function not found!';
  ELSE
    IF v_func_def LIKE '%INSERT INTO messages%' OR v_func_def LIKE '%INSERT INTO public.messages%' THEN
      RAISE NOTICE '  ⚠️  WARNING: Function contains INSERT INTO messages';
      
      IF v_func_def LIKE '%conversation_id%' THEN
        RAISE NOTICE '  ⚠️  PROBLEM: Function references conversation_id!';
        RAISE NOTICE '  → This is likely the source of the error';
      ELSE
        RAISE NOTICE '  ✓ Function does not reference conversation_id';
      END IF;
    ELSE
      RAISE NOTICE '  ✓ Function does not insert into messages table';
    END IF;
  END IF;
END $$;

-- =====================================================================
-- PART 3: Check trigger functions on shipments table
-- =====================================================================

DO $$
DECLARE
  r RECORD;
  v_func_def TEXT;
  v_has_problem BOOLEAN := FALSE;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Check 6: Inspecting trigger functions on shipments table';
  
  FOR r IN (
    SELECT DISTINCT 
      t.tgname,
      p.proname,
      t.tgenabled
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.shipments'::regclass
    AND NOT t.tgisinternal
    ORDER BY t.tgname
  ) LOOP
    RAISE NOTICE '  Checking trigger: %', r.tgname;
    RAISE NOTICE '    Function: %', r.proname;
    RAISE NOTICE '    Enabled: %', CASE WHEN r.tgenabled = 'O' THEN 'YES' ELSE 'NO' END;
    
    SELECT pg_get_functiondef(oid) INTO v_func_def
    FROM pg_proc
    WHERE proname = r.proname
    LIMIT 1;
    
    IF v_func_def LIKE '%INSERT INTO messages%' THEN
      RAISE NOTICE '    → Inserts into messages: YES';
      
      IF v_func_def LIKE '%conversation_id%' THEN
        RAISE NOTICE '    ⚠️  PROBLEM: References conversation_id!';
        v_has_problem := TRUE;
      END IF;
    END IF;
  END LOOP;
  
  IF v_has_problem THEN
    RAISE NOTICE '';
    RAISE NOTICE '  ⚠️  FOUND THE PROBLEM: One or more triggers reference conversation_id';
  END IF;
END $$;

-- =====================================================================
-- PART 4: RLS Check
-- =====================================================================

DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Check 7: Row Level Security on job_applications';
  
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'job_applications';
  
  RAISE NOTICE '  Total policies: %', v_policy_count;
  
  IF v_policy_count >= 7 THEN
    RAISE NOTICE '  ✓ Sufficient policies exist';
  ELSIF v_policy_count > 0 THEN
    RAISE NOTICE '  ⚠️  Only % policies found (expected 7)', v_policy_count;
  ELSE
    RAISE NOTICE '  ✗ No policies found!';
  END IF;
END $$;

-- =====================================================================
-- SUMMARY AND RECOMMENDATIONS
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'SUMMARY';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'If you see "⚠️  PROBLEM: References conversation_id" above:';
  RAISE NOTICE '  → A trigger or function is trying to use a non-existent column';
  RAISE NOTICE '  → This is causing the quick assign feature to fail';
  RAISE NOTICE '';
  RAISE NOTICE 'SOLUTION:';
  RAISE NOTICE '  The problematic trigger/function needs to be fixed or disabled.';
  RAISE NOTICE '  See the trigger name(s) listed above.';
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE '';
END $$;

-- =====================================================================
-- OPTIONAL: Disable problematic triggers
-- =====================================================================
-- Uncomment the section below to automatically disable triggers that
-- reference conversation_id

/*
DO $$
DECLARE
  r RECORD;
  v_func_def TEXT;
BEGIN
  RAISE NOTICE 'Attempting to disable problematic triggers...';
  RAISE NOTICE '';
  
  FOR r IN (
    SELECT DISTINCT 
      t.tgname,
      p.proname
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.shipments'::regclass
    AND NOT t.tgisinternal
    AND t.tgenabled = 'O'  -- Only enabled triggers
  ) LOOP
    SELECT pg_get_functiondef(oid) INTO v_func_def
    FROM pg_proc
    WHERE proname = r.proname
    LIMIT 1;
    
    IF v_func_def LIKE '%conversation_id%' AND v_func_def LIKE '%messages%' THEN
      RAISE NOTICE 'Disabling trigger: %', r.tgname;
      EXECUTE format('ALTER TABLE public.shipments DISABLE TRIGGER %I', r.tgname);
      RAISE NOTICE '✓ Disabled';
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Done. Try the quick assign feature again.';
END $$;
*/
