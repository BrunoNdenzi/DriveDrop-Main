# DriveDrop Changelog

## [Unreleased] — 2026-07-07

### Bug Fixes

#### Driver Applications Page (`website/src/app/dashboard/driver/applications/page.tsx`)
- **Fixed:** Supabase query referenced non-existent columns `pickup_city`, `delivery_city`, and `distance` on the `shipments` table, causing the page to crash
- **Fix:** Removed those columns from the query and the `Application` TypeScript interface; now uses `pickup_address` and `delivery_address` which exist in the schema
- **Also:** Removed unused `Truck` import

#### Admin In-House Driver Creation (`backend/src/routes/admin.routes.ts`)
- **Fixed:** Step 4 of the in-house driver creation flow only called `console.log` — no actual email was sent to the new driver with their credentials
- **Fix 1:** Added `import { emailService } from '@services/email.service'`
- **Fix 2:** New driver accounts now have `force_password_change: true` set in `user_metadata` at creation time
- **Fix 3:** Step 4 now sends a real HTML email via `emailService.sendEmail()` containing the driver's email, temporary password, login URL, and a first-login warning banner instructing them to change their password

#### Password Change Redirect (`website/src/app/change-password/page.tsx`)
- **Fixed:** After completing a forced password change, users were always redirected to `/dashboard/client` because `user_metadata.role` is empty for admin-created accounts
- **Fix:** After password change, the page now fetches the `profiles` table to get the canonical role; falls back to `user_metadata.role`, then defaults to `'driver'` if both are empty

---

### Legal Document Updates

#### Terms of Service (`website/src/app/terms/page.tsx`)
- **Rewrote** the entire Terms of Service page (21 sections)
- **Added** Section 4: Booking Workflow (6 steps: quote → T&C acceptance → account creation + 20% deposit → driver assignment → pickup/delivery → 80% final charge)
- **Added** Section 5: Pricing & Quote Acceptance (standard, expedited +25%, flexible -5%, enclosed +30%)
- **Added** Section 11: SMS Communications & Consent — **Twilio A2P 10DLC compliant**: STOP/HELP instructions, message frequency disclosure, standard rates notice, explicit statement that SMS opt-in is never shared with third parties for marketing
- **Added** Section 14: Benji AI Assistant — AI limitations, document processing disclosure, conversation review notice, acceptance via AI binding
- **Updated** Section 19: Governing Law — replaced `[Your State]` placeholder with "North Carolina"
- **Updated** Section 8: Cancellation & Refund Policy — now matches authoritative policy (48h+/24–48h/<24h/driver cancel)
- **Updated** Section 10: Driver Responsibilities — 80% earnings, independent contractor status
- **Updated** Section 12: Liability & Insurance — $100,000 cargo insurance, 24-hour damage reporting window
- **Updated** Section 18: Dispute Resolution — AAA arbitration, Charlotte NC venue, 30-day informal resolution requirement first
- **Removed** old placeholder content, incorrect cancellation tiers, and the `[Your State]` stub
- **Last Updated date:** July 7, 2026

#### Privacy Policy (`website/src/app/privacy/page.tsx`)
- **Expanded** from 11 sections to 15 sections
- **Added** Section 4: Benji AI Processing — what data is sent to OpenAI, document extraction, conversation log retention (1 year), no-training-on-data disclosure
- **Added** Section 5: Payment Data & Stripe — explicit statement that DriveDrop does NOT store card numbers/CVV; Stripe PCI-DSS Level 1; two-stage capture explained
- **Added** Section 6: GPS & Location Data — active delivery only, 90-day route history, driver location sharing scope
- **Added** Section 8: SMS & Twilio — A2P 10DLC compliant: opt-in basis, STOP/HELP, message frequency disclosure, rates notice, explicit no-third-party-marketing statement
- **Expanded** Section 1: Information We Collect — now includes AI conversation data, uploaded documents/images, voice messages, GPS detail
- **Expanded** Section 10: Data Retention — added AI conversations (1 year), server logs (90 days), GPS route history (90 days)
- **Expanded** Section 7: Cookies — removed "Marketing Cookies" entry (we don't use ad tracking); added server logs note
- **Updated** CCPA Notice — now inline at bottom of page with full text instead of a link-only reference
- **Last Updated date:** July 7, 2026

#### Benji AI `get_terms` Tool (`backend/src/benji-v3/tools/index.ts` — `execGetTerms()`)
- **Removed** driver-facing line: `$25 cancellation fee for cancellations within 2 hours of pickup` (was incorrect and driver-facing, not client-facing)
- **Added** PRICING section: standard, expedited (+25%), flexible (-5%), enclosed (+30%) surcharges
- **Added** SMS NOTIFICATIONS section: consent reminder, STOP/HELP, rates
- **Added** BENJI AI ASSISTANT section: binding acceptance via AI, verify-before-confirming reminder
- **Updated** DRIVER TERMS: removed the $25 fee; clarified 20% platform fee retained by DriveDrop
- **Updated** PAYMENT: added "DriveDrop does not store full card numbers or CVV codes"
- **Updated** footer links: now includes Privacy Policy URL alongside Terms URL

---

### Items Requiring Manual Legal Review

> The following items were set to reasonable defaults but should be reviewed by qualified legal counsel before these documents are considered final:

| Item | Current Value | Notes |
|---|---|---|
| Cargo insurance coverage | $100,000 per vehicle | Verify actual policy limits with your insurer |
| Arbitration forum | American Arbitration Association (AAA) | Confirm AAA is the intended forum |
| Arbitration venue | Charlotte, North Carolina | Confirm this is correct |
| CCPA applicability | Inline notice on Privacy Policy | Determine if a full separate CCPA page is required |
| Data retention — AI conversations | 1 year | Adjust based on business needs and legal advice |
| Data retention — server logs | 90 days | Adjust as needed |
| FCRA background check retention | 7 years | Confirm with your background check provider |
| IRS record retention | 7 years | Standard; confirm with your accountant |
| Informal dispute resolution period | 30 days | Adjust if needed |
| Driver independent contractor status | Confirmed | Ensure compliance with applicable state laws (especially CA AB5) |
