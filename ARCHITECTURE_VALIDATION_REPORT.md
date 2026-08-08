# Architecture Validation Report — Gate 1
## DriveDrop Pricing Intelligence System — Final Release Validation

**Report Date**: 2026-08-08  
**Scope**: Phase 1–3 Implementation  
**Validation Type**: Evidence-based architectural inspection (no code modified)  
**Status**: GATE 1 FINDINGS — AWAITING REVIEW BEFORE CORRECTION  

---

## 1. Executive Summary

The core Phase 2 architecture is substantially sound. The Decision Layer correctly orchestrates the Pricing Engine through `pricingDecisionService.generateQuote()`. The Policy Provider pattern is correctly implemented. Phase 3 Memory/Recommendation services are correctly isolated with no reverse dependencies into pricing execution.

However, **one production architectural violation** was found that breaks Principle 8 ("Production code must not bypass the Decision Layer"):

> **`backend/src/benji-v3/tools/index.ts` directly calls `pricingService.calculateQuoteWithDynamicConfig()` and `pricingService.calculateQuote()`** — bypassing `pricingDecisionService` entirely.  
> This is a live production path (Benji V3 serves SMS and chat traffic).

Two additional findings require classification before a determination can be made:

1. **`profitMarginPercent = 30`** is hardcoded in the Pricing Engine — question is whether this is an engine constant or a policy value.
2. **Duplicate write path for `was_booked`** — `pricingDecision.service.ts` contains `markQuoteAsBooked()` which is defined but **never called** anywhere in the codebase. Phase 3's feedback endpoint is the only active booking-status write path.

---

## 2. Architecture Tested

### Intended Architecture

```
Pricing Engine (pricing.service.ts)
          ↓ called by
Operational Intelligence (pricing.intelligence.ts)   ← observes, does not call pricing engine
          ↓ consumed by
Decision Layer (pricingDecision.service.ts)          ← sole orchestrator
          ↓ reads from
Policy Provider (pricingPolicy.service.ts)           ← database-backed configuration

Memory / Recommendation Infrastructure (Phase 3)    ← isolated, no upstream imports
```

### Authoritative Entry Point

```
pricingDecisionService.generateQuote()
```

All production pricing requests must pass through this method.

### Files Inspected

| File | Role |
|------|------|
| `backend/src/services/pricing.service.ts` | Pricing Engine |
| `backend/src/services/pricingDecision.service.ts` | Decision Layer |
| `backend/src/services/pricingPolicy.service.ts` | Policy Provider |
| `backend/src/services/pricingConfig.service.ts` | Engine Config Provider |
| `backend/src/benji/intelligence/pricing.intelligence.ts` | Operational Intelligence |
| `backend/src/benji/intelligence/index.ts` | Intelligence module barrel |
| `backend/src/benji/intelligence/pricing-analytics.service.ts` | Phase 3 Analytics |
| `backend/src/benji/intelligence/pricing-performance.service.ts` | Phase 3 Performance |
| `backend/src/benji/intelligence/pricing-feedback.service.ts` | Phase 3 Feedback |
| `backend/src/benji/intelligence/pricing-recommendations.service.ts` | Phase 3 Recommendations |
| `backend/src/routes/intelligence.routes.ts` | Phase 3 API Routes |
| `backend/src/routes/pricing.routes.ts` | Pricing API Routes |
| `backend/src/routes/admin.routes.ts` | Admin Config Routes |
| `backend/src/routes/index.ts` | Route registration |
| `backend/src/benji-v3/tools/index.ts` | Benji V3 Tool Layer |
| `backend/src/benji/tool/pricing-calculate.tool.ts` | Benji V2 Pricing Tool |
| `backend/src/controllers/shipment.controller.ts` | Shipment Controller |
| `backend/src/services/NaturalLanguageShipmentService.ts` | NLP Shipment Service |
| `backend/src/services/VoiceAgentService.ts` | Voice Agent Service |

---

## 3. Checks Performed

