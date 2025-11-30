# 🚀 Quick Setup Guide for Driver Application System

## Step 1: Run Storage Bucket Migration

You need to create the storage buckets for document uploads. Choose one of these methods:

### Option A: Supabase Dashboard (Easiest)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: **tgdewxxmfmbvvcelngeg**
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the contents of:
   ```
   supabase/migrations/20250130_create_driver_storage_buckets.sql
   ```
6. Click **Run** (or press Ctrl+Enter)
7. You should see "Success. No rows returned" - this is correct!

### Option B: Supabase CLI (For Developers)

```bash
# Make sure you're in the project root directory
cd F:\DD\DriveDrop-Main

# Push the migration to Supabase
npx supabase db push
```

### Verify Buckets Were Created

1. In Supabase Dashboard, go to **Storage**
2. You should see three new buckets:
   - `driver-licenses` (Private)
   - `proof-of-address` (Private)
   - `insurance-documents` (Private)

---

## Step 2: Verify Environment Variables

Make sure these are set in your deployment (Railway/Vercel):

```bash
# Encryption Key (Required for SSN encryption)
ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

# Email Configuration (Gmail SMTP - already working)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=infos@calkons.com
SMTP_PASS=vjnkgiuitlyyuwxs
SMTP_FROM=DriveDrop <infos@calkons.com>

# Supabase (Already set)
NEXT_PUBLIC_SUPABASE_URL=https://tgdewxxmfmbvvcelngeg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 🔒 **IMPORTANT**: Generate a New Encryption Key for Production

For security, generate a new encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Replace the `ENCRYPTION_KEY` value with the generated key in your production environment.

---

## Step 3: Deploy to Production

```bash
cd F:\DD\DriveDrop-Main\website
npm run build
# Then deploy via your platform (Railway, Vercel, etc.)
```

---

## Step 4: Test the System

### Test Driver Application Submission

1. Go to: https://your-domain.com/drivers/register
2. Fill out all 5 steps
3. Upload documents (license, proof of address, insurance)
4. Submit application
5. Check email for confirmation

### Test Admin Approval

1. Log in as admin
2. Go to: `/dashboard/admin/driver-applications`
3. You should see the test application as "Pending"
4. Click "Approve"
5. Add optional note
6. Confirm approval
7. Check that:
   - Application status changed to "Approved"
   - New user appears in Supabase Auth > Users
   - New profile appears in profiles table
   - Approval email was sent to applicant

### Test Driver Login

1. Check the approval email for credentials
2. Go to: https://your-domain.com/login
3. Log in with provided email and temporary password
4. (Optional) Implement password change on first login

---

## ✅ Success Checklist

- [ ] Storage buckets created (driver-licenses, proof-of-address, insurance-documents)
- [ ] Environment variables set (especially ENCRYPTION_KEY)
- [ ] Website deployed and building successfully
- [ ] Driver can submit application with file uploads
- [ ] Confirmation email received after submission
- [ ] Application appears in admin dashboard
- [ ] Admin can approve application
- [ ] User account created in Supabase Auth
- [ ] Welcome email sent with credentials
- [ ] Driver can log in with provided credentials

---

## 🐛 Troubleshooting

### "Failed to process sensitive data securely"
- **Cause**: ENCRYPTION_KEY not set
- **Fix**: Add ENCRYPTION_KEY to environment variables

### "Failed to upload file"
- **Cause**: Storage buckets not created
- **Fix**: Run the storage migration SQL

### "Failed to create user account"
- **Cause**: SUPABASE_SERVICE_ROLE_KEY incorrect or missing
- **Fix**: Verify the service role key in environment variables

### Email not sending
- **Cause**: SMTP credentials incorrect
- **Fix**: Verify Gmail SMTP credentials (already working: infos@calkons.com)

---

## 📞 Need Help?

- Check main documentation: `DRIVER_APPLICATION_SYSTEM_COMPLETE.md`
- Review inline code comments
- Check Supabase logs for errors
- Check browser console for frontend errors
- Check server logs for backend errors

---

**Ready to Go!** 🎉

Once you complete Steps 1-3, your driver application system will be fully operational with:
- ✅ Secure SSN encryption
- ✅ Document uploads
- ✅ User account creation
- ✅ Email notifications
- ✅ Admin approval workflow

All set! 🚀
