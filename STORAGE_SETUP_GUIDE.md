# Storage Bucket Setup Guide

## Issue
The migration `20250730_create_profiles_storage_bucket.sql` creates the bucket but cannot create storage policies due to permission restrictions. Storage policies must be created through the Supabase Dashboard.

## Setup Instructions

### Step 1: Run the Migration
The migration will create the `profiles` bucket with these settings:
- **Bucket ID**: `profiles`
- **Public**: Yes (avatars are publicly viewable)
- **File Size Limit**: 5MB
- **Allowed Types**: image/jpeg, image/jpg, image/png, image/gif, image/webp

### Step 2: Create Storage Policies via Supabase Dashboard

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Navigate to **Storage** in the left sidebar
3. Click on the **profiles** bucket
4. Click on **Policies** tab
5. Click **New Policy**

Create the following 4 policies:

---

#### Policy 1: Public Read Access
- **Name**: `Public profiles are viewable by everyone`
- **Allowed operation**: `SELECT`
- **Policy definition**:
  ```sql
  bucket_id = 'profiles'
  ```
- **Target roles**: Leave empty (applies to all, including anonymous)

---

#### Policy 2: Upload Own Profile Image
- **Name**: `Users can upload their own profile image`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **Policy definition**:
  ```sql
  bucket_id = 'profiles' AND (storage.foldername(name))[1] = 'avatars'
  ```

---

#### Policy 3: Update Own Profile Image
- **Name**: `Users can update their own profile image`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **Policy definition**:
  ```sql
  bucket_id = 'profiles' AND (storage.foldername(name))[1] = 'avatars'
  ```

---

#### Policy 4: Delete Own Profile Image
- **Name**: `Users can delete their own profile image`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **Policy definition**:
  ```sql
  bucket_id = 'profiles' AND (storage.foldername(name))[1] = 'avatars'
  ```

---

### Step 3: Verify Setup

After creating all policies, test the profile picture upload feature:

1. Open the DriveDrop mobile app
2. Go to Profile screen
3. Try uploading/changing your profile picture
4. Verify no "Bucket not found" error occurs

## Security Notes

- The bucket is **public** for read access (anyone can view avatars via public URL)
- Only **authenticated** users can upload/update/delete
- Files are restricted to the `avatars` folder within the bucket
- File types are limited to images only
- Maximum file size is 5MB

## Troubleshooting

### Error: "Bucket not found"
- Verify the migration ran successfully
- Check the bucket exists in Supabase Dashboard > Storage
- Ensure bucket is named exactly `profiles`

### Error: "New row violates row-level security policy"
- Verify all 4 policies are created correctly
- Check policy definitions match exactly (including the `(storage.foldername(name))[1] = 'avatars'` part)
- Ensure target roles are set to `authenticated` where specified

### Images not loading
- Verify the bucket is set to **public**
- Check the file was uploaded to the `avatars` folder
- Test the public URL directly in a browser

## Alternative: Using Supabase CLI

If you prefer using the CLI, you can create policies with:

```bash
supabase storage policies create \
  --bucket profiles \
  --name "Public profiles are viewable by everyone" \
  --operation SELECT \
  --definition "bucket_id = 'profiles'"

supabase storage policies create \
  --bucket profiles \
  --name "Users can upload their own profile image" \
  --operation INSERT \
  --role authenticated \
  --definition "bucket_id = 'profiles' AND (storage.foldername(name))[1] = 'avatars'"

# Continue for UPDATE and DELETE operations...
```

Note: CLI commands may vary based on Supabase CLI version.
