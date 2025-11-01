# 🚀 DriveDrop - Go Live Checklist

**Target Launch Date:** _____________  
**Status:** Pre-Launch Preparation  
**Last Updated:** January 27, 2025

---

## ✅ PHASE 1: CRITICAL - MUST COMPLETE BEFORE LAUNCH

### 1. Payment System - Switch to Production Mode 🔴 CRITICAL

**Current Status:** ❌ Test Mode (sk_test_...)

**Required Actions:**

#### A. Stripe Account Activation
- [ ] **Complete Stripe Business Verification**
  - Go to: https://dashboard.stripe.com/account/onboarding
  - Submit: Business details, tax information, bank account
  - Wait for approval (typically 1-3 business days)

#### B. Get Production API Keys
- [ ] Login to Stripe Dashboard → Developers → API Keys
- [ ] **Copy Live Keys** (NOT test keys):
  ```
  Publishable Key: pk_live_...
  Secret Key: sk_live_...
  ```
- [ ] **Create Webhook Endpoint**:
  - URL: `https://drivedrop-main-production.up.railway.app/api/v1/webhooks/stripe`
  - Events to listen:
    - `payment_intent.succeeded`
    - `payment_intent.payment_failed`
    - `charge.refunded`
  - Copy webhook signing secret: `whsec_...`

#### C. Update Backend (Railway)
- [ ] Go to Railway Dashboard → drivedrop-main-production
- [ ] Update Environment Variables:
  ```bash
  STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY
  STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_KEY
  STRIPE_WEBHOOK_SECRET=whsec_YOUR_LIVE_SECRET
  
  EXPO_PUBLIC_STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_KEY
  EXPO_PUBLIC_STRIPE_WEBHOOK_SECRET=whsec_YOUR_LIVE_SECRET
  ```
- [ ] Save and wait for auto-redeploy (2-3 minutes)

#### D. Update Mobile App (EAS Secrets)
- [ ] Run these commands:
  ```powershell
  cd mobile
  eas secret:create --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value "pk_live_YOUR_KEY" --type string
  eas secret:create --name EXPO_PUBLIC_STRIPE_SECRET_KEY --value "sk_live_YOUR_KEY" --type string
  ```
- [ ] Rebuild APK: `eas build --platform android --profile production`

#### E. Test Real Payment
- [ ] Use YOUR OWN real credit card
- [ ] Create a shipment with $0.50 minimum charge
- [ ] Verify charge appears in Stripe Dashboard (Live Mode)
- [ ] Check money hits your bank account (within 2-7 days)

**⚠️ CRITICAL: Without this, you cannot charge real customers!**

---

### 2. SMS & Phone Verification - Production 🔴 CRITICAL

**Current Status:** ❌ Test SID (AC0000000...)

**Required Actions:**

#### A. Twilio Account Setup
- [ ] Go to: https://console.twilio.com/
- [ ] **Upgrade to Paid Account** (Cannot send to real numbers on trial)
  - Add payment method
  - Initial deposit: $20 recommended
- [ ] **Purchase Phone Number**:
  - US number: ~$1/month
  - SMS-enabled
  - Voice-enabled (optional, for future voice features)

#### B. Get Production Credentials
- [ ] Account SID: `AC...` (NOT AC000000...)
- [ ] Auth Token: From Console Dashboard
- [ ] Verify Service SID:
  - Go to: Verify → Services
  - Create new service: "DriveDrop SMS Verification"
  - Copy Service SID: `VA...`

#### C. Update Backend (Railway)
- [ ] Update these variables:
  ```bash
  TWILIO_ACCOUNT_SID=AC_YOUR_REAL_SID
  TWILIO_AUTH_TOKEN=YOUR_REAL_TOKEN
  TWILIO_PHONE_NUMBER=+1YOUR_PURCHASED_NUMBER
  TWILIO_VERIFY_SERVICE_SID=VA_YOUR_SERVICE_SID
  
  EXPO_PUBLIC_TWILIO_ACCOUNT_SID=AC_YOUR_REAL_SID
  EXPO_PUBLIC_TWILIO_AUTH_TOKEN=YOUR_REAL_TOKEN
  EXPO_PUBLIC_TWILIO_PHONE_NUMBER=+1YOUR_PURCHASED_NUMBER
  EXPO_PUBLIC_TWILIO_VERIFY_SERVICE_SID=VA_YOUR_SERVICE_SID
  ```

#### D. Test SMS
- [ ] Register new user with YOUR phone number
- [ ] Verify SMS code arrives
- [ ] Check Twilio logs for delivery confirmation

