/**
 * Benji V2 — Centralized Event Type Registry
 * Phase 3 / Phase 4.5
 *
 * Single source of truth for every event emitted by the Benji subsystem.
 *
 * Event persistence policy (I-8A):
 *   async  — fire-and-forget (non-blocking); loss is acceptable
 *   await  — must be persisted before caller continues; loss = data loss
 *
 * Governance: I-8 (every DB write emits an event), I-8A (persistent write boundary),
 *             I-13 (memory determinism), I-14 (replay determinism)
 */

import { randomUUID } from 'node:crypto';

// ─── Event Type Catalogue ─────────────────────────────────────────────────────

export type BenjiEventType =
  // Tool lifecycle (Phase 3)
  | 'tool_completed'
  | 'tool_failed'
  // Intent classification (Phase 2C)
  | 'intent_classified'
  // Orchestration (Phase 5)
  | 'plan_created'
  | 'plan_step_executed'
  // Memory (Phase 4 — only writes emit events per I-8)
  | 'memory_written'
  // Domain mutations (Phase 5 — safety-critical)
  | 'shipment_created'
  | 'dispatch_assigned'
  | 'sms_sent'
  | 'payment_authorized'
  // Policy / safety (Phase 5)
  | 'policy_violation'
  | 'simulation_blocked'
  // Session bookkeeping (Phase 5)
  | 'session_started'
  | 'session_ended';

/**
 * Events that must be persisted synchronously before the caller continues.
 * Used by BenjiEventService (Phase 4) to decide await vs fire-and-forget.
 *
 * Rule: domain mutations that produce observable side effects externally
 * (money, messages, status changes visible to third parties) are critical.
 */
export const SAFETY_CRITICAL_EVENTS: ReadonlySet<BenjiEventType> = new Set([
  'shipment_created',
  'dispatch_assigned',
  'sms_sent',
  'payment_authorized',
]);

// ─ Event Durability ─────────────────────────────────────────────────────

/**
 * 'async' — fire-and-forget; hook failure is logged but never blocks the result.
 * 'await' — must complete before the caller receives a result; failure = tool failure.
 */
export type EventDurability = 'async' | 'await';

/** Canonical durability class for every event type (I-8A). */
export const EVENT_DURABILITY: Readonly<Record<BenjiEventType, EventDurability>> = {
  tool_completed:     'async',
  tool_failed:        'async',
  intent_classified:  'async',
  plan_created:       'async',
  plan_step_executed: 'async',
  memory_written:     'async',
  shipment_created:   'await',
  dispatch_assigned:  'await',
  sms_sent:           'await',
  payment_authorized: 'await',
  policy_violation:   'async',
  simulation_blocked: 'async',
  session_started:    'async',
  session_ended:      'async',
} as const;

// ─── Base Event Shape ─────────────────────────────────────────────────────────

export interface BenjiBaseEvent {
  readonly eventType:  BenjiEventType;
  readonly requestId:  string;
  readonly occurredAt: string;    // ISO-8601 set by the emitter, not the caller
  readonly userId?:    string;
}

// ─── Typed Event Payloads ─────────────────────────────────────────────────────

export interface ToolCompletedEvent extends BenjiBaseEvent {
  readonly eventType:  'tool_completed';
  readonly toolName:   string;
  readonly durationMs: number;
  readonly stepId?:    string;
}

export interface ToolFailedEvent extends BenjiBaseEvent {
  readonly eventType:  'tool_failed';
  readonly toolName:   string;
  readonly durationMs: number;
  readonly errorCode?: string;
  readonly stepId?:    string;
}

export interface IntentClassifiedEvent extends BenjiBaseEvent {
  readonly eventType:    'intent_classified';
  readonly intent:       string;
  readonly confidence:   number;
  readonly source:       'deterministic' | 'llm' | 'fallback';
  readonly ambiguous?:   boolean;
  readonly processingMs: number;
}

export interface MemoryWrittenEvent extends BenjiBaseEvent {
  readonly eventType:  'memory_written';
  readonly namespace:  string;
  readonly key:        string;
  readonly toolName:   string;
}

export interface PlanCreatedEvent extends BenjiBaseEvent {
  readonly eventType:   'plan_created';
  readonly planId:      string;
  readonly intent:      string;
  readonly stepCount:   number;
}

export interface PlanStepExecutedEvent extends BenjiBaseEvent {
  readonly eventType:   'plan_step_executed';
  readonly planId:      string;
  readonly stepId:      string;
  readonly toolName:    string;
  readonly success:     boolean;
  readonly durationMs:  number;
}

/** Phase 4+: domain & session events use this until they get typed entries above. */
export interface GenericBenjiEvent extends BenjiBaseEvent {
  readonly eventType: Exclude<
    BenjiEventType,
    | 'tool_completed'
    | 'tool_failed'
    | 'intent_classified'
    | 'memory_written'
    | 'plan_created'
    | 'plan_step_executed'
  >;
}

// ─── Discriminated Union ──────────────────────────────────────────────────────

export type BenjiEvent =
  | ToolCompletedEvent
  | ToolFailedEvent
  | IntentClassifiedEvent
  | MemoryWrittenEvent
  | PlanCreatedEvent
  | PlanStepExecutedEvent
  | GenericBenjiEvent;

// ─── Helper ───────────────────────────────────────────────────────────────────

export function isSafetyCritical(eventType: BenjiEventType): boolean {
  return SAFETY_CRITICAL_EVENTS.has(eventType);
}

// ─ Event Envelope (I-14 replay determinism) ───────────────────────────

/**
 * Universal wrapper for all persisted Benji events.
 * Every row in benji_events stores one envelope.
 * The eventId is the idempotency key (dedup on retry).
 */
export interface BenjiEventEnvelope<T = unknown> {
  readonly eventId:       string;   // UUID v4 — unique per emission, idempotency key
  readonly traceId:       string;   // orchestration run identifier (I-14 correlation)
  readonly stepId:        string;   // step within the orchestration run
  readonly schemaVersion: 1;        // literal 1 — bump when envelope shape changes
  readonly timestamp:     string;   // ISO-8601 set by emitter
  readonly eventType:     BenjiEventType;
  readonly payload:       T;
}

/**
 * Create a new envelope for `payload`.
 * Generates a fresh UUID v4 as the eventId.
 */
export function createEnvelope<T>(
  eventType: BenjiEventType,
  payload:   T,
  traceId:   string,
  stepId:    string,
): BenjiEventEnvelope<T> {
  return {
    eventId:       randomUUID(),
    traceId,
    stepId,
    schemaVersion: 1,
    timestamp:     new Date().toISOString(),
    eventType,
    payload,
  };
}
