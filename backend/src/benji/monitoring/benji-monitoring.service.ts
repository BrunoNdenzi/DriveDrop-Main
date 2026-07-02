/**
 * Benji V2 — BenjiMonitoringService
 * Phase 7C
 *
 * Aggregates observability metrics from existing event tables.
 * All data is read-only (SELECT only) — no writes.
 *
 * Metrics exposed:
 *   - averageOrchestrationLatencyMs  — p50 duration from benji_traces
 *   - toolFailureRate                — per-tool failure % from benji_events
 *   - policyViolationCounts          — per-rule counts from policy_violations
 *   - confirmationAcceptanceRate     — accepted / (accepted + expired) from benji_traces
 *   - simulationBlockRate            — simulation_blocked / total from benji_traces
 *
 * Results are cached for CACHE_TTL_MS to avoid hammering the DB on every request.
 * Cache is invalidated on next request after TTL expires (lazy refresh).
 *
 * Governance: I-8A (read-only; no DB writes), I-11
 */

import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';
import { TraceOutcome } from '@benji/core/constants/trace-outcomes';

const CACHE_TTL_MS    = 5 * 60 * 1000;   // 5-minute cache
const LOOKBACK_DAYS   = 7;

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ToolFailureRate {
  toolName:    string;
  totalCalls:  number;
  failedCalls: number;
  failureRate: number;  // 0.0–1.0
}

export interface PolicyViolationCount {
  ruleId:    string;
  count:     number;
  severity:  string;
}

export interface BenjiMetrics {
  windowDays:                    number;
  computedAt:                    string;
  averageOrchestrationLatencyMs: number | null;   // null if no completed traces
  toolFailureRates:              ToolFailureRate[];
  policyViolationCounts:         PolicyViolationCount[];
  confirmationAcceptanceRate:    number | null;   // null if no confirmations issued
  simulationBlockRate:           number | null;   // null if no traces
  totalTraces:                   number;
  completedTraces:               number;
  blockedTraces:                 number;
}

// ─── BenjiMonitoringService ───────────────────────────────────────────────────

export class BenjiMonitoringService {
  private _cache: BenjiMetrics | null    = null;
  private _cacheExpiresAt               = 0;

  /**
   * Get aggregated metrics.
   * Returns cached data if still fresh; otherwise queries DB and refreshes cache.
   */
  async getMetrics(): Promise<BenjiMetrics> {
    if (this._cache !== null && Date.now() < this._cacheExpiresAt) {
      return this._cache;
    }
    const metrics = await this._compute();
    this._cache          = metrics;
    this._cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return metrics;
  }