| Check | ID | Description |
|-------|-----|-------------|
| A | Production Entry Points | All callers of Decision Layer and Pricing Engine |
| B | Decision Layer | Hardcoded values, Policy Provider usage |
| C | Operational Intelligence | Import isolation, mutation absence |
| D | Policy Provider | Storage, retrieval, data vs. code |
| E | Phase 3 Memory/Recommendations | Infrastructure isolation |
| F | Dependency Direction | Unidirectional graph verification |
| G | Data Write Safety | Write classification |
| H | Architectural Bypasses | Broad bypass search |
| I | Phase 2/3 Boundary | Cross-contamination check |
| J | Documentation Consistency | Implementation vs. specification |

---

## 4. Evidence / File References

### Check A — Production Entry Points

**Every caller of `pricingDecisionService.generateQuote()`:**

| Caller | File | Line | Intent |
|--------|------|------|--------|
| HTTP /calculate endpoint | `routes/pricing.routes.ts` | 29 | Public quote API |
| HTTP /quote endpoint | `routes/pricing.routes.ts` | 75 | Authenticated quote API |
| Shipment creation | `controllers/shipment.controller.ts` | 159 | Admin shipment create |
| Benji V2 pricing tool | `benji/tool/pricing-calculate.tool.ts` | 88 | V2 chatbot quotes |
| NLP Shipment Service | `services/NaturalLanguageShipmentService.ts` | 438 | NLP quote generation |
| Voice Agent | `services/VoiceAgentService.ts` | 765 | Vapi voice quotes |

**Direct callers of `pricingService` (bypassing Decision Layer):**

| Caller | File | Line | Legitimacy |
|--------|------|------|------------|
| Benji V3 Tool Layer | `benji-v3/tools/index.ts` | 22, 766, 777 | ❌ VIOLATION |
| Decision Layer internal | `services/pricingDecision.service.ts` | 27, 175, 274 | ✅ Authorized internal use |

**Type-only imports of `pricing.service` (no runtime dependency):**

| Importer | File | Import | Legitimacy |
|----------|------|--------|------------|
| Operational Intelligence | `benji/intelligence/pricing.intelligence.ts` | `import type { VehicleType }` | ✅ Type only, no runtime call |
| Benji V2 pricing tool | `benji/tool/pricing-calculate.tool.ts` | `import type { VehicleType }` | ✅ Type only |
| Step input resolver | `benji/orchestrator/step-input.resolver.ts` | `import type { VehicleType }` | ✅ Type only |
| NLP Service | `services/NaturalLanguageShipmentService.ts` | `import { VehicleType }` | ✅ Used as type only |
| Pricing routes | `routes/pricing.routes.ts` | `import { VehicleType }` | ✅ Used as type only |

Note: TypeScript enum/type imports from `pricing.service` are not runtime dependencies on the Pricing Engine execution path and do not create architectural violations.

---

### Check B — Decision Layer

**Policy Provider usage:**  
- `pricingDecisionService.ts` line 30: imports `pricingPolicyService` from `pricingPolicy.service`
- `pricingDecisionService.ts` line 374: calls `pricingPolicyService.getActivePolicies()` before applying adjustments
- All five business policy adjustments in `applyBusinessPolicies()` use values from `policies.*` (e.g., `policies.historicalAlignmentWeight`, `policies.demandPremiumPercent`, `policies.maxPriceAdjustmentPercent`)
- No hardcoded threshold values were found in `pricingDecision.service.ts` for business policy application

**Hardcoded values in the Pricing Engine (`pricing.service.ts`):**

```typescript
// Line 186 and Line 343 (both calculateQuoteWithDynamicConfig and calculateQuote)
const profitMarginPercent = 30;

// Lines 64–70
const COST_COMPONENT_DEFAULTS = {
  fuel: 0.525,
  driver: 0.625,
  insurance: 0.15,
  maintenance: 0.275,
  tolls: 0.10,
};

// Line 62–75: BASE_RATES table
const BASE_RATES: Record<VehicleType, ...> = {
  sedan: { short: 1.80, mid: 0.95, long: 0.60, accident: 2.50 },
  ...
};
```

Comment at line 343: `// Profit margin – choose 30% midpoint of 25–35 range; could be dynamic later`

