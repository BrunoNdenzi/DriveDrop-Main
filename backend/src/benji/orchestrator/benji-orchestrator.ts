/**
 * Benji V2 — BenjiOrchestrator
 * Phase 5D / Phase 5.1 hardening
 *
 * Full orchestration pipeline:
 *
 *   intake → INTENT → MEMORY → INFLUENCE → PLAN →
 *   PolicyGuard(after_request_intake, after_memory_influence, after_plan_creation) →
 *   SIMULATE →
 *     gate='block'   → BLOCKED (return immediately)
 *     gate='confirm' → AWAIT_CONFIRMATION (persist plan, return confirmation payload)
 *     gate='proceed' → EXECUTE
 *   EXECUTE: for each step →
 *     PolicyGuard(before_each_tool_call) →
 *     ToolRegistry.execute() →
 *     TraceService.appendStep() →
 *   OBSERVE → TraceService.finalize() → COMPLETE
 *
 * Trace safety (5.1-4):
 *   try/finally guarantees every trace is finalized on all code paths (I-10).
 *
 * Phase 5.1 fixes:
 *   - 'confirm' gate now HALTS execution and returns AWAIT_CONFIRMATION (was wrongly proceed)
 *   - try/finally closes all trace paths (success/blocked/policy/exception)
 *   - removed dead memKeys variable
 *   - executeSteps() extracted as shared function for resume()
 *
 * Governance: I-7, I-8, I-10, I-11, I-12, I-13, I-14
 */

import { randomUUID } from 'node:crypto';
import { logger } from '@utils/logger';
import { TraceOutcome } from '@benji/core/constants/trace-outcomes';
import { benjiIntentService } from '@benji/ai/classifier/intent.service';
import { benjiMemoryService } from '@benji/memory/index';
import { benjiToolRegistry } from '@benji/tool/tool.registry';
import { globalPolicyGuard } from '@benji/policy/global-policy.guard';
import { simulationEngine } from '@benji/simulation/simulation.engine';
import { benjiTraceService } from '@benji/trace/benji-trace.service';
import type {
  OrchestratorRequest,
  OrchestratorResult,
  BenjiPlan,
  BenjiPlanStep,
  MemoryContext,
  MemoryInfluence,
  PolicyCheckState,
  SafetyState,
} from '@benji/core/types/orchestrator.types';
import { resolveStepInput } from './step-input.resolver';
import type { ToolContext, ToolResult } from '@benji/core/types/tool.types';
import type { MemoryNamespace } from '@benji/core/types/memory.types';
import type { SimulationResult } from '@benji/simulation/simulation.engine';

// ─── Intent → Plan mapping ────────────────────────────────────────────────────

interface StepSpec {
  action:   string;
  critical: boolean;
}

const INTENT_PLAN_MAP: Readonly<Record<string, StepSpec[]>> = {
  'shipment.create': [
    { action: 'tool:validate.input',    critical: true  },
    { action: 'tool:shipment.parse',    critical: true  },
    { action: 'tool:pricing.calculate', critical: false },
    { action: 'tool:shipment.create',   critical: true  },
    { action: 'tool:chat.respond',      critical: false },
  ],
  'shipment.track': [
    { action: 'tool:validate.input', critical: true  },
    { action: 'tool:chat.respond',   critical: false },
  ],
  'shipment.quote': [
    { action: 'tool:validate.input', critical: true  },
    { action: 'tool:chat.respond',   critical: false },
  ],
  'dispatch.accept': [
    { action: 'tool:validate.input', critical: true  },
    { action: 'tool:chat.respond',   critical: false },
  ],
  'account.query': [
    { action: 'tool:memory.read',    critical: false },
    { action: 'tool:chat.respond',   critical: false },
  ],
};

const DEFAULT_PLAN_STEPS: StepSpec[] = [
  { action: 'tool:chat.respond', critical: false },
];