  /** Force-refresh the cache (e.g. after a deploy). */
  invalidateCache(): void {
    this._cache          = null;
    this._cacheExpiresAt = 0;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async _compute(): Promise<BenjiMetrics> {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const now   = new Date().toISOString();

    const [traces, toolEvents, violations] = await Promise.all([
      this._fetchTraces(since),
      this._fetchToolEvents(since),
      this._fetchViolations(since),
    ]);

    return {
      windowDays:                    LOOKBACK_DAYS,
      computedAt:                    now,
      averageOrchestrationLatencyMs: this._computeAvgLatency(traces),
      toolFailureRates:              this._computeToolFailureRates(toolEvents),
      policyViolationCounts:         this._computeViolationCounts(violations),
      confirmationAcceptanceRate:    this._computeConfirmationRate(traces),
      simulationBlockRate:           this._computeSimulationBlockRate(traces),
      totalTraces:                   traces.length,
      completedTraces:               traces.filter(t => t.final_outcome === TraceOutcome.COMPLETED_SUCCESS).length,
      blockedTraces:                 traces.filter(t => t.state === 'BLOCKED').length,
    };
  }

  private async _fetchTraces(since: string): Promise<Array<{
    trace_id:      string;
    state:         string;
    final_outcome: string | null;
    started_at:    string;
    completed_at:  string | null;
  }>> {
    const { data, error } = await supabaseAdmin
      .from('benji_traces')
      .select('trace_id, state, final_outcome, started_at, completed_at')
      .gte('started_at', since);

    if (error) {
      logger.warn('BenjiMonitoringService: failed to fetch traces', { error: String(error) });
      return [];
    }
    return (data ?? []) as Array<{
      trace_id: string; state: string;
      final_outcome: string | null; started_at: string; completed_at: string | null;
    }>;
  }

  private async _fetchToolEvents(since: string): Promise<Array<{
    tool_name: string | null;
    success:   boolean | null;
  }>> {
    const { data, error } = await supabaseAdmin
      .from('benji_events')
      .select('tool_name, success')
      .gte('occurred_at', since);

    if (error) {
      logger.warn('BenjiMonitoringService: failed to fetch tool events', { error: String(error) });
      return [];
    }
    return (data ?? []) as Array<{ tool_name: string | null; success: boolean | null }>;
  }

  private async _fetchViolations(since: string): Promise<Array<{
    rule_id:  string;
    severity: string;
  }>> {
    const { data, error } = await supabaseAdmin
      .from('policy_violations')
      .select('rule_id, severity')
      .gte('created_at', since);

    if (error) {
      logger.warn('BenjiMonitoringService: failed to fetch violations', { error: String(error) });
      return [];
    }
    return (data ?? []) as Array<{ rule_id: string; severity: string }>;
  }

  private _computeAvgLatency(
    traces: Array<{ started_at: string; completed_at: string | null; state: string }>,
  ): number | null {
    const completed = traces.filter(t => t.completed_at !== null && t.state === 'COMPLETE');
    if (completed.length === 0) return null;
    const totalMs = completed.reduce((sum, t) => {
      const ms = new Date(t.completed_at!).getTime() - new Date(t.started_at).getTime();
      return sum + ms;
    }, 0);
    return Math.round(totalMs / completed.length);
  }

  private _computeToolFailureRates(
    events: Array<{ tool_name: string | null; success: boolean | null }>,
  ): ToolFailureRate[] {
    const counts: Record<string, { total: number; failed: number }> = {};
    for (const e of events) {
      if (!e.tool_name) continue;
      const entry = counts[e.tool_name] ?? { total: 0, failed: 0 };
      entry.total  += 1;
      if (!e.success) entry.failed += 1;
      counts[e.tool_name] = entry;
    }
    return Object.entries(counts).map(([toolName, { total, failed }]) => ({
      toolName,
      totalCalls:  total,
      failedCalls: failed,
      failureRate: total > 0 ? failed / total : 0,
    })).sort((a, b) => b.failureRate - a.failureRate);
  }

  private _computeViolationCounts(
    violations: Array<{ rule_id: string; severity: string }>,
  ): PolicyViolationCount[] {
    const counts: Record<string, { count: number; severity: string }> = {};
    for (const v of violations) {
      const entry = counts[v.rule_id] ?? { count: 0, severity: v.severity };
      entry.count += 1;
      counts[v.rule_id] = entry;
    }
    return Object.entries(counts)
      .map(([ruleId, { count, severity }]) => ({ ruleId, count, severity }))
      .sort((a, b) => b.count - a.count);
  }

  private _computeConfirmationRate(
    traces: Array<{ final_outcome: string | null }>,
  ): number | null {
    const awaited  = traces.filter(t =>
      t.final_outcome === TraceOutcome.AWAITING_CONFIRMATION ||
      t.final_outcome === TraceOutcome.RESUMED_SUCCESS,
    ).length;
    if (awaited === 0) return null;
    const accepted = traces.filter(t => t.final_outcome === TraceOutcome.RESUMED_SUCCESS).length;
    return accepted / awaited;
  }

  private _computeSimulationBlockRate(
    traces: Array<{ final_outcome: string | null }>,
  ): number | null {
    if (traces.length === 0) return null;
    const blocked = traces.filter(t => t.final_outcome === TraceOutcome.SIMULATION_BLOCKED).length;
    return blocked / traces.length;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const benjiMonitoringService = new BenjiMonitoringService();
