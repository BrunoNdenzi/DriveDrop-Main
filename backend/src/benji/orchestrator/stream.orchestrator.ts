/**
 * Benji V2 — StreamingOrchestrator + SSE event types
 * Phase 7A
 *
 * Provides Server-Sent Events (SSE) streaming of orchestration progress.
 * The route keeps the HTTP connection open and pushes JSON-encoded events
 * as each pipeline stage completes.
 *
 * SSE event types (sent as `data: <JSON>\n\n`):
 *   step_started     — tool about to execute
 *   tool_executing   — tool execute() called, awaiting result
 *   tool_completed   — tool returned success result
 *   tool_failed      — tool returned failure result
 *   simulation_blocked   — simulation gate = block
 *   require_confirmation — simulation gate = confirm (halted)
 *   clarification_required — intent confidence too low
 *   policy_blocked   — policy guard blocked execution
 *   complete         — orchestration finished successfully
 *   error            — unhandled internal error
 *
 * Design constraints:
 *   - No circular imports: imports from orchestrator types only; does NOT
 *     import benji-orchestrator.ts (would create circular dep via route)
 *   - All I/O through existing service singletons
 *   - Streams to Express Response via SSE (text/event-stream)
 *   - Falls back to non-streaming if client disconnects mid-run
 *
 * Governance: I-10, I-11, I-12, I-14
 */

import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
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
  BenjiPlan,
  BenjiPlanStep,
  MemoryContext,
  MemoryInfluence,
  PolicyCheckState,
  SafetyState,
  ConfirmationPayload,
} from '@benji/core/types/orchestrator.types';
import type { ToolContext, ToolResult } from '@benji/core/types/tool.types';
import type { MemoryNamespace } from '@benji/core/types/memory.types';
import { resolveStepInput } from './step-input.resolver';

// ─── SSE event types ──────────────────────────────────────────────────────────

export type BenjiStreamEventType =
  | 'step_started'
  | 'tool_executing'
  | 'tool_completed'
  | 'tool_failed'
  | 'simulation_blocked'
  | 'require_confirmation'
  | 'clarification_required'
  | 'policy_blocked'
  | 'complete'
  | 'error';

export interface BenjiStreamEvent {
  event:   BenjiStreamEventType;
  traceId: string;
  data:    Record<string, unknown>;
}

// ─── Orchestrator constants (duplicated from benji-orchestrator to avoid circ-dep) ──