// All memory namespaces the orchestrator may read
const ORCHESTRATOR_READ_NAMESPACES: ReadonlyArray<MemoryNamespace> = [
  'user.preferences',
  'user.vehicles',
  'user.history',
  'session.context',
  'dispatch.state',
  'shipment.draft',
];

// ─── Plan builder ─────────────────────────────────────────────────────────────

function _buildPlan(intent: string, planId: string): BenjiPlan {
  const specs = INTENT_PLAN_MAP[intent] ?? DEFAULT_PLAN_STEPS;
  const steps: BenjiPlanStep[] = specs.map((spec, idx) => ({
    stepId:    `step-${idx + 1}`,
    action:    spec.action,
    critical:  spec.critical,
    dependsOn: idx === 0 ? [] : [`step-${idx}`],
  }));
  return {
    planId,
    intent,
    steps,
    createdAt: new Date().toISOString(),
  };
}

// ─── Memory influence derivation ──────────────────────────────────────────────

function _deriveMemoryInfluence(memory: MemoryContext): MemoryInfluence {
  const count = memory.memories.length;
  // I-7/P1: floor is 0.55 — memory may only raise the threshold, never lower it
  return {
    clarificationThreshold: count === 0 ? 0.70 : 0.55,
    confidenceBoost:        count >= 5 ? 0.05 : count >= 2 ? 0.02 : 0.0,
  };
}

// ─── Result builders ──────────────────────────────────────────────────────────

function _blocked(
  traceId:  string,
  blockers: Array<{ reason?: string; ruleId: string }>,
  state:    SafetyState,
): OrchestratorResult {
  return {
    success:   false,
    traceId,
    state,
    blockedBy: blockers.map(b => `${b.ruleId}${b.reason ? `: ${b.reason}` : ''}`),
  };
}

// ─── Shared step executor (used by handle() and resume()) ────────────────────

/**
 * Execute a list of plan steps in order.
 * Returns `{ result: OrchestratorResult }` on early exit (blocked/critical failure),
 * or `{ result: null, priorOutputs }` if all steps completed.
 */
export async function executeSteps(
  steps:       BenjiPlanStep[],
  plan:        BenjiPlan,
  request:     OrchestratorRequest,
  influence:   MemoryInfluence,
  traceId:     string,
  finalIntent: string | undefined,
): Promise<{ result: OrchestratorResult | null; priorOutputs: Record<string, ToolResult<unknown>> }> {
  const priorOutputs: Record<string, ToolResult<unknown>> = {};

  for (const step of steps) {
    const stepCheckState: PolicyCheckState = {
      request,
      influence,
      plan,
      currentStep:  step,
      priorOutputs,
      systemState:  'EXECUTE',
    };
    const stepGuard = await globalPolicyGuard.check('before_each_tool_call', stepCheckState);
    if (!stepGuard.passed) {
      await benjiTraceService.finalize(traceId, TraceOutcome.POLICY_BLOCKED, 'BLOCKED', finalIntent);
      return {
        result: _blocked(traceId, stepGuard.blockers, 'BLOCKED'),
        priorOutputs,
      };
    }

    const toolContext: ToolContext = {
      requestId:  request.requestId,
      traceId,
      stepId:     step.stepId,
      stepAction: step.action,
      userId:     request.userId,
      userType:   request.userType,
      planId:     plan.planId,
      ...(request.sessionId !== undefined ? { sessionId: request.sessionId } : {}),
    };

    const resolvedInput = resolveStepInput(step.action, step.input, request, priorOutputs, finalIntent);
    const result = await benjiToolRegistry.execute(step.action, resolvedInput, toolContext);

    await benjiTraceService.appendStep(traceId, {
      stepId:         step.stepId,
      toolName:       step.action,
      input:          resolvedInput,
      output:         result,
      policyDecision: stepGuard,
      success:        result.success,
    });

    // Stamp for P2 checks on subsequent steps
    (result as ToolResult<unknown> & { _stepAction?: string })._stepAction = step.action;
    priorOutputs[step.stepId] = result;

    if (!result.success && step.critical) {
      await benjiTraceService.finalize(traceId, TraceOutcome.FAILED, 'BLOCKED', finalIntent);
      return {
        result: {
          success: false,
          traceId,
          state:   'BLOCKED',
          error:   `Critical step '${step.action}' failed: ${result.error ?? 'unknown error'}`,
        },
        priorOutputs,
      };
    }
  }

  return { result: null, priorOutputs };
}

