# Benji V2 — Cognitive Intelligence Layer
*Classification: DESIGN SPECIFICATION — Builds on BENJI_V2_ORCHESTRATOR.md*
*Date: 2026-07-01 | Status: Approved for Engineering*

> **Design principle:** This layer sits ABOVE the Tool Registry and BELOW the Orchestrator entry point. It does not replace tools, validation, or events. It adds planning, memory-influenced routing, and graph-based execution between intent and action.

---

## Table of Contents
1. [Architecture Overview — Where the Cognitive Layer Fits](#1-architecture-overview)
2. [Memory Influence Engine](#2-memory-influence-engine)
3. [Benji Planner Service](#3-benji-planner-service)
4. [Plan Templates (Deterministic)](#4-plan-templates-deterministic)
5. [Tool Graph Executor (DAG)](#5-tool-graph-executor-dag)
6. [Updated Full Execution Pipeline](#6-updated-full-execution-pipeline)
7. [Failure Handling Strategy](#7-failure-handling-strategy)
8. [New Event Types](#8-new-event-types)
9. [File Structure](#9-file-structure)

---

## 1. Architecture Overview

### 1.1 Layer Positions

The three new components slot into the existing architecture without replacing anything below them:

```
 ┌──────────────────────────────────────────────────────────────────────────┐
 │                      INPUT ADAPTERS (unchanged)                          │
 │          Chat · SMS · API · Voice · Webhook                              │
 └──────────────────────────────────┬───────────────────────────────────────┘
                                    │  OrchestratorRequest
 ┌──────────────────────────────────▼───────────────────────────────────────┐
 │                     BENJI ORCHESTRATOR (updated)                         │
 │  Authorize → Budget Check → Memory Retrieval                             │
 └──────────────────────────────────┬───────────────────────────────────────┘
                                    │  raw memory data
 ┌──────────────────────────────────▼───────────────────────────────────────┐
 │              ★ MEMORY INFLUENCE ENGINE (NEW)                             │
 │  Analyzes behavioral patterns → produces MemoryInfluence                 │
 └──────────────────────────────────┬───────────────────────────────────────┘
                                    │  MemoryInfluence
 ┌──────────────────────────────────▼───────────────────────────────────────┐
 │                  INTENT CLASSIFICATION (unchanged)                        │
 │  Keyword match → GPT-4o-mini fallback                                    │
 └──────────────────────────────────┬───────────────────────────────────────┘
                                    │  intent + confidence + entities
 ┌──────────────────────────────────▼───────────────────────────────────────┐
 │                  ★ BENJI PLANNER (NEW)                                   │
 │  Template match or LLM-generated plan → BenjiPlan (DAG of steps)        │
 └──────────────────────────────────┬───────────────────────────────────────┘
                                    │  BenjiPlan
 ┌──────────────────────────────────▼───────────────────────────────────────┐
 │                  DECISION VALIDATION LAYER (unchanged)                    │
 │  Pre-execution gate — validates entire plan before first step             │
 └──────────────────────────────────┬───────────────────────────────────────┘
                                    │  approved BenjiPlan
 ┌──────────────────────────────────▼───────────────────────────────────────┐
 │                  ★ TOOL GRAPH EXECUTOR (NEW)                             │
 │  Topological sort → wave batching → parallel execution → ExecutionResult │
 └──────────────────────────────────┬───────────────────────────────────────┘
                                    │  ExecutionResult
 ┌──────────────────────────────────▼───────────────────────────────────────┐
 │                  TOOL REGISTRY (unchanged)                                │
 │  15 deterministic tool wrappers over existing services                   │
 └──────────────────────────────────┬───────────────────────────────────────┘
                                    │
 ┌──────────────────────────────────▼───────────────────────────────────────┐
 │  EXISTING SERVICES (unchanged)                                           │
 │  BenjiChatService · NLShipmentService · RouteOptimizationService ·       │
 │  BenjiDispatcherService · BenjiLoadRecommendationService ·               │
 │  AIDocumentExtractionService · pricing.service · twilio.service          │
 └──────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Architectural Contracts

**Before this layer (Orchestrator → Tool — OLD):**
```
intent → selectTools(intent) → for each tool: registry.execute()
```

**After this layer (Orchestrator → Planner → DAG — NEW):**
```
intent + MemoryInfluence → planner.createPlan() → executor.run(plan) → ExecutionResult
```

The orchestrator **never calls the tool registry directly** after this change. All tool calls flow through `ToolGraphExecutor.run()`.

---

## 2. Memory Influence Engine

### 2.1 Purpose

Memory is not a data store to be consulted at query time. It is a **behavioral signal** that must reshape decisions before the planner sees the intent. The `MemoryInfluenceEngine` reads raw `benji_memory`, `benji_preferences`, and recent `benji_events` to produce a `MemoryInfluence` object that the planner uses to construct a personalized plan.

```
backend/src/services/benji/MemoryInfluenceEngine.ts   ← NEW
```

---

### 2.2 Inputs and Output Contract

```typescript
// Inputs to the engine
interface MemoryInfluenceInput {
  userId:        string;
  userType:      UserType;
  intent:        BenjiIntent;
  rawMemory:     BenjiMemoryEntry[];      // from tool:memory.read
  preferences:   BenjiPreferences | null; // from benji_preferences table
  recentEvents?: BenjiEvent[];            // last 30 events for this user (optional, async)
}

// Output — consumed by BenjiPlanner
interface MemoryInfluence {
  // How much to adjust the raw intent confidence score
  // Positive = memory supports this intent; negative = memory suggests it might be wrong
  confidenceAdjustment:   number;         // range: -0.3 to +0.2

  // Tool preferences derived from behavioral history
  preferredActions:       string[];       // tool names to prefer in plan (ordered)
  avoidedActions:         string[];       // tool names to deprioritize or omit

  // Routing bias — injected into tool:dispatch.recommendations input
  routingBias: {
    maxDistanceMiles?:    number;         // cap on pickup distance
    preferredStates?:     string[];       // states to prioritize in recommendations
    minEarningsPerMile?:  number;         // filter threshold
    maxPickupDays?:       number;         // urgency preference (null = no limit)
    preferredVehicleTypes?: string[];
  };

  // Communication channel preference for response formatting
  communicationChannel:   InputChannel;   // 'chat' | 'sms' | 'api'

  // Confidence threshold adjustments for the validation layer
  // If user frequently fails validation → request clarification earlier
  clarificationThreshold: number;         // default 0.60; memory can raise to 0.75

  // Human-readable facts the planner can use to personalize steps
  // Max 5 entries, each max 80 chars
  contextualNotes:        string[];

  // Source tracing — which memory entries drove each influence
  derivedFrom:            string[];       // benji_memory keys that contributed
}
```

---

### 2.3 Influence Derivation Rules

The engine computes `MemoryInfluence` from a set of behavioral signal processors. Each processor examines one class of behavioral data and contributes to the output.

**Each processor runs independently. Outputs are merged.** No processor throws — failures return neutral output.

---

#### Signal 1: Load Rejection Pattern (`drivers only`)

```
Data source: recent benji_events WHERE event_type IN ('load_declined', 'load_accepted')
              AND user_id = driverId AND created_at > now() - interval '30 days'

Logic:
  rejected = events WHERE event_type = 'load_declined'
  accepted = events WHERE event_type = 'load_accepted'

  if rejected.count >= 3:
    longHaulRejections = rejected WHERE payload.distanceMiles > 500
    if longHaulRejections.count / rejected.count > 0.60:
      routingBias.maxDistanceMiles = 350    // driver prefers regional
      contextualNotes += "Driver tends to decline long-haul loads"

    statePatterns = rejected GROUP BY payload.deliveryState
    mostRejectedState = statePatterns.top(1)
    avoidedActions contexts: reduce weight on loads to mostRejectedState

  if accepted.count >= 3:
    preferredStates = accepted MAP payload.deliveryState DISTINCT
    routingBias.preferredStates = preferredStates
    contextualNotes += "Driver has accepted loads to: " + preferredStates.join(', ')

    avgEarnings = accepted AVG (payload.estimatedEarnings / payload.distanceMiles)
    routingBias.minEarningsPerMile = avgEarnings * 0.85  // 15% below average = threshold
```

---

#### Signal 2: Channel Preference

```
Data source: recent benji_events WHERE event_type IN ('orchestrator_complete', 'sms_received')
              AND user_id = userId AND created_at > now() - interval '14 days'

Logic:
  smsTurns  = events WHERE source = 'sms'
  chatTurns = events WHERE source = 'chat'

  if smsTurns.count > chatTurns.count * 1.5:
    communicationChannel = 'sms'
    preferredActions += 'tool:sms.send'      // planner adds SMS reply step
    contextualNotes += "User primarily communicates via SMS"

  else if benji_preferences.sms_notifications = false:
    communicationChannel = 'chat'
    avoidedActions += 'tool:sms.send'        // don't add SMS step when not opted in
```

---

#### Signal 3: Earnings Preference (`drivers only`)

```
Data source: benji_memory WHERE key = 'avg_acceptance_rate' OR key = 'preferred_routes'
             benji_preferences.min_earnings_per_mile
             benji_preferences.target_weekly_earnings

Logic:
  if preferences.minEarningsPerMile is not null:
    routingBias.minEarningsPerMile = preferences.minEarningsPerMile
    contextualNotes += "Min earnings threshold: $" + preferences.minEarningsPerMile + "/mi"

  if memory key='avg_acceptance_rate' confidence > 0.6:
    acceptanceRate = memory.value.rate
    if acceptanceRate < 0.40:
      // Low acceptance rate → raise clarification threshold
      // Benji should ask more before recommending
      clarificationThreshold = 0.75
      contextualNotes += "Driver has low acceptance rate — prefer specific matches only"
```

---

#### Signal 4: Home Location and Proximity Bias

```
Data source: benji_memory WHERE key = 'last_known_position' OR key = 'home_city'
             benji_preferences.home_location
             benji_preferences.max_pickup_radius_miles

Logic:
  if preferences.homeLocation is not null:
    routingBias.maxDistanceMiles = preferences.maxPickupRadiusMiles ?? 100
    contextualNotes += "Home base: " + preferences.homeLocation

  if memory key='last_known_position' ageHours < 24:
    // Fresh position — planner can use real coordinates in route/dispatch tools
    contextualNotes += "Current position known (updated " + ageHours + "h ago)"
  else:
    contextualNotes += "Position stale — proximity scoring may be approximate"
```

---

#### Signal 5: Repeated Validation Failures

```
Data source: recent benji_events WHERE event_type = 'validation_failed'
              AND user_id = userId AND created_at > now() - interval '7 days'

Logic:
  recentFailures = events WHERE event_type = 'validation_failed'

  if recentFailures.count >= 3:
    missingFieldsFreq = recentFailures FLATMAP payload.missingFields FREQUENCY
    topMissingField = missingFieldsFreq.top(1)

    // Raise threshold: Benji should ask for this field proactively
    clarificationThreshold = Math.min(0.85, clarificationThreshold + 0.10)
    contextualNotes += "User often omits: " + topMissingField + ". Ask proactively."
    confidenceAdjustment -= 0.10   // lower raw confidence slightly — this user needs hand-holding
```

---

#### Signal 6: Communication Style from Memory

```
Data source: benji_conversations WHERE user_id = userId ORDER BY last_message_at DESC LIMIT 1

Logic:
  if latestConversation.summary includes 'confused' OR 'unclear':
    contextualNotes += "User was confused in last session — use simpler language"
    clarificationThreshold = Math.min(0.85, clarificationThreshold + 0.05)

  if latestConversation.message_count > 15:
    contextualNotes += "User tends to have long conversations — patience mode"
```

---

### 2.4 Engine Timeout and Graceful Degradation

The `MemoryInfluenceEngine` must complete within **300ms**. If it times out:

```typescript
// Neutral influence object — planning proceeds without personalization
const NEUTRAL_INFLUENCE: MemoryInfluence = {
  confidenceAdjustment:   0,
  preferredActions:       [],
  avoidedActions:         [],
  routingBias:            {},
  communicationChannel:   'chat',
  clarificationThreshold: 0.60,
  contextualNotes:        [],
  derivedFrom:            [],
};
```

A timeout emits a `memory_influence_timeout` event but **does not block planning**. The plan proceeds with neutral influence.

---

## 3. Benji Planner Service

### 3.1 Purpose

The planner converts `intent + MemoryInfluence + context` into a `BenjiPlan` — a structured Directed Acyclic Graph of tool steps. The orchestrator passes this plan directly to the `ToolGraphExecutor`. **The orchestrator never selects or calls tools itself.**

```
backend/src/services/benji/BenjiPlanner.ts   ← NEW
```

---

### 3.2 Core Type Contracts

```typescript
// ─── Plan Step ────────────────────────────────────────────────────────────

interface BenjiPlanStep {
  stepId:          string;               // unique within plan: 'step-01', 'step-02', ...
  action:          PlanStepAction;       // tool name OR special action type
  description:     string;               // human-readable (for event payload + logging)
  input:           StepInput;            // static object OR resolver function
  dependsOn:       string[];             // stepIds this step must wait for ([] = no deps)
  critical:        boolean;              // if true: failure stops entire execution
  fallbackAction?: string;               // tool name to try if this step fails
  retryConfig:     RetryConfig;
  timeout?:        number;               // override tool default (ms)
  memoryWrites?:   MemoryWriteSpec[];    // on success: extract value and write to benji_memory
}

// Action types for plan steps
type PlanStepAction =
  // Tool calls (from tool registry)
  | 'tool:memory.read'
  | 'tool:memory.write'
  | 'tool:shipment.parse'
  | 'tool:shipment.create'
  | 'tool:shipment.lookup'
  | 'tool:shipment.status_update'
  | 'tool:pricing.calculate'
  | 'tool:route.optimize'
  | 'tool:dispatch.analyze'
  | 'tool:dispatch.assign'
  | 'tool:dispatch.recommendations'
  | 'tool:dispatch.accept'
  | 'tool:document.extract'
  | 'tool:sms.send'
  | 'tool:driver.lookup'
  | 'tool:chat.respond'
  // Special orchestrator actions (not tool calls)
  | 'validate'              // trigger DecisionValidator at this step
  | 'branch'                // conditional: select next step based on prior output
  | 'escalate'              // route to human support
  | 'synthesize';           // merge multiple prior step outputs for response

// Step input: static object OR resolver that reads from prior step outputs
type StepInput =
  | Record<string, unknown>
  | ((priorOutputs: Record<string, ToolResult<unknown>>) => Record<string, unknown>);

// Memory write specification: extract a value from step output, write to benji_memory
interface MemoryWriteSpec {
  key:        string;       // benji_memory.key
  valuePath:  string;       // dot-notation path into step output: e.g. 'data.shipmentId'
  memoryType: 'fact' | 'preference' | 'context';
  confidence: number;
  expiresInDays?: number;
}

interface RetryConfig {
  maxAttempts: number;      // default 1 (no retry); 3 for transient tools
  backoffMs:   number;      // initial backoff; doubles each attempt
  retryOn:     'transient_only' | 'any_failure';
}

// ─── Plan ─────────────────────────────────────────────────────────────────

interface BenjiPlan {
  planId:            string;
  intent:            BenjiIntent;
  planType:          'template' | 'generated';  // template = deterministic; generated = LLM
  confidence:        number;           // planner's confidence in the plan (0–1)
  steps:             BenjiPlanStep[];
  estimatedWaves:    number;           // how many parallel execution batches
  estimatedLatencyMs: number;          // sum of critical-path step latencies
  estimatedCostUsd:  number;           // sum of AI tool costs
  fallbackPlanId?:   string;           // simpler plan to use if this one fails
  influenceApplied:  boolean;          // whether MemoryInfluence modified the plan
  createdAt:         string;
}
```

---

### 3.3 Planner Decision Tree

```typescript
class BenjiPlanner {
  async createPlan(
    intent:    BenjiIntent,
    influence: MemoryInfluence,
    context:   OrchestratorRequest
  ): Promise<BenjiPlan> {

    // Step 1: Attempt template match (deterministic, zero cost)
    const template = PLAN_TEMPLATES[intent];
    if (template) {
      const plan = this.applyTemplate(template, intent, influence, context);
      return this.applyMemoryInfluence(plan, influence);
    }

    // Step 2: No template → check if intent is a known complex multi-step task
    if (COMPLEX_INTENT_PATTERNS.includes(intent)) {
      return this.generatePlanWithLLM(intent, influence, context);
    }

    // Step 3: Unknown intent → minimal fallback plan
    return this.buildFallbackPlan(intent, influence, context);
  }

  // Applies MemoryInfluence to a template plan
  // - Adds SMS step if communicationChannel = 'sms'
  // - Adjusts dispatch step inputs with routingBias
  // - Prepends contextualNotes to chat.respond input
  private applyMemoryInfluence(plan: BenjiPlan, influence: MemoryInfluence): BenjiPlan

  // For novel multi-step tasks (e.g. "reschedule and notify both parties")
  // Uses GPT-4o with a structured output prompt → validates generated plan structure
  private async generatePlanWithLLM(
    intent: BenjiIntent,
    influence: MemoryInfluence,
    context: OrchestratorRequest
  ): Promise<BenjiPlan>

  // Returns: [memory.read, chat.respond] — always valid
  private buildFallbackPlan(
    intent: BenjiIntent,
    influence: MemoryInfluence,
    context: OrchestratorRequest
  ): BenjiPlan
}
```

---

### 3.4 LLM Plan Generation

For complex intents without a template, the planner calls GPT-4o with a structured prompt.

**Prompt file:** `backend/src/services/benji/prompts/planner.generate.v1.txt`

```
You are a logistics AI planning engine.

Given a user request, produce a valid execution plan as JSON.
You MUST only use tools from this registry:
{{tool_list}}

CONSTRAINTS:
- Maximum {{max_steps}} steps
- Steps with no dependencies on each other should share dependsOn: []
- Only set critical: true if failure of this step makes the entire task impossible
- Prefer fewer steps over more steps
- Never call tool:sms.send unless specifically needed for notification
- Memory reads always come first and are never critical

USER TYPE: {{user_type}}
USER REQUEST: "{{raw_input}}"
KNOWN CONTEXT: {{context_summary}}
MEMORY NOTES: {{contextual_notes}}

Respond with this JSON structure only:
{
  "intent": "<intent>",
  "confidence": <0.0-1.0>,
  "steps": [
    {
      "stepId": "step-01",
      "action": "<tool name>",
      "description": "<what this step does>",
      "input": { <static fields only; use "__prior__.<stepId>.data.<field>" for dynamic values> },
      "dependsOn": [],
      "critical": <boolean>,
      "fallbackAction": "<tool name or null>"
    }
  ]
}
```

**Generated plan validation** (runs immediately after GPT output, before returning to orchestrator):

```typescript
function validateGeneratedPlan(raw: unknown): BenjiPlan | null {
  // Rule 1: All tool names must exist in tool registry
  // Rule 2: No step can depend on a stepId not in the plan
  // Rule 3: No circular dependencies (topological sort must succeed)
  // Rule 4: At most one 'validate' step
  // Rule 5: step count must be between 2 and MAX_STEPS (12)
  // Rule 6: At least one step must be critical: true
  // If any rule fails → return null → fallback plan used
}
```

If generated plan fails validation → emit `plan_generation_failed` event → use fallback plan.

---

## 4. Plan Templates (Deterministic)

Templates cover all 13 known intents. Template plans are constructed at zero cost (no LLM). The planner applies `MemoryInfluence` to personalize them after construction.

### Dependency Notation

`[A, B]` = runs after both A and B complete.  
`[]` = runs immediately (no dependencies).  
Steps sharing the same dependency set run in parallel.

---

### Template: `simple_chat`
*Intents: `faq`, `account_help`, `payment_help`, `other`*

```
step-01  tool:memory.read              deps:[]         critical:false
step-02  tool:chat.respond             deps:[01]       critical:true

Memory influence:
  if communicationChannel = 'sms' → append:
  step-03  tool:sms.send (template: clarification_request)  deps:[02]  critical:false
```

**Wave 1:** step-01  
**Wave 2:** step-02  
**Wave 3:** step-03 (if SMS influence applied)

---

### Template: `track_shipment`

```
step-01  tool:memory.read              deps:[]         critical:false
step-02  tool:shipment.lookup          deps:[]         critical:true
         (parallel with step-01: both have empty deps)
step-03  tool:chat.respond             deps:[01,02]    critical:true

Memory write on step-02 success:
  key='last_tracked_shipment', valuePath='data.shipments[0].id', type='context'
```

**Wave 1:** step-01 + step-02 (parallel)  
**Wave 2:** step-03

---

### Template: `get_quote`

```
step-01  tool:memory.read              deps:[]         critical:false
step-02  tool:shipment.parse           deps:[01]       critical:true
         input: { prompt: rawInput, inputMethod: channel }
         // parse to extract vehicleType, pickup, delivery (no DB write)
step-03  tool:pricing.calculate        deps:[02]       critical:true
         input: (prior) => ({
           vehicleType: prior['step-02'].data.parsed.vehicle,
           pickupLocation: prior['step-02'].data.parsed.pickup,
           deliveryLocation: prior['step-02'].data.parsed.delivery
         })
step-04  tool:chat.respond             deps:[01,03]    critical:true
         input: includes memory block + quote breakdown
```

**Wave 1:** step-01  
**Wave 2:** step-02  
**Wave 3:** step-03  
**Wave 4:** step-04

---

### Template: `create_shipment`

```
step-01  tool:memory.read              deps:[]         critical:false
step-02  tool:shipment.parse           deps:[01]       critical:true
         retryConfig: { maxAttempts:1, backoffMs:0, retryOn:'transient_only' }
step-03  tool:pricing.calculate        deps:[02]       critical:false
         // non-critical: shipment can be created without a price estimate
step-04  validate                      deps:[02,03]    critical:true
         // runs SHIPMENT_CREATE rules: SC-001 through SC-009
         // blocks if confidence < clarificationThreshold from MemoryInfluence
step-05  tool:shipment.create          deps:[04]       critical:true
step-06  tool:chat.respond             deps:[01,05]    critical:true
step-07  tool:sms.send                 deps:[05]       critical:false
         template: 'load_confirmation'
         // only included if communicationChannel = 'sms' OR preferences.sms_notifications

Memory writes on step-05 success:
  key='last_created_shipment', valuePath='data.shipmentId', type='context', expiresInDays:30
```

**Wave 1:** step-01  
**Wave 2:** step-02  
**Wave 3:** step-03  
**Wave 4:** step-04  
**Wave 5:** step-05  
**Wave 6:** step-06 + step-07 (parallel)

---

### Template: `find_load`

```
step-01  tool:memory.read              deps:[]         critical:false
step-02  tool:dispatch.recommendations deps:[01]       critical:true
         input: (prior) => ({
           driverId: context.userId,
           currentLocation: prior['step-01'].data.lastKnownPosition,
           // MemoryInfluence.routingBias injected here:
           routingBias: influence.routingBias
         })
step-03  tool:chat.respond             deps:[01,02]    critical:true
         // formats top recommendations with personalized notes
```

**Wave 1:** step-01  
**Wave 2:** step-02  
**Wave 3:** step-03

---

### Template: `accept_load`

```
step-01  tool:memory.read              deps:[]         critical:false
step-02  tool:shipment.lookup          deps:[]         critical:true
         input: { shipmentId: context.context.shipmentId }
         (parallel with step-01)
step-03  validate                      deps:[01,02]    critical:true
         // runs LOAD_ACCEPT rules: LA-001 through LA-005
step-04  tool:dispatch.accept          deps:[03]       critical:true
step-05  tool:sms.send                 deps:[04]       critical:false
         template: 'load_confirmation'
step-06  tool:chat.respond             deps:[01,04]    critical:true
step-07  tool:memory.write             deps:[04]       critical:false
         entries: [
           { key:'last_accepted_load',    valuePath:'data.shipmentId', type:'context' },
           { key:'last_known_position',   valuePath='data.pickupCity',  type:'context', expiresInDays:7 }
         ]
```

**Wave 1:** step-01 + step-02 (parallel)  
**Wave 2:** step-03  
**Wave 3:** step-04  
**Wave 4:** step-05 + step-06 + step-07 (parallel)

---

### Template: `route_optimize`

```
step-01  tool:memory.read              deps:[]         critical:false
step-02  tool:dispatch.recommendations deps:[01]       critical:false
         // fetch driver's assigned shipments as route stops
         input: { driverId: context.userId, currentLocation: prior[01].lastKnownPosition }
step-03  validate                      deps:[02]       critical:true
         // runs ROUTE_OPTIMIZE rules: RO-001 through RO-004
step-04  tool:route.optimize           deps:[01,03]    critical:true
         input: (prior) => ({
           driverId: context.userId,
           stops: buildStopsFromAssigned(prior['step-02'].data),
           currentLocation: prior['step-01'].data.lastKnownPosition,
           vehicleType: prior['step-01'].data.preferences?.preferred_vehicle_types?.[0]
         })
step-05  tool:chat.respond             deps:[01,04]    critical:true
step-06  tool:sms.send                 deps:[04]       critical:false
         template: 'route_ready'
         // added unconditionally for route_optimize (drivers need route on phone)
```

**Wave 1:** step-01  
**Wave 2:** step-02  
**Wave 3:** step-03  
**Wave 4:** step-04  
**Wave 5:** step-05 + step-06 (parallel)

---

### Template: `dispatch_analyze`

```
step-01  tool:memory.read              deps:[]         critical:false
step-02  tool:dispatch.analyze         deps:[]         critical:true
         (parallel with step-01: analysis needs no memory)
step-03  tool:chat.respond             deps:[01,02]    critical:true
         // formats: efficiency score, top matches, recommended actions
```

**Wave 1:** step-01 + step-02 (parallel)  
**Wave 2:** step-03

---

### Template: `dispatch_assign`

```
step-01  tool:memory.read              deps:[]         critical:false
step-02  tool:dispatch.analyze         deps:[]         critical:true
step-03  validate                      deps:[01,02]    critical:true
         // runs DISPATCH_ASSIGN rules: DA-001 through DA-005
step-04  tool:dispatch.assign          deps:[03]       critical:true
         input: (prior) => ({
           assignments: prior['step-02'].data.optimalMatches
             .filter(m => m.confidence > 80)
             .map(m => ({ shipmentId: m.load.id, driverId: m.driver.id }))
         })
step-05  tool:driver.lookup            deps:[04]       critical:false
         // fetch phone numbers for all newly assigned drivers
step-06  tool:sms.send                 deps:[05]       critical:false
         template: 'load_assigned'
         // one SMS per driver (executor fans out)
step-07  tool:chat.respond             deps:[01,04]    critical:true
         // summary: X loads assigned, efficiency gain, estimated revenue
```

**Wave 1:** step-01 + step-02 (parallel)  
**Wave 2:** step-03  
**Wave 3:** step-04  
**Wave 4:** step-05  
**Wave 5:** step-06 + step-07 (parallel)

---

### Template: `upload_document`

```
step-01  tool:memory.read              deps:[]         critical:false
step-02  validate                      deps:[]         critical:true
         // runs DOCUMENT_EXTRACT rules: DE-001 through DE-004 on fileUrl, type, size
step-03  tool:document.extract         deps:[02]       critical:true
         retryConfig: { maxAttempts:2, backoffMs:2000, retryOn:'transient_only' }
step-04  tool:chat.respond             deps:[01,03]    critical:true
         // summarize extraction result; flag requiresReview if confidence < 0.85
```

**Wave 1:** step-01 + step-02 (parallel)  
**Wave 2:** step-03  
**Wave 3:** step-04

---

### Template: `escalate_human`

```
step-01  escalate     deps:[]   critical:true
         // no tools — immediate handoff
         // emits 'support_ticket' admin_notification
         // emits 'orchestrator_escalated' benji_event
```

**Wave 1:** step-01 (single step)

---

### Template Impact of Memory Influence

After template selection, `applyMemoryInfluence()` applies these modifications:

| Influence Signal | Template Modification |
|---|---|
| `communicationChannel = 'sms'` | Add `tool:sms.send` (appropriate template) step if not already present |
| `avoidedActions` contains `tool:sms.send` | Remove any non-critical SMS steps |
| `routingBias.maxDistanceMiles` is set | Inject into `tool:dispatch.recommendations` and `tool:route.optimize` inputs |
| `routingBias.preferredStates` is set | Inject into `tool:dispatch.recommendations` inputs |
| `clarificationThreshold > 0.60` | Lower `validate` step's internal confidence threshold |
| `contextualNotes` non-empty | Prepend formatted notes to `tool:chat.respond` input's `memoryBlock` |
| `preferredActions` non-empty | Reorder non-critical steps to run preferred tools earlier |

---

## 5. Tool Graph Executor (DAG)

### 5.1 Purpose

The `ToolGraphExecutor` takes a validated `BenjiPlan` and executes it as a Directed Acyclic Graph. It handles:
- Topological sorting of steps into execution waves
- Parallel execution within each wave
- Per-step retry logic
- Critical failure detection and chain stopping
- `ExecutionResult` assembly with full step audit

```
backend/src/services/benji/ToolGraphExecutor.ts   ← NEW
```

---

### 5.2 Output Contract

```typescript
interface ExecutionResult {
  planId:           string;
  status:           'completed' | 'partial' | 'failed';
  stepResults:      StepResult[];
  completedSteps:   number;
  failedSteps:      number;
  skippedSteps:     number;        // steps skipped due to upstream critical failure
  criticalFailure?: {
    stepId:         string;
    action:         string;
    error:          string;
  };
  totalLatencyMs:   number;
  totalCostUsd:     number;
  // Aggregated outputs: { stepId → ToolResult<T> }
  // Used by response synthesis to build OrchestratorResponse.reply
  stepOutputs:      Record<string, ToolResult<unknown>>;
}

interface StepResult {
  stepId:         string;
  action:         string;
  description:    string;
  status:         'completed' | 'failed' | 'skipped' | 'retried_and_completed';
  output?:        unknown;     // raw ToolResult.data (non-sensitive fields only)
  error?:         string;
  attempts:       number;      // 1 = no retry; > 1 = retry occurred
  latencyMs:      number;
  cached:         boolean;
  eventsEmitted:  string[];    // event IDs written during this step
}
```

---

### 5.3 DAG Construction Algorithm

```typescript
class ToolGraphExecutor {

  // Step 1: Validate DAG (no cycles, all dependsOn references exist)
  private buildDAG(steps: BenjiPlanStep[]): DAGNode[] {
    const nodeMap = new Map(steps.map(s => [s.stepId, { step: s, inDegree: 0, dependents: [] }]));

    for (const step of steps) {
      for (const depId of step.dependsOn) {
        if (!nodeMap.has(depId)) throw new Error(`Unknown dependency: ${depId}`);
        nodeMap.get(depId)!.dependents.push(step.stepId);
        nodeMap.get(step.stepId)!.inDegree++;
      }
    }

    // Kahn's algorithm: verify no cycles
    const sorted = kahnTopologicalSort(nodeMap);
    if (sorted.length !== steps.length) throw new Error('Circular dependency detected in plan');
    return sorted;
  }

  // Step 2: Group steps into execution waves
  // Each wave: all steps whose dependencies have all completed
  private computeWaves(dag: DAGNode[]): BenjiPlanStep[][] {
    const waves: BenjiPlanStep[][] = [];
    const completed = new Set<string>();
    const remaining = [...dag];

    while (remaining.length > 0) {
      const wave = remaining.filter(n =>
        n.step.dependsOn.every(dep => completed.has(dep))
      );
      if (wave.length === 0) throw new Error('Unreachable steps in DAG');
      waves.push(wave.map(n => n.step));
      wave.forEach(n => { completed.add(n.step.stepId); });
      wave.forEach(n => remaining.splice(remaining.indexOf(n), 1));
    }

    return waves;
  }

  // Step 3: Execute waves sequentially, steps within a wave in parallel
  async run(plan: BenjiPlan, context: ToolContext): Promise<ExecutionResult> {
    const dag = this.buildDAG(plan.steps);
    const waves = this.computeWaves(dag);
    const allStepResults: StepResult[] = [];
    const allStepOutputs: Record<string, ToolResult<unknown>> = {};
    let criticalFailure: ExecutionResult['criticalFailure'] | undefined;
    const startTime = Date.now();

    for (const wave of waves) {
      if (criticalFailure) {
        // Skip remaining waves: critical step failed
        wave.forEach(step => allStepResults.push(buildSkippedResult(step)));
        continue;
      }

      // Execute all steps in this wave concurrently
      const waveResults = await Promise.all(
        wave.map(step => this.executeStep(step, allStepOutputs, context))
      );

      for (const result of waveResults) {
        allStepResults.push(result);
        if (result.output) allStepOutputs[result.stepId] = result.output as ToolResult<unknown>;

        // Critical failure check
        if (result.status === 'failed' && wave.find(s => s.stepId === result.stepId)?.critical) {
          criticalFailure = {
            stepId: result.stepId,
            action: result.action,
            error:  result.error ?? 'Critical step failed',
          };
          await emitEvent('execution_critical_failure', { planId: plan.planId, ...criticalFailure });
          break;
        }
      }
    }

    const completed = allStepResults.filter(r => r.status !== 'failed' && r.status !== 'skipped').length;
    const failed    = allStepResults.filter(r => r.status === 'failed').length;
    const skipped   = allStepResults.filter(r => r.status === 'skipped').length;

    const status: ExecutionResult['status'] =
      criticalFailure                     ? 'failed'
      : failed > 0 || skipped > 0        ? 'partial'
      : 'completed';

    return {
      planId: plan.planId,
      status,
      stepResults: allStepResults,
      completedSteps: completed,
      failedSteps: failed,
      skippedSteps: skipped,
      criticalFailure,
      totalLatencyMs: Date.now() - startTime,
      totalCostUsd: allStepResults.reduce((sum, r) => sum + (r as any).costUsd ?? 0, 0),
      stepOutputs: allStepOutputs,
    };
  }
}
```

---

### 5.4 Step Execution with Retry

```typescript
private async executeStep(
  step:         BenjiPlanStep,
  priorOutputs: Record<string, ToolResult<unknown>>,
  context:      ToolContext
): Promise<StepResult> {
  const start = Date.now();
  let attempts = 0;
  let lastError = '';

  // Resolve dynamic input
  const input = typeof step.input === 'function'
    ? step.input(priorOutputs)
    : step.input;

  // Emit: plan_step_started
  await emitEvent('plan_step_started', {
    planId: context.planId, stepId: step.stepId, action: step.action
  });

  while (attempts < step.retryConfig.maxAttempts) {
    attempts++;

    let result: ToolResult<unknown>;

    if (step.action === 'validate') {
      // Special action: run DecisionValidator, not a tool
      result = await this.runValidationStep(step, priorOutputs, context);
    } else if (step.action === 'escalate') {
      result = await this.runEscalationStep(context);
    } else if (step.action === 'synthesize') {
      result = await this.runSynthesisStep(step, priorOutputs, context);
    } else {
      // Normal tool call through registry
      result = await toolRegistry.execute(step.action, input, context);
    }

    if (result.success) {
      // Write memory if step has memoryWrites
      if (step.memoryWrites?.length) {
        await this.processMemoryWrites(step.memoryWrites, result, context);
      }

      // Emit: plan_step_completed
      await emitEvent('plan_step_completed', {
        planId: context.planId, stepId: step.stepId, cached: result.cached,
        latencyMs: Date.now() - start
      });

      return {
        stepId: step.stepId, action: step.action, description: step.description,
        status: attempts > 1 ? 'retried_and_completed' : 'completed',
        output: result.data, attempts, latencyMs: Date.now() - start, cached: result.cached ?? false,
        eventsEmitted: [],
      };
    }

    lastError = result.error ?? 'Unknown error';

    // Retry conditions
    const shouldRetry =
      attempts < step.retryConfig.maxAttempts &&
      (step.retryConfig.retryOn === 'any_failure' || isTransientError(lastError));

    if (shouldRetry) {
      await sleep(step.retryConfig.backoffMs * Math.pow(2, attempts - 1));
      continue;
    }

    // Try fallback action if available and we've exhausted primary retries
    if (step.fallbackAction && attempts >= step.retryConfig.maxAttempts) {
      const fallbackResult = await toolRegistry.execute(step.fallbackAction, input, context);
      if (fallbackResult.success) {
        await emitEvent('plan_step_fallback_used', {
          planId: context.planId, stepId: step.stepId,
          primaryAction: step.action, fallbackAction: step.fallbackAction
        });
        return {
          stepId: step.stepId, action: step.fallbackAction, description: step.description + ' (fallback)',
          status: 'completed', output: fallbackResult.data,
          attempts, latencyMs: Date.now() - start, cached: false, eventsEmitted: [],
        };
      }
    }

    break;
  }

  // All attempts exhausted
  await emitEvent('plan_step_failed', {
    planId: context.planId, stepId: step.stepId, action: step.action,
    error: lastError, attempts, critical: step.critical
  });

  return {
    stepId: step.stepId, action: step.action, description: step.description,
    status: 'failed', error: lastError,
    attempts, latencyMs: Date.now() - start, cached: false, eventsEmitted: [],
  };
}
```

---

### 5.5 Fan-Out Pattern (SMS to Multiple Recipients)

For `dispatch_assign`, the plan must send one SMS per assigned driver. The step action handles fan-out:

```typescript
// In step-06 of dispatch_assign template:
// action: 'tool:sms.send'
// input resolver reads the array from dispatch.assign output and fans out

input: (prior) => ({
  fanOut: true,      // executor flag: run this tool once per item in 'recipients'
  recipients: prior['step-04'].data.assigned
    .filter(a => a.success)
    .map(a => ({ toUserId: a.driverId, templateId: 'load_assigned', templateVars: {
      shipmentId: a.shipmentId, pickupCity: '...'   // resolved from step-04 output
    }}))
})

// ToolGraphExecutor detects fanOut: true → runs tool once per recipient
// Records one StepResult per recipient, keyed: 'step-06:driver-uuid'
// Any individual SMS failure is non-critical (step is non-critical)
```

---

### 5.6 Response Synthesis

After execution, `OrchestratorResponse.reply` is synthesized from `ExecutionResult.stepOutputs`:

```typescript
function synthesizeReply(
  result:    ExecutionResult,
  plan:      BenjiPlan,
  context:   OrchestratorRequest,
  influence: MemoryInfluence
): string {
  // Priority: last successful tool:chat.respond output
  const chatStep = plan.steps.findLast(s => s.action === 'tool:chat.respond');
  if (chatStep) {
    const chatOutput = result.stepOutputs[chatStep.stepId];
    if (chatOutput?.success) return chatOutput.data.message;
  }

  // Fallback: build reply from other step outputs
  if (result.status === 'failed') {
    const criticalStep = plan.steps.find(s => s.stepId === result.criticalFailure?.stepId);
    return buildFailureReply(result.criticalFailure, criticalStep, context.inputChannel);
  }

  if (result.status === 'partial') {
    return buildPartialReply(result, plan, context.inputChannel);
  }

  // Completed but no chat step (e.g. dispatch_assign)
  return buildActionSummaryReply(result, plan, context.inputChannel);
}
```

---

## 6. Updated Full Execution Pipeline

This replaces §5.1 of `BENJI_V2_ORCHESTRATOR.md`.

```
╔══════════════════════════════════════════════════════════════════════╗
║                  STEP 1–2: RECEIVE + NORMALIZE                       ║
║  Channel adapter → OrchestratorRequest (canonical format)            ║
║  SMS quick commands detected here (LOADS, ACCEPT, STATUS, ROUTE)     ║
╚══════════════════════════════════════════════════════════════════════╝
                              │
                              ▼
╔══════════════════════════════════════════════════════════════════════╗
║                STEP 3: AUTHORIZE + BUDGET CHECK                      ║
║  Verify userId, userType, daily token budget                         ║
╚══════════════════════════════════════════════════════════════════════╝
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼  (parallel, max 500ms)
╔══════════════════╗   ╔══════════════════════════════════════════════╗
║  tool:memory.read║   ║  Conversation load (benji_conversations)     ║
╚══════════════════╝   ╚══════════════════════════════════════════════╝
                    └─────────┬──────────┘
                              │  raw memory data
                              ▼
╔══════════════════════════════════════════════════════════════════════╗
║              ★ STEP 4: MEMORY INFLUENCE ENGINE                       ║
║  MemoryInfluenceEngine.analyze(userId, userType, rawMemory, events)  ║
║  Output: MemoryInfluence (confidenceAdjustment, routingBias, etc.)   ║
║  Timeout: 300ms → neutral influence on timeout                       ║
║  Emit: 'memory_influence_applied' event (fire-and-forget)            ║
╚══════════════════════════════════════════════════════════════════════╝
                              │  MemoryInfluence
                              ▼
╔══════════════════════════════════════════════════════════════════════╗
║                  STEP 5: INTENT CLASSIFICATION                       ║
║  Keyword match → GPT-4o-mini fallback                                ║
║  Raw confidence adjusted by MemoryInfluence.confidenceAdjustment     ║
║  if adjustedConfidence < influence.clarificationThreshold:           ║
║    → skip planner → CLARIFICATION FLOW                               ║
╚══════════════════════════════════════════════════════════════════════╝
                              │  intent + adjustedConfidence + entities
                              ▼
╔══════════════════════════════════════════════════════════════════════╗
║                    ★ STEP 6: BENJI PLANNER                           ║
║  BenjiPlanner.createPlan(intent, influence, context)                 ║
║  → Template match (deterministic, 0ms, 0 cost)                       ║
║  → applyMemoryInfluence() personalizes plan steps                    ║
║  → LLM generation only if no template exists                         ║
║  Output: BenjiPlan (steps + dependencies)                            ║
║  Emit: 'plan_created' event                                          ║
╚══════════════════════════════════════════════════════════════════════╝
                              │  BenjiPlan
                              ▼
╔══════════════════════════════════════════════════════════════════════╗
║                 STEP 7: PRE-EXECUTION VALIDATION GATE                ║
║  DecisionValidator validates the PLAN (not just one action)          ║
║  Checks: can all required inputs be resolved from context/memory?    ║
║  Checks: does the plan contain any disallowed action for this role?  ║
║  APPROVED → pass plan to executor                                    ║
║  REJECTED → clarification flow (zero execution)                      ║
║  Emit: 'validation_passed' or 'validation_failed'                    ║
╚══════════════════════════════════════════════════════════════════════╝
                              │  approved BenjiPlan
                              ▼
╔══════════════════════════════════════════════════════════════════════╗
║                 ★ STEP 8: TOOL GRAPH EXECUTION                       ║
║  ToolGraphExecutor.run(plan, context)                                ║
║  → Build DAG (topological sort + cycle check)                        ║
║  → Compute execution waves                                           ║
║  → Execute each wave: Promise.all(wave steps)                        ║
║  → Per step: retry → fallback → emit step events                     ║
║  → Critical failure detection between waves                          ║
║  → Fan-out for SMS multi-recipient steps                             ║
║  Output: ExecutionResult                                             ║
╚══════════════════════════════════════════════════════════════════════╝
                              │  ExecutionResult
                              ▼
╔══════════════════════════════════════════════════════════════════════╗
║                    STEP 9: EVENT EMISSION                            ║
║  Fire-and-forget: 'orchestrator_complete' event                      ║
║  (step-level events already emitted inside executor)                 ║
╚══════════════════════════════════════════════════════════════════════╝
                              │
                              ▼
╔══════════════════════════════════════════════════════════════════════╗
║               STEP 10: RESPONSE SYNTHESIS + MEMORY WRITE             ║
║  synthesizeReply(result, plan, context, influence)                   ║
║  Format for output channel (chat/sms/api/voice)                      ║
║  Fire-and-forget: append to benji_conversations                      ║
║  Fire-and-forget: write ai_usage_logs                                ║
╚══════════════════════════════════════════════════════════════════════╝
                              │
                              ▼
╔══════════════════════════════════════════════════════════════════════╗
║              STEP 11: LOGGING + EVALUATION HOOKS                     ║
║  Write structured pino log entry (requestId, planId, steps, cost)    ║
║  If evaluation mode: write to agent_evaluations table                ║
╚══════════════════════════════════════════════════════════════════════╝
                              │
                              ▼
                  Return OrchestratorResponse to caller
```

---

### 6.1 Updated Latency Budget

| Step | p50 | p95 | Notes |
|---|---|---|---|
| 1–2: Normalize | 1ms | 5ms | |
| 3: Auth + budget | 20ms | 80ms | |
| 4: Memory (parallel) | 80ms | 300ms | 300ms hard timeout |
| 4★: Influence engine | +20ms | +50ms | Runs on cached memory data |
| 5: Intent (keyword) | 0ms | 2ms | |
| 5: Intent (GPT) | 300ms | 800ms | Only if no keyword match |
| 6★: Planner (template) | 1ms | 5ms | Zero cost |
| 6★: Planner (LLM) | 800ms | 2000ms | GPT-4o, rare path |
| 7: Pre-validation | 10ms | 40ms | |
| 8★: DAG execution (chat) | 400ms | 1200ms | 1 AI wave |
| 8★: DAG execution (create shipment) | 1500ms | 3500ms | Multiple waves |
| 8★: DAG execution (dispatch assign) | 800ms | 2000ms | 2 parallel waves |
| 9–11: Post-processing | 10ms | 30ms | Fire-and-forget |
| **Total — simple chat** | **~850ms** | **~1800ms** | |
| **Total — shipment create** | **~2500ms** | **~5500ms** | |
| **Total — dispatch assign** | **~1800ms** | **~4000ms** | |

---

## 7. Failure Handling Strategy

### 7.1 Planning Failure

Occurs when `BenjiPlanner.createPlan()` cannot produce a valid plan:

**Causes:**
- LLM-generated plan fails structural validation
- Intent is `other` with insufficient context
- Memory influence suggests the request is ambiguous

**Response:**
```typescript
// In BenjiPlanner.createPlan() failure path:
await emitEvent('plan_failed', {
  requestId: context.requestId,
  intent,
  reason: 'Could not generate valid execution plan',
  usedFallback: true,
});

// Always return fallback plan rather than null
// Fallback: [tool:memory.read, tool:chat.respond]
// chat.respond is instructed to ask clarifying questions
return buildFallbackPlan(intent, influence, context);
```

**Rule:** Planner **never returns null**. It always returns a plan, at minimum the `simple_chat` template. Planning failure means the plan returned is a clarification-requesting fallback, not an absence of a plan.

---

### 7.2 Critical Step Failure

When a step with `critical: true` fails all retry attempts and has no viable fallback:

```
critical step failed
  │
  ▼
ToolGraphExecutor marks criticalFailure
  │
  ▼
All subsequent waves are skipped (steps marked 'skipped')
  │
  ▼
ExecutionResult.status = 'failed'
  │
  ▼
Event 'execution_critical_failure' emitted
  │
  ▼
synthesizeReply builds failure reply:
  - Explains what failed in user-friendly language
  - Does NOT expose internal error messages
  - Suggests what the user can do (retry, contact support, provide missing info)
  │
  ▼
If critical step was 'validate':
  → Route to clarification flow (not generic error)
If critical step was a DB write:
  → "Something went wrong. Your request was not processed. Please try again."
If critical step was an AI tool (OpenAI):
  → "I'm having trouble processing that right now. Try again in a moment."
```

---

### 7.3 Partial Execution

When non-critical steps fail but critical steps succeed:

```
ExecutionResult.status = 'partial'
  │
  ▼
Core action was completed (e.g., shipment created)
Non-critical side effects failed (e.g., SMS not sent)
  │
  ▼
synthesizeReply: communicate the success, mention what didn't complete
  Example: "Your shipment has been created (ID: #12345).
            We weren't able to send you a confirmation SMS this time."
  │
  ▼
Event 'execution_partial' emitted with failed step details
  │
  ▼
Admin notification created if:
  - Failed step was 'tool:sms.send' with severity > low
  - Failed step was 'tool:shipment.create' with any failure
```

---

### 7.4 Retry Policy by Step Type

| Step Action | Default maxAttempts | Retry On | Backoff |
|---|---|---|---|
| `tool:memory.read` | 1 | — | — |
| `tool:memory.write` | 2 | transient_only | 200ms |
| `tool:shipment.parse` | 1 | — | — |
| `tool:shipment.create` | 2 | transient_only | 500ms |
| `tool:shipment.lookup` | 2 | transient_only | 200ms |
| `tool:pricing.calculate` | 2 | transient_only | 500ms |
| `tool:route.optimize` | 2 | transient_only | 1000ms |
| `tool:dispatch.*` | 1 | — | — |
| `tool:document.extract` | 2 | transient_only | 2000ms |
| `tool:sms.send` | 3 | transient_only | 1000ms |
| `tool:chat.respond` | 2 | transient_only | 1000ms |
| `validate` | 1 | — | — |
| `escalate` | 1 | — | — |

**Transient error detection:**
```typescript
function isTransientError(error: string): boolean {
  const transientPatterns = [
    /ECONNRESET/, /ETIMEDOUT/, /ENOTFOUND/,  // network
    /429/,                                     // rate limit
    /503/, /502/, /504/,                       // server errors
    /connection/i, /timeout/i,
  ];
  return transientPatterns.some(p => p.test(error));
}
```

---

## 8. New Event Types

### 8.1 SQL Migration

```sql
-- supabase/migrations/20260702_benji_events_cognitive_types.sql
-- Run AFTER orchestrator event types migration

ALTER TYPE benji_event_type ADD VALUE IF NOT EXISTS 'plan_created';
ALTER TYPE benji_event_type ADD VALUE IF NOT EXISTS 'plan_failed';
ALTER TYPE benji_event_type ADD VALUE IF NOT EXISTS 'plan_generation_failed';
ALTER TYPE benji_event_type ADD VALUE IF NOT EXISTS 'plan_step_started';
ALTER TYPE benji_event_type ADD VALUE IF NOT EXISTS 'plan_step_completed';
ALTER TYPE benji_event_type ADD VALUE IF NOT EXISTS 'plan_step_failed';
ALTER TYPE benji_event_type ADD VALUE IF NOT EXISTS 'plan_step_fallback_used';
ALTER TYPE benji_event_type ADD VALUE IF NOT EXISTS 'execution_started';
ALTER TYPE benji_event_type ADD VALUE IF NOT EXISTS 'execution_completed';
ALTER TYPE benji_event_type ADD VALUE IF NOT EXISTS 'execution_partial';
ALTER TYPE benji_event_type ADD VALUE IF NOT EXISTS 'execution_critical_failure';
ALTER TYPE benji_event_type ADD VALUE IF NOT EXISTS 'memory_influence_applied';
ALTER TYPE benji_event_type ADD VALUE IF NOT EXISTS 'memory_influence_timeout';
ALTER TYPE benji_event_type ADD VALUE IF NOT EXISTS 'execution_escalated';
```

### 8.2 Payload Schemas

```typescript
interface PlanCreatedPayload {
  requestId:         string;
  planId:            string;
  intent:            BenjiIntent;
  planType:          'template' | 'generated';
  stepCount:         number;
  estimatedWaves:    number;
  estimatedLatencyMs: number;
  estimatedCostUsd:  number;
  influenceApplied:  boolean;
}

interface PlanFailedPayload {
  requestId:    string;
  intent:       BenjiIntent;
  reason:       string;
  usedFallback: boolean;
}

interface PlanStepCompletedPayload {
  requestId:  string;
  planId:     string;
  stepId:     string;
  action:     string;
  latencyMs:  number;
  cached:     boolean;
  attempts:   number;
}

interface PlanStepFailedPayload {
  requestId:  string;
  planId:     string;
  stepId:     string;
  action:     string;
  error:      string;      // sanitized — no PII, no internal stack
  attempts:   number;
  critical:   boolean;
  usedFallback: boolean;
}

interface ExecutionCompletedPayload {
  requestId:      string;
  planId:         string;
  status:         'completed' | 'partial' | 'failed';
  completedSteps: number;
  failedSteps:    number;
  skippedSteps:   number;
  totalLatencyMs: number;
  totalCostUsd:   number;
}

interface MemoryInfluenceAppliedPayload {
  requestId:             string;
  userId:                string;
  confidenceAdjustment:  number;
  preferredActionsCount: number;
  avoidedActionsCount:   number;
  routingBiasApplied:    boolean;
  contextualNotesCount:  number;
  derivedFromCount:      number;     // how many memory entries drove this
  latencyMs:             number;
}
```

### 8.3 Full Execution Trace Query

With cognitive layer events, a complete trace for one request is now:

```sql
-- Complete cognitive trace for a single request
SELECT
  event_type,
  payload->>'stepId'    AS step_id,
  payload->>'action'    AS action,
  (payload->>'latencyMs')::int AS latency_ms,
  payload->>'status'    AS status,
  created_at
FROM benji_events
WHERE payload->>'requestId' = 'req-uuid-here'
ORDER BY created_at;

-- Expected events in order:
-- memory_influence_applied    (influence computed)
-- plan_created                (plan selected or generated)
-- validation_passed/failed    (plan gate)
-- plan_step_started × N      (one per step)
-- plan_step_completed × N    (or plan_step_failed)
-- execution_completed         (summary)
-- orchestrator_complete       (full response)
```

---

## 9. File Structure

### 9.1 New Files

```
backend/src/services/benji/
├── MemoryInfluenceEngine.ts     ← NEW (§2)
│     Signals: load rejection, channel preference, earnings, location, failures
│     Output: MemoryInfluence
│
├── BenjiPlanner.ts              ← NEW (§3)
│     createPlan(), applyMemoryInfluence(), generatePlanWithLLM()
│     buildFallbackPlan()
│
├── BenjiPlanTemplates.ts        ← NEW (§4)
│     PLAN_TEMPLATES: Record<BenjiIntent, TemplateFn>
│     13 template definitions with step DAGs
│
├── ToolGraphExecutor.ts         ← NEW (§5)
│     buildDAG(), computeWaves(), run(), executeStep()
│     Fan-out, retry, fallback, synthesizeReply()
│
└── prompts/
    └── planner.generate.v1.txt  ← NEW (§3.4)
          Used only when no template matches
```

### 9.2 Modified Files

```
backend/src/services/benji/
└── BenjiOrchestrator.ts         ← MODIFIED
      Remove: selectTools() direct tool call logic
      Add:    MemoryInfluenceEngine.analyze()
      Add:    BenjiPlanner.createPlan()
      Add:    ToolGraphExecutor.run()
      Remove: Direct calls to toolRegistry.execute()
```

### 9.3 Unchanged Files (Preserved Exactly)

```
backend/src/services/benji/
├── BenjiCoreService.ts              (shared math)
├── BenjiIntentService.ts            (intent classification)
├── BenjiMemoryService.ts            (read/write benji_memory)
├── BenjiEventService.ts             (event emission)
├── BenjiToolRegistry.ts             (15 tool wrappers)
├── DecisionValidator.ts             (30 validation rules)
└── prompts/PromptRegistry.ts        (prompt loader)

backend/src/services/
├── BenjiChatService.ts              (wrapped by tool:chat.respond)
├── BenjiDispatcherService.ts        (wrapped by tool:dispatch.*)
├── BenjiLoadRecommendationService.ts (wrapped by tool:dispatch.recommendations)
├── NaturalLanguageShipmentService.ts (wrapped by tool:shipment.*)
├── AIDocumentExtractionService.ts    (wrapped by tool:document.extract)
├── RouteOptimizationService.ts       (wrapped by tool:route.optimize)
├── pricing.service.ts                (wrapped by tool:pricing.calculate)
└── twilio.service.ts                 (wrapped by tool:sms.send)
```

---

*Related documents: BENJI_SYSTEM_AUDIT.md · BENJI_V2_IMPLEMENTATION_PLAN.md · BENJI_V2_ORCHESTRATOR.md*  
*Next step: Phase 3 implementation — BenjiPlanner.ts + ToolGraphExecutor.ts + MemoryInfluenceEngine.ts*
