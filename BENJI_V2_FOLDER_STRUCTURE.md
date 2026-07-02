# Benji V2 — Folder Structure & Migration Plan
*Derived directly from codebase inspection — 2026-07-01*
*Priority: Minimal breakage, incremental migration, zero greenfield invention*

---

## 0. What Inspection Found

Before any folder was designed, the following was confirmed by reading every file:

### Confirmed Duplicate Code (same logic in two places)
| Function | File 1 | File 2 | Decision |
|---|---|---|---|
| `calculateDistance()` (haversine) | `BenjiDispatcherService.ts` L406–430 | `BenjiLoadRecommendationService.ts` L565–590 | **Extract once** → `benji/core/math/geo.ts` |
| `calculateRouteFit()` | `BenjiDispatcherService.ts` L295–330 | `BenjiLoadRecommendationService.ts` L368–400 | **Extract once** → `benji/core/math/geo.ts` |
| `areCitiesNear()` | `BenjiDispatcherService.ts` L435–445 | `BenjiLoadRecommendationService.ts` L595–600 | **Extract once** → `benji/core/math/geo.ts` |
| `toRad()` | `BenjiDispatcherService.ts` L433 | `BenjiLoadRecommendationService.ts` L588 | **Extract once** → `benji/core/math/geo.ts` |

### Confirmed Duplicate OpenAI Client Instantiation
Each service creates its own client. Three separate instances in production:
```typescript
// BenjiChatService.ts line 1
const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });
// NaturalLanguageShipmentService.ts line 31
const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] || '' });
// AIDocumentExtractionService.ts line 29
const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] || '' });
```
**Fix:** One shared client → `benji/ai/openai.client.ts`

### Confirmed Wrong Supabase Usage
Two services bypass the shared `@lib/supabase` client:
```typescript
// NaturalLanguageShipmentService.ts line 28
const supabase = createClient(process.env['SUPABASE_URL'] || '', process.env['SUPABASE_SERVICE_ROLE_KEY'] || '');
// AIDocumentExtractionService.ts line 26
const supabase = createClient(process.env['SUPABASE_URL'] || '', process.env['SUPABASE_SERVICE_ROLE_KEY'] || '');
```
BenjiDispatcherService and BenjiLoadRecommendationService use `import { supabase } from '../lib/supabase'` — correct pattern.

### Confirmed Dead Code
- `backend/src/services/AIDispatcherService.ts` — only referenced by `routes/dispatcher.ts`
- `backend/src/routes/dispatcher.ts` — imports `AIDispatcherService`, not `BenjiDispatcherService`
- Neither is referenced in production traffic paths. Safe to delete in Phase 1.

### Confirmed Feature Flag Bug
`backend/src/config/features.ts` — all 10 flags use `|| true` override:
```typescript
AI_DISPATCHER: process.env['ENABLE_AI_DISPATCHER'] === 'true' || true, // always true
```

### Confirmed Scoring Weights Are Hardcoded and Diverged
| Service | Proximity | RouteFit | Earnings | Other |
|---|---|---|---|---|
| `BenjiDispatcherService` | 0.40 | 0.25 | 0.20 | experience 0.10, rating 0.05 |
| `BenjiLoadRecommendationService` | 0.35 | 0.30 | 0.25 | timing 0.05, compat 0.05 |
**Fix:** Extract to `benji/core/constants/scoring.ts` + read from `benji_config` table.

### Confirmed Path Aliases Available
From `backend/tsconfig.json`:
```json
"@config": ["config/index.ts"],
"@lib/*": ["lib/*"],
"@middlewares/*": ["middlewares/*"],
"@services/*": ["services/*"],
"@utils/*": ["utils/*"]
```
**Missing:** No `@benji` alias yet — must add to both `tsconfig.json` and `register-paths.ts`.

---

## 1. Target Folder Tree