**⚠️ CRITICAL: Without this, users cannot sign up or verify phone numbers!**

---

### 3. Database Security - Row Level Security (RLS) 🔴 CRITICAL

**Current Status:** ⚠️ Needs verification

**Required Actions:**

#### A. Enable RLS on All Tables
- [ ] Go to: https://supabase.com/dashboard/project/tgdewxxmfmbvvcelngeg/editor
- [ ] Run this SQL to check RLS status:
  ```sql
  SELECT schemaname, tablename, rowsecurity 
  FROM pg_tables 
  WHERE schemaname = 'public' 
  AND rowsecurity = false;
  ```
- [ ] **If any tables show `false`, enable RLS:**
  ```sql
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE driver_applications ENABLE ROW LEVEL SECURITY;
  ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
  -- Repeat for all tables
  ```

#### B. Verify RLS Policies Exist
- [ ] Check critical policies:
  ```sql
  -- Users can only see their own data
  SELECT * FROM pg_policies WHERE tablename = 'users';
  
  -- Drivers only see assigned shipments
  SELECT * FROM pg_policies WHERE tablename = 'shipments';
  
  -- Messages only visible to participants
  SELECT * FROM pg_policies WHERE tablename = 'messages';
  ```
- [ ] If missing, run the RLS policy setup SQL (should already exist from earlier fixes)

#### C. Test Security
- [ ] Create 2 test accounts (Client A, Client B)
- [ ] Verify Client A cannot see Client B's shipments
- [ ] Verify Client A cannot modify Client B's profile

**⚠️ CRITICAL: Without proper RLS, users can see each other's private data!**

---

### 4. Google Maps API - Production Limits 🟡 HIGH PRIORITY

**Current Status:** ✅ API Key working, ⚠️ Needs billing & limits

**Required Actions:**

#### A. Enable Billing
- [ ] Go to: https://console.cloud.google.com/billing
- [ ] Link a credit card to your Google Cloud project
- [ ] Set up billing alerts:
  - Alert at: $50, $100, $200
  - Email notifications

#### B. Set API Quotas
- [ ] Go to: APIs & Services → Maps SDK for Android
- [ ] Set daily quota:
  - Map loads: 10,000/day (adjust based on expected users)
  - Directions: 5,000/day
  - Geocoding: 5,000/day
- [ ] Set up usage alerts

#### C. Restrict API Key
- [ ] Go to: Credentials → Your API Key → Edit
- [ ] **Application restrictions**:
  - Android apps: Add SHA-1 fingerprint from your APK
  - Websites: Add `drivedrop.us.com`, `www.drivedrop.us.com`
- [ ] **API restrictions**:
  - Enable ONLY:
    - Maps SDK for Android
    - Maps JavaScript API
    - Places API
    - Directions API
    - Distance Matrix API
    - Geocoding API

**Cost Estimate:** ~$200/month for 1000 active users

---

### 5. Backend Environment - Production Configuration 🟡 HIGH PRIORITY

**Required Actions:**

#### A. Update Railway Environment Variables
- [ ] Go to: Railway → drivedrop-main-production → Variables
- [ ] **Set production mode**:
  ```bash
  NODE_ENV=production
  LOG_LEVEL=info  # Change from debug
  ```
- [ ] **Verify all secrets are set** (no placeholder values):
  ```bash
  JWT_SECRET=<long random string>  # CHANGE from default!
  ```
- [ ] **Update CORS origins**:
  ```bash
  CORS_ORIGIN=https://drivedrop.us.com,https://www.drivedrop.us.com,https://mobile.drivedrop.us.com,https://app.drivedrop.us.com
  ```

#### B. Generate New JWT Secret
- [ ] Run this command to generate secure secret:
  ```powershell
  -join ((33..126) | Get-Random -Count 64 | ForEach-Object {[char]$_})
  ```
- [ ] Update in Railway: `JWT_SECRET=<new secure random string>`

#### C. Database Connection
- [ ] Verify Supabase connection string is correct
- [ ] Test connection: `curl https://drivedrop-main-production.up.railway.app/health`

---

### 6. Mobile App - Production Build 🟡 HIGH PRIORITY

**Required Actions:**

#### A. Update App Version
- [ ] Edit `mobile/app.json`:
  ```json
  {
    "version": "1.8.0",  // Increment from 1.7.0
    "android": {
      "versionCode": 10  // Increment from 9
    }
  }
  ```

