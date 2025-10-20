# Quick Fix: Create Storage Policies via Supabase Dashboard

## The Issue
You're getting "new row violates row-level security policy" because the storage policies haven't been created yet. The bucket exists, but it has no policies allowing users to upload.

## Quick Solution (2-3 minutes)

### Method 1: Using Supabase Dashboard (RECOMMENDED)

1. **Go to your Supabase project dashboard**
   - Visit: https://app.supabase.com
   - Select your DriveDrop project

2. **Navigate to Storage**
   - Click **Storage** in the left sidebar
   - You should see the `profiles` bucket

3. **Open Storage Policies**
   - Click on **Policies** at the top (next to Buckets)
   - Click **New Policy** button

4. **Create Policy 1 - Public Read**
   - Click "Create a policy"
   - Name: `Public profiles are viewable by everyone`
   - Allowed operation: Check **SELECT**
   - Policy definition:
     ```sql
     bucket_id = 'profiles'
     ```
   - Leave "Target roles" empty
   - Click **Review** then **Save policy**

5. **Create Policy 2 - Upload**
   - Click **New Policy** again
   - Name: `Users can upload their own profile image`
   - Allowed operation: Check **INSERT**
   - Target roles: Select **authenticated**
   - Policy definition:
     ```sql
     bucket_id = 'profiles' AND (storage.foldername(name))[1] = 'avatars'
     ```
   - Click **Review** then **Save policy**

6. **Create Policy 3 - Update**
   - Click **New Policy** again
   - Name: `Users can update their own profile image`
   - Allowed operation: Check **UPDATE**
   - Target roles: Select **authenticated**
   - Policy definition:
     ```sql
     bucket_id = 'profiles' AND (storage.foldername(name))[1] = 'avatars'
     ```
   - Click **Review** then **Save policy**

7. **Create Policy 4 - Delete**
   - Click **New Policy** again
   - Name: `Users can delete their own profile image`
   - Allowed operation: Check **DELETE**
   - Target roles: Select **authenticated**
   - Policy definition:
     ```sql
     bucket_id = 'profiles' AND (storage.foldername(name))[1] = 'avatars'
     ```
   - Click **Review** then **Save policy**

### Method 2: Using SQL Editor (if Dashboard method doesn't work)

1. Go to **SQL Editor** in Supabase Dashboard
2. Click **New Query**
3. Paste this entire script:

```sql
-- Policy 1: Anyone can view profile images
CREATE POLICY "Public profiles are viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'profiles');

-- Policy 2: Authenticated users can upload
CREATE POLICY "Users can upload their own profile image"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles' 
  AND (storage.foldername(name))[1] = 'avatars'
);

-- Policy 3: Authenticated users can update
CREATE POLICY "Users can update their own profile image"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
);

-- Policy 4: Authenticated users can delete
CREATE POLICY "Users can delete their own profile image"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
);
```

4. Click **Run** (or press Ctrl+Enter)

### Method 3: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
supabase db execute --file supabase/migrations/20250730_create_storage_policies.sql
```

## Verify It Worked

After creating the policies:

1. Open DriveDrop mobile app
2. Go to Profile screen
3. Try uploading a profile picture
4. You should NOT get the RLS policy error anymore

## What These Policies Do

- **Policy 1 (SELECT)**: Allows anyone (even non-logged-in users) to VIEW profile pictures
- **Policy 2 (INSERT)**: Allows logged-in users to UPLOAD images to the avatars folder
- **Policy 3 (UPDATE)**: Allows logged-in users to REPLACE their existing images
- **Policy 4 (DELETE)**: Allows logged-in users to DELETE their images

All upload/update/delete operations are restricted to the `avatars` folder for security.

## Still Getting Errors?

If you still get RLS errors after creating policies:

1. **Check the user is authenticated**: Make sure you're logged in before trying to upload
2. **Verify the policies exist**:
   - Go to Supabase Dashboard > Storage > Policies
   - You should see all 4 policies listed
3. **Check the file path**: The app saves files to `avatars/[filename]` - verify this matches the policy
4. **Try refreshing your app**: Sometimes cached sessions need to be refreshed

## Common Issues

### "Policy already exists" error
- The policies are already created, you're good to go!

### "must be owner of table objects" error  
- Use Method 1 (Dashboard) instead of SQL - it has the right permissions

### Upload works but can't view images
- Check Policy 1 is created correctly
- Verify the bucket is set to **public** (not private)
