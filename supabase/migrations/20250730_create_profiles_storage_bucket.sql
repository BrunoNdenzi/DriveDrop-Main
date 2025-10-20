-- Create profiles storage bucket for avatar uploads
-- This bucket will store user profile pictures for both clients and drivers

-- Create the profiles bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profiles',
  'profiles',
  true, -- Public bucket so avatars can be displayed without auth
  5242880, -- 5MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Note: RLS policies for storage.objects should be created via Supabase Dashboard
-- or using the Supabase CLI with proper permissions.
-- 
-- To set up storage policies manually:
-- 1. Go to Supabase Dashboard > Storage > Policies
-- 2. Click on "New Policy" for the profiles bucket
-- 3. Add the following policies:
--
-- Policy 1: "Public profiles are viewable by everyone"
--   - Operation: SELECT
--   - Policy definition: bucket_id = 'profiles'
--
-- Policy 2: "Users can upload their own profile image"  
--   - Operation: INSERT
--   - Target roles: authenticated
--   - Policy definition: bucket_id = 'profiles' AND (storage.foldername(name))[1] = 'avatars'
--
-- Policy 3: "Users can update their own profile image"
--   - Operation: UPDATE  
--   - Target roles: authenticated
--   - Policy definition: bucket_id = 'profiles' AND (storage.foldername(name))[1] = 'avatars'
--
-- Policy 4: "Users can delete their own profile image"
--   - Operation: DELETE
--   - Target roles: authenticated  
--   - Policy definition: bucket_id = 'profiles' AND (storage.foldername(name))[1] = 'avatars'
