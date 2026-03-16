# Campaign Dashboard — Implementation Report

**Commit:** `54a8120`
**Date:** March 14, 2026
**Branch:** main

---

## Overview

Complete Next.js admin dashboard for DriveDrop's email campaign system. Built on top of the previously committed backend API (`ab09904`) which provides 28 endpoints across `/api/v1/campaigns`, `/api/v1/carriers`, and `/api/v1/analytics`.

---

## Routes Added

| URL | Description |
|-----|-------------|
| `/dashboard/admin/campaigns` | Campaign list with stats summary and status/search filters |
| `/dashboard/admin/campaigns/new` | Create new campaign form |
| `/dashboard/admin/campaigns/[id]` | Campaign detail — Analytics / Recipients / Content tabs |
| `/dashboard/admin/campaigns/[id]/edit` | Edit existing campaign |
| `/dashboard/admin/carriers` | Carrier enrichment hub (single + bulk) |
| `/dashboard/admin/campaign-analytics` | Platform-wide analytics overview |

All three routes are accessible from the **admin sidebar** (Mail, Truck, TrendingUp icons added to `admin/layout.tsx`).

---

## Files Created

### Types & API Layer

| File | Purpose |
|------|---------|
| `src/types/campaigns.ts` | Frontend type definitions (Campaign, CampaignStats, CampaignRecipient, CarrierContact, AnalyticsOverview, GeoDataPoint, FunnelStep, LeaderboardEntry, etc.) |
| `src/lib/api/campaigns.ts` | Campaign CRUD + lifecycle (start, pause, delete, test email) |
| `src/lib/api/carriers.ts` | Carrier list, enrich, bulk enrich, verify email |
| `src/lib/api/analytics.ts` | Overview, timeline, geography, funnel, leaderboard, CSV export |

All API calls use Supabase session Bearer token auth (`getSupabaseBrowserClient().auth.getSession()`).

### Campaign Components

| Component | Description |
|-----------|-------------|
| `StatsCard` | Reusable metric card — 6 accent colours, skeleton loading, trend arrows |
| `CampaignList` | Table with status badges, start/pause/delete actions, empty state |
| `CampaignForm` | Create/edit form — 4 sections (Basic Info, Email Content, Audience, Settings) |
| `EmailTemplateEditor` | Template picker (Introduction / Follow-up / Special Offer), HTML edit tab, iframe Preview tab, variables hint box |
| `TargetAudienceBuilder` | US states multi-select, power units min/max, business type radio, verified-only toggle |
| `CampaignStats` | 8 metric cards: Recipients, Sent, Delivered, Opened, Clicked, Bounced, Open Rate, Click Rate |
| `RecipientsList` | Paginated recipient table (25/page), status filter chips |
| `TestEmailModal` | Dialog with email input, calls `sendTestEmail()` API |

### Analytics Components

| Component | Description |
|-----------|-------------|
| `PerformanceChart` | recharts `LineChart` — Sent (grey) / Opens (teal) / Clicks (orange) over time |
| `FunnelChart` | recharts horizontal `BarChart` — engagement funnel stages |
| `GeoMap` | Sorted state heatmap table with inline bar visualisation and open rate |
| `LeaderboardTable` | Top campaigns by open rate with medal emojis for top 3, links to detail pages |
| `OverviewDashboard` | 4 stat cards + leaderboard, auto-refreshes every 30 seconds |
| `ExportButton` | Downloads CSV via `URL.createObjectURL(blob)`, toast on success |

### Carrier Components

| Component | Description |
|-----------|-------------|
| `CarriersList` | Searchable table with DOT#, company, state, email, verification status, power units; Re-enrich + Verify actions |
| `EnrichmentForm` | Single DOT# lookup — posts minimal FMCSACarrierData to `/carriers/enrich` |
| `BulkEnrichModal` | CSV drag-and-drop (up to 500 DOTs), preview first 5, maps to FMCSACarrierData array, shows enriched/failed summary |

---

## Technical Decisions

- **No React Query** — matches existing codebase pattern (`useState` + `useEffect` + `useCallback`)
- **Auth** — Supabase session `access_token` as Bearer header (consistent with leads/page.tsx pattern)
- **Toast** — existing `@/components/ui/toast` custom system (`toast(msg, 'success'|'error'|'warning'|'info')`)
- **recharts** — installed via `npm install recharts --save`; used for LineChart, BarChart
- **TypeScript** — zero errors under `strict: true`

---

## Email Templates (EmailTemplateEditor)

Three fully-branded HTML templates included:

| ID | Subject Line | Use Case |
|----|-------------|----------|
| `introduction` | "Streamline Your Auto Transport Loads with DriveDrop" | First contact with a carrier |
| `followUp` | "Quick question about {{companyName}}'s load board needs" | Second touch if no response |
| `specialOffer` | "Exclusive offer for {{state}} carriers" | Promotional / incentive push |

Supported variables: `{{companyName}}`, `{{city}}`, `{{state}}`, `{{unsubUrl}}`, `{{trackingPixelUrl}}`, `{{campaignId}}`

---

## DriveDrop Brand Colours Used

- Primary teal: `#00B8A9`
- Accent orange: `#FF9800`
- Hover teal: `#009e92`

---

## What's Ready to Test

1. Navigate to `/dashboard/admin/campaigns` — create, start, pause, and delete campaigns
2. `/dashboard/admin/campaigns/new` — pick a template, set target audience, configure warmup/daily limit
3. `/dashboard/admin/campaigns/[id]` — view live stats, browse recipients by status, preview email content, send test
4. `/dashboard/admin/carriers` — enrich a single carrier by DOT#, or upload a CSV for bulk enrichment
5. `/dashboard/admin/campaign-analytics` — platform-wide metrics with 30-second auto-refresh and CSV export
