# Supabase Email Configuration Guide

## Overview
Configure Supabase to use our custom SMTP for all authentication emails (verification, password reset, magic links) with DriveDrop branding.

## Current Setup
✅ **Hybrid Email System Active:**
- Gmail recipients (@gmail.com) → Gmail SMTP (infos@calkons.com)
- Non-Gmail recipients → Brevo SMTP (support@drivedrop.us.com)
- Backend API: `https://drivedrop-main-production.up.railway.app`

---

## Configuration Steps

### Step 1: Access Supabase SMTP Settings

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your DriveDrop project
3. Navigate to: **Project Settings** → **Authentication** → **SMTP Settings**

### Step 2: Choose SMTP Provider

**Recommended: Use Gmail SMTP** (Best deliverability for all recipients)

#### Gmail SMTP Configuration
```
Enable Custom SMTP: ✅ ON

SMTP Settings:
├── Host: smtp.gmail.com
├── Port: 587
├── Username: infos@calkons.com
└── Password: vjnkgiuitlyyuwxs

Sender Details:
├── Sender Name: DriveDrop
└── Sender Email: infos@calkons.com
```

**Alternative: Use Brevo SMTP** (If you prefer domain email)

#### Brevo SMTP Configuration
```
Enable Custom SMTP: ✅ ON

SMTP Settings:
├── Host: smtp-relay.brevo.com
├── Port: 587
├── Username: support@drivedrop.us.com
└── Password: [Your Brevo SMTP Password - NOT API key]

Sender Details:
├── Sender Name: DriveDrop
└── Sender Email: support@drivedrop.us.com
```

**Note:** To get Brevo SMTP password:
1. Brevo Dashboard → SMTP & API
2. Create SMTP key (different from API key)

---

### Step 3: Customize Email Templates

Navigate to: **Authentication** → **Email Templates**

#### 1. Confirm Signup (Email Verification)
```html
<h2>Welcome to DriveDrop! 🚗📦</h2>

<p>Hi {{ .Name }},</p>

<p>Thank you for signing up! Please verify your email address to complete your registration and start using DriveDrop.</p>

<p><a href="{{ .ConfirmationURL }}" style="background: linear-gradient(135deg, #00B8A9 0%, #008B80 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Verify Email Address</a></p>

<p>Or copy and paste this link into your browser:</p>
<p>{{ .ConfirmationURL }}</p>

<p style="color: #856404; background: #fff3cd; padding: 10px; border-radius: 4px;">
⚠️ <strong>Security Notice:</strong> This verification link will expire in 24 hours. If you didn't create a DriveDrop account, please ignore this email.
</p>

<p>Best regards,<br><strong style="color: #00B8A9;">The DriveDrop Team</strong></p>
```

**Subject:** `Verify Your DriveDrop Email Address 📧`

#### 2. Reset Password
```html
<h2>Password Reset Request 🔐</h2>

<p>Hi {{ .Name }},</p>

<p>We received a request to reset your DriveDrop password. Click the button below to create a new password:</p>

<p><a href="{{ .ConfirmationURL }}" style="background: linear-gradient(135deg, #00B8A9 0%, #008B80 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a></p>

<p>Or copy and paste this link into your browser:</p>
<p>{{ .ConfirmationURL }}</p>

<p style="color: #856404; background: #fff3cd; padding: 10px; border-radius: 4px;">
⚠️ <strong>Security Notice:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
</p>

<p>Best regards,<br><strong style="color: #00B8A9;">The DriveDrop Team</strong></p>
```

**Subject:** `Reset Your DriveDrop Password 🔐`

#### 3. Magic Link
```html
<h2>Sign In to DriveDrop 🔗</h2>

<p>Hi {{ .Name }},</p>

<p>Click the button below to securely sign in to your DriveDrop account:</p>

<p><a href="{{ .ConfirmationURL }}" style="background: linear-gradient(135deg, #00B8A9 0%, #008B80 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Sign In</a></p>

<p>Or copy and paste this link into your browser:</p>
<p>{{ .ConfirmationURL }}</p>

<p style="color: #856404; background: #fff3cd; padding: 10px; border-radius: 4px;">
⚠️ <strong>Security Notice:</strong> This link will expire in 1 hour. If you didn't request this, please ignore this email.
</p>

<p>Best regards,<br><strong style="color: #00B8A9;">The DriveDrop Team</strong></p>
```

**Subject:** `Sign In to DriveDrop 🔗`

#### 4. Email Change Confirmation
```html
<h2>Email Change Request ✉️</h2>

<p>Hi {{ .Name }},</p>

<p>We received a request to change your email address to {{ .NewEmail }}. Click the button below to confirm this change:</p>

<p><a href="{{ .ConfirmationURL }}" style="background: linear-gradient(135deg, #00B8A9 0%, #008B80 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Confirm Email Change</a></p>

<p>Or copy and paste this link into your browser:</p>
<p>{{ .ConfirmationURL }}</p>

<p style="color: #856404; background: #fff3cd; padding: 10px; border-radius: 4px;">
⚠️ <strong>Security Notice:</strong> If you didn't request this change, please ignore this email and contact support immediately.
</p>

<p>Best regards,<br><strong style="color: #00B8A9;">The DriveDrop Team</strong></p>
```