```
backend/src/benji/
│
├── core/                                ← Pure logic — no DB, no HTTP, no OpenAI
│   ├── types/
│   │   ├── benji.types.ts               ← Orchestrator contracts (OrchestratorRequest/Response, BenjiIntent, etc.)
│   │   ├── dispatch.types.ts            ← DriverLoadMatch, DispatchAnalysis, ScoredLoad
│   │   ├── shipment.types.ts            ← NLShipmentInput, ParsedShipmentData, NLParseResult
│   │   ├── route.types.ts               ← RouteStop, OptimizedRoute, RouteSummary (mirrors RouteOptimizationService exports)
│   │   ├── document.types.ts            ← DocumentUpload, ExtractedData, ExtractionResult
│   │   └── index.ts                     ← Re-exports all types
│   ├── constants/
│   │   ├── scoring.ts                   ← DISPATCH_WEIGHTS, RECOMMENDATION_WEIGHTS (extracted from both services)
│   │   ├── models.ts                    ← AI_MODELS, SERVICE_MODEL_MAP (mirrors ai.config.ts — source of truth stays there)
│   │   └── corridors.ts                 ← Carolina I-85/I-77/I-40/I-26/I-95 corridor data (extracted from RouteOptimizationService)
│   └── math/
│       └── geo.ts                       ← haversineDistance(), toRad(), areCitiesNear(), calculateRouteFit()
│
├── orchestration/                       ← Runtime engine
│   ├── BenjiOrchestrator.ts             ← NEW — single entry point, invokes all layers
│   ├── BenjiPlanner.ts                  ← NEW — plan templates + LLM generation + fallback
│   ├── ToolGraphExecutor.ts             ← NEW — Kahn's topological sort, wave Promise.all()
│   ├── SimulationEngine.ts              ← NEW — dry-run risk scoring before execution
│   ├── BenjiStateMachine.ts             ← NEW — 11 states, allowed transitions
│   └── GlobalPolicyGuard.ts             ← NEW — 10 immutable policy rules at 4 checkpoints
│
├── memory/                              ← All persistent AI state
│   ├── BenjiMemoryService.ts            ← NEW — CRUD on benji_memory table
│   ├── BenjiConversationService.ts      ← NEW — benji_conversations (90-day retention, auto-summarize)
│   ├── BenjiTraceService.ts             ← NEW — BenjiTraceBuilder, finalize() → benji_traces
│   ├── BenjiPreferenceService.ts        ← NEW — benji_preferences (structured prefs per user)
│   └── MemoryInfluenceEngine.ts         ← NEW — 6 behavioral signal processors (300ms timeout)
│
├── tools/                               ← Adapters wrapping existing services — no rewrites
│   ├── dispatch/
│   │   ├── dispatch.tool.ts             ← Wraps BenjiDispatcherService.analyzeDispatchOpportunities() + autoAssignLoads()
│   │   ├── dispatch-accept.tool.ts      ← NEW implementation of tool:dispatch.accept (was TODO)
│   │   └── recommendations.tool.ts     ← Wraps BenjiLoadRecommendationService.getRecommendations()
│   ├── shipment/
│   │   ├── shipment-parse.tool.ts       ← Wraps NaturalLanguageShipmentService.parseShipment()
│   │   ├── shipment-create.tool.ts      ← Wraps NaturalLanguageShipmentService.createShipment()
│   │   └── shipment-lookup.tool.ts      ← Direct Supabase SELECT (uses @lib/supabase)
│   ├── route/
│   │   └── route-optimize.tool.ts       ← Wraps RouteOptimizationService.optimizeRoute()
│   ├── pricing/
│   │   └── pricing.tool.ts              ← Wraps pricing.service.ts calculateQuote()
│   ├── document/
│   │   └── document-extract.tool.ts     ← Wraps AIDocumentExtractionService.processDocument()
│   ├── sms/
│   │   └── sms.tool.ts                  ← Wraps twilio.service.ts sendSMS() + templates
│   ├── chat/
│   │   └── chat.tool.ts                 ← Wraps BenjiChatService.chat()
│   └── registry.ts                      ← ToolRegistry — maps tool name strings → handler functions
│
├── ai/                                  ← All OpenAI interactions
│   ├── openai.client.ts                 ← Single shared OpenAI client (replaces 3 private instances)
│   ├── prompt-registry.ts               ← Loads/caches prompt .txt files from benji/ai/prompts/
│   ├── intent-classifier.ts             ← Keyword-first intent detection, GPT-4o-mini fallback
│   ├── output-parser.ts                 ← Structured JSON extraction from LLM completions
│   ├── usage-tracker.ts                 ← Per-user token tracking → ai_usage_logs table (replaces aiUsageTracker in-memory)
│   ├── response-cache.ts                ← Namespaced cache: key = `${service}:${userType}:${userId}:${hash}` (fixes shared bug)
│   ├── eval/
│   │   ├── evaluation.service.ts        ← Run evals against agent_evaluations table
│   │   └── eval.prompts.ts              ← evaluation.judge.v1 prompt template
│   └── prompts/
│       ├── chat.client.v1.txt
│       ├── chat.driver.v1.txt
│       ├── chat.admin.v1.txt
│       ├── chat.broker.v1.txt
│       ├── intent.classifier.v1.txt
│       ├── shipment.extraction.v1.txt
│       ├── dispatch.reasoning.v1.txt
│       ├── planner.generate.v1.txt
│       └── evaluation.judge.v1.txt
│
├── gateway/                             ← Express handlers for /api/v1/benji/*
│   ├── benji.router.ts                  ← Registers all sub-routes, exported as default Router
│   ├── benji.middleware.ts              ← Rate limiting (wraps existing aiRateLimit) + request enrichment
│   └── handlers/
│       ├── chat.handler.ts              ← POST /benji/chat
│       ├── shipment.handler.ts          ← POST /benji/shipment/parse, /create, /extract-document, /status
│       ├── route.handler.ts             ← POST /benji/route/optimize, /plan, GET /corridors
│       ├── dispatch.handler.ts          ← POST /benji/dispatch/analyze, /assign, GET /recommendations/:driverId, POST /accept/:loadId
│       ├── memory.handler.ts            ← GET/POST/DELETE /benji/memory, GET/POST /benji/memory/preferences
│       ├── events.handler.ts            ← POST /benji/events/ingest, GET /benji/events/query
│       ├── evaluate.handler.ts          ← POST /benji/evaluate/run, GET /benji/evaluate/results, rollback
│       ├── sms.handler.ts               ← POST /benji/sms/send, /benji/sms/webhook
│       ├── trace.handler.ts             ← GET /benji/trace/:traceId, POST /benji/trace/:traceId/replay
│       └── learning.handler.ts          ← GET/POST /benji/learning/proposals, approve, reject
│
├── events/                              ← Event bus
│   ├── BenjiEventService.ts             ← emit() → inserts into benji_events table
│   ├── event.schemas.ts                 ← All BenjiEventType definitions + BenjiEvent interface
│   └── event.processor.ts              ← Background queue processor for event-triggered side effects
│
└── index.ts                             ← Public barrel: exports orchestrator, key service instances
```

