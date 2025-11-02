-- Fix RLS policies for verification-photos bucket
-- The previous policy checked auth.jwt() which doesn't work correctly
-- We need to check the profiles table instead

-- Drop existing policies
DROP POLICY IF EXISTS "Drivers can upload verification photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view verification photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete verification photos" ON storage.objects;

-- Policy: Drivers can upload photos
-- Check the profiles table for the user's role
CREATE POLICY "Drivers can upload verification photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-photos'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'driver'
  )
);

-- Policy: Authenticated users can view photos
CREATE POLICY "Authenticated users can view verification photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'verification-photos');

-- Policy: Drivers can update their own photos
CREATE POLICY "Drivers can update verification photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'verification-photos'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'driver'
  )
);

-- Policy: Admins can delete photos
CREATE POLICY "Admins can delete verification photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'verification-photos'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
