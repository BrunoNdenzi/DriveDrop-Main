-- Storage Policies for Profiles Bucket
-- Run this with elevated permissions (service_role key or as postgres user)
-- This file should be executed separately after the bucket is created

-- First, ensure RLS is enabled on storage.objects (it should be by default)
-- If you get permission errors, these policies need to be created via Supabase Dashboard

-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile image" ON storage.objects;

-- Policy 1: Anyone can view profile images (public bucket)
CREATE POLICY "Public profiles are viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'profiles');

-- Policy 2: Authenticated users can upload to avatars folder
CREATE POLICY "Users can upload their own profile image"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles' 
  AND (storage.foldername(name))[1] = 'avatars'
);

-- Policy 3: Authenticated users can update files in avatars folder
CREATE POLICY "Users can update their own profile image"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
);

-- Policy 4: Authenticated users can delete files in avatars folder
CREATE POLICY "Users can delete their own profile image"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
);

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
AND policyname LIKE '%profile%';