---

## 2. File-by-File Purpose

### `benji/core/math/geo.ts`
```typescript
// EXTRACTED from BenjiDispatcherService.ts + BenjiLoadRecommendationService.ts
// Replaces identical private methods in both classes

export function toRad(degrees: number): number
export function haversineDistance(
  point1: { coordinates: [number, number] } | null | undefined,
  point2: { coordinates: [number, number] } | null | undefined,
  defaultMiles?: number   // default 50 — matches existing behavior
): number
export function areCitiesNear(loc1: GeoPoint | null, loc2: GeoPoint | null, thresholdMiles?: number): boolean
export async function calculateRouteFit(driverId: string, load: LoadLike, supabaseClient: SupabaseClient): Promise<number>
```

### `benji/core/constants/scoring.ts`
```typescript
// EXTRACTED from hardcoded weights in both dispatcher services

export const DISPATCH_WEIGHTS = {
  proximity:   0.40,   // from BenjiDispatcherService
  routeFit:    0.25,
  earnings:    0.20,
  experience:  0.10,
  rating:      0.05,
} as const;

export const RECOMMENDATION_WEIGHTS = {
  proximity:      0.35,  // from BenjiLoadRecommendationService
  routeFit:       0.30,
  earnings:       0.25,
  timing:         0.05,
  compatibility:  0.05,
} as const;

export const DRIVER_EARNINGS_SPLIT = 0.80;   // immutable — never changeable by learning
export const MIN_MATCH_CONFIDENCE  = 60;     // from BenjiDispatcherService line 138
export const BEST_MATCH_THRESHOLD  = 85;     // from BenjiLoadRecommendationService line 408
export const GOOD_MATCH_THRESHOLD  = 70;
export const CITY_PROXIMITY_MILES  = 30;     // areCitiesNear threshold
```

### `benji/core/types/benji.types.ts`
Complete V2 orchestrator contracts: `OrchestratorRequest`, `OrchestratorResponse`, `BenjiIntent`, `InputChannel`, `OrchestratorActionType`, `BenjiPlan`, `BenjiPlanStep`, `MemoryContext`, `MemoryInfluence`, `ToolResult<T>`, `ValidationResult`.

### `benji/core/types/dispatch.types.ts`
Re-exports the interfaces already defined in `BenjiDispatcherService.ts` and `BenjiLoadRecommendationService.ts` — moved here so both services import from this file instead of defining locally.

### `benji/ai/openai.client.ts`
```typescript
// REPLACES three separate instantiations in:
//   BenjiChatService.ts line 1
//   NaturalLanguageShipmentService.ts line 31
//   AIDocumentExtractionService.ts line 29

import OpenAI from 'openai';
// Singleton — created once, shared across all AI services
export const openaiClient = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});
```

### `benji/ai/usage-tracker.ts`
Replaces the in-memory `aiUsageTracker` in `ai.config.ts` with a DB-backed version that writes to `ai_usage_logs`. The `aiUsageTracker` export in `ai.config.ts` remains during migration — both can coexist. New code imports from `@benji/ai/usage-tracker`.

### `benji/ai/response-cache.ts`
Replaces the in-memory `aiResponseCache` in `ai.config.ts`.
- Old key (bug): `${service}:${hashMessage(lastMessage)}` (shared across users)
- New key (fix): `${service}:${userType}:${userId}:${hashMessage(lastMessage)}`

### `benji/tools/registry.ts`
```typescript
export type ToolName =
  | 'tool:memory.read'     | 'tool:memory.write'
  | 'tool:shipment.parse'  | 'tool:shipment.create'
  | 'tool:shipment.lookup' | 'tool:shipment.status_update'
  | 'tool:pricing.calculate'
  | 'tool:route.optimize'
  | 'tool:dispatch.analyze' | 'tool:dispatch.assign'
  | 'tool:dispatch.recommendations' | 'tool:dispatch.accept'
  | 'tool:document.extract'
  | 'tool:sms.send'
  | 'tool:chat.respond';

export type ToolHandler<TInput, TOutput> = (
  input: TInput,
  context: ToolContext
) => Promise<ToolResult<TOutput>>;

export class BenjiToolRegistry {
  register<TIn, TOut>(name: ToolName, handler: ToolHandler<TIn, TOut>): void
  execute<TIn, TOut>(name: ToolName, input: TIn, context: ToolContext): Promise<ToolResult<TOut>>
}
export const toolRegistry = new BenjiToolRegistry();
```

