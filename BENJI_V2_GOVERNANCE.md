# Benji V2 — Governance, Safety, and Observability Layer
*Classification: DESIGN SPECIFICATION — Builds on BENJI_V2_COGNITIVE_LAYER.md*
*Date: 2026-07-01 | Status: Approved for Engineering*

> **Design principle:** This layer does not add intelligence. It adds control, predictability, observability, and bounded learning. Every component here is a **constraint** on the intelligent layers beneath it, not an enhancement of them.

---

## Table of Contents
1. [Global Policy Guard](#1-global-policy-guard)
2. [Simulation Engine](#2-simulation-engine)
3. [System Safety State Machine](#3-system-safety-state-machine)
4. [Observability Layer](#4-observability-layer)
5. [Controlled Learning Layer](#5-controlled-learning-layer)
6. [Database Schema](#6-database-schema)
7. [Updated Full Pipeline with Governance](#7-updated-full-pipeline-with-governance)
8. [File Structure](#8-file-structure)

---

## 1. Global Policy Guard

### 1.1 Purpose

The `GlobalPolicyGuard` enforces **ten immutable rules** that no other layer — not memory, not the planner, not LLM output — can override. It is invoked at four checkpoints during pipeline execution (§3). It is not a single check at request intake; it re-validates at each state transition.

```
backend/src/services/benji/GlobalPolicyGuard.ts   ← NEW
```

---

### 1.2 Policy Rules (Immutable)

Rules are defined as a static registry. They cannot be modified at runtime — they are source code, not database entries. Changing a rule requires a code deploy, a version bump, and an admin acknowledgment log entry.

```typescript
interface PolicyRule {
  id:          string;         // 'P1' through 'P10'
  description: string;
  checkpoint:  PolicyCheckpoint[];  // which checkpoints invoke this rule
  severity:    'block' | 'warn';    // block = halt pipeline; warn = log only
  check:       (state: PolicyCheckState) => PolicyRuleResult;
}

type PolicyCheckpoint =
  | 'after_request_intake'     // before memory retrieval
  | 'after_memory_influence'   // before intent classification
  | 'after_plan_creation'      // before simulation
  | 'before_each_tool_call';   // before every tool execution in DAG

interface PolicyCheckState {
  request:         OrchestratorRequest;
  influence?:      MemoryInfluence;
  plan?:           BenjiPlan;
  currentStep?:    BenjiPlanStep;
  priorOutputs?:   Record<string, ToolResult<unknown>>;
  systemState:     SafetyState;   // from state machine
}

interface PolicyRuleResult {
  passed:   boolean;
  ruleId:   string;
  reason?:  string;             // present if passed = false
  evidence: string;             // what was checked and found
}
```

---

### 1.3 The Ten Policy Rules

```typescript
export const GLOBAL_POLICIES: PolicyRule[] = [

  {
    id: 'P1',
    description: 'Safety constraints cannot be weakened by memory influence',
    checkpoint: ['after_memory_influence'],
    severity: 'block',
    check: ({ influence }) => {
      // MemoryInfluence.clarificationThreshold may only be RAISED, never lowered below 0.55
      const FLOOR = 0.55;
      const passed = !influence || influence.clarificationThreshold >= FLOOR;
      return {
        passed,
        ruleId: 'P1',
        reason: passed ? undefined : `clarificationThreshold ${influence!.clarificationThreshold} is below floor ${FLOOR}`,
        evidence: `clarificationThreshold = ${influence?.clarificationThreshold ?? 'not set'}`,
      };
    },
  },

  {
    id: 'P2',
    description: 'Financial actions require validated inputs before execution',
    checkpoint: ['before_each_tool_call'],
    severity: 'block',
    check: ({ currentStep, priorOutputs }) => {
      const FINANCIAL_TOOLS = ['tool:shipment.create', 'tool:dispatch.assign', 'tool:dispatch.accept'];
      if (!FINANCIAL_TOOLS.includes(currentStep?.action ?? '')) return { passed: true, ruleId: 'P2', evidence: 'non-financial step' };

      // The plan MUST contain a 'validate' step that ran BEFORE this step
      const validateStepRan = Object.values(priorOutputs ?? {})
        .some(r => (r as any)._stepAction === 'validate' && r.success);
      return {
        passed: validateStepRan,
        ruleId: 'P2',
        reason: validateStepRan ? undefined : 'Financial tool called without prior validation step',
        evidence: `Tool: ${currentStep?.action}; validate step ran: ${validateStepRan}`,
      };
    },
  },

  {
    id: 'P3',
    description: 'No tool execution allowed without a validated intent classification',
    checkpoint: ['after_plan_creation'],
    severity: 'block',
    check: ({ plan, request }) => {
      // Intent must be set and not 'other' with low confidence when a mutation tool is planned
      const MUTATION_TOOLS = ['tool:shipment.create', 'tool:dispatch.assign', 'tool:dispatch.accept',
                               'tool:shipment.status_update'];
      const hasMutation = plan?.steps.some(s => MUTATION_TOOLS.includes(s.action)) ?? false;
      if (!hasMutation) return { passed: true, ruleId: 'P3', evidence: 'no mutation tools in plan' };

      const intentClassified = !!(request as any)._classifiedIntent;
      return {
        passed: intentClassified,
        ruleId: 'P3',
        reason: intentClassified ? undefined : 'Mutation tool planned but intent was not classified',
        evidence: `intent = ${(request as any)._classifiedIntent ?? 'UNSET'}`,
      };
    },
  },

  {
    id: 'P4',
    description: 'External communication (SMS) must be an explicit plan step — never implicit',
    checkpoint: ['before_each_tool_call'],
    severity: 'block',
    check: ({ currentStep, plan }) => {
      if (currentStep?.action !== 'tool:sms.send') return { passed: true, ruleId: 'P4', evidence: 'non-SMS step' };
      // The SMS step MUST appear in the plan (not injected at runtime)
      const inPlan = plan?.steps.some(s => s.stepId === currentStep.stepId) ?? false;
      return {
        passed: inPlan,
        ruleId: 'P4',
        reason: inPlan ? undefined : 'SMS tool called from outside the plan',
        evidence: `stepId ${currentStep.stepId} in plan: ${inPlan}`,
      };
    },
  },

  {
    id: 'P5',
    description: 'No silent state mutation — every DB write must be followed by an event',
    checkpoint: ['before_each_tool_call'],
    severity: 'warn',   // warn only — enforced by BenjiEventService, this catches regressions
    check: ({ currentStep, systemState }) => {
      const MUTATION_TOOLS = ['tool:shipment.create', 'tool:dispatch.assign', 'tool:dispatch.accept',
                               'tool:shipment.status_update', 'tool:memory.write'];
      if (!MUTATION_TOOLS.includes(currentStep?.action ?? '')) return { passed: true, ruleId: 'P5', evidence: 'non-mutation step' };
      // Events are emitted inside the tool wrappers — this checks that event emission is enabled
      const eventsEnabled = process.env['ENABLE_BENJI_EVENTS'] === 'true';
      return {
        passed: eventsEnabled,
        ruleId: 'P5',
        reason: eventsEnabled ? undefined : 'ENABLE_BENJI_EVENTS is disabled but mutation tool is executing',
        evidence: `ENABLE_BENJI_EVENTS = ${process.env['ENABLE_BENJI_EVENTS']}`,
      };
    },
  },

  {
    id: 'P6',
    description: 'Missing critical data MUST trigger clarification, not assumption',
    checkpoint: ['after_plan_creation'],
    severity: 'block',
    check: ({ plan, priorOutputs }) => {
      // After tool:shipment.parse runs, check missingFields
      const parseOutput = Object.entries(priorOutputs ?? {})
        .find(([, r]) => (r as any)._stepAction === 'tool:shipment.parse');
      if (!parseOutput) return { passed: true, ruleId: 'P6', evidence: 'no shipment parse step yet' };

      const missingFields: string[] = parseOutput[1].data?.missingFields ?? [];
      const planHasCreateStep = plan?.steps.some(s => s.action === 'tool:shipment.create');

      if (planHasCreateStep && missingFields.length > 0) {
        return {
          passed: false,
          ruleId: 'P6',
          reason: `Plan attempts shipment create with missing required fields: ${missingFields.join(', ')}`,
          evidence: `missingFields = [${missingFields.join(', ')}]`,
        };
      }
      return { passed: true, ruleId: 'P6', evidence: `missingFields = [${missingFields.join(', ')}]` };
    },
  },

  {
    id: 'P7',
    description: 'Planner output MUST pass schema validation before execution',
    checkpoint: ['after_plan_creation'],
    severity: 'block',
    check: ({ plan }) => {
      if (!plan) return { passed: false, ruleId: 'P7', reason: 'Plan is null', evidence: 'plan = null' };

      const errors: string[] = [];
      if (!plan.planId)                               errors.push('missing planId');
      if (!plan.intent)                               errors.push('missing intent');
      if (!Array.isArray(plan.steps))                 errors.push('steps is not an array');
      if (plan.steps.length === 0)                    errors.push('steps array is empty');
      if (plan.steps.length > 20)                     errors.push(`too many steps: ${plan.steps.length}`);

      for (const step of plan.steps ?? []) {
        if (!step.stepId)                             errors.push(`step missing stepId`);
        if (!step.action)                             errors.push(`step ${step.stepId} missing action`);
        if (typeof step.critical !== 'boolean')       errors.push(`step ${step.stepId} critical is not boolean`);
        if (!Array.isArray(step.dependsOn))           errors.push(`step ${step.stepId} dependsOn is not array`);
      }

      return {
        passed: errors.length === 0,
        ruleId: 'P7',
        reason: errors.length > 0 ? `Plan schema errors: ${errors.join('; ')}` : undefined,
        evidence: `steps = ${plan.steps?.length}; errors = ${errors.length}`,
      };
    },
  },

  {
    id: 'P8',
    description: 'Execution engine MUST reject cyclic or incomplete DAGs',
    checkpoint: ['after_plan_creation'],
    severity: 'block',
    check: ({ plan }) => {
      if (!plan?.steps) return { passed: false, ruleId: 'P8', reason: 'No steps', evidence: '' };

      const stepIds = new Set(plan.steps.map(s => s.stepId));
      const errors: string[] = [];

      // All dependsOn references must exist
      for (const step of plan.steps) {
        for (const dep of step.dependsOn) {
          if (!stepIds.has(dep)) errors.push(`step ${step.stepId} depends on unknown stepId: ${dep}`);
        }
      }

      // Cycle detection via DFS
      if (errors.length === 0) {
        const visited = new Set<string>();
        const inStack = new Set<string>();

        function hasCycle(stepId: string): boolean {
          if (inStack.has(stepId)) return true;
          if (visited.has(stepId)) return false;
          visited.add(stepId); inStack.add(stepId);
          const step = plan.steps.find(s => s.stepId === stepId);
          for (const dep of step?.dependsOn ?? []) {
            if (hasCycle(dep)) return true;
          }
          inStack.delete(stepId);
          return false;
        }
        if (plan.steps.some(s => hasCycle(s.stepId))) {
          errors.push('Cyclic dependency detected in plan DAG');
        }
      }

      return {
        passed: errors.length === 0,
        ruleId: 'P8',
        reason: errors.length > 0 ? errors.join('; ') : undefined,
        evidence: `steps = ${plan.steps.length}; errors = ${errors.length}`,
      };
    },
  },

  {
    id: 'P9',
    description: 'No adaptive learning can modify core scoring weights without versioned approval',
    checkpoint: ['after_request_intake'],
    severity: 'block',
    check: ({ systemState }) => {
      // Verify that no unapproved learning update is active
      // The learning layer writes to benji_config with status='pending' until approved
      // This check reads a cached flag set by BenjiLearningService
      const unapprovedUpdateActive = globalPolicyCache.get('unapproved_weight_update_active') === true;
      return {
        passed: !unapprovedUpdateActive,
        ruleId: 'P9',
        reason: unapprovedUpdateActive ? 'Unapproved learning update is active in scoring weights' : undefined,
        evidence: `unapprovedUpdateActive = ${unapprovedUpdateActive}`,
      };
    },
  },

  {
    id: 'P10',
    description: 'All decisions MUST be traceable via event log',
    checkpoint: ['after_request_intake'],
    severity: 'block',
    check: ({ request }) => {
      // Tracing is only valid if events are enabled AND trace service is running
      const eventsEnabled = process.env['ENABLE_BENJI_EVENTS'] === 'true';
      const tracingEnabled = process.env['ENABLE_BENJI_TRACING'] === 'true';
      const requestHasId = !!request.requestId;

      const passed = eventsEnabled && tracingEnabled && requestHasId;
      return {
        passed,
        ruleId: 'P10',
        reason: passed ? undefined
          : `Tracing preconditions failed: events=${eventsEnabled}, tracing=${tracingEnabled}, requestId=${requestHasId}`,
        evidence: `ENABLE_BENJI_EVENTS=${eventsEnabled}; ENABLE_BENJI_TRACING=${tracingEnabled}; requestId=${request.requestId}`,
      };
    },
  },

];
```

---

### 1.4 Policy Guard Invocation

```typescript
class GlobalPolicyGuard {

  // Called at each checkpoint; returns all failures
  async check(
    checkpoint: PolicyCheckpoint,
    state:      PolicyCheckState
  ): Promise<PolicyGuardResult> {

    const applicableRules = GLOBAL_POLICIES.filter(r => r.checkpoint.includes(checkpoint));
    const results: PolicyRuleResult[] = [];

    for (const rule of applicableRules) {
      const result = rule.check(state);
      results.push(result);

      if (!result.passed) {
        // Always log violation immediately — no buffering
        await this.logViolation(checkpoint, rule, result, state);
      }
    }

    const blockers  = results.filter(r => !r.passed && GLOBAL_POLICIES.find(p => p.id === r.ruleId)?.severity === 'block');
    const warnings  = results.filter(r => !r.passed && GLOBAL_POLICIES.find(p => p.id === r.ruleId)?.severity === 'warn');

    return {
      passed:    blockers.length === 0,
      blockers,
      warnings,
      checkpoint,
    };
  }

  private async logViolation(
    checkpoint: PolicyCheckpoint,
    rule:       PolicyRule,
    result:     PolicyRuleResult,
    state:      PolicyCheckState
  ): Promise<void> {
    // Fire-and-forget to policy_violations table + benji_events
    await Promise.allSettled([
      supabase.from('policy_violations').insert({
        rule_id:      rule.id,
        checkpoint,
        request_id:   state.request.requestId,
        user_id:      state.request.userId,
        reason:       result.reason,
        evidence:     result.evidence,
        severity:     rule.severity,
        created_at:   new Date().toISOString(),
      }),
      benjiEventService.emit({
        eventType:  'policy_violation',
        source:     'system',
        userId:     state.request.userId,
        payload:    { ruleId: rule.id, checkpoint, reason: result.reason, severity: rule.severity },
      }),
    ]);
  }
}

interface PolicyGuardResult {
  passed:     boolean;
  blockers:   PolicyRuleResult[];   // severity = 'block' failures
  warnings:   PolicyRuleResult[];   // severity = 'warn' failures
  checkpoint: PolicyCheckpoint;
}
```

**If `passed = false`:** The orchestrator immediately routes to clarification flow (same as validation failure). The plan is discarded. No tool execution occurs.

---

## 2. Simulation Engine

### 2.1 Purpose

Before any plan executes, the `SimulationEngine` performs a **dry-run** — estimating costs, latency, risk, and predicted failure points — without touching any external service, database (writes), or communication channel.

```
backend/src/services/benji/SimulationEngine.ts   ← NEW
```

The simulation completes in < 50ms because it uses only cached historical data and static formulas.

---

### 2.2 Output Contract

```typescript
interface SimulationResult {
  planId:            string;
  requestId:         string;
  predictedSteps:    number;
  predictedWaves:    number;          // parallel execution batches
  estimatedCostUsd:  number;          // sum of AI tool cost estimates
  estimatedLatencyMs: number;         // critical path latency
  riskScore:         number;          // 0.0–1.0 (see §2.4)
  riskFactors:       RiskFactor[];    // breakdown of what drove riskScore
  sideEffects:       string[];        // human-readable list of what WOULD happen
  wouldFailAt?:      string;          // stepId most likely to fail (from history)
  wouldFailReason?:  string;
  executionGate:     SimulationGate;
  simulatedAt:       string;
}

interface RiskFactor {
  name:         string;
  score:        number;          // 0.0–1.0 contribution to riskScore
  weight:       number;          // weight in final score
  explanation:  string;
}

type SimulationGate = 'proceed' | 'confirm' | 'block';
// 'proceed'  → riskScore ≤ 0.70: execute immediately
// 'confirm'  → 0.70 < riskScore ≤ 0.85: add confirmation step or request clarification
// 'block'    → riskScore > 0.85: refuse execution entirely
```

---

### 2.3 What the Simulation Does NOT Do

The simulation engine is prohibited from:

| Prohibited Action | Enforcement |
|---|---|
| Calling OpenAI API | `SimulationEngine` has no `openai` import |
| Calling Google Maps API | No `google-maps.service` import |
| Calling `twilioService.sendSMS()` | No Twilio import |
| Writing to any Supabase table | Only `SELECT` queries allowed (read-only mode) |
| Reading real-time data (live positions, live prices) | Uses only `benji_memory` (already loaded) |
| Starting timers or async side effects | Synchronous only |

---

### 2.4 Risk Score Calculation

The risk score is a weighted sum of five factors. Each factor is normalized to 0.0–1.0.

```typescript
const RISK_WEIGHTS = {
  missingFields:          0.30,   // most critical: incomplete data leads to failed validation
  externalCommunication:  0.20,   // SMS/email has delivery uncertainty + cost
  financialImpact:        0.25,   // mutations with money involved are high-stakes
  dagComplexity:          0.10,   // more steps = more failure surface
  memoryUncertainty:      0.15,   // stale/absent memory = bad positioning decisions
};

function computeRiskScore(plan: BenjiPlan, context: OrchestratorRequest, memory: MemoryContext): {
  score: number;
  factors: RiskFactor[];
} {

  // Factor 1: Missing required fields
  // Count fields expected by mutation steps that are not present in context
  const parseSteps = plan.steps.filter(s => s.action === 'tool:shipment.parse');
  const requiredFields = getRequiredFieldsForPlan(plan);     // static map per intent
  const presentFields  = extractPresentFields(context, memory);
  const missingCount   = requiredFields.filter(f => !presentFields.includes(f)).length;
  const f1 = Math.min(1.0, missingCount / Math.max(requiredFields.length, 1));

  // Factor 2: External communication count
  const smsSteps = plan.steps.filter(s => s.action === 'tool:sms.send').length;
  const f2 = Math.min(1.0, smsSteps / 5);   // 5+ SMS steps = max risk

  // Factor 3: Financial impact weight
  const FINANCIAL_TOOLS = {
    'tool:shipment.create':   0.40,    // creates payment intent
    'tool:dispatch.assign':   0.50,    // assigns multiple drivers → commits to payout
    'tool:dispatch.accept':   0.60,    // single driver commits → immediate earnings claim
    'tool:pricing.calculate': 0.10,    // read-only, low risk
  };
  const f3 = plan.steps.reduce((max, s) =>
    Math.max(max, FINANCIAL_TOOLS[s.action as keyof typeof FINANCIAL_TOOLS] ?? 0), 0);

  // Factor 4: DAG complexity
  // waves = execution batches; more waves = more sequential dependencies = longer failure chains
  const waves = estimateWaveCount(plan.steps);
  const f4 = Math.min(1.0, (waves - 1) / 8);   // 9+ waves = max complexity

  // Factor 5: Memory uncertainty
  const position    = memory.lastKnownPosition;
  const positionAge = position ? position.ageHours : Infinity;
  const memoryCount = memory.memories.length;

  const positionUncertainty = positionAge > 48 ? 1.0 : positionAge > 24 ? 0.6 : positionAge > 8 ? 0.3 : 0.0;
  const memoryUncertainty   = memoryCount === 0 ? 1.0 : memoryCount < 3 ? 0.5 : 0.0;
  const f5 = (positionUncertainty * 0.6) + (memoryUncertainty * 0.4);

  const score =
    f1 * RISK_WEIGHTS.missingFields +
    f2 * RISK_WEIGHTS.externalCommunication +
    f3 * RISK_WEIGHTS.financialImpact +
    f4 * RISK_WEIGHTS.dagComplexity +
    f5 * RISK_WEIGHTS.memoryUncertainty;

  const factors: RiskFactor[] = [
    { name: 'missing_fields',          score: f1, weight: RISK_WEIGHTS.missingFields,
      explanation: `${missingCount}/${requiredFields.length} required fields missing` },
    { name: 'external_communication',  score: f2, weight: RISK_WEIGHTS.externalCommunication,
      explanation: `${smsSteps} SMS step(s) in plan` },
    { name: 'financial_impact',        score: f3, weight: RISK_WEIGHTS.financialImpact,
      explanation: `Highest-impact financial tool: ${getHighestImpactTool(plan)}` },
    { name: 'dag_complexity',          score: f4, weight: RISK_WEIGHTS.dagComplexity,
      explanation: `${waves} execution wave(s), ${plan.steps.length} total steps` },
    { name: 'memory_uncertainty',      score: f5, weight: RISK_WEIGHTS.memoryUncertainty,
      explanation: positionAge > 48
        ? `Position data is ${positionAge}h old or absent`
        : `${memoryCount} memory entries available` },
  ];

  return { score: Math.min(1.0, score), factors };
}
```

---

### 2.5 Side Effect Prediction

The simulation predicts and lists all side effects that WOULD occur if executed:

```typescript
function predictSideEffects(plan: BenjiPlan): string[] {
  const effects: string[] = [];
  for (const step of plan.steps) {
    switch (step.action) {
      case 'tool:shipment.create':
        effects.push('Creates 1 new shipment record (status: pending)');
        effects.push('Runs pricing calculation and stores estimated_price');
        break;
      case 'tool:dispatch.accept':
        effects.push('Sets shipment driver_id and status → ASSIGNED');
        effects.push('Claims driver availability for this shipment');
        break;
      case 'tool:dispatch.assign':
        effects.push(`Assigns up to ${MAX_BATCH} driver-load pairs (status → ASSIGNED)`);
        break;
      case 'tool:shipment.status_update':
        effects.push(`Updates shipment status to ${step.input?.newStatus ?? 'new status'}`);
        break;
      case 'tool:sms.send':
        effects.push(`Sends 1 SMS via Twilio (estimated cost: $0.0075)`);
        break;
      case 'tool:memory.write':
        effects.push(`Writes ${(step.memoryWrites ?? []).length} entry(s) to benji_memory`);
        break;
      case 'tool:chat.respond':
        effects.push('Generates 1 LLM response (estimated: ~300–800 tokens, $0.00005–0.00050)');
        break;
      case 'tool:document.extract':
        effects.push('Calls GPT-4o vision API (estimated: 800–2000 tokens, $0.002–0.020)');
        effects.push('May queue document for admin review if confidence < 0.85');
        break;
    }
  }
  return effects;
}
```

---

### 2.6 Predicted Failure Point

Using historical data from `benji_events` (cached hourly), the simulation identifies the plan step with the highest historical failure rate:

```typescript
async function predictFailurePoint(plan: BenjiPlan): Promise<{ stepId?: string; reason?: string }> {
  // Read from cached hourly aggregate: stepAction → failureRate
  const failureRates = await getHistoricalFailureRates();  // from benji_events cache

  let highestRate = 0;
  let wouldFailAt: string | undefined;

  for (const step of plan.steps) {
    const rate = failureRates[step.action] ?? 0;
    if (rate > highestRate) {
      highestRate = rate;
      wouldFailAt = step.stepId;
    }
  }

  if (highestRate > 0.15) {  // only flag if > 15% historical failure rate
    return {
      stepId: wouldFailAt,
      reason: `${plan.steps.find(s => s.stepId === wouldFailAt)?.action} fails ${(highestRate * 100).toFixed(0)}% historically`,
    };
  }
  return {};
}
```

---

### 2.7 Execution Gate Logic

```typescript
function determineExecutionGate(riskScore: number, result: SimulationResult): SimulationGate {
  // P9 override: if unapproved learning update active → always block financial steps
  if (globalPolicyCache.get('unapproved_weight_update_active') && result.sideEffects.some(e => e.includes('Assigns'))) {
    return 'block';
  }

  if (riskScore > 0.85) return 'block';
  if (riskScore > 0.70) return 'confirm';
  return 'proceed';
}

// When gate = 'confirm':
//   Orchestrator adds a confirmation step to the plan BEFORE execution:
//   "Before I proceed, I want to confirm: [list sideEffects]. Shall I continue?"
//   User must reply affirmatively → plan re-enters SIMULATE state → gate re-evaluated
//   If user confirms and gate is still 'confirm' (not > 0.85) → proceed

// When gate = 'block':
//   Orchestrator does NOT add a confirmation step
//   Returns CLARIFICATION_REQUESTED with explanation from riskFactors
//   Emits 'simulation_blocked' event
//   Plan is discarded — a new plan must be generated after user provides missing data
```

---

### 2.8 Cost and Latency Estimation

```typescript
// Static cost estimates per tool call (based on historical averages from ai_usage_logs)
const ESTIMATED_COST_USD: Record<string, number> = {
  'tool:chat.respond':          0.00025,   // ~300 tokens GPT-4o-mini
  'tool:shipment.parse':        0.0050,    // ~800 tokens GPT-4o
  'tool:document.extract':      0.0080,    // ~1500 tokens GPT-4o + image
  'tool:pricing.calculate':     0.0000,    // no LLM
  'tool:route.optimize':        0.0002,    // Google Maps API $/request * avg legs
  'tool:dispatch.analyze':      0.0000,    // no LLM, no external API
  'tool:dispatch.assign':       0.0000,
  'tool:dispatch.recommendations': 0.0000,
  'tool:dispatch.accept':       0.0000,
  'tool:shipment.lookup':       0.0000,
  'tool:shipment.create':       0.0000,    // DB write, no LLM
  'tool:sms.send':              0.0075,    // Twilio rate per message
  'tool:memory.read':           0.0000,
  'tool:memory.write':          0.0000,
};

// Static latency estimates (p50, ms)
const ESTIMATED_LATENCY_MS: Record<string, number> = {
  'tool:chat.respond':          500,
  'tool:shipment.parse':        1500,
  'tool:document.extract':      2500,
  'tool:pricing.calculate':     80,
  'tool:route.optimize':        1200,
  'tool:dispatch.analyze':      400,
  'tool:dispatch.assign':       300,
  'tool:dispatch.recommendations': 350,
  'tool:dispatch.accept':       100,
  'tool:shipment.lookup':       80,
  'tool:shipment.create':       150,
  'tool:sms.send':              200,
  'tool:memory.read':           80,
  'tool:memory.write':          60,
};

function estimatePlanCost(plan: BenjiPlan): number {
  return plan.steps.reduce((sum, s) => sum + (ESTIMATED_COST_USD[s.action] ?? 0), 0);
}

function estimateCriticalPathLatency(plan: BenjiPlan): number {
  // Find the longest path through the DAG (critical path)
  // Simplified: sum of latencies on the longest dependency chain
  return computeCriticalPath(plan.steps, ESTIMATED_LATENCY_MS);
}
```

---

## 3. System Safety State Machine

### 3.1 States and Transitions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BENJI SAFETY STATE MACHINE                               │
│                                                                             │
│   ┌──────┐    ┌────────┐    ┌────────┐    ┌───────────┐    ┌──────────┐   │
│   │ IDLE │───►│ INTENT │───►│ MEMORY │───►│ INFLUENCE │───►│  PLAN    │   │
│   └──────┘    └────────┘    └────────┘    └───────────┘    └──────────┘   │
│                                                                      │     │
│                    ┌─────────────────────────────────────────────────┘     │
│                    ▼                                                        │
│             ┌──────────┐    ┌─────────┐    ┌─────────┐    ┌────────────┐  │
│             │ SIMULATE │───►│VALIDATE │───►│ EXECUTE │───►│  OBSERVE   │  │
│             └──────────┘    └─────────┘    └─────────┘    └────────────┘  │
│                    │                │              │               │        │
│                    ▼                ▼              ▼               ▼        │
│             ┌────────────────────────────────────────────────────────────┐ │
│             │              COMPLETE                                      │ │
│             └────────────────────────────────────────────────────────────┘ │
│                                                                             │
│             ┌─────────┐                                                     │
│             │ BLOCKED │◄─ from SIMULATE (risk > 0.85)                      │
│             └─────────┘◄─ from VALIDATE (policy P1-P10 blocker)            │
│                         ◄─ from PLAN (P7/P8 schema failure)                │
│                                                                             │
│             ┌──────────────────────┐                                       │
│             │  CLARIFICATION_LOOP  │◄─ from SIMULATE (risk 0.70–0.85)     │
│             └──────────────────────┘◄─ from INTENT (low confidence)        │
│                          │           ◄─ from VALIDATE (missing fields)     │
│                          └──────────────────────────────────────────────►  │
│                                      re-enters INTENT after user reply      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.2 State Definitions

```typescript
type SafetyState =
  | 'IDLE'                // no active request
  | 'INTENT'              // request received, intent classification in progress
  | 'MEMORY'              // memory retrieval in progress
  | 'INFLUENCE'           // memory influence engine running
  | 'PLAN'                // planner constructing execution plan
  | 'SIMULATE'            // simulation engine running dry-run
  | 'VALIDATE'            // pre-execution validation gate
  | 'EXECUTE'             // tool graph executor running
  | 'OBSERVE'             // post-execution event emission and trace writing
  | 'COMPLETE'            // request fully resolved, response sent
  | 'BLOCKED'             // execution prevented by policy or simulation
  | 'CLARIFICATION_LOOP'; // waiting for user to provide missing information

interface StateTransition {
  from:      SafetyState;
  to:        SafetyState;
  condition: string;        // description of what caused the transition
  emitsEvent: boolean;
}
```

---

### 3.3 Allowed Transitions

```typescript
const ALLOWED_TRANSITIONS: StateTransition[] = [
  { from: 'IDLE',               to: 'INTENT',              condition: 'Request received', emitsEvent: true },
  { from: 'INTENT',             to: 'MEMORY',              condition: 'Intent classified', emitsEvent: false },
  { from: 'INTENT',             to: 'CLARIFICATION_LOOP',  condition: 'Intent confidence below threshold', emitsEvent: true },
  { from: 'MEMORY',             to: 'INFLUENCE',           condition: 'Memory retrieval complete (or timed out)', emitsEvent: false },
  { from: 'INFLUENCE',          to: 'PLAN',                condition: 'Influence computed', emitsEvent: true },
  { from: 'PLAN',               to: 'SIMULATE',            condition: 'Plan created and schema valid (P7/P8 passed)', emitsEvent: true },
  { from: 'PLAN',               to: 'BLOCKED',             condition: 'Plan schema invalid (P7 or P8 failed)', emitsEvent: true },
  { from: 'SIMULATE',           to: 'VALIDATE',            condition: 'Simulation gate = proceed', emitsEvent: true },
  { from: 'SIMULATE',           to: 'CLARIFICATION_LOOP',  condition: 'Simulation gate = confirm', emitsEvent: true },
  { from: 'SIMULATE',           to: 'BLOCKED',             condition: 'Simulation gate = block', emitsEvent: true },
  { from: 'VALIDATE',           to: 'EXECUTE',             condition: 'All policy rules pass', emitsEvent: true },
  { from: 'VALIDATE',           to: 'BLOCKED',             condition: 'Policy blocker rule failed', emitsEvent: true },
  { from: 'VALIDATE',           to: 'CLARIFICATION_LOOP',  condition: 'Validation missing fields', emitsEvent: true },
  { from: 'EXECUTE',            to: 'OBSERVE',             condition: 'Execution complete (any status)', emitsEvent: false },
  { from: 'OBSERVE',            to: 'COMPLETE',            condition: 'Trace written, events emitted', emitsEvent: true },
  { from: 'CLARIFICATION_LOOP', to: 'INTENT',              condition: 'User provided clarification', emitsEvent: true },
  { from: 'CLARIFICATION_LOOP', to: 'COMPLETE',            condition: 'Max clarification rounds exceeded (3)', emitsEvent: true },
  { from: 'BLOCKED',            to: 'COMPLETE',            condition: 'Block response sent to user', emitsEvent: true },
];

// Transition is ILLEGAL if it's not in ALLOWED_TRANSITIONS
// IllegalTransition → log error → emit 'state_machine_violation' event → return to BLOCKED
```

---

### 3.4 State Machine Enforcement

```typescript
class BenjiStateMachine {
  private currentState: SafetyState = 'IDLE';
  private requestId:    string = '';
  private transitions:  Array<{ from: SafetyState; to: SafetyState; timestamp: string }> = [];

  // Only valid if transition is in ALLOWED_TRANSITIONS
  transition(to: SafetyState, condition: string): void {
    const allowed = ALLOWED_TRANSITIONS.find(t => t.from === this.currentState && t.to === to);
    if (!allowed) {
      const message = `Illegal state transition: ${this.currentState} → ${to}`;
      logger.error({ requestId: this.requestId, from: this.currentState, to }, message);
      benjiEventService.emit({ eventType: 'state_machine_violation', source: 'system',
        payload: { requestId: this.requestId, from: this.currentState, to, condition } });
      // Do NOT apply the transition — stay in current state and route to BLOCKED
      this.forceBlock(`Illegal transition blocked: ${message}`);
      return;
    }

    const prev = this.currentState;
    this.currentState = to;
    this.transitions.push({ from: prev, to, timestamp: new Date().toISOString() });

    if (allowed.emitsEvent) {
      benjiEventService.emit({ eventType: 'state_transition', source: 'system',
        payload: { requestId: this.requestId, from: prev, to, condition } });
    }
  }

  private forceBlock(reason: string): void {
    this.currentState = 'BLOCKED';
    this.transitions.push({ from: this.currentState, to: 'BLOCKED', timestamp: new Date().toISOString() });
  }

  get state(): SafetyState { return this.currentState; }
  getTransitionHistory(): typeof this.transitions { return [...this.transitions]; }
}
```

---

## 4. Observability Layer

### 4.1 BenjiTrace — Full Decision Record

Every pipeline execution produces one `BenjiTrace`. The trace is the **single source of truth** for what happened, why, and what it cost.

```typescript
interface BenjiTrace {
  // Identity
  traceId:          string;        // = requestId (same UUID)
  requestId:        string;
  userId:           string;
  sessionId?:       string;

  // Request
  requestSnapshot:  OrchestratorRequest;   // exact input, sanitized (no JWT)
  inputChannel:     InputChannel;

  // Cognitive layer outputs
  memorySnapshot:   MemoryContext;          // what was loaded from benji_memory
  memoryInfluence:  MemoryInfluence | null; // what influence was computed
  intent:           BenjiIntent;
  intentConfidence: number;
  adjustedConfidence: number;               // after memory influence adjustment

  // Planning
  plan:             BenjiPlan | null;
  planType:         'template' | 'generated' | 'fallback';

  // Safety
  simulationResult: SimulationResult | null;
  policyResults:    PolicyGuardResult[];    // one per checkpoint invoked
  validationResult: ValidationResult | null;
  stateMachineHistory: Array<{ from: SafetyState; to: SafetyState; timestamp: string }>;

  // Execution
  executionResult:  ExecutionResult | null;

  // Events
  eventIds:         string[];               // all benji_events.id emitted during this request

  // Output
  finalReply:       string;
  actionType:       OrchestratorActionType;
  requiresClarification: boolean;

  // Cost and performance
  totalLatencyMs:   number;
  totalCostUsd:     number;
  tokenBreakdown:   Record<string, number>; // service → tokens used

  // Timestamps
  startedAt:        string;
  completedAt:      string;
}
```

---

### 4.2 BenjiTraceService — Collector

The `BenjiTraceService` is a **collector** that accumulates data through the pipeline. It is created at request intake and finalized at COMPLETE state.

```typescript
// backend/src/services/benji/BenjiTraceService.ts

class BenjiTraceBuilder {
  private trace: Partial<BenjiTrace>;

  constructor(requestId: string, request: OrchestratorRequest) {
    this.trace = {
      traceId:         requestId,
      requestId,
      userId:          request.userId ?? 'anonymous',
      sessionId:       request.sessionId,
      requestSnapshot: sanitizeRequest(request),   // remove JWT, mask phone
      inputChannel:    request.inputChannel,
      eventIds:        [],
      policyResults:   [],
      startedAt:       new Date().toISOString(),
    };
  }

  // Called after each pipeline step
  setMemorySnapshot(memory: MemoryContext):             void
  setMemoryInfluence(influence: MemoryInfluence):        void
  setIntent(intent: BenjiIntent, confidence: number, adjusted: number): void
  setPlan(plan: BenjiPlan):                              void
  setSimulationResult(sim: SimulationResult):            void
  addPolicyResult(result: PolicyGuardResult):            void
  setValidationResult(result: ValidationResult):         void
  setStateMachineHistory(history: StateTransition[]):    void
  setExecutionResult(result: ExecutionResult):           void
  addEventId(eventId: string):                           void
  setFinalOutput(reply: string, actionType: OrchestratorActionType, clarification: boolean): void

  // Called at OBSERVE state — writes the complete trace to DB
  async finalize(totalLatencyMs: number): Promise<BenjiTrace> {
    const trace: BenjiTrace = {
      ...this.trace as BenjiTrace,
      completedAt:   new Date().toISOString(),
      totalLatencyMs,
      totalCostUsd:  computeTotalCost(this.trace.executionResult),
      tokenBreakdown: computeTokenBreakdown(this.trace.executionResult),
    };

    // Write to benji_traces (fire-and-forget — does not block response)
    supabase.from('benji_traces').insert(trace).then(({ error }) => {
      if (error) logger.error({ traceId: trace.traceId, error }, 'Failed to write trace');
    });

    return trace;
  }
}
```

---

### 4.3 Replay Capability

Given a `traceId`, any decision can be replayed in two modes:

**Mode A: Audit Replay (read-only, zero side effects)**
```
1. Load benji_traces WHERE traceId = X
2. Reconstruct OrchestratorRequest from trace.requestSnapshot
3. Re-run pipeline with SIMULATION_ONLY flag = true
4. Compare: simulated plan vs. trace.plan, simulated steps vs. trace.executionResult
5. Return ReplayReport: { matches: boolean; differences: Diff[] }
```

**Mode B: Debug Replay (replay events only, no new DB writes)**
```
1. Load benji_traces WHERE traceId = X
2. Load all benji_events WHERE id IN trace.eventIds ORDER BY created_at
3. Re-render the full decision tree from events alone
4. Return structured event timeline for admin inspection
```

```typescript
// GET /api/v1/benji/trace/:traceId
interface TraceResponse {
  trace:     BenjiTrace;
  events:    BenjiEvent[];    // all events in order
  timeline:  TimelineEntry[]; // visual-friendly representation
}

interface TimelineEntry {
  timestamp:   string;
  state:       SafetyState;
  eventType:   string;
  description: string;        // human-readable
  latencyMs?:  number;
  costUsd?:    number;
}

// POST /api/v1/benji/trace/:traceId/replay
interface ReplayResponse {
  traceId:       string;
  originalPlan:  BenjiPlan;
  replayPlan:    BenjiPlan;
  matches:       boolean;
  differences:   Array<{ field: string; original: unknown; replayed: unknown }>;
  replayedAt:    string;
}
```

---

### 4.4 Admin Observability Dashboard

New page: `/dashboard/admin/ai-traces`

**Trace List View:**
- Searchable by `userId`, `intent`, `sessionId`, `inputChannel`
- Filters: date range, status (COMPLETE/BLOCKED/CLARIFICATION_LOOP), risk score range
- Sortable by latency, cost, risk score

**Trace Detail View (for a single trace):**
- Request snapshot (sanitized)
- State machine timeline (visual)
- Memory snapshot and influence summary
- Plan steps with dependency graph
- Simulation result + risk factor breakdown
- Execution result with per-step status
- Event log in order
- Replay buttons (audit / debug)

**Aggregate Metrics (powered by `benji_traces`):**
```sql
-- Most common block reasons
SELECT payload->>'reason' as reason, COUNT(*) as count
FROM benji_events
WHERE event_type = 'policy_violation'
  AND created_at > now() - interval '7 days'
GROUP BY 1 ORDER BY 2 DESC;

-- Average risk score by intent
SELECT intent, AVG((simulation_result->>'riskScore')::float) as avg_risk
FROM benji_traces
WHERE created_at > now() - interval '7 days'
GROUP BY 1 ORDER BY 2 DESC;

-- Pipeline step that blocks most often
SELECT final_reply, COUNT(*) as blocks
FROM benji_traces
WHERE action_type = 'CLARIFICATION_REQUESTED'
  AND created_at > now() - interval '7 days'
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;
```

---

## 5. Controlled Learning Layer

### 5.1 Design Philosophy

Benji is allowed to improve — but only in ways that are **versioned, auditable, and admin-approved**. The learning layer is an **offline background service**, not part of the real-time pipeline.

```
backend/src/services/benji/BenjiLearningService.ts   ← NEW (offline, not in request path)
```

---

### 5.2 LearningUpdate Contract

```typescript
interface LearningUpdate {
  updateId:          string;           // UUID
  component:         LearningComponent;
  parameter:         string;           // what is changing: e.g. 'dispatchScore.proximity.weight'
  oldValue:          number;
  newValue:          number;
  confidence:        number;           // 0–1: how confident the analysis is
  sampleSize:        number;           // how many data points drove this update
  approvalRequired:  boolean;          // ALWAYS true for scoring/routing/financial
  status:            LearningStatus;
  evidence:          LearningEvidence;
  proposedAt:        string;
  approvedAt?:       string;
  approvedBy?:       string;           // admin userId
  appliedAt?:        string;
  versionBefore?:    string;           // component version before update
  versionAfter?:     string;           // component version after update
}

type LearningComponent = 'dispatcher' | 'planner' | 'routing' | 'memory_influence' | 'intent';
type LearningStatus    = 'pending_approval' | 'approved' | 'rejected' | 'applied' | 'rolled_back';

interface LearningEvidence {
  dataSource:    string[];             // e.g. ['agent_evaluations', 'benji_events']
  timeWindow:    string;               // e.g. '30 days'
  metric:        string;               // what metric improved
  improvement:   number;               // delta improvement observed in evaluations
  failureMode:   string | null;        // what problem this fixes (if applicable)
}
```

---

### 5.3 Allowed Learning Sources

| Source | Allowed | Notes |
|---|---|---|
| `agent_evaluations` table | ✅ | Primary source — eval suite results |
| `execution_result.feedback` | ✅ | Explicit user confirmations in clarification flow |
| `user_confirmed_actions` | ✅ | User said "yes" to a confirm-gate simulation |
| `benji_events` (aggregate patterns) | ✅ | Only aggregate — never single events |
| Single failed API call | ❌ | Transient errors are not signals |
| Hallucinated LLM outputs | ❌ | Detected by evaluation suite; excluded |
| Unvalidated memory signals | ❌ | Memory with confidence < 0.5 excluded |
| Production errors (5xx) | ❌ | Infrastructure issues, not behavioral signals |

---

### 5.4 Learnable Parameters

| Component | Parameter | Current Default | Min Allowed | Max Allowed |
|---|---|---|---|---|
| `dispatcher` | `proximity.weight` | 0.40 | 0.30 | 0.55 |
| `dispatcher` | `routeFit.weight` | 0.25 | 0.15 | 0.35 |
| `dispatcher` | `earnings.weight` | 0.20 | 0.15 | 0.30 |
| `dispatcher` | `experience.weight` | 0.10 | 0.05 | 0.20 |
| `dispatcher` | `rating.weight` | 0.05 | 0.02 | 0.10 |
| `routing` | `confidenceThreshold` | 0.60 | 0.50 | 0.80 |
| `memory_influence` | `loadRejectionSampleWindow` | 30 days | 7 days | 90 days |
| `memory_influence` | `channelPreferenceRatio` | 1.5 | 1.2 | 3.0 |
| `intent` | `keyword_confidence_floor` | 0.70 | 0.60 | 0.90 |
| `planner` | `clarificationThreshold.default` | 0.60 | 0.50 | 0.80 |

**Immutable (never learnable without code deploy):**
- Pricing formulas and BASE_RATES
- Validation rule thresholds (SC-001 through DE-004)
- Policy guard rules P1–P10
- Driver earnings split (80%)
- SMS delivery compliance rules (SS-002: opt-out is always enforced)

---

### 5.5 Learning Analysis Process

The `BenjiLearningService.analyze()` method runs as a **background job** (weekly by default, or triggered by admin):

```typescript
class BenjiLearningService {
  // Weekly cron: every Sunday at 02:00 UTC
  async analyze(): Promise<LearningUpdate[]> {
    const proposals: LearningUpdate[] = [];

    // Analysis 1: Dispatch weight tuning
    // Compare current weights against evaluation results
    const dispatchEvals = await getRecentEvaluations('dispatch_quality', 30);
    if (dispatchEvals.sampleSize >= 50) {
      const weightOptimization = this.optimizeDispatchWeights(dispatchEvals);
      if (weightOptimization.confidenceLevel > 0.80) {
        proposals.push(...weightOptimization.proposals);
      }
    }

    // Analysis 2: Intent classifier keyword additions
    // Look for user messages that fell through to GPT fallback but were consistently correct
    const intentFallbacks = await getIntentFallbackCases(30);
    const newKeywords = this.identifyNewKeywords(intentFallbacks);
    if (newKeywords.confidence > 0.85) {
      proposals.push(this.buildKeywordProposal(newKeywords));
    }

    // Analysis 3: Clarification threshold adjustment
    // If many users abandon after clarification, threshold may be too aggressive
    const clarificationAbandonRate = await getClarificationAbandonRate(30);
    if (clarificationAbandonRate.rate > 0.40 && clarificationAbandonRate.sampleSize >= 30) {
      proposals.push(this.buildThresholdProposal(clarificationAbandonRate));
    }

    // Write all proposals to learning_proposals table with status='pending_approval'
    await this.saveProposals(proposals);
    return proposals;
  }

  private optimizeDispatchWeights(evals: EvaluationData): { proposals: LearningUpdate[]; confidenceLevel: number } {
    // Gradient descent on evaluation scores is NOT used here
    // Instead: simple correlation analysis between weight settings and eval scores
    // If reducing proximity weight improves dispatch_quality score → propose reduction
    // All proposals must stay within MIN/MAX bounds defined in §5.4
    // ...
  }
}
```

---

### 5.6 Admin Approval Flow

```
1. BenjiLearningService.analyze() runs → writes to learning_proposals table

2. Admin dashboard shows pending proposals at /dashboard/admin/ai-learning
   Each proposal shows:
   - Component and parameter being changed
   - Old value → New value
   - Confidence score and sample size
   - Evidence: what metric improved, by how much
   - Risk assessment: what could go wrong if applied

3. Admin actions:
   a. Approve:
      - learning_proposals SET status = 'approved', approved_by = adminId, approved_at = now()
      - BenjiLearningService.applyUpdate(updateId) runs:
        → Reads the target component's config from benji_config table
        → Writes new value with version bump
        → Writes to policy_audit_log
        → Emits 'learning_update_applied' event
   b. Reject:
      - learning_proposals SET status = 'rejected'
      - Emits 'learning_update_rejected' event
   c. Request more data:
      - Adds comment to proposal
      - Sets status = 'pending_more_data'

4. Applied updates use benji_config table as source of truth:
   BenjiCoreService reads from benji_config at startup
   Hot-reload: BenjiCoreService.reloadConfig() can be triggered without restart
```

---

### 5.7 Rollback

Every applied update can be rolled back:

```typescript
// POST /api/v1/benji/evaluate/rollback/:updateId
// Admin only
async function rollbackLearningUpdate(updateId: string): Promise<void> {
  const update = await getAppliedUpdate(updateId);

  // Restore old value in benji_config
  await supabase.from('benji_config')
    .update({ value: update.oldValue, version: incrementMinor(update.versionAfter!) })
    .eq('parameter', update.parameter);

  // Mark update as rolled back
  await supabase.from('learning_proposals')
    .update({ status: 'rolled_back' })
    .eq('id', updateId);

  // Emit audit event
  await benjiEventService.emit({
    eventType: 'learning_update_rolled_back',
    source:    'admin',
    payload:   { updateId, parameter: update.parameter, restoredValue: update.oldValue },
  });

  // Hot-reload affected service
  await benjiCoreService.reloadConfig();
}
```

---

## 6. Database Schema

### 6.1 `benji_traces`

```sql
-- supabase/migrations/20260703_benji_traces.sql

CREATE TABLE benji_traces (
  trace_id               text        PRIMARY KEY,
  request_id             text        NOT NULL,
  user_id                uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id             text,
  input_channel          text        NOT NULL,
  intent                 text,
  intent_confidence      float,
  adjusted_confidence    float,
  plan_type              text        CHECK (plan_type IN ('template', 'generated', 'fallback')),
  simulation_result      jsonb,
  execution_status       text        CHECK (execution_status IN ('completed', 'partial', 'failed', 'blocked', 'clarification')),
  action_type            text,
  requires_clarification boolean     NOT NULL DEFAULT false,
  risk_score             float,
  total_latency_ms       integer,
  total_cost_usd         float,
  token_breakdown        jsonb       DEFAULT '{}',
  -- Full snapshots stored as jsonb for replay capability
  request_snapshot       jsonb       NOT NULL,
  memory_snapshot        jsonb       DEFAULT '{}',
  memory_influence       jsonb,
  plan                   jsonb,
  policy_results         jsonb       DEFAULT '[]',
  validation_result      jsonb,
  execution_result       jsonb,
  state_machine_history  jsonb       DEFAULT '[]',
  event_ids              text[]      DEFAULT '{}',
  final_reply            text,
  started_at             timestamptz NOT NULL DEFAULT now(),
  completed_at           timestamptz
);

-- Query by user (recent traces)
CREATE INDEX benji_traces_user_idx ON benji_traces (user_id, started_at DESC);

-- Query by intent and date (for evaluation analysis)
CREATE INDEX benji_traces_intent_idx ON benji_traces (intent, started_at DESC);

-- Query by risk score (find high-risk requests)
CREATE INDEX benji_traces_risk_idx ON benji_traces (risk_score DESC, started_at DESC)
  WHERE risk_score > 0.5;

-- Query by blocked/clarification (find problematic flows)
CREATE INDEX benji_traces_status_idx ON benji_traces (execution_status, started_at DESC)
  WHERE execution_status IN ('blocked', 'clarification');

-- RLS
ALTER TABLE benji_traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read all traces"
  ON benji_traces FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Service role full access"
  ON benji_traces FOR ALL TO service_role USING (true);

-- Retention: traces older than 180 days can be archived
-- DELETE FROM benji_traces WHERE started_at < now() - interval '180 days';
```

---

### 6.2 `policy_violations`

```sql
-- supabase/migrations/20260703_policy_violations.sql

CREATE TABLE policy_violations (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id       text        NOT NULL,             -- 'P1' through 'P10'
  checkpoint    text        NOT NULL,
  request_id    text,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reason        text,
  evidence      text,
  severity      text        NOT NULL CHECK (severity IN ('block', 'warn')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX policy_violations_rule_idx ON policy_violations (rule_id, created_at DESC);
CREATE INDEX policy_violations_severity_idx ON policy_violations (severity, created_at DESC);

ALTER TABLE policy_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read violations"
  ON policy_violations FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Service role full access"
  ON policy_violations FOR ALL TO service_role USING (true);
```

---

### 6.3 `learning_proposals`

```sql
-- supabase/migrations/20260703_learning_proposals.sql

CREATE TABLE learning_proposals (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  component         text        NOT NULL CHECK (component IN ('dispatcher', 'planner', 'routing', 'memory_influence', 'intent')),
  parameter         text        NOT NULL,
  old_value         float       NOT NULL,
  new_value         float       NOT NULL,
  confidence        float       NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  sample_size       integer     NOT NULL,
  approval_required boolean     NOT NULL DEFAULT true,
  status            text        NOT NULL DEFAULT 'pending_approval'
                    CHECK (status IN ('pending_approval', 'pending_more_data', 'approved', 'rejected', 'applied', 'rolled_back')),
  evidence          jsonb       NOT NULL DEFAULT '{}',
  admin_comment     text,
  proposed_at       timestamptz NOT NULL DEFAULT now(),
  approved_at       timestamptz,
  approved_by       uuid        REFERENCES auth.users(id),
  applied_at        timestamptz,
  version_before    text,
  version_after     text
);

CREATE INDEX learning_proposals_status_idx ON learning_proposals (status, proposed_at DESC);

ALTER TABLE learning_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage proposals"
  ON learning_proposals FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Service role full access"
  ON learning_proposals FOR ALL TO service_role USING (true);
```

---

### 6.4 `benji_config`

```sql
-- supabase/migrations/20260703_benji_config.sql
-- Source of truth for all learnable parameters

CREATE TABLE benji_config (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  component     text        NOT NULL,
  parameter     text        NOT NULL,
  value         float       NOT NULL,
  value_min     float       NOT NULL,
  value_max     float       NOT NULL,
  description   text,
  version       text        NOT NULL DEFAULT '1.0.0',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text        NOT NULL DEFAULT 'system',   -- 'system' or admin userId
  UNIQUE (component, parameter)
);

-- Seed data: initial values matching current hardcoded defaults
INSERT INTO benji_config (component, parameter, value, value_min, value_max, description) VALUES
  ('dispatcher', 'proximity.weight',          0.40, 0.30, 0.55, 'Weight of proximity score in dispatcher'),
  ('dispatcher', 'routeFit.weight',           0.25, 0.15, 0.35, 'Weight of route fit score'),
  ('dispatcher', 'earnings.weight',           0.20, 0.15, 0.30, 'Weight of earnings score'),
  ('dispatcher', 'experience.weight',         0.10, 0.05, 0.20, 'Weight of driver experience score'),
  ('dispatcher', 'rating.weight',             0.05, 0.02, 0.10, 'Weight of driver rating score'),
  ('routing',    'confidenceThreshold',       0.60, 0.50, 0.80, 'Default clarification confidence threshold'),
  ('planner',    'clarificationThreshold',    0.60, 0.50, 0.80, 'Minimum confidence before clarification'),
  ('intent',     'keywordConfidenceFloor',    0.70, 0.60, 0.90, 'Minimum keyword match confidence'),
  ('memory',     'loadRejectionWindow',       30,   7,    90,   'Days of load rejection history to analyze'),
  ('memory',     'channelPreferenceRatio',    1.5,  1.2,  3.0,  'SMS/chat ratio to flip channel preference');

ALTER TABLE benji_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read config"
  ON benji_config FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Service role full access"
  ON benji_config FOR ALL TO service_role USING (true);
```

---

## 7. Updated Full Pipeline with Governance

This is the final, complete pipeline incorporating all layers from Orchestrator, Cognitive Layer, and Governance Layer documents.

```
REQUEST INTAKE
  ─────────────────────────────────────────────────────────────────────
  │ State Machine: IDLE → INTENT
  │ TraceBuilder: new BenjiTraceBuilder(requestId, request)
  │ PolicyGuard: check('after_request_intake') [P9, P10]
  │   → Block if P9 (unapproved weights) or P10 (tracing disabled)
  │
  ▼ MEMORY RETRIEVAL
  ─────────────────────────────────────────────────────────────────────
  │ State Machine: INTENT → MEMORY
  │ tool:memory.read + benji_conversations load (parallel, 500ms max)
  │ TraceBuilder.setMemorySnapshot(memory)
  │
  ▼ MEMORY INFLUENCE ENGINE
  ─────────────────────────────────────────────────────────────────────
  │ State Machine: MEMORY → INFLUENCE
  │ MemoryInfluenceEngine.analyze() [300ms timeout → neutral]
  │ PolicyGuard: check('after_memory_influence') [P1]
  │   → Block if P1 (clarificationThreshold lowered below floor)
  │ TraceBuilder.setMemoryInfluence(influence)
  │
  ▼ INTENT CLASSIFICATION
  ─────────────────────────────────────────────────────────────────────
  │ State Machine: INFLUENCE → PLAN (or CLARIFICATION_LOOP if low confidence)
  │ adjustedConfidence = rawConfidence + influence.confidenceAdjustment
  │ if adjustedConfidence < influence.clarificationThreshold:
  │   → State: CLARIFICATION_LOOP
  │ TraceBuilder.setIntent(intent, rawConfidence, adjustedConfidence)
  │
  ▼ BENJI PLANNER
  ─────────────────────────────────────────────────────────────────────
  │ State Machine: PLAN
  │ BenjiPlanner.createPlan(intent, influence, context)
  │ PolicyGuard: check('after_plan_creation') [P3, P6, P7, P8]
  │   → Block if plan schema invalid (P7), cyclic DAG (P8),
  │            mutation without intent (P3), missing required fields (P6)
  │ TraceBuilder.setPlan(plan)
  │
  ▼ SIMULATION ENGINE
  ─────────────────────────────────────────────────────────────────────
  │ State Machine: SIMULATE
  │ SimulationEngine.simulate(plan, context, memory) [< 50ms]
  │ TraceBuilder.setSimulationResult(sim)
  │
  │ if sim.executionGate = 'block':
  │   → State: BLOCKED → COMPLETE
  │   → Emit: 'simulation_blocked' event
  │
  │ if sim.executionGate = 'confirm':
  │   → State: CLARIFICATION_LOOP
  │   → Add confirmation step to plan (list sideEffects)
  │   → Wait for user confirmation before re-entering SIMULATE
  │
  ▼ VALIDATION GATE
  ─────────────────────────────────────────────────────────────────────
  │ State Machine: SIMULATE → VALIDATE
  │ DecisionValidator.validate(plan) [checks all action-type rules]
  │ PolicyGuard: check applied per-step during execution [P2, P4, P5]
  │ TraceBuilder.setValidationResult(result)
  │
  │ if rejected:
  │   → Missing fields → State: CLARIFICATION_LOOP
  │   → Policy block → State: BLOCKED → COMPLETE
  │
  ▼ TOOL GRAPH EXECUTION
  ─────────────────────────────────────────────────────────────────────
  │ State Machine: VALIDATE → EXECUTE
  │ ToolGraphExecutor.run(plan, context)
  │   For each step:
  │     PolicyGuard: check('before_each_tool_call') [P2, P4, P5]
  │     toolRegistry.execute(step.action, resolvedInput, context)
  │     Emit: plan_step_started, plan_step_completed/failed
  │     TraceBuilder.addEventId(eventId)
  │   After all waves:
  │     TraceBuilder.setExecutionResult(result)
  │
  ▼ OBSERVE
  ─────────────────────────────────────────────────────────────────────
  │ State Machine: EXECUTE → OBSERVE
  │ synthesizeReply(result, plan, context, influence)
  │ TraceBuilder.setFinalOutput(reply, actionType, clarification)
  │ Emit: orchestrator_complete event
  │ Fire-and-forget: append to benji_conversations, ai_usage_logs
  │
  ▼ COMPLETE
  ─────────────────────────────────────────────────────────────────────
  │ State Machine: OBSERVE → COMPLETE
  │ traceBuilder.finalize(totalLatencyMs)
  │   → Writes benji_traces row (fire-and-forget, does not block response)
  │ TraceBuilder.setStateMachineHistory(machine.getTransitionHistory())
  │
  ▼
  Return OrchestratorResponse to caller
```

---

### 7.1 Environment Variables Required for Governance Layer

```
# Add to Railway before governance layer deploy
ENABLE_BENJI_TRACING=true         # Required by P10
ENABLE_BENJI_SIMULATION=true      # Enable simulation engine
BENJI_SIMULATION_RISK_CONFIRM=0.70 # Risk threshold for confirmation gate
BENJI_SIMULATION_RISK_BLOCK=0.85   # Risk threshold for block gate
ENABLE_BENJI_LEARNING=true         # Enable learning analysis job
BENJI_LEARNING_CRON=0 2 * * 0     # Weekly Sunday 02:00 UTC
```

---

## 8. File Structure

### 8.1 New Files

```
backend/src/services/benji/
├── GlobalPolicyGuard.ts        ← NEW (§1)
│     GLOBAL_POLICIES[]
│     PolicyGuard.check()
│     PolicyGuard.logViolation()
│
├── SimulationEngine.ts         ← NEW (§2)
│     simulate()
│     computeRiskScore()
│     predictSideEffects()
│     predictFailurePoint()
│     determineExecutionGate()
│
├── BenjiStateMachine.ts        ← NEW (§3)
│     SafetyState type
│     ALLOWED_TRANSITIONS[]
│     BenjiStateMachine class
│
├── BenjiTraceService.ts        ← NEW (§4)
│     BenjiTraceBuilder class
│     finalize() → writes benji_traces
│     Trace replay utilities
│
└── BenjiLearningService.ts     ← NEW (§5)
      analyze() background job
      optimizeDispatchWeights()
      identifyNewKeywords()
      applyUpdate()
      rollbackUpdate()
```

### 8.2 New API Routes

```
backend/src/routes/benji.routes.ts (additions):

GET  /api/v1/benji/trace/:traceId            ← Full trace with events + timeline
POST /api/v1/benji/trace/:traceId/replay     ← Audit replay (simulation only)
GET  /api/v1/benji/policy/violations         ← Recent policy violations (admin)
GET  /api/v1/benji/policy/rules              ← List all P1-P10 rules (admin)
GET  /api/v1/benji/learning/proposals        ← List learning proposals (admin)
POST /api/v1/benji/learning/proposals/:id/approve  ← Admin approve (admin)
POST /api/v1/benji/learning/proposals/:id/reject   ← Admin reject (admin)
POST /api/v1/benji/learning/proposals/:id/rollback ← Admin rollback applied (admin)
POST /api/v1/benji/learning/analyze          ← Trigger analysis job (admin)
GET  /api/v1/benji/config                    ← Read benji_config (admin)
```

### 8.3 New SQL Migrations

```
supabase/migrations/
├── 20260703_benji_traces.sql          ← benji_traces table (§6.1)
├── 20260703_policy_violations.sql     ← policy_violations table (§6.2)
├── 20260703_learning_proposals.sql    ← learning_proposals table (§6.3)
└── 20260703_benji_config.sql          ← benji_config table + seed data (§6.4)
```

### 8.4 Modified Files

```
backend/src/services/benji/BenjiOrchestrator.ts  ← MODIFIED
  Add: BenjiStateMachine instantiation per request
  Add: GlobalPolicyGuard.check() at 4 checkpoints
  Add: SimulationEngine.simulate() before VALIDATE state
  Add: BenjiTraceBuilder.finalize() at OBSERVE state
  Remove: direct tool registry calls (replaced in BENJI_V2_COGNITIVE_LAYER.md)
```

### 8.5 Unchanged Files (Preserved Exactly)

Everything below the governance layer remains identical:
- `BenjiPlanner.ts`, `ToolGraphExecutor.ts`, `MemoryInfluenceEngine.ts`
- `BenjiCoreService.ts`, `BenjiIntentService.ts`, `BenjiToolRegistry.ts`
- `DecisionValidator.ts`, `BenjiMemoryService.ts`, `BenjiEventService.ts`
- All existing operational services (pricing, routing, dispatch, chat, etc.)

---

## Final System Invariants

These are non-negotiable properties that must hold at all times in the production system. Any change to the codebase that would violate an invariant requires explicit review:

| # | Invariant | Enforced By |
|---|---|---|
| I-1 | Every request that mutates state produces exactly one trace | `BenjiTraceBuilder.finalize()` |
| I-2 | No tool calls occur outside an active `BenjiPlan` | `GlobalPolicyGuard` P3 + `ToolGraphExecutor` |
| I-3 | No SMS/email is sent without being an explicit plan step | `GlobalPolicyGuard` P4 |
| I-4 | Every state transition is logged | `BenjiStateMachine.transition()` |
| I-5 | Risk score > 0.85 blocks execution without exception | `SimulationEngine.determineExecutionGate()` |
| I-6 | Learning updates are never applied without admin approval | `BenjiLearningService.applyUpdate()` approval check |
| I-7 | Policy P1 floor (clarificationThreshold ≥ 0.55) is never breached | `GlobalPolicyGuard` P1 |
| I-8 | Every DB write emits a `benji_event` | Tool wrappers in `BenjiToolRegistry.ts` |
| I-8A | No code may write to persistent Benji storage directly — all persistent writes must flow through approved boundaries: `BenjiMemoryService`, `BenjiEventService`, or orchestrator-owned domain services | Code review enforced; `supabase.from().insert/upsert/update/delete` may only appear inside approved service files |
| I-9 | Cyclic DAGs are detected before execution | `GlobalPolicyGuard` P8 + `ToolGraphExecutor.buildDAG()` |
| I-10 | Any decision can be replayed from its trace | `BenjiTraceService` replay API |
| I-11 | Tool implementations must declare all side effects explicitly — no hidden DB writes, no events fired outside the declared contract, and no direct calls to other tools (composition is exclusively the orchestrator's responsibility) | Tool wrappers in `BenjiToolRegistry.ts`; `GlobalPolicyGuard` P5 catches regressions |
| I-12 | No service or tool may instantiate its own AI client or call the OpenAI SDK directly — all LLM calls must route through `createChatCompletion` in `benji/ai/client/openai.client.ts` | `benji/ai/client/openai.client.ts` is the sole SDK export path; enforced by code review + I-11 |
| I-13 | Memory reads and writes are namespace-scoped — a tool may only access `MemoryNamespace` values it explicitly declares in `ToolDefinition.namespaceAccess`; cross-namespace writes require explicit orchestrator delegation; reads of undeclared namespaces are silently empty | `BenjiToolRegistry.register()` emits advisory warnings; `BenjiMemoryService` (Phase 4) enforces declared scope at execution time |
| I-14 | Replay Determinism — given identical trace input, memory snapshot, prompt checksum, and tool outputs, Benji must reproduce identical orchestration decisions unless the step is explicitly marked nondeterministic. Explicit nondeterminism sources (randomness, time-sensitive APIs, external LLM calls without cached outputs) must be declared. | `BenjiTraceService.replay()` validates determinism; `BenjiEventEnvelope.schemaVersion` ensures envelope compatibility across versions |

---

*Related documents: BENJI_SYSTEM_AUDIT.md · BENJI_V2_IMPLEMENTATION_PLAN.md · BENJI_V2_ORCHESTRATOR.md · BENJI_V2_COGNITIVE_LAYER.md*  
*Next step: Phase 4 implementation — GlobalPolicyGuard.ts + SimulationEngine.ts + BenjiTraceService.ts*
