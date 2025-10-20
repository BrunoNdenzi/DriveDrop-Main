-- =====================================================================
-- EMERGENCY FIX - DISABLE CONVERSATION_ID TRIGGERS
-- =====================================================================
-- This script will find and disable ALL triggers that reference
-- the non-existent conversation_id column
-- =====================================================================

-- Step 1: List all triggers on shipments table
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'LISTING ALL TRIGGERS ON SHIPMENTS TABLE';
  RAISE NOTICE '==============================================================';
  
  FOR r IN (
    SELECT 
      t.tgname,
      p.proname as function_name,
      CASE WHEN t.tgenabled = 'O' THEN 'ENABLED' ELSE 'DISABLED' END as status
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.shipments'::regclass
    AND NOT t.tgisinternal
    ORDER BY t.tgname
  ) LOOP
    RAISE NOTICE 'Trigger: % → Function: % [%]', r.tgname, r.function_name, r.status;
  END LOOP;
END $$;

-- Step 2: Check each trigger function for conversation_id reference
DO $$
DECLARE
  r RECORD;
  v_func_def TEXT;
  v_problem_found BOOLEAN := FALSE;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'CHECKING FOR CONVERSATION_ID REFERENCES';
  RAISE NOTICE '==============================================================';
  
  FOR r IN (
    SELECT DISTINCT
      t.tgname,
      p.proname,
      t.tgenabled
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.shipments'::regclass
    AND NOT t.tgisinternal
  ) LOOP
    -- Get function definition
    SELECT pg_get_functiondef(oid) INTO v_func_def
    FROM pg_proc
    WHERE proname = r.proname
    LIMIT 1;
    
    -- Check if it references conversation_id
    IF v_func_def LIKE '%conversation_id%' THEN
      RAISE NOTICE '';
      RAISE NOTICE '⚠️  FOUND PROBLEM TRIGGER: %', r.tgname;
      RAISE NOTICE '   Function: %', r.proname;
      RAISE NOTICE '   Status: %', CASE WHEN r.tgenabled = 'O' THEN 'ENABLED (WILL BE DISABLED)' ELSE 'ALREADY DISABLED' END;
      v_problem_found := TRUE;
      
      -- Disable it if enabled
      IF r.tgenabled = 'O' THEN
        EXECUTE format('ALTER TABLE public.shipments DISABLE TRIGGER %I', r.tgname);
        RAISE NOTICE '   ✓ DISABLED';
      END IF;
    END IF;
  END LOOP;
  
  IF NOT v_problem_found THEN
    RAISE NOTICE 'No triggers found that reference conversation_id';
    RAISE NOTICE 'The problem may be in the function itself...';
  END IF;
END $$;

-- Step 3: Check the assign_driver_to_shipment function directly
DO $$
DECLARE
  v_func_def TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'CHECKING assign_driver_to_shipment FUNCTION';
  RAISE NOTICE '==============================================================';
  
  SELECT pg_get_functiondef(oid) INTO v_func_def
  FROM pg_proc
  WHERE proname = 'assign_driver_to_shipment'
  LIMIT 1;
  
  IF v_func_def IS NULL THEN
    RAISE NOTICE '✗ Function does not exist!';
  ELSIF v_func_def LIKE '%conversation_id%' THEN
    RAISE NOTICE '⚠️  PROBLEM: Function itself references conversation_id!';
    RAISE NOTICE '';
    RAISE NOTICE 'This means the function definition needs to be updated.';
    RAISE NOTICE 'The function is trying to insert into messages with conversation_id.';
  ELSE
    RAISE NOTICE '✓ Function does not reference conversation_id';
  END IF;
END $$;

-- Step 4: Look for ANY function that inserts into messages with conversation_id
DO $$
DECLARE
  r RECORD;
  v_func_def TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'SEARCHING ALL FUNCTIONS FOR THE PROBLEM';
  RAISE NOTICE '==============================================================';
  
  FOR r IN (
    SELECT 
      p.proname,
      pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname NOT LIKE 'st_%'
    AND p.proname NOT LIKE '_st_%'
  ) LOOP
    SELECT pg_get_functiondef(oid) INTO v_func_def
    FROM pg_proc
    WHERE proname = r.proname
    AND pronamespace = 'public'::regnamespace
    LIMIT 1;
    
    IF v_func_def LIKE '%INSERT INTO messages%' AND v_func_def LIKE '%conversation_id%' THEN
      RAISE NOTICE '';
      RAISE NOTICE '⚠️  FOUND PROBLEM FUNCTION: %', r.proname;
      RAISE NOTICE '   Arguments: %', COALESCE(r.args, 'none');
      RAISE NOTICE '   This function tries to INSERT conversation_id into messages!';
    END IF;
  END LOOP;
END $$;

-- Step 5: Show current messages table structure
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'MESSAGES TABLE STRUCTURE';
  RAISE NOTICE '==============================================================';
  
  FOR r IN (
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'messages'
    ORDER BY ordinal_position
  ) LOOP
    RAISE NOTICE '  - % (%)', r.column_name, r.data_type;
  END LOOP;
  
  -- Check specifically for conversation_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'messages'
    AND column_name = 'conversation_id'
  ) THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  conversation_id column EXISTS in messages table!';
    RAISE NOTICE '   This is unexpected based on your schema.';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '✓ conversation_id column does NOT exist (as expected)';
  END IF;
END $$;

-- =====================================================================
-- FINAL SUMMARY
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'DIAGNOSTIC COMPLETE';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Review the output above for any ⚠️  warnings.';
  RAISE NOTICE '';
  RAISE NOTICE 'If you see "FOUND PROBLEM FUNCTION" or "FOUND PROBLEM TRIGGER":';
  RAISE NOTICE '  - Note the function/trigger name';
  RAISE NOTICE '  - That is what needs to be fixed or recreated';
  RAISE NOTICE '';
  RAISE NOTICE 'Next step: Check the function definition and update it';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE '';
END $$;