### `benji/gateway/benji.router.ts`
```typescript
import { Router } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
// imports all handlers...
const router = Router();
// Registers all /api/v1/benji/* routes
// During Phase 3 migration, old /api/v1/ai/* routes also imported here as aliases
export default router;
```

### `benji/index.ts`
```typescript
// Public barrel — what the rest of the backend imports from Benji V2
export { benjiOrchestrator }  from './orchestration/BenjiOrchestrator';
export { benjiEventService }  from './events/BenjiEventService';
export { toolRegistry }        from './tools/registry';
export { openaiClient }        from './ai/openai.client';
export type * from './core/types/index';
```

---

## 3. Migration Mapping — Every Benji File

| Old File | New Location | Strategy | Notes |
|---|---|---|---|
| `services/BenjiChatService.ts` | `services/BenjiChatService.ts` (keep) | **wrap** | `benji/tools/chat/chat.tool.ts` imports and calls it. No rewrite. Update to import `openaiClient` from `@benji/ai/openai.client` in Phase 3. |
| `services/BenjiDispatcherService.ts` | `services/BenjiDispatcherService.ts` (keep) | **wrap + extract shared** | Extract `calculateDistance`, `calculateRouteFit`, `areCitiesNear`, `toRad` to `benji/core/math/geo.ts`. Scoring weights to `benji/core/constants/scoring.ts`. `benji/tools/dispatch/dispatch.tool.ts` wraps it. |
| `services/BenjiLoadRecommendationService.ts` | `services/BenjiLoadRecommendationService.ts` (keep) | **wrap + extract shared** | Same extraction as above — methods replaced with imports from `@benji/core/math/geo`. `benji/tools/dispatch/recommendations.tool.ts` wraps it. |
| `services/NaturalLanguageShipmentService.ts` | `services/NaturalLanguageShipmentService.ts` (keep) | **wrap + fix client** | Fix: replace inline `createClient()` with `import { supabase } from '@lib/supabase'`. Fix: replace `new OpenAI()` with `import { openaiClient } from '@benji/ai/openai.client'`. `benji/tools/shipment/shipment-parse.tool.ts` and `shipment-create.tool.ts` wrap it. |
| `services/AIDocumentExtractionService.ts` | `services/AIDocumentExtractionService.ts` (keep) | **wrap + fix client** | Same client fixes as NL Shipment. `benji/tools/document/document-extract.tool.ts` wraps it. |
| `services/RouteOptimizationService.ts` | `services/RouteOptimizationService.ts` (keep) | **wrap + extract corridors** | Extract Carolina corridor data to `benji/core/constants/corridors.ts`. `benji/tools/route/route-optimize.tool.ts` wraps it. |
| `services/pricing.service.ts` | `services/pricing.service.ts` (keep) | **wrap** | `benji/tools/pricing/pricing.tool.ts` wraps `calculateQuote()`. No changes to pricing.service.ts itself. |
| `services/twilio.service.ts` | `services/twilio.service.ts` (keep) | **wrap** | `benji/tools/sms/sms.tool.ts` wraps `twilioService.sendSMS()`. Adds 160-char truncation + markdown stripping for SMS. |
| `services/AIDispatcherService.ts` | **DELETE** | **delete** | Dead code. Only referenced by `routes/dispatcher.ts`. No production traffic. Delete in Phase 1. |
| `config/ai.config.ts` | `config/ai.config.ts` (keep) | **keep + deprecate tracker** | Keep `AI_MODELS`, `SERVICE_MODEL_MAP`, `RATE_LIMITS` — still used by existing routes. `aiUsageTracker` and `aiResponseCache` are deprecated but kept for legacy code during migration. New code uses `@benji/ai/usage-tracker` and `@benji/ai/response-cache`. |
| `config/features.ts` | `config/features.ts` (keep) | **fix `\|\| true`** | Phase 1 fix: remove all `|| true` overrides. Set Railway env vars before removing. |
| `routes/ai.routes.ts` | `routes/ai.routes.ts` (keep during migration) | **keep + add v2 aliases** | Stays active throughout migration. In Phase 3, routes are added as aliases pointing to new V2 handlers. In Phase 5, old routes removed. |
| `routes/routeOptimization.routes.ts` | `routes/routeOptimization.routes.ts` (keep during migration) | **keep** | Migrates to `/api/v1/benji/route/*` in Phase 3. Old route removed Phase 5. |
| `routes/dispatcher.ts` | **DELETE** | **delete** | Dead code — uses `AIDispatcherService` which is dead. Delete in Phase 1. |
| `middlewares/ai-rate-limit.middleware.ts` | `middlewares/ai-rate-limit.middleware.ts` (keep) | **keep + wrap** | `benji/gateway/benji.middleware.ts` imports and re-uses `aiRateLimit` from this file. No changes needed. |

