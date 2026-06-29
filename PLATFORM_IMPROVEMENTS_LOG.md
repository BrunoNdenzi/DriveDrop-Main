# DriveDrop Platform Improvements Log

---

## Session 1 — Core Platform Fixes (commit `34cec24`)

### 1. Admin Applications URL
- Fixed 4 broken links in `admin/page.tsx` and `admin/layout.tsx` pointing to wrong applications route

### 2. Footer — "How It Works" Removed
- Removed non-functional "How It Works" link from footer navigation

### 3. Contact Support Button
- Dashboard layout "Contact Support" button now correctly navigates to `/contact`

### 4. Email Provider — Brevo SMTP
- `website/src/lib/email.ts` switched from generic SMTP to Brevo SMTP (`smtp-relay.brevo.com`)
- Uses `SMTP_USER` / `SMTP_PASS` environment variables

### 5. Homepage Stats — Realistic Values
- Updated live stats to reflect actual early-stage numbers: 8 active shipments, 100% on-time, Charlotte / Carolina routes

### 6. Expedited Shipping — Removed
- Removed "Expedited" option from `ShipmentForm`
- Replaced with "Standard" only + contextual links to freight/van delivery services for faster needs

### 7. Flexible Discount Threshold — 7 → 5 Days
- Frontend (`ShipmentForm`) and backend pricing logic updated: flexible discount now applies at 5+ day pickup window (was 7)

### 8. Quote Form — Lead-Gen Rewrite (Phase 1)
- Homepage quote section rewritten as a proper lead-gen form collecting name, email, route, and vehicle type
- Sends email via `/api/quotes/send` on submission

### 9. Scroll to Top on Section Toggle
- `ShipmentForm` now scrolls to the section header when a collapsible section is opened

### 10. Account Deletion — Auto Sign-Out
- Deleting an account now signs the user out and redirects to `/login` immediately after deletion

### 11. Driver Approval Email — Improved
- Temporary password notice in driver approval emails clarified with instructions to change password on first login

### 12. AuthHashHandler — Signup Token Fix
- `AuthHashHandler.tsx` no longer redirects signup email-confirm tokens to `/reset-password`
- Only `type=recovery` tokens go to password reset; signup tokens go to `/login?verified=true`

### 13. Driver Registration — Address Autocomplete
- Driver registration form address field now uses `GooglePlacesAutocomplete` component instead of plain text input

---

## Session 2 — LiveMarketData TS Fix (commit `d49ce40`)

### 14. LiveMarketData — TypeScript Error Fixed
- All route entries had `trend: 'up' as const` but code still checked for `=== 'down'`
- Removed the unreachable dead branch to fix the TS build error

---

## Session 3 — UX & Accuracy Pass (current)

### 15. Quote Calculator — 2-Step Flow with Vehicle Details
- **Step 1:** Pickup, delivery, vehicle type + new year (4-digit) and make/model (free-text) fields → "Calculate My Quote"
- Instant inline quote card: total price, distance, pay today (20%) / on delivery (80%)
- Two highlighted CTAs on quote card: Express/freight link + DriveDrop TMS account creation
- **Step 2:** Name + email form → posts to `/api/quotes/send` → "Quote Sent" confirmation with Book Now CTA
- `/api/quotes/send` updated to accept `vehicleYear`, `vehicleModel`, `preCalculatedQuote`; email includes vehicle info, dual CTA buttons, TMS promo block

### 16. Custom Vehicle Make/Model (ShipmentForm)
- Fixed `VehicleSelect` `useEffect` bug — inline `onChange` in deps caused custom values to be cleared on every render
- Replaced with `useRef` pattern so custom values persist
- Custom makes no longer auto-clear the model field
- "Enter custom model" button now appears even when the options list is empty (was hidden for custom/unknown makes)

### 17. Payment Notification — Correct Amount (20% not Full)
- `handlePaymentSuccess` in `stripe.service.ts` was passing `paymentIntent.amount` (full authorized amount, e.g. $413) to the notification
- Now reads `metadata['upfrontAmount']` (the actual 20% captured) with `amount_received` as fallback
- New notification titles: **"Booking Confirmed — 20% Paid"** vs **"Final Payment Processed"**
- Messages explain the 20/80 split clearly
- `handlePartialCapture` also updated with `isInitialPayment: true`

### 18. Client Settings Page — Full Fix
- Sign-out was calling `router.push('/auth/login')` (non-existent route) — replaced with `signOut` from `useAuth` hook (correct `/login` redirect)
- Fixed broken links: `/help` → `/contact`, Security → new sub-page, Notifications → new sub-page
- Created `/dashboard/client/settings/notifications/page.tsx` — toggle email & push notification preferences (saved to localStorage)
- Created `/dashboard/client/settings/security/page.tsx` — re-authenticate then change password in-page, with "Reset via email" fallback link

### 19. Password Reset Flow — All User Types Verified
- Flow confirmed correct: `/forgot-password` → Supabase email → `/auth/callback?type=recovery` → `/reset-password` → `supabase.auth.updateUser`
- All dashboards (client, broker, admin) use `signOut` from `useAuth`
- All login pages link to `/forgot-password`
- No changes needed

### 20. Payments Filter — Duplicate Removed
- Payment type filter dropdown had two identical "Initial Payment (20%)" entries (`upfront` and `initial`)
- Consolidated into one option; `applyFilters` updated to match both DB values under a single filter selection
