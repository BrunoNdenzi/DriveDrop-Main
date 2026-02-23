# DriveDrop Production Budget — Costs & Expenses

> **Last updated:** February 2026  
> **Domain:** drivedrop.us.com  
> **Stack:** Next.js (Vercel) + Express (Railway) + Supabase + Expo (React Native)

---

## 1. Infrastructure & Hosting

| Service | Plan | Monthly Cost | Annual Cost | Notes |
|---------|------|-------------|-------------|-------|
| **Vercel** (Frontend) | Pro | **$20** | $240 | Next.js 14 hosting, auto-deploy from GitHub, edge CDN, analytics. Free tier hard caps at 100 GB bandwidth. |
| **Railway** (Backend) | Pro | **$20** base + usage | ~$25–50 | Express API server. Pay-per-use compute (vCPU/GB-hr). Estimated ~$5–30 usage on top of $20 base for moderate traffic. |
| **Supabase** (Database + Auth + Storage) | Pro | **$25** | $300 | PostgreSQL + PostGIS, GoTrue Auth, 8 GB database, 250 GB bandwidth, 100 GB storage, unlimited API requests. Overage: $0.125/GB storage, $0.09/GB bandwidth. |
| **Domain** (drivedrop.us.com) | Annual | — | **$10–15** | Registrar renewal (Namecheap, GoDaddy, etc.) |
| **SSL Certificate** | Included | $0 | $0 | Auto-provisioned by Vercel & Railway |

**Infrastructure Subtotal: ~$70–95/mo ($840–1,140/yr)**

---

## 2. Third-Party APIs & Services

### 2a. Google Maps Platform

| API | Pricing | Est. Monthly Cost | Notes |
|-----|---------|-------------------|-------|
| Maps JavaScript API | $7.00 / 1,000 loads | **$7–21** | Map renders for live tracking, navigation, route planner |
| Places API | $17.00 / 1,000 requests | **$5–17** | Address autocomplete on shipment forms |
| Geocoding API | $5.00 / 1,000 requests | **$2–10** | Address-to-coordinates for pickup/delivery |
| Directions API | $5.00 / 1,000 requests | **$2–10** | Route calculations, ETA, distance |
| **Google Maps $200/mo free credit** | — | **−$200** | Google gives $200/mo free credit, covers ~28K map loads |

**Google Maps Subtotal: $0–58/mo** (likely **$0** at launch with free credit)

### 2b. OpenAI (Benji AI)

| Feature | Model | Token Cost | Est. Monthly |
|---------|-------|-----------|-------------|
| Benji Chat (conversational) | GPT-4o-mini | $0.15/1M input, $0.60/1M output | **$2–8** |
| Document Extraction (OCR) | GPT-4o | $2.50/1M input, $10.00/1M output | **$5–20** |
| NL Shipment Parsing | GPT-4o | $2.50/1M input, $10.00/1M output | **$3–10** |
| AI Dispatcher (matching) | — | No OpenAI usage (algorithmic) | $0 |
| AI Load Recommendations | — | No OpenAI usage (algorithmic) | $0 |

> Rate limits in place: Chat 20/min, Documents 10/min, Shipments 15/min per user.  
> Token caching enabled to reduce duplicate requests.

**OpenAI Subtotal: ~$10–38/mo**

### 2c. Stripe (Payment Processing)

| Item | Rate | Notes |
|------|------|-------|
| Card processing fee | **2.9% + $0.30** per transaction | Standard Stripe pricing |
| Stripe Connect (driver payouts) | **0.25% + $0.25** per payout | If using Stripe Connect for instant payouts |
| Monthly platform fee | $0 | No fixed monthly Stripe cost |
| Disputes/chargebacks | $15 per dispute | Refunded if you win |

> DriveDrop charges a **10% platform fee** on shipments + **20% driver commission**.  
> Stripe fees come out of the platform's cut. On a $500 shipment:  
> - Platform revenue: $50 (10%)  
> - Stripe fee: ~$14.80 (2.9% + $0.30)  
> - Net platform revenue: ~$35.20 per shipment  

**Stripe Subtotal: Variable (2.9% + $0.30 per transaction)**

### 2d. Email Service (Brevo)