These values are hardcoded inside the Pricing Engine, not in the database configuration. Whether they constitute engine constants or policy values is a classification question — see Violations section.

---

### Check C — Operational Intelligence

**Imports in `pricing.intelligence.ts`:**
```
import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';
import type { VehicleType } from '@services/pricing.service';   // type only
```

- No import of `pricingDecisionService`
- No import of `pricingPolicyService`
- No import of `pricingConfigService`
- No call to `calculateQuote()` or `calculateQuoteWithDynamicConfig()`
- Writes to database: reads from `quote_history`, reads from `shipments`. Zero writes.
- Does not mutate pricing policies or config

---

### Check D — Policy Provider

**Storage**: Policies stored in `pricing_config` table (PostgreSQL / Supabase)

**Retrieval flow:**
```
pricingPolicyService.getActivePolicies()
  → SELECT intelligence_min_confidence, historical_alignment_weight, ...
    FROM pricing_config WHERE is_active = true
  → Transform to PricingPolicies interface
  → Cache for 5 minutes
  → Return to Decision Layer
```

**Fallback**: `getDefaultPolicies()` provides safe hardcoded defaults if database is unavailable. Default values are:
- `historicalAlignmentWeight: 0.3`
- `maxPriceAdjustmentPercent: 20`
- `demandPremiumPercent: 5`

These fallback defaults match the specification from Phase 2 documentation.

**Policy change without code changes**: Yes — admin routes at `PUT /api/v1/admin/pricing/config/:id` call `pricingConfigService.updateConfig()`. Policy values are data.

**Note — Two Config Services**: There is an intentional split:
- `pricingConfig.service.ts` — manages Pricing Engine configuration (fuel prices, surge, min quotes, delivery multipliers, etc.)
- `pricingPolicy.service.ts` — manages Decision Layer intelligence policy (confidence thresholds, adjustment weights, etc.)

Both read from the `pricing_config` table but different columns. This split is architecturally sound but not documented explicitly.

---

### Check E — Phase 3 Memory / Recommendation Infrastructure

**Imports in each Phase 3 service:**

| Service | Imports |
|---------|---------|
| `pricing-analytics.service.ts` | `supabaseAdmin`, `logger` |
| `pricing-performance.service.ts` | `supabaseAdmin`, `logger` |
| `pricing-feedback.service.ts` | `supabaseAdmin`, `logger`, `PerformanceMetrics` (type from performance service) |
| `pricing-recommendations.service.ts` | `logger`, `pricingPerformanceService` (Phase 3 only) |

Zero imports of: `pricingService`, `pricingDecisionService`, `pricingPolicyService`, `pricingConfigService`, `pricing.intelligence`.

**Phase 3 write operations classified:**

| Service | Table Written | Operation | Authorization |
|---------|--------------|-----------|---------------|
| `pricing-analytics.service.ts` | `route_analytics` | UPSERT (aggregate cache) | ✅ Infrastructure write |
| `pricing-feedback.service.ts` | `quote_history` | UPDATE `was_booked` | ⚠️ DUPLICATE PATH — see Finding 3 |
| `pricing-feedback.service.ts` | `pricing_events` | INSERT (event log) | ✅ Infrastructure write |
| `pricing-feedback.service.ts` | `pricing_performance_snapshots` | INSERT (snapshot) | ✅ Infrastructure write |
| `pricing-recommendations.service.ts` | None | None | ✅ Output only |

**Recommendation output verified:**
- `generateRecommendations()` returns `PolicyRecommendation[]`
- No database writes in `pricing-recommendations.service.ts`
- No `pricing_config` updates anywhere in Phase 3 services

**GET endpoints (read-only):**
- `/performance` — calls `pricingPerformanceService.getPerformanceMetrics()` — READ only ✅
- `/performance/by-route` — calls `pricingPerformanceService.getPerformanceByRoute()` — READ only ✅
- `/analytics/route/:routeKey` — calls `pricingAnalyticsService.getRouteAnalytics()` — READ only ✅
- `/recommendations` — calls `pricingRecommendationsService.generateRecommendations()` — READ only, no writes ✅
- `/health` — returns static response ✅

