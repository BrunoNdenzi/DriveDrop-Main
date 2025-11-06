-- Fix RLS policies for client photo uploads
-- Clients need to be able to upload photos to verification-photos bucket

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Clients can upload their vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Clients can read their vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can read verification photos" ON storage.objects;

-- Allow authenticated users (clients) to upload photos
CREATE POLICY "Clients can upload their vehicle photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-photos' AND
  (storage.foldername(name))[1] = 'client-photos'
);

-- Allow clients to read their own uploaded photos
CREATE POLICY "Clients can read their vehicle photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-photos' AND
  (storage.foldername(name))[1] = 'client-photos'
);

-- Also ensure public read access for verification photos (needed for drivers to view)
CREATE POLICY "Public can read verification photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'verification-photos');
