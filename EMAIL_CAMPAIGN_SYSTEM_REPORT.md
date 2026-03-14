# Email Campaign System — Implementation Report

**Date:** 2025  
**Commit:** c474118  
**Branch:** main  
**Status:** ✅ Complete — Zero TypeScript Errors — Pushed

---

## What Was Built

A full-stack email campaign system for DriveDrop to reach FMCSA-registered car carriers. This is a production-ready B2B outreach pipeline from data enrichment through performance analytics.

---

## Files Created (15 total, 2,689 insertions)

### Database Migration
| File | Description |
|------|-------------|
| `backend/migrations/email_campaign_system.sql` | 6 tables + 6 increment RPCs + RLS policies |

### TypeScript Types
| File | Description |
|------|-------------|
| `backend/src/types/campaigns.types.ts` | `FMCSACarrierData`, `EnrichedCarrier`, `Campaign`, `CampaignStats`, `EmailEvent`, `CampaignRecipient`, `CarrierContact`, `BrevoWebhookEvent` |

### Services (3)
| File | Description |
|------|-------------|
| `backend/src/services/outreach/carrierEnrichmentService.ts` | Apollo → Hunter → Snov fallback chain + verify + bulk enrich |
| `backend/src/services/outreach/campaignManagerService.ts` | Full campaign lifecycle, rate-limited send loop, suppression, unsubscribe |
| `backend/src/services/outreach/analyticsService.ts` | Performance, time-series, geo, device, funnel, leaderboard, export |

### Email Templates (1)
| File | Description |
|------|-------------|
| `backend/src/services/outreach/templates/carrierOutreach.ts` | `introduction`, `followUp`, `specialOffer` — DriveDrop branded, mobile-responsive |

### Routes (4)
| File | Mounted At | Description |
|------|-----------|-------------|
| `backend/src/routes/campaigns.routes.ts` | `/api/v1/campaigns` | Campaign CRUD + lifecycle |
| `backend/src/routes/carriers.routes.ts` | `/api/v1/carriers` | Carrier contacts management |
| `backend/src/routes/analytics.routes.ts` | `/api/v1/analytics` | All analytics endpoints |
| `backend/src/routes/email-webhooks.routes.ts` | `/api/v1/email-webhooks` | Brevo events + unsubscribe |

### Modified Files (3)
| File | Change |
|------|--------|
| `backend/src/routes/index.ts` | Registered 4 new routers |
| `backend/.env.example` | Added 10 new environment variables |
| `backend/docs/EMAIL_CAMPAIGN_SYSTEM.md` | Full technical documentation (new) |

---

## Technical Decisions

### Why Apollo → Hunter → Snov (not parallel)?
Sequential fallback saves API credits — only calls the next service if the previous one found nothing. Apollo has the richest contact data; Hunter is best for domain search; Snov handles edge cases.

### Why `/email-webhooks` not `/webhooks`?
`/api/v1/webhooks` is already registered for commercial webhook management (separate feature). Naming the new route `/email-webhooks` avoids the conflict without touching the existing system.

### How are unsubscribe tokens secured?
`crypto.createHmac('sha256', BREVO_WEBHOOK_SECRET).update('email::campaignId').digest('hex')` — server-side HMAC. Tokens cannot be forged without the secret. Verified with `crypto.timingSafeEqual` to prevent timing attacks.

### How does warmup mode work?
`OUTREACH_WARMUP=true` (default). The send loop calls `brevoOutreachService.send({ dryRun: true })` which logs the email to the `outreach_log` table but makes no API call to Brevo. Switch to `false` for production sends.

### Rate limiting strategy
1 email per 2 seconds = 30/min = 1,800/hour maximum throughput. `OUTREACH_DAILY_LIMIT` (default 10) acts as a hard daily cap per campaign per process restart. This follows email warmup best practices.

---

## Database Schema Summary

```
carrier_contacts         ── enriched FMCSA carrier records
email_campaigns          ── campaigns + aggregate counters
campaign_recipients      ── carrier×campaign with status
email_events             ── streaming events from Brevo
email_suppression_list   ── bounce/spam/unsub blacklist
campaign_conversions     ── downstream signup attribution
```

All tables have:
- `id UUID DEFAULT gen_random_uuid()` primary keys
- RLS enabled with `admin` role policies
- `created_at`/`updated_at` timestamps
- Appropriate indexes for common query patterns

### Increment RPCs (avoid race conditions)
Six `increment_campaign_*` functions use `UPDATE ... SET count = count + 1` to safely increment counters from concurrent webhook handlers.

---

## API Endpoints (28 total)

### Campaigns (10 endpoints)
- `POST /campaigns` — create
- `GET /campaigns` — list with filters
- `GET /campaigns/:id` — get one
- `PATCH /campaigns/:id` — update draft/paused
- `POST /campaigns/:id/start` — start sending
- `POST /campaigns/:id/pause` — pause
- `DELETE /campaigns/:id` — delete draft
- `GET /campaigns/:id/stats` — computed metrics
- `GET /campaigns/:id/recipients` — paginated recipients
- `POST /campaigns/:id/test` — test email