| Plan | Monthly Cost | Includes | Notes |
|------|-------------|----------|-------|
| Brevo Free | **$0** | 300 emails/day (9,000/mo) | Sufficient for early production |
| Brevo Starter | **$9** | 5,000 emails/mo | When exceeding free tier |
| Brevo Business | **$18** | 5,000 emails/mo + marketing automation | If needed later |

> Used for: Welcome emails, shipment notifications, driver approval, password resets.  
> Domain verified: `noreply@drivedrop.us.com`

**Brevo Subtotal: $0–9/mo**

### 2e. Twilio (SMS & Phone Verification) — *Optional, configured but not active*

| Service | Rate | Notes |
|---------|------|-------|
| SMS messages | $0.0079/msg (US) | Phone verification, delivery alerts |
| Phone verification (Verify API) | $0.05/verification | OTP codes |
| Monthly number | $1.15/mo | US phone number |

> Currently configured in backend but not actively used.  
> Activate when phone verification is needed.

**Twilio Subtotal: $0 (inactive) → $5–30/mo when activated**

---

## 3. Development & DevOps Tools

| Tool | Cost | Notes |
|------|------|-------|
| **GitHub** (Repository) | $0 | Free for public/private repos. Team plan $4/user/mo if needed. |
| **Vercel CI/CD** | Included in Pro | Auto-deploys on push to `main` |
| **Railway CI/CD** | Included in Pro | Auto-deploys backend on push |
| **VS Code / Cursor** | $0–20/mo | Code editor. Cursor Pro $20/mo if using AI features. |
| **Sentry** (Error Monitoring) | $0–26/mo | Free tier: 5K errors/mo. Consider for production debugging. |
| **PostHog / Analytics** | $0 | Free tier: 1M events/mo. Optional. |

**Dev Tools Subtotal: $0–46/mo**

---

## 4. Mobile App Distribution

| Platform | Cost | Frequency | Notes |
|----------|------|-----------|-------|
| **Apple Developer Program** | **$99** | Annual | Required to publish on App Store |
| **Google Play Developer** | **$25** | One-time | Required to publish on Play Store |
| **Expo EAS Build** | $0–99/mo | Monthly | Free: 30 builds/mo. Pro: $99/mo for more builds + priority. Free tier likely sufficient. |
| **Expo Push Notifications** | $0 | — | Free with Expo Go / EAS |

**Mobile Subtotal: ~$99/yr (Apple) + $25 one-time (Google) + $0–99/mo (EAS)**

---

## 5. Legal, Compliance & Insurance

| Item | Est. Cost | Frequency | Notes |
|------|----------|-----------|-------|
| **Business Registration** (LLC) | $50–500 | One-time | Varies by state. NC LLC ~$125. |
| **FMCSA Broker Authority** (if DriveDrop acts as broker) | $300 | One-time | MC number registration |
| **BOC-3 Filing** | $30–50 | One-time | Required with FMCSA authority |
| **Surety Bond / Trust Fund** | $75K bond (~$750–1,500/yr) | Annual | Required for freight brokers |
| **General Liability Insurance** | $500–2,000/yr | Annual | Platform liability coverage |
| **Cyber/Data Insurance** | $500–1,500/yr | Annual | Covers data breaches, PII protection |
| **Terms of Service / Privacy Policy** | $500–2,000 | One-time | Legal counsel or template service |
| **PCI Compliance** | $0 | — | Handled by Stripe (PCI Level 1) |

**Legal Subtotal: Varies — $2,000–8,000 first year, $1,500–4,000/yr ongoing**

---

## 6. Marketing & Growth — *Phase 2*

| Channel | Est. Monthly | Notes |
|---------|-------------|-------|
| Google Ads | $500–2,000 | Vehicle transport keywords |
| Facebook/Instagram Ads | $300–1,000 | Targeting car dealers, movers |
| SEO / Content Marketing | $0–500 | Blog, landing pages |
| Referral Program Credits | Variable | Platform credits for referrals |
| Email Marketing (Brevo) | Included | Drip campaigns, newsletters |

**Marketing Subtotal: $0 at launch → $800–3,500/mo at scale**

---

## Budget Summary

### Minimum Viable Production (Launch)