**POST endpoints (write-only feedback):**
- `/feedback/quote-outcome` — updates `quote_history.was_booked`, inserts to `pricing_events` ✅
- `/feedback/shipment-outcome` — inserts to `pricing_events` ✅
- `/feedback/intelligence-fallback` — inserts to `pricing_events` ✅

---

### Check F — Dependency Direction

**Verified dependency graph:**

```
pricingConfig.service.ts
        ↑ read by
pricing.service.ts (Pricing Engine)
        ↑ called by
pricingDecision.service.ts (Decision Layer)

pricingPolicy.service.ts
        ↑ read by
pricingDecision.service.ts (Decision Layer)

pricing.intelligence.ts (Operational Intelligence)
        ↑ consumed by
pricingDecision.service.ts (Decision Layer)

Phase 3 Services (pricing-analytics, pricing-performance, pricing-feedback)
        ↓ read from (quote_history, etc.) but do NOT call pricing layers

pricing-recommendations.service.ts
        ↑ reads from
pricing-performance.service.ts (Phase 3 only)
        → does NOT call pricing layers
```

**Reverse dependency check (upstream layers calling downstream layers):**
- `pricing.service.ts` imports: only `@utils/logger` and `./pricingConfig.service` — ✅ No downstream imports
- `pricing.intelligence.ts` imports: `supabaseAdmin`, `logger`, `type VehicleType` — ✅ No downstream imports
- `pricingPolicy.service.ts` imports: `supabaseAdmin`, `logger` — ✅ No downstream imports
- `pricingDecision.service.ts` imports: Pricing Engine (upstream), Intelligence (upstream), PolicyService (upstream) — ✅ No Phase 3 imports

**Circular dependencies found:** None

---

### Check G — Data Write Safety

**`quote_history` writes:**

| Writer | Method | Purpose | Status |
|--------|--------|---------|--------|
| `pricingDecision.service.ts` | `persistToQuoteHistory()` | Initial quote persistence (`was_booked: false`) | ✅ Intentional, owned by Decision Layer |
| `pricingDecision.service.ts` | `markQuoteAsBooked()` | Update booking status | ⚠️ **DEFINED BUT NEVER CALLED** |
| `pricing-feedback.service.ts` | `recordQuoteOutcome()` | Update `was_booked` via Phase 3 API | ⚠️ **Duplicate path — Phase 3 owns a write that Decision Layer defined** |

**`pricing_events` writes:**

| Writer | Method | Status |
|--------|--------|--------|
| `pricing-event.service.ts` | `logEvent()` | ✅ Phase 2 event sourcing |
| `pricing-feedback.service.ts` | Multiple `insert()` calls | ✅ Phase 3 event log |

Two services write to `pricing_events`. This is not a duplication problem — they write different event types with different `source_service` fields and different `event_type` values. Each insert is unique.

**`route_analytics` writes:**
- Only `pricing-analytics.service.ts` writes to `route_analytics` — ✅ No duplication

**`pricing_performance_snapshots` writes:**
- Only `pricing-feedback.service.ts` writes to `pricing_performance_snapshots` — ✅ No duplication

**`pricing_config` writes:**
- Only `pricingConfigService.updateConfig()` / `createConfig()` / `setActiveConfig()` write to `pricing_config` — all called exclusively from admin routes requiring admin authentication — ✅ No unauthorized writes

---

### Check H — Architectural Bypasses

**Search 1: `pricingService` (runtime object)**  
Result: 1 match — `benji-v3/tools/index.ts` line 22 — **VIOLATION**

**Search 2: `calculateQuoteWithDynamicConfig` (direct engine call)**  
Results: 3 matches — `pricing.service.ts` (definition), `pricingDecision.service.ts` (authorized), `benji-v3/tools/index.ts` line 766 — **VIOLATION**

**Search 3: `calculateQuote` (direct engine call)**  
Results: 2 matches — `pricing.service.ts` (definition), `benji-v3/tools/index.ts` line 777 (fallback) — **VIOLATION**

**Search 4: `generateQuote`**  
6 production callers — all correctly call `pricingDecisionService.generateQuote()` — ✅

