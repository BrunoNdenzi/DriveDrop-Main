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
import { clarificationStore } from '@benji/clarification/clarification.store';
import { generateClarificationQuestion } from '@benji/clarification/clarification.generator';
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
    { action: 'tool:shipment.parse',    critical: true  },   // parse first
    { action: 'tool:validate.input',    critical: false },   // validate parsed output; false so clarification loop fires instead of abort
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
  // Timing accumulator for [BENJI_TIMING] log
  const stepTimings: Record<string, number> = {};
  const _stepsStart = Date.now();

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
    const _toolStart = Date.now();
    const result = await benjiToolRegistry.execute(step.action, resolvedInput, toolContext);
    stepTimings[step.action] = Date.now() - _toolStart;

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

    // ── Phase 9.3: Clarification loop intercept ───────────────────────────
    // When tool:validate.input succeeds (tool ran OK) but the output reports
    // missing required fields, convert the failure into a natural clarification
    // request rather than surfacing raw validation errors to the user.
    if (step.action === 'tool:validate.input' && result.success === true) {
      const validation = result.data as { valid?: boolean; missingFields?: string[] } | undefined;
      if (validation?.valid === false && (validation.missingFields?.length ?? 0) > 0) {
        const question = generateClarificationQuestion(validation.missingFields ?? []);

        // Persist context so the route handler can merge on the follow-up turn
        clarificationStore.set(traceId, {
          userId:          request.userId,
          intent:          finalIntent ?? 'shipment.create',
          originalMessage: request.message,
        });

        await benjiTraceService.finalize(
          traceId,
          TraceOutcome.CLARIFICATION_REQUIRED,
          'CLARIFICATION_LOOP',
          finalIntent,
        );

        console.log('[BENJI_TIMING]', {
          traceId,
          intent: finalIntent,
          ...stepTimings,
          total: Date.now() - _stepsStart,
          outcome: 'CLARIFICATION_LOOP',
        });

        return {
          result: {
            success:              false,
            traceId,
            state:                'CLARIFICATION_LOOP',
            clarificationRequest: question,
          },
          priorOutputs,
        };
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    if (!result.success && step.critical) {
      await benjiTraceService.finalize(traceId, TraceOutcome.FAILED, 'BLOCKED', finalIntent);
      console.log('[BENJI_TIMING]', {
        traceId,
        intent: finalIntent,
        ...stepTimings,
        total:   Date.now() - _stepsStart,
        outcome: `CRITICAL_FAIL:${step.action}`,
      });
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

  console.log('[BENJI_TIMING]', {
    traceId,
    intent: finalIntent,
    ...stepTimings,
    total:   Date.now() - _stepsStart,
    outcome: 'STEPS_COMPLETE',
  });

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
      // ── INSTRUMENTATION ──────────────────────────────────────────────────
      console.log('[BENJI_AUDIT] ORCHESTRATOR_ENTER', {
        requestId: request.requestId,
        userId:    request.userId,
        userType:  request.userType,
        msgLen:    request.message.length,
        preIntent: request._classifiedIntent ?? 'none',
        ts:        new Date().toISOString(),
      });
      // ─────────────────────────────────────────────────────────────────────

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
      // Phase 9.3: If _classifiedIntent is already set by the route handler
      // (clarification resume), skip re-classification and use the stored intent.
      if (request._classifiedIntent !== undefined) {
        finalIntent = request._classifiedIntent;
      } else {
        const _classifyStart = Date.now();
        const classification = await benjiIntentService.classify({
          message:  request.message,
          userId:   request.userId,
          userType: request.userType,
          ...(request.sessionId !== undefined ? { sessionId: request.sessionId } : {}),
        });
        console.log('[BENJI_TIMING] classifier', { ms: Date.now() - _classifyStart, intent: classification.intent, confidence: classification.confidence, source: classification.source });

        finalIntent = classification.intent;
        request._classifiedIntent = finalIntent;

        if (classification.confidence < 0.55 || classification.ambiguous === true) {
          // ── Phase 9.3: store classifier clarification context so the follow-up
          //    message can be merged with the original and re-classified correctly.
          //    Without this, clarificationStore.get() returns null on the next turn
          //    and "Charlotte to Gastonia" is treated as a brand-new standalone message.
          clarificationStore.set(traceId, {
            userId:          request.userId,
            intent:          finalIntent ?? 'unknown',
            originalMessage: request.message,
          });

          await finalizeTrace(TraceOutcome.CLARIFICATION_REQUIRED, 'CLARIFICATION_LOOP', finalIntent);
          return {
            success:              false,
            traceId,
            state:                'CLARIFICATION_LOOP',
            clarificationRequest: `I'm not sure I understood — could you clarify what you'd like to do with "${request.message.slice(0, 60)}"?`,
          };
        }
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