#### B. Build Production APK
- [ ] Clean build:
  ```powershell
  cd mobile
  Remove-Item -Recurse -Force .expo, node_modules\.cache
  eas build --platform android --profile production
  ```
- [ ] Wait ~30 minutes for build to complete
- [ ] Download APK from EAS dashboard

#### C. Test Production APK
- [ ] Install on 2-3 different Android devices
- [ ] Test complete user flow:
  - Sign up (real phone number)
  - Create shipment
  - Make payment (real card, $0.50)
  - Driver accepts
  - Check maps work
  - Send messages
  - Complete shipment

#### D. Upload to Google Play Console
- [ ] Go to: Play Console → Production → Create new release
- [ ] Upload APK
- [ ] Add release notes
- [ ] Submit for review (takes 1-7 days)

---

## ✅ PHASE 2: IMPORTANT - COMPLETE BEFORE USERS

### 7. Error Monitoring & Logging 🟢 IMPORTANT

**Current Status:** ⚠️ Sentry configured but needs verification

**Required Actions:**

#### A. Verify Sentry (Already Configured)
- [ ] Check Sentry DSN in mobile app.json is correct
- [ ] Go to: https://sentry.io/
- [ ] Create account if not done
- [ ] Verify project "drivedrop" exists
- [ ] Test error: Manually trigger a test error in app
- [ ] Verify error appears in Sentry dashboard

#### B. Set Up Alerts
- [ ] Sentry → Alerts → Create new alert
  - Alert on: New issue created
  - Send to: Your email
  - Frequency: Immediately
- [ ] Test alert by triggering error

#### C. Backend Logging
- [ ] Check Railway logs are accessible
- [ ] Set up log retention (Railway Pro plan keeps 7 days)

---

### 8. Terms of Service & Privacy Policy 🟢 IMPORTANT

**Current Status:** ⚠️ Need legal review

**Required Actions:**

#### A. Legal Documents
- [ ] **Privacy Policy**:
  - Review current policy
  - Ensure compliance with GDPR, CCPA
  - Add cookie policy if using website analytics
  - Get legal review (recommended: LegalZoom, Rocket Lawyer)
  
- [ ] **Terms of Service**:
  - Review payment terms
  - Add dispute resolution clause
  - Add liability limitations
  - Get legal review

- [ ] **Driver Agreement**:
  - Independent contractor status
  - Commission structure (clearly stated)
  - Insurance requirements
  - Termination clauses

#### B. Update Mobile App
- [ ] Ensure Terms & Privacy links work
- [ ] Add version number to legal pages
- [ ] Require acceptance on signup

#### C. Upload to Website
- [ ] Host legal documents on website
- [ ] URLs:
  - `drivedrop.us.com/legal/terms`
  - `drivedrop.us.com/legal/privacy`
  - `drivedrop.us.com/legal/driver-agreement`

---

### 9. Customer Support System 🟢 IMPORTANT

**Required Actions:**

#### A. Support Email
- [ ] Set up: `support@drivedrop.us.com`
- [ ] Forward to your business email
- [ ] Set up auto-responder:
  ```
  "Thank you for contacting DriveDrop! 
  We'll respond within 24 hours. 
  For urgent issues, call: [YOUR PHONE]"
  ```

#### B. In-App Support
- [ ] Add "Help" or "Support" button in app settings
- [ ] Link to: `mailto:support@drivedrop.us.com`
- [ ] Add FAQ section (optional but recommended)

#### C. Phone Support (Optional)
- [ ] Get business phone number (Google Voice free option)
- [ ] Set up voicemail
- [ ] Add to app: "Call Support: XXX-XXX-XXXX"

---

### 10. Insurance & Legal Coverage 🔴 CRITICAL

**Required Actions:**

#### A. Business Insurance
- [ ] **General Liability Insurance**:
  - Coverage: $1-2 million
  - Protects against property damage, injury claims
  - Cost: ~$500-1000/year
  
- [ ] **Commercial Auto Insurance Policy**:
  - Required for transport business
  - Covers vehicles during shipments
  - Cost: Varies by state

- [ ] Get quotes from:
  - Progressive Commercial
  - State Farm Business
  - Hiscox (tech startup insurance)

#### B. Driver Requirements
- [ ] **Verify all drivers have**:
  - Valid driver's license
  - Clean driving record (check via DMV)
  - Personal auto insurance (minimum state requirements)
  - Commercial insurance if operating as business
  
- [ ] **Background checks**:
  - Checkr.com integration (already in code)
  - Run check on all driver applications
  - Re-check annually

