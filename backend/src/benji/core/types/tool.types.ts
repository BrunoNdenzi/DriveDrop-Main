/**
 * Benji V2 — Universal tool type contracts
 * Phase 3
 *
 * Every tool registered with BenjiToolRegistry must conform to ToolDefinition<TInput, TOutput>.
 * Every tool execution returns ToolResult<TOutput> via the registry wrapper.
 *
 * Governance invariants:
 *   I-11 Tool Purity — tool.execute() has no hidden side effects; I/O is fully declared here
 *   I-12 Centralized LLM Access — tools that need LLM calls import createChatCompletion only
 *   I-8  Every DB write inside a tool must emit a benji_event — registry enforces this via
 *        isMutation: true + event hooks
 *   I-13 Memory Determinism — tools declare namespaces they read/write via namespaceAccess;
 *        BenjiMemoryService (Phase 4) enforces the declared scope at execution time
 */

import type { NamespaceAccess } from './memory.types';

// ─── Core Result Type ─────────────────────────────────────────────────────────

/**
 * Universal return type for all tool executions.
 * The registry produces this; individual tool execute() functions return raw TOutput.
 *
 * _stepAction mirrors toolName and is used by GlobalPolicyGuard P2 to verify
 * that a validation step ran before a financial tool.
 */
export interface ToolResult<T = unknown> {
  success:     boolean;
  toolName:    string;
  _stepAction: string;   // = toolName; used by GlobalPolicyGuard (P2 check)
  durationMs:  number;
  data?:       T;        // present when success = true
  error?:      string;   // present when success = false
  errorCode?:  string;   // machine-readable error category
  stepId?:     string;   // plan step that triggered this execution
}

// ─── Execution Context ────────────────────────────────────────────────────────

/**
 * Context threaded through every tool execution by the orchestrator.
 * traceId and stepId are mandatory — no stub values (I-14).
 * The orchestrator owns generation of these IDs; the registry forwards them as-is.
 */
export interface ToolContext {
  requestId:   string;
  traceId:     string;    // mandatory: orchestration run identifier (I-14)
  stepId:      string;    // mandatory: step within the current orchestration run (was optional)
  stepAction?: string;    // optional: human-readable label for trace UI (e.g. 'validate.input')
  userId?:     string;
  planId?:     string;
  userType?:   'client' | 'driver' | 'admin' | 'broker';
  sessionId?:  string;
}

// ─── Tool Definition ──────────────────────────────────────────────────────────

/**
 * The contract that every registered tool must satisfy.
 *
 * - execute()          returns raw TOutput (the registry wraps it in ToolResult)
 * - validate()         optional fast pre-check; if it returns false the registry
 *                      short-circuits with a validation-failure ToolResult
 * - isMutation         when true, the registry fires registered event hooks after
 *                      every successful execution (I-8 compliance)
 * - namespaceAccess    declared memory namespaces this tool reads/writes (I-13);
 *                      absent = tool makes no memory calls (enforced in Phase 4)
 */
export interface ToolDefinition<TInput, TOutput> {
  readonly name:             string;
  readonly description:      string;
  readonly isMutation:       boolean;
  readonly namespaceAccess?: NamespaceAccess;   // I-13
  readonly validate?:        (input: unknown) => input is TInput;
  readonly execute:          (input: TInput, context: ToolContext) => Promise<TOutput>;
}

// ─── Result Builders (used by BenjiToolRegistry internally) ──────────────────

export function toolSuccess<T>(
  toolName:   string,
  data:       T,
  durationMs: number,
  stepId?:    string,
): ToolResult<T> {
  return {
    success:     true,
    toolName,
    _stepAction: toolName,
    durationMs,
    data,
    ...(stepId !== undefined ? { stepId } : {}),
  };
}

export function toolFailure(
  toolName:   string,
  error:      string,
  durationMs: number,
  errorCode?: string,
  stepId?:    string,
): ToolResult<unknown> {
  return {
    success:     false,
    toolName,
    _stepAction: toolName,
    durationMs,
    error,
    ...(errorCode !== undefined ? { errorCode } : {}),
    ...(stepId !== undefined ? { stepId } : {}),
  };
}

// ─── Static Cost + Latency Estimates ─────────────────────────────────────────
// Source: BENJI_V2_GOVERNANCE.md §2.8 — used by SimulationEngine (Phase 4)

export const TOOL_COST_USD: Readonly<Record<string, number>> = {
  'tool:chat.respond':             0.00025,
  'tool:shipment.parse':           0.00500,
  'tool:document.extract':         0.00800,
  'tool:pricing.calculate':        0.00000,
  'tool:route.optimize':           0.00020,
  'tool:dispatch.analyze':         0.00000,
  'tool:dispatch.assign':          0.00000,
  'tool:dispatch.recommendations': 0.00000,
  'tool:dispatch.accept':          0.00000,
  'tool:shipment.lookup':          0.00000,
  'tool:shipment.create':          0.00000,
  'tool:shipment.status_update':   0.00000,
  'tool:sms.send':                 0.00750,
  'tool:memory.read':              0.00000,
  'tool:memory.write':             0.00000,
  'tool:validate.input':           0.00000,
};

export const TOOL_LATENCY_MS: Readonly<Record<string, number>> = {
  'tool:chat.respond':             500,
  'tool:shipment.parse':           1500,
  'tool:document.extract':         2500,
  'tool:pricing.calculate':        80,
  'tool:route.optimize':           1200,
  'tool:dispatch.analyze':         400,
  'tool:dispatch.assign':          300,
  'tool:dispatch.recommendations': 350,
  'tool:dispatch.accept':          100,
  'tool:shipment.lookup':          80,
  'tool:shipment.create':          150,
  'tool:shipment.status_update':   80,
  'tool:sms.send':                 200,
  'tool:memory.read':              80,
  'tool:memory.write':             60,
  'tool:validate.input':           5,
};
