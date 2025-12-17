-- Fix pricing_config RLS policies for admin access
-- Run this in Supabase SQL Editor

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow admin full access to pricing_config" ON pricing_config;

-- Create policy allowing admins full access
CREATE POLICY "Allow admin full access to pricing_config"
ON pricing_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Also allow public read for pricing calculations
CREATE POLICY IF NOT EXISTS "Allow public read of active pricing"
ON pricing_config
FOR SELECT
TO authenticated
USING (is_active = true);