### Carriers (6 endpoints)
- `POST /carriers/enrich` — single carrier enrichment
- `POST /carriers/enrich/bulk` — async bulk enrichment (up to 500)
- `GET /carriers` — list with state/email filters
- `GET /carriers/:id` — get one
- `PATCH /carriers/:id` — update
- `POST /carriers/:id/verify-email` — re-verify

### Analytics (8 endpoints)
- `GET /analytics/overview` — all-campaign aggregate
- `GET /analytics/campaigns/:id/performance`
- `GET /analytics/campaigns/:id/timeline`
- `GET /analytics/campaigns/:id/geography`
- `GET /analytics/campaigns/:id/devices`
- `GET /analytics/campaigns/:id/funnel`
- `GET /analytics/leaderboard`
- `GET /analytics/export/:id` — JSON or CSV

### Email Webhooks (4 endpoints)
- `POST /email-webhooks/brevo` — event receiver
- `GET /email-webhooks/unsubscribe/:token` — confirmation page
- `POST /email-webhooks/unsubscribe` — form processing
- `GET /email-webhooks/health`

---

## Email Templates

Three production-ready HTML emails with:
- DriveDrop branding (teal `#00B8A9`, orange `#FF9800`)
- Mobile-responsive layout (max-width 600px, media queries)
- `{{companyName}}`, `{{city}}`, `{{state}}` personalization
- UTM parameters on all links
- Mandatory `{{unsubUrl}}` in footer
- Tracking pixel placeholder

| Template | Goal | Send Timing |
|----------|------|-------------|
| `introduction` | Cold outreach, explain value proposition | Day 1 |
| `followUp` | Re-engagement, highlight regional loads | Day 7 |
| `specialOffer` | Urgency, 90-day fee waiver promo | Day 14 |

---

## Security Hardening

| Concern | Mitigation |
|---------|-----------|
| Webhook forgery | HMAC-SHA256 signature verification on every Brevo event |
| Unsubscribe forgery | HMAC-signed tokens, `timingSafeEqual` comparison |
| XSS in unsubscribe page | HTML-escaping of all URL parameters before rendering |
| Unauthorized access | All admin endpoints require `authenticate + authorize(['admin'])` |
| Email spam | Suppression list auto-populated on hard_bounce/spam |
| Race conditions on counters | DB-side `UPDATE ... count + 1` via RPCs |
| Brevo secret fallback | If `BREVO_WEBHOOK_SECRET` not set, verification is skipped (dev only) |

---

## New Environment Variables Required

```env
BREVO_WEBHOOK_SECRET=    # Create in Brevo → Settings → Webhooks
BREVO_OUTREACH_SENDER=   # From email (default: outreach@drivedrop.us.com)
BREVO_OUTREACH_NAME=     # Sender name (default: DriveDrop Team)
HUNTER_API_KEY=          # hunter.io API key
APOLLO_API_KEY=          # apollo.io API key
SNOV_CLIENT_ID=          # snov.io client ID
SNOV_CLIENT_SECRET=      # snov.io client secret
SERPAPI_KEY=             # serpapi.com (optional, for website discovery)
OUTREACH_WARMUP=true     # Set false to send real emails
OUTREACH_DAILY_LIMIT=10  # Emails per day per campaign (increase gradually)
APP_URL=https://drivedrop.app  # Used for unsubscribe links
```

---

## Next Steps / Production Checklist

- [ ] Apply `email_campaign_system.sql` in Supabase SQL Editor
- [ ] Set all environment variables in Railway backend service
- [ ] Configure Brevo Webhook: `POST https://api.drivedrop.app/api/v1/email-webhooks/brevo`
  - Events: delivered, opened, clicks, hard_bounce, soft_bounce, spam, unsubscribed
  - Set webhook secret → copy to `BREVO_WEBHOOK_SECRET`
- [ ] Import initial FMCSA dataset via bulk enrich endpoint
- [ ] Run first campaign in warmup mode (`OUTREACH_WARMUP=true`, limit=5) to verify pipeline
- [ ] Review `outreach_log` table entries to confirm emails are correctly formatted
- [ ] Set `OUTREACH_WARMUP=false` on Railway when ready to go live
- [ ] Gradually increase `OUTREACH_DAILY_LIMIT`: 10 → 25 → 50 → 100 over 2 weeks
- [ ] Monitor bounce rate — keep below 5% to protect sender reputation
- [ ] Register DKIM/SPF/DMARC records for `drivedrop.us.com` if not done

---

## Integration with Existing Systems

This system integrates cleanly with what was built in previous sessions:

| Previous System | Integration Point |
|----------------|-------------------|
| `brevoOutreachService` (c701d5b) | Used by `campaignManagerService.runSendLoop` for delivery |
| `hunterService` (c701d5b) | Used by `carrierEnrichmentService` as fallback |
| `apolloService` (c701d5b) | Used by `carrierEnrichmentService` as primary |
| `snovService` (c701d5b) | Used by `carrierEnrichmentService` + `verifyEmail` |
| `outreach.routes.ts` (c701d5b) | Still live at `/api/v1/outreach` — unchanged |
| `leads.routes.ts` (6e828b5) | Still live at `/api/v1/leads` — unchanged |
| Auth middleware | All new routes use identical `authenticate + authorize(['admin'])` pattern |
