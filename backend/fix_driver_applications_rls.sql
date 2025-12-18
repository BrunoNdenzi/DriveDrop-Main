-- Fix driver_applications RLS policies
-- Run this in Supabase SQL Editor

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Users can view own applications" ON driver_applications;
DROP POLICY IF EXISTS "Admins can view all applications" ON driver_applications;

-- Create a single combined SELECT policy for both admin and authenticated users
CREATE POLICY "Allow authenticated users and admins to view applications"
ON driver_applications
FOR SELECT
TO authenticated
USING (
  -- Allow all authenticated users to view (for stats/counts)
  -- Or specifically limit to admins only if you prefer tighter security
  auth.uid() IS NOT NULL
);

-- Alternative: If you want ONLY admins to view (more secure)
-- Uncomment below and comment out the policy above
/*
CREATE POLICY "Allow only admins to view applications"
ON driver_applications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
*/