| Category | Monthly | Annual |
|----------|---------|--------|
| Vercel Pro | $20 | $240 |
| Railway Pro | $25 | $300 |
| Supabase Pro | $25 | $300 |
| Domain | ~$1 | $12 |
| Google Maps | $0 (free credit) | $0 |
| OpenAI (Benji AI) | $15 | $180 |
| Brevo (Email) | $0 | $0 |
| Stripe | 2.9% + $0.30/txn | Variable |
| **TOTAL (Tech)** | **~$86** | **~$1,032** |

### With Mobile App

| Add-on | Monthly | Annual/One-time |
|--------|---------|-----------------|
| Apple Developer | — | $99/yr |
| Google Play Developer | — | $25 one-time |
| Expo EAS (free tier) | $0 | $0 |
| **TOTAL (Tech + Mobile)** | **~$86** | **~$1,156** |

### Full Production (with compliance & moderate traffic)

| Category | Monthly | Annual |
|----------|---------|--------|
| Infrastructure (Vercel + Railway + Supabase) | $70–95 | $840–1,140 |
| Google Maps | $0–58 | $0–700 |
| OpenAI | $10–38 | $120–460 |
| Email (Brevo) | $0–9 | $0–108 |
| Stripe | Variable | Variable |
| Twilio (SMS) | $5–30 | $60–360 |
| Monitoring (Sentry) | $0–26 | $0–312 |
| Mobile Distribution | $8 | $124 |
| Legal / Compliance | $150–400 | $2,000–5,000 |
| Marketing | $800–3,500 | $9,600–42,000 |
| **TOTAL (Full)** | **$1,050–4,150** | **$12,750–50,000** |

---

## Scaling Cost Projections

| Users/Month | Shipments/Month | Est. Monthly Cost | Key Cost Drivers |
|-------------|----------------|-------------------|------------------|
| 0–100 | 0–50 | **$86** | Base infra only |
| 100–500 | 50–200 | **$120–180** | Moderate API usage |
| 500–2,000 | 200–1,000 | **$250–500** | Google Maps overages, more AI usage |
| 2,000–10,000 | 1,000–5,000 | **$500–1,500** | Railway compute scaling, Supabase overages |
| 10,000+ | 5,000+ | **$1,500–5,000+** | Consider Supabase Team ($599), dedicated Railway, CDN |

---

## Revenue vs. Cost Breakeven

DriveDrop earns **10% platform fee** on each shipment.

| Avg. Shipment | Platform Fee | Stripe Net | AI/Infra Cost per Shipment | Net Profit |
|---------------|-------------|------------|---------------------------|------------|
| $300 | $30.00 | ~$21.00 | ~$0.50 | **~$20.50** |
| $500 | $50.00 | ~$35.00 | ~$0.50 | **~$34.50** |
| $1,000 | $100.00 | ~$71.00 | ~$0.50 | **~$70.50** |
| $2,000 | $200.00 | ~$142.00 | ~$0.50 | **~$141.50** |

> At **$86/mo minimum infrastructure cost**, breakeven is ~**3–4 shipments/month** at $500 avg.  
> With full compliance costs ($150/mo), breakeven is ~**5–6 shipments/month**.

---

## Cost Optimization Tips

1. **Google Maps $200/mo credit** — Covers ~28K map loads. Monitor usage in Google Cloud Console.
2. **OpenAI tiered models** — Chat uses GPT-4o-mini ($0.15/1M) instead of GPT-4o ($2.50/1M). Saves ~95%.
3. **AI response caching** — Duplicate queries served from cache, avoiding repeat API calls.
4. **Supabase free tier** — Can start on free ($0) before upgrading to Pro when you exceed 500 MB database.
5. **Railway usage billing** — Only pay for compute used. Idle backend costs ~$5/mo.
6. **Brevo free tier** — 300 emails/day is enough for first 1,000+ users.
7. **Stripe volume discounts** — Negotiate lower rates after $80K+/mo processing volume.

---

## One-Time Setup Costs

| Item | Cost |
|------|------|
| Domain registration | $12 |
| Google Play Developer | $25 |
| Apple Developer Program | $99 |
| LLC Formation (NC) | $125 |
| FMCSA Broker Authority (if applicable) | $300 |
| BOC-3 Filing | $40 |
| Legal templates (ToS, Privacy) | $500–2,000 |
| **Total One-Time** | **$1,100–2,600** |
