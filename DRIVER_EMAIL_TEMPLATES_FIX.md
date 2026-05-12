# Driver Application Email Templates Fix

## Overview
Fixed driver application email flow to send appropriate emails at each stage:
1. **Application Received** - Sent when driver submits application (pending review)
2. **Application Approved** - Sent when admin approves with login credentials

## Changes Made

### 1. Added New Email Template Types
**File**: `backend/src/types/email.types.ts`

Added three new email template types:
- `driver_application_received` - Confirmation email on submission
- `driver_application_approved` - Approval email with credentials
- `admin_driver_application` - Admin notification of new application

### 2. Created Email Templates
**File**: `backend/src/services/EmailTemplates.ts`

#### Driver Application Received Template
- Subject: "Driver Application Received — DriveDrop"
- Sender: driver (carrier@drivedrop.us.com)
- Content:
  - Thank you message
  - What happens next (review process, timeline)
  - Application ID for reference
  - Contact information

#### Driver Application Approved Template
- Subject: "Application Approved — Welcome to DriveDrop! 🎉"
- Sender: driver (carrier@drivedrop.us.com)
- Content:
  - Congratulations message
  - Login credentials (email + temporary password)
  - Security notice about password change
  - Getting started steps
  - Payment information (90% payout)
  - Admin comment (if provided)
  - Login button with link

#### Admin Driver Application Template
- Subject: "New Driver Application Submitted — DriveDrop"
- Sender: admin
- Content:
  - Applicant information table
  - Document upload status checklist
  - Review application button
  - Link to admin dashboard

### 3. Created New Backend Routes
**File**: `backend/src/routes/email.routes.ts`

#### POST /api/v1/emails/send-driver-application-received
- Parameters: `email`, `firstName`, `fullName`, `applicationId`
- Sends application received confirmation email
- Returns success/error response

#### POST /api/v1/emails/send-driver-application-approved
- Parameters: `email`, `firstName`, `fullName`, `temporaryPassword`, `adminComment`
- Sends approval email with login credentials
- Returns success/error response

#### POST /api/v1/emails/send-admin-driver-application
- Parameters: `email`, `fullName`, `phone`, `licenseState`, `applicationId`, etc.
- Sends admin notification of new application
- Returns success/error response

### 4. Updated Driver Application Submission
**File**: `website/src/app/api/drivers/apply/route.ts`

**Before**:
```typescript
await fetch(`${backendUrl}/emails/send-welcome`, {
  method: 'POST',
  body: JSON.stringify({
    email, firstName, lastName, role: 'driver'
  })
})
```

**After**:
```typescript
await fetch(`${backendUrl}/emails/send-driver-application-received`, {
  method: 'POST',
  body: JSON.stringify({
    email, firstName, fullName, applicationId: application.id
  })
})
```

### 5. Fixed Approval Email Sending
**File**: `website/src/app/api/drivers/applications/[id]/approve/route.ts`

**Before**:
- Used nodemailer directly (105+ lines of HTML)
- No SMTP configured on Vercel → Failed silently
- Railway logs showed no approval email activity

**After**:
```typescript
await fetch(`${backendUrl}/emails/send-driver-application-approved`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: application.email,
    firstName,
    fullName: application.full_name,
    temporaryPassword,
    adminComment: adminComment || ''
  })
})
```

- Removed unused `sendEmail` import
- Now uses Brevo via backend API
- Will appear in Railway logs
- Consistent with all other emails

## Testing Checklist

### 1. Test Application Submission
- [ ] Submit driver application via website
- [ ] Check email inbox for "Driver Application Received" email
- [ ] Verify email contains:
  - [ ] Correct applicant name
  - [ ] Application ID
  - [ ] Timeline (3-5 business days)
  - [ ] Contact information
- [ ] Check Railway logs for: "✅ Email sent: driver_application_received to [email]"

