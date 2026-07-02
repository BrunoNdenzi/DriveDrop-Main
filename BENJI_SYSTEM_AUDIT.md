# Benji System Audit — Pre-v2 Redesign
*Audit date: 2026-07-01 | Scope: full implementation-level analysis*

---

## Table of Contents
1. [Where Benji Is Used](#1-where-benji-is-used)
2. [Architecture](#2-architecture)
3. [Intelligence Classification](#3-intelligence-classification)
4. [Inputs](#4-inputs)
5. [Outputs](#5-outputs)
6. [Route Planner Audit](#6-route-planner-audit)
7. [OpenAI Usage](#7-openai-usage)
8. [Memory & Context](#8-memory--context)
9. [Decision-Making Logic](#9-decision-making-logic)
10. [Pain Points](#10-pain-points)
11. [Refactor Opportunities](#11-refactor-opportunities)
12. [Recommended Extraction](#12-recommended-extraction)

---

## 1. Where Benji Is Used

### 1.1 Client Side

#### Feature: Conversational Assistant (BenjiChat)
- **Pages:** `/dashboard/client` · `/dashboard/client/new-shipment` · `/dashboard/client/shipments/[id]`
- **Component:** `website/src/components/benji/BenjiChat/BenjiChat.tsx`
- **What Benji does:** Floating chat widget. Receives free-text questions or suggestion-chip taps. Sends full conversation history + context object (`userType`, `currentPage`, `shipmentId`, `attachments`) to backend `/api/v1/ai/chat`. Returns a text reply + 3 suggestion chips.
- **Intelligence type:** LLM (GPT-4o-mini) with role-specific system prompt.
- **User flow:** User opens chat → welcome message + suggestion chips → user types or taps chip → POST to backend → response rendered in `BenjiMessage`.
- **Attachment handling:** User can attach files (max 10 MB, images / PDF / CSV / XLSX). Files are uploaded to Supabase storage first (`aiService.extractDocument`), then the URL is passed in the chat context. Benji acknowledges the file but does NOT yet parse it inline in chat — parsing requires the dedicated `BenjiDocumentScanner` flow.

#### Feature: Natural Language Shipment Creation
- **Pages:** `/dashboard/client/new-shipment` · homepage `AIQuoteSection`
- **Component:** `website/src/components/ai/NaturalLanguageShipmentCreator.tsx`
- **What Benji does:** User types or speaks a free-text description (e.g., *"Ship my 2023 Honda Civic from LA to NYC next week"*). The component calls `aiService.createShipmentFromPrompt()` → backend parses → creates `shipments` row → redirects to `/dashboard/client/shipments/{id}`.
- **Intelligence type:** LLM (GPT-4o) via `NaturalLanguageShipmentService`.
- **User flow:** Text input (or voice via `webkitSpeechRecognition`) → `POST /api/v1/ai/natural-language-shipment` → 422 if fields missing (shows clarification questions) → 200 creates shipment → 2-second delay → redirect.
- **Voice input:** Browser-native `SpeechRecognition` / `webkitSpeechRecognition`. `continuous: true`, `interimResults: true`. No server-side STT.

#### Feature: Document Scanner (AI OCR)
- **Pages:** Embedded in `NaturalLanguageShipmentCreator` via camera/upload button
- **Component:** `website/src/components/benji/BenjiDocumentScanner.tsx`
- **What Benji does:** User takes photo (live camera via `getUserMedia`) or drag-drops a file. Component calls `aiService.extractDocument()` → backend runs GPT-4o vision → returns structured vehicle data (VIN, year, make, model, etc.).
- **Intelligence type:** LLM (GPT-4o vision).
- **User flow:** Select doc type → capture/upload → `POST /api/v1/ai/extract-document` with public Supabase storage URL → extraction result pre-fills shipment form.

---

### 1.2 Driver Side

#### Feature: Load Recommendations
- **Page:** `/dashboard/driver/jobs`
- **Component:** `website/src/components/driver/BenjiLoadRecommendations.tsx`
- **What Benji does:** Fetches personalized ranked list of pending shipments for the logged-in driver. Calls `GET /api/v1/ai/loads/recommendations/{driverId}`. Response is pre-categorized as `best_match` / `good_matches` / `consider`. Shows match score, estimated earnings, distance to pickup, and human-readable reasons.
- **Intelligence type:** Pure heuristic scoring (no LLM). See §9.
- **User flow:** Page loads → auth token retrieved → fetch recommendations → rendered as priority-tiered cards → driver can tap "Accept" (currently a TODO, does NOT execute the assignment).
- **Known gap:** "Accept Load" button calls `acceptLoad(loadId)` which shows a toast but does not actually update the shipment or call any API.

#### Feature: Conversational Assistant (BenjiChat)
- **Pages:** `/dashboard/driver` · `/dashboard/driver/jobs/[id]`
- **Component:** Same `BenjiChat` as client, `userType: 'driver'`
- **System prompt:** Includes Carolina corridor intelligence, fuel price data (SC $0.20–0.30/gal cheaper), FMCSA break rules, metro rush-hour windows.

#### Feature: Route Planner
- **Page:** `/dashboard/driver/route-planner`
- **What Benji does:** The page renders only a `BenjiChat` widget. The `RouteOptimizationService` backend exists and is fully implemented but is NOT surfaced in the UI. The driver-facing route optimization UI is absent.
- **Intelligence type:** N/A (frontend is chat-only; backend service exists unused by the UI).

---

### 1.3 Admin Side

#### Feature: Benji Dispatcher (Auto-Assignment)
- **Page:** `/dashboard/admin/assignments`
- **Component:** `website/src/components/admin/BenjiDispatcher.tsx`
- **What Benji does:** Admin triggers analysis → `POST /api/v1/ai/dispatcher/analyze` → returns `DispatchAnalysis` with `optimal_matches[]`, efficiency score, estimated revenue, fuel savings, time saved. Admin reviews, selects/deselects matches, and triggers `POST /api/v1/ai/dispatcher/auto-assign`.
- **Intelligence type:** Pure heuristic scoring (no LLM). See §9.
- **Auto-selection:** Matches with `confidence > 80` are pre-selected.
- **User flow:** Admin opens Assignments page → `analyzeOpportunities()` runs on mount → analysis cards rendered → admin clicks "Auto-Assign Selected" → backend creates assignments.

#### Feature: Conversational Assistant (BenjiChat)
- **Pages:** `/dashboard/admin` · `/dashboard/admin/shipments/[id]`
- **Component:** Same `BenjiChat`, `userType: 'admin'`
- **System prompt:** Dispatcher, ticket resolution, document review, real-time alerts context.

#### Feature: AI Review Queue (Documents)
- **Page:** `/dashboard/admin/ai-review`
- **Backend:** `AIDocumentExtractionService` writes low-confidence extractions to `document_extraction_queue` with `requires_review: true`. Admin reviews and corrects.
- **What Benji does:** Extractions with `confidence_score < 0.85` surface here for human correction.

---

### 1.4 Broker Side

#### Feature: Conversational Assistant (BenjiChat)
- **Pages:** `/dashboard/broker` · `/dashboard/broker/shipments/bulk-upload`
- **System prompt:** Bulk upload guidance, API integration builder, carrier matching.

#### Feature: Bulk Upload (AI Validation)
- **Component:** Referenced in broker pages
- **Backend:** `BulkUploadService` at `POST /api/v1/ai/bulk-upload`
- **What Benji does:** Parses CSV/Excel with multiple shipments. AI validates and flags issues.

---

## 2. Architecture

### 2.1 Component Map

```
website/
├── src/
│   ├── services/
│   │   └── aiService.ts             ← Singleton client; all backend calls go here
│   ├── components/
│   │   ├── benji/
│   │   │   ├── BenjiChat/
│   │   │   │   ├── BenjiChat.tsx    ← Chat widget (floating panel)
│   │   │   │   ├── BenjiMessage.tsx ← Message bubble renderer
│   │   │   │   └── BenjiTypingIndicator.tsx
│   │   │   └── BenjiDocumentScanner.tsx ← Camera + drag-drop OCR
│   │   ├── ai/
│   │   │   ├── NaturalLanguageShipmentCreator.tsx ← Text/voice → shipment
│   │   │   └── AIDocumentUpload.tsx ← Standalone doc upload
│   │   ├── driver/
│   │   │   └── BenjiLoadRecommendations.tsx ← Driver job cards
│   │   └── admin/
│   │       └── BenjiDispatcher.tsx  ← Auto-dispatch panel
│   └── app/
│       └── api/
│           └── quotes/
│               └── calculate/route.ts ← Quote calc (Google Maps + pricing formula)

backend/
├── src/
│   ├── config/
│   │   ├── ai.config.ts             ← Model map, rate limits, token tracker, response cache
│   │   └── features.ts              ← Feature flags (all currently default ON)
│   ├── routes/
│   │   ├── ai.routes.ts             ← All /api/v1/ai/* endpoints
│   │   ├── dispatcher.ts            ← /api/v1/dispatcher/* (older AIDispatcherService)
│   │   └── routeOptimization.routes.ts ← Route optimization endpoints
│   └── services/
│       ├── BenjiChatService.ts          ← LLM chat, system prompts, caching
│       ├── BenjiDispatcherService.ts    ← Heuristic auto-dispatch (used by frontend)
│       ├── BenjiLoadRecommendationService.ts ← Heuristic load matching
│       ├── AIDispatcherService.ts       ← Older heuristic dispatcher (separate routes)
│       ├── AIDocumentExtractionService.ts ← GPT-4o vision + queue management
│       ├── NaturalLanguageShipmentService.ts ← GPT-4o NL parsing
│       ├── BulkUploadService.ts         ← CSV/Excel multi-shipment upload
│       └── RouteOptimizationService.ts  ← TSP + Carolina traffic (NOT used by frontend)
```

### 2.2 Request Flow

```
CLIENT ACTION
  │
  ▼
BenjiChat.tsx / NaturalLanguageShipmentCreator.tsx / BenjiLoadRecommendations.tsx
  │
  ▼  HTTP (fetch with Supabase JWT Bearer token)
aiService.ts  →  POST/GET  https://drivedrop-main-production.up.railway.app/api/v1/ai/*
  │
  ▼
Express Router  (backend/src/routes/ai.routes.ts)
  │  authenticate middleware (verifies Supabase JWT)
  │  aiRateLimit middleware (per-user per-service sliding window)
  │
  ▼
Service Layer
  ├── BenjiChatService    → openai.chat.completions.create (GPT-4o-mini)
  ├── NLShipmentService   → openai.chat.completions.create (GPT-4o)
  ├── AIDocService        → openai.chat.completions.create (GPT-4o vision)
  ├── BenjiDispatcher     → pure Supabase queries + heuristic math
  └── LoadRecommendation  → pure Supabase queries + heuristic math
  │
  ▼  (for AI services only)
aiUsageTracker.track()   ← in-memory token log
aiResponseCache.set()    ← in-memory response cache
  │
  ▼
JSON response → aiService.ts → React component state update
```

### 2.3 Quote Flow (separate — does NOT go through Railway)

```
Client fills quote form
  │
  ▼
POST /api/quotes/calculate  (Next.js API route — Vercel serverless)
  │
  ▼
Google Maps Distance Matrix API  → distance_miles
  │
  ▼
POST {BACKEND_API_URL}/api/v1/pricing/calculate  (Railway)
  │
  ▼
pricing.service.ts  → BASE_RATES formula + surgeMultiplier + fuelAdjustment
  │
  ▼
price breakdown JSON → website
```

### 2.4 Background Jobs / Cron
- **None.** There are no cron jobs, background workers, or message queues for Benji. All processing is synchronous per request.
- The `document_extraction_queue` table exists and has queue semantics in the DB, but processing is triggered synchronously when the document is uploaded (no background worker drains the queue).

---

## 3. Intelligence Classification

| Feature | Classification | Models/Algorithms | Notes |
|---|---|---|---|
| Benji Chat | **LLM** | GPT-4o-mini | Role-specific system prompt, in-memory response cache |
| NL Shipment Parsing | **LLM** | GPT-4o | JSON-mode structured extraction, fallback to regex |
| Document OCR/Extraction | **LLM (vision)** | GPT-4o | Image URL passed via OpenAI vision API |
| Load Recommendations | **Heuristic scoring** | None | Weighted 5-factor score (see §9) |
| Dispatcher Auto-Assign | **Heuristic scoring** | None | Weighted 5-factor score + greedy assignment |
| Route Optimization | **Deterministic algorithm** | Google Maps Directions API | TSP nearest-neighbor + 2-opt improvement |
| Quote Calculation | **Deterministic formula** | Google Maps Distance Matrix API | BASE_RATES table × multipliers |
| Driver Location Estimation | **Heuristic fallback** | None | Last completed delivery location OR hardcoded Austin TX |

---

## 4. Inputs

| Input | Source | Consumed By |
|---|---|---|
| User chat messages (text) | `BenjiChat.tsx` state | BenjiChatService |
| File attachments (image/PDF/CSV/XLSX) | Supabase Storage `documents/ai-extractions/` | AIDocumentExtractionService |
| Natural language prompt (text) | `NaturalLanguageShipmentCreator.tsx` input | NaturalLanguageShipmentService |
| Voice transcript | Browser `SpeechRecognition` → `NaturalLanguageShipmentCreator.tsx` | NaturalLanguageShipmentService |
| Shipment data | `shipments` table | BenjiDispatcherService, BenjiLoadRecommendationService |
| Driver profile | `profiles` table (role = driver) | BenjiLoadRecommendationService, BenjiDispatcherService |
| Driver's last delivery location | `shipments.delivery_location` where driver_id = X and status = completed | Proxy for current driver position |
| Pickup coordinates | `shipments.pickup_location` (PostGIS geometry `[lng, lat]`) | RouteOptimizationService, scoring services |
| Delivery coordinates | `shipments.delivery_location` | RouteOptimizationService, scoring services |
| Vehicle type | `shipments.vehicle_type` | pricing.service.ts, route optimizer |
| Estimated price | `shipments.estimated_price` | Dispatcher earnings scoring |
| Driver rating | `profiles.rating` | BenjiDispatcherService (5% weight), LoadRecommendation |
| Completed shipment count | `shipments` COUNT where driver_id + status=completed | Experience scoring |
| Google Maps Distance Matrix | External API (`maps.googleapis.com/distancematrix`) | Quote calculator |
| Google Maps Directions | External API (`maps.googleapis.com/directions`) | RouteOptimizationService |
| Supabase JWT | `supabase.auth.getSession()` | All backend endpoints (auth middleware) |
| userType context | Passed as prop to BenjiChat | BenjiChatService system prompt selection |
| currentPage context | Passed as prop to BenjiChat | BenjiChatService system prompt |
| shipmentId context | Passed as prop to BenjiChat | BenjiChatService system prompt |
| Fuel price per region | Hardcoded constants in RouteOptimizationService | Fuel cost calculation |
| FMCSA break rules | Hardcoded constants in RouteOptimizationService | Break schedule generation |
| Carolina corridor data | Hardcoded lookup tables in RouteOptimizationService | Traffic delay estimation |

---

## 5. Outputs

| Output | Format | Generated By | Logic/Formula |
|---|---|---|---|
| Chat response message | `string` | GPT-4o-mini | LLM completion |
| Chat suggestion chips | `string[]` (max 3) | `generateSuggestions()` in BenjiChatService | Keyword matching on last LLM response → hardcoded chip lists by userType |
| Chat confidence score | `float 0–1` | `calculateConfidence()` | `finish_reason === 'stop'` → 0.95; `'length'` → 0.80; else 0.85 |
| Parsed shipment JSON | `ParsedShipmentData` | GPT-4o, parsed from JSON-mode response | System prompt defines exact schema |
| Missing fields list | `string[]` | NL service, from GPT-4o output | Fields not found in user prompt |
| Clarification questions | `string[]` | GPT-4o, extracted from response | Returned when critical fields missing |
| Estimated shipment price | `number` (USD) | `pricing.service.ts` | `BASE_RATES[vehicleType][band] × distance × deliveryMultiplier × surgeMultiplier × fuelAdjustment` |
| Extracted document data | `ExtractedData` object | GPT-4o vision | Structured JSON from vision prompt |
| Document confidence score | `float 0–1` | AIDocumentExtractionService | Completeness: filled fields / total fields |
| Load match score | `integer 0–100` | BenjiLoadRecommendationService | `proximity×0.35 + routeFit×0.25 + earnings×0.20 + timing×0.10 + compatibility×0.10` |
| Load priority tier | `'best' \| 'good' \| 'consider'` | BenjiLoadRecommendationService | `score ≥ 85` → best; `≥ 70` → good; `≥ 50` → consider |
| Personalized insights | `string[]` | `generateInsights()` in LoadRecommendationService | Rule-based text generation from score data |
| Driver-load match score | `integer 0–100` | BenjiDispatcherService | `proximity×0.40 + routeFit×0.25 + earnings×0.20 + experience×0.10 + rating×0.05` |
| Estimated driver earnings | `number` (USD) | BenjiDispatcherService | `load.estimated_price × 0.80` (80/20 split hardcoded) |
| Dispatch analysis | `DispatchAnalysis` | BenjiDispatcherService | Aggregated stats over all matches |
| Optimized route stops | `OptimizedStop[]` | RouteOptimizationService | TSP sequence with ETAs |
| Route savings | `RouteSavings` | RouteOptimizationService | Distance saved vs naive order |
| Carolina corridor insights | `CarolinaInsight[]` | RouteOptimizationService | Route segments × corridor data |
| Fuel stop recommendations | `FuelStopRecommendation[]` | RouteOptimizationService | Planned every ~300 miles, SC-first for price |
| Benji tips (route) | `string[]` | RouteOptimizationService | Rule-based from route analysis |
| Daily driver plan | `DailyPlan` | RouteOptimizationService | Combined routes + breaks + weather summary |

---

## 6. Route Planner Audit

### Service
`backend/src/services/RouteOptimizationService.ts`

### Algorithm
**TSP (Travelling Salesman Problem) — Nearest-Neighbor + 2-opt improvement**

1. **Nearest-neighbor construction:**  
   Starting from current driver location, at each step pick the unvisited stop closest to current position. Creates an initial feasible route.

2. **2-opt improvement:**  
   Iteratively try all pairs of edges `(i, k)`. If reversing the path between them reduces total distance, apply the swap. Repeat until no improving swap exists.  
   Complexity: O(n²) per iteration. Effective for `n < 20` stops (realistic for single driver day).

### Constraints Applied
| Constraint | Implementation |
|---|---|
| Time windows | `stop.timeWindow.earliest / latest` — arrival before `latest` checked; soft constraint only (no backtracking if violated) |
| FMCSA break after 8 hours | After 480 minutes cumulative driving, insert a 30-min rest stop |
| FMCSA 11-hour daily driving limit | 660 minutes max; stops scheduled beyond limit flagged but not blocked |
| 14-hour on-duty limit | 840 minutes; same handling |
| Return to origin | Optional `returnToOrigin` flag; closes the TSP loop |

### Scoring / Efficiency
`RouteSummary.efficiencyScore` = `Math.max(0, 100 - (emptyMilesPercent × 1.5))` where `emptyMilesPercent = emptyMiles / totalMiles × 100`.

### APIs Used
- **Google Maps Directions API** — called per leg for real road distance and duration.  
  Endpoint: `https://maps.googleapis.com/maps/api/directions/json`  
  Service: `googleMapsService.getDirections()` in `backend/src/services/google-maps.service.ts`

### Fuel Logic
- Vehicle MPG pulled from hardcoded `FUEL_ECONOMY` table (e.g., car hauler loaded = 6.5 MPG, pickup+trailer = 10 MPG).
- Fuel price pulled from hardcoded `FUEL_PRICES` table by state code (NC: $3.25, SC: $3.05, VA: $3.35, etc.).
- `totalFuelCost = (totalMiles / mpg) × fuelPrice`
- Fuel stop recommended every ~300 miles, preferring SC stations for lowest price.

### Deadhead Calculation
- Empty miles = sum of legs flagged as `type: 'empty'` (driver traveling to pickup with no cargo).
- Route is sequenced to minimize consecutive empty legs by interleaving pickups and deliveries of different shipments when possible.

### Carolina-Specific Intelligence
Hardcoded lookup tables for:
- 6 major corridors: I-85, I-77, I-40, I-26, I-95, I-74 with avg speeds and peak-hour delay percentages.
- 5 metro zones: Charlotte, Raleigh-Durham, Greensboro, Columbia SC, Charleston SC with peak windows and % delay.
- Traffic delay applied by checking if route passes within `radius` miles of metro center at current time of day.

### Current Weaknesses
1. **Frontend does not use it.** `/dashboard/driver/route-planner` only renders `BenjiChat`. The full `RouteOptimizationService` is called from `routeOptimization.routes.ts` but there is no UI consuming it.
2. **No live traffic.** Carolina delays are hardcoded percentages, not real-time traffic from Google Maps.
3. **No state estimation.** Driver's current position defaults to last completed delivery or Austin TX — could be 1,000 miles off.
4. **TSP is greedy.** Nearest-neighbor produces O(log n) approximation; does not guarantee optimal. For > 10 stops the 2-opt may miss significant improvements.
5. **Time windows are soft constraints.** No backtracking if a time window is violated.
6. **Carolina-only.** The intelligence layer (corridors, metro zones, fuel prices) is geographically hardcoded to NC/SC/VA/GA/TN.

---

## 7. OpenAI Usage

### 7.1 Benji Chat
- **Endpoint:** `POST /api/v1/ai/chat`
- **Service:** `backend/src/services/BenjiChatService.ts`
- **Model:** `gpt-4o-mini`
- **Temperature:** `0.7`
- **Max tokens:** `1000`
- **Cost:** $0.15/1M input, $0.60/1M output
- **System prompt:** Role-specific (client/driver/admin/broker). Driver prompt includes ~800 tokens of Carolina corridor data.
- **User messages:** Full conversation history sent each call (no trimming/summarization).
- **Expected output:** Free text reply (2–3 sentences target), no structured format enforced.
- **Response parsing:** Raw `completion.choices[0].message.content` string.
- **Fallback:** On HTTP 429 or `insufficient_quota`, returns hardcoded fallback responses by `userType` from `getFallbackResponse()`.
- **Cache:** In-memory `aiResponseCache` keyed by `(service, lastUserMessage)`. Hit returns immediately without calling OpenAI.
- **Token tracking:** Every call tracked in `aiUsageTracker` (in-memory array).

### 7.2 Natural Language Shipment Parsing
- **Endpoint:** `POST /api/v1/ai/natural-language-shipment`
- **Service:** `backend/src/services/NaturalLanguageShipmentService.ts`
- **Model:** `gpt-4o`
- **Temperature:** `0.1`
- **Max tokens:** `2000`
- **Cost:** $2.50/1M input, $10.00/1M output
- **System prompt:** Instructs extraction of `{vehicle, pickup, delivery, preferences, metadata}` as JSON. Defines date parsing rules ("next week" → ISO+7), location normalization, VIN extraction.
- **User messages:** Single user message — the raw prompt text.
- **Expected output:** `JSON-mode` structured response matching `ParsedShipmentData` interface.
- **Response parsing:** `JSON.parse(completion.choices[0].message.content)`. Throws if JSON invalid.
- **Fallback:** `fallbackParsing()` — regex-based VIN extraction, basic keyword matching for location. Confidence 0.3–0.6.
- **Logging:** On success, inserts to `ai_shipment_prompts` table: `{user_id, input_text, input_method, parsed_data, confidence_score, created_at}`.

### 7.3 Document OCR + Data Extraction
- **Endpoint:** `POST /api/v1/ai/extract-document`
- **Service:** `backend/src/services/AIDocumentExtractionService.ts`
- **Model:** `gpt-4o` (vision)
- **Temperature:** `0.1`
- **Max tokens:** `2000`
- **Cost:** $2.50/1M input, $10.00/1M output (plus image tokens)
- **System prompt:** Instructs extraction of `ExtractedData` structure (vehicle info, seller/buyer info, sale info, insurance, inspection). Returns JSON.
- **Image handling:** Document must be in Supabase public storage. URL passed as `image_url` in OpenAI vision content array.
- **Confidence scoring:**  
  `confidence = filledFields / totalExpectedFields`  
  Expected fields depend on `documentType` (bill_of_sale expects seller, buyer, sale_info; title expects vehicle_info only, etc.)
- **Human review threshold:** `confidence_score < 0.85` → `requires_review: true` → written to `document_extraction_queue` with `status: 'pending_review'`
- **Queue table:** `document_extraction_queue` with columns: `id, shipment_id, document_type, file_url, uploaded_by, status, extracted_data, confidence_score, requires_review, ocr_text, created_at`
- **Fallback:** No OCR fallback (Google Cloud Vision / AWS Textract mentioned in comments but not implemented). If OpenAI fails, throws.

### 7.4 No Other OpenAI Usage
- **BenjiDispatcherService:** No OpenAI. Pure heuristic math.
- **BenjiLoadRecommendationService:** No OpenAI. Pure heuristic math.
- **RouteOptimizationService:** No OpenAI. Google Maps + deterministic algorithms.
- **pricing.service.ts:** No OpenAI. Formula.
- **Quote calculator API route:** No OpenAI. Google Maps Distance Matrix + pricing formula.

---

## 8. Memory & Context

### 8.1 Chat History
- **Storage:** React component state (`useState<BenjiMessageProps[]>`).
- **Persistence:** None. Closing or refreshing the chat widget loses the entire conversation.
- **Sent to backend:** Full `messages[]` array is serialized and sent with every request. No summarization or trimming. Long conversations → increasing token costs.
- **No database table** for conversation history exists in the schema.

### 8.2 Response Cache
- **Storage:** In-memory `Map` inside `AIResponseCache` class in `ai.config.ts`.
- **Key:** `${service}:${message}` (exact match on last user message).
- **TTL:** `60 * 60 * 1000` ms (1 hour).
- **Persistence:** None. Lost on server restart (Railway redeploy clears it).
- **Scope:** Global across all users (same question from different users returns cached response regardless of their userType or context).

### 8.3 Token Usage Log
- **Storage:** In-memory array in `AIUsageTracker`.
- **Persistence:** None. Capped at 10,000 entries, purged to 5,000 when limit hit.
- **Not persisted to DB.** Cannot reconstruct historical OpenAI costs after restart.

### 8.4 Shipment History (for driver location)
- **Storage:** `shipments` table in Supabase (Postgres).
- **Used by:** Both scoring services query `shipments WHERE driver_id = X AND status = completed ORDER BY updated_at DESC LIMIT 1` to estimate driver's current position.
- **Staleness:** This could be days or weeks old.

### 8.5 NL Shipment Prompts
- **Storage:** `ai_shipment_prompts` table (Supabase).
- **Columns:** `user_id, input_text, input_method, parsed_data (jsonb), confidence_score, created_at`
- **Used for:** Logging only. Not yet used for learning or personalization.

### 8.6 Dispatch Optimizations
- **Storage:** `ai_dispatch_optimizations` table (Supabase). Written by `AIDispatcherService` (old).
- **Not written** by `BenjiDispatcherService` (new, used by frontend).

### 8.7 Document Extraction Queue
- **Storage:** `document_extraction_queue` table (Supabase).
- **Lifecycle:** `queued → processing → completed / failed / pending_review`

### 8.8 Driver Preferences
- **None.** No driver preference or preference-learning system exists.

### 8.9 Summary
Benji has no persistent memory for conversations. The only cross-session state is shipment history used as a position proxy, NL prompt logs (write-only), and document extraction queues. All AI caches are volatile.

---

## 9. Decision-Making Logic

### 9.1 Load Match Scoring (BenjiLoadRecommendationService)

```
score = proximity × 0.35
      + routeFit × 0.25
      + earnings × 0.20
      + timing × 0.10
      + compatibility × 0.10
```

| Factor | Logic |
|---|---|
| **Proximity (35%)** | Distance from estimated driver position to pickup. `< 10mi` → 100; `< 25mi` → 90; `< 50mi` → 75; `< 100mi` → 55; `< 200mi` → 35; else → 20. Driver position = last completed delivery or **Austin TX default** |
| **Route Fit (25%)** | Counts driver's historical deliveries to same state as load's delivery. `> 5` → 100; `> 2` → 75; `> 0` → 50; else → 25 |
| **Earnings (20%)** | Price-per-mile vs market benchmarks. `> $2.50/mi` → 100; `> $2.00` → 80; `> $1.50` → 60; else → 40 |
| **Timing (10%)** | Days until pickup. `≤ 1` → 100 (urgent, driver earns fast); `≤ 3` → 80; `≤ 7` → 60; else → 40 |
| **Compatibility (10%)** | Fixed at 80 (no actual vehicle-type or capacity check implemented) |

Estimated earnings = `load.estimated_price × 0.80`

### 9.2 Dispatcher Scoring (BenjiDispatcherService)

```
score = proximity × 0.40
      + routeFit × 0.25
      + earnings × 0.20
      + experience × 0.10
      + rating × 0.05
```

| Factor | Logic |
|---|---|
| **Proximity (40%)** | Same as above but from last completed delivery. `< 10mi` → 100; `< 50mi` → 80-(dist/5); `< 100mi` → 40; else → 20 |
| **Route Fit (25%)** | Same historical state-match logic |
| **Earnings (20%)** | Same price-per-mile logic |
| **Experience (10%)** | Completed shipment count. `> 100` → 100; `> 50` → 80; `> 20` → 60; else → 40 |
| **Rating (5%)** | `driver.rating × 20` (5-star = 100) |

Confidence = `min(100, score + reasons.length × 5)`

Assignment strategy: Greedy — iterate loads sorted by price desc (older loads tiebreak). For each load find highest-scoring available driver with `confidence > 60`. Mark that driver as assigned for the batch.

### 9.3 Pricing Formula (pricing.service.ts)

```
price = BASE_RATES[vehicleType][band]
      × distanceMiles
      × deliveryTypeMultiplier   (expedited=1.25, standard=1.0, flexible=0.95)
      × surgeMultiplier           (default 1.0, admin-configurable)
      × (1 + fuelAdjustmentPercent)
      × (1 - bulkDiscountPercent)
```

Distance bands: `short` ≤ 500 mi, `mid` ≤ 1500 mi, `long` > 1500 mi.  
Minimum: $150 (standard) or $80 (accident recovery).  
Fuel adjustment: `((currentFuelPrice - 3.70) / 3.70) × 0.3` — 30% of fuel deviation passed to price.

### 9.4 Document Confidence Scoring

```
confidence = filledRequiredFields / totalRequiredFieldsForDocType
```

Thresholds:
- `≥ 0.85` → auto-approved
- `< 0.85` → `requires_review: true` → queued for admin

---

## 10. Pain Points

### Critical

1. **Driver location defaults to Austin, TX.**  
   `profiles` table has no `current_location`, `latitude`, or `longitude` columns. Both scoring services use the last completed delivery as a proxy. A driver who finished a job in Charlotte 3 weeks ago and is now in Miami is scored as if in Charlotte. Completely breaks proximity scoring.

2. **Route planner UI is missing.**  
   `/dashboard/driver/route-planner` renders only a `BenjiChat` widget. The entire `RouteOptimizationService` is unreachable from the frontend. Drivers have no access to route optimization despite it being fully implemented on the backend.

3. **Load acceptance is not implemented.**  
   `BenjiLoadRecommendations.tsx` has an "Accept" button that shows a toast and calls `setTimeout(() => loadRecommendations(), 1000)` with a `// TODO: Implement load acceptance` comment. Pressing it does nothing permanent.

4. **No conversation persistence.**  
   Every page refresh starts a blank chat. No session recovery, no history across pages. For a support or operational assistant this is a severe UX regression.

5. **Two redundant dispatcher services.**  
   `AIDispatcherService.ts` (old, queried from `dispatcher.ts` route, uses fields like `current_lat/current_lng` that don't exist in `profiles`) and `BenjiDispatcherService.ts` (new, used by frontend, better adapted to actual schema). The old one will error if invoked.

### High

6. **In-memory response cache is shared across all users.**  
   A client asking "Where is my shipment?" gets a cached admin answer if the cache key happens to match. Cache ignores `userId`, `userType`, and `context`.

7. **In-memory token tracker loses all data on redeploy.**  
   No way to track daily OpenAI spend across Railway restarts. Cannot enforce budgets or alert on cost overruns.

8. **All feature flags default to `true`.**  
   `FEATURE_FLAGS.NATURAL_LANGUAGE = process.env['ENABLE_NATURAL_LANGUAGE'] === 'true' || true`. The `|| true` override makes env-based control impossible. Can't disable a broken feature without a code deploy.

9. **Full conversation history sent every chat turn.**  
   No summarization. A 20-turn conversation sends ~2,000 tokens of history on every request. Long chat sessions become expensive and will eventually hit the 128k context window limit.

10. **Hard-coded Railway URL in two places.**  
    `aiService.ts` and `BenjiLoadRecommendations.tsx` both hardcode `https://drivedrop-main-production.up.railway.app/api/v1`. `BenjiLoadRecommendations.tsx` does not use `NEXT_PUBLIC_API_URL` env var.

### Medium

11. **Debug auth token logging in production code.**  
    `BenjiLoadRecommendations.tsx` and `aiService.ts` both log auth token previews to `console.log`. Should be removed before v2.

12. **Compatibility score is hardcoded at 80.**  
    No actual vehicle-type or capacity compatibility check. A motorcycle driver can be scored 80 on compatibility for a heavy truck shipment.

13. **Carolina-only intelligence.**  
    Route optimization, traffic delays, fuel prices, and corridor data are hardcoded for NC/SC/VA/GA/TN. Worthless for clients or drivers outside that region.

14. **Document extraction queue is synchronous.**  
    Documents are queued and then immediately processed in the same request. No actual queue worker. The queue table is populated but never drained asynchronously.

15. **NL prompt logs never read back.**  
    `ai_shipment_prompts` is write-only. No learning loop, no prompt analytics, no personalization from history.

---

## 11. Refactor Opportunities

### Duplicated Logic

| Code | Location A | Location B | Note |
|---|---|---|---|
| Dispatcher scoring | `BenjiDispatcherService.ts` | `AIDispatcherService.ts` | Near-identical scoring loops. `AIDispatcherService` uses non-existent `current_lat/lng` fields. |
| Distance calculation | `BenjiDispatcherService.ts::calculateDistance()` | `BenjiLoadRecommendationService.ts::calculateDistance()` | Identical Haversine formula. Copy-pasted. |
| Route fit calculation | `BenjiDispatcherService.ts::calculateRouteFit()` | `BenjiLoadRecommendationService.ts::calculateRouteFit()` | Both query `shipments` table for same-state delivery history. |
| Auth token retrieval | `BenjiLoadRecommendations.tsx` (direct Supabase call) | `aiService.ts::getAuthToken()` | Different patterns to get same token. |
| Railway URL | `aiService.ts` | `BenjiLoadRecommendations.tsx` | Same hardcoded URL. |

### Tight Coupling

- `BenjiChatService` system prompts are monolithic strings embedding Carolina corridor data, fuel tables, and metro traffic zones. Any change to route data requires editing the chat service.
- `RouteOptimizationService` embeds `CAROLINA_CORRIDORS`, `METRO_TRAFFIC_ZONES`, `FUEL_PRICES`, and `FUEL_ECONOMY` as module-level constants. These are configuration data that should live in the DB or a config file.
- `pricing.service.ts` embeds `BASE_RATES` as a hardcoded TypeScript object. Should be admin-configurable and already partially is via `pricingConfigService` — but the static table is not pulled from DB.

### Poor Abstractions

- `aiResponseCache` (global in-memory Map) treats all AI services and users the same. Needs per-service, per-userType, or per-userId namespacing.
- `aiUsageTracker` is an in-memory singleton that resets on restart. Should write to Supabase `ai_usage_logs` table.
- Driver position estimation is scattered (each scoring service reimplements the same DB fallback query + Austin TX default).

### Legacy Code

- `AIDispatcherService.ts` and `backend/src/routes/dispatcher.ts` — superseded by `BenjiDispatcherService` + `ai.routes.ts` dispatcher endpoints. Safe to delete after migration.
- Debug `console.log` lines with token preview strings in production components.
- `TODO: Implement load acceptance` stub in `BenjiLoadRecommendations.tsx`.
- `// Stay on page for testing` comment was already fixed in this session.

---

## 12. Recommended Extraction

Benji v2 should be decomposed into five distinct layers. Boundaries below reflect the actual current capabilities.

```
┌─────────────────────────────────────────────────────┐
│                  Benji API Gateway                   │
│  Route: /api/v1/benji/*                              │
│  Responsibilities:                                    │
│  - Auth (JWT verification)                           │
│  - Rate limiting (per-service, per-user)             │
│  - Request routing to inner services                 │
│  - Response envelope + error normalization           │
│  - Token usage logging to DB                         │
└───────────────┬─────────────────────────────────────┘
                │
    ┌───────────┼────────────────────────┐
    ▼           ▼                        ▼
┌──────────┐ ┌────────────────┐  ┌────────────────────┐
│  Benji   │ │   Benji AI     │  │  Benji Route       │
│  Core    │ │   Service      │  │  Service           │
│  Engine  │ │                │  │                    │
│          │ │ - GPT-4o chat  │  │ - TSP optimizer    │
│ - Pricing│ │ - NL parsing   │  │ - Multi-stop plan  │
│   formula│ │ - Doc OCR      │  │ - Traffic data     │
│ - Load   │ │ - Embeddings   │  │ - Fuel stops       │
│   scoring│ │ - Prompt mgmt  │  │ - FMCSA breaks     │
│ - Dispatch│ │                │  │ - Live Google Maps │
│   matching│ └────────────────┘  └────────────────────┘
│ - Quote  │
│   calc   │         ▼
└──────────┘  ┌─────────────────┐
              │  Benji Memory   │
              │  Layer          │
              │                 │
              │ - Conv history  │ ← NEW: persist to DB
              │ - Driver prefs  │ ← NEW: learn from actions
              │ - Prompt logs   │ ← exists (ai_shipment_prompts)
              │ - Usage metrics │ ← NEW: persist ai_usage_logs
              │ - Response cache│ ← migrate to Redis/Supabase
              └─────────────────┘
```

### Extraction Priorities

| Layer | What to Extract | Minimum Viable Change |
|---|---|---|
| **Benji Core Engine** | Pricing formula, load scoring, dispatcher matching, Haversine | Create `BenjiCoreService.ts` that both `BenjiDispatcherService` and `BenjiLoadRecommendationService` call. Eliminates duplication. |
| **Benji AI Service** | All OpenAI calls + prompt management | Move all `openai.chat.completions.create()` calls into one file. Keep system prompts in `.txt` or DB, not hardcoded strings. |
| **Benji Route Service** | `RouteOptimizationService` + build the frontend UI | Connect `/dashboard/driver/route-planner` to the existing backend service. Move corridor/fuel/traffic data to config or DB. |
| **Benji Memory Layer** | Conversation persistence, driver preferences, usage logging | Add `benji_conversations` table. Write `ai_usage_logs` to DB instead of memory. Namespace the response cache by `userId + service`. |
| **Benji API Gateway** | Rate limiting, auth, routing, cost guardrails | Extract middleware into dedicated gateway layer. Add per-user daily token budget with DB-persisted counters. |

### Immediate Wins (No Architecture Required)

1. Delete `AIDispatcherService.ts` + `dispatcher.ts` route (dead code).
2. Extract `calculateDistance()` and `calculateRouteFit()` into shared `benji-utils.ts`.
3. Fix `BenjiLoadRecommendations.tsx` to use `NEXT_PUBLIC_API_URL` env var.
4. Implement `acceptLoad()` in `BenjiLoadRecommendations.tsx`.
5. Remove debug token logging from both frontend components.
6. Persist `aiUsageTracker` writes to Supabase `ai_usage_logs` table.
7. Fix feature flag `|| true` overrides — change to `false` defaults.
8. Namespace `aiResponseCache` by `userId + service + userType`.
