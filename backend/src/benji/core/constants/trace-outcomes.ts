/**
 * Benji V2 — Canonical Trace Outcome Values
 * Phase 8.2
 *
 * Single source of truth for all `final_outcome` strings written to benji_traces.
 * Import this constant instead of using inline string literals.
 *
 * These values must match:
 *   - benjiTraceService.finalize() call sites in all orchestrators
 *   - BenjiMonitoringService filter predicates
 *   - Any external queries / dashboards on the benji_traces table
 *
 * Governance: I-14 (replay determinism requires stable outcome identifiers)
 */

export const TraceOutcome = {
  /** All plan steps executed successfully. */
  COMPLETED_SUCCESS:    'completed_success',

  /** Orchestrator halted pending user confirmation (simulation gate = confirm). */
  AWAITING_CONFIRMATION: 'awaiting_confirmation',

  /** Resumed after user confirmation; all steps executed successfully. */
  RESUMED_SUCCESS:      'resumed_success',

  /** Simulation engine blocked execution (risk > 0.85 threshold). */
  SIMULATION_BLOCKED:   'simulation_blocked',

  /**
   * Policy guard blocked execution at any checkpoint:
   *   after_request_intake, after_memory_influence,
   *   after_plan_creation, before_each_tool_call
   */
  POLICY_BLOCKED:       'policy_blocked',

  /**
   * General failure outcome. Used for:
   *   - Unhandled exceptions (catch blocks)
   *   - Critical step failures
   *   - try/finally fallback (when a more specific outcome was not already written)
   */
  FAILED:               'failed',

  /**
   * Orchestrator returned CLARIFICATION_LOOP — intent confidence too low.
   * Not considered a failure; counted separately in monitoring.
   */
  CLARIFICATION_REQUIRED: 'clarification_required',
} as const;

export type TraceOutcomeValue = typeof TraceOutcome[keyof typeof TraceOutcome];