### 2. Test Application Approval
- [ ] Log in to admin dashboard
- [ ] Navigate to driver applications
- [ ] Approve the test application
- [ ] Check email inbox for "Application Approved" email
- [ ] Verify email contains:
  - [ ] Congratulations message
  - [ ] Login credentials (email + temporary password)
  - [ ] Security notice
  - [ ] Getting started steps
  - [ ] Login button/link
  - [ ] Payment information (90% payout)
- [ ] Check Railway logs for: "✅ Email sent: driver_application_approved to [email]"
- [ ] Test login with provided credentials
- [ ] Verify password change is required on first login

### 3. Verify Email Infrastructure
- [ ] Check Brevo dashboard for both emails
- [ ] Verify sender email is carrier@drivedrop.us.com
- [ ] Confirm delivery status
- [ ] Test email rendering on different clients (Gmail, Outlook, etc.)

## Deployment Steps

### Backend (Railway)
1. Push changes to GitHub main branch
2. Railway will auto-deploy
3. Wait for deployment to complete
4. Check Railway logs for:
   - "✅ Brevo email service initialized successfully"
   - Verify BREVO_ENABLED=true

### Frontend (Vercel)
1. Changes to `/api/drivers/*` routes auto-deploy
2. Vercel will rebuild and deploy
3. Wait for deployment to complete
4. Test API routes

## Rollback Plan
If issues occur:
1. Revert commits in GitHub
2. Railway will auto-deploy previous version
3. Test with previous welcome email flow

## Environment Variables Required

### Railway (Backend)
- `BREVO_ENABLED=true` ✅ Already set
- `BREVO_API_KEY` ✅ Already set
- `SUPABASE_URL` ✅ Already set
- `SUPABASE_SERVICE_ROLE_KEY` ✅ Already set
- `FRONTEND_URL=https://drivedrop.us.com` ✅ Already set

### Vercel (Website)
- `NEXT_PUBLIC_API_URL=https://drivedrop-main-production.up.railway.app/api/v1` ✅ Already set

## Expected Behavior

### On Application Submission
1. Driver fills out application form on website
2. Application saved to database
3. Email sent via Brevo: "Application Received"
4. Railway logs: "✅ Email sent: driver_application_received to [email]"
5. Driver receives email confirming submission and review timeline

### On Application Approval
1. Admin approves application in dashboard
2. User account created in Supabase Auth
3. Application status updated to "approved"
4. Email sent via Brevo: "Application Approved" with credentials
5. Railway logs: "✅ Email sent: driver_application_approved to [email]"
6. Driver receives email with login credentials
7. Driver can log in with temporary password
8. Driver forced to change password on first login

## Verification Queries

### Check Application Status
```sql
SELECT id, full_name, email, status, reviewed_at, admin_comment
FROM driver_applications
WHERE email = 'test@example.com';
```

### Check User Account Created
```sql
SELECT id, email, created_at
FROM auth.users
WHERE email = 'test@example.com';
```

### Check Profile Created
```sql
SELECT id, role, full_name, email
FROM profiles
WHERE email = 'test@example.com';
```

### Check Email Logs (if logging is implemented)
```sql
SELECT *
FROM email_logs
WHERE recipient_email = 'test@example.com'
ORDER BY created_at DESC
LIMIT 10;
```

## Notes

- All emails now use Brevo API for consistency
- No more nodemailer/SMTP configuration needed on website
- All email activity will appear in Railway logs
- Brevo dashboard shows delivery status and analytics
- Email templates use DriveDrop brand colors and styling
- Temporary passwords are 12 characters with mixed case, numbers, and symbols
- Security notice included about password change requirement

## Success Criteria

✅ Application submission sends "Application Received" email  
✅ Email contains correct applicant information and application ID  
✅ Approval sends "Application Approved" email with credentials  
✅ Email contains temporary password and login link  
✅ Driver can log in with temporary password  
✅ Both emails appear in Railway logs  
✅ Both emails appear in Brevo dashboard  
✅ No errors in Railway or Vercel logs  
✅ Email rendering works across different email clients
