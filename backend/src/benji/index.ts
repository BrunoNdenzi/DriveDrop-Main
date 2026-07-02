/**
 * Benji V2 — Public barrel export
 * Phase 7E
 *
 * Single entry point for consumers of the Benji orchestrator subsystem.
 * Import from '@benji' (resolves to this file via tsconfig path alias).
 *
 * Governed by I-8A: all DB writes must flow through the approved services exported here.
 */

// ─── Auth ──────────────────────────────────────────────────────────────────────
export { streamTokenService } from './auth/stream-token.service';

// ─── Constants ────────────────────────────────────────────────────────────────
export { TraceOutcome } from './core/constants/trace-outcomes';
export type { TraceOutcomeValue } from './core/constants/trace-outcomes';

// ─── Orchestrators ────────────────────────────────────────────────────────────
export { benjiOrchestrator }       from './orchestrator/benji-orchestrator';
export { resumeOrchestrator }      from './orchestrator/resume.orchestrator';
export { streamingOrchestrator }   from './orchestrator/stream.orchestrator';

// ─── Core services ────────────────────────────────────────────────────────────
export { benjiToolRegistry }       from './tool/tool.registry';
export { benjiEventService }       from './events/index';
export { benjiTraceService }       from './trace/benji-trace.service';
export { benjiMemoryService }      from './memory/index';
export { globalPolicyGuard, globalPolicyCache } from './policy/global-policy.guard';
export { confirmationStore }       from './confirmation/confirmation.store';
export { benjiMonitoringService }  from './monitoring/benji-monitoring.service';
export { confirmationCleanupService, startConfirmationCleanup } from './confirmation/confirmation-cleanup.service';

// ─── Public types ─────────────────────────────────────────────────────────────
export type {
  OrchestratorRequest,
  OrchestratorResult,
  BenjiPlan,
  BenjiPlanStep,
  SafetyState,
  ConfirmationPayload,
  PolicyCheckpoint,
} from './core/types/orchestrator.types';

export type {
  ToolContext,
  ToolResult,
  ToolDefinition,
} from './core/types/tool.types';

export type {
  BenjiEventType,
  BenjiEventEnvelope,
  EventDurability,
} from './core/events/event.types';

export type {
  MemoryNamespace,
  MemoryEntry,
  MemoryKey,
  NamespaceAccess,
} from './core/types/memory.types';

export type {
  BenjiMetrics,
  ToolFailureRate,
  PolicyViolationCount,
} from './monitoring/benji-monitoring.service';
