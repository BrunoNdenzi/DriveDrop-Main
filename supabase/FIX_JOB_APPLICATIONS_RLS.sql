-- =====================================================================
-- FIX JOB APPLICATIONS RLS POLICIES
-- =====================================================================
-- This script enables RLS and creates proper policies for the 
-- job_applications table so that admins can view driver applications
-- =====================================================================

-- Enable Row Level Security on job_applications table
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Drivers can view their own job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Drivers can create their own job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Drivers can update their own job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Admins can view all job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Admins can update all job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Clients can view applications for their shipments" ON public.job_applications;

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
-- CLIENT POLICIES (OPTIONAL)
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
-- VERIFICATION
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'JOB APPLICATIONS RLS POLICIES DEPLOYED';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✓ RLS enabled on job_applications table';
  RAISE NOTICE '✓ 7 policies created:';
  RAISE NOTICE '  - Drivers can view/create/update their own applications';
  RAISE NOTICE '  - Admins can view/update/delete all applications';
  RAISE NOTICE '  - Clients can view applications for their shipments';
  RAISE NOTICE '✓ Permissions granted to authenticated users';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Test admin can now see all driver applications';
  RAISE NOTICE '2. Test driver can only see their own applications';
  RAISE NOTICE '3. Test client can see applications for their shipments';
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
END $$;

-- =====================================================================
-- TEST QUERIES (OPTIONAL - RUN THESE TO VERIFY)
-- =====================================================================

-- Check if RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'job_applications';

-- Check policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename = 'job_applications';

-- Count total applications
-- SELECT COUNT(*) FROM job_applications;

-- Count applications by status
-- SELECT status, COUNT(*) FROM job_applications GROUP BY status;
