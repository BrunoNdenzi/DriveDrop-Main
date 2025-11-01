# 📧 Supabase Email & SMTP Setup Guide

## ✅ **Email Verification Flow - Already Working!**

Your app **already has the correct flow**:

```
Sign Up → Email Sent → Redirected to Login → Must Verify Email → Can Login
```

**Code in SignUpScreen.tsx:**
```typescript
Alert.alert(
  'Verification Email Sent',
  'Please check your email for a verification link to complete your registration.',
  [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
);
```

✅ User can't login until email is verified (Supabase enforces this automatically)

---

## 🔧 **Step 1: Configure Custom SMTP**

### **Why Custom SMTP?**

**Default Supabase Email Service:**
- ❌ Limited to 4 emails per hour
- ❌ Goes to spam frequently
- ❌ No custom branding
- ❌ Not suitable for production

**Custom SMTP (e.g., Gmail, SendGrid, AWS SES):**
- ✅ Unlimited emails (within provider limits)
- ✅ Better deliverability
- ✅ Custom "From" address
- ✅ Professional appearance

---

## 📋 **Option 1: Gmail SMTP (Free, Easy Setup)**

### **Prerequisites:**
- Gmail account
- 2-Step Verification enabled
- App Password generated

### **Setup Steps:**

#### **1. Enable 2-Step Verification**
```
1. Go to: https://myaccount.google.com/security
2. Click "2-Step Verification"
3. Follow the setup process
```

#### **2. Generate App Password**
```
1. Go to: https://myaccount.google.com/apppasswords
2. Select "Mail" and "Other (Custom name)"
3. Name it: "DriveDrop Supabase"
4. Click "Generate"
5. Copy the 16-character password (save it securely!)
```

#### **3. Configure in Supabase**