**Search 5: `pricing_config` updates**  
Only from admin routes — ✅

**Search 6: `pricingDecisionService` in Phase 3 services**  
0 matches — ✅

**Search 7: `pricingAnalyticsService|pricingPerformanceService` in pricing layers**  
0 matches — Phase 3 is not called by pricing layers — ✅

**Search 8: `pricingPolicyService` outside Decision Layer**  
0 matches — Policy Provider is only consumed by the Decision Layer — ✅

---

### Check I — Phase 2 / Phase 3 Boundary

**Did Phase 3 modify Phase 2 services?**

Verified via import search:
- `pricingDecision.service.ts` — imports unchanged from Phase 2; no Phase 3 imports
- `pricing.intelligence.ts` — imports unchanged; no Phase 3 imports
- `pricing.service.ts` — imports unchanged; no Phase 3 imports
- `pricingPolicy.service.ts` — imports unchanged; no Phase 3 imports

Phase 3 services (`pricing-analytics.service.ts`, `pricing-performance.service.ts`, `pricing-feedback.service.ts`, `pricing-recommendations.service.ts`) were **additive only** — no modifications to Phase 2 files.

The only Phase 2 file modified by Phase 3 was `routes/index.ts` (adding the intelligence route registration). This is the correct and expected integration point.

**Phase 3 services are NOT exported from the Phase 2 intelligence barrel (`@benji/intelligence`)**. They are imported directly via their file paths from `intelligence.routes.ts`. This is architecturally appropriate — it maintains separation between the Phase 2 intelligence module and Phase 3 memory infrastructure.

---

### Check J — Documentation Consistency

**Files referenced in validation prompt that EXIST:**

| File | Status |
|------|--------|
| `PHASE_2_INTEGRATION_GUIDE.md` | ✅ Exists |
| `PHASE_2_READY_FOR_REVIEW.md` | File search pending — referenced in other docs |
| `PHASE_3_IMPLEMENTATION_PLAN.md` | ✅ Exists |
| `PHASE_3_AUDIT_REPORT.md` | ✅ Exists |

**Files referenced in validation prompt that DO NOT EXIST:**

| File | Status |
|------|--------|
| `PRICING_ARCHITECTURE_REVIEW.md` | ❌ NOT FOUND |
| `PHASE_2_IMPLEMENTATION_SUMMARY.md` | ❌ NOT FOUND (referenced in other docs but absent) |

**Implementation vs. documentation consistency:**

`PHASE_3_AUDIT_REPORT.md` states Phase 3 passed all 8 checks. That audit was conducted by the same agent that implemented Phase 3 in the same session. It should be treated as an internal self-assessment, not an independent audit. The findings in this report supersede those in `PHASE_3_AUDIT_REPORT.md` for the purposes of Gate 1.

---

## 5. Pass / Fail / Inconclusive for Every Check

| Check | Result | Reason |
|-------|--------|--------|
| A — Production Entry Points | **FAIL** | `benji-v3/tools/index.ts` bypasses Decision Layer |
| B — Decision Layer | **INCONCLUSIVE** | Policy values correctly fetched from Policy Provider. Engine hardcodes (`profitMarginPercent`, `BASE_RATES`, `COST_COMPONENT_DEFAULTS`) require classification — engine constants vs. business policy |
| C — Operational Intelligence | **PASS** | No imports of pricing layers; no mutations; no reverse dependencies |
| D — Policy Provider | **PASS** | Policies are database-backed; Decision Layer consumes policy service; changes require no code modification |
| E — Phase 3 Memory/Recommendations | **PASS** | Infrastructure-only; no pricing engine calls; no Decision Layer calls; recommendations are output-only; GET routes are read-only; `pricing_config` is not mutated |
| F — Dependency Direction | **PASS** | Unidirectional dependency graph confirmed; no circular dependencies |
| G — Data Write Safety | **INCONCLUSIVE** | `markQuoteAsBooked()` is defined in Decision Layer but never called; `pricingFeedbackService.recordQuoteOutcome()` is the only active booking-status write path. The ownership of this write is ambiguous |
| H — Architectural Bypasses | **FAIL** | `benji-v3` uses direct engine access |
| I — Phase 2/3 Boundary | **PASS** | Phase 3 made no modifications to Phase 2 services |
| J — Documentation Consistency | **INCONCLUSIVE** | Two referenced documents (`PRICING_ARCHITECTURE_REVIEW.md`, `PHASE_2_IMPLEMENTATION_SUMMARY.md`) do not exist; self-audit (`PHASE_3_AUDIT_REPORT.md`) predates this independent audit |

