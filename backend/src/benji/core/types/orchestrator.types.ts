/**
 * Benji V2 — Orchestrator Shared Types
 * Phase 5
 *
 * Contracts consumed by:
 *   - BenjiOrchestrator (benji/orchestrator/benji-orchestrator.ts)
 *   - GlobalPolicyGuard (benji/policy/global-policy.guard.ts)
 *   - SimulationEngine  (benji/simulation/simulation.engine.ts)
 *   - BenjiTraceService (benji/trace/benji-trace.service.ts)
 *
 * Governance: I-11, I-13, I-14
 */

import type { MemoryEntry } from './memory.types';
import type { ToolResult } from './tool.types';

// ─── Orchestrator Request ─────────────────────────────────────────────────────

/**
 * Immutable request envelope passed into BenjiOrchestrator.handle().
 * The orchestrator may attach `_classifiedIntent` after classification.
 */
export interface OrchestratorRequest {
  readonly requestId:    string;
  readonly traceId:      string;
  readonly userId:       string;
  readonly userType:     'client' | 'driver' | 'admin' | 'broker';
  readonly message:      string;
  readonly sessionId?:   string;
  readonly currentPage?: string;
  readonly shipmentId?:  string;
  readonly attachments?: ReadonlyArray<{ name: string; type: string }>;
  /** Set by the orchestrator after intent classification; undefined at intake. */
  _classifiedIntent?: string;
}

// ─── Execution Plan ───────────────────────────────────────────────────────────

/** A single step in an execution plan. */
export interface BenjiPlanStep {
  readonly stepId:      string;
  readonly action:      string;      // tool name, e.g. 'tool:validate.input'
  readonly critical:    boolean;     // if true, failure aborts the whole plan
  readonly dependsOn:   string[];    // stepIds this step must wait for
  readonly input?:      Record<string, unknown>;
  readonly memoryWrites?: ReadonlyArray<{ namespace: string; key: string }>;
}

/** A complete execution plan generated for one orchestrator request. */
export interface BenjiPlan {
  readonly planId:     string;
  readonly intent:     string;
  readonly steps:      BenjiPlanStep[];
  readonly createdAt:  string;   // ISO-8601
}

// ─── Memory Influence ─────────────────────────────────────────────────────────

/**
 * Derived from the user's memory snapshot.
 * Influences intent confidence threshold, tool selection, and routing.
 * P1: clarificationThreshold must be ≥ 0.55.
 */
export interface MemoryInfluence {
  clarificationThreshold: number;      // P1 enforcement: ≥ 0.55
  confidenceBoost:        number;      // added to raw intent confidence (0–1)
  preferredTools?:        string[];    // advisory — orchestrator may prioritize
}

/** Resolved memory context: entries + last-known driver position (optional). */
export interface MemoryContext {
  memories:              ReadonlyArray<MemoryEntry>;
  lastKnownPosition?:    { lat: number; lng: number; ageHours: number };
}

// ─── Policy / Safety State Machine ───────────────────────────────────────────

/**
 * Safety state labels for the orchestrator state machine (I-14 traceability).
 * Checkpoints map directly to GlobalPolicyGuard call sites.
 */
export type SafetyState =
  | 'IDLE'
  | 'INTENT'
  | 'MEMORY'
  | 'INFLUENCE'
  | 'PLAN'
  | 'SIMULATE'
  | 'VALIDATE'
  | 'EXECUTE'
  | 'OBSERVE'
  | 'COMPLETE'
  | 'BLOCKED'
  | 'AWAIT_CONFIRMATION'  // gate='confirm': halted until user confirms
  | 'CLARIFICATION_LOOP';

/** Named checkpoint passed to GlobalPolicyGuard.check(). */
export type PolicyCheckpoint =
  | 'after_request_intake'
  | 'after_memory_influence'
  | 'after_plan_creation'
  | 'before_each_tool_call';

/**
 * Full context snapshot used by GlobalPolicyGuard.check().
 * Every field used in P1–P10 checks is represented here.
 */
export interface PolicyCheckState {
  readonly request:       OrchestratorRequest;
  readonly influence?:    MemoryInfluence;
  readonly plan?:         BenjiPlan;
  readonly currentStep?:  BenjiPlanStep;
  readonly priorOutputs?: Readonly<Record<string, ToolResult<unknown>>>;
  readonly systemState:   SafetyState;
}

// ─── Confirmation payload (returned when gate='confirm') ─────────────────────

/** Returned by the orchestrator when simulation requires user confirmation. */
export interface ConfirmationPayload {
  riskScore:   number;
  reasons:     string[];    // risk factor explanations
  planSummary: string[];    // human-readable list of what WILL happen (sideEffects)
  traceId:     string;
  expiresAt:   string;      // ISO-8601; default TTL 24h
}

// ─── Orchestrator Result ──────────────────────────────────────────────────────

export interface OrchestratorResult {
  readonly success:               boolean;
  readonly traceId:               string;
  readonly response?:             string;
  readonly data?:                 unknown;
  readonly state:                 SafetyState;
  readonly blockedBy?:            string[];
  readonly clarificationRequest?: string;
  readonly error?:                string;
  /** Present only when state = 'AWAIT_CONFIRMATION' */
  readonly confirmationPayload?:  ConfirmationPayload;
}
