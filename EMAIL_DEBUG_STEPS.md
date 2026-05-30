# Email Debugging Checklist - Step by Step

## Current Situation
- ✅ Backend is online and responding
- ✅ Email endpoint returns "success" (200 OK)
- ❌ Emails are not being received

## Possible Causes

### 1. **BREVO_ENABLED is false** (Most Likely)
**Symptom**: API returns success but no emails sent
**Check**: Railway environment variables
**Fix**: Ensure `BREVO_ENABLED=true` (exactly this string, case-sensitive)

### 2. **Sender emails not verified in Brevo**
**Symptom**: Brevo accepts emails but doesn't send them
**Affected senders**:
- support@drivedrop.us.com (client emails)
- carrier@drivedrop.us.com (driver emails)
- broker@drivedrop.us.com (broker emails)
- admin@drivedrop.us.com (admin emails)

**How to check**:
1. Go to https://app.brevo.com
2. Click "Senders, Domains & Dedicated IPs" in left menu
3. Check if all 4 email addresses show "Verified" ✓
4. If not verified, you'll see "Pending verification" or "Not verified"

**How to fix**:
1. Click "Add a sender"
2. Enter each email address
3. Brevo will send verification email to that address
4. Click verification link in email
5. Repeat for all 4 addresses

### 3. **Brevo API key is invalid/expired**
**Check Railway variables**:
- `BREVO_API_KEY` should start with `xkeysib-`

**How to verify**:
1. Go to https://app.brevo.com
2. Click your profile icon (top right)
3. Click "SMTP & API"
4. Check if the API key matches the one on Railway
5. If not, generate a new key and update Railway

### 4. **Brevo account has reached sending limit**
**How to check**:
1. Go to https://app.brevo.com
2. Look for any warnings or notifications
3. Check "Statistics" → "Email" to see if you've hit daily limits

### 5. **Email logs are not being created**
This would indicate the email service is not even trying to send.

---

## Step-by-Step Debugging

### Step 1: Check Supabase Email Logs

Run these queries in Supabase SQL Editor:

**File**: `EMAIL_DEBUG_QUERIES.sql`

Key queries:
```sql
-- Check recent emails
SELECT * FROM email_logs 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Check Bruno's emails specifically
SELECT * FROM email_logs 
WHERE recipient_email = 'brunondenzi80@gmail.com'
ORDER BY created_at DESC;
```

**Expected Results**:
- ✅ **If working**: You'll see entries with `status='sent'` and `brevo_message_id`
- ❌ **If broken**: You'll see `status='failed'` with `error_message`
- ⚠️ **If not enabled**: No entries at all (BREVO_ENABLED=false)

### Step 2: Check Railway Logs

1. Go to Railway dashboard
2. Click "DriveDrop-Main" project
3. Click "Deployments" → Latest
4. Click "View Logs"
5. Search for:
   - `"Email sent"` ← Should appear if Brevo is working
   - `"Email would be sent"` ← Appears when BREVO_ENABLED=false
   - `"Brevo email error"` ← Appears when Brevo fails
   - `"brunondenzi80@gmail.com"` ← Our test email

**What to look for**:
```
✅ Email sent: driver_welcome to brunondenzi80@gmail.com  ← GOOD!
📧 Email would be sent: { to: 'brunondenzi80@gmail.com' }  ← BAD (Brevo disabled)
❌ Brevo email error: Sender email not verified           ← BAD (Need to verify senders)
```

### Step 3: Check Brevo Dashboard

1. Go to https://app.brevo.com
2. Click "Transactional" → "Email" in left menu
3. Click "Real-time Activity"
4. Look for emails to brunondenzi80@gmail.com
5. Check the status:
   - ✅ **Delivered**: Email was sent successfully
   - ⏳ **Pending**: Email is being processed
   - ❌ **Bounced**: Email address is invalid
   - 🚫 **Blocked**: Sender not verified or API issue

### Step 4: Check Sender Verification

1. In Brevo dashboard
2. Click "Senders, Domains & Dedicated IPs"
3. Verify ALL these emails are listed and verified:
   - support@drivedrop.us.com
   - carrier@drivedrop.us.com
   - broker@drivedrop.us.com  
   - admin@drivedrop.us.com

**If not verified**:
1. You need access to those email inboxes
2. Brevo sends verification emails to each address
3. Click verification link in each email

---

## Quick Tests You Can Run

### Test 1: Check Railway Environment (30 seconds)
```bash
# Look for these in Railway Variables tab:
BREVO_ENABLED=true  ← Must be exactly "true"
BREVO_API_KEY=xkeysib-... ← Must start with xkeysib-
```

### Test 2: Query Supabase Logs (1 minute)
```sql
-- In Supabase SQL Editor:
SELECT 
  email_type,
  recipient_email,
  status,
  error_message,
  created_at
FROM email_logs
WHERE recipient_email = 'brunondenzi80@gmail.com'
ORDER BY created_at DESC
LIMIT 5;
```

### Test 3: Check Brevo Activity (1 minute)
- Go to Brevo → Transactional → Real-time Activity
- Look for email to brunondenzi80@gmail.com
- Check status

---

## Most Likely Issues (Ranked)

### 🔴 Issue 1: BREVO_ENABLED is not "true" (70% probability)
**Symptom**: API returns success but no logs, no emails
**Fix**: Set `BREVO_ENABLED=true` on Railway (case-sensitive!)

### 🟡 Issue 2: Sender emails not verified (20% probability)
**Symptom**: Brevo logs show "blocked" or "not sent"
**Fix**: Verify all 4 sender emails in Brevo dashboard

### 🟢 Issue 3: Emails going to spam (5% probability)
**Symptom**: Emails are "delivered" in Brevo but not in inbox
**Fix**: Check spam/junk folder

### 🟢 Issue 4: Brevo account issue (5% probability)
**Symptom**: All emails failing with same error
**Fix**: Check Brevo dashboard for account warnings

---

## What to Do Next

1. **Run Supabase query** from `EMAIL_DEBUG_QUERIES.sql`
2. **Check Railway logs** for the actual status
3. **Report back** what you see:
   - Are there entries in `email_logs` table?
   - What's the `status` field? (sent/failed/other)
   - What's the `error_message` if failed?
   - What do Railway logs say? ("Email sent" or "Email would be sent")

Once you share those results, I can pinpoint the exact issue!
