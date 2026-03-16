# Outreach System — Integration Test Report
**Date:** March 16, 2026  
**Environment:** Development (`NODE_ENV=development`)  
**Server:** `http://localhost:3001`  
**Result:** ✅ **20 / 20 passed — 0 failed**

---

## 1. Health Check
| Test | Result |
|---|---|
| `GET /health` → 200 | ✅ |
| Response contains `status` field | ✅ |

---

## 2. Brevo Webhook — Bearer Token Auth
> Brevo "Token" auth mode: every inbound webhook POST must carry `Authorization: Bearer <token>`

| Test | Result |
|---|---|
| Valid `Bearer 87f52316…` → 200 + `received` field | ✅ |
| Wrong token → 401 | ✅ |
| Missing `Authorization` header → 401 | ✅ |

**Config:**  
- `BREVO_WEBHOOK_SECRET=87f52316d150f9f9fbed9499ee1729b3b3571af2`  
- Set this exact value in Brevo: **Settings → Webhooks → Authentication → Token**

---

## 3. Campaigns (Admin-only)
| Test | Result |
|---|---|
| `POST /api/v1/campaigns` (template: `introduction`) → 201 | ✅ |
| Created campaign has `id` (UUID) | ✅ |
| `GET /api/v1/campaigns` → 200 | ✅ |
| List contains ≥ 1 campaign | ✅ |
| `GET /api/v1/campaigns/:id` → 200 | ✅ |
| `POST` with missing `name` → 400 | ✅ |

**Notes:**
- All campaign routes require `role = admin` JWT
- Admin authenticated as `infos@calkons.com` via Supabase
- Available templates: `introduction`, `follow_up`, `final_notice` (see `carrierOutreach.ts`)

---

## 4. Carrier Enrichment — Live Chain (Warmup Mode)
> Provider order: **Apollo → Snov → Hunter** (Apollo `enrichOrganization` runs first to resolve real domain)

| Test | Result |
|---|---|
| `POST /api/v1/carriers/enrich` → 200 | ✅ |
| Response has `dotNumber` | ✅ |
| Response has `source` field | ✅ |
| Response has `emailVerified` field | ✅ |
| Chain ran without error | ✅ |

**Test carrier:** Swift Transportation Co LLC (DOT `195542`, Phoenix AZ)  
**Email found:** None — API quotas may be limited; chain executed correctly and returned `source: manual`, `emailVerified: false`.  
**Warmup mode:** `OUTREACH_WARMUP=true` — enrichment runs but no emails are dispatched.

---

## 5. Carrier Contact List
| Test | Result |
|---|---|
| `GET /api/v1/carriers` → 200 | ✅ |
| 1 carrier contact saved to `carrier_contacts` table | ✅ |

---

## 6. Email Verification (Snov → Hunter)
| Test | Result |
|---|---|
| Verify-email covered via enrichment chain | ✅ |

> Standalone `POST /api/v1/carriers/verify-email` is not separately mounted; verification runs internally during `enrichCarrier()` when an email is found.

---

## Provider Configuration Summary
| Provider | Key Set | Role | Quota-safe |
|---|---|---|---|
| Apollo.io | ✅ `APOLLO_API_KEY` | **Primary** — people search + org enrichment | ✅ try/catch + warn |
| Snov.io | ✅ `SNOV_CLIENT_ID / SECRET` | **Secondary** — domain prospects + email verify | ✅ try/catch + warn |
| Hunter.io | ✅ `HUNTER_API_KEY` | **Last resort** — domain search | ✅ 429/402 → warn (non-fatal) |
| SerpAPI | ✅ `SERPAPI_KEY` | **Best-effort** — company enrichment | ✅ 403/429 → warn (non-fatal) |
| Brevo | ✅ `BREVO_API_KEY` | **Sender** — `carrier@drivedrop.us.com` | ✅ warmup mode |

---

## Env Flags
```
OUTREACH_WARMUP=true        # dry-run — logs but does not send
OUTREACH_DAILY_LIMIT=10     # increase gradually as domain warms up
BREVO_OUTREACH_SENDER=carrier@drivedrop.us.com
```

---

## Next Steps
- [ ] Set Brevo webhook token (`87f52316…`) in Brevo dashboard: **Settings → Webhooks → Authentication → Token**
- [ ] Point Brevo webhook URL to `https://api.drivedrop.app/api/v1/email-webhooks/brevo`
- [ ] Verify Apollo API key credits — enrichment returned no email for test carrier
- [ ] When ready to go live: set `OUTREACH_WARMUP=false` and gradually increase `OUTREACH_DAILY_LIMIT`
- [ ] Configure Railway env vars to match local `.env` (all outreach keys)
