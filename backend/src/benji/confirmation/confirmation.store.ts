/**
 * Benji V2 — ConfirmationStore
 * Phase 6C / Phase 6.1 hardening
 *
 * Persists suspended plan executions that are waiting for user confirmation.
 * Created when SimulationEngine returns gate='confirm' (risk 0.70–0.85).
 * Retrieved atomically via consume() when the user sends { traceId, confirmed: true }.
 *
 * Phase 6.1 improvements:
 *   - serialized_plan migrated to JSONB (schema-safe, no JSON.parse/stringify risk)
 *   - schema_version field added for future compatibility
 *   - consume() is atomic: delete-returning-row ensures single-use (no double-resume)
 *
 * Required schema (apply migration before deploying Phase 6):
 * ─────────────────────────────────────────────────────────────────────────────
 *   CREATE TABLE IF NOT EXISTS benji_pending_confirmations (
 *     trace_id          TEXT        PRIMARY KEY,
 *     user_id           UUID        NOT NULL,
 *     plan              JSONB       NOT NULL,
 *     simulation_result JSONB       NOT NULL,
 *     schema_version    INTEGER     NOT NULL DEFAULT 1,
 *     expires_at        TIMESTAMPTZ NOT NULL,
 *     created_at        TIMESTAMPTZ DEFAULT NOW()
 *   );
 *   CREATE INDEX IF NOT EXISTS benji_pending_confirmations_user_id
 *     ON benji_pending_confirmations (user_id);
 *   CREATE INDEX IF NOT EXISTS benji_pending_confirmations_expires_at
 *     ON benji_pending_confirmations (expires_at);
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Race-condition safety (6.1-3):
 *   consume() performs a DELETE...RETURNING on the primary key.
 *   If two concurrent requests send { traceId, confirmed: true } simultaneously,
 *   only one will receive the row back — the other will get null (already consumed).
 *   This is guaranteed by PostgreSQL DELETE semantics; no explicit lock is needed.
 *
 * TTL: 24 hours by default (set by orchestrator). Cleanup job removes expired rows.
 *
 * Governance: I-8A (writes through service only), I-10 (trace continuity), I-14
 */

import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';
import type { BenjiPlan } from '@benji/core/types/orchestrator.types';
import type { SimulationResult } from '@benji/simulation/simulation.engine';

const TABLE         = 'benji_pending_confirmations';
const SCHEMA_VERSION = 1;

// ─── Public types ─────────────────────────────────────────────────────────────

export interface PendingConfirmationRecord {
  traceId:          string;
  userId:           string;
  plan:             BenjiPlan;          // stored as JSONB (no serialization needed)
  simulationResult: SimulationResult;
  expiresAt:        string;
}

export interface ResolvedConfirmation {
  traceId:    string;
  userId:     string;
  plan:       BenjiPlan;
  simulation: SimulationResult;
  expiresAt:  string;
}

// ─── Internal row type ────────────────────────────────────────────────────────

interface ConfirmationRow {
  trace_id:          string;
  user_id:           string;
  plan:              unknown;
  simulation_result: unknown;
  schema_version:    number;
  expires_at:        string;
}

// ─── ConfirmationStore ────────────────────────────────────────────────────────

export class ConfirmationStore {
  /**
   * Persist a pending confirmation.
   * Upserts on trace_id (safe to call twice; second call overwrites — idempotent save).
   */
  async save(record: PendingConfirmationRecord): Promise<void> {
    const { error } = await supabaseAdmin
      .from(TABLE)
      .upsert({
        trace_id:          record.traceId,
        user_id:           record.userId,
        plan:              record.plan as unknown as Record<string, unknown>,
        simulation_result: record.simulationResult as unknown as Record<string, unknown>,
        schema_version:    SCHEMA_VERSION,
        expires_at:        record.expiresAt,
        created_at:        new Date().toISOString(),
      }, { onConflict: 'trace_id', ignoreDuplicates: false });

    if (error) {
      logger.warn('ConfirmationStore.save: failed to persist', {
        traceId: record.traceId,
        error:   String(error),
      });
      throw new Error(`ConfirmationStore.save failed: ${String(error)}`);
    }
  }

  /**
   * Atomically consume a pending confirmation.
   *
   * This is the ONLY correct way to retrieve a confirmation for resume.
   * Uses DELETE...RETURNING so the record is destroyed in the same operation as reading it.
   * If two concurrent requests race, only one will receive the row — the other gets null.
   *
   * Returns null if:
   *   - record not found (already consumed, never existed)
   *   - userId does not match the stored owner (security check)
   *   - record has expired
   */
  async consume(traceId: string, userId: string): Promise<ResolvedConfirmation | null> {
    // Atomic: DELETE and return the row in one roundtrip.
    // If another request already consumed it, `data` will be empty.
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .delete()
      .eq('trace_id', traceId)
      .select('*')
      .single();

    if (error || !data) {
      // Not found or already consumed
      return null;
    }

    const row = data as unknown as ConfirmationRow;

    // Security: confirm record belongs to the requesting user
    if (row.user_id !== userId) {
      logger.warn('ConfirmationStore.consume: userId mismatch — possible unauthorized attempt', {
        traceId,
        requestedBy: userId,
      });
      // Record was already deleted; we cannot put it back. Log and return null.
      return null;
    }

    // TTL check (belt-and-suspenders; cleanup job should prune expired rows)
    if (new Date(row.expires_at) < new Date()) {
      logger.warn('ConfirmationStore.consume: expired confirmation consumed and discarded', {
        traceId,
        expiresAt: row.expires_at,
      });
      return null;
    }

    // Schema version guard — if future versions add breaking changes, handle here
    if (row.schema_version !== SCHEMA_VERSION) {
      logger.warn('ConfirmationStore.consume: unexpected schema_version', {
        traceId,
        expected:   SCHEMA_VERSION,
        received:   row.schema_version,
      });
      // Best effort: attempt to use the record anyway (downgrade path for v1 → v2)
    }

    return {
      traceId:    row.trace_id,
      userId:     row.user_id,
      plan:       row.plan as BenjiPlan,
      simulation: row.simulation_result as SimulationResult,
      expiresAt:  row.expires_at,
    };
  }

  /**
   * Delete a confirmation record by traceId (used by cleanup job for expired rows).
   * For resume-path deletion, prefer consume() which is atomic.
   */
  async delete(traceId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from(TABLE)
      .delete()
      .eq('trace_id', traceId);

    if (error) {
      logger.warn('ConfirmationStore.delete: failed', { traceId, error: String(error) });
    }
  }

  /**
   * Delete all expired confirmation records.
   * Called by the cleanup service (Phase 7D).
   * Returns the number of records deleted.
   */
  async deleteExpired(): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('trace_id');

    if (error) {
      logger.warn('ConfirmationStore.deleteExpired: failed', { error: String(error) });
      return 0;
    }

    const count = Array.isArray(data) ? data.length : 0;
    if (count > 0) {
      logger.warn('ConfirmationStore.deleteExpired: pruned expired rows', { count });
    }
    return count;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const confirmationStore = new ConfirmationStore();
