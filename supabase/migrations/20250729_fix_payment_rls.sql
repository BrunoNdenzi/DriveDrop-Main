-- Migration: Fix Payment RLS Policy for API Service
-- Allow the API service to insert payment records on behalf of users

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Only admins can manage payments" ON payments;

-- Create a more permissive policy for inserting payments
CREATE POLICY "Allow service to create payments" 
ON payments FOR INSERT 
WITH CHECK (true);  -- This allows the service to insert payments for any authenticated user

-- Create a policy to allow admins to update payments
CREATE POLICY "Only admins can update payments" 
ON payments FOR UPDATE USING (
    auth.uid() IN (
        SELECT id FROM profiles WHERE role = 'admin'
    )
);

-- Create a policy to allow admins to delete payments
CREATE POLICY "Only admins can delete payments" 
ON payments FOR DELETE USING (
    auth.uid() IN (
        SELECT id FROM profiles WHERE role = 'admin'
    )
);
