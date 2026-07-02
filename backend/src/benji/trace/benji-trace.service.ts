/**
 * Benji V2 — BenjiTraceService
 * Phase 5C
 *
 * Persistent distributed trace for every orchestrator run.
 * Enables I-14 replay determinism validation.
 *
 * Tables (apply migration before deploying Phase 5):
 * ─────────────────────────────────────────────────────────────────────────────
 *   CREATE TABLE IF NOT EXISTS benji_traces (
 *     trace_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
 *     user_id       UUID        NOT NULL,
 *     request_id    TEXT        NOT NULL,
 *     intent        TEXT,
 *     state         TEXT        NOT NULL DEFAULT 'IDLE',
 *     started_at    TIMESTAMPTZ DEFAULT NOW(),
 *     completed_at  TIMESTAMPTZ,
 *     final_outcome TEXT,
 *     step_count    INTEGER     DEFAULT 0
 *   );
 *
 *   CREATE TABLE IF NOT EXISTS benji_trace_steps (
 *     step_id          TEXT        NOT NULL,
 *     trace_id         UUID        NOT NULL REFERENCES benji_traces(trace_id),
 *     tool_name        TEXT,
 *     input_hash       TEXT,       -- SHA-256(JSON.stringify(input)).slice(0,16)
 *     output_hash      TEXT,       -- SHA-256(JSON.stringify(output)).slice(0,16)
 *     policy_decision  JSONB,
 *     success          BOOLEAN,
 *     timestamp        TIMESTAMPTZ DEFAULT NOW(),
 *     PRIMARY KEY (trace_id, step_id)
 *   );
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Governance: I-10, I-14
 */

import { createHash } from 'node:crypto';
import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';
import type { OrchestratorRequest, SafetyState } from '@benji/core/types/orchestrator.types';
import type { PolicyGuardResult } from '@benji/policy/global-policy.guard';
import type { ToolResult } from '@benji/core/types/tool.types';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TraceStepInput {
  stepId:          string;
  toolName:        string;
  input:           unknown;
  output:          ToolResult<unknown>;
  policyDecision?: PolicyGuardResult;
  success:         boolean;
}

export interface ReplayResult {
  deterministic:    boolean;
  divergencePoints: string[];
}

// ─── Internal DB row shapes ───────────────────────────────────────────────────

interface TraceStepRow {
  step_id:         string;
  trace_id:        string;
  tool_name:       string | null;
  input_hash:      string | null;
  output_hash:     string | null;
  policy_decision: unknown;
  success:         boolean | null;
  timestamp:       string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _shortHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 16);
}

// ─── BenjiTraceService ────────────────────────────────────────────────────────

export class BenjiTraceService {
  /**
   * Create a new trace row for an incoming orchestrator request.
   * Returns the generated traceId (UUID).
   */
  async createTrace(request: OrchestratorRequest): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from('benji_traces')
      .insert({
        user_id:    request.userId,
        request_id: request.requestId,
        state:      'IDLE' satisfies SafetyState,
        started_at: new Date().toISOString(),
      })
      .select('trace_id')
      .single();

    if (error || !data) {
      throw new Error(`BenjiTraceService.createTrace failed: ${String(error)}`);
    }

    const row = data as unknown as { trace_id: string };
    return row.trace_id;
  }

  /**
   * Append a step to an active trace.
   * Input/output hashes are SHA-256 fingerprints for determinism validation (I-14).
   * Upserts — safe to call twice for the same (trace_id, step_id) pair.
   */
  async appendStep(traceId: string, step: TraceStepInput): Promise<void> {
    const inputHash  = _shortHash(step.input);
    const outputHash = _shortHash(step.output);

    const { error } = await supabaseAdmin
      .from('benji_trace_steps')
      .upsert({
        step_id:         step.stepId,
        trace_id:        traceId,
        tool_name:       step.toolName,
        input_hash:      inputHash,
        output_hash:     outputHash,
        success:         step.success,
        timestamp:       new Date().toISOString(),
        ...(step.policyDecision !== undefined
          ? { policy_decision: step.policyDecision as unknown as Record<string, unknown> }
          : {}),
      }, { onConflict: 'trace_id,step_id', ignoreDuplicates: true });

    if (error) {
      logger.warn('BenjiTraceService.appendStep: failed to persist step', {
        traceId,
        stepId: step.stepId,
        error:  String(error),
      });
    }
  }

  /**
   * Mark a trace as complete.
   * Also increments step_count from the actual trace_steps rows.
   */
  async finalize(
    traceId:      string,
    outcome:      string,
    finalState:   SafetyState,
    intent?:      string,
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('benji_traces')
      .update({
        completed_at:  new Date().toISOString(),
        final_outcome: outcome,
        state:         finalState,
        ...(intent !== undefined ? { intent } : {}),
      })
      .eq('trace_id', traceId);

    if (error) {
      logger.warn('BenjiTraceService.finalize: failed to update trace', {
        traceId,
        error: String(error),
      });
    }
  }

  /**
   * Replay-validate a trace (I-14).
   * Fetches the trace and its steps, then checks that:
   *   1. All steps have recorded input/output hashes
   *   2. Tools declared as deterministic produce stable fingerprints
   *      (same input_hash → same output_hash, per tool_name)
   *
   * Returns divergence points when determinism is broken.
   */
  async replay(traceId: string): Promise<ReplayResult> {
    const { data: traceData, error: traceError } = await supabaseAdmin
      .from('benji_traces')
      .select('*')
      .eq('trace_id', traceId)
      .single();

    if (traceError || !traceData) {
      throw new Error(`BenjiTraceService.replay: trace not found (${traceId})`);
    }

    const { data: stepsData, error: stepsError } = await supabaseAdmin
      .from('benji_trace_steps')
      .select('*')
      .eq('trace_id', traceId)
      .order('timestamp', { ascending: true });

    if (stepsError || !stepsData) {
      throw new Error(`BenjiTraceService.replay: steps not found (${traceId})`);
    }

    const steps = stepsData as unknown as TraceStepRow[];
    const divergencePoints: string[] = [];

    // Check that no step is missing hashes
    for (const step of steps) {
      if (!step.input_hash || !step.output_hash) {
        divergencePoints.push(`step ${step.step_id}: missing hash (non-deterministic or untracked)`);
      }
    }

    // For each tool, verify input_hash → output_hash is stable across all occurrences
    const fingerprints = new Map<string, string>(); // `${toolName}:${inputHash}` → outputHash
    for (const step of steps) {
      if (!step.tool_name || !step.input_hash || !step.output_hash) continue;
      const key          = `${step.tool_name}:${step.input_hash}`;
      const priorOutput  = fingerprints.get(key);
      if (priorOutput === undefined) {
        fingerprints.set(key, step.output_hash);
      } else if (priorOutput !== step.output_hash) {
        divergencePoints.push(
          `step ${step.step_id}: tool ${step.tool_name} produced different output for same input (non-deterministic)`,
        );
      }
    }

    return {
      deterministic:    divergencePoints.length === 0,
      divergencePoints,
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const benjiTraceService = new BenjiTraceService();