// ─── Response text extractor ──────────────────────────────────────────────────

function _extractResponse(outputs: Record<string, ToolResult<unknown>>): string | undefined {
  for (const r of Object.values(outputs)) {
    const stamped = r as ToolResult<unknown> & { _stepAction?: string };
    if (stamped._stepAction === 'tool:chat.respond' && r.success) {
      const text = (r.data as { response?: string } | undefined)?.response;
      if (text !== undefined) return text;
    }
  }
  return undefined;
}

// ─── BenjiOrchestrator ────────────────────────────────────────────────────────

export class BenjiOrchestrator {
  /**
   * Primary entry point.
   * Never throws — all errors produce OrchestratorResult.success = false.
   * try/finally guarantees trace finalization on every code path (I-10).
   */
  async handle(request: OrchestratorRequest): Promise<OrchestratorResult> {
    let traceId            = '';
    let state: SafetyState = 'IDLE';
    let finalIntent: string | undefined;
    let traceFinalized     = false;

    const finalizeTrace = async (outcome: string, finalState: SafetyState, intent?: string) => {
      if (!traceFinalized && traceId) {
        traceFinalized = true;
        await benjiTraceService.finalize(traceId, outcome, finalState, intent).catch(() => undefined);
      }
    };

    try {
      // ── Step 0: Start trace (I-10) ─────────────────────────────────────
      traceId = await benjiTraceService.createTrace(request);

      // ── Step 1: after_request_intake (P9, P10) ─────────────────────────
      state = 'INTENT';
      const intakeGuard = await globalPolicyGuard.check('after_request_intake', {
        request,
        systemState: 'IDLE',
      });
      if (!intakeGuard.passed) {
        await finalizeTrace(TraceOutcome.POLICY_BLOCKED, 'BLOCKED');
        return _blocked(traceId, intakeGuard.blockers, 'BLOCKED');
      }

      // ── Step 2: Intent classification ──────────────────────────────────
      const classification = await benjiIntentService.classify({
        message:  request.message,
        userId:   request.userId,
        userType: request.userType,
        ...(request.sessionId !== undefined ? { sessionId: request.sessionId } : {}),
      });

      finalIntent = classification.intent;
      request._classifiedIntent = finalIntent;

      if (classification.confidence < 0.55 || classification.ambiguous === true) {
        await finalizeTrace(TraceOutcome.CLARIFICATION_REQUIRED, 'CLARIFICATION_LOOP', finalIntent);
        return {
          success:              false,
          traceId,
          state:                'CLARIFICATION_LOOP',
          clarificationRequest: `I'm not sure I understood — could you clarify what you'd like to do with "${request.message.slice(0, 60)}"?`,
        };
      }

      // ── Step 3: Memory retrieval ────────────────────────────────────────
      state = 'MEMORY';
      const memEntries = await benjiMemoryService.read(
        request.userId,
        undefined,
        ORCHESTRATOR_READ_NAMESPACES,
      );
      const memContext: MemoryContext = { memories: memEntries };

      // ── Step 4: Memory influence ────────────────────────────────────────
      state = 'INFLUENCE';
      const influence = _deriveMemoryInfluence(memContext);

      // ── Step 5: after_memory_influence (P1) ────────────────────────────
      const influenceGuard = await globalPolicyGuard.check('after_memory_influence', {
        request, influence, systemState: 'INFLUENCE',
      });
      if (!influenceGuard.passed) {
        await finalizeTrace(TraceOutcome.POLICY_BLOCKED, 'BLOCKED', finalIntent);
        return _blocked(traceId, influenceGuard.blockers, 'BLOCKED');
      }

      // ── Step 6: Build plan ──────────────────────────────────────────────
      state = 'PLAN';
      const planId = randomUUID();
      const plan   = _buildPlan(finalIntent, planId);

      // ── Step 7: after_plan_creation (P3, P6, P7, P8) ───────────────────
      const planGuard = await globalPolicyGuard.check('after_plan_creation', {
        request, influence, plan, systemState: 'PLAN',
      });
      if (!planGuard.passed) {
        await finalizeTrace(TraceOutcome.POLICY_BLOCKED, 'BLOCKED', finalIntent);
        return _blocked(traceId, planGuard.blockers, 'BLOCKED');
      }

      // ── Step 8: Simulation ──────────────────────────────────────────────
      state = 'SIMULATE';
      const simulation = await simulationEngine.simulate(plan, request, memContext);

      if (simulation.executionGate === 'block') {
        await finalizeTrace(TraceOutcome.SIMULATION_BLOCKED, 'BLOCKED', finalIntent);
        return {
          success:   false,
          traceId,
          state:     'BLOCKED',
          blockedBy: [`SIMULATION: risk score ${simulation.riskScore.toFixed(2)} exceeds 0.85 threshold`],
          ...(simulation.wouldFailReason !== undefined
            ? { clarificationRequest: simulation.wouldFailReason }
            : {}),
        };
      }

      // gate='confirm': HALT execution — no tools fire until user confirms (5.1-2)
      if (simulation.executionGate === 'confirm') {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await this._persistPendingConfirmation(traceId, request.userId, plan, simulation, expiresAt);
        // Trace written as AWAIT_CONFIRMATION — resume() will re-finalize to COMPLETE/BLOCKED
        await finalizeTrace(TraceOutcome.AWAITING_CONFIRMATION, 'AWAIT_CONFIRMATION', finalIntent);

        return {
          success:             false,
          traceId,
          state:               'AWAIT_CONFIRMATION',
          confirmationPayload: {
            riskScore:   simulation.riskScore,
            reasons:     simulation.riskFactors.map(f => f.explanation),
            planSummary: simulation.sideEffects,
            traceId,
            expiresAt,
          },
        };
      }

      // ── Step 9: Execute plan steps ──────────────────────────────────────
      state = 'EXECUTE';
      const { result: earlyExit, priorOutputs } = await executeSteps(
        plan.steps, plan, request, influence, traceId, finalIntent,
      );
      if (earlyExit !== null) {
        traceFinalized = true;
        return earlyExit;
      }

      // ── Step 10: Finalize ───────────────────────────────────────────────
      state = 'OBSERVE';
      await finalizeTrace(TraceOutcome.COMPLETED_SUCCESS, 'COMPLETE', finalIntent);

      return {
        success: true,
        traceId,
        state:   'COMPLETE',
        data:    priorOutputs,
        ...((_extractResponse(priorOutputs)) !== undefined
          ? { response: _extractResponse(priorOutputs) as string }
          : {}),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('BenjiOrchestrator.handle: unhandled error', {
        requestId: request.requestId,
        traceId,
        state,
        error:     msg,
      });
      return {
        success: false,
        traceId,
        state:   'BLOCKED',
        error:   msg,
      };
    } finally {
      // I-10: guaranteed trace finalization on all paths (fallback — only fires if not already finalized)
      await finalizeTrace(TraceOutcome.FAILED, state, finalIntent);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async _persistPendingConfirmation(
    traceId:    string,
    userId:     string,
    plan:       BenjiPlan,
    simulation: SimulationResult,
    expiresAt:  string,
  ): Promise<void> {
    // Dynamic import avoids circular dependency at module load
    const { confirmationStore } = await import('@benji/confirmation/confirmation.store');
    await confirmationStore.save({
      traceId,
      userId,
      plan,
      simulationResult: simulation,
      expiresAt,
    });
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const benjiOrchestrator = new BenjiOrchestrator();
