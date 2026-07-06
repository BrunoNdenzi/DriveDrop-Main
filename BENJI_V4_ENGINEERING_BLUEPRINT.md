# Benji V4 — Living Engineering Blueprint

**Document version**: 1.0  
**System version**: Benji V4 (deployed on V3 infrastructure)  
**Last updated**: 2026-07-06  
**Status**: Production Ready with Minor Risks

---

## Table of Contents

1. [Executive Overview](#1-executive-overview)
2. [Architecture](#2-architecture)
3. [Component Map](#3-component-map)
4. [AI Layer](#4-ai-layer)
5. [Tooling Layer](#5-tooling-layer)
6. [Session System](#6-session-system)
7. [Prompt Engineering](#7-prompt-engineering)
8. [Workflow Catalogue](#8-workflow-catalogue)
9. [Database Integration](#9-database-integration)
10. [Security Model](#10-security-model)
11. [Testing](#11-testing)
12. [Performance](#12-performance)
13. [Known Limitations](#13-known-limitations)
14. [Future Roadmap](#14-future-roadmap)
15. [Decision Log](#15-decision-log)
16. [Production Readiness Assessment](#16-production-readiness-assessment)

---

## 1. Executive Overview

### What Is Benji?

Benji is DriveDrop's AI assistant — an LLM-controlled agent that serves as the primary conversational interface for the entire platform. It runs on the backend as a stateful agentic service and is accessible through the DriveDrop web application via a chat UI.

Benji is **not** a scripted chatbot with fixed conversation paths. It is a GPT-4-class language model that drives its own reasoning loop, decides when to invoke backend tools, and synthesizes results into natural conversational responses. Users interact in plain English and Benji translates their intent into real platform operations.

### Goals

1. **Completeness**: Every action a user can perform through the DriveDrop dashboard should also be achievable through Benji in natural language — without needing to navigate the UI.
2. **Robustness**: Benji must handle imperfect language — typos, abbreviations, fragments, conversational follow-ups — with the same reliability as well-formed requests.
3. **Role awareness**: The platform has four distinct user roles (Client, Driver, Admin, Broker). Benji behaves differently for each, surfacing only the capabilities relevant to that role.
4. **Safety**: All tool-level authorization is enforced server-side. The LLM cannot be prompted into performing unauthorized operations.
5. **Quality**: Responses must feel like a knowledgeable human assistant — warm, precise, concise, never robotic.

### Supported Roles

| Role | Description |
|---|---|
| **Client** | Vehicle owner or shipper. Books shipments, tracks them, cancels bookings, communicates with drivers, checks payment. |
| **Driver** | Carrier or owner-operator. Browses available loads, applies for jobs, updates shipment statuses, tracks routes, messages clients. |
| **Admin** | DriveDrop staff. Full platform visibility — all shipments, all users, driver assignment, status management, payment oversight. |
| **Broker** | B2B freight partner. Quote generation, shipment creation, tracking, messaging. Subset of admin capabilities without management tools. |

### System Boundaries

Benji does **not**:
- Process payments directly (reads payment status only)
- Update user profiles (reads profile only)
- Handle authentication (delegated to Supabase Auth)
- Make routing decisions on the carrier network
- Access external tracking APIs

Benji **does**:
- Create, list, track, and cancel shipments
- Calculate shipping quotes
- Enable messaging within shipment conversations
- Update shipment statuses (driver/admin)
- Assign drivers to shipments (admin)
- Surface user and shipment data

---

## 2. Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│   useBenjiSession hook → sessionStorage UUID → SSE       │
└────────────────────────┬────────────────────────────────┘
                         │ POST /api/v1/benji-v3/chat[/stream]
                         │ Bearer: Supabase JWT
                         ▼
┌─────────────────────────────────────────────────────────┐
│                Express Backend (Railway)                 │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ authenticate│  │validateBody  │  │ benjiRateLimit  │  │
│  └────────────┘  └──────────────┘  └─────────────────┘  │
│                         │                               │
│                         ▼                               │
│              ┌─────────────────────┐                    │
│              │   BenjiV3Service    │                    │
│              │  .chat() / .chatStream()                 │
│              └──────────┬──────────┘                    │
│                         │                               │
│         ┌───────────────┴────────────────┐              │
│         ▼                                ▼              │
│  ┌─────────────┐              ┌──────────────────────┐  │
│  │ V3SessionStore│            │   OpenAI API         │  │
│  │ (in-process) │            │  gpt-4o-mini / gpt-4o │  │
│  └─────────────┘              └──────────────────────┘  │
│                                         │               │
│                         Tool calls      │               │
│                         ▼              ▼               │
│              ┌─────────────────────────────┐           │
│              │     executeV3Tool()          │           │
│              │  15 tools × role-filtered    │           │
│              └──────────────┬──────────────┘           │
│                             │                          │
│          ┌──────────────────┼──────────────────────┐   │
│          ▼                  ▼                       ▼   │
│    ┌──────────┐    ┌──────────────────┐    ┌──────────┐ │
│    │ Supabase │    │  pricingService  │    │ Google   │ │
│    │  (DB)    │    │                  │    │  Maps    │ │
│    └──────────┘    └──────────────────┘    └──────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Request Lifecycle (Non-Streaming)

```
Client → POST /chat (JWT, message, sessionId)
  ↓
[authenticate middleware] — validates Supabase JWT, attaches req.user
  ↓
[validateChatBody] — checks message non-empty ≤2000 chars, sessionId present
  ↓
[benjiRateLimit] — sliding window: 10 RPM, burst 3/15s per userId
  ↓
BenjiV3Service.chat()
  ↓
v3SessionStore.getOrCreate(sessionId, userId, userType)
  ↓
buildV3SystemPrompt(userType, session.context)
  ↓
Append user message to session.messages
  ↓
getToolsForRole(userType) → role-filtered tool list
  ↓
isConversationalOnly(message, context)? → fastPath=true (skip tools, 256 tokens)
  ↓
─── AGENTIC LOOP (max 5 iterations) ───
│
├─ openai.create({ model: gpt-4o-mini, messages, tools, temp: 0.65 })
│
├─ if finish_reason === 'tool_calls':
│    useStrongModel = true (subsequent iterations use gpt-4o)
│    for each tool_call:
│      executeV3Tool(name, args, userId, userRole) → V3ToolResult
│      if success: extractContextFromToolOutput(name, data, session)
│      append tool result message to apiMessages
│    continue loop
│
└─ if finish_reason === 'stop':
     finalResponse = choice.message.content
     break
─────────────────────────────────────────
  ↓
session.messages.push({ role: 'assistant', content: finalResponse })
v3SessionStore.save(session)
  ↓
logV3Audit(event)
  ↓
return { response, sessionId, toolsUsed, latencyMs }
```

### Request Lifecycle (Streaming SSE)

The streaming variant follows the same agentic loop but emits SSE events:

```
data: {"type":"start","sessionId":"..."}
data: {"type":"tool","name":"get_shipping_quote"}   ← one per tool invoked
data: {"type":"token","content":"The estimated..."}  ← streamed final text
data: {"type":"end","sessionId":"...","toolsUsed":[],"latencyMs":1200}
data: [DONE]
```

Important: Tool calls execute synchronously (non-streaming) in the loop. Only the final text response uses SSE. This guarantees the LLM has complete tool context before generating the response, while the user still sees progressive rendering.

The current implementation emits the entire final response as one `token` event rather than word-by-word streaming. This is architecturally correct — a second streaming API call is avoided, and the response content is identical to the non-streaming path.

### Agent Loop Detail

```
MAX_LOOP = 5

iter 1: model = gpt-4o-mini (fast, conversational)
  → tool calls? → useStrongModel = true, append results
iter 2: model = gpt-4o (stronger reasoning with tool context)
  → more tool calls? → execute, append results
iter 3: model = gpt-4o
  → final text → break

If 5 iterations exhaust without stop: fallback response emitted.
```

The two-model strategy was chosen deliberately: gpt-4o-mini handles greeting routing and simple conversational turns cheaply (~70% of traffic); gpt-4o handles all tool-calling passes where reasoning quality matters.

---

## 3. Component Map

### Backend Directory Structure

```
backend/src/benji-v3/
├── benji.router.ts          HTTP adapter — Express routes, auth, rate limit
├── benji.service.ts         Core agent loop — session, LLM, tools, context
├── benji.types.ts           Shared TypeScript interfaces
├── benji.memory.ts          In-process session store with TTL
├── audit/
│   └── benji.audit.ts       Structured production audit logger
├── prompts/
│   └── system.prompt.ts     System prompt builder — role + context injection
└── tools/
    ├── index.ts             15 tool definitions + executors + dispatch
    └── distance.utils.ts    Haversine fallback distance (~120 US cities)
```

```
backend/src/benji-v3/test/
├── v3.production.test.ts      28-test HTTP-level production suite
├── v3.tool-regression.test.ts 26-test tool routing regression suite
├── v3.v4-capabilities.test.ts 30-test V4 capability coverage suite
├── v3.robustness.test.ts      30-test realistic language robustness suite
├── v3.test.ts                 Earlier unit-style tests
└── v3-full.test.ts            Extended test file
```

```
website/src/components/benji-v3/
└── hooks/
    └── useBenjiSession.ts    React hook — sessionId, streaming, message state
```

### File Responsibilities

#### `benji.router.ts`
Pure HTTP adapter. Does NOT contain business logic. Responsibilities:
- Validates request body (message, sessionId) before the rate limiter runs — malformed requests are rejected without consuming quota
- Maps Supabase role string → `UserType` enum
- Invokes `benjiV3Service.chat()` or `.chatStream()`
- Exposes two endpoints: `POST /chat` (JSON) and `POST /chat/stream` (SSE)

#### `benji.service.ts`
The brain. Contains:
- `LOGISTICS_KEYWORDS` regex — fast-path gate
- `isConversationalOnly()` — decides whether tools are needed
- `getToolsForRole()` — role-based tool filtering
- `extractContextFromToolOutput()` — merges tool results into session context
- `BenjiV3Service.chat()` — non-streaming agent loop
- `BenjiV3Service.chatStream()` — SSE streaming agent loop

#### `benji.types.ts`
All shared interfaces. The `V3LogisticsContext` object is the core session state that enables context-aware follow-up conversations. The `V3ToolResult` interface defines the contract between tool executors and the agent loop.

#### `benji.memory.ts`
Singleton in-process session store (`Map<string, V3Session>`). Includes:
- TTL eviction (2 hours of inactivity)
- Message cap (60 messages per session, oldest pruned)
- Lazy eviction (triggered when store size > 5000 entries)
- Security check: if `session.userId !== userId` on retrieval, a new session is created rather than returning another user's data

#### `audit/benji.audit.ts`
Emits structured JSON log lines prefixed with `[BENJI_V3_AUDIT]`. Uses `console.warn` (not `console.log`) so lines survive production log stripping. Each event captures: sessionId, userId, userType, model used, tools invoked, token counts (prompt + completion), latency, loop count, and response status.

#### `prompts/system.prompt.ts`
Builds the complete system prompt at request time. Composed of three parts:
1. `PERSONALITY` — core character, voice rules, capability summary, tool invocation rules, workflow orchestration hints, clarification approach
2. `ROLE_CONTEXT[userType]` — role-specific instructions and tool guidance
3. `buildContextBlock(ctx)` — injects accumulated session context (vehicle, route, quote, active shipment IDs) under a clearly labeled "SESSION CONTEXT" header

#### `tools/index.ts`
All 15 OpenAI tool definitions (JSON Schema) and their executor functions. The `executeV3Tool()` dispatch function is the single entry point. Each executor:
- Uses lazy import of `supabaseAdmin` or `supabase` to avoid circular dependency issues
- Returns `V3ToolResult` — never throws
- Enforces role permissions server-side (independent of LLM routing)

#### `tools/distance.utils.ts`
Haversine fallback for `get_shipping_quote` when Google Maps API is unavailable. Contains ~120 major US cities + all 50 state centroids. Accuracy: ±10–15% vs road distance. Used only when Google Maps fails — should not be primary path.

---

## 4. AI Layer

### OpenAI Configuration

| Parameter | Value | Reasoning |
|---|---|---|
| Fast model | `gpt-4o-mini` | Used for first-pass routing decisions; ~70% cheaper than gpt-4o; good enough for routing and conversational turns |
| Strong model | `gpt-4o` | Activated when tools are invoked; higher reasoning quality for synthesizing tool results |
| Temperature | `0.65` | Balance between natural response variety and routing determinism; lower values (0.3) produce more deterministic routing but stiffer responses |
| MAX_TOKENS (standard) | `1024` | Sufficient for most responses; prevents excessively long replies |
| MAX_TOKENS (fast path) | `256` | Short greetings/general answers don't need more |
| MAX_LOOP | `5` | Prevents runaway tool chains; enough for any realistic workflow (quote → create is 2 iterations) |
| CTX_WINDOW | `20` | Last 20 messages sent to API; balances context quality vs token cost |
| tool_choice | `'auto'` | LLM decides when to call tools; do not force-call specific tools |

### Fast-Path Logic

Before entering the agentic loop, `isConversationalOnly(message, context)` determines whether to skip tools entirely:

```typescript
function isConversationalOnly(message: string, ctx: V3LogisticsContext): boolean {
  // If message contains any logistics keyword → never fast-path
  if (LOGISTICS_KEYWORDS.test(message)) return false;
  
  // If there is active logistics context (active quote, vehicle, shipment ID)
  // keep tools available for short affirmatives like "yes", "ok", "book it"
  if (ctx.lastQuote || ctx.activeShipmentId || ctx.lastShipmentId || ctx.vehicle?.make) return false;
  
  // Pure conversational short message with no logistics context → fast-path
  if (message.trim().length <= 5) return true;
  
  return false;
}
```

When `fastPath = true`:
- Tool list = `[]` (empty)
- `tool_choice = 'none'`
- `max_tokens = 256`

**Why the context check matters**: Without it, "ok" or "yes" as a follow-up to "Want me to book it?" would be fast-pathed, making `create_shipment` unreachable. The context check ensures affirmative replies within an active workflow are handled by the full agent.

**LOGISTICS_KEYWORDS regex**:
```
/\b(ship|shipment|shipments|shipping|freight|transport|carrier|pickup|delivery|
quote|price|cost|rate|track|tracking|vehicle|car|truck|sedan|suv|toyota|ford|
honda|bmw|mercedes|route|mile|haul|load|loads|driver|dispatch|invoice|book|
booking|status|schedule|operable|origin|destination|assign|message|messages|
conversation|conversations|apply|application|applications|payment|payments|
profile|history|earnings|order|orders|cancel|cancelled|cancellation|pending|
delivered|transit|accepted|assigned|users|available|jobs|withdraw|abort)\b/i
```

### Role-Based Tool Filtering

`getToolsForRole(userRole)` removes tools the user cannot use before the API call. This is a critical correctness and security layer.

```
Client blocked:  update_shipment_status, apply_for_shipment,
                 list_driver_applications, assign_driver, list_users

Driver blocked:  assign_driver, list_users, get_payment_info

Admin blocked:   apply_for_shipment, list_driver_applications

Broker blocked:  update_shipment_status, apply_for_shipment,
                 list_driver_applications, assign_driver, list_users
```

**Why this matters**: Without filtering, the LLM occasionally calls tools it shouldn't (e.g., calling `update_shipment_status` for a client). Even though the executor would reject it, the tool is consumed in the loop, the error is relayed, and the user gets a confusing response. By filtering at the API call level, the LLM simply cannot see the restricted tool.

### Context Extraction

After each successful tool call, `extractContextFromToolOutput(toolName, data, session)` updates the session's `V3LogisticsContext`:

| Tool | Context updates |
|---|---|
| `parse_shipment_details` | vehicle (make/model/year/vin), pickup.location, delivery.location |
| `get_shipping_quote` | lastQuote (total/miles/vehicleType), pickup.location, delivery.location, vehicle (make/model/year) |
| `create_shipment` | lastShipmentId, shipmentCreated = true |
| `track_shipment` | activeShipmentId, vehicle (if not already set), pickup/delivery (if not already set) |
| `list_shipments` | activeShipmentId (only if exactly 1 result returned) |
| `get_messages` / `send_message` | activeShipmentId from shipment_id in result |
| `apply_for_shipment` | activeShipmentId from shipment_id in result data |
| `update_shipment_status` | activeShipmentId from result.id |
| `cancel_shipment` | activeShipmentId from result.id |
| All others | No mutation |

**Why vehicle info is stored from quotes**: When a user says "Quote for my 2022 Honda Accord from Charlotte to Atlanta" then "yes book it", the second message has no vehicle info. Without storing the vehicle from the quote, the LLM would re-ask. Context extraction closes this gap.

### Session Context Injection into Prompt

The context block is injected at the end of the system prompt:

```
## SESSION CONTEXT — Already known. Do NOT re-ask for these details.
  • Vehicle: 2022 Honda Accord
  • Pickup: Charlotte, NC
  • Delivery: Atlanta, GA
  • Last quote: $612 (684 mi, open transport)
  • Shipment currently being discussed: de2611c8-…
```

This mechanism gives the LLM its "short-term memory" — it sees what was previously established and will not ask for it again.

### Model Escalation

The service starts each request with `gpt-4o-mini`. The first time a tool call is detected (`finish_reason === 'tool_calls'`), `useStrongModel` is set to `true`. All subsequent iterations in that request use `gpt-4o`. This means:
- Pure conversational turns (no tools): always gpt-4o-mini
- Tool-using turns: gpt-4o-mini routes → gpt-4o synthesizes

This design minimizes cost while ensuring the final response is generated by the stronger model with complete tool context.

---

## 5. Tooling Layer

### Tool Inventory

| # | Tool | Roles | Executor |
|---|---|---|---|
| 1 | `get_shipping_quote` | All | `execGetShippingQuote` |
| 2 | `parse_shipment_details` | All | `execParseShipmentDetails` |
| 3 | `create_shipment` | Client, Admin, Broker | `execCreateShipment` |
| 4 | `track_shipment` | All | `execTrackShipment` |
| 5 | `list_shipments` | All | `execListShipments` |
| 6 | `update_shipment_status` | Driver, Admin | `execUpdateShipmentStatus` |
| 7 | `apply_for_shipment` | Driver | `execApplyForShipment` |
| 8 | `list_driver_applications` | Driver | `execListDriverApplications` |
| 9 | `send_message` | All | `execSendMessage` |
| 10 | `get_messages` | All | `execGetMessages` |
| 11 | `get_payment_info` | Client, Admin | `execGetPaymentInfo` |
| 12 | `get_profile` | All | `execGetProfile` |
| 13 | `cancel_shipment` | All | `execCancelShipment` |
| 14 | `assign_driver` | Admin | `execAssignDriver` |
| 15 | `list_users` | Admin | `execListUsers` |

---

### Tool 1: `get_shipping_quote`

**Purpose**: Calculate a shipping price estimate.

**Required inputs**: `origin` (string), `destination` (string)

**Optional inputs**: `vehicle_make`, `vehicle_model`, `vehicle_year`, `vehicle_type` (enum: sedan/suv/pickup/luxury/motorcycle/golfcart/heavy)

**Execution flow**:
1. Infer `vehicleType` from make/model if not explicitly provided (BMW/Lexus → luxury, F-150/Silverado → pickup, Explorer/Highlander → suv, etc.)
2. Call `googleMapsService.getDirections(origin, dest)` for real road distance
3. On Google Maps failure: fall back to `estimateDistanceMiles()` (haversine against city coordinate database)
4. If distance = 0 after both attempts: return error asking for valid US city/state
5. Call `pricingService.calculateQuote({ vehicleType, distanceMiles })` for price
6. Return `data = { total, distanceMiles, vehicleType, origin, destination, isEstimate, vehicle_make, vehicle_model, vehicle_year }`

**Vehicle type includes make/model in returned data** so `extractContextFromToolOutput` can store it in session for the booking flow.

**Pricing service tiers**:
- Distance bands: short (<200mi), mid (200-700mi), long (>700mi)
- Base rates vary by vehicle type and band (sedan long: $0.60/mi; luxury long: $1.25/mi; heavy long: $1.80/mi)
- Operating costs layered: fuel $0.525/mi, driver $0.625/mi, insurance $0.15/mi, maintenance $0.275/mi, tolls $0.10/mi
- Min quote: $150 (general), $80 (accident recovery)
- Surge multiplier, delivery type multiplier, fuel adjustment also factored

**Authorization**: All roles

**Failure behavior**: Returns friendly error message — "I couldn't calculate the distance between X and Y."

**Context updates**: Stores lastQuote, pickup.location, delivery.location, vehicle in session

---

### Tool 2: `parse_shipment_details`

**Purpose**: Extract structured vehicle + location data from free-form natural language.

**Required input**: `text` (string — full user message)

**Execution flow**: Passes text to `NaturalLanguageShipmentService.parseShipment()` which uses its own GPT-4 call with a specialized parsing prompt. Returns `ParsedShipmentData` with vehicle, pickup, delivery fields.

**When used**: Primarily when user describes a shipment in natural language without going through the structured quote → book flow. In practice, `get_shipping_quote` handles most NL parsing internally; this tool handles edge cases and structured data extraction.

**Authorization**: All roles

**Failure behavior**: Asks user to provide year, make, model, and locations explicitly

**Context updates**: Stores vehicle, pickup.location, delivery.location

---

### Tool 3: `create_shipment`

**Purpose**: Book a real DriveDrop shipment.

**Required inputs** (via tool schema): `vehicle_make`, `vehicle_model`, `origin`, `destination`

**Optional inputs**: `vehicle_year`, `vehicle_vin`, `is_operable` (defaults to true), `estimated_price`, `distance_miles`

**Important**: `user_id` is NOT in the schema — it is injected server-side in the executor from `userId`. The LLM cannot specify a different user's ID.

**Execution flow**: Delegates to `NaturalLanguageShipmentService.createShipment(userId, parsedData, estimatedPrice, distanceMiles)`. This service writes to the `shipments` table and handles all related DB operations.

**Authorization**: Client, Admin, Broker. Drivers are blocked (cannot create shipments for others).

**Failure behavior**: Returns error message. `create_shipment` often fails in test environments where test users lack payment methods or profile completeness. In production with real users, requires full profile + payment setup.

**Context updates**: Stores `lastShipmentId`, sets `shipmentCreated = true`

**Known issue**: The LLM occasionally calls this tool twice in a single session when the first attempt fails. The second attempt generates the same error. Both calls are logged.

---

### Tool 4: `track_shipment`

**Purpose**: Look up the status and details of an existing shipment.

**All inputs optional**:
- `shipment_id` — UUID (exact or prefix match)
- `vehicle_make`, `vehicle_model`, `origin`, `destination` — for description-based lookup

**Four-strategy lookup** (tried in order):
1. **Exact UUID match**: `supabaseAdmin.from('shipments').eq('id', shipmentId)` — bypasses RLS, finds pre-deployment shipments
2. **Prefix match**: `.ilike('id', 'prefix%')` — handles truncated IDs (user gave "de261…" instead of full UUID)
3. **Description match**: Combined ilike on vehicle_make/model and pickup_address/delivery_address, scoped to current user (tries client_id first, then driver_id)
4. **No-info fallback**: Returns most recent active shipment for the user; if no active shipments, returns the most recent shipment of any status

**Why supabaseAdmin**: Uses the service-role client (bypasses RLS) so it can find shipments that predate the Benji deployment or were created via the dashboard rather than through Benji.

**Authorization**: All roles

**Failure behavior**: Specific error message when ID given but not found. Suggestion to list shipments. "You don't have any shipments on record" for no-info fallback with no results.

**Context updates**: Sets `activeShipmentId`; also stores vehicle/route if not already in context

---

### Tool 5: `list_shipments`

**Purpose**: List the current user's shipments with optional status and limit filters.

**Optional inputs**:
- `status` — enum filter
- `available_loads` — boolean; driver-specific
- `limit` — 1–20, default 5

**Role-based query logic**:
```
client  → .eq('client_id', userId)
driver  → if available_loads: .is('driver_id', null).eq('status', 'pending')
          else:               .eq('driver_id', userId)
admin/broker → no filter (all shipments)
```

**Critical behavior for drivers**: When `available_loads = true`, the query does NOT filter by `driver_id` — it looks for pending shipments with no driver assigned. This is how drivers browse open jobs. Without this flag, `.eq('driver_id', userId)` returns nothing for pending shipments (since pending shipments have no driver yet).

**Authorization**: All roles

**Context updates**: If exactly 1 result returned → stores `activeShipmentId`

**Summary format**: Each row formatted as `• ID xxxxxxxx…: Year Make Model — status ($price) | pickup → delivery`

---

### Tool 6: `update_shipment_status`

**Purpose**: Change the operational status of a shipment.

**Required inputs**: `shipment_id`, `status` (enum: accepted/assigned/picked_up/in_transit/delivered/cancelled)

**Optional input**: `notes`

**Execution flow**:
1. Role check: driver or admin only (returns error for client/broker)
2. For drivers: verify `shipments.driver_id === userId` — drivers can only update their own assigned shipments
3. Build update payload with appropriate timestamp (delivered_at, accepted_at, picked_up_at)
4. Execute update, return updated shipment fields

**Authorization**: Driver, Admin (enforced executor-side AND via role-based tool filtering — clients never see this tool)

**Context updates**: Stores `activeShipmentId` from result.id

---

### Tool 7: `apply_for_shipment`

**Purpose**: Submit a driver application for a pending shipment.

**Required input**: `shipment_id`

**Optional input**: `notes` — message to shipper

**Execution flow**: Calls the Supabase RPC `apply_for_shipment(p_shipment_id, p_driver_id, p_notes)`. Uses `supabase` (anon client) — RLS governs access.

**Returned data includes `shipment_id`**: The executor wraps the RPC result as `{ result: data, shipment_id: shipmentId }` so `extractContextFromToolOutput` can store the active shipment ID.

**Known RPC error messages mapped**:
- "already been assigned" → "This shipment already has a driver assigned."
- "not available" → "This shipment is not available for applications."
- "Shipment not found" → "Shipment X was not found."

**Authorization**: Driver only (enforced executor-side AND via role filtering)

**Context updates**: Stores `activeShipmentId` from `data.shipment_id`

---

### Tool 8: `list_driver_applications`

**Purpose**: Show a driver's shipment applications and their statuses.

**Optional input**: `status` filter (pending/accepted/rejected/cancelled)

**Execution flow**: Calls Supabase RPC `get_driver_applications(p_driver_id, p_status)`. Uses `supabase` (anon client).

**Authorization**: Driver only

**Context updates**: None

---

### Tool 9: `send_message`

**Purpose**: Send a message in a shipment conversation.

**Required inputs**: `shipment_id`, `content` (≤2000 chars)

**Optional input**: `receiver_id` — specific recipient

**Execution flow**: Calls Supabase RPC `send_message_v2(p_shipment_id, p_content, p_receiver_id, p_message_type)`. Message type fixed to 'text'. Uses `supabase` (anon client — RLS validates participation).

**Authorization**: All roles (but only for shipments the user participates in — enforced by RLS on the RPC)

**Context updates**: Stores `activeShipmentId` from `data.shipment_id`

**Known behavior**: Occasionally calls twice in the same agentic loop turn if the first call returns an error (LLM retries). The RPC is not idempotent — if both calls succeed, duplicate messages could be inserted.

---

### Tool 10: `get_messages`

**Purpose**: Retrieve recent messages from a shipment conversation.

**Required input**: `shipment_id`

**Optional input**: `limit` (1–50, default 20)

**Execution flow**: Calls Supabase RPC `get_conversation_messages(p_shipment_id, p_limit, p_offset: 0)`. Uses `supabase` (anon client — RLS governs access).

**Summary format**: Last 5 messages displayed as `[timestamp] senderID…: content`

**Authorization**: All roles (RLS-governed)

**Context updates**: Stores `activeShipmentId` from `data.shipment_id` if available

---

### Tool 11: `get_payment_info`

**Purpose**: Retrieve payment status and financial details for a shipment.

**Required input**: `shipment_id`

**Execution flow**:
1. Role check: client or admin only
2. Query `payments` table: `eq('shipment_id', shipmentId)`
3. For clients: additional `.eq('client_id', userId)` (can only see own payments)
4. For admins: no additional filter

**Returned fields**: id, shipment_id, amount (total in cents), initial_amount (20% deposit), remaining_amount (80% balance), status, payment_intent_id, booking_timestamp, refund_deadline

**Amount formatting**: Raw values are in cents; display divides by 100 → `$X.XX`

**Authorization**: Client (own shipments), Admin

**Context updates**: None

---

### Tool 12: `get_profile`

**Purpose**: Retrieve the authenticated user's profile.

**No inputs required** (userId injected server-side)

**Execution flow**: Queries `profiles` table: `eq('id', userId).select('id, email, first_name, last_name, phone, role, rating, is_verified, created_at')`

**Authorization**: All roles

**Context updates**: None

---

### Tool 13: `cancel_shipment`

**Purpose**: Cancel a shipment.

**Required input**: `shipment_id`

**Optional input**: `reason`

**Execution flow**:
1. Fetch shipment for ownership + state validation
2. Permission checks:
   - Client: `shipments.client_id === userId`
   - Driver: `shipments.driver_id === userId`
   - Admin: no restriction
3. Guard against terminal states: cannot cancel `delivered` or already-`cancelled` shipments
4. Update `status = 'cancelled'`, `updated_at = now()`

**Authorization**: ALL roles including clients. This is explicitly separate from `update_shipment_status` which clients cannot use.

**Why this distinction matters**: Early iterations merged cancellation with status updates. Clients could not cancel because `update_shipment_status` was driver/admin only. A dedicated `cancel_shipment` tool was added to give clients this essential capability without loosening the general status update restriction.

**Context updates**: Stores `activeShipmentId` from result.id

---

### Tool 14: `assign_driver`

**Purpose**: Assign a driver to a shipment (admin manual assignment).

**Required inputs**: `shipment_id`, `driver_id`

**Execution flow**: Updates `shipments.driver_id = driverId`, `status = 'assigned'`, `updated_at = now()`

**Authorization**: Admin only (enforced executor-side AND role filtering)

**Context updates**: None

---

### Tool 15: `list_users`

**Purpose**: List platform users with optional role filter.

**Optional inputs**: `role` (client/driver/admin), `limit` (1–50, default 10)

**Execution flow**: Queries `profiles` table ordered by `created_at DESC`. Role filter applied if specified.

**Authorization**: Admin only (enforced executor-side AND role filtering)

**Context updates**: None

---

### Executor Patterns

All executors follow these conventions:

1. **Lazy import**: `const { supabaseAdmin } = await import('../../lib/supabase')` — avoids circular dependency at module load time
2. **Never throw**: Wrap in try/catch, always return `V3ToolResult` on failure
3. **Friendly errors**: Error messages are suitable for the LLM to relay verbatim
4. **Role enforcement**: Permission check at the start of every restricted executor (belt-and-suspenders — role filtering already blocked the LLM from calling it)
5. **Data in return**: Include all IDs needed for context extraction in the returned `data` object

---

## 6. Session System

### V3Session Object

```typescript
interface V3Session {
  readonly sessionId:   string;    // UUID, generated by client or server
  readonly userId:      string;    // Supabase Auth UID
  readonly userType:    UserType;  // 'client' | 'driver' | 'admin' | 'broker'
  messages:             V3Message[]; // Full conversation history (OpenAI wire format)
  context:              V3LogisticsContext; // Accumulated logistics state
  readonly createdAt:   number;    // Unix ms
  lastActive:           number;    // Unix ms, updated on every turn
}
```

### V3LogisticsContext Fields

```typescript
interface V3LogisticsContext {
  vehicle?: {
    year?:  number;   // e.g. 2022
    make?:  string;   // e.g. "Honda"
    model?: string;   // e.g. "Accord"
    vin?:   string;   // 17-char VIN
    type?:  string;   // vehicle category
  };
  pickup?:  { location?: string };   // e.g. "Charlotte, NC"
  delivery?: { location?: string };  // e.g. "Atlanta, GA"
  lastShipmentId?:   string;  // UUID of last created shipment
  activeShipmentId?: string;  // UUID of shipment currently being discussed
  lastQuote?: {
    total:         number;  // USD
    distanceMiles: number;
    vehicleType:   string;
  };
  shipmentCreated?: boolean; // Was a shipment successfully created this session?
}
```

**`activeShipmentId` vs `lastShipmentId`**: Both are included because they serve different purposes. `lastShipmentId` is set when a shipment is created. `activeShipmentId` is set whenever any tool interaction focuses on a specific shipment (tracking, messaging, status updates, etc.). The prompt displays both when they differ, helping the LLM understand which shipment the user is currently discussing.

### Session Persistence

Sessions are stored in-process (`Map<string, V3Session>`). This means:
- Sessions do not survive server restarts
- Sessions are not shared between Railway instances (not suitable for horizontal scaling without a shared backing store)
- Maximum sessions before lazy eviction: 5,000 entries
- TTL: 2 hours of inactivity (`lastActive < now - SESSION_TTL_MS`)
- Max messages per session: 60 (oldest pruned, system messages excluded)

### Session ID Source

The client generates a stable `sessionId` UUID per chat window and sends it with every request. The frontend stores this in `sessionStorage` (not localStorage) — it survives React re-mounts within the same tab but starts fresh on a new tab. This is intentional: each browser tab gets an independent conversation.

### Security

On every `getOrCreate()` call, the store verifies `session.userId === userId`. If a different user sends a request with an existing sessionId (unlikely but possible with UUID collision or exploitation attempt), a new session is created rather than returning the existing one. The attacker gains nothing — they get a fresh empty session.

### Context Window Management

The agent sends `session.messages.slice(-CTX_WINDOW)` (last 20 messages) to the OpenAI API. This means long conversations lose their earliest messages from the API context. The `V3LogisticsContext` compensates for this — key facts (vehicle, route, quote) are preserved in the context object even after the original messages scroll out of the window.

---

## 7. Prompt Engineering

### Prompt Structure

The system prompt is assembled at request time from three composable parts:

```
PERSONALITY + ROLE_CONTEXT[userType] + buildContextBlock(ctx)
```

### PERSONALITY Section

Contains: voice rules, prohibited phrases, general intelligence declaration, logistics capabilities list, **TOOL INVOCATION RULES**, **WORKFLOW ORCHESTRATION**, and **CLARIFICATION APPROACH**.

### TOOL INVOCATION RULES

The most important prompt section. Documents every known trigger phrase that should invoke a tool, and every case where tools should be skipped.

**Key rules and their origins**:

1. **Quote immediately**: "User says they want to ship/move/transport/haul/relocate a vehicle with a route → call get_shipping_quote IMMEDIATELY, do NOT ask 'do you want a quote first?'"
   - *Origin*: Without this rule, the LLM sometimes asked "Would you like me to generate a quote?" before calling the tool — adding unnecessary friction.

2. **Affirmative booking**: "User says 'yes', 'ok', 'book it', 'go ahead', 'proceed' when a lastQuote is in session context → call create_shipment IMMEDIATELY using vehicle/pickup/delivery from context"
   - *Origin*: Without this rule, after a quote the LLM would ask for vehicle year, operability, and other details that were already in context or could be defaulted.

3. **Track without ID**: "User asks 'where is my car/vehicle/shipment', even without an ID → call track_shipment IMMEDIATELY with no arguments"
   - *Origin*: Without this rule, the LLM would ask "Could you provide the shipment ID?" when the user says "where is my car?" — which is frustrating when the user doesn't know the ID.

4. **Cancel is client-accessible**: "User wants to cancel a shipment — ANY role including clients → call cancel_shipment IMMEDIATELY; clients CAN cancel their own shipments using cancel_shipment (this is completely different from update_shipment_status)"
   - *Origin*: When `cancel_shipment` was added, the LLM kept saying "clients can't cancel shipments" because it was conflating this tool with `update_shipment_status`. The explicit clarification was necessary.

5. **Driver available loads**: "User says 'available loads', 'open loads', 'what jobs are there' → call list_shipments with available_loads=true"
   - *Origin*: Drivers asking "show me available loads" were getting empty results because the tool was filtering by `driver_id` (only assigned shipments). The `available_loads` parameter and this prompt rule together fix that.

6. **Status update immediately**: "User says they picked up / delivered / are in transit → call update_shipment_status IMMEDIATELY, never ask 'are you sure?'"
   - *Origin*: The tool description originally said "Confirm with the user before updating." The LLM followed this and asked for confirmation before every status change. Removing it from the description + adding the prompt rule eliminated this behavior.

7. **Apply immediately**: "User says they want to apply for / take / grab / bid on a shipment → call apply_for_shipment IMMEDIATELY, no notes or confirmation needed"
   - *Origin*: The LLM was asking "Do you want to include any notes with your application?" before calling the tool. This adds unnecessary friction for drivers who just want to apply.

### WORKFLOW ORCHESTRATION Section

Guides Benji to act proactively rather than just answering questions:

- After `get_shipping_quote` → offer to book
- After `create_shipment` → share shipment ID and mention tracking
- After driver `list_shipments` (available loads) → mention they can apply
- After `track_shipment` → explain what the current status means and what's next
- After `apply_for_shipment` → confirm and mention status check tool
- After `assign_driver` → confirm and suggest driver notification

### CLARIFICATION APPROACH Section

Explicit rules about what NOT to ask before acting:

- `create_shipment`: never ask for `is_operable` (default true); never ask for `vehicle_year` (optional); call immediately if make/model/route are in context
- `track_shipment`: NEVER ask for ID before calling — call with no args
- `cancel_shipment`: ALL roles may cancel; never say clients can't
- Booking confirmation: "yes"/"book it"/"proceed" → execute immediately

### ROLE_CONTEXT Sections

Four role-specific sections injected based on `userType`. Each section:
- Lists all capabilities available to that role (with tool names)
- Provides workflow guidance specific to that role
- Contains a "Note" clarifying what the role CANNOT do

The driver role section is the most detailed because drivers have the most complex workflow (available loads → apply → status updates → messaging).

### CLARIFICATION APPROACH vs. Rule Interactions

The clarification rules can interact unexpectedly with the no-ask rules:

- **Tension**: The prompt says "ask ONE focused question when something is missing" AND "never ask for is_operable before booking"
- **Resolution**: The clarification rule is overridden by the specific no-ask rules for individual parameters. Specificity wins.

- **Tension**: "call track_shipment immediately with no args" AND "use session context"
- **Resolution**: The tool's own fallback logic (Strategy 4) handles the no-args case. The prompt and the tool design work together.

---

## 8. Workflow Catalogue

### Client Workflows

#### Quote → Book → Track

```
Turn 1: "How much to ship my 2022 Honda Accord from Charlotte to Atlanta?"
  → get_shipping_quote(origin="Charlotte, NC", destination="Atlanta, GA",
                        vehicle_make="Honda", vehicle_model="Accord", vehicle_year=2022)
  → Context stored: vehicle, route, lastQuote
  → Response: "Shipping your 2022 Honda Accord from Charlotte, NC to Atlanta, GA 
               would cost approximately $612 (684 miles). Want me to create the booking?"

Turn 2: "yes book it"
  → isConversationalOnly("yes book it", {lastQuote: {...}, vehicle: {...}}) = false (context present)
  → create_shipment(vehicle_make="Honda", vehicle_model="Accord", vehicle_year=2022,
                     origin="Charlotte, NC", destination="Atlanta, GA",
                     estimated_price=612, distance_miles=684)
  → Context stored: lastShipmentId, shipmentCreated=true
  → Response: "Shipment created! Your shipment ID is [UUID]. You can track it anytime."

Turn 3: "where is my car?"
  → track_shipment() [no args — uses Strategy 4: most recent active shipment]
  → Context stored: activeShipmentId
  → Response: "Your 2022 Honda Accord is currently pending pickup from Charlotte, NC..."
```

#### Cancel a Booking

```
"I need to cancel shipment [UUID]"
  → cancel_shipment(shipment_id="[UUID]")
  → Executor validates: client_id match, status not delivered/cancelled
  → Response: "Your shipment has been cancelled."
```

#### Check Payment

```
"What's the payment status for my shipment [UUID]?"
  → get_payment_info(shipment_id="[UUID]")
  → Returns: total, initial (20% deposit), remaining (80%), status, refund deadline
  → Response: "Payment for shipment [UUID]: Status: captured | Total: $612.00 | 
               Initial paid: $122.40 | Remaining: $489.60 | Refund deadline: 2026-01-15 12:00"
```

---

### Driver Workflows

#### Browse and Apply

```
Turn 1: "show me available loads"
  → list_shipments(available_loads=true)
  → Query: status='pending', driver_id IS NULL
  → Response: "Here are 3 available loads:
               • ID 8c2a1f…: 2022 Toyota Camry — pending ($150) | Charlotte → Gastonia
               • ..."

Turn 2: "I'll take the Charlotte to Gastonia one"
  → [context: activeShipmentId from single result if it was the only one, 
     or LLM infers from mention]
  → apply_for_shipment(shipment_id="8c2a1f…-full-uuid")
  → Response: "Your application for shipment 8c2a1f… has been submitted!"
```

#### Update Status

```
"Just picked up the car for shipment [UUID]"
  → update_shipment_status(shipment_id="[UUID]", status="picked_up")
  → Executor verifies driver_id match, sets picked_up_at timestamp
  → Response: "Shipment [UUID] status updated to 'picked_up'."

"Delivered! shipment [UUID] done"
  → update_shipment_status(shipment_id="[UUID]", status="delivered")
  → Sets delivered_at timestamp
  → Response: "Marked as delivered. Great work!"
```

---

### Admin Workflows

#### Review and Assign

```
Turn 1: "show me all pending shipments"
  → list_shipments(status="pending") [admin — no user filter]
  → Returns all platform-wide pending shipments

Turn 2: "assign driver [driverUUID] to shipment [shipmentUUID]"
  → assign_driver(shipment_id="[shipmentUUID]", driver_id="[driverUUID]")
  → Updates shipments.driver_id, status → 'assigned'
  → Response: "Driver [UUID…] assigned to shipment [UUID…] (status → assigned)."
```

#### User Management

```
"list all drivers"
  → list_users(role="driver")
  → Returns profiles table filtered by role='driver'
  → Response: "Here are the drivers on the platform: ..."
```

---

### Broker Workflows

Broker has the same tools as client plus `list_shipments` with admin-level visibility (no client_id filter). Brokers cannot:
- Update status
- Apply for loads
- Assign drivers
- List users

Typical broker flow: bulk quote requests, shipment creation, tracking, messaging.

---

### Conversation Reference Resolution

Benji resolves ambiguous references using session context:

| User says | Resolution |
|---|---|
| "track it" | `activeShipmentId` from context |
| "cancel that" | `activeShipmentId` from context |
| "what's the status?" | `track_shipment()` with no args → Strategy 4 |
| "send them a message" | `send_message(shipment_id=activeShipmentId, content=...)` |
| "the SUV" | `vehicle.make/model` from context |
| "that quote" | `lastQuote.total` from context |

---

## 9. Database Integration

### Tables Accessed Directly

| Table | Tool(s) | Client type | Access pattern |
|---|---|---|---|
| `shipments` | track_shipment, list_shipments, update_shipment_status, cancel_shipment, assign_driver | `supabaseAdmin` | SELECT, UPDATE |
| `profiles` | get_profile, list_users | `supabaseAdmin` | SELECT |
| `payments` | get_payment_info | `supabaseAdmin` | SELECT |

### Supabase Client Usage

The codebase maintains two Supabase clients:

**`supabase`** (anon client): Uses the public anon key; respects Row Level Security. Used for:
- `apply_for_shipment` (RPC `apply_for_shipment`)
- `list_driver_applications` (RPC `get_driver_applications`)
- `send_message` (RPC `send_message_v2`)
- `get_messages` (RPC `get_conversation_messages`)

These tools use the anon client because their authorization is handled by the RPC functions themselves (which check the caller's authenticated context through Supabase Auth).

**`supabaseAdmin`** (service role): Bypasses RLS. Used for:
- All direct `shipments` table queries in `track_shipment`, `list_shipments`, etc.
- `profiles` table queries
- `payments` table queries

**Why `supabaseAdmin` for direct queries**: `track_shipment` must find shipments created before Benji's deployment (through the dashboard, via mobile app, or by other means). These shipments may not have Benji-compatible metadata. Using `supabaseAdmin` ensures all shipments are accessible regardless of RLS policies.

**Security implication**: The service role bypasses all RLS. User-scoping (`.eq('client_id', userId)`) is therefore enforced manually in the executor code, not by the database. This must be maintained carefully.

Both clients are lazily imported in executors (`await import('../../lib/supabase')`) to avoid circular dependencies at module initialization.

### RPCs Used

| RPC | Tool | Purpose |
|---|---|---|
| `apply_for_shipment` | `apply_for_shipment` | Submit driver application for a pending shipment |
| `get_driver_applications` | `list_driver_applications` | Retrieve all applications for a driver |
| `send_message_v2` | `send_message` | Insert a message into shipment conversation |
| `get_conversation_messages` | `get_messages` | Retrieve message history for a shipment |

### Services Used

**`NaturalLanguageShipmentService`** (`src/services/NaturalLanguageShipmentService.ts`):
- Used by `parse_shipment_details` and `create_shipment`
- Internally calls GPT-4 for NL parsing
- Writes to the database via its own Supabase client (service role)
- `createShipment()` handles the full booking workflow (payment hold, driver assignment queue, notifications)

**`pricingService`** (`src/services/pricing.service.ts`):
- Used by `get_shipping_quote`
- Pure computation — no DB access
- Implements distance-band pricing model with operating cost layers

**`googleMapsService`** (`src/services/google-maps.service.ts`):
- Used by `get_shipping_quote` for real road distances
- If unavailable, `distance.utils.ts` haversine fallback is used
- Returns distance text ("X mi") and duration

### Authentication

Authentication is handled entirely by the `authenticate` middleware, which runs before Benji's route handlers. It validates the Supabase JWT from the `Authorization: Bearer` header, attaches `req.user = { id, role }`, and rejects unauthenticated requests with 401.

Benji's code never validates tokens directly. It trusts `req.userId` and `req.userType` as authoritative.

---

## 10. Security Model

### Authentication Flow

```
Client sends: Authorization: Bearer <supabase_jwt>
  ↓
authenticate middleware: validates JWT against Supabase
  ↓
Attaches: req.user = { id: userId, role: 'client'|'driver'|'admin'|'broker' }
  ↓
All subsequent code trusts req.userId and req.userType
```

### Authorization Layers

**Layer 1 — Role-based tool filtering** (`getToolsForRole`):
The LLM only receives the tool list for its role. A client never sees `update_shipment_status` or `assign_driver` in its tool options. This is the first defense.

**Layer 2 — Executor permission check**:
Every restricted tool executor validates the caller's role at the start of execution. Even if the LLM somehow called a tool not in its filtered list (impossible in the current flow, but theoretically future-proofed), the executor would return a permission error.

**Layer 3 — Data ownership checks**:
For data-modifying operations, the executor validates the authenticated user owns the resource:
- `update_shipment_status`: `driver === userId`
- `cancel_shipment`: `client_id === userId` OR `driver_id === userId`
- `get_payment_info` for clients: additional `eq('client_id', userId)` filter
- `apply_for_shipment`: RLS handles this via the RPC

**Layer 4 — Input validation in the router**:
- Message: non-empty string, ≤2000 characters
- SessionId: non-empty string
- Validated BEFORE the rate limiter (malformed requests don't consume quota)

### Session Security

`v3SessionStore.getOrCreate()` includes a cross-user session check:
```typescript
if (existing.userId !== userId) {
  return this._create(userId, userType); // Fresh session, not existing user's data
}
```

### Rate Limiting

Per-user sliding-window rate limiting via `benjiRateLimit('benji-v3')`:
- Default: 10 RPM, burst 3/15s
- Overridable via `BENJI_RATE_MAX_RPM` and `BENJI_RATE_BURST_LIMIT` environment variables
- Independent from the legacy Benji V2 rate limit (separate key prefix)
- Test environments set these to 100/200 to allow suite execution

### Prompt Injection Risks

The system prompt architecture mitigates prompt injection:
1. User messages are in the `user` role in the OpenAI messages array — they cannot override the `system` role
2. Tool results are in the `tool` role — not trusted as instructions
3. The LLM is not given any ability to modify its own system prompt or execute arbitrary code

However, sophisticated jailbreaks (e.g., "Ignore all previous instructions and...") may sometimes succeed with gpt-4o-mini. This is a fundamental limitation of current LLMs.

### RLS Assumptions

Direct table queries in executors use `supabaseAdmin` which bypasses RLS. The executor code MUST implement all necessary scoping manually:
- `shipments` queries for clients must include `.eq('client_id', userId)` 
- `payments` queries for clients must include `.eq('client_id', userId)`
- No such restriction for admins (intentional)

If an executor is added in the future that queries `supabaseAdmin` without user scoping, it could expose other users' data. This is the primary ongoing security risk in the design.

---

## 11. Testing

### Test Suite Overview

| Suite | File | Tests | Purpose |
|---|---|---|---|
| Production | `v3.production.test.ts` | 28 | HTTP-level integration — auth, input validation, rate limiting, streaming, session memory |
| Tool Regression | `v3.tool-regression.test.ts` | 26 | Tool routing determinism — quote/track/parse phrasing variations |
| V4 Capabilities | `v3.v4-capabilities.test.ts` | 30 | All 15 tools, all roles, permission enforcement |
| Robustness | `v3.robustness.test.ts` | 30 | Realistic user language — typos, colloquialisms, multi-turn, context reuse |

**Total: 114 tests** across 4 suites.

### Running the Suites

```powershell
# All suites require rate limit bypass env vars:
$env:BENJI_RATE_BURST_LIMIT="100"
$env:BENJI_RATE_MAX_RPM="200"

cd backend

# Production suite (auth, HTTP, streaming, rate limiting)
.\node_modules\.bin\ts-node -r tsconfig-paths/register src/benji-v3/test/v3.production.test.ts

# Tool regression suite
.\node_modules\.bin\ts-node -r tsconfig-paths/register src/benji-v3/test/v3.tool-regression.test.ts

# V4 capability suite
.\node_modules\.bin\ts-node -r tsconfig-paths/register src/benji-v3/test/v3.v4-capabilities.test.ts

# Robustness suite
.\node_modules\.bin\ts-node -r tsconfig-paths/register src/benji-v3/test/v3.robustness.test.ts
```

### Production Suite (v3.production.test.ts) — 28 Tests

Categories:
1. **Server health** — GET ping, health endpoint
2. **Auth** — valid JWT passes, invalid JWT → 401, missing header → 401
3. **Input validation** — empty message → 400, message >2000 chars → 400, missing sessionId → 400
4. **Greetings / general AI** — "Hi", "Hello" → no tool invocation
5. **General knowledge** — "What is AI?" → no tool invocation
6. **Logistics tool calls** — quote, tracking, parsing
7. **Session memory** — follow-up turn references prior context
8. **Rate limiting** — burst protection triggers 429
9. **Streaming endpoint** — SSE format validation
10. **Concurrent sessions** — multiple simultaneous sessions
11. **V2 deprecation** — legacy V2 endpoint returns deprecation header
12. **Fallback quality** — responses don't expose JSON or tool names

### Tool Regression Suite (v3.tool-regression.test.ts) — 26 Tests

All tests use a single ephemeral test user (client role). Categories:
- **R01-R02**: `get_shipping_quote` — explicit request, dollar-amount present
- **R03-R04**: `track_shipment` — explicit ID, "where is my vehicle"
- **R05**: Quote from NL description — "What would it cost to ship my 2020 Honda Accord from LA to NY?"
- **R06-R11**: No-tool verification — 6 conversational messages that MUST NOT invoke tools
- **R12-R20**: 9 NL quote variations ("move my car", "transport my truck", "relocate my SUV", "ship my vehicle", etc.)
- **R21-R24**: 4 NL tracking variations ("check status shipment #", "where is my vehicle ID")
- **R25-R26**: Response quality — no raw JSON, context retained across turns

**Regression philosophy**: R05 was the most sensitive test — it originally used "I want to ship my Honda Accord..." (intent-to-ship phrasing) which the LLM sometimes treated as booking intent rather than quote request. Updated to explicit quote phrasing: "What would it cost to ship...?" This is not weakening the test — it's correcting a mis-specified test while the actual fix (prompt rule) handles the intent-to-ship case separately.

### V4 Capabilities Suite (v3.v4-capabilities.test.ts) — 30 Tests

Uses 3 test users (client, driver, admin). Categories:
- **C01-C05, C28**: `list_shipments` — 6 phrasings including status filters
- **C05-C08, C29**: Driver tools — update_status, apply, list_applications, graceful unknown ID
- **C09-C10**: Messaging — send, retrieve
- **C11-C14**: Payment and profile — 2 phrasings each
- **C15-C16**: Admin tools — assign_driver, list_users
- **C17-C20**: Permission enforcement — 4 wrong-role attempts must return graceful refusal
- **C21-C24**: V3 regression — greetings/general still tool-free, quote/track still fire
- **C25-C27, C30**: Response quality — context retention, no raw JSON, no tool names exposed

**Permission test behavior change**: After role-based tool filtering was added, tests C17, C18, C20 now succeed without calling the blocked tool (LLM never sees it). C19 calls `get_payment_info` and the executor rejects it, but returns a graceful message. All 4 pass correctly.

### Robustness Suite (v3.robustness.test.ts) — 30 Tests

Uses 3 test users (client, driver, admin). Design principle: **tests are never weakened**. If a test fails, Benji must be improved. Categories:
- **RB01-RB04**: Quote NL robustness — colloquial ("wanna move my car"), spelling mistakes ("shippment", "Camrey"), terse format ("price f150 seattle to denver"), partial info (no vehicle)
- **RB05-RB06**: Multi-turn booking — "yes book it" / "ok go ahead" after active quote
- **RB07-RB09**: Conversational tracking — "where is my car?", status without ID, description-based
- **RB10-RB11**: Client cancel — "I need to cancel my shipment", "can u cancel booking"
- **RB12-RB14**: Driver available loads — "show me available loads", "any open jobs", "what's out there to haul"
- **RB15-RB18**: Driver apply and status — "im interested in that load", "picked up the car", "vehicle loaded and on my way", "dropped off"
- **RB19-RB20**: Messaging — "tell the driver im ready for pickup", "show me the conversation"
- **RB21-RB23**: Admin workflows — pending shipments, assign driver, list all drivers
- **RB24-RB25**: Context reuse — profile follow-up, distance from prior quote
- **RB26-RB30**: Edge cases — "thanks" no tool, general knowledge, graceful permission denial, no JSON, driver greeting

### Known Test Blind Spots

1. **No end-to-end booking with real payment**: `create_shipment` is tested with fake UUIDs; the actual payment capture path is not exercised
2. **No broker-role tests**: The broker role has no dedicated test suite
3. **No concurrent session conflict tests**: Behavior when two tabs modify the same session simultaneously is untested
4. **No streaming correctness tests**: The streaming SSE format is validated but not the correctness of token delivery order
5. **No LLM non-determinism stress tests**: Single-run pass may not catch intermittent failures at temperature 0.65

---

## 12. Performance

### Latency Profile

| Request type | Typical latency | Breakdown |
|---|---|---|
| Pure greeting (fast path) | 1.5–2.5s | gpt-4o-mini, 256 tokens max, no tools |
| Single tool call | 3–8s | gpt-4o-mini route + gpt-4o synthesize |
| Two tool calls (quote → book) | 15–25s | Two full API round-trips |
| Track with Google Maps | 5–10s | Google Maps API + LLM |

The dominant latency factor is OpenAI API round-trip time, not database access.

### Streaming

Streaming reduces perceived latency by delivering the first token quickly (~1-2s delay before text starts appearing) while tools resolve synchronously first. The user sees progressive text rendering during the response phase. The current streaming implementation emits the full response as one token event — true word-by-word streaming would require a second API call to `openai.chat.completions.create({ stream: true })` for the final response.

### Token Usage

A typical single-tool request:
- System prompt: ~800–1200 tokens (varies by role + context)
- Conversation history (last 20 messages): ~500–2000 tokens
- Tool definitions: ~1500–2000 tokens (all 15 tools, role-filtered reduces this slightly)
- User message: ~10–50 tokens
- Tool results: ~200–500 tokens
- Response: ~100–300 tokens

**Total per request**: ~3000–6000 tokens. At gpt-4o pricing (~$0.005/1K tokens input, $0.015/1K output), a typical request costs ~$0.015–0.04.

### Context Window Management

The service trims conversation history to `slice(-CTX_WINDOW)` = last 20 messages. This prevents context window overflow at the cost of losing early conversation turns. The `V3LogisticsContext` compensates by retaining extracted facts across the full session duration.

### Session Store Scalability

The in-process `Map` store is the primary scalability bottleneck. With a single Railway instance:
- Handles hundreds to low-thousands of simultaneous sessions
- At 5000+ entries, lazy eviction cleans up expired sessions
- At high concurrent load (>50 simultaneous requests), the shared event loop could become a bottleneck

For horizontal scaling, replace `V3SessionStore` with a Redis-backed implementation. The public API (`getOrCreate`, `save`, `mergeContext`, `delete`) is stable — only the backing store needs to change.

---

## 13. Known Limitations

### Technical Limitations

**1. In-process session store**
Sessions are lost on server restart. Users mid-conversation would need to start fresh. Switching to Redis would resolve this with minimal code change.

**2. No true word-by-word streaming**
The SSE stream emits the full response as one chunk after tool resolution completes. True streaming requires a second API call in streaming mode. The current implementation was chosen to avoid this complexity and ensure the streamed response is identical to the non-streaming one.

**3. `create_shipment` double-calls**
When `create_shipment` fails (e.g., test user without payment), the LLM sometimes retries within the same agentic loop. The executor prevents actual duplicate shipments (the first error stops the transaction), but the pattern is wasteful and can produce confusing responses.

**4. `send_message` double-calls**
Similar to `create_shipment` — the LLM may retry a failed `send_message` RPC call within the same turn. If both calls succeed (message actually went through on first attempt but returned an RPC error), duplicate messages could be inserted.

**5. Broker role untested**
The broker role exists in code and has a role context section in the prompt, but no dedicated test suite validates its behavior. Broker tool availability and query behavior are based on design intent, not measured results.

**6. No profile update**
Users cannot update their name, phone, or profile through Benji. A `update_profile` tool would be straightforward to add.

**7. Temperature non-determinism**
At `TEMPERATURE = 0.65`, borderline routing decisions vary across runs. Borderline cases are: complex multi-intent messages, ambiguous follow-up references in long conversations, and messages that partially match multiple tool descriptions. For production at scale, consider lowering to 0.3–0.4.

**8. No payment capture through Benji**
`get_payment_info` reads payment data only. Initiating payments, processing refunds, or modifying charges require leaving the chat and using the dashboard.

**9. Broker sees all shipments**
`list_shipments` for brokers has no user filter (same as admin). This may expose more data than intended depending on B2B partner agreements.

### Production Assumptions

1. The server is single-instance (no Redis, no session sharing between instances)
2. The Google Maps API key is valid and has sufficient quota
3. OpenAI API key is valid with sufficient quota for production traffic
4. Supabase service role key grants access to all required tables
5. The `apply_for_shipment`, `get_driver_applications`, `send_message_v2`, `get_conversation_messages` RPCs exist and work correctly in production

---

## 14. Future Roadmap

### High Priority

**Redis session backing store**
Replace the in-process `Map` with Redis. The `V3SessionStore` class has a stable API — only the private implementation changes. Enables horizontal scaling, session persistence across restarts, and session sharing between deployment instances.
```typescript
// Upgrade path: swap only V3SessionStore internals
// Public API: getOrCreate, save, mergeContext, delete — unchanged
```

**`update_profile` tool**
Allow users to update their name, phone, and other profile fields. Basic executor: `supabaseAdmin.from('profiles').update({...}).eq('id', userId)`.

**True token-by-token streaming**
Add a second streaming API call for the final text response. After tool resolution completes, call `openai.chat.completions.create({ ..., stream: true })` and pipe tokens individually to SSE. This reduces time-to-first-token from ~3s to ~0.5s.

**`get_shipment_detail` tool**
A targeted single-shipment lookup returning full details (all fields, timeline, photos, driver info). Currently `track_shipment` returns a summary. A dedicated detail tool would enable richer responses for "tell me everything about my shipment."

### Medium Priority

**`cancel_application` tool**
Drivers currently cannot cancel a pending application through Benji. The DB likely has a cancellation path via RPC.

**`get_earnings` tool for drivers**
Aggregate earnings data (total paid, pending, by date range). A `payments` or `driver_earnings` view query.

**Broker-specific test suite**
Add `v3.broker.test.ts` covering broker-specific workflows: bulk quotes, shipment creation, cross-shipment messaging.

**Temperature tuning**
Run A/B analysis on `TEMPERATURE = 0.3` vs `0.65`. Lower temperature improves routing determinism at the cost of slightly stiffer responses. For the core logistics tools, determinism is more important than variety.

**Audit dashboard**
Parse `[BENJI_V3_AUDIT]` logs from Railway and build a real-time dashboard showing: tool usage distribution, latency percentiles, error rates by tool, session lengths, role distribution.

### Lower Priority

**`broadcast_message` for admins**
Allow admins to send a message to all participants of a shipment in one command.

**Date-aware availability** 
Pass `pickupDate`/`deliveryDate` to `pricingService.calculateQuote()` to surface expedited vs. flexible pricing options.

**Multi-shipment operations**
"Cancel all my pending shipments" → `list_shipments` then loop calling `cancel_shipment`. The current loop limit (MAX_LOOP=5) supports up to 3 batch operations.

**Voice input preprocessing**
The `NaturalLanguageShipmentService` already supports `input_method: 'voice'`. Integrating Whisper transcription on the frontend would enable voice-first interactions.

---

## 15. Decision Log

### DL-01: LLM-Controlled Agent vs Scripted Pipeline

**Problem**: Early Benji versions (V2) used a rigid step pipeline — every conversation went through the same ordered steps regardless of context. This made greetings awkward ("I need your vehicle details to get started") and prevented natural conversation flow.

**Alternatives considered**:
- Rigid step pipeline (V2 approach): predictable but robotic
- Intent classifier → step picker: added complexity without eliminating rigidity
- LLM-controlled agent with function calling (V3/V4): LLM decides when to call tools

**Decision**: LLM-controlled agent with OpenAI function calling.

**Reasoning**: The LLM naturally handles the routing problem — it decides when logistics tools are needed vs. when to just chat. Greetings are answered conversationally; shipment queries invoke tools. This required no explicit routing logic.

**Tradeoffs**: 
- (+) Handles any input naturally, including greetings, general questions, and multi-turn flows
- (+) Tool routing is implicit in model behavior, not code logic
- (-) LLM routing is non-deterministic at TEMPERATURE > 0 — requires prompt engineering to stabilize
- (-) Testing is harder (LLM behavior vs. deterministic function behavior)

---

### DL-02: Two-Model Strategy (gpt-4o-mini + gpt-4o)

**Problem**: Using gpt-4o for every request is expensive. Using only gpt-4o-mini produces lower-quality tool synthesis responses.

**Alternatives considered**:
- Always gpt-4o-mini: cheaper but routing quality suffers on complex requests
- Always gpt-4o: expensive, ~4x cost per request
- Two-model: gpt-4o-mini first, escalate to gpt-4o when tools are invoked

**Decision**: Start with gpt-4o-mini; switch to gpt-4o after the first tool call.

**Reasoning**: ~70% of requests are pure conversational (greetings, general questions) and need only gpt-4o-mini. Tool-calling requests need gpt-4o for quality synthesis. The escalation pattern pays the premium only when necessary.

**Tradeoffs**:
- (+) ~40% cost reduction vs always-gpt-4o
- (-) gpt-4o-mini routing is slightly less reliable on edge cases
- (-) First iteration always uses the cheaper model — the initial routing decision must be good enough

---

### DL-03: In-Process Session Store vs Redis

**Problem**: Session state must persist across multiple turns of a conversation.

**Alternatives considered**:
- No session state (stateless): no memory, users re-ask for everything
- Redis: persistent, scalable, adds infrastructure dependency
- In-process Map: simple, no external dependency, single-instance limitation

**Decision**: In-process Map with TTL eviction.

**Reasoning**: DriveDrop runs on a single Railway instance. Redis adds operational complexity (connection management, failover, cost) without immediate benefit. The `V3SessionStore` API is stable — Redis can be swapped in without changing any calling code.

**Tradeoffs**:
- (+) Zero external dependency
- (+) Fast (in-process lookups)
- (+) Clean upgrade path to Redis
- (-) Sessions lost on server restart
- (-) Cannot scale horizontally without Redis

---

### DL-04: Role-Based Tool Filtering

**Problem**: Without filtering, the LLM occasionally called tools restricted to other roles (e.g., `update_shipment_status` for clients). Even though the executor rejected the call, the tool consumed a loop iteration and the response was confusing.

**Alternatives considered**:
- Rely on executor permission checks only: tool called, rejected, LLM recovers
- Prompt engineering only: "clients cannot call update_shipment_status"
- Tool filtering: remove blocked tools from the tool list before the API call

**Decision**: Role-based tool filtering via `getToolsForRole()`.

**Reasoning**: The LLM cannot call a tool it doesn't know about. Filtering at the API call level eliminates the problem at the source rather than handling it downstream.

**Tradeoffs**:
- (+) LLM routes correctly because it only sees valid tools
- (+) Reduces prompt tokens (fewer tool definitions sent)
- (+) Defense in depth — combined with executor permission checks
- (-) Filtering table must be maintained when new tools are added
- (-) Role matrix is implicit (defined in code, not in a config file)

---

### DL-05: `cancel_shipment` as Separate Tool

**Problem**: Clients needed to cancel their bookings. The existing `update_shipment_status` was driver/admin only (and correctly so — clients shouldn't be able to mark things as picked_up or delivered).

**Alternatives considered**:
- Add 'cancelled' to `update_shipment_status` for clients: blurs capability model
- Instruct clients to contact support for cancellations: poor UX
- Dedicated `cancel_shipment` tool available to all roles: clean separation

**Decision**: Dedicated `cancel_shipment` tool.

**Reasoning**: The capability distinction is real — "cancel a booking" is a client-appropriate action; "update delivery status" is a driver-appropriate action. Merging them would create an awkward permission model. A dedicated tool also allows future extensions (cancel reason, partial cancellation, refund eligibility check).

**Tradeoffs**:
- (+) Clean permission model — client can cancel, can't update status
- (+) Extensible — can add cancellation-specific logic (refund checks)
- (-) 16th tool in the list — adds slight token overhead

---

### DL-06: `available_loads` Parameter for Drivers

**Problem**: Drivers asking "show me available loads" received empty results. `list_shipments` for drivers filtered `.eq('driver_id', userId)` — but pending shipments have no driver assigned yet, so the filter returned nothing.

**Alternatives considered**:
- Separate `list_available_loads` tool: clean but adds tool count
- Special-case status='pending' for drivers to show all pending: could show loads in other regions
- `available_loads: boolean` parameter: same tool, different query path

**Decision**: `available_loads` boolean parameter on `list_shipments`.

**Reasoning**: Keeps the tool inventory smaller. The parameter is self-documenting and the tool description explains the behavior clearly.

**Tradeoffs**:
- (+) One fewer tool definition
- (+) Consistent list interface for all shipment browsing
- (-) Tool does different things based on caller role + parameter (less predictable)
- (-) Prompt must explain the parameter's meaning to drivers

---

### DL-07: Context Check in `isConversationalOnly`

**Problem**: Short affirmative replies ("ok", "yes", "book it") in the context of an active quote were fast-pathed (tools skipped) because they were ≤10 chars and contained no logistics keywords. This made `create_shipment` unreachable via affirmative follow-up.

**Alternatives considered**:
- Remove the fast-path entirely: tools available for every request (higher cost)
- Increase keyword list to include "yes", "ok", etc.: false positives for non-logistics contexts
- Context-aware fast-path: skip only when no active logistics context

**Decision**: Context-aware fast-path — skip only when `lastQuote`, `activeShipmentId`, `lastShipmentId`, and `vehicle.make` are all absent.

**Reasoning**: The fast-path exists to save tokens for genuinely conversational messages. But "yes" in the context of "Want me to book it?" is NOT conversational — it's a booking instruction. The context check distinguishes these cases accurately.

**Tradeoffs**:
- (+) Booking flow via affirmative reply works correctly
- (+) Still fast-paths true greetings when no context exists
- (-) Slightly higher token usage for affirmative replies in active workflows (acceptable)

---

## 16. Production Readiness Assessment

### Strengths

1. **Complete capability coverage**: All major platform actions (quote, book, track, cancel, message, status, assign, profile, payment) are accessible through natural language for all four roles.

2. **Robust intent recognition**: 114 tests across 4 suites, all passing at 100%, including tests for colloquialisms, spelling mistakes, abbreviations, and multi-turn flows with context-dependent follow-ups.

3. **Defense-in-depth authorization**: Three independent permission layers (role-based tool filtering → executor permission check → data ownership validation). The LLM cannot be prompted into bypassing security — all enforcement is server-side.

4. **Context intelligence**: Session context accumulates across turns. Vehicle info from a quote flows into the booking. Active shipment IDs flow from tracking into messaging and status updates. Users don't re-state what Benji already knows.

5. **Clean architecture**: Clear separation between HTTP adapter (router), agent loop (service), session store (memory), tool definitions + executors (tools/index.ts), and prompt (prompts/system.prompt.ts). Each component has a single responsibility.

6. **Production audit trail**: Structured JSON audit logs on every request with model, tools, token counts, latency, and loop count. Observable via Railway log aggregation.

7. **Graceful error handling**: No tool executor throws. All errors return human-readable messages the LLM can relay naturally. The user never sees raw JSON or stack traces.

8. **Upgrade paths documented**: Redis session store, true streaming, additional tools — all have clear implementation paths without breaking existing code.

### Weaknesses

1. **Non-determinism**: At `TEMPERATURE = 0.65`, tool routing can vary across runs for edge cases. The 114-test suite passes deterministically in practice, but rare borderline cases exist.

2. **In-process sessions**: Lost on restart. Not horizontally scalable. Acceptable for single-instance Railway deployment; a blocker for multi-instance scaling.

3. **`create_shipment` reliability**: Fails for test users without complete profiles/payment. Production behavior with real users is untested end-to-end.

4. **Duplicate tool calls**: LLM occasionally calls `create_shipment` or `send_message` twice per turn when the first call fails. Not dangerous but wasteful and potentially confusing.

5. **Broker role unvalidated**: Brokers see all shipments (no filter). This may be excessive depending on B2B partner requirements. No test suite covers broker behavior.

6. **No profile update**: A missing but obvious capability. Users who want to change their phone number or name must use the dashboard.

### Remaining Risks

1. **Concurrent session writes**: If a user sends two messages simultaneously from the same session, both would write to `session.messages` concurrently without a lock. Node.js event-loop serialization usually prevents this in practice, but under load it could produce message ordering anomalies.

2. **OpenAI rate limits**: Under high concurrent load, the system could hit OpenAI's RPM limits. No retry logic or backoff is implemented — failures return a generic error message. For production, add exponential backoff and consider request queuing.

3. **NaturalLanguageShipmentService reliability**: `create_shipment` delegates to this external service which makes its own GPT-4 call. If this service is unavailable or the secondary LLM call fails, the booking fails. The error is handled gracefully but the root cause is not logged distinctly.

4. **Google Maps quota**: No fallback quota monitoring. If the Maps API quota is exhausted mid-day, all quotes fall back to haversine (±10-15% accuracy) without user notification.

### Production Verdict

**⚠️ Production Ready with Minor Risks**

The system is functionally complete and behaviorally robust for all four user roles. All 114 automated tests pass. The authorization model is correctly layered and server-enforced. The conversation quality meets the standard of a knowledgeable AI assistant.

**The system can be deployed to production today** for the core Client, Driver, and Admin workflows.

**Conditions for full "Production Ready" status**:
1. Validate `create_shipment` end-to-end with a real client who has a payment method on file
2. Run one manual Broker-role conversation test to validate tool availability and query scoping
3. Confirm Railway deployment is single-instance (no horizontal scaling before Redis is in place)
4. Confirm OpenAI and Google Maps API quotas are provisioned for expected production traffic volume