**Go to:** [Supabase Dashboard → Authentication → Email Templates](https://supabase.com/dashboard/project/tgdewxxmfmbvvcelngeg/auth/templates)

**Click "Settings" tab → Scroll to "SMTP Settings"**

**Enter:**
```
SMTP Host: smtp.gmail.com
Port: 587
Username: your-email@gmail.com
Password: [16-character app password from step 2]
Sender Email: your-email@gmail.com
Sender Name: DriveDrop
```

**Test Connection:**
- Click "Send test email"
- Check your inbox
- ✅ If received, you're good!

---

## 📋 **Option 2: SendGrid (Professional, Free Tier)**

### **Why SendGrid?**
- ✅ 100 emails/day free forever
- ✅ Better deliverability than Gmail
- ✅ Email analytics
- ✅ No 2FA required

### **Setup Steps:**

#### **1. Create SendGrid Account**
```
1. Go to: https://signup.sendgrid.com/
2. Sign up (Free plan)
3. Verify your email
```

#### **2. Create API Key**
```
1. Go to: Settings → API Keys
2. Click "Create API Key"
3. Name: "DriveDrop Supabase"
4. Permissions: "Restricted Access"
   - Mail Send: Full Access
5. Click "Create & View"
6. Copy the API key (save it - shown only once!)
```

#### **3. Verify Sender Email**
```
1. Go to: Settings → Sender Authentication
2. Click "Verify a Single Sender"
3. Enter:
   - From Name: DriveDrop
   - From Email: noreply@yourdomain.com (or your email)
   - Reply To: support@yourdomain.com
   - Company: DriveDrop
   - Address: [Your business address]
4. Click "Create"
5. Check your email and verify
```

#### **4. Configure in Supabase**

**Go to:** Supabase Dashboard → Authentication → Email Templates → Settings

**Enter:**
```
SMTP Host: smtp.sendgrid.net
Port: 587
Username: apikey (literally the word "apikey")
Password: [Your SendGrid API Key from step 2]
Sender Email: noreply@yourdomain.com
Sender Name: DriveDrop
```

---

## 📋 **Option 3: AWS SES (Enterprise, Cheapest at Scale)**

### **Why AWS SES?**
- ✅ $0.10 per 1,000 emails
- ✅ Best deliverability
- ✅ Scalable to millions
- ❌ More complex setup

### **Quick Setup:**
```
1. Go to: https://aws.amazon.com/ses/
2. Sign up for AWS account
3. Verify your domain or email
4. Create SMTP credentials
5. Use the credentials in Supabase
```

**Full guide:** https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html

---

## 📧 **Step 2: Customize Email Templates**

### **Available Templates:**

Go to: [Supabase Dashboard → Authentication → Email Templates](https://supabase.com/dashboard/project/tgdewxxmfmbvvcelngeg/auth/templates)

You can customize:
1. **Confirm signup** - Email verification
2. **Magic Link** - Passwordless login
3. **Change Email Address** - Email change confirmation
4. **Reset Password** - Password reset

---

## 📝 **Recommended Templates**

### **1. Confirm Signup (Email Verification)**

**Subject:** `Verify your DriveDrop account`

**Body:**
```html
<h2>Welcome to DriveDrop! 🚗</h2>

<p>Hi {{ .Name }},</p>

<p>Thanks for signing up! To get started with DriveDrop, please verify your email address by clicking the button below:</p>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{ .ConfirmationURL }}" 
     style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
    Verify Email Address
  </a>
</p>

<p>Or copy and paste this link into your browser:</p>
<p style="word-break: break-all; color: #666;">{{ .ConfirmationURL }}</p>

<p><strong>This link expires in 24 hours.</strong></p>

<hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">

<p style="color: #6B7280; font-size: 14px;">
If you didn't create a DriveDrop account, you can safely ignore this email.
</p>

<p style="color: #6B7280; font-size: 14px;">
Best regards,<br>
The DriveDrop Team<br>
<a href="https://drivedrop.com" style="color: #2563EB;">drivedrop.com</a>
</p>
```

---

### **2. Reset Password**

**Subject:** `Reset your DriveDrop password`

**Body:**
```html
<h2>Password Reset Request</h2>

<p>Hi {{ .Name }},</p>

<p>We received a request to reset your DriveDrop password. Click the button below to create a new password:</p>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{ .ConfirmationURL }}" 
     style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
    Reset Password
  </a>
</p>

<p>Or copy and paste this link into your browser:</p>
<p style="word-break: break-all; color: #666;">{{ .ConfirmationURL }}</p>

<p><strong>This link expires in 1 hour.</strong></p>

<hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">

<p style="color: #6B7280; font-size: 14px;">
If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.
</p>

<p style="color: #6B7280; font-size: 14px;">
Best regards,<br>
The DriveDrop Team<br>
<a href="https://drivedrop.com" style="color: #2563EB;">drivedrop.com</a>
</p>
```

---

### **3. Change Email Address**

**Subject:** `Confirm your new email address`

**Body:**
```html
<h2>Email Address Change</h2>

<p>Hi {{ .Name }},</p>

<p>You recently requested to change your DriveDrop email address to this one. Click the button below to confirm:</p>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{ .ConfirmationURL }}" 
     style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
    Confirm New Email
  </a>
</p>

<p>Or copy and paste this link into your browser:</p>
<p style="word-break: break-all; color: #666;">{{ .ConfirmationURL }}</p>

<p><strong>This link expires in 24 hours.</strong></p>

<hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">

<p style="color: #6B7280; font-size: 14px;">
If you didn't request this change, please contact support immediately.
</p>

<p style="color: #6B7280; font-size: 14px;">
Best regards,<br>
The DriveDrop Team<br>
<a href="https://drivedrop.com" style="color: #2563EB;">drivedrop.com</a>
</p>
```

---

## 🎨 **Template Variables Available**

Use these in your templates:

- `{{ .Name }}` - User's first name
- `{{ .Email }}` - User's email
- `{{ .ConfirmationURL }}` - Verification/action link
- `{{ .Token }}` - Raw token (if needed)
- `{{ .TokenHash }}` - Token hash
- `{{ .SiteURL }}` - Your site URL

---

## ⚙️ **Step 3: Configure Auth Settings**

### **Go to:** [Auth → Settings](https://supabase.com/dashboard/project/tgdewxxmfmbvvcelngeg/auth/providers)

### **Email Auth Settings:**

```
✅ Enable Email Provider: ON
✅ Confirm email: ON (already enabled)
✅ Secure email change: ON (recommended)
✅ Double confirm email: OFF (unless you want extra security)

Email OTP Expiry: 3600 seconds (1 hour) ✅ Already done!
```

### **Site URL:**
```
https://drivedrop.us.com
```
(Or your actual domain)

### **Redirect URLs (Add these):**
```
https://drivedrop.us.com/auth/callback
https://drivedrop.us.com/*
exp://192.168.*:*/**
drivedrop://**
```

---

## 🧪 **Step 4: Test Email Flow**

### **Test Checklist:**

#### **1. Sign Up Email Verification**
```
1. Create new test account in mobile app
2. Check email inbox (and spam folder)
3. Click verification link
4. Verify redirects to app/login
5. Try to login before verification (should fail)
6. Try to login after verification (should succeed)
```

#### **2. Password Reset**
```
1. Go to Login screen
2. Click "Forgot Password"
3. Enter email
4. Check inbox for reset email
5. Click reset link
6. Create new password
7. Login with new password
```

#### **3. Email Change**
```
1. Login to app
2. Go to Profile/Settings
3. Change email address
4. Check new email for confirmation
5. Click confirmation link
6. Verify email updated
```

---

## 🚨 **Common Issues & Solutions**

### **Issue 1: Emails going to spam**

**Solutions:**
- ✅ Use custom SMTP (Gmail/SendGrid)
- ✅ Verify sender domain (SPF/DKIM records)
- ✅ Don't use words like "verify", "confirm" too much
- ✅ Include unsubscribe link (for marketing emails)
- ✅ Use professional email address (not noreply@gmail.com)

### **Issue 2: Emails not arriving**

**Check:**
1. SMTP credentials correct?
2. Port 587 open (not blocked by firewall)?
3. Sender email verified (SendGrid)?
4. Check spam folder
5. Try different email provider (Gmail, Outlook, Yahoo)

### **Issue 3: Verification link not working**

**Check:**
1. Site URL configured correctly in Supabase?
2. Redirect URLs include app deep links?
3. Link expired? (24 hour default)
4. User already verified?

---

## 📊 **Production Recommendations**

### **Best Choice for Launch:**

**SendGrid Free Tier** ✅

**Why:**
- ✅ 100 emails/day (enough for initial launch)
- ✅ Better deliverability than Gmail
- ✅ Professional appearance
- ✅ Email analytics
- ✅ Easy to upgrade when needed

**Cost at Scale:**
- 0-100 emails/day: **FREE**
- 100-40K emails/month: **$19.95/month**
- 40K-100K emails/month: **$89.95/month**

---

## 🎯 **Quick Setup Checklist**

### **Before Launch:**

```
□ Custom SMTP configured (Gmail or SendGrid)
□ Test email sent successfully
□ Sender email verified
□ Email templates customized with branding
□ Site URL configured
□ Redirect URLs added
□ Test signup email verification (works!)
□ Test password reset (works!)
□ Emails landing in inbox (not spam)
□ OTP expiry set to 1 hour ✅
□ Leaked password protection enabled ✅
□ Email confirmation enabled ✅
```

---

## 📞 **Next Steps**

1. **Choose SMTP Provider** (I recommend SendGrid for start)
2. **Follow setup steps** (takes 10-15 minutes)
3. **Customize email templates** (copy templates above)
4. **Test thoroughly** (use test checklist)
5. **Monitor deliverability** (check spam rates)

---

## 🆘 **Need Help?**

**Common Questions:**

**Q: Which SMTP should I use?**
A: Start with SendGrid free tier. Upgrade to AWS SES if you grow past 100 emails/day.

**Q: Do I need a custom domain?**
A: Not required, but recommended for professional appearance. You can use your personal email for now.

**Q: How do I prevent emails going to spam?**
A: Use SendGrid/SES, verify domain, warm up sending (start with low volume), avoid spam trigger words.

**Q: Can I use free Gmail?**
A: Yes, but limited to ~100 emails/day and may go to spam more often.

---

## ✅ **Your Current Status**

### **Already Working:**
✅ Email verification flow (sign up → verify email → login)
✅ User redirected to login after signup
✅ Can't login without email verification
✅ OTP expiry set to 1 hour
✅ Leaked password protection enabled

### **Need to Setup:**
⏳ Custom SMTP (currently using Supabase default - 4 emails/hour limit)
⏳ Customize email templates
⏳ Add your branding/logo to emails

### **Production Ready:**
Once SMTP is configured and tested, your email system will be **100% production ready!** 🚀

