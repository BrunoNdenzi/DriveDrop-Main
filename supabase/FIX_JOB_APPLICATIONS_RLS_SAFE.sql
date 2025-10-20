-- =====================================================================
-- FIX JOB APPLICATIONS RLS POLICIES (SAFE VERSION)
-- =====================================================================
-- This script safely enables RLS and creates/updates policies for the 
-- job_applications table so that admins can view driver applications
-- This version handles existing policies gracefully
-- =====================================================================

DO $$
DECLARE
  v_rls_enabled BOOLEAN;
  v_policy_count INTEGER;
BEGIN
  -- Check if RLS is already enabled
  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE relname = 'job_applications';
  
  IF v_rls_enabled THEN
    RAISE NOTICE '✓ RLS already enabled on job_applications table';
  ELSE
    RAISE NOTICE 'Enabling RLS on job_applications table...';
    ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✓ RLS enabled on job_applications table';
  END IF;
  
  -- Count existing policies
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'job_applications';
  
  RAISE NOTICE 'Found % existing policies', v_policy_count;
END $$;

-- =====================================================================
-- DROP AND RECREATE ALL POLICIES (IDEMPOTENT)
-- =====================================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Drivers can view their own job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Drivers can create their own job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Drivers can update their own job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Admins can view all job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Admins can update all job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Admins can delete job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Clients can view applications for their shipments" ON public.job_applications;

-- Also drop any old naming variations that might exist
DROP POLICY IF EXISTS "Drivers can view own applications" ON public.job_applications;
DROP POLICY IF EXISTS "Drivers can create own applications" ON public.job_applications;
DROP POLICY IF EXISTS "Drivers can update own applications" ON public.job_applications;
DROP POLICY IF EXISTS "Admins can view all applications" ON public.job_applications;
DROP POLICY IF EXISTS "Admins can update all applications" ON public.job_applications;
DROP POLICY IF EXISTS "Admins can delete applications" ON public.job_applications;
DROP POLICY IF EXISTS "Clients can view applications" ON public.job_applications;

-- =====================================================================
-- DRIVER POLICIES
-- =====================================================================

-- Policy 1: Drivers can view their own applications
CREATE POLICY "Drivers can view their own job applications"
  ON public.job_applications
  FOR SELECT
  USING (
    auth.uid() = driver_id
  );

-- Policy 2: Drivers can create their own applications
CREATE POLICY "Drivers can create their own job applications"
  ON public.job_applications
  FOR INSERT
  WITH CHECK (
    auth.uid() = driver_id
  );

-- Policy 3: Drivers can update their own applications (e.g., to cancel)
CREATE POLICY "Drivers can update their own job applications"
  ON public.job_applications
  FOR UPDATE
  USING (
    auth.uid() = driver_id
  );

-- =====================================================================
-- ADMIN POLICIES
-- =====================================================================

-- Policy 4: Admins can view all applications
CREATE POLICY "Admins can view all job applications"
  ON public.job_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy 5: Admins can update all applications (accept/reject)
CREATE POLICY "Admins can update all job applications"
  ON public.job_applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy 6: Admins can delete applications if needed
CREATE POLICY "Admins can delete job applications"
  ON public.job_applications
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================================
-- CLIENT POLICIES
-- =====================================================================

-- Policy 7: Clients can view applications for their own shipments
CREATE POLICY "Clients can view applications for their shipments"
  ON public.job_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shipments 
      WHERE id = job_applications.shipment_id 
      AND client_id = auth.uid()
    )
  );

-- =====================================================================
-- GRANT PERMISSIONS
-- =====================================================================

-- Ensure authenticated users can access the table
GRANT SELECT, INSERT, UPDATE ON public.job_applications TO authenticated;
GRANT DELETE ON public.job_applications TO authenticated;

-- =====================================================================
-- VERIFICATION AND REPORT
-- =====================================================================

DO $$
DECLARE
  v_policy_count INTEGER;
  v_rls_enabled BOOLEAN;
  r RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'JOB APPLICATIONS RLS POLICIES DEPLOYED';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE '';
  
  -- Check RLS status
  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE relname = 'job_applications';
  
  RAISE NOTICE 'RLS Enabled: %', 
    CASE WHEN v_rls_enabled THEN '✓ YES' ELSE '✗ NO' END;
  
  -- Count and list policies
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'job_applications';
  
  RAISE NOTICE 'Total Policies: %', v_policy_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Policy Details:';
  
  FOR r IN (
    SELECT policyname, cmd
    FROM pg_policies
    WHERE tablename = 'job_applications'
    ORDER BY policyname
  ) LOOP
    RAISE NOTICE '  ✓ % (%)', r.policyname, r.cmd;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'DEPLOYMENT COMPLETE';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Expected: 7 policies (SELECT: 3, INSERT: 1, UPDATE: 2, DELETE: 1)';
  RAISE NOTICE 'Actual: % policies', v_policy_count;
  RAISE NOTICE '';
  
  IF v_policy_count = 7 THEN
    RAISE NOTICE '✅ SUCCESS: All policies created correctly';
  ELSIF v_policy_count > 7 THEN
    RAISE WARNING '⚠️  More policies than expected - review the list above';
  ELSE
    RAISE WARNING '⚠️  Fewer policies than expected - some may have failed';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Test admin can now see all driver applications';
  RAISE NOTICE '2. Test driver can only see their own applications';
  RAISE NOTICE '3. Test client can see applications for their shipments';
  RAISE NOTICE '4. Run the second script: DIAGNOSE_AND_FIX_TRIGGERS.sql';
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
END $$;

-- =====================================================================
-- OPTIONAL: TEST QUERIES
-- =====================================================================

-- Uncomment these to test the policies work correctly:

-- Test 1: Check if RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'job_applications';

-- Test 2: List all policies
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies 
-- WHERE tablename = 'job_applications'
-- ORDER BY cmd, policyname;

-- Test 3: Count applications (as admin)
-- SELECT COUNT(*) as total_applications FROM job_applications;

-- Test 4: Count by status
-- SELECT status, COUNT(*) as count 
-- FROM job_applications 
-- GROUP BY status
-- ORDER BY status;

-- Test 5: View recent applications with details
-- SELECT 
--   ja.id,
--   ja.status,
--   ja.applied_at,
--   p.first_name || ' ' || p.last_name as driver_name,
--   s.title as shipment_title
-- FROM job_applications ja
-- LEFT JOIN profiles p ON p.id = ja.driver_id
-- LEFT JOIN shipments s ON s.id = ja.shipment_id
-- ORDER BY ja.applied_at DESC
-- LIMIT 10;