**Subject:** `Confirm Your Email Change ✉️`

---

### Step 4: Configure URL Settings

Navigate to: **Authentication** → **URL Configuration**

```
Site URL: drivedrop://auth/callback

Redirect URLs (Add all of these): 
  - drivedrop://auth/callback
  - drivedrop://**
  - exp://127.0.0.1:8081/--/** (for Expo Go development)
  - exp://localhost:8081/--/** (for Expo Go development)
  - https://drivedrop.us.com/** (for web, if applicable)
```

**Important:** The `drivedrop://auth/callback` URL is what Supabase will redirect to after email verification.

---

### Step 5: Test Email Delivery

#### Test 1: Email Verification
1. Create a new test account in your mobile app
2. Check inbox for verification email
3. Verify branded DriveDrop design
4. Click verification link and confirm it works

#### Test 2: Password Reset
1. Click "Forgot Password" in mobile app
2. Enter email address
3. Check inbox for reset email
4. Click link and verify reset flow works

#### Test 3: Gmail vs Non-Gmail
- Test with Gmail account → Should receive email instantly
- Test with ProtonMail/Outlook → Should receive email via Brevo

---

## Troubleshooting

### Emails Not Arriving

**Check 1: SMTP Credentials**
```bash
# Test SMTP connection
curl -v --url 'smtp://smtp.gmail.com:587' \
  --ssl-reqd \
  --mail-from 'infos@calkons.com' \
  --mail-rcpt 'test@example.com' \
  --user 'infos@calkons.com:vjnkgiuitlyyuwxs'
```

**Check 2: Supabase Logs**
- Dashboard → Authentication → Logs
- Look for email send errors

**Check 3: Spam Folder**
- Check recipient's spam/junk folder
- Mark as "Not Spam" to train filters

**Check 4: Rate Limits**
- Gmail SMTP: 500 emails/day
- Brevo: Check your plan limits

### Email Formatting Issues

**Problem:** Templates not rendering correctly

**Solution:** 
- Ensure HTML is properly formatted
- Test with different email clients
- Use inline CSS (no `<style>` tags)

### Deep Linking Not Working

**Problem:** Verification links open in browser instead of app

**Solution:**
1. Add URL scheme to mobile app (expo/react-native config)
2. Configure redirect URLs in Supabase
3. Test deep linking with test URLs

---

## Integration with Welcome Emails

Your existing welcome email trigger will still work alongside Supabase's verification emails:

**Email Flow:**
1. User signs up → **Supabase sends verification email** (via configured SMTP)
2. User verifies email → **Backend trigger sends welcome email** (via our API)

This gives users:
- Immediate verification email (Supabase)
- Welcome email after verification (Our backend)

---

## Security Best Practices

✅ **Implemented:**
- SMTP credentials in Railway environment variables
- 24-hour expiration for verification links
- 1-hour expiration for password reset
- HTTPS for all email links
- Clear security warnings in emails

⚠️ **Additional Recommendations:**
- Enable 2FA for Supabase dashboard
- Monitor authentication logs regularly
- Set up rate limiting for auth endpoints
- Review failed login attempts weekly

---

## Monitoring & Maintenance

### Weekly Checks
- [ ] Review Supabase auth logs for anomalies
- [ ] Check email delivery success rate
- [ ] Monitor Gmail SMTP quota usage

### Monthly Checks
- [ ] Update email templates if needed
- [ ] Review and update security policies
- [ ] Check for Supabase platform updates

### When to Switch from Gmail to Brevo
- Gmail SMTP works great for launch (500 emails/day)
- Switch to Brevo when approaching 300+ emails/day
- Brevo gives better analytics and higher limits
- Both work with our hybrid system

---

## Support

**If issues persist:**
1. Check Railway logs: `railway logs`
2. Check Supabase logs: Dashboard → Logs
3. Test with diagnostics endpoint: `POST /api/v1/diagnostics/email/test`
4. Review this configuration guide

**Email Team:** support@drivedrop.us.com

---

## ✅ Configuration Checklist

- [ ] SMTP settings configured in Supabase
- [ ] Sender email verified and working
- [ ] Email templates customized with DriveDrop branding
- [ ] URL configuration set for mobile deep linking
- [ ] Test email verification with new signup
- [ ] Test password reset flow
- [ ] Test with both Gmail and non-Gmail recipients
- [ ] Welcome email trigger still working
- [ ] All email templates using correct colors (#00B8A9)
- [ ] Security notices included in all templates

---

## Summary

**What This Achieves:**
✅ All Supabase auth emails use DriveDrop branding  
✅ Leverages our hybrid SMTP (Gmail + Brevo)  
✅ No code changes needed in mobile app  
✅ Automatic email verification on signup  
✅ Professional, consistent email design  
✅ Works alongside our custom welcome emails  

**Next Steps:**
1. Configure SMTP in Supabase Dashboard (5 minutes)
2. Customize email templates (10 minutes)
3. Test with real signup (2 minutes)
4. You're done! 🎉
