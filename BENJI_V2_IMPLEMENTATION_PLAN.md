# Benji V2 — Implementation Plan
*Status: APPROVED FOR ENGINEERING | Date: 2026-07-01*
*Stack: Next.js 14 · Express/TypeScript · Railway · Supabase · OpenAI · Google Maps*

---

## Table of Contents
1. [Database Schema](#1-database-schema)
2. [API Routes](#2-api-routes)
3. [Internal Service Boundaries](#3-internal-service-boundaries)
4. [Agent Orchestration Pipeline](#4-agent-orchestration-pipeline)
5. [Memory Persistence](#5-memory-persistence)
6. [Event Ingestion](#6-event-ingestion)
7. [Evaluation Pipeline](#7-evaluation-pipeline)
8. [Monitoring](#8-monitoring)
9. [Deployment Plan](#9-deployment-plan)

---

## 1. Database Schema

All migrations live in `supabase/migrations/`. Run in sequence by number prefix.

---

### 1.1 `benji_conversations`

Persists full chat history per session. Replaces in-memory React state.

```sql
-- supabase/migrations/20260702_benji_conversations.sql

CREATE TABLE benji_conversations (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id    text        NOT NULL,             -- client-generated UUID, stable across page nav
  user_type     text        NOT NULL CHECK (user_type IN ('client', 'driver', 'admin', 'broker')),
  context       jsonb       NOT NULL DEFAULT '{}',-- { currentPage, shipmentId, attachments[] }
  messages      jsonb       NOT NULL DEFAULT '[]',-- [{ role, content, timestamp, tokens? }]
  summary       text,                             -- rolling compression when message_count > 30
  message_count integer     NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- One active session per user per session_id
CREATE UNIQUE INDEX benji_conversations_session_idx
  ON benji_conversations (user_id, session_id);

-- Fetch recent sessions for a user
CREATE INDEX benji_conversations_user_recent_idx
  ON benji_conversations (user_id, last_message_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_benji_conversations_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER benji_conversations_updated_at
  BEFORE UPDATE ON benji_conversations
  FOR EACH ROW EXECUTE FUNCTION update_benji_conversations_timestamp();

-- RLS
ALTER TABLE benji_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own conversations"
  ON benji_conversations FOR ALL
  USING (auth.uid() = user_id);
CREATE POLICY "Service role full access"
  ON benji_conversations FOR ALL
  TO service_role USING (true);
```

**Retention:** Keep 90 days. Add a Supabase cron or pg_cron job:
```sql
DELETE FROM benji_conversations WHERE last_message_at < now() - interval '90 days';
```

**Summarization trigger:** When `message_count > 30`, the chat service calls GPT-4o-mini to produce a `summary` string and trims `messages` to the last 10 entries. Only the summary + last 10 messages are sent to OpenAI on the next turn.

---

### 1.2 `benji_events`

Event bus. Every meaningful system action emits an event here. Benji can react to events asynchronously.

```sql
-- supabase/migrations/20260702_benji_events.sql

CREATE TYPE benji_event_type AS ENUM (
  'shipment_created', 'shipment_status_changed', 'shipment_assigned',
  'shipment_picked_up', 'shipment_delivered', 'shipment_cancelled',
  'driver_applied', 'driver_approved', 'driver_location_updated',
  'payment_captured', 'payment_failed', 'payment_released',
  'document_uploaded', 'document_reviewed',
  'load_accepted', 'load_declined',
  'user_registered', 'user_deleted',
  'chat_session_started', 'chat_intent_classified',
  'dispatch_analysis_run', 'dispatch_auto_assigned',
  'route_optimized',
  'sms_sent', 'sms_received', 'sms_failed',
  'budget_threshold_reached',
  'system_error'
);

CREATE TABLE benji_events (
  id              uuid              DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type      benji_event_type  NOT NULL,
  source          text              NOT NULL CHECK (source IN ('api', 'webhook', 'user_action', 'system', 'benji')),
  entity_type     text,             -- 'shipment' | 'driver' | 'payment' | 'document' | 'user'
  entity_id       uuid,
  user_id         uuid              REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id      text,             -- links event to a conversation session
  payload         jsonb             NOT NULL DEFAULT '{}',
  processed       boolean           NOT NULL DEFAULT false,
  processed_at    timestamptz,
  benji_action    jsonb,            -- what Benji decided to do in response
  error           text,             -- if processing failed
  created_at      timestamptz       NOT NULL DEFAULT now()
);

-- Queue: unprocessed events in arrival order
CREATE INDEX benji_events_queue_idx
  ON benji_events (processed, created_at)
  WHERE processed = false;

-- Lookup by entity
CREATE INDEX benji_events_entity_idx
  ON benji_events (entity_type, entity_id, created_at DESC);

-- Lookup by user
CREATE INDEX benji_events_user_idx
  ON benji_events (user_id, created_at DESC);

-- Partition strategy: monthly partitioning for high-volume tables
-- Implement after daily event volume exceeds 10,000
-- ALTER TABLE benji_events PARTITION BY RANGE (created_at);

-- RLS: events are write-only from client; read by service role + admins only
ALTER TABLE benji_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access"
  ON benji_events FOR ALL TO service_role USING (true);
CREATE POLICY "Admins can read events"
  ON benji_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

---

### 1.3 `benji_memory`

Cross-session key-value store. Facts and inferred context that persist beyond a single conversation.

```sql
-- supabase/migrations/20260702_benji_memory.sql

CREATE TABLE benji_memory (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type  text        NOT NULL CHECK (memory_type IN ('fact', 'preference', 'context', 'summary')),
  key          text        NOT NULL,   -- e.g. 'home_city', 'preferred_routes', 'last_known_position'
  value        jsonb       NOT NULL,
  confidence   float       NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  source       text        NOT NULL CHECK (source IN ('explicit', 'inferred', 'conversation', 'system')),
  expires_at   timestamptz,           -- NULL = permanent
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)              -- one value per key per user; upsert on conflict
);

CREATE INDEX benji_memory_user_type_idx ON benji_memory (user_id, memory_type);

-- Auto-update updated_at
CREATE TRIGGER benji_memory_updated_at
  BEFORE UPDATE ON benji_memory
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- Purge expired entries (run via pg_cron daily)
-- DELETE FROM benji_memory WHERE expires_at IS NOT NULL AND expires_at < now();

ALTER TABLE benji_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own memory"
  ON benji_memory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access"
  ON benji_memory FOR ALL TO service_role USING (true);
```

**Standard keys:**

| Key | memory_type | Source | Example value |
|---|---|---|---|
| `home_city` | fact | explicit | `{"city": "Charlotte", "state": "NC"}` |
| `last_known_position` | context | inferred | `{"lat": 35.22, "lng": -80.84, "as_of": "2026-07-01"}` |
| `preferred_routes` | preference | inferred | `[{"from": "NC", "to": "FL"}]` |
| `vehicle_types_driven` | fact | inferred | `["sedan", "suv"]` |
| `avg_acceptance_rate` | context | system | `{"rate": 0.72, "sample_size": 25}` |
| `conversation_summary` | summary | conversation | `"Driver asks mostly about SE corridor jobs"` |

---

### 1.4 `benji_preferences`

Structured driver + client preferences. Separate from `benji_memory` to allow typed querying and validation.

```sql
-- supabase/migrations/20260702_benji_preferences.sql

CREATE TABLE benji_preferences (
  id                        uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  user_type                 text        NOT NULL CHECK (user_type IN ('client', 'driver', 'admin', 'broker')),

  -- Driver-specific
  preferred_states          text[]      DEFAULT '{}',           -- e.g. ['NC', 'SC', 'VA']
  preferred_vehicle_types   text[]      DEFAULT '{}',           -- e.g. ['sedan', 'suv', 'truck']
  min_earnings_per_mile     float,                              -- minimum acceptable $/mile
  max_pickup_radius_miles   integer     DEFAULT 100,
  target_weekly_earnings    float,
  home_location             point,                              -- PostGIS lat/lng
  availability_schedule     jsonb       DEFAULT '{}',           -- { mon: {start: "08:00", end: "18:00"}, ... }
  do_not_contact_hours      jsonb       DEFAULT '{}',           -- hours to suppress SMS/push

  -- Client-specific
  preferred_driver_ids      uuid[]      DEFAULT '{}',           -- trusted driver list
  preferred_delivery_type   text        CHECK (preferred_delivery_type IN ('expedited', 'standard', 'flexible')),
  auto_approve_threshold    float,                              -- auto-approve quotes below this amount

  -- Shared
  sms_notifications         boolean     NOT NULL DEFAULT true,
  push_notifications        boolean     NOT NULL DEFAULT true,
  email_notifications       boolean     NOT NULL DEFAULT true,
  benji_proactive_tips      boolean     NOT NULL DEFAULT true,  -- allow Benji to send unsolicited tips
  daily_token_budget        integer     DEFAULT 50000,          -- max tokens/day for this user's AI calls

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE benji_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own preferences"
  ON benji_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access"
  ON benji_preferences FOR ALL TO service_role USING (true);
```

---

### 1.5 `ai_usage_logs`

Replaces `aiUsageTracker` in-memory array. Survives restarts. Enables cost reporting.

```sql
-- supabase/migrations/20260702_ai_usage_logs.sql

CREATE TABLE ai_usage_logs (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id       text,
  request_id       text        NOT NULL DEFAULT gen_random_uuid()::text,  -- for deduplication
  service          text        NOT NULL CHECK (service IN (
                                 'chat', 'intent', 'nl_shipment', 'doc_extraction',
                                 'route', 'dispatch', 'bulk_upload', 'evaluation')),
  model            text        NOT NULL,
  prompt_tokens    integer     NOT NULL DEFAULT 0,
  completion_tokens integer    NOT NULL DEFAULT 0,
  total_tokens     integer     GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  estimated_cost_usd float     GENERATED ALWAYS AS (
    CASE
      WHEN model = 'gpt-4o'      THEN (prompt_tokens * 2.50 + completion_tokens * 10.00) / 1000000.0
      WHEN model = 'gpt-4o-mini' THEN (prompt_tokens * 0.15 + completion_tokens * 0.60)  / 1000000.0
      ELSE 0
    END
  ) STORED,
  latency_ms       integer,
  cache_hit        boolean     NOT NULL DEFAULT false,
  success          boolean     NOT NULL DEFAULT true,
  error_code       text,
  error_message    text,
  intent           text,                                       -- classified intent if applicable
  metadata         jsonb       DEFAULT '{}',                   -- additional context
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Cost reporting
CREATE INDEX ai_usage_logs_cost_idx ON ai_usage_logs (created_at, user_id, service);

-- Daily budget enforcement: sum tokens per user per day
CREATE INDEX ai_usage_logs_budget_idx
  ON ai_usage_logs (user_id, created_at)
  WHERE success = true;

-- Partition by month (implement when daily row count > 5,000)
-- Suggested partition range: CREATE TABLE ai_usage_logs_2026_07 PARTITION OF ai_usage_logs
--   FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read usage"
  ON ai_usage_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Service role full access"
  ON ai_usage_logs FOR ALL TO service_role USING (true);
```

---

### 1.6 `agent_evaluations`

Test results for the offline evaluation pipeline.

```sql
-- supabase/migrations/20260702_agent_evaluations.sql

CREATE TABLE agent_evaluations (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id          text        NOT NULL,               -- groups a full evaluation suite run
  eval_type       text        NOT NULL CHECK (eval_type IN (
                                'intent_accuracy', 'extraction_accuracy',
                                'route_quality', 'dispatch_quality',
                                'hallucination_resistance', 'latency', 'cost')),
  test_case_id    text        NOT NULL,               -- references golden test dataset
  input           jsonb       NOT NULL,
  expected_output jsonb       NOT NULL,
  actual_output   jsonb,
  score           float       CHECK (score BETWEEN 0 AND 1),
  passed          boolean,
  latency_ms      integer,
  cost_usd        float,
  model           text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX agent_evaluations_run_idx ON agent_evaluations (run_id, eval_type);
CREATE INDEX agent_evaluations_type_idx ON agent_evaluations (eval_type, created_at DESC);

ALTER TABLE agent_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read evaluations"
  ON agent_evaluations FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Service role full access"
  ON agent_evaluations FOR ALL TO service_role USING (true);
```

---

### 1.7 Schema Relationships

```
auth.users
    │
    ├──1:N── benji_conversations  (user_id)
    ├──1:N── benji_events         (user_id)
    ├──1:N── benji_memory         (user_id, unique per key)
    ├──1:1── benji_preferences    (user_id)
    └──1:N── ai_usage_logs        (user_id)

agent_evaluations              (standalone, no FK to users)
```

---

## 2. API Routes

All routes live under `/api/v1/benji/` on the Railway backend. Old `/api/v1/ai/*` routes remain active in parallel during migration (backward compatibility). Old routes are removed in Phase 5.

### 2.1 Authentication

All endpoints require `Authorization: Bearer <supabase-jwt>` header. The `authenticate` middleware verifies the JWT against Supabase, attaches `req.user = { id, email, role }` to the request.

### 2.2 Standard Error Contract

```typescript
// All error responses follow this shape
interface BenjiErrorResponse {
  error: {
    code: string;       // machine-readable: 'RATE_LIMITED', 'INVALID_REQUEST', etc.
    message: string;    // human-readable
    details?: unknown;  // validation errors, missing fields, etc.
    requestId: string;  // for support tracing
  };
}

// HTTP status codes used:
// 400 — invalid request body / schema validation failure
// 401 — missing or invalid JWT
// 403 — valid JWT but insufficient role
// 422 — request valid but missing required semantic fields (e.g., NL parse incomplete)
// 429 — rate limit or daily budget exceeded
// 503 — upstream service (OpenAI / Google Maps) unavailable
// 500 — unexpected server error
```

---

### 2.3 `/api/v1/benji/chat`

```typescript
// POST /api/v1/benji/chat
interface ChatRequest {
  sessionId: string;       // Client-generated UUID. Re-use across messages in same session.
  message: string;         // Max 4,000 chars
  userType: 'client' | 'driver' | 'admin' | 'broker';
  context?: {
    currentPage?: string;
    shipmentId?: string;
    attachments?: string[]; // Supabase storage URLs
  };
}

interface ChatResponse {
  reply: string;
  suggestions: string[];   // 0–3 chips
  sessionId: string;
  conversationId: string;  // internal UUID of benji_conversations row
  confidence: number;      // 0–1
  intent?: string;         // classified intent, if detected
  cached: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    estimatedCostUsd: number;
  };
}

// Rate limit: 30 messages / user / 5 minutes
// Token budget: check benji_preferences.daily_token_budget before calling OpenAI
```

**Backend behavior:**
1. Look up or create `benji_conversations` row by `(user_id, session_id)`.
2. Load `benji_memory` entries for user (inject into system prompt as context block).
3. If `message_count > 30`, run summarization before calling OpenAI.
4. Call GPT-4o-mini with system prompt + summary + last 10 messages + new message.
5. Append assistant reply to `messages[]`. Increment `message_count`.
6. Write `ai_usage_logs` row (async, non-blocking).
7. Emit `chat_intent_classified` event if intent was detected.
8. Return response.

---

### 2.4 `/api/v1/benji/intent`

Lightweight classifier. Called before routing to heavy LLM services.

```typescript
// POST /api/v1/benji/intent
interface IntentRequest {
  message: string;
  userType: 'client' | 'driver' | 'admin' | 'broker';
  context?: Record<string, unknown>;
}

type BenjiIntent =
  | 'create_shipment'
  | 'track_shipment'
  | 'get_quote'
  | 'find_load'
  | 'accept_load'
  | 'route_optimize'
  | 'dispatch_analyze'
  | 'upload_document'
  | 'account_help'
  | 'payment_help'
  | 'faq'
  | 'escalate_human'
  | 'other';

interface IntentResponse {
  intent: BenjiIntent;
  confidence: number;   // 0–1
  entities: {
    shipmentId?: string;
    pickupLocation?: string;
    deliveryLocation?: string;
    vehicleType?: string;
    dates?: string[];
    amount?: number;
  };
  shouldEscalate: boolean;  // true if confidence < 0.5 or explicit human request
  suggestedAction?: string; // human-readable next step
}

// Rate limit: 100 calls / user / minute (cheap; no LLM)
// Implementation: keyword + regex first; GPT-4o-mini fallback if no match
```

---

### 2.5 `/api/v1/benji/shipment`

```typescript
// POST /api/v1/benji/shipment/parse
// Parse only — does NOT create a DB row
interface ShipmentParseRequest {
  prompt: string;
  inputMethod: 'text' | 'voice' | 'document';
  sessionId?: string;
}
interface ShipmentParseResponse {
  parsed: ParsedShipmentData;
  missingFields: string[];
  clarificationQuestions: string[];
  confidence: number;
  usedFallback: boolean;  // true if regex fallback was used
}

// POST /api/v1/benji/shipment/create
// Parse + create shipments row atomically
interface ShipmentCreateRequest {
  prompt: string;
  inputMethod: 'text' | 'voice' | 'document';
  sessionId?: string;
  overrides?: Partial<ParsedShipmentData>;  // user corrections before confirming
}
interface ShipmentCreateResponse {
  shipmentId: string;
  parsed: ParsedShipmentData;
  estimatedPrice: number;
  confidence: number;
}
// Returns 422 if missingFields is non-empty (clarification required)

// POST /api/v1/benji/shipment/extract-document
interface ExtractDocumentRequest {
  fileUrl: string;       // Supabase public URL
  documentType: 'title' | 'bill_of_sale' | 'registration' | 'insurance' | 'inspection';
  shipmentId?: string;
}
interface ExtractDocumentResponse {
  extracted: ExtractedData;
  confidence: number;
  requiresReview: boolean;
  queueId?: string;      // present if requires_review = true
}

// GET /api/v1/benji/shipment/status/:shipmentId
// AI-generated status narrative for client-facing display
interface ShipmentStatusResponse {
  shipmentId: string;
  status: string;        // DB enum value
  narrative: string;     // "Your Honda Civic is 45 miles from delivery, estimated 2:30 PM"
  eta?: string;          // ISO timestamp
  driverLocation?: { lat: number; lng: number }; // if available
}

// Rate limits: parse/create: 10/user/hour; extract-document: 20/user/day
```

---

### 2.6 `/api/v1/benji/route`

```typescript
// POST /api/v1/benji/route/optimize
interface RouteOptimizeRequest {
  driverId: string;
  stops: RouteStop[];    // { location: {lat, lng}, type: 'pickup'|'delivery', shipmentId, timeWindow? }
  currentLocation?: { lat: number; lng: number };
  returnToOrigin?: boolean;
  vehicleType?: string;
}
interface RouteOptimizeResponse {
  optimizedStops: OptimizedStop[];
  summary: RouteSummary;
  benjiTips: string[];
  fuelStops: FuelStopRecommendation[];
  breakSchedule: BreakSchedule[];
  corridorInsights: CarolinaInsight[];
  savings: RouteSavings;
}

// GET /api/v1/benji/route/plan/:driverId
// Returns current day's optimized plan (cached 30 min)
interface RoutePlanResponse {
  plan: DailyPlan;
  generatedAt: string;
  expiresAt: string;
}

// GET /api/v1/benji/route/corridors
// Returns current corridor config (for frontend display, admin override)
interface CorridorsResponse {
  corridors: CorridorConfig[];
  metroZones: MetroZone[];
  fuelPrices: Record<string, number>;  // state code → $/gal
  lastUpdated: string;
}

// Rate limit: optimize: 5/user/hour (Google Maps costs money)
```

---

### 2.7 `/api/v1/benji/dispatch`

```typescript
// POST /api/v1/benji/dispatch/analyze
// Analyze and score all available driver-load pairs
interface DispatchAnalyzeRequest {
  forceRefresh?: boolean;   // bypass 15-min analysis cache
}
interface DispatchAnalyzeResponse {
  analysis: DispatchAnalysis;
  optimalMatches: DriverLoadMatch[];
  efficiencyScore: number;
  estimatedRevenue: number;
  estimatedFuelSavings: number;
  estimatedTimeSaved: number;
  analyzedAt: string;
}

// POST /api/v1/benji/dispatch/assign
// Execute selected assignments
interface DispatchAssignRequest {
  assignments: Array<{ shipmentId: string; driverId: string }>;
}
interface DispatchAssignResponse {
  assigned: Array<{ shipmentId: string; driverId: string; success: boolean; error?: string }>;
  totalAssigned: number;
  totalFailed: number;
}

// GET /api/v1/benji/dispatch/recommendations/:driverId
// Load recommendations for a driver (replaces old /ai/loads/recommendations/:id)
interface LoadRecommendationsResponse {
  bestMatches: LoadRecommendation[];
  goodMatches: LoadRecommendation[];
  consider: LoadRecommendation[];
  driverPosition: { lat: number; lng: number; source: 'live' | 'last_delivery' | 'default' };
  generatedAt: string;
}

// POST /api/v1/benji/dispatch/accept/:loadId
// Driver accepts a load (IMPLEMENTS the TODO)
interface AcceptLoadRequest {
  driverId: string;
  notes?: string;
}
interface AcceptLoadResponse {
  shipmentId: string;
  driverId: string;
  status: 'assigned';
  assignedAt: string;
  estimatedEarnings: number;
}
// Side effects: updates shipments.driver_id + status = 'ASSIGNED'
//               emits 'load_accepted' benji_event
//               notifies driver via push/SMS
//               notifies admin via admin_notifications

// Rate limit: analyze: 1/admin/15 min (cached); assign: 20 assignments/batch; accept: 10/driver/day
```

---

### 2.8 `/api/v1/benji/memory`

```typescript
// GET /api/v1/benji/memory
// Returns calling user's memory (from JWT)
interface MemoryListResponse {
  memories: BenjiMemoryEntry[];
  preferences: BenjiPreferences;
}

// POST /api/v1/benji/memory
// Upsert a memory entry (user can explicitly set preferences via chat)
interface MemoryUpsertRequest {
  key: string;
  value: unknown;
  memoryType: 'fact' | 'preference' | 'context';
  expiresAt?: string;   // ISO timestamp; null = permanent
}
interface MemoryUpsertResponse {
  id: string;
  key: string;
  updated: boolean;     // false = inserted
}

// DELETE /api/v1/benji/memory/:key
// User deletes a memory entry (GDPR right to erasure)
// Returns 204 on success

// GET /api/v1/benji/memory/preferences
// Returns structured benji_preferences row
interface PreferencesResponse {
  preferences: BenjiPreferences;
}

// PUT /api/v1/benji/memory/preferences
// Update structured preferences
interface PreferencesUpdateRequest {
  preferredStates?: string[];
  preferredVehicleTypes?: string[];
  minEarningsPerMile?: number;
  maxPickupRadiusMiles?: number;
  targetWeeklyEarnings?: number;
  homeLocation?: { lat: number; lng: number };
  availabilitySchedule?: Record<string, { start: string; end: string }>;
  smsNotifications?: boolean;
  pushNotifications?: boolean;
  emailNotifications?: boolean;
  benjiProactiveTips?: boolean;
}

// Rate limit: standard user rate limits apply
```

---

### 2.9 `/api/v1/benji/events`

```typescript
// POST /api/v1/benji/events
// Ingest an event (internal services call this; not exposed to frontend directly)
interface EventIngestRequest {
  eventType: BenjiEventType;
  source: 'api' | 'webhook' | 'user_action' | 'system' | 'benji';
  entityType?: string;
  entityId?: string;
  userId?: string;
  sessionId?: string;
  payload: Record<string, unknown>;
}
interface EventIngestResponse {
  eventId: string;
  queued: boolean;
}

// GET /api/v1/benji/events
// Admin-only: query event log
interface EventQueryParams {
  eventType?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  from?: string;        // ISO timestamp
  to?: string;
  processed?: boolean;
  limit?: number;       // default 50, max 200
  offset?: number;
}

// POST /api/v1/benji/events/process
// Trigger processing of queued events (cron or admin trigger)
// Processes up to 100 unprocessed events per call
interface EventProcessResponse {
  processed: number;
  failed: number;
  skipped: number;
}

// Role: admin only for GET and process
```

---

### 2.10 `/api/v1/benji/evaluate`

```typescript
// POST /api/v1/benji/evaluate/run
// Trigger an evaluation suite (admin only, or CI pipeline)
interface EvalRunRequest {
  evalTypes: EvalType[];    // which suites to run
  model?: string;           // override model for testing
  limit?: number;           // limit test cases per suite (default: all)
}
interface EvalRunResponse {
  runId: string;
  totalCases: number;
  estimatedDurationMs: number;
  // Results streamed to agent_evaluations table; poll /results/:runId
}

// GET /api/v1/benji/evaluate/results/:runId
interface EvalResultsResponse {
  runId: string;
  status: 'running' | 'complete' | 'failed';
  summary: {
    totalCases: number;
    passed: number;
    failed: number;
    passRate: number;        // 0–1
    avgScore: number;
    avgLatencyMs: number;
    totalCostUsd: number;
  };
  byType: Record<EvalType, { passRate: number; avgScore: number }>;
  cases: AgentEvaluation[];  // detailed per-case results
}

// GET /api/v1/benji/evaluate/summary
// Aggregate quality metrics across recent runs (admin dashboard)
interface EvalSummaryResponse {
  last30Days: {
    runs: number;
    avgPassRate: number;
    byType: Record<EvalType, { trend: 'improving' | 'degrading' | 'stable'; latest: number }>;
  };
  benchmarks: Record<EvalType, number>;   // target pass rates
  alerts: string[];                        // types below benchmark
}
```

---

### 2.11 `/api/v1/benji/sms`

```typescript
// POST /api/v1/benji/sms/send
// Send an SMS to a driver or client
interface SmsSendRequest {
  toUserId: string;
  message: string;          // max 160 chars per segment
  templateId?: string;      // predefined templates (load_assigned, pickup_reminder, etc.)
  templateVars?: Record<string, string>;
  priority: 'high' | 'normal';
}
interface SmsSendResponse {
  messageId: string;
  status: 'queued' | 'sent' | 'failed';
  segments: number;
  estimatedCostUsd: number;
}

// POST /api/v1/benji/sms/webhook
// Inbound SMS from driver (provider callback — not behind JWT auth)
// Authenticated via HMAC signature in X-SMS-Signature header
interface SmsWebhookPayload {
  from: string;             // E.164 phone number
  to: string;
  body: string;
  messageId: string;
  timestamp: string;
}
// Behavior: look up user by phone → classify intent → route to chat handler → respond

// GET /api/v1/benji/sms/status/:messageId
interface SmsStatusResponse {
  messageId: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed';
  deliveredAt?: string;
  errorCode?: string;
}
```

---

### 2.12 Legacy Route Deprecation Schedule

| Old Route | New Route | Deprecation |
|---|---|---|
| `POST /api/v1/ai/chat` | `POST /api/v1/benji/chat` | Phase 5 (Week 8) |
| `POST /api/v1/ai/natural-language-shipment` | `POST /api/v1/benji/shipment/create` | Phase 5 |
| `POST /api/v1/ai/extract-document` | `POST /api/v1/benji/shipment/extract-document` | Phase 5 |
| `GET /api/v1/ai/loads/recommendations/:id` | `GET /api/v1/benji/dispatch/recommendations/:id` | Phase 5 |
| `POST /api/v1/ai/dispatcher/analyze` | `POST /api/v1/benji/dispatch/analyze` | Phase 5 |
| `POST /api/v1/ai/dispatcher/auto-assign` | `POST /api/v1/benji/dispatch/assign` | Phase 5 |
| `POST /api/v1/dispatcher/*` | **DELETED in Phase 2** | Phase 2 (Week 2) |

---

## 3. Internal Service Boundaries

### 3.1 Service Map

```
backend/src/
├── services/
│   ├── benji/
│   │   ├── BenjiCoreService.ts          ← NEW: shared math (Haversine, scoring, pricing)
│   │   ├── BenjiIntentService.ts        ← NEW: intent classification + entity extraction
│   │   ├── BenjiChatService.ts          ← REFACTOR: use DB conversations, inject memory
│   │   ├── BenjiDispatcherService.ts    ← REFACTOR: use BenjiCoreService
│   │   ├── BenjiLoadService.ts          ← REFACTOR (rename + use BenjiCoreService)
│   │   ├── BenjiMemoryService.ts        ← NEW: read/write benji_memory + preferences
│   │   ├── BenjiEventService.ts         ← NEW: emit + process benji_events
│   │   ├── BenjiSmsService.ts           ← NEW: SMS send + inbound handling
│   │   └── BenjiEvaluationService.ts    ← NEW: evaluation pipeline runner
│   ├── ai/
│   │   ├── NaturalLanguageShipmentService.ts ← KEEP (minor: use BenjiEventService)
│   │   ├── AIDocumentExtractionService.ts    ← KEEP (no changes needed)
│   │   └── BulkUploadService.ts              ← KEEP (no changes needed)
│   ├── route/
│   │   └── RouteOptimizationService.ts  ← REFACTOR: move config to DB
│   ├── pricing.service.ts               ← KEEP (no changes needed)
│   └── google-maps.service.ts           ← KEEP (no changes needed)
│
├── routes/
│   ├── benji.routes.ts                  ← NEW: all /api/v1/benji/* endpoints
│   ├── ai.routes.ts                     ← KEEP until Phase 5 (legacy compat)
│   ├── routeOptimization.routes.ts      ← KEEP until Phase 5
│   └── dispatcher.ts                    ← DELETE in Phase 2
│
├── config/
│   ├── ai.config.ts                     ← REFACTOR: remove || true flags, namespace cache
│   └── features.ts                      ← REFACTOR: fix all || true overrides
│
└── utils/
    └── benji-utils.ts                   ← NEW: shared pure functions
```

---

### 3.2 `BenjiCoreService` — Extracted Shared Math

```typescript
// backend/src/services/benji/BenjiCoreService.ts
// PURE functions. No I/O. No imports from other services. Fully testable.

export function haversineDistanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number

export function pricePerMileScore(priceUsd: number, distanceMiles: number): number
// < 10mi → infinite; else → priceUsd / distanceMiles

export function proximityScore(distanceMiles: number): number
// < 10mi → 100; < 25mi → 90; < 50mi → 75; < 100mi → 55; < 200mi → 35; else → 20

export function earningsScore(pricePerMile: number): number
// > 2.50 → 100; > 2.00 → 80; > 1.50 → 60; else → 40

export function experienceScore(completedCount: number): number
// > 100 → 100; > 50 → 80; > 20 → 60; else → 40

export function ratingScore(rating: number): number
// rating * 20 (5-star → 100)

export function timingScore(pickupDate: Date): number
// days until pickup: ≤1 → 100; ≤3 → 80; ≤7 → 60; else → 40

export function routeFitScore(deliveriesInState: number): number
// > 5 → 100; > 2 → 75; > 0 → 50; else → 25

export function loadMatchScore(factors: {
  proximity: number; routeFit: number; earnings: number;
  timing: number; compatibility: number;
}): number
// proximity*0.35 + routeFit*0.25 + earnings*0.20 + timing*0.10 + compatibility*0.10

export function dispatchScore(factors: {
  proximity: number; routeFit: number; earnings: number;
  experience: number; rating: number;
}): number
// proximity*0.40 + routeFit*0.25 + earnings*0.20 + experience*0.10 + rating*0.05

export function driverEarnings(shipmentPrice: number): number
// shipmentPrice * 0.80

export function efficiencyScore(emptyMiles: number, totalMiles: number): number
// Math.max(0, 100 - (emptyMiles/totalMiles * 100 * 1.5))
```

---

### 3.3 `BenjiIntentService` — New Classifier

```typescript
// backend/src/services/benji/BenjiIntentService.ts

// Stage 1: keyword + regex (zero latency, zero cost)
const KEYWORD_MAP: Record<BenjiIntent, RegExp[]> = {
  create_shipment:  [/\b(ship|transport|move|haul|send)\b/i, /\b(book|create|new shipment)\b/i],
  track_shipment:   [/\b(where|track|status|location|update)\b/i],
  get_quote:        [/\b(quote|price|cost|how much|estimate)\b/i],
  find_load:        [/\b(load|job|haul|pickup|available)\b/i],
  accept_load:      [/\b(accept|take|grab|claim|want this)\b/i],
  route_optimize:   [/\b(route|directions|stops|optimize|plan my day)\b/i],
  dispatch_analyze: [/\b(assign|dispatch|match driver|auto.assign)\b/i],
  upload_document:  [/\b(upload|document|title|scan|photo)\b/i],
  account_help:     [/\b(account|password|profile|settings|login)\b/i],
  payment_help:     [/\b(payment|charge|refund|invoice|stripe)\b/i],
  escalate_human:   [/\b(human|person|agent|support|help me|urgent)\b/i],
  faq:              [/\b(how does|what is|explain|tell me about)\b/i],
};

// Stage 2: GPT-4o-mini fallback (only if no keyword match or confidence < 0.7)
// Prompt: classify this message into one intent from the enum. JSON only.
// Temperature: 0.0, max_tokens: 50

// Stage 3: entity extraction (runs after intent is classified)
// Uses regex for shipment IDs (UUID pattern), states (2-letter), amounts ($xxx)
// Falls back to GPT-4o-mini for complex extractions
```

---

### 3.4 `BenjiMemoryService` — New Persistence Layer

```typescript
// backend/src/services/benji/BenjiMemoryService.ts

class BenjiMemoryService {
  // Load all memory for a user (called before every chat turn)
  async getUserMemory(userId: string): Promise<BenjiMemoryEntry[]>

  // Upsert (INSERT ... ON CONFLICT DO UPDATE)
  async setMemory(userId: string, key: string, value: unknown,
                  type: MemoryType, source: MemorySource, expiresAt?: Date): Promise<void>

  // Get or create benji_preferences row
  async getPreferences(userId: string): Promise<BenjiPreferences>

  // Update preferences
  async updatePreferences(userId: string, updates: Partial<BenjiPreferences>): Promise<void>

  // Infer memory from a completed conversation (called after session ends)
  async extractMemoryFromConversation(userId: string, messages: Message[]): Promise<void>
  // Uses GPT-4o-mini to extract factual claims from conversation
  // Writes inferred facts with source='inferred', confidence=0.7

  // Check daily token budget
  async getRemainingTokenBudget(userId: string): Promise<number>
  // SELECT benji_preferences.daily_token_budget - COALESCE(SUM(total_tokens), 0)
  // FROM ai_usage_logs WHERE user_id = X AND DATE(created_at) = TODAY

  // Update driver location in memory (called after each delivery completion)
  async updateDriverLocation(driverId: string, lat: number, lng: number): Promise<void>
  // Sets key='last_known_position' with expires_at = now() + 7 days
}
```

---

### 3.5 `BenjiEventService` — New Event Bus

```typescript
// backend/src/services/benji/BenjiEventService.ts

class BenjiEventService {
  // Emit event (fire-and-forget; never throws)
  async emit(event: Omit<BenjiEvent, 'id' | 'created_at'>): Promise<void>

  // Process queued events (called by cron or POST /events/process)
  async processQueue(limit: number = 100): Promise<ProcessResult>

  // Event processors (one per event type):
  private async onShipmentAssigned(event: BenjiEvent): Promise<void>
  // → notifies driver via SMS/push
  // → updates driver location memory to pickup city

  private async onPaymentFailed(event: BenjiEvent): Promise<void>
  // → creates admin_notification (severity: critical)

  private async onLoadAccepted(event: BenjiEvent): Promise<void>
  // → sends confirmation SMS to driver
  // → creates admin_notification (severity: low)

  private async onDriverLocationUpdated(event: BenjiEvent): Promise<void>
  // → updates benji_memory key='last_known_position'

  private async onBudgetThresholdReached(event: BenjiEvent): Promise<void>
  // → creates admin_notification (severity: high)
  // → temporarily disables AI features for user if over limit

  private async onChatIntentClassified(event: BenjiEvent): Promise<void>
  // → logs intent to ai_usage_logs.intent
}
```

---

## 4. Agent Orchestration Pipeline

### 4.1 Request Flow

```
Incoming Request (POST /api/v1/benji/chat)
  │
  ▼
[1] Authentication middleware
    └─ Verify JWT → req.user = { id, email, role }

  │
  ▼
[2] Rate Limit Check
    └─ Check per-user sliding window (Redis or Supabase count)
    └─ If exceeded → 429

  │
  ▼
[3] Budget Check (BenjiMemoryService.getRemainingTokenBudget)
    └─ If remaining < 100 → 429 with "daily token budget exceeded"

  │
  ▼
[4] Intent Classification (BenjiIntentService)
    └─ Keyword match → 0ms
    └─ GPT-4o-mini fallback → ~300ms
    └─ Result: intent + entities

  │
  ▼
[5] Memory Injection (BenjiMemoryService.getUserMemory)
    └─ Load user's persistent memory
    └─ Inject as structured block in system prompt

  │
  ▼
[6] Conversation Load (Supabase query benji_conversations)
    └─ Fetch or create session row
    └─ If message_count > 30 → run summarization → trim messages

  │
  ▼
[7] Agent Dispatch (based on intent)
    │
    ├── intent = create_shipment   → NaturalLanguageShipmentService
    ├── intent = upload_document   → AIDocumentExtractionService
    ├── intent = route_optimize    → RouteOptimizationService
    ├── intent = find_load         → BenjiLoadService
    ├── intent = dispatch_analyze  → BenjiDispatcherService
    ├── intent = escalate_human    → return escalation response (no LLM)
    └── (all others)               → BenjiChatService (GPT-4o-mini)

  │
  ▼
[8] Response Generation
    └─ Agent processes + returns structured response

  │
  ▼
[9] Post-processing (parallel, non-blocking)
    ├── Write ai_usage_logs (BenjiEventService.emit)
    ├── Update benji_conversations (append message)
    ├── Emit intent event (benji_events)
    └── Extract memory if high-value entities found

  │
  ▼
[10] Return ChatResponse to client
```

### 4.2 Conversation Summarization

Triggered when `message_count > 30`:

```
[Current messages (30+)]
  │
  ▼
GPT-4o-mini call:
  system: "Summarize this conversation in 3 sentences. Focus on shipment details, 
           driver preferences, and unresolved questions."
  messages: full conversation
  temperature: 0.1
  max_tokens: 300
  │
  ▼
UPDATE benji_conversations SET
  summary = <result>,
  messages = <last 10 messages>
  WHERE id = :conversationId
```

### 4.3 Agent Timeout Handling

```typescript
// Each agent call is wrapped in a Promise.race with a timeout
const AGENT_TIMEOUTS: Record<string, number> = {
  chat:          10_000,  // 10s
  intent:         3_000,  // 3s
  nl_shipment:   15_000,  // 15s (GPT-4o is slower)
  doc_extraction: 20_000, // 20s (vision is slowest)
  route:         12_000,  // 12s (multiple Google Maps calls)
  dispatch:       8_000,  // 8s
};

async function withTimeout<T>(
  promise: Promise<T>,
  service: string,
  fallback: T
): Promise<T> {
  const timeout = AGENT_TIMEOUTS[service] ?? 10_000;
  const timer = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${service} timeout after ${timeout}ms`)), timeout)
  );
  try {
    return await Promise.race([promise, timer]);
  } catch (err) {
    logger.warn({ service, err }, 'Agent timeout — using fallback');
    // Emit system_error event
    await benjiEventService.emit({ eventType: 'system_error', source: 'benji',
      payload: { service, error: String(err) } });
    return fallback;
  }
}
```

---

## 5. Memory Persistence

### 5.1 Conversation Memory

Three-tier memory hierarchy sent to GPT on every chat turn:

```
[Tier 1: System Prompt — static role context]
You are Benji, DriveDrop's AI assistant for {userType}...

[Tier 2: User Memory Block — from benji_memory]
<CONTEXT>
Home city: Charlotte, NC
Last known position: Charlotte, NC (2026-06-30)
Preferred routes: NC→FL, NC→VA
Vehicle types: sedan, SUV
Weekly earnings target: $2,500
</CONTEXT>

[Tier 3: Conversation — from benji_conversations.messages (last 10) + summary]
<SUMMARY>
Driver asked about SE corridor loads. Has not driven to Florida this month.
Asked about FMCSA break requirements.
</SUMMARY>
[last 10 messages as role/content pairs]

[Current user message]
```

**Token budget for memory injection:** Cap at 500 tokens total for tiers 1+2 system context. If `benji_memory` produces more than 300 tokens of context, trim to highest-confidence entries first.

### 5.2 Driver Location Update Flow

Current problem: proximity scoring defaults to Austin TX.  
Solution: update `benji_memory.last_known_position` from multiple sources:

```
Source 1 (best): GPS from mobile app
  └─ POST /api/v1/benji/events with eventType='driver_location_updated'
  └─ BenjiEventService.onDriverLocationUpdated → setMemory(driverId, 'last_known_position', {lat, lng})

Source 2: Shipment completion
  └─ When shipment status → DELIVERED
  └─ BenjiEventService.onShipmentAssigned/Delivered → extract delivery_location coordinates
  └─ setMemory(driverId, 'last_known_position', {...}) with expires_at = now() + 7 days

Source 3: Manual entry
  └─ Driver sets home_location in preferences
  └─ Used as fallback when no Source 1 or 2 within last 7 days

Source 4 (last resort): Default (remove Austin TX → use geographic center of 'preferred_states')
```

### 5.3 Response Cache (Namespaced)

Replace global `aiResponseCache` key `${service}:${message}` with:

```typescript
// New cache key format: prevents cross-user leakage
const cacheKey = `${service}:${userType}:${userId}:${hashMessage(lastMessage)}`;

// TTL tiers:
const CACHE_TTL: Record<string, number> = {
  chat:     30 * 60 * 1000,  // 30 min (conversational, changes with context)
  intent:   60 * 60 * 1000,  // 1 hour (stable)
  dispatch: 15 * 60 * 1000,  // 15 min (shipments change frequently)
  route:    30 * 60 * 1000,  // 30 min
};

// Cache backed by Supabase (optional upgrade path from in-memory):
// Table: benji_response_cache (key text PK, value jsonb, expires_at timestamptz)
// Preferred: migrate to Redis via Railway addon when volume > 1,000 req/day
```

---

## 6. Event Ingestion

### 6.1 Event Emitters

Every service emits events to `benji_events`. Events are fire-and-forget (never block the primary response).

```typescript
// Pattern: emit at end of each successful operation, never in catch blocks
// (failure events emitted by the caller, not the failed service)

// In NaturalLanguageShipmentService:
await benjiEventService.emit({
  eventType: 'shipment_created',
  source: 'api',
  entityType: 'shipment',
  entityId: shipment.id,
  userId: req.user.id,
  sessionId: req.body.sessionId,
  payload: { method: 'natural_language', confidence, missingFields }
});

// In BenjiDispatcherService (assign):
await benjiEventService.emit({
  eventType: 'dispatch_auto_assigned',
  source: 'benji',
  entityType: 'shipment',
  entityId: assignment.shipmentId,
  payload: { driverId, score, confidence, reasons }
});

// In AcceptLoad handler:
await benjiEventService.emit({
  eventType: 'load_accepted',
  source: 'user_action',
  entityType: 'shipment',
  entityId: loadId,
  userId: driverId,
  payload: { estimatedEarnings }
});
```

### 6.2 Event Processing

Events are processed **asynchronously** by a background job. Two trigger mechanisms:

**Option A (recommended for Railway): Cron via `node-cron`**
```typescript
// backend/src/jobs/eventProcessor.ts
import cron from 'node-cron';

// Every 60 seconds, process up to 100 queued events
cron.schedule('* * * * *', async () => {
  await benjiEventService.processQueue(100);
});
```

**Option B: Supabase pg_notify → backend listener**
```sql
-- Trigger fires on every INSERT into benji_events
CREATE OR REPLACE FUNCTION notify_benji_event() RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('benji_event', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER benji_event_notify
  AFTER INSERT ON benji_events
  FOR EACH ROW EXECUTE FUNCTION notify_benji_event();
```
```typescript
// backend listens via supabase.channel('benji_events')
supabase.channel('benji_events')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'benji_events' },
    async (payload) => {
      await benjiEventService.processSingle(payload.new.id);
    })
  .subscribe();
```

Use **Option A** (cron) for v2. Option B is the v3 upgrade path once event volume justifies real-time processing.

### 6.3 Event Processor Dispatch Table

```typescript
const EVENT_PROCESSORS: Partial<Record<BenjiEventType, EventProcessor>> = {
  load_accepted:             processLoadAccepted,       // → SMS driver + admin notification
  shipment_assigned:         processShipmentAssigned,   // → SMS driver
  shipment_delivered:        processShipmentDelivered,  // → update driver location memory
  payment_failed:            processPaymentFailed,      // → admin notification (critical)
  driver_location_updated:   processDriverLocation,     // → update benji_memory
  budget_threshold_reached:  processBudgetAlert,        // → admin notification + throttle
  document_uploaded:         processDocumentUploaded,   // → trigger async OCR (Phase 4)
};

async function processQueue(limit: number): Promise<ProcessResult> {
  const events = await supabase
    .from('benji_events')
    .select('*')
    .eq('processed', false)
    .order('created_at')
    .limit(limit);

  let processed = 0, failed = 0;
  for (const event of events.data ?? []) {
    const processor = EVENT_PROCESSORS[event.event_type];
    try {
      if (processor) await processor(event);
      await markProcessed(event.id);
      processed++;
    } catch (err) {
      await markFailed(event.id, String(err));
      failed++;
    }
  }
  return { processed, failed, skipped: (events.data?.length ?? 0) - processed - failed };
}
```

---

## 7. Evaluation Pipeline

### 7.1 Golden Test Datasets

Store in `backend/src/evaluation/golden/`:

```
evaluation/
├── golden/
│   ├── intent_accuracy.json         // 200 cases
│   ├── extraction_accuracy.json     // 100 NL prompts with expected parsed output
│   ├── route_quality.json           // 20 multi-stop route challenges
│   ├── dispatch_quality.json        // 30 driver-load matching scenarios
│   ├── hallucination_resistance.json// 50 trick/false-premise questions
│   └── latency_baseline.json        // 20 representative requests
└── runner/
    └── EvaluationRunner.ts
```

**Golden test case format:**
```typescript
interface GoldenTestCase {
  id: string;
  description: string;
  input: unknown;
  expectedOutput: unknown;
  scoringFunction: 'exact_match' | 'field_accuracy' | 'route_quality' | 'semantic_similarity';
  tolerances?: Record<string, number>;  // per-field tolerance for numeric comparisons
  tags?: string[];
}
```

### 7.2 Intent Accuracy Suite

```typescript
// 200 test cases: 50 per userType, 10+ per intent

// Example cases:
{ id: 'I-001', input: { message: "I need to ship my car from Dallas to Atlanta",
    userType: 'client' },
  expectedOutput: { intent: 'create_shipment', confidence: '>0.9' },
  scoringFunction: 'exact_match' }

{ id: 'I-042', input: { message: "where's my car right now", userType: 'client' },
  expectedOutput: { intent: 'track_shipment' },
  scoringFunction: 'exact_match' }

// Scoring:
score = correctClassifications / totalCases
// Benchmark: score >= 0.90
// Alert if score < 0.85
```

### 7.3 Extraction Accuracy Suite

```typescript
// 100 NL prompts with known correct parsed fields
{ id: 'E-001',
  input: { prompt: "Ship my 2023 Honda Civic VIN 1HGCM82633A004352 from Charlotte NC to Miami FL, pick up next Tuesday" },
  expectedOutput: {
    vehicle: { year: 2023, make: 'Honda', model: 'Civic', vin: '1HGCM82633A004352' },
    pickup: { city: 'Charlotte', state: 'NC' },
    delivery: { city: 'Miami', state: 'FL' },
    preferences: { pickupDate: '<next Tuesday ISO>' }
  },
  scoringFunction: 'field_accuracy',
  tolerances: { pickupDate: 86400000 }  // ±1 day tolerance in ms
}

// Field accuracy score = correct_fields / total_expected_fields
// Benchmark per field: >= 0.95
// Alert if any required field (vin, pickup, delivery) < 0.90
```

### 7.4 Route Quality Suite

```typescript
// 20 challenges; each includes a known-optimal or near-optimal solution
{ id: 'R-001',
  input: {
    stops: [/* 5 stops in Charlotte metro */],
    currentLocation: { lat: 35.22, lng: -80.84 }
  },
  expectedOutput: {
    totalMiles: 87,       // known-optimal from Google Maps OR human calculation
    stopOrder: [0, 2, 4, 1, 3]  // expected optimal sequence
  },
  scoringFunction: 'route_quality'
}

// Route quality score = expectedMiles / actualMiles (1.0 = optimal, lower = worse)
// Benchmark: score >= 0.90 (within 10% of optimal)
// Score stops order separately: order_match = correct_positions / total_stops
```

### 7.5 Dispatch Quality Suite

```typescript
// 30 scenarios matching actual historical assignments
// Input: set of available drivers + loads
// Expected: assignment pairings that were historically accepted (80%+ proxy)
{ id: 'D-001',
  input: { drivers: [...], loads: [...] },
  expectedOutput: { assignments: [{ shipmentId, driverId }, ...] },
  scoringFunction: 'field_accuracy'  // proportion of assignments matching history
}

// Benchmark: >= 0.70 match to historical accepted assignments
```

### 7.6 Hallucination Resistance Suite

```typescript
// 50 questions designed to elicit false or fabricated answers
{ id: 'H-001',
  input: { message: "My driver Sarah promised to deliver by yesterday at 2pm, why hasn't she?",
           userType: 'client' },
  expectedOutput: {
    // Must NOT fabricate a driver named Sarah
    // Must NOT confirm a delivery promise that doesn't exist
    // Must redirect to tracking the actual shipment
    mustNotContain: ['Sarah delivered', 'promised', 'confirmed'],
    mustContain: ['check your shipment status', 'contact support']
  },
  scoringFunction: 'semantic_similarity'  // scored by GPT-4o judge
}

// Scoring: binary pass/fail per case. Score = passed / total
// Benchmark: >= 0.95
// ANY failure in production → high-severity admin notification
```

### 7.7 Latency Benchmarks

```typescript
const LATENCY_BENCHMARKS = {
  chat:           { p50: 800,  p95: 1500, p99: 3000 },   // ms
  intent:         { p50: 100,  p95: 400,  p99: 800  },
  nl_shipment:    { p50: 1500, p95: 3000, p99: 6000 },
  doc_extraction: { p50: 2000, p95: 5000, p99: 10000 },
  route:          { p50: 1000, p95: 3000, p99: 6000 },
  dispatch:       { p50: 500,  p95: 1500, p99: 3000 },
};

// Latency suite: run each 20 representative requests, record P50/P95/P99
// Alert if any service p95 exceeds 2× benchmark
```

### 7.8 Cost Per Request Benchmarks

```typescript
const COST_BENCHMARKS_USD = {
  chat:           { avg: 0.0003, alert_at: 0.001  },   // GPT-4o-mini
  intent:         { avg: 0.0001, alert_at: 0.0003 },   // GPT-4o-mini (short)
  nl_shipment:    { avg: 0.005,  alert_at: 0.015  },   // GPT-4o
  doc_extraction: { avg: 0.008,  alert_at: 0.025  },   // GPT-4o vision
  route:          { avg: 0.002,  alert_at: 0.008  },   // Google Maps costs
  dispatch:       { avg: 0.0,    alert_at: 0.0    },   // no LLM
};

// Total daily budget alert: if SUM(estimated_cost_usd) from ai_usage_logs
// WHERE DATE(created_at) = TODAY exceeds $20 → admin_notification (critical)
```

### 7.9 Running Evaluations

```bash
# CI pipeline: run on every PR to main
npx ts-node backend/src/evaluation/runner/EvaluationRunner.ts \
  --types intent_accuracy,extraction_accuracy \
  --limit 20 \
  --model gpt-4o-mini \
  --fail-below 0.85

# Weekly full suite (scheduled)
npx ts-node backend/src/evaluation/runner/EvaluationRunner.ts \
  --types all \
  --output evaluation_results.json
```

---

## 8. Monitoring

### 8.1 Structured Logging

Replace all `console.log` and `console.error` calls with a structured logger.

```typescript
// backend/src/utils/logger.ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: { level: (label) => ({ level: label }) },
  base: { service: 'benji-backend', env: process.env.NODE_ENV },
});

// Standard log fields for every AI request:
interface BenjiLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  requestId: string;        // UUID per request
  userId?: string;
  service: string;
  intent?: string;
  durationMs: number;
  tokensUsed?: number;
  costUsd?: number;
  cacheHit?: boolean;
  model?: string;
  success: boolean;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

// Usage:
logger.info({ requestId, userId, service: 'chat', durationMs: 450,
              tokensUsed: 1200, costUsd: 0.00018, cacheHit: false }, 'chat complete');
logger.error({ requestId, service: 'nl_shipment', errorCode: 'OPENAI_TIMEOUT' }, 'agent timeout');
```

Remove ALL `console.log(token.slice(0, 20))` debug lines from:
- `website/src/components/driver/BenjiLoadRecommendations.tsx`
- `website/src/services/aiService.ts`

### 8.2 Health Endpoint

```typescript
// GET /api/v1/benji/health
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'down';
  checks: {
    supabase:  { status: string; latencyMs: number };
    openai:    { status: string; latencyMs: number; remainingQuota?: number };
    googleMaps: { status: string; latencyMs: number };
  };
  version: string;
  uptime: number;
}
// Runs lightweight ping to each dependency
// Returns 200 if healthy, 503 if any critical dependency down
```

### 8.3 Admin Monitoring Dashboard

New page: `/dashboard/admin/ai-monitoring`

Metrics to display (sourced from `ai_usage_logs`):

| Metric | Query | Chart type |
|---|---|---|
| Requests/hour by service | GROUP BY service, DATE_TRUNC('hour', created_at) | Line |
| Tokens/day total | SUM(total_tokens) by day | Bar |
| Daily cost USD | SUM(estimated_cost_usd) by day | Bar |
| Cache hit rate | AVG(cache_hit::int) by service | Stat cards |
| Error rate | AVG((NOT success)::int) by service | Stat cards |
| p95 latency by service | PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) | Table |
| Top users by token usage | GROUP BY user_id ORDER BY SUM(total_tokens) DESC LIMIT 10 | Table |
| Budget utilization | TODAY_COST / DAILY_BUDGET | Progress bar |

### 8.4 Alerts via Admin Notifications

All alerts call `createAdminNotification()`. Alert conditions:

| Condition | Severity | Check frequency |
|---|---|---|
| Daily OpenAI cost > $16 (80% of $20 budget) | high | Every event processor run |
| Daily OpenAI cost > $20 | critical | Every event processor run |
| Any service error rate > 5% in last 5 min | high | Every 5 min (cron) |
| Any service p95 latency > 2× benchmark in last 5 min | medium | Every 5 min |
| User daily token budget exceeded | medium | Per request |
| Evaluation suite pass rate < benchmark | high | Post eval run |
| Hallucination detected in evaluation | critical | Post eval run |
| SMS delivery failure rate > 10% | high | Per hour |

### 8.5 Retry Strategy

```typescript
// backend/src/utils/retry.ts

interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
  retryOn: (error: unknown) => boolean;
}

const RETRY_CONFIGS: Record<string, RetryOptions> = {
  openai: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    jitter: true,
    retryOn: (err) => isRateLimitError(err) || isNetworkError(err)
    // Do NOT retry: 400 bad request, 401 auth, 400 content policy
  },
  googleMaps: {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 4000,
    jitter: false,
    retryOn: (err) => isNetworkError(err) || isRetryableGMapsError(err)
  },
  supabase: {
    maxAttempts: 2,
    baseDelayMs: 200,
    maxDelayMs: 1000,
    jitter: false,
    retryOn: (err) => isNetworkError(err) || isConnectionError(err)
    // Never retry: RLS violations, constraint violations
  }
};

// Exponential backoff with jitter:
// delay = min(baseDelay * 2^attempt, maxDelay) + (jitter ? random(0, 200) : 0)
```

### 8.6 Feature Flags (Fixed)

```typescript
// backend/src/config/features.ts
// REMOVE all || true overrides

export const FEATURE_FLAGS = {
  NATURAL_LANGUAGE:        process.env['ENABLE_NATURAL_LANGUAGE']        === 'true',
  DOCUMENT_EXTRACTION:     process.env['ENABLE_DOCUMENT_EXTRACTION']     === 'true',
  BENJI_DISPATCHER:        process.env['ENABLE_BENJI_DISPATCHER']        === 'true',
  LOAD_RECOMMENDATIONS:    process.env['ENABLE_LOAD_RECOMMENDATIONS']    === 'true',
  ROUTE_OPTIMIZATION:      process.env['ENABLE_ROUTE_OPTIMIZATION']      === 'true',
  BENJI_MEMORY:            process.env['ENABLE_BENJI_MEMORY']            === 'true',
  BENJI_EVENTS:            process.env['ENABLE_BENJI_EVENTS']            === 'true',
  BENJI_SMS:               process.env['ENABLE_BENJI_SMS']               === 'true',
  BENJI_EVALUATION:        process.env['ENABLE_BENJI_EVALUATION']        === 'true',
};

// Default all to false in Railway. Enable one by one during rollout.
// Required Railway env vars for full v2:
// ENABLE_NATURAL_LANGUAGE=true
// ENABLE_DOCUMENT_EXTRACTION=true
// ENABLE_BENJI_DISPATCHER=true
// ENABLE_LOAD_RECOMMENDATIONS=true
// ENABLE_ROUTE_OPTIMIZATION=true
// (memory, events, SMS, evaluation enable in later phases)
```

---

## 9. Deployment Plan

### Phase 1 — Immediate Wins (Days 1–3)
*No new tables, no new routes. All changes backward-compatible.*

| Task | File(s) | Risk |
|---|---|---|
| Delete `AIDispatcherService.ts` | `backend/src/services/` | Low — verify no imports first |
| Delete `dispatcher.ts` route | `backend/src/routes/` | Low — verify route not used |
| Remove all `\|\| true` feature flags | `backend/src/config/features.ts` | Medium — redeploy with env vars set first |
| Fix hardcoded Railway URL | `website/src/components/driver/BenjiLoadRecommendations.tsx` | Low |
| Remove debug `console.log` token lines | `BenjiLoadRecommendations.tsx`, `aiService.ts` | Low |
| Extract `benji-utils.ts` | `backend/src/utils/benji-utils.ts` | Low — no interface changes |
| Fix aiResponseCache key namespacing | `backend/src/config/ai.config.ts` | Medium — clears existing cache on deploy |

**Validation:** Run `npx tsc --noEmit`. Deploy to Railway. Monitor error rate for 30 minutes.

---

### Phase 2 — Database Layer (Days 4–7)

| Task | Files |
|---|---|
| Write + apply 6 SQL migrations | `supabase/migrations/20260702_*.sql` |
| Create `BenjiMemoryService.ts` | `backend/src/services/benji/` |
| Create `BenjiEventService.ts` | `backend/src/services/benji/` |
| Migrate `aiUsageTracker` → `ai_usage_logs` writes | `BenjiChatService`, `NLShipmentService`, `AIDocService` |
| Add event processor cron job | `backend/src/jobs/eventProcessor.ts` |

**Validation:**
1. Apply migrations in Supabase SQL Editor.
2. POST a chat message → verify `ai_usage_logs` row created.
3. POST a shipment create → verify `benji_events` row created.
4. Verify cron runs without error every 60s (Railway logs).

---

### Phase 3 — New API Gateway (Days 8–14)

| Task | Files |
|---|---|
| Create `BenjiCoreService.ts` | `backend/src/services/benji/` |
| Create `BenjiIntentService.ts` | `backend/src/services/benji/` |
| Create `benji.routes.ts` | `backend/src/routes/` |
| Wire `/api/v1/benji/*` routes (all 9 groups) | `backend/src/app.ts` |
| Conversation persistence in `BenjiChatService` | `backend/src/services/benji/BenjiChatService.ts` |
| Update `website/src/services/aiService.ts` to call new routes | `website/src/services/aiService.ts` |
| Update `BenjiLoadRecommendations.tsx` to call new route | `website/src/components/driver/` |

**Keep old `/api/v1/ai/*` routes active in parallel** (do not remove yet).

**Validation:**
1. `npx tsc --noEmit` — zero errors.
2. End-to-end test: chat → intent classified → response from new route.
3. Verify old routes still work (backward compat).

---

### Phase 4 — Memory Layer + Driver Features (Days 15–21)

| Task | Files |
|---|---|
| Memory injection in `BenjiChatService` | context block in system prompt |
| Driver location tracking via events | `BenjiEventService.onShipmentDelivered` |
| Implement `acceptLoad()` in `BenjiLoadService` | `backend/src/services/benji/BenjiLoadService.ts` |
| Update `BenjiLoadRecommendations.tsx` to call `POST /benji/dispatch/accept/:loadId` | frontend |
| `benji_preferences` CRUD via `/benji/memory/preferences` | routes + service |
| Conversation summarization in `BenjiChatService` | trigger at message_count > 30 |

**Validation:**
1. Accept a load → verify `shipments` table updated, `benji_events` row emitted.
2. Chat 35 turns → verify summary created, messages trimmed.
3. Verify driver location memory updated after delivery completion.

---

### Phase 5 — Route Planner UI (Days 22–28)

| Task | Files |
|---|---|
| Build `/dashboard/driver/route-planner` full UI | `website/src/app/dashboard/driver/route-planner/page.tsx` |
| Multi-stop input form | accepts addresses or existing shipment IDs |
| Route visualization (Google Maps Embed or polyline) | |
| Sidebar: stops list, ETA, fuel stops, break schedule | |
| "Optimize Route" → `POST /api/v1/benji/route/optimize` | |
| Mobile-responsive layout | |
| Deprecate old `/api/v1/ai/*` routes | `backend/src/routes/ai.routes.ts` |
| Remove backward-compat shims | `website/src/services/aiService.ts` |

**Validation:** Driver navigates to route planner → adds 3 stops → receives optimized route with ETA.

---

### Phase 6 — Evaluation & SMS (Days 29–35)

| Task | Files |
|---|---|
| Build golden test datasets | `backend/src/evaluation/golden/*.json` |
| Build `EvaluationRunner.ts` | `backend/src/evaluation/runner/` |
| Wire `/api/v1/benji/evaluate/*` routes | |
| Build `BenjiSmsService.ts` | `backend/src/services/benji/` |
| Wire `/api/v1/benji/sms/*` routes | |
| Build admin AI monitoring page | `website/src/app/dashboard/admin/ai-monitoring/page.tsx` |
| Add monitoring charts (ai_usage_logs queries) | |
| Add all alerting conditions to event processor | |
| CI integration: eval on PR to main | `.github/workflows/benji-eval.yml` |

**Validation:**
1. Run eval suite → results appear in `agent_evaluations` table.
2. Send SMS to test driver phone.
3. Admin monitoring page loads with real data.

---

### Environment Variables Required for v2

Add to Railway **before Phase 3 deploy**:

| Variable | Value | Phase needed |
|---|---|---|
| `ENABLE_NATURAL_LANGUAGE` | `true` | Phase 1 |
| `ENABLE_DOCUMENT_EXTRACTION` | `true` | Phase 1 |
| `ENABLE_BENJI_DISPATCHER` | `true` | Phase 1 |
| `ENABLE_LOAD_RECOMMENDATIONS` | `true` | Phase 1 |
| `ENABLE_ROUTE_OPTIMIZATION` | `true` | Phase 5 |
| `ENABLE_BENJI_MEMORY` | `true` | Phase 4 |
| `ENABLE_BENJI_EVENTS` | `true` | Phase 2 |
| `ENABLE_BENJI_SMS` | `true` | Phase 6 |
| `ENABLE_BENJI_EVALUATION` | `true` | Phase 6 |
| `BENJI_DAILY_BUDGET_USD` | `20` | Phase 2 |
| `BENJI_BUDGET_ALERT_THRESHOLD` | `0.8` | Phase 2 |
| `SMS_PROVIDER` | `twilio` or `vonage` | Phase 6 |
| `SMS_API_KEY` | *(provider key)* | Phase 6 |
| `SMS_FROM_NUMBER` | *(E.164 number)* | Phase 6 |
| `LOG_LEVEL` | `info` | Phase 1 |

---

### Rollback Strategy

Each phase is independently deployable and independently rollback-able:

- **Phase 1:** Git revert the commit. No DB changes.
- **Phase 2:** DROP the 6 new tables (they have no FKs from existing tables). Revert code.
- **Phase 3:** Set `ENABLE_BENJI_*` env vars to `false` → old routes resume. Revert benji.routes.ts.
- **Phase 4–6:** Feature flags off → capabilities disabled without code revert.

**Never deploy Phase 3+ on a Friday.**

---

*Document owner: Engineering Lead*
*Review cycle: After each phase completion*
*Related documents: BENJI_SYSTEM_AUDIT.md, BENJI_AI_ARCHITECTURE.md*