#### C. Legal Structure
- [ ] Ensure business is properly registered:
  - LLC or Corporation (liability protection)
  - EIN (Employer Identification Number)
  - Business licenses (state/local requirements)
  - Sales tax permit (if applicable)

**⚠️ CRITICAL: Operating without proper insurance is ILLEGAL and exposes you to massive liability!**

---

## ✅ PHASE 3: OPTIMIZATION - BEFORE SCALE

### 11. Performance & Scaling 🟢 NICE TO HAVE

**Required Actions:**

#### A. Database Optimization
- [ ] Supabase: Check current plan limits
  - Free tier: 500MB, 50K rows (might need upgrade soon)
  - Paid: $25/month for 8GB, unlimited rows
- [ ] Add indexes for common queries:
  ```sql
  CREATE INDEX idx_shipments_status ON shipments(status);
  CREATE INDEX idx_shipments_client_id ON shipments(client_id);
  CREATE INDEX idx_shipments_driver_id ON shipments(driver_id);
  CREATE INDEX idx_messages_conversation ON messages(conversation_id);
  ```

#### B. Railway Scaling
- [ ] Check current plan: Hobby ($5/month, 512MB RAM)
- [ ] Monitor usage first month
- [ ] Upgrade if needed: Pro ($20/month, 8GB RAM)

#### C. CDN for Assets (Optional)
- [ ] Set up Cloudflare for website
- [ ] Cache static assets
- [ ] DDoS protection

---

### 12. Analytics & Metrics 🟢 NICE TO HAVE

**Required Actions:**

#### A. Mobile App Analytics
- [ ] Set up Google Analytics 4 or Mixpanel
- [ ] Track key events:
  - User signups
  - Shipments created
  - Payments completed
  - Driver accepts
  - Shipments completed
  - App crashes

#### B. Website Analytics
- [ ] Google Analytics for website
- [ ] Track quote calculator usage
- [ ] Track driver application submissions

#### C. Business Metrics Dashboard
- [ ] Set up simple spreadsheet or tool:
  - Daily active users
  - Total shipments
  - Total revenue
  - Average shipment value
  - Driver count
  - Client count

---

### 13. Marketing & Launch Assets 🟢 NICE TO HAVE

**Required Actions:**

#### A. App Store Optimization
- [ ] **Write compelling description**:
  - What problem DriveDrop solves
  - Key features
  - How it works
  - Pricing (transparent)
  
- [ ] **Screenshots** (4-8 required):
  - Create booking screen
  - Track shipment screen
  - Driver map view
  - Payment success
  - Messages screen

- [ ] **Promotional video** (optional):
  - 30-second demo
  - Shows booking flow

#### B. Social Media
- [ ] Create accounts:
  - Facebook: facebook.com/drivedrop
  - Instagram: @drivedrop_official
  - Twitter: @drivedrop
  
- [ ] Post launch announcement
- [ ] Share to local community groups

#### C. Launch Strategy
- [ ] **Soft launch** (recommended):
  - Friends & family beta (1 week)
  - Fix any issues
  - Get feedback
  
- [ ] **Local launch**:
  - Target one city first
  - Build local driver network
  - Get testimonials
  
- [ ] **Full launch**:
  - Submit to Product Hunt
  - Press release
  - Paid ads (optional)

---

## ✅ PHASE 4: POST-LAUNCH - FIRST WEEK

### 14. Monitoring & Support 🔴 CRITICAL

**Daily Tasks (First Week):**

- [ ] **Check Sentry** for errors (morning & evening)
- [ ] **Monitor Railway logs** for backend issues
- [ ] **Review Stripe Dashboard** for payment issues
- [ ] **Check support email** every 4 hours
- [ ] **Test app yourself** daily (full user flow)
- [ ] **Respond to user issues** within 4 hours max

**Weekly Tasks:**

- [ ] Review analytics
- [ ] Check server costs
- [ ] Gather user feedback
- [ ] Plan bug fixes & improvements
- [ ] Update investors/stakeholders

---

## 📊 GO-LIVE DECISION CHECKLIST

**Before launching to real users, verify:**

### Must Have ✅
- [ ] Stripe live mode working (real payment tested)
- [ ] Twilio production account (SMS to real numbers)
- [ ] RLS enabled on all database tables
- [ ] Google Maps API billing enabled & restricted
- [ ] Production APK built and tested on 3+ devices
- [ ] Backend in production mode with secure JWT secret
- [ ] Insurance coverage active
- [ ] Terms of Service & Privacy Policy published
- [ ] Support email set up
- [ ] Error monitoring (Sentry) working
- [ ] All API keys secured (not exposed in code)

