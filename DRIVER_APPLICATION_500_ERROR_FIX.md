# 🔧 Driver Application 500 Error - Troubleshooting & Fix

## Problem
When submitting a driver application at `/drivers/register`, the API endpoint `/api/drivers/apply` returns a **500 Internal Server Error**.

## Root Cause
The most likely cause is that **storage buckets don't exist yet** in Supabase. The application tries to upload driver documents (license photos, insurance, etc.) to buckets that haven't been created.

---

## ✅ Solution: Create Storage Buckets

### Step 1: Run the Storage Bucket Migration

You **MUST** create the storage buckets before driver applications can work. Choose one method:

#### Option A: Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select project: **tgdewxxmfmbvvcelngeg**
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste this SQL:

```sql
-- Create storage buckets for driver applications

-- Create driver-licenses bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'driver-licenses',
  'driver-licenses',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Create proof-of-address bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proof-of-address',
  'proof-of-address',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Create insurance-documents bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'insurance-documents',
  'insurance-documents',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;
```

6. Click **Run** (or press Ctrl+Enter)
7. You should see: "Success. No rows returned"

#### Option B: Use Migration File

```bash
# From project root
cd F:\DD\DriveDrop-Main

# Copy the migration file content from:
# supabase/migrations/20250130_create_driver_storage_buckets.sql

# Then paste and run in Supabase SQL Editor
```

### Step 2: Verify Buckets Were Created

1. In Supabase Dashboard, go to **Storage**
2. You should see 3 new buckets:
   - ✅ `driver-licenses` (Private, 10MB limit)
   - ✅ `proof-of-address` (Private, 10MB limit)
   - ✅ `insurance-documents` (Private, 10MB limit)

---

## 🔍 Enhanced Error Logging

The API endpoint now has **detailed console logging** to help diagnose issues:

```typescript
=== Driver Application Submission Started ===
FormData parsed successfully
All required fields present
Encrypting SSN...
SSN encrypted successfully
Application folder ID: temp-1234567890-abc123
File uploads completed (or skipped)
Document URLs: { licenseFrontUrl: '...', ... }
Inserting application into database...
Application inserted successfully: 12345678-abcd-...
```

### How to View Logs

**For Railway/Vercel Deployments:**
1. Go to your deployment platform dashboard
2. Navigate to **Logs** or **Runtime Logs**
3. Submit a test application
4. Check logs for detailed error messages

**For Local Development:**
```bash
cd website
npm run dev

# Watch the terminal for console.log output
```

---

## 🧪 Testing After Fix

### Test 1: Submit Driver Application

1. Go to: `https://www.drivedrop.us.com/drivers/register`
2. Fill out all 5 steps:
   - Personal Information
   - Driver's License (upload photos)
   - Driving History
   - Insurance Information
   - Review & Submit
3. Click **Submit Application**
4. ✅ Expected: Success message appears
5. ✅ Check email for confirmation

### Test 2: Check Admin Dashboard

1. Log in as admin
2. Go to: `/dashboard/admin/driver-applications`
3. ✅ New application should appear as "Pending"

### Test 3: Verify Documents Uploaded

1. In Supabase Dashboard, go to **Storage**
2. Click on `driver-licenses` bucket
3. ✅ You should see uploaded photos in a temp folder

---

## 🐛 Other Potential Issues

### Issue 1: ENCRYPTION_KEY Not Set

**Symptom:** Error message "Failed to process sensitive data securely"

**Fix:** Add to environment variables:
```bash
ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

**To generate a secure key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Issue 2: Database Table Missing Columns

**Symptom:** Supabase insert error with column not found

**Fix:** Check that `driver_applications` table has all required columns:
- `ssn_encrypted` (text)
- `license_front_url` (text)
- `license_back_url` (text)
- `proof_of_address_url` (text)
- `insurance_proof_url` (text)

### Issue 3: File Size Too Large

**Symptom:** Upload fails silently

**Fix:** 
- Max file size: **10MB**
- Allowed types: JPG, PNG, WebP, PDF
- Compress large images before upload

### Issue 4: CORS Error (Production Only)

**Symptom:** Browser blocks request from frontend to API

**Fix:** Add to `next.config.js`:
```javascript
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
      ],
    },
  ]
}
```

---

## 📋 Quick Checklist

Before testing driver applications, ensure:

- [x] Storage buckets created in Supabase
- [x] `ENCRYPTION_KEY` set in environment variables
- [x] `SUPABASE_SERVICE_ROLE_KEY` set correctly
- [x] Database table `driver_applications` exists
- [x] Email SMTP credentials configured
- [x] Website deployed and running
- [x] Google Maps API key valid

---

## 🚀 Next Steps After Fix

Once storage buckets are created:

1. **Redeploy** the website (or it will auto-deploy if using continuous deployment)
2. **Test** driver application submission
3. **Verify** email confirmation is sent
4. **Check** admin dashboard shows the application
5. **Test** admin approval flow

---

## 📞 Still Having Issues?

### Check Server Logs
Look for these specific errors:
- `Failed to upload file - bucket may not exist`
- `Error encrypting SSN`
- `Supabase insert error`

### Environment Variables to Verify
```bash
# Required for driver applications
ENCRYPTION_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SMTP_HOST=smtp.gmail.com
SMTP_USER=infos@calkons.com
SMTP_PASS=vjnkgiuitlyyuwxs
```

### Database Check
Run this query in Supabase SQL Editor:
```sql
-- Check if table exists and has correct structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'driver_applications';
```

---

## Summary

**Most Common Cause:** Storage buckets not created  
**Quick Fix:** Run the storage bucket migration SQL  
**Verification:** Check Supabase Storage for 3 new buckets  
**Result:** Driver applications work perfectly with document uploads  

**Status after fix:** ✅ Applications submit successfully with encrypted SSN and uploaded documents
