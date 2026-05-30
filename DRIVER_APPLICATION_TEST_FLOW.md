# Complete Driver Application Test Flow

## ✅ Prerequisites (Done!)
- [x] Emails are working
- [x] BREVO_ENABLED=true on Railway
- [x] Sender emails verified in Brevo
- [x] SSN field is optional in database

## 🧪 Test Flow Steps

### 1. Clean Up Previous Test Application
Run `CLEANUP_TEST_DRIVER.sql` in Supabase SQL Editor to remove:
- Driver application record
- Profile (if created)
- Auth user (if approved)

### 2. Submit New Driver Application
1. Go to: https://drivedrop.us.com/drivers/register
2. Fill out the form with test data:
   - **Email**: btrading456@gmail.com
   - **Full Name**: Test Driver
   - **Phone**: (555) 123-4567
   - **DOB**: 01/01/1990
   - **License**: D12345678
   - **License State**: NC
   - **License Expiration**: 12/31/2028
   - **Insurance Provider**: Test Insurance
   - **Policy Number**: POL123456
   - **Policy Expiration**: 12/31/2027
   - **Coverage Amount**: $100,000
3. Check all consent boxes
4. Submit application

### 3. Expected Results After Submission

#### Immediate (< 1 minute):
- ✅ Success message on website
- ✅ Application saved in `driver_applications` table (status: 'pending')

#### Within 2 minutes:
- ✅ **Applicant receives email** at btrading456@gmail.com
  - Subject: "Driver Application Received - DriveDrop"
  - Contains: Application ID, Next steps
- ✅ **Admin receives email** at infos@drivedrop.us.com
  - Subject: "New Driver Application Submitted - DriveDrop"
  - Contains: Applicant info, Review link

#### Check Email Logs:
Run this in Supabase:
```sql
SELECT 
  email_type,
  recipient_email,
  status,
  brevo_message_id,
  error_message,
  created_at
FROM email_logs
WHERE recipient_email IN ('btrading456@gmail.com', 'infos@drivedrop.us.com')
  AND created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;
```

Expected: 2 rows with status='sent'

#### Check Brevo Dashboard:
- Go to: https://app.brevo.com → Transactional → Email → Real-time Activity
- Should see 2 emails delivered to:
  - btrading456@gmail.com (applicant confirmation)
  - infos@drivedrop.us.com (admin notification)

### 4. Approve the Application

1. Go to: https://drivedrop.us.com/dashboard/admin/driver-applications
2. Login as admin
3. Find "Test Driver" application
4. Click "Approve"
5. Optionally add admin comment
6. Confirm approval

### 5. Expected Results After Approval

#### Immediate:
- ✅ Application status changes to 'approved'
- ✅ User account created in `auth.users`
- ✅ Profile created in `profiles` (role: 'driver')

#### Within 2 minutes:
- ✅ **Driver receives approval email** at btrading456@gmail.com
  - Subject: "Your Driver Application Has Been Approved! - DriveDrop"
  - Contains:
    - Email: btrading456@gmail.com
    - **Temporary password** (16 characters)
    - Login link
    - Getting started guide
    - Payment info (90% payout)

#### Check Email Logs:
```sql
SELECT 
  email_type,
  recipient_email,
  status,
  brevo_message_id,
  error_message,
  created_at
FROM email_logs
WHERE recipient_email = 'btrading456@gmail.com'
  AND created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;
```

Expected: 1 new row with status='sent' (approval email)

### 6. Test Driver Login

1. Go to: https://drivedrop.us.com/login
2. Login with:
   - Email: btrading456@gmail.com
   - Password: [from approval email]
3. Expected:
   - ✅ Login succeeds
   - ✅ Redirected to password change page (force_password_change: true)
   - ✅ Must set new password
   - ✅ Then redirected to driver dashboard

### 7. Verify Driver Dashboard Access

After password change:
- ✅ Can access: https://drivedrop.us.com/dashboard/driver
- ✅ Can see available shipments
- ✅ Can view profile
- ✅ Role is 'driver' in database

---

## 🐛 Troubleshooting

### Issue: No confirmation email after submission
**Check**:
1. Railway logs: "✅ Email sent" (not "📧 Email would be sent")
2. Supabase `email_logs`: status='sent' or 'failed'
3. Brevo dashboard: email status
4. Gmail spam folder

### Issue: No approval email
**Check**:
1. Same as above
2. Check if nodemailer fallback is configured on Vercel
3. Website might be calling nodemailer directly (not backend Brevo)

### Issue: Login fails with temporary password
**Check**:
1. Copy password exactly from email (no extra spaces)
2. Check `auth.users` table: user exists with correct email
3. Check `profiles` table: profile created with role='driver'

### Issue: Not redirected to password change
**Check**:
1. `auth.users` table: user_metadata.force_password_change = true
2. Website password change logic

---

## 📊 Verification Queries

### Check application status:
```sql
SELECT 
  id,
  full_name,
  email,
  status,
  submitted_at,
  reviewed_at,
  reviewed_by
FROM driver_applications
WHERE email = 'btrading456@gmail.com';
```

### Check user account:
```sql
SELECT 
  au.id,
  au.email,
  au.created_at,
  au.email_confirmed_at,
  au.user_metadata,
  p.role,
  p.first_name,
  p.last_name
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE au.email = 'btrading456@gmail.com';
```

### Check all emails sent:
```sql
SELECT 
  email_type,
  recipient_email,
  sender_email,
  subject,
  status,
  brevo_message_id,
  error_message,
  created_at
FROM email_logs
WHERE recipient_email IN ('btrading456@gmail.com', 'infos@drivedrop.us.com')
ORDER BY created_at DESC;
```

---

## ✅ Success Criteria

- [ ] Application submission successful
- [ ] Applicant receives confirmation email
- [ ] Admin receives notification email
- [ ] Application visible in admin dashboard
- [ ] Approval process works
- [ ] Driver receives approval email with credentials
- [ ] Driver can login with temporary password
- [ ] Driver forced to change password
- [ ] Driver can access dashboard
- [ ] All emails logged in Supabase
- [ ] All emails show "Delivered" in Brevo dashboard

---

## 🎯 Ready to Test!

1. Run `CLEANUP_TEST_DRIVER.sql` in Supabase
2. Go to https://drivedrop.us.com/drivers/register
3. Fill out form and submit
4. Check emails (both applicant and admin)
5. Approve in admin dashboard
6. Check approval email
7. Test login and password change
8. Verify driver dashboard access

Let me know at each step if anything doesn't work! 📧✅