### Should Have ✅
- [ ] Legal documents reviewed by lawyer
- [ ] Background check system working
- [ ] App store screenshots ready
- [ ] Analytics tracking set up
- [ ] Driver requirements verified
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Database backups enabled (Supabase auto-backup)

### Nice to Have ✅
- [ ] Social media accounts created
- [ ] Marketing materials ready
- [ ] FAQ section
- [ ] Promotional video
- [ ] Press kit
- [ ] Beta tester feedback incorporated

---

## 🚨 RED FLAGS - DO NOT LAUNCH IF:

- ❌ Still using Stripe test keys
- ❌ Still using Twilio trial account
- ❌ No insurance coverage
- ❌ Database security not tested
- ❌ No way for users to contact support
- ❌ Backend crashes under basic load testing
- ❌ Payment flow not tested with real money
- ❌ Terms of Service not published

---

## 📞 EMERGENCY CONTACTS (Set Up Before Launch)

**Technical Issues:**
- Stripe Support: support@stripe.com
- Twilio Support: help@twilio.com
- Railway Support: team@railway.app
- Supabase Support: support@supabase.io
- Google Cloud Support: [Enable support plan]

**Legal Issues:**
- Your lawyer: _______________
- Insurance agent: _______________

**Business:**
- Bank: _______________
- Accountant: _______________

---

## 💰 ESTIMATED LAUNCH COSTS

### One-Time Costs:
- Legal review (Terms/Privacy): $500-1500
- Insurance (first year): $1000-3000
- Business registration: $100-500
- Logo/branding: $0-500 (optional)

### Monthly Costs:
- Railway (Backend): $20/month (Pro plan)
- Supabase: $25/month (Pro plan)
- Stripe fees: 2.9% + $0.30 per transaction
- Twilio SMS: $0.0075 per SMS (~$50-100/month)
- Google Maps API: ~$200/month (1000 active users)
- Domain: $15/year
- Google Play Store: $25 one-time
- Apple App Store: $99/year (if launching iOS)

**Total Monthly (estimated):** $300-400 + transaction fees

### Budget for First 3 Months:
- One-time costs: $2000-5000
- Monthly costs: $1000-1200
- Marketing: $500-2000 (optional)
- **Total: $3500-8200**

---

## ✅ FINAL PRE-LAUNCH VERIFICATION

**Run this checklist 24 hours before launch:**

1. [ ] **Test complete user flow with real data:**
   - Sign up (real phone)
   - Verify phone
   - Create shipment
   - Pay with real card ($0.50 minimum)
   - Driver accepts (use test driver account)
   - Track on map
   - Send messages
   - Mark picked up
   - Mark delivered
   - Verify payment appears in Stripe (live mode)

2. [ ] **Backend health check:**
   ```bash
   curl https://drivedrop-main-production.up.railway.app/health
   ```

3. [ ] **Database check:**
   - No test data in production database
   - RLS policies active
   - Backups enabled

4. [ ] **Error monitoring:**
   - Sentry receiving events
   - Email alerts working

5. [ ] **Support ready:**
   - Support email checked
   - Phone available
   - Response templates ready

6. [ ] **Legal:**
   - Terms accepted on signup
   - Privacy policy linked
   - Insurance active

**If all ✅ above are checked: YOU'RE READY TO LAUNCH! 🚀**

---

## 📋 POST-LAUNCH: First 48 Hours

**Hour 1:**
- [ ] Monitor Sentry for crashes
- [ ] Check Railway logs for errors
- [ ] Watch Stripe dashboard for payments

**Hour 6:**
- [ ] Check support email
- [ ] Review first user signups
- [ ] Test app still working

**Hour 24:**
- [ ] Analyze first day metrics
- [ ] Respond to all support requests
- [ ] Fix any critical bugs

**Hour 48:**
- [ ] Gather user feedback
- [ ] Plan immediate fixes
- [ ] Thank beta users
- [ ] Post launch update on social media

---

## 🎉 CONGRATULATIONS!

You've built a production-ready vehicle transport marketplace!

**Remember:**
- 🐛 Bugs will happen - respond quickly
- 📞 Users will have questions - be helpful
- 💰 Costs will vary - monitor closely
- 📈 Growth takes time - be patient
- 🔒 Security is ongoing - stay vigilant

**You've got this! 🚀**

---

**Document Version:** 1.0  
**Last Updated:** January 27, 2025  
**Next Review:** Before launch & after first month
