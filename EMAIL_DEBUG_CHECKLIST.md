# Email Sending Issues - Debug Checklist

## Problem
Emails are not being sent:
1. ❌ Driver application submission confirmation email
2. ❌ Admin notification email on new application
3. ❌ Driver approval email with credentials

## Architecture
- **Website** (Vercel): Next.js frontend + API routes
  - Calls backend Brevo API for emails (primary)
  - Falls back to nodemailer/Gmail SMTP (fallback)
- **Backend** (Railway): Express API
  - Route: `/api/v1/emails/send-welcome`
  - Service: BrevoService (uses Brevo API key)

## Root Cause Analysis

### 1. Check Backend Availability
**Issue**: Website may not be able to reach backend
**Check**:
```bash
# From browser console or curl
fetch('https://drivedrop-main-production.up.railway.app/api/v1/health')
  .then(r => r.json())
  .then(console.log)
```

### 2. Check Environment Variables on Vercel
**Issue**: Website doesn't know where backend is
**Required Variables** (in Vercel dashboard):
```env
NEXT_PUBLIC_API_URL=https://drivedrop-main-production.up.railway.app/api/v1

# Gmail SMTP fallback
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=infos@drivedrop.us.com
SMTP_PASS=vjnkgiuitlyyuwxs
SMTP_FROM=DriveDrop <infos@drivedrop.us.com>
```

### 3. Check Environment Variables on Railway
**Issue**: Backend can't send emails via Brevo
**Required Variables** (in Railway dashboard):
```env
BREVO_ENABLED=true
BREVO_API_KEY=xkeysib-[REDACTED — set in Railway dashboard]
BREVO_SENDER_SUPPORT=support@drivedrop.us.com
BREVO_SENDER_CARRIER=carrier@drivedrop.us.com
BREVO_SENDER_BROKER=broker@drivedrop.us.com
BREVO_SENDER_ADMIN=admin@drivedrop.us.com

FRONTEND_URL=https://drivedrop.us.com

# Supabase (for email logging)
SUPABASE_URL=https://xzpqzigxvbnphtjobcse.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### 4. Check Network/CORS
**Issue**: Railway may be blocking website requests
**Railway CORS Config**:
```env
CORS_ORIGIN=https://drivedrop.us.com,https://www.drivedrop.us.com,http://localhost:3000
CORS_METHODS=GET,POST,PUT,PATCH,DELETE
CORS_CREDENTIALS=true
```

## Email Flow Analysis

### Driver Application Submission
**File**: `website/src/app/api/drivers/apply/route.ts`
**Line 264-273**: Tries backend Brevo first
```typescript
const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'
await fetch(`${backendUrl}/emails/send-welcome`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email,
    firstName,
    lastName: fullName.split(' ').slice(1).join(' '),
    role: 'driver'
  })
})
```

**Line 280-357**: Falls back to nodemailer
```typescript
await sendEmail({
  to: email,
  subject: 'Driver Application Received - DriveDrop',
  html: `<!-- Long HTML template -->`
})
```

**Possible Issues**:
- `NEXT_PUBLIC_API_URL` not set on Vercel → defaults to localhost
- Backend `/api/v1/emails/send-welcome` returns error
- Nodemailer fallback also fails (SMTP vars not set)

### Driver Approval
**File**: `website/src/app/api/drivers/applications/[id]/approve/route.ts`
**Line 105-209**: Only uses nodemailer (no Brevo fallback)
```typescript
await sendEmail({
  to: application.email,
  subject: 'Your Driver Application Has Been Approved! - DriveDrop',
  html: `<!-- Contains temporary password -->`
})
```

**Possible Issues**:
- Nodemailer SMTP vars not set on Vercel
- Gmail app password expired/revoked
- Email caught in spam filter

## Quick Fixes

### Fix 1: Set Vercel Environment Variables
1. Go to Vercel dashboard → Your website project
2. Settings → Environment Variables
3. Add all variables from section 2 above
4. Redeploy

### Fix 2: Set Railway Environment Variables
1. Go to Railway dashboard → drivedrop-main-production
2. Variables tab
3. Add all variables from section 3 above
4. Redeploy backend

### Fix 3: Test Email Sending Manually
**Backend test** (from Railway logs or local):
```bash
curl -X POST https://drivedrop-main-production.up.railway.app/api/v1/emails/send-welcome \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-test@email.com",
    "firstName": "Test",
    "lastName": "User",
    "role": "driver"
  }'
```

**Website test** (from browser console on drivedrop.us.com):
```javascript
fetch('/api/drivers/apply', {
  method: 'POST',
  body: new FormData(document.querySelector('form'))
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

## Debugging Steps

### Step 1: Check Backend Health
```bash
curl https://drivedrop-main-production.up.railway.app/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Step 2: Check Email Endpoint
```bash
curl https://drivedrop-main-production.up.railway.app/api/v1/emails/send-welcome \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","firstName":"Test","lastName":"User","role":"driver"}'
```

### Step 3: Check Railway Logs
- Go to Railway dashboard
- Click on drivedrop-main-production
- Click "Deployments" → Latest deployment
- Click "View Logs"
- Look for email-related errors

### Step 4: Check Vercel Logs
- Go to Vercel dashboard
- Click your website project
- Click "Logs" tab
- Filter by `/api/drivers/apply` or `/api/drivers/applications`
- Look for email errors

### Step 5: Check Brevo Dashboard
- Go to https://app.brevo.com
- Click "Transactional" → "Real-time Activity"
- See if any emails are being sent/bounced

## Most Likely Issues

### Issue 1: Missing Environment Variables ⭐⭐⭐⭐⭐
**Probability**: 90%
**Fix**: Add all required env vars to Vercel and Railway

### Issue 2: Backend Not Running
**Probability**: 60%
**Fix**: Check Railway deployment status, redeploy if needed

### Issue 3: CORS Blocking Requests
**Probability**: 40%
**Fix**: Add website domain to CORS_ORIGIN on Railway

### Issue 4: Gmail App Password Expired
**Probability**: 30%
**Fix**: Generate new Gmail app password, update SMTP_PASS

### Issue 5: Brevo API Key Invalid
**Probability**: 20%
**Fix**: Check Brevo dashboard, generate new API key if needed

## Success Criteria

✅ Driver submits application → receives confirmation email
✅ Admin receives notification email about new application
✅ Admin approves driver → driver receives email with temporary password
✅ Driver can log in with temporary password
✅ Driver forced to change password on first login

## Next Steps

1. ✅ Run this checklist to identify the issue
2. ⬜ Check Railway/Vercel environment variables
3. ⬜ Test backend `/api/v1/emails/send-welcome` endpoint
4. ⬜ Check Railway logs for email errors
5. ⬜ Test driver application submission end-to-end
6. ⬜ Test driver approval end-to-end