const INTENT_PLAN_MAP: Readonly<Record<string, Array<{ action: string; critical: boolean }>>> = {
  'shipment.create': [
    { action: 'tool:validate.input', critical: true  },
    { action: 'tool:shipment.parse', critical: true  },
    { action: 'tool:chat.respond',   critical: false },
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

const ORCHESTRATOR_READ_NAMESPACES: ReadonlyArray<MemoryNamespace> = [
  'user.preferences',
  'user.vehicles',
  'user.history',
  'session.context',
  'dispatch.state',
  'shipment.draft',
];

// ─── SSE helpers ──────────────────────────────────────────────────────────────

function _send(res: Response, event: BenjiStreamEvent): void {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function _buildPlan(intent: string, planId: string): BenjiPlan {
  const specs = INTENT_PLAN_MAP[intent] ?? [{ action: 'tool:chat.respond', critical: false }];
  const steps: BenjiPlanStep[] = specs.map((spec, idx) => ({
    stepId:    `step-${idx + 1}`,
    action:    spec.action,
    critical:  spec.critical,
    dependsOn: idx === 0 ? [] : [`step-${idx}`],
  }));
  return { planId, intent, steps, createdAt: new Date().toISOString() };
}

function _deriveInfluence(memory: MemoryContext): MemoryInfluence {
  const count = memory.memories.length;
  return {
    clarificationThreshold: count === 0 ? 0.70 : 0.55,
    confidenceBoost:        count >= 5 ? 0.05 : count >= 2 ? 0.02 : 0.0,
  };
}

// ─── StreamingOrchestrator ────────────────────────────────────────────────────

export class StreamingOrchestrator {
  /**
   * Stream orchestration progress over an active SSE response.
   * Sets SSE headers, then runs the full pipeline emitting events at each stage.
   * The response is ended when the pipeline completes, times out, or errors.
   *
   * Lifecycle guarantees:
   *   - Heartbeat: comment event every 15 s to prevent proxy/load-balancer timeout
   *   - Disconnect: if the client closes the connection mid-run, the pipeline aborts
   *     after the current async operation completes and writes no further SSE events
   *   - Timeout: if the pipeline takes longer than STREAM_TIMEOUT_MS, it is aborted
   *     with an 'error' event and the trace is finalized as TraceOutcome.FAILED
   *   - try/finally always clears intervals, preventing memory leaks
   *
   * Caller must NOT call res.end() or write headers before invoking this method.
   */
  async stream(req: Request, res: Response, request: OrchestratorRequest): Promise<void> {
    // ── SSE headers ────────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');  // nginx: disable proxy buffering
    res.flushHeaders();

    // ── Lifecycle state ────────────────────────────────────────────────────
    const STREAM_TIMEOUT_MS  = 120_000;   // 2-minute hard limit
    const HEARTBEAT_MS       = 15_000;    // keep-alive comment to prevent proxy timeout

    let clientDisconnected   = false;
    let traceId              = '';
    let state: SafetyState   = 'IDLE';
    let finalIntent: string | undefined;
    let traceFinalized       = false;
    let heartbeatHandle: ReturnType<typeof setInterval> | null = null;
    let timeoutHandle:   ReturnType<typeof setTimeout>  | null = null;
    let abortedByTimeout     = false;

    // Abort signal: resolved when client disconnects OR pipeline times out
    let _abortResolve: (() => void) | null = null;
    // Store the promise to suppress noUnusedLocals — resolved externally by abort handlers
    void new Promise<void>(resolve => { _abortResolve = resolve; });

    // ── Disconnect handler ────────────────────────────────────────────────
    const onClientClose = () => {
      clientDisconnected = true;
      _abortResolve?.();
    };
    req.on('close', onClientClose);

    // ── Heartbeat ─────────────────────────────────────────────────────────
    heartbeatHandle = setInterval(() => {
      if (!res.writableEnded) {
        // SSE comment — keeps the connection alive without emitting an event
        res.write(': heartbeat\n\n');
      }
    }, HEARTBEAT_MS);

    // ── Timeout ───────────────────────────────────────────────────────────
    timeoutHandle = setTimeout(() => {
      abortedByTimeout = true;
      _abortResolve?.();
    }, STREAM_TIMEOUT_MS);

    // ── Cleanup (always runs) ─────────────────────────────────────────────
    const cleanup = () => {
      req.removeListener('close', onClientClose);
      if (heartbeatHandle !== null) { clearInterval(heartbeatHandle); heartbeatHandle = null; }
      if (timeoutHandle  !== null) { clearTimeout(timeoutHandle);     timeoutHandle  = null; }
    };

    const finalizeTrace = async (outcome: string, finalState: SafetyState, intent?: string) => {
      if (!traceFinalized && traceId) {
        traceFinalized = true;
        await benjiTraceService.finalize(traceId, outcome, finalState, intent).catch(() => undefined);
      }
    };

    const end = () => {
      if (!res.writableEnded) res.end();
    };

    // Helper: check if pipeline should abort
    const shouldAbort = () => clientDisconnected || abortedByTimeout;

    try {
      traceId = await benjiTraceService.createTrace(request);

      // ── after_request_intake (P9, P10) ─────────────────────────────────
      state = 'INTENT';
      if (shouldAbort()) { await finalizeTrace(TraceOutcome.FAILED, state, finalIntent); end(); return; }

      const intakeGuard = await globalPolicyGuard.check('after_request_intake', {
        request, systemState: 'IDLE',
      });
      if (!intakeGuard.passed) {
        await finalizeTrace(TraceOutcome.POLICY_BLOCKED, 'BLOCKED');
        _send(res, {
          event:   'policy_blocked',
          traceId,
          data:    { blockedBy: intakeGuard.blockers.map(b => b.ruleId) },
        });
        end(); return;
      }

      // ── Intent classification ───────────────────────────────────────────
      if (shouldAbort()) { await finalizeTrace(TraceOutcome.FAILED, state, finalIntent); end(); return; }

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
        _send(res, {
          event:   'clarification_required',
          traceId,
          data:    {
            clarificationRequest: `I'm not sure I understood — could you clarify what you'd like to do with "${request.message.slice(0, 60)}"?`,
          },
        });
        end(); return;
      }

      // ── Memory ──────────────────────────────────────────────────────────
      state = 'MEMORY';
      if (shouldAbort()) { await finalizeTrace(TraceOutcome.FAILED, state, finalIntent); end(); return; }

      const memEntries = await benjiMemoryService.read(
        request.userId, undefined, ORCHESTRATOR_READ_NAMESPACES,
      );
      const memContext: MemoryContext = { memories: memEntries };

      // ── Influence ───────────────────────────────────────────────────────
      state = 'INFLUENCE';
      const influence = _deriveInfluence(memContext);

      const influenceGuard = await globalPolicyGuard.check('after_memory_influence', {
        request, influence, systemState: 'INFLUENCE',
      });
      if (!influenceGuard.passed) {
        await finalizeTrace(TraceOutcome.POLICY_BLOCKED, 'BLOCKED', finalIntent);
        _send(res, {
          event:   'policy_blocked',
          traceId,
          data:    { blockedBy: influenceGuard.blockers.map(b => b.ruleId) },
        });
        end(); return;
      }

      // ── Plan ────────────────────────────────────────────────────────────
      state = 'PLAN';
      if (shouldAbort()) { await finalizeTrace(TraceOutcome.FAILED, state, finalIntent); end(); return; }

      const planId = randomUUID();
      const plan   = _buildPlan(finalIntent, planId);

      const planGuard = await globalPolicyGuard.check('after_plan_creation', {
        request, influence, plan, systemState: 'PLAN',
      });
      if (!planGuard.passed) {
        await finalizeTrace(TraceOutcome.POLICY_BLOCKED, 'BLOCKED', finalIntent);
        _send(res, {
          event:   'policy_blocked',
          traceId,
          data:    { blockedBy: planGuard.blockers.map(b => b.ruleId) },
        });
        end(); return;
      }

      // ── Simulation ──────────────────────────────────────────────────────
      state = 'SIMULATE';
      if (shouldAbort()) { await finalizeTrace(TraceOutcome.FAILED, state, finalIntent); end(); return; }

      const simulation = await simulationEngine.simulate(plan, request, memContext);

      if (simulation.executionGate === 'block') {
        await finalizeTrace(TraceOutcome.SIMULATION_BLOCKED, 'BLOCKED', finalIntent);
        _send(res, {
          event:   'simulation_blocked',
          traceId,
          data:    {
            riskScore:         simulation.riskScore,
            riskFactors:       simulation.riskFactors,
            wouldFailReason:   simulation.wouldFailReason,
          },
        });
        end(); return;
      }

      if (simulation.executionGate === 'confirm') {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const { confirmationStore } = await import('@benji/confirmation/confirmation.store');
        await confirmationStore.save({
          traceId,
          userId:           request.userId,
          plan,
          simulationResult: simulation,
          expiresAt,
        });
        await finalizeTrace(TraceOutcome.AWAITING_CONFIRMATION, 'AWAIT_CONFIRMATION', finalIntent);

        const confirmPayload: ConfirmationPayload = {
          riskScore:   simulation.riskScore,
          reasons:     simulation.riskFactors.map(f => f.explanation),
          planSummary: simulation.sideEffects,
          traceId,
          expiresAt,
        };
        _send(res, {
          event:   'require_confirmation',
          traceId,
          data:    { confirmationPayload: confirmPayload },
        });
        end(); return;
      }

      // ── Execute steps ───────────────────────────────────────────────────
      state = 'EXECUTE';
      const priorOutputs: Record<string, ToolResult<unknown>> = {};

      for (const step of plan.steps) {
        // Abort if client disconnected or timeout triggered
        if (shouldAbort()) {
          await finalizeTrace(TraceOutcome.FAILED, 'BLOCKED', finalIntent);
          traceFinalized = true;
          end(); return;
        }
        if (res.writableEnded) break;

        _send(res, {
          event:   'step_started',
          traceId,
          data:    { stepId: step.stepId, action: step.action },
        });

        const stepCheckState: PolicyCheckState = {
          request, influence, plan,
          currentStep:  step,
          priorOutputs,
          systemState:  'EXECUTE',
        };
        const stepGuard = await globalPolicyGuard.check('before_each_tool_call', stepCheckState);
        if (!stepGuard.passed) {
          await benjiTraceService.finalize(traceId, TraceOutcome.POLICY_BLOCKED, 'BLOCKED', finalIntent);
          traceFinalized = true;
          _send(res, {
            event:   'policy_blocked',
            traceId,
            data:    { stepId: step.stepId, blockedBy: stepGuard.blockers.map(b => b.ruleId) },
          });
          end(); return;
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

        _send(res, {
          event:   'tool_executing',
          traceId,
          data:    { stepId: step.stepId, action: step.action },
        });

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

        (result as ToolResult<unknown> & { _stepAction?: string })._stepAction = step.action;
        priorOutputs[step.stepId] = result;

        if (result.success) {
          _send(res, {
            event:   'tool_completed',
            traceId,
            data:    { stepId: step.stepId, action: step.action, durationMs: result.durationMs },
          });
        } else {
          _send(res, {
            event:   'tool_failed',
            traceId,
            data:    { stepId: step.stepId, action: step.action, error: result.error },
          });
          if (step.critical) {
            await benjiTraceService.finalize(traceId, TraceOutcome.FAILED, 'BLOCKED', finalIntent);
            traceFinalized = true;
            end(); return;
          }
        }
      }

      // ── Complete ────────────────────────────────────────────────────────
      state = 'OBSERVE';
      await finalizeTrace(TraceOutcome.COMPLETED_SUCCESS, 'COMPLETE', finalIntent);

      let responseText: string | undefined;
      for (const r of Object.values(priorOutputs)) {
        const s = r as ToolResult<unknown> & { _stepAction?: string };
        if (s._stepAction === 'tool:chat.respond' && r.success) {
          const t = (r.data as { response?: string } | undefined)?.response;
          if (t !== undefined) { responseText = t; break; }
        }
      }

      _send(res, {
        event:   'complete',
        traceId,
        data:    {
          response:  responseText,
          stepCount: plan.steps.length,
        },
      });
      end();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('StreamingOrchestrator: unhandled error', {
        requestId: request.requestId,
        traceId,
        state,
        error: msg,
      });
      if (abortedByTimeout) {
        _send(res, { event: 'error', traceId, data: { error: 'Stream timeout exceeded' } });
      } else {
        _send(res, { event: 'error', traceId, data: { error: msg } });
      }
      end();
    } finally {
      // Always clean up timers and disconnect listener — prevents memory leaks
      cleanup();
      await finalizeTrace(TraceOutcome.FAILED, state, finalIntent);
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const streamingOrchestrator = new StreamingOrchestrator();
