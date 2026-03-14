# Email Campaign System — Technical Documentation

## Overview

The DriveDrop Email Campaign System enables admin users to:
- Discover and enrich FMCSA carrier data with verified email addresses
- Create and manage segmented email campaigns
- Send outreach at rate-limited, warmup-controlled pace via Brevo
- Track email engagement events in real-time via webhooks
- Analyze performance with time-series, geographic, and funnel analytics

---

## Architecture

```
FMCSA Data  ──►  carrierEnrichmentService  ──►  carrier_contacts (DB)
                     (Apollo / Hunter / Snov)
                              │
               campaignManagerService ◄──── email_campaigns (DB)
                 │       │       │
                 │       │   brevoOutreachService (sends via Brevo)
                 │       │
              campaign_recipients     email_events
                                          ▲
                              Brevo Webhooks
                              (/email-webhooks/brevo)
                                          │
                              analyticsService
                         (performance / timeline / geo / funnel)
```

---

## Database Tables

All tables are in the public schema with admin-only RLS policies.

### `carrier_contacts`
Stores FMCSA carriers enriched with email data.  
Key columns: `dot_number` (unique), `email`, `email_verified`, `email_verification_score`, `source`, `power_units`, `state`

### `email_campaigns`
Campaign definitions and aggregate counters.  
Key columns: `status` (draft/scheduled/sending/paused/completed/cancelled), `target_audience` (JSONB), `warmup_mode`, `daily_limit`, `sent_count`, `delivered_count`, `opened_count`, `clicked_count`, `bounced_count`

### `campaign_recipients`
One row per carrier–campaign pair.  
Key columns: `status` (pending/sent/delivered/opened/clicked/bounced/failed/unsubscribed), `open_count`, `click_count`

### `email_events`
Individual email events streaming in from Brevo.  
Key columns: `event_type` (sent/delivered/opened/clicked/bounced/spam/unsubscribed), `device_type`, `link_url`

### `email_suppression_list`
Email addresses that must never receive outreach.  
Populated automatically on hard_bounce and spam events.

### `campaign_conversions`
Tracks downstream conversions (carrier signups) attributed to campaigns.

---

## Services

### `carrierEnrichmentService`

| Method | Description |
|--------|-------------|
| `enrichCarrier(fmcsaData)` | Apollo → Hunter → Snov fallback to find email |
| `verifyEmail(email)` | Snov → Hunter fallback verification |
| `guessDomain(companyName)` | Derive domain from company name |
| `saveCarrierContact(enriched)` | Upsert to carrier_contacts |
| `bulkEnrich(carriers, batchSize)` | Rate-limited bulk enrichment |

**Enrichment priority:**
1. **Apollo** — people search by domain or keywords (best quality)
2. **Hunter** — domain email search (good for generic contacts)
3. **Snov** — domain prospect finder (fallback)

### `campaignManagerService`

| Method | Description |
|--------|-------------|
| `createCampaign(params)` | Create draft campaign |
| `startCampaign(id)` | Queue recipients and begin send loop |
| `pauseCampaign(id)` | Pause sending |
| `getCampaignStats(id)` | Computed rates (open, click, bounce, conversion) |
| `trackEvent(event, campaignId)` | Record Brevo webhook event |
| `handleUnsubscribe(email, campaignId, token)` | Process unsubscribe |
| `handleBounce(email, bounceType)` | Add to suppression list |
| `personalize(html, vars)` | Replace `{{variable}}` placeholders |
| `getUnsubToken(email, campaignId)` | HMAC-SHA256 sign token |

**Rate limiting:** 1 email per 2 seconds (30/min), `OUTREACH_DAILY_LIMIT` cap per campaign per day.

**Warmup mode:** When `OUTREACH_WARMUP=true` (default), emails are logged but NOT sent via Brevo. Set to `false` for production sends.

### `analyticsService`

| Method | Description |
|--------|-------------|
| `getOverview()` | Aggregated stats across all campaigns |
| `getCampaignPerformance(id)` | Full metrics for one campaign |
| `getTimeSeriesData(id, days)` | Daily event counts |
| `getGeoAnalytics(id)` | Open/click rates by US state |
| `getDeviceAnalytics(id)` | Desktop/mobile/tablet breakdown |
| `getEngagementFunnel(id)` | Total → Sent → Delivered → Opened → Clicked → Converted |
| `getLeaderboard(limit)` | Top campaigns by open count |
| `exportCampaignReport(id)` | JSON report (all of the above) |

---

## API Routes

All routes require `authenticate + authorize(['admin'])` except the unsubscribe GET page.

### Campaigns — `/api/v1/campaigns`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create campaign (specify `template` or `htmlContent`) |
| GET | `/` | List campaigns (`?status=&search=&page=&limit=`) |
| GET | `/:id` | Get campaign |
| PATCH | `/:id` | Update draft/paused campaign |
| POST | `/:id/start` | Start sending |
| POST | `/:id/pause` | Pause |
| DELETE | `/:id` | Delete draft |
| GET | `/:id/stats` | Computed stats |
| GET | `/:id/recipients` | List recipients (`?status=&page=&limit=`) |
| POST | `/:id/test` | Send test email to `{ email }` |

