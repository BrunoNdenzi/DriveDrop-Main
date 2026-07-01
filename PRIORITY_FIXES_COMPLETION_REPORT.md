# DriveDrop — Priority Fixes Completion Report
**Date:** 2026-07-01

---

## Fully Completed ✅

| # | Item | Root Cause & What Changed | Files Affected |
|---|---|---|---|
| **5** | Password change broken | `signInWithPassword` client-side during an active session misbehaves with cookie-based SSR client. Created server-side `/api/auth/change-password` route that verifies current password with a stateless client, then updates via service role. Security page now calls the API instead of doing it client-side. | `website/src/app/api/auth/change-password/route.ts` *(new)*, `website/src/app/dashboard/client/settings/security/page.tsx` |
| **6** | Vehicle photos optional | `canProceed()` required `photos.length >= 4` for step 1. Changed to `return true`. All 4 `required: true` photo angles set to `false`. | `website/src/app/dashboard/client/new-shipment/completion/page.tsx`, `website/src/components/completion/VehiclePhotosStep.tsx` |
| **8** | Notification center | "View all notifications" button had no `onClick`/`href`. Hook had a 20-item limit. Created `/dashboard/client/notifications` full page with per-item read/clear, clear-all, expanded view. Created `useNotificationsAll` hook (no limit). Wired the bell's footer button. | `website/src/app/dashboard/client/notifications/page.tsx` *(new)*, `website/src/hooks/useNotificationsAll.ts` *(new)*, `website/src/components/NotificationBell.tsx` |
| **10** | Payments tab broken | `!profile` guard fired while `useAuth` was still loading → showed "Please log in" immediately for authenticated users. Added `authLoading` guard. Added visible `fetchError` state so query failures surface instead of silently showing empty data. | `website/src/app/dashboard/client/payments/page.tsx` |
| **12** | Account deletion hidden | No delete option existed in client settings or driver profile settings tab. Added "Delete Account" entry to both, pointing to the existing `/account-deletion` page. | `website/src/app/dashboard/client/settings/page.tsx`, `website/src/app/dashboard/driver/profile/page.tsx` |
| **4** | Reset password loop | `forgotPassword` used `window.location.origin` for `redirectTo`. If user was at `drivedrop.us.com` (root), Supabase would reject it (not in allowed redirects) → code exchange fails → user redirected back to forgot-password page (infinite loop). Fixed to always use the canonical `https://www.drivedrop.us.com`. | `website/src/app/forgot-password/page.tsx` |
| **13** | Driver application UX | `alert()` popups and dozens of debug `console.log` in jobs page and driver dashboard. Replaced with a proper success modal explaining next steps (review → assigned → pickup) and clean toast notifications. | `website/src/app/dashboard/driver/jobs/page.tsx`, `website/src/app/dashboard/driver/page.tsx` |
| **15** | Driver assignment workflow | **Case A** (driver applied): admin approval now sets shipment status to `accepted` — driver already committed by applying, no further acceptance needed. **Case B** (admin manually assigns): stays `assigned` — driver sees "Awaiting Your Acceptance" badge and an **Accept Assignment** button on their dashboard that transitions the shipment to `accepted`. | `website/src/app/dashboard/admin/assignments/page.tsx`, `website/src/app/dashboard/driver/page.tsx` |

---

## Requires Manual Action ⚠️

### #1 — Root Domain DNS Fix

**Problem:** `drivedrop.us.com` A record points to `216.198.79.1` (legacy/parking server). `www.drivedrop.us.com` works via Vercel CNAME.

**Steps:**

1. **Porkbun DNS** → Delete `A` record: `drivedrop.us.com → 216.198.79.1`
2. **Porkbun DNS** → Add `A` record: `drivedrop.us.com → 76.76.21.21` (Vercel primary IP)
3. **Vercel** → Project → Domains → Add `drivedrop.us.com` as an additional domain
4. **Supabase** → Authentication → URL Configuration → Add both domains to allowed redirect URLs:
   - `https://drivedrop.us.com/**`
   - `https://www.drivedrop.us.com/**`
5. **Vercel** → Add env var `NEXT_PUBLIC_SITE_URL=https://www.drivedrop.us.com`

### #2 — Contact & Quote Email Confirmation

Verify in Vercel environment variables:

| Variable | Value |
|---|---|
| `SMTP_HOST` | `smtp-relay.brevo.com` |
| `SMTP_USER` | `9af1f0001@smtp-brevo.com` |
| `SMTP_PASS` | Your active Brevo SMTP key |

---

## Deferred / Larger Scope 🔜

| # | Item | Reason |
|---|---|---|
| **3** | Bounce detection + fallback resend | Significant infrastructure: DB table (`email_delivery_logs`), Brevo webhook endpoint, retry queue, fallback SMTP via `infos@calkons.com`. Needs a dedicated session. |
| **9** | Uncaught console errors | Requires live browser DevTools inspection against production to capture the exact errors and stack traces. |
| **11** | Dashboard data loading delay | Most fetches already use `Promise.all`. Remaining delay is likely hydration + profile fetch latency. Needs profiling; solution is SWR/React Query caching or streaming. |
| **14** | Admin notification system | Basic notifications exist. Priority/severity levels, filtering, and advanced admin-specific events are a larger feature build. |
| **16** | Mobile responsiveness audit | Full audit requires visual browser testing across device sizes. Too broad to complete without a dedicated pass. |
| **17** | Lighthouse optimization | Needs a Lighthouse run against production to establish baseline before/after metrics. |

---

## Previously Fixed (Same Batch)

| Fix | Description |
|---|---|
| Login broken for all users | `profiles` table has no `status` column — our earlier fix that added `status` to the SELECT query caused all logins to fail with "Profile not found". Reverted to `.select('role')` only. |
| Vercel build: TypeScript errors | Added `ASSIGNED` and `PICKED_UP` to `ShipmentStatus` enum; changed `shipment: Record<string, any>` to typed interface to resolve TS4111 index-signature errors. |
| Vercel build: missing import | `getSupabaseBrowserClient` imported from wrong module (`@/lib/supabase` instead of `@/lib/supabase-client`) in notifications settings page. |
| Railway build: TypeScript errors | Same enum + index-signature fix applied to backend `supabase.service.ts`. |
| SMTP: Missing credentials | `SMTP_USER` and `SMTP_PASS` env vars missing from Vercel → nodemailer failed with "Missing credentials for PLAIN". |
| SMTP: Auth failed | Wrong `SMTP_USER` (account email instead of `9af1f0001@smtp-brevo.com`) and mismatched SMTP key. |
