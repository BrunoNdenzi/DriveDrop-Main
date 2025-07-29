-- fix_payments_policy.sql
-- Fix for Row-Level Security policy for payments table

-- Drop any existing RLS policies on payments table
DROP POLICY IF EXISTS "Payments are viewable by the client who created them" ON "public"."payments";
DROP POLICY IF EXISTS "Payments are insertable by authenticated clients" ON "public"."payments";
DROP POLICY IF EXISTS "Payments are viewable by admin" ON "public"."payments";
DROP POLICY IF EXISTS "Payments are updatable by admin" ON "public"."payments";

-- Create new policies
-- Clients can view their own payments
CREATE POLICY "Clients can view their own payments"
ON "public"."payments"
FOR SELECT
TO authenticated
USING (client_id = auth.uid());

-- Clients can insert payments with their own ID
CREATE POLICY "Clients can insert payments"
ON "public"."payments"
FOR INSERT
TO authenticated
WITH CHECK (client_id = auth.uid());

-- Admin can view all payments
CREATE POLICY "Admin can view all payments"
ON "public"."payments"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Admin can update all payments
CREATE POLICY "Admin can update all payments"
ON "public"."payments"
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Enable RLS on payments if not already enabled
ALTER TABLE IF EXISTS "public"."payments" ENABLE ROW LEVEL SECURITY;

-- Verify the policies are correctly set
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'payments';