---

## 6. Violations Found

### VIOLATION 1 — CRITICAL: Benji V3 Bypasses Decision Layer

**Severity**: CRITICAL (blocks production architecture principle)  
**File**: `backend/src/benji-v3/tools/index.ts`  
**Lines**: 22, 766, 777

**Evidence**:
```typescript
// Line 22
import { pricingService } from '../../services/pricing.service';

// Lines 766-777 (inside get_shipping_quote handler)
const quoteResult = await pricingService.calculateQuoteWithDynamicConfig({
  vehicleType:  vType,
  distanceMiles,
  pickupDate,
  deliveryDate,
});

// Fallback:
const fallback = pricingService.calculateQuote({ vehicleType: vType, distanceMiles });
```

**Defect Type**: Implementation defect  
**Architectural Principle Violated**: Principle 8 — "Production code must not bypass the Decision Layer"

**Impact**:
- Benji V3 price quotes skip intelligence analysis (acceptable if desired)
- Benji V3 price quotes skip Decision Layer policy application (not acceptable — prices may differ from intended policy)
- Benji V3 price quotes skip quote logging to `quote_history` (no audit trail for V3 quotes)
- Benji V3 price quotes skip event sourcing to `pricing_events`
- Benji V3 is served via SMS webhook (`sms-webhook.controller.ts`) — this is a live production path, not a development artifact

**Scope of impact**: Every pricing quote served by Benji V3 (SMS/chat traffic) is priced by the raw Pricing Engine without policy application.

**Note on Benji V2 vs. V3**: Benji V2's pricing tool (`benji/tool/pricing-calculate.tool.ts`) correctly routes through `pricingDecisionService.generateQuote()`. Only V3 is affected.

---

### VIOLATION 2 — LOW/INCONCLUSIVE: Hardcoded Engine Constants Containing Policy-Ambiguous Values

**Severity**: LOW (non-blocking pending classification)  
**File**: `backend/src/services/pricing.service.ts`  
**Lines**: 62–75 (`BASE_RATES`, `COST_COMPONENT_DEFAULTS`), 186, 343 (`profitMarginPercent = 30`)

**Evidence**:
```typescript
const COST_COMPONENT_DEFAULTS = {
  fuel: 0.525,
  driver: 0.625,
  insurance: 0.15,
  maintenance: 0.275,
  tolls: 0.10,
};

// ...
const profitMarginPercent = 30; // "could be dynamic later"
```

**Classification question**: Are these engine constants (expected to be hardcoded per architecture) or business policy values (should be in `pricing_config`)?

- `BASE_RATES` table: Reasonable to classify as engine constants — they define the pricing model itself.
- `COST_COMPONENT_DEFAULTS`: Cost midpoints. The `fuel` value is effectively ignored when `dynamicFuelCostPerMile` is provided. "Midpoints of provided ranges" — suggests these were derived from operational data, not pure technical constants. **Potentially a policy value.**
- `profitMarginPercent = 30`: The comment explicitly says "could be dynamic later". This is a business decision. **Likely a policy value that should be in `pricing_config`.**

The architecture specification states: "Policy values are data/configuration, not hardcoded implementation policy."

**Defect Type**: Specification ambiguity — requires explicit architectural decision on what constitutes a "policy value" vs. an "engine constant."

---

## 7. False Positives / Test Issues

### False Positive 1: `import type { VehicleType }` in multiple files

Several files import `VehicleType` from `pricing.service`. These are TypeScript compile-time type imports (`import type`) or used solely as type annotations. They create no runtime dependency on the Pricing Engine and are not architectural violations.