---

## 4. Required `tsconfig.json` + `register-paths.ts` Changes

### `backend/tsconfig.json` — add ONE path alias:
```json
"@benji": ["benji/index.ts"],
"@benji/*": ["benji/*"]
```

Full paths block after change:
```json
"paths": {
  "@/*": ["./*"],
  "@config": ["config/index.ts"],
  "@config/*": ["config/*"],
  "@controllers/*": ["controllers/*"],
  "@middlewares/*": ["middlewares/*"],
  "@routes/*": ["routes/*"],
  "@services/*": ["services/*"],
  "@utils/*": ["utils/*"],
  "@types/*": ["types/*"],
  "@lib/*": ["lib/*"],
  "@benji": ["benji/index.ts"],
  "@benji/*": ["benji/*"]
}
```

### `backend/src/register-paths.ts` — add matching runtime aliases:
```typescript
register({
  baseUrl: './src',
  paths: {
    '@/*': ['*'],
    '@config/*': ['config/*'],
    '@controllers/*': ['controllers/*'],
    '@lib/*': ['lib/*'],
    '@middlewares/*': ['middlewares/*'],
    '@routes/*': ['routes/*'],
    '@services/*': ['services/*'],
    '@types/*': ['types/*'],
    '@utils/*': ['utils/*'],
    '@benji': ['benji/index.ts'],     // ADD
    '@benji/*': ['benji/*'],          // ADD
  },
});
```

### `backend/src/routes/index.ts` — add Benji V2 router (Phase 3):
```typescript
// Add after Phase 3:
import benjiRoutes from '../benji/gateway/benji.router';
// ...
router.use('/benji', benjiRoutes);
```

---

## 5. Implementation Order (Minimal-Breakage Sequence)

Each phase can be merged independently. Old routes stay live throughout until Phase 5.

---

### Phase 1 — Housekeeping (Days 1–3)
*Zero risk. No existing routes touched. Just cleanup.*

**Step 1.1 — Delete dead code:**
```
DELETE backend/src/services/AIDispatcherService.ts
DELETE backend/src/routes/dispatcher.ts
```
Then remove the `dispatcher` import from `routes/index.ts`:
```typescript
// Remove these two lines:
import dispatcherRoutes from './dispatcher';
router.use('/dispatcher', dispatcherRoutes);
```

**Step 1.2 — Fix feature flags:**
Precondition: confirm Railway env vars are set (`ENABLE_AI_DISPATCHER=true`, etc.)
Then remove all `|| true` from `config/features.ts`.

**Step 1.3 — Fix hardcoded Railway URL:**
In `website/src/components/driver/BenjiLoadRecommendations.tsx`, replace hardcoded URL with `process.env.NEXT_PUBLIC_API_URL`.

**Step 1.4 — Remove debug console.log token lines:**
In `BenjiLoadRecommendations.tsx` and any `aiService.ts` that dumps token counts.

**Validation:** `npx tsc --noEmit` in both `website/` and `backend/` — expect zero errors.

---

### Phase 2 — Core Module (Days 4–7)
*Pure code, no imports from this directory yet. Cannot break anything.*

**Step 2.1 — Create folder skeleton:**
```
mkdir backend/src/benji/
mkdir backend/src/benji/core/
mkdir backend/src/benji/core/types/
mkdir backend/src/benji/core/constants/
mkdir backend/src/benji/core/math/
```

**Step 2.2 — Add path aliases** to `tsconfig.json` and `register-paths.ts` (from §4 above).

**Step 2.3 — Create `benji/core/math/geo.ts`:**
Extract `calculateDistance()`, `toRad()`, `areCitiesNear()` by copying the logic from `BenjiDispatcherService.ts` (lines 406–450). The two service files are NOT modified yet.

**Step 2.4 — Create `benji/core/constants/scoring.ts`:**
Copy hardcoded values from `BenjiDispatcherService` and `BenjiLoadRecommendationService`. Services NOT modified yet.

**Step 2.5 — Create `benji/core/types/`:**
Write all type files. These are new interfaces — nothing importing them yet.

**Step 2.6 — Create `benji/core/types/index.ts` barrel.**

**Validation:** `npx tsc --noEmit` in `backend/` — expect zero errors.

---

### Phase 3 — Tool Adapters + AI Layer (Days 8–14)
*Adds wrappers around existing services. Services themselves minimally touched (client fixes only).*

**Step 3.1 — Create `benji/ai/openai.client.ts`** (shared singleton).

**Step 3.2 — Fix NL Shipment + Document Extraction client usage:**
In `NaturalLanguageShipmentService.ts`:
- Replace `createClient(...)` with `import { supabase } from '@lib/supabase'`
- Replace `new OpenAI(...)` with `import { openaiClient } from '@benji/ai/openai.client'`
- Update all `openai.chat.completions.create()` calls to use `openaiClient`