**Using a template:**
```json
POST /api/v1/campaigns
{
  "name": "Q1 Carrier Outreach",
  "subject": "New loads available — {{companyName}}",
  "template": "introduction",
  "targetAudience": { "states": ["NC", "SC", "VA"], "emailVerified": true },
  "dailyLimit": 25
}
```

Available templates: `introduction`, `followUp`, `specialOffer`

### Carriers — `/api/v1/carriers`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/enrich` | Enrich a single carrier |
| POST | `/enrich/bulk` | Bulk enrich up to 500 carriers (async) |
| GET | `/` | List contacts (`?state=&hasEmail=true&emailVerified=&search=`) |
| GET | `/:id` | Get carrier |
| PATCH | `/:id` | Update (email, phone, website, notes) |
| POST | `/:id/verify-email` | Re-verify email via Snov/Hunter |

### Analytics — `/api/v1/analytics`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/overview` | All-campaign aggregate stats |
| GET | `/campaigns/:id/performance` | Full metrics |
| GET | `/campaigns/:id/timeline?days=30` | Daily time-series |
| GET | `/campaigns/:id/geography` | By-state breakdown |
| GET | `/campaigns/:id/devices` | Device types |
| GET | `/campaigns/:id/funnel` | Engagement funnel |
| GET | `/leaderboard?limit=10` | Top campaigns |
| GET | `/export/:campaignId?format=csv` | JSON or CSV export |

### Email Webhooks — `/api/v1/email-webhooks`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/brevo` | Brevo event receiver (HMAC-verified) |
| GET | `/unsubscribe/:token` | Unsubscribe confirmation page |
| POST | `/unsubscribe` | Process unsubscribe form |
| GET | `/health` | Health check |

---

## Email Templates

Templates are in `src/services/outreach/templates/carrierOutreach.ts`.

| Template | Subject | Purpose |
|----------|---------|---------|
| `introduction` | "New shipment opportunities for {{companyName}}" | Cold intro |
| `followUp` | "Following up — DriveDrop loads available in {{state}}" | 7-day follow-up |
| `specialOffer` | "Exclusive offer for {{companyName}} — $0 processing for 90 days" | Promo push |

**Personalization variables:** `{{companyName}}`, `{{city}}`, `{{state}}`, `{{unsubUrl}}`

---

## Security

- **Webhook verification:** `BREVO_WEBHOOK_SECRET` HMAC-SHA256 signature checked on every Brevo event
- **Unsubscribe tokens:** HMAC-SHA256 signed with `BREVO_WEBHOOK_SECRET` — impossible to forge
- **Suppression list:** Hard bounces and spam reports auto-added, checked before every send
- **Admin-only:** All campaign/carrier/analytics routes require `role = admin`
- **Input validation:** All `req.params` and `req.query` treated as untrusted strings
- **XSS prevention:** Unsubscribe page HTML-escapes all user-supplied values

---

## Environment Variables

```env
# Required for email sending
BREVO_API_KEY=...
BREVO_WEBHOOK_SECRET=...       # Set in Brevo dashboard → Webhooks
BREVO_OUTREACH_SENDER=outreach@drivedrop.us.com
BREVO_OUTREACH_NAME=DriveDrop Team

# Required for enrichment (at least one)
HUNTER_API_KEY=...
APOLLO_API_KEY=...
SNOV_CLIENT_ID=...
SNOV_CLIENT_SECRET=...

# Optional enrichment
SERPAPI_KEY=...

# Behavior
OUTREACH_WARMUP=true           # false to actually send
OUTREACH_DAILY_LIMIT=10        # Increase gradually
APP_URL=https://drivedrop.app  # For unsubscribe links
```

---

## Quick Start

### 1. Run the DB migration
```sql
-- Apply backend/migrations/email_campaign_system.sql in Supabase SQL Editor
```

### 2. Configure environment
Copy `.env.example` values and fill in API keys.

### 3. Import carriers from FMCSA
```bash
POST /api/v1/carriers/enrich/bulk
{ "carriers": [ { "dotNumber": "12345", "companyName": "...", ... } ] }
```

### 4. Create a campaign
```bash
POST /api/v1/campaigns
{ "name": "Test", "subject": "Hi {{companyName}}", "template": "introduction",
  "targetAudience": { "states": ["NC"], "emailVerified": true }, "dailyLimit": 5 }
```

### 5. Start (warmup mode — logs only)
```bash
POST /api/v1/campaigns/:id/start
```

### 6. Monitor analytics
```bash
GET /api/v1/analytics/campaigns/:id/performance
GET /api/v1/analytics/campaigns/:id/funnel
```

### 7. Go live
Set `OUTREACH_WARMUP=false` and increase `OUTREACH_DAILY_LIMIT` gradually (10 → 25 → 50 → 100).

---

## Compliance

- Every email contains a mandatory unsubscribe link (`{{unsubUrl}}`)
- Unsubscribes are processed instantly via HMAC-verified token
- Hard bounces and spam complaints automatically blacklist the address
- All outreach data stored in `carrier_contacts` comes from public FMCSA records