### False Positive 2: `pricing.intelligence.ts` reads `quote_history`

The Intelligence Layer reads `quote_history` to build observations. This is read-only database access and does not constitute a call to the Pricing Engine or Decision Layer. It is architecturally correct.

### False Positive 3: Phase 3 services export their singletons but not through the intelligence barrel

`pricingAnalyticsService` etc. are not exported from `@benji/intelligence/index.ts`. This is not a defect — it correctly keeps Phase 3 memory infrastructure separate from Phase 2 intelligence. The intelligence routes import them directly by file path.

### False Positive 4: `pricingConfigService` is used by `pricing.service.ts`

The Pricing Engine reads engine configuration (fuel prices, multipliers, band thresholds) from `pricingConfigService`. This is intentional and architecturally correct — engine parameters come from configurable data, not hardcode. This is distinct from intelligence policies (managed by `pricingPolicyService`).

---

## 8. Risks

### RISK 1 — HIGH: V3 Price Divergence

Because Benji V3 calls the Pricing Engine directly, any policy configured in `pricingPolicy` (confidence thresholds, demand premiums, loyalty discounts, conversion boosts, momentum premiums) is **never applied** to V3 quotes. V3 quotes and V2/API quotes may produce structurally different prices for the same input when policies are active.

### RISK 2 — MEDIUM: V3 Quote Audit Gap

V3 quotes skip `logToHistory: true` and `persistToQuoteHistory()`. There is no record of V3-originated quotes in `quote_history` or `pricing_events`. This means V3 traffic is invisible to:
- Route analytics aggregation (Phase 3 analytics)
- Performance tracking (Phase 3 performance)
- Conversion tracking
- Any future audit

### RISK 3 — MEDIUM: Orphaned Write Method

`pricingDecisionService.markQuoteAsBooked()` is defined but never called. The Phase 3 feedback API (`POST /intelligence/feedback/quote-outcome`) is the only active mechanism to update `was_booked`. This means:
- The intended Phase 2 booking callback is dead code
- If booking status needs to be updated at shipment creation time, there is no automatic mechanism in Phase 2 to do it — it depends on the caller explicitly hitting the Phase 3 feedback endpoint, which is not wired to the shipment creation flow

### RISK 4 — LOW: Policy Defaults Are Code

The fallback defaults in `pricingPolicy.service.ts` (`getDefaultPolicies()`) are hardcoded in TypeScript. If the database is unavailable, the system uses these defaults. Changing the defaults requires a code deploy. This is a known and acceptable tradeoff (documented in Phase 2) but is worth noting.

### RISK 5 — LOW: Missing Documentation

`PRICING_ARCHITECTURE_REVIEW.md` and `PHASE_2_IMPLEMENTATION_SUMMARY.md` are referenced by other documents but do not exist. If future engineers reference these links, they will find broken references. This is a documentation gap, not an architectural defect.

### RISK 6 — LOW: Two Config Services, One Table

`pricingConfig.service.ts` and `pricingPolicy.service.ts` both read from the `pricing_config` table but select different columns. This coupling is not documented explicitly. A schema change to `pricing_config` could affect both services. Low risk given current state, but worth documenting.

---

## 9. Required Corrections

### Correction 1 — REQUIRED BEFORE RELEASE: Fix Benji V3 Decision Layer Bypass

**Finding**: VIOLATION 1  
**File**: `backend/src/benji-v3/tools/index.ts`  
**Action required**: Replace the direct `pricingService.calculateQuoteWithDynamicConfig()` and `pricingService.calculateQuote()` calls with `pricingDecisionService.generateQuote()`.

**Suggested correction approach** (do not implement until approved):
```typescript
// Replace:
import { pricingService } from '../../services/pricing.service';

// With:
import { pricingDecisionService } from '../../services/pricingDecision.service';

// Replace call at line 766:
const quoteResult = await pricingDecisionService.generateQuote({
  vehicleType: vType,
  distanceMiles,
  pickupDate,
  deliveryDate,
  enableIntelligence: false,
  logToHistory: true,
  requestSource: 'benji',
  routeOrigin: origin,
  routeDestination: dest,
});
// Use quoteResult.total, quoteResult.breakdown.deliveryType, etc.
```