In `AIDocumentExtractionService.ts`: same two fixes.

These are minimal targeted changes. The service logic is unchanged.

**Step 3.3 — Create all tool adapters** under `benji/tools/`:
Start with the simplest (no business logic, just delegation):
1. `benji/tools/pricing/pricing.tool.ts` — 10 lines, wraps `calculateQuote()`
2. `benji/tools/chat/chat.tool.ts` — wraps `benjiChatService.chat()`
3. `benji/tools/dispatch/dispatch.tool.ts` — wraps `benjiDispatcherService.analyzeDispatchOpportunities()` + `autoAssignLoads()`
4. `benji/tools/dispatch/recommendations.tool.ts` — wraps `benjiLoadRecommendationService.getRecommendations()`
5. `benji/tools/shipment/shipment-parse.tool.ts` — wraps `nlService.parseShipment()`
6. `benji/tools/shipment/shipment-create.tool.ts` — wraps `nlService.createShipment()`
7. `benji/tools/shipment/shipment-lookup.tool.ts` — direct `supabase.from('shipments').select()`
8. `benji/tools/route/route-optimize.tool.ts` — wraps `routeOptimizationService.optimizeRoute()`
9. `benji/tools/document/document-extract.tool.ts` — wraps `aiDocService.processDocument()`
10. `benji/tools/sms/sms.tool.ts` — wraps `twilioService.sendSMS()` + adds SMS formatting
11. `benji/tools/dispatch/dispatch-accept.tool.ts` — **new implementation** of load accept flow

**Step 3.4 — Create `benji/tools/registry.ts`** and register all tools.

**Step 3.5 — Create `benji/ai/prompt-registry.ts`** and populate `benji/ai/prompts/*.txt` files.

**Step 3.6 — Create `benji/ai/intent-classifier.ts`** (keyword-first, GPT-4o-mini fallback).

**Step 3.7 — Create `benji/events/BenjiEventService.ts`** and `benji/events/event.schemas.ts`.

**Validation:** `npx tsc --noEmit` in `backend/` — expect zero errors.

---

### Phase 4 — Memory + Orchestration Layers (Days 15–21)
*New services only. No existing route is modified in this phase.*

**Step 4.1 — Run SQL migrations in Supabase** (in order):
1. `20260701_benji_conversations.sql`
2. `20260701_benji_events.sql`
3. `20260701_benji_memory.sql`
4. `20260701_benji_preferences.sql`
5. `20260703_benji_traces.sql`
6. `20260703_policy_violations.sql`
7. `20260703_learning_proposals.sql`
8. `20260703_benji_config.sql`

**Step 4.2 — Create memory layer:**
1. `benji/memory/BenjiMemoryService.ts`
2. `benji/memory/BenjiConversationService.ts`
3. `benji/memory/BenjiPreferenceService.ts`
4. `benji/memory/MemoryInfluenceEngine.ts`
5. `benji/memory/BenjiTraceService.ts`

**Step 4.3 — Create AI layer:**
1. `benji/ai/usage-tracker.ts`
2. `benji/ai/response-cache.ts`
3. `benji/ai/output-parser.ts`

**Step 4.4 — Create orchestration layer:**
1. `benji/orchestration/BenjiStateMachine.ts`
2. `benji/orchestration/GlobalPolicyGuard.ts`
3. `benji/orchestration/SimulationEngine.ts`
4. `benji/orchestration/ToolGraphExecutor.ts`
5. `benji/orchestration/BenjiPlanner.ts`
6. `benji/orchestration/BenjiOrchestrator.ts` (builds on all above)

**Step 4.5 — Create `benji/index.ts` barrel.**

**Validation:** `npx tsc --noEmit` in `backend/` — expect zero errors.

---

### Phase 5 — Gateway: New Routes Live (Days 22–28)
*New routes added. Old routes still live. Traffic can be switched gradually.*

**Step 5.1 — Create `benji/gateway/benji.middleware.ts`:**
Imports and reuses `aiRateLimit` from existing `@middlewares/ai-rate-limit.middleware`.

**Step 5.2 — Create all handlers** under `benji/gateway/handlers/`.

**Step 5.3 — Create `benji/gateway/benji.router.ts`.**

**Step 5.4 — Add to `routes/index.ts`:**
```typescript
import benjiRoutes from '../benji/gateway/benji.router';
router.use('/benji', benjiRoutes);
```
All `/api/v1/benji/*` routes now live. Old `/api/v1/ai/*` routes still live.

**Step 5.5 — Update frontend** to call `/api/v1/benji/*` for new features.

**Step 5.6 — Add `/api/v1/benji/chat` to BenjiLoadRecommendations and all other frontend AI components.**

**Validation:** `npx tsc --noEmit` — zero errors. E2E test both old and new routes.

---

### Phase 6 — Evaluation + Dispatcher UI Fix + Route Planner UI (Days 29–35)

