/**
 * Benji V2 — ResumeOrchestrator
 * Phase 6B
 *
 * Handles resumption of suspended plan executions after user confirmation.
 *
 * Contract:
 *   - Receives { traceId, userId } after the user sends { traceId, confirmed: true }
 *   - Retrieves the saved plan from ConfirmationStore
 *   - Executes the plan steps WITHOUT re-running intent classification,
 *     memory retrieval, or simulation (trace continuity preserved — I-14)
 *   - Deletes the pending confirmation on completion or failure
 *   - Returns OrchestratorResult with the same traceId as the original request
 *
 * The new trace is appended to the EXISTING trace, not a new one.
 * Resume steps use step IDs prefixed with 'r-' to distinguish from original steps.
 *
 * Governance: I-10, I-14
 */

import { logger } from '@utils/logger';
import { TraceOutcome } from '@benji/core/constants/trace-outcomes';
import { confirmationStore } from '@benji/confirmation/confirmation.store';
import { benjiTraceService } from '@benji/trace/benji-trace.service';
import { executeSteps } from './benji-orchestrator';
import type {
  OrchestratorResult,
  OrchestratorRequest,
  MemoryInfluence,
  SafetyState,
} from '@benji/core/types/orchestrator.types';

// ─── ResumeOrchestrator ───────────────────────────────────────────────────────

export class ResumeOrchestrator {
  /**
   * Resume a suspended plan execution.
   *
   * @param traceId  The traceId returned in the original AWAIT_CONFIRMATION response
   * @param userId   The authenticated user's ID (security binding)
   * @param request  Reconstructed request stub with the original request fields.
   *                 Must include requestId, userId, userType, message.
   *                 The orchestrator already set _classifiedIntent — pass it through.
   */
  async resume(
    traceId: string,
    userId:  string,
    request: OrchestratorRequest,
  ): Promise<OrchestratorResult> {
    let traceFinalized = false;

    const finalizeTrace = async (outcome: string) => {
      if (!traceFinalized) {
        traceFinalized = true;
        // Derive the correct SafetyState from the outcome:
        //   success outcomes  → COMPLETE
        //   all other paths   → BLOCKED (policy_blocked, failed, finalized_by_finally)
        const finalState: SafetyState =
          outcome === TraceOutcome.RESUMED_SUCCESS ? 'COMPLETE' : 'BLOCKED';
        await benjiTraceService
          .finalize(traceId, outcome, finalState)
          .catch(() => undefined);
      }
    };

    try {
      // Atomically consume the pending confirmation (single-use — 6.1-3)
      const confirmation = await confirmationStore.consume(traceId, userId);

      if (!confirmation) {
        return {
          success:   false,
          traceId,
          state:     'BLOCKED',
          error:     'Confirmation not found, expired, or belongs to a different user',
        };
      }

      const { plan } = confirmation;

      // Derive a minimal memory influence (same as original; no re-retrieval)
      const influence: MemoryInfluence = {
        clarificationThreshold: 0.55,
        confidenceBoost:        0.0,
      };

      // Prefix step IDs so they are distinct in the trace (I-14 replay safety)
      const resumeSteps = plan.steps.map(s => ({
        ...s,
        stepId: `r-${s.stepId}`,
      }));

      const resumePlan = {
        ...plan,
        steps: resumeSteps,
      };

      // Execute the plan steps
      const { result: earlyExit, priorOutputs } = await executeSteps(
        resumeSteps,
        resumePlan,
        request,
        influence,
        traceId,
        plan.intent,
      );

      // consume() already deleted the record atomically; no additional delete needed

      if (earlyExit !== null) {
        traceFinalized = true;
        return earlyExit;
      }

      await finalizeTrace(TraceOutcome.RESUMED_SUCCESS);

      const chatOutput = Object.values(priorOutputs)
        .find(r => {
          const s = r as typeof r & { _stepAction?: string };
          return s._stepAction === 'tool:chat.respond' && r.success;
        });
      const responseText = (chatOutput?.data as { response?: string } | undefined)?.response;

      return {
        success: true,
        traceId,
        state:   'COMPLETE',
        data:    priorOutputs,
        ...(responseText !== undefined ? { response: responseText } : {}),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('ResumeOrchestrator.resume: unhandled error', {
        traceId,
        userId,
        error: msg,
      });
      // consume() already deleted the record; no cleanup needed
      return {
        success: false,
        traceId,
        state:   'BLOCKED',
        error:   msg,
      };
    } finally {
      await finalizeTrace(TraceOutcome.FAILED);
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const resumeOrchestrator = new ResumeOrchestrator();