The fallback at line 777 becomes unnecessary — `pricingDecisionService.generateQuote()` already contains its own fallback to `calculateQuoteWithDynamicConfig()` on error.

### Correction 2 — REQUIRES ARCHITECTURAL DECISION: Clarify `profitMarginPercent` Status

**Finding**: VIOLATION 2  
**Decision needed**: Is `profitMarginPercent = 30` an engine constant or a business policy?

**Option A (engine constant)**: Document explicitly that `profitMarginPercent` is a fixed engine parameter, not an adjustable policy. No code change required.

**Option B (business policy)**: Add `profit_margin_percent` to `pricing_config` table and read it in `calculateQuoteWithDynamicConfig()`. Similar treatment to existing config values.

This decision must be made explicitly before the gate can be closed.

### Correction 3 — REQUIRES ARCHITECTURAL DECISION: Clarify `was_booked` Write Ownership

**Finding**: G — Data Write Safety  
**Decision needed**: Who owns the booking status update for `quote_history`?

**Current state**:
- `pricingDecision.service.ts` defines `markQuoteAsBooked()` — never called
- `pricingFeedbackService.recordQuoteOutcome()` — active via Phase 3 API

**Option A**: The Phase 2 method (`markQuoteAsBooked`) is the intended path. It should be called from the shipment creation flow. Phase 3's `recordQuoteOutcome` for bookings may then be redundant for the booking status field (though it would still log the event).

**Option B**: The Phase 3 feedback endpoint IS the intended booking status write path. The Phase 2 method (`markQuoteAsBooked`) is dead code and should be removed or clearly deprecated.

This must be decided and documented before the gate can be closed.

---

## 10. Non-blocking Improvements

### Improvement 1: Add `PRICING_ARCHITECTURE_REVIEW.md`

Create the referenced-but-absent architecture document. This is a documentation gap, not a code defect.

### Improvement 2: Export Phase 3 Services from a Phase 3 Barrel

Consider creating `backend/src/benji/memory/index.ts` to barrel-export Phase 3 services. Currently they are imported by file path. Not required for release.

### Improvement 3: Document Two-Config-Service Pattern

Add inline documentation explaining why `pricingConfig.service.ts` and `pricingPolicy.service.ts` both read from `pricing_config` but serve different consumers.

### Improvement 4: Validate `pricing_config` Has Policy Columns

There is no startup validation that the active `pricing_config` row contains the intelligence policy columns (`intelligence_min_confidence`, etc.) that `pricingPolicy.service.ts` selects. If these columns are null, the transform will produce zero values. Safe defaults handle this gracefully, but an explicit health-check query would make the dependency explicit.

---

## 11. Final Verdict

**GATE 1 VERDICT: NO-GO**

**Reason**: Violation 1 (Benji V3 Decision Layer bypass) is a confirmed production architectural violation that directly contradicts Principle 8. It is present in a live production code path (SMS/chat traffic via `sms-webhook.controller.ts`).

**Conditions for GO:**

| Condition | Status |
|-----------|--------|
| Correction 1 (Benji V3 bypass) implemented and verified | ❌ Required |
| Correction 2 (`profitMarginPercent` classification) decided | ❌ Decision required |
| Correction 3 (`was_booked` write ownership) decided | ❌ Decision required |
| Phase 3 services confirmed infrastructure-only | ✅ Confirmed |
| Decision Layer correctly uses Policy Provider | ✅ Confirmed |
| No circular dependencies | ✅ Confirmed |
| No `pricing_config` mutations from recommendation logic | ✅ Confirmed |

**Passed Checks**: C, D, E, F, I  
**Failed Checks**: A, H  
**Inconclusive Checks**: B, G, J  

---

**Do not proceed to Gate 2 (Functional Testing) until:**
1. The three corrections/decisions above are reviewed and approved
2. Correction 1 is implemented and the build verified
3. This report is acknowledged as the canonical Gate 1 finding

---

*Report generated by architectural inspection on 2026-08-08. No production code was modified during this report's production.*