**Step 6.1 — Build evaluation service** (`benji/ai/eval/evaluation.service.ts`).

**Step 6.2 — Build learning service** (`BenjiLearningService.ts` — offline, weekly cron).

**Step 6.3 — Build route planner UI** at `/dashboard/driver/route-planner` (was broken — showed only BenjiChat).

**Step 6.4 — Fix load acceptance button** (was TODO). Now implemented via `tool:dispatch.accept` + `dispatch-accept.tool.ts`.

**Step 6.5 — Update dispatcher scoring** in `BenjiDispatcherService.ts` and `BenjiLoadRecommendationService.ts` to read from `benji_config` table instead of hardcoded constants (uses `benji/core/constants/scoring.ts` as fallback).

**Validation:** Full E2E pass on all AI features.

---

### Phase 7 — Legacy Removal (Days 36–42)
*Only after Phase 6 is stable in production for 1 week.*

**Step 7.1 — Remove old AI routes** from `routes/index.ts`:
```typescript
// Remove:
router.use('/ai', aiRoutes);
router.use('/route-optimization', routeOptimizationRoutes);
```

**Step 7.2 — Archive (do not delete)** `routes/ai.routes.ts` and `routes/routeOptimization.routes.ts` as `.bak.ts` files for 30 days.

**Step 7.3 — Deprecate** `aiUsageTracker` and `aiResponseCache` from `ai.config.ts` — remove them once no imports remain.

**Step 7.4 — Replace private methods** in `BenjiDispatcherService.ts` and `BenjiLoadRecommendationService.ts` with imports from `@benji/core/math/geo`:
```typescript
// Replace private calculateDistance(), toRad(), areCitiesNear(), calculateRouteFit()
// with:
import { haversineDistance, areCitiesNear, calculateRouteFit } from '@benji/core/math/geo';
```

**Validation:** `npx tsc --noEmit` — zero errors. Zero 4xx/5xx regressions in Railway logs.

---

## 6. Coexistence Compatibility Strategy

### During Phases 1–4 (new code exists, no new routes)
- Old `/api/v1/ai/*` routes work exactly as before
- New `benji/` folder is unused — just compiled TypeScript, no Express registration
- Zero risk to production

### During Phase 5 (new routes live alongside old)
- Both `/api/v1/ai/chat` and `/api/v1/benji/chat` are live simultaneously
- Frontend can migrate endpoint-by-endpoint
- Old route can stay alive indefinitely — no forced cutover
- Feature flags in `benji/gateway/benji.middleware.ts` allow per-feature disabling

### Import path strategy during migration
New code (in `benji/`) imports from:
- `@benji/core/*` — new types and math
- `@services/BenjiChatService` — existing services via existing alias
- `@lib/supabase` — shared Supabase client
- `@utils/logger` — shared logger
- `@middlewares/auth.middleware` — shared auth

Existing services (`services/`) import from:
- Their existing imports — unchanged during Phase 1–4
- In Phase 3 only: `@benji/ai/openai.client` replaces inline `new OpenAI()`
- In Phase 7: `@benji/core/math/geo` replaces private duplicate methods

---

## 7. Quick Reference: Complete File Inventory

### New Files Created (all under `backend/src/benji/`)

```
benji/index.ts

benji/core/types/benji.types.ts
benji/core/types/dispatch.types.ts
benji/core/types/shipment.types.ts
benji/core/types/route.types.ts
benji/core/types/document.types.ts
benji/core/types/index.ts
benji/core/constants/scoring.ts
benji/core/constants/models.ts
benji/core/constants/corridors.ts
benji/core/math/geo.ts

benji/orchestration/BenjiOrchestrator.ts
benji/orchestration/BenjiPlanner.ts
benji/orchestration/ToolGraphExecutor.ts
benji/orchestration/SimulationEngine.ts
benji/orchestration/BenjiStateMachine.ts
benji/orchestration/GlobalPolicyGuard.ts

benji/memory/BenjiMemoryService.ts
benji/memory/BenjiConversationService.ts
benji/memory/BenjiTraceService.ts
benji/memory/BenjiPreferenceService.ts
benji/memory/MemoryInfluenceEngine.ts

benji/tools/registry.ts
benji/tools/dispatch/dispatch.tool.ts
benji/tools/dispatch/dispatch-accept.tool.ts
benji/tools/dispatch/recommendations.tool.ts
benji/tools/shipment/shipment-parse.tool.ts
benji/tools/shipment/shipment-create.tool.ts
benji/tools/shipment/shipment-lookup.tool.ts
benji/tools/route/route-optimize.tool.ts
benji/tools/pricing/pricing.tool.ts
benji/tools/document/document-extract.tool.ts
benji/tools/sms/sms.tool.ts
benji/tools/chat/chat.tool.ts

benji/ai/openai.client.ts
benji/ai/prompt-registry.ts
benji/ai/intent-classifier.ts
benji/ai/output-parser.ts
benji/ai/usage-tracker.ts
benji/ai/response-cache.ts
benji/ai/eval/evaluation.service.ts
benji/ai/eval/eval.prompts.ts
benji/ai/prompts/chat.client.v1.txt
benji/ai/prompts/chat.driver.v1.txt
benji/ai/prompts/chat.admin.v1.txt
benji/ai/prompts/chat.broker.v1.txt
benji/ai/prompts/intent.classifier.v1.txt
benji/ai/prompts/shipment.extraction.v1.txt
benji/ai/prompts/dispatch.reasoning.v1.txt
benji/ai/prompts/planner.generate.v1.txt
benji/ai/prompts/evaluation.judge.v1.txt

benji/gateway/benji.router.ts
benji/gateway/benji.middleware.ts
benji/gateway/handlers/chat.handler.ts
benji/gateway/handlers/shipment.handler.ts
benji/gateway/handlers/route.handler.ts
benji/gateway/handlers/dispatch.handler.ts
benji/gateway/handlers/memory.handler.ts
benji/gateway/handlers/events.handler.ts
benji/gateway/handlers/evaluate.handler.ts
benji/gateway/handlers/sms.handler.ts
benji/gateway/handlers/trace.handler.ts
benji/gateway/handlers/learning.handler.ts

benji/events/BenjiEventService.ts
benji/events/event.schemas.ts
benji/events/event.processor.ts
```

**Total new files: 57**

### Existing Files Modified (minimal targeted changes)

| File | Change | Phase |
|---|---|---|
| `backend/tsconfig.json` | Add `@benji` path alias | 2 |
| `backend/src/register-paths.ts` | Add `@benji` runtime alias | 2 |
| `backend/src/routes/index.ts` | Add `router.use('/benji', benjiRoutes)` | 5 |
| `backend/src/routes/index.ts` | Remove `/ai` and `/route-optimization` entries | 7 |
| `backend/src/config/features.ts` | Remove all `|| true` overrides | 1 |
| `backend/src/services/NaturalLanguageShipmentService.ts` | Fix `createClient()` + `new OpenAI()` | 3 |
| `backend/src/services/AIDocumentExtractionService.ts` | Fix `createClient()` + `new OpenAI()` | 3 |
| `backend/src/services/BenjiDispatcherService.ts` | Replace private geo methods with `@benji/core/math/geo` imports | 7 |
| `backend/src/services/BenjiLoadRecommendationService.ts` | Replace private geo methods with `@benji/core/math/geo` imports | 7 |

### Existing Files Deleted

| File | Phase | Reason |
|---|---|---|
| `backend/src/services/AIDispatcherService.ts` | 1 | Dead code — not imported by any production path |
| `backend/src/routes/dispatcher.ts` | 1 | Only imports the dead `AIDispatcherService` |

### Existing Files Left Completely Unchanged

| File | Notes |
|---|---|
| `services/BenjiChatService.ts` | Wrapped by `benji/tools/chat/chat.tool.ts` |
| `services/BenjiDispatcherService.ts` | Wrapped by `benji/tools/dispatch/dispatch.tool.ts` |
| `services/BenjiLoadRecommendationService.ts` | Wrapped by `benji/tools/dispatch/recommendations.tool.ts` |
| `services/RouteOptimizationService.ts` | Wrapped by `benji/tools/route/route-optimize.tool.ts` |
| `services/pricing.service.ts` | Wrapped by `benji/tools/pricing/pricing.tool.ts` |
| `services/twilio.service.ts` | Wrapped by `benji/tools/sms/sms.tool.ts` |
| `services/google-maps.service.ts` | Used indirectly through RouteOptimizationService |
| `config/ai.config.ts` | Models/rate limits still used by legacy routes |
| `middlewares/ai-rate-limit.middleware.ts` | Reused by `benji/gateway/benji.middleware.ts` |
| `middlewares/auth.middleware.ts` | Used directly in all gateway handlers |
| `lib/supabase.ts` | Canonical client — all V2 code imports from here |
| `utils/logger.ts` | Used throughout V2 |

---

## 8. What the Structure Intentionally Does NOT Do

1. **Does not rewrite `BenjiChatService`** — it gets wrapped, not replaced
2. **Does not create a separate database client** — `@lib/supabase` is the single client
3. **Does not move existing services** — `services/` stays as-is, tools wrap them
4. **Does not use different logger** — `@utils/logger` throughout
5. **Does not put V2 code in the old `routes/` folder** — all under `benji/gateway/`
6. **Does not add `.env` variables yet** — uses Railway env vars already set + new governance vars added in Phase 4
7. **Does not touch payment, email, Stripe, or Brevo services** — outside Benji scope

---

*Related documents: BENJI_SYSTEM_AUDIT.md · BENJI_V2_IMPLEMENTATION_PLAN.md · BENJI_V2_ORCHESTRATOR.md · BENJI_V2_COGNITIVE_LAYER.md · BENJI_V2_GOVERNANCE.md*
*Next step: Phase 1 — delete AIDispatcherService.ts + dispatcher.ts + fix features.ts*
