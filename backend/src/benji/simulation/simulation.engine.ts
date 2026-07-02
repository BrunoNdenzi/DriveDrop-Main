/**
 * Benji V2 — SimulationEngine
 * Phase 5B
 *
 * Performs a synchronous dry-run of an execution plan before any tool fires.
 * Estimates cost, latency, risk, and predicted failure points without touching
 * any external service, database (writes), or communication channel.
 *
 * Governance constraints (§2.3):
 *   - NO OpenAI, Twilio, or Google Maps imports (I-12)
 *   - NO Supabase write operations — only one cached SELECT (historical failure rates)
 *   - All synchronous; the single async path is predictFailurePoint() which reads a
 *     module-level cache populated once per hour
 *   - Must complete in < 50ms
 *
 * Governance: I-11, I-12, I-14
 */

import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';
import { globalPolicyCache } from '@benji/policy/global-policy.guard';
import type {
  BenjiPlan,
  BenjiPlanStep,
  OrchestratorRequest,
  MemoryContext,
} from '@benji/core/types/orchestrator.types';

// ─── Public result types ──────────────────────────────────────────────────────

export interface RiskFactor {
  name:        string;
  score:       number;    // 0.0–1.0 contribution
  weight:      number;    // weight in final score
  explanation: string;
}

export type SimulationGate = 'proceed' | 'confirm' | 'block';

export interface SimulationResult {
  planId:             string;
  requestId:          string;
  predictedSteps:     number;
  predictedWaves:     number;
  estimatedCostUsd:   number;
  estimatedLatencyMs: number;
  riskScore:          number;
  riskFactors:        RiskFactor[];
  sideEffects:        string[];
  wouldFailAt?:       string;
  wouldFailReason?:   string;
  executionGate:      SimulationGate;
  simulatedAt:        string;
}

// ─── Static cost + latency estimates (§2.8) ───────────────────────────────────

const ESTIMATED_COST_USD: Readonly<Record<string, number>> = {
  'tool:chat.respond':             0.00025,
  'tool:shipment.parse':           0.0050,
  'tool:document.extract':         0.0080,
  'tool:pricing.calculate':        0.0000,
  'tool:route.optimize':           0.0002,
  'tool:dispatch.analyze':         0.0000,
  'tool:dispatch.assign':          0.0000,
  'tool:dispatch.recommendations': 0.0000,
  'tool:dispatch.accept':          0.0000,
  'tool:shipment.lookup':          0.0000,
  'tool:shipment.create':          0.0000,
  'tool:sms.send':                 0.0075,
  'tool:memory.read':              0.0000,
  'tool:memory.write':             0.0000,
  'tool:validate.input':           0.0000,
};

const ESTIMATED_LATENCY_MS: Readonly<Record<string, number>> = {
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
  'tool:sms.send':                 200,
  'tool:memory.read':              80,
  'tool:memory.write':             60,
  'tool:validate.input':           10,
};

// ─── Risk weights (§2.4) ──────────────────────────────────────────────────────

const RISK_WEIGHTS = {
  missingFields:         0.30,
  externalCommunication: 0.20,
  financialImpact:       0.25,
  dagComplexity:         0.10,
  memoryUncertainty:     0.15,
} as const;

const FINANCIAL_TOOL_WEIGHTS: Readonly<Record<string, number>> = {
  'tool:shipment.create':   0.40,
  'tool:dispatch.assign':   0.50,
  'tool:dispatch.accept':   0.60,
  'tool:pricing.calculate': 0.10,
};

// Required fields per intent (governs missing-field risk factor)
const REQUIRED_FIELDS_BY_INTENT: Readonly<Record<string, string[]>> = {
  'shipment.create': ['pickup_address', 'delivery_address', 'vehicle_type'],
  'shipment.track':  ['shipment_id'],
  'quote':           ['pickup_address', 'delivery_address', 'vehicle_type'],
  'dispatch.accept': ['shipment_id'],
};

// ─── Historical failure rate cache ───────────────────────────────────────────

let _failureRateCache: Record<string, number> = {};
let _failureRateCachedAt = 0;
const FAILURE_RATE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Deterministic baseline failure rates used before the first DB refresh (5.1-3).
 * Derived from static risk heuristics:
 *   - mutation tools:        moderately higher failure surface (external DB round-trip)
 *   - financial tools:       higher — validation or pricing failures are common
 *   - external network tools: higher — SMS/Maps latency + delivery uncertainty
 *   - read-only tools:       low baseline
 */
const BASELINE_FAILURE_RATES: Readonly<Record<string, number>> = {
  'tool:shipment.create':          0.08,
  'tool:dispatch.assign':          0.10,
  'tool:dispatch.accept':          0.07,
  'tool:shipment.status_update':   0.06,
  'tool:sms.send':                 0.12,  // Twilio delivery uncertainty
  'tool:document.extract':         0.09,  // Vision API + OCR errors
  'tool:route.optimize':           0.05,  // Maps API latency
  'tool:shipment.parse':           0.06,
  'tool:validate.input':           0.03,
  'tool:chat.respond':             0.04,
  'tool:memory.read':              0.01,
  'tool:memory.write':             0.02,
  'tool:pricing.calculate':        0.02,
};

async function _refreshFailureRateCache(): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from('benji_events')
      .select('tool_name, success')
      .gte('occurred_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (error || !data) return;

    const counts: Record<string, { total: number; failed: number }> = {};
    for (const row of data as Array<{ tool_name: string | null; success: boolean | null }>) {
      if (!row.tool_name) continue;
      const entry = counts[row.tool_name] ?? { total: 0, failed: 0 };
      entry.total += 1;
      if (!row.success) entry.failed += 1;
      counts[row.tool_name] = entry;
    }

    const rates: Record<string, number> = {};
    for (const [tool, { total, failed }] of Object.entries(counts)) {
      if (total > 0) rates[tool] = failed / total;
    }
    _failureRateCache   = rates;
    _failureRateCachedAt = Date.now();
  } catch (err: unknown) {
    logger.warn('SimulationEngine: failed to refresh failure rate cache', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Estimate the number of execution waves (parallel batches). */
function _estimateWaveCount(steps: BenjiPlanStep[]): number {
  if (steps.length === 0) return 0;
  const levels = new Map<string, number>();

  const getLevel = (id: string): number => {
    const cached = levels.get(id);
    if (cached !== undefined) return cached;
    const step = steps.find(s => s.stepId === id);
    if (!step || step.dependsOn.length === 0) {
      levels.set(id, 1);
      return 1;
    }
    const level = 1 + Math.max(...step.dependsOn.map(dep => getLevel(dep)));
    levels.set(id, level);
    return level;
  };

  const maxLevel = Math.max(...steps.map(s => getLevel(s.stepId)));
  return maxLevel;
}

/** Compute the critical path (longest latency chain) via DAG traversal. */
function _computeCriticalPath(
  steps:      BenjiPlanStep[],
  latencies:  Readonly<Record<string, number>>,
): number {
  if (steps.length === 0) return 0;
  const cache = new Map<string, number>();

  const longestPath = (id: string): number => {
    const hit = cache.get(id);
    if (hit !== undefined) return hit;
    const step = steps.find(s => s.stepId === id);
    if (!step) { cache.set(id, 0); return 0; }
    const own = latencies[step.action] ?? 0;
    const dep = step.dependsOn.length === 0
      ? 0
      : Math.max(...step.dependsOn.map(d => longestPath(d)));
    const total = own + dep;
    cache.set(id, total);
    return total;
  };

  return Math.max(...steps.map(s => longestPath(s.stepId)));
}

function _getRequiredFields(plan: BenjiPlan): string[] {
  const fields = REQUIRED_FIELDS_BY_INTENT[plan.intent];
  return fields ?? [];
}

function _extractPresentFields(request: OrchestratorRequest, memory: MemoryContext): string[] {
  // Fields present in request (shipmentId implies some context)
  const fields: string[] = [];
  if (request.shipmentId) { fields.push('shipment_id'); fields.push('shipment_id'); }
  // Presence of any memory entries implies some contextual knowledge
  if (memory.memories.length > 0) {
    const namespaces = new Set(memory.memories.map(m => m.namespace));
    if (namespaces.has('user.vehicles'))    fields.push('vehicle_type');
    if (namespaces.has('user.preferences')) fields.push('pickup_address', 'delivery_address');
  }
  return fields;
}

function _getHighestImpactTool(plan: BenjiPlan): string {
  let maxWeight = 0;
  let bestTool  = 'none';
  for (const step of plan.steps) {
    const weight = FINANCIAL_TOOL_WEIGHTS[step.action] ?? 0;
    if (weight > maxWeight) { maxWeight = weight; bestTool = step.action; }
  }
  return bestTool;
}

/** Predict side effects that WOULD occur if plan executes (§2.5). */
function _predictSideEffects(plan: BenjiPlan): string[] {
  const effects: string[] = [];
  for (const step of plan.steps) {
    switch (step.action) {
      case 'tool:shipment.create':
        effects.push('Creates 1 new shipment record (status: pending)');
        effects.push('Runs pricing calculation and stores estimated_price');
        break;
      case 'tool:dispatch.accept':
        effects.push('Sets shipment driver_id and status → ASSIGNED');
        effects.push('Claims driver availability for this shipment');
        break;
      case 'tool:dispatch.assign':
        effects.push('Assigns driver-load pairs (status → ASSIGNED)');
        break;
      case 'tool:shipment.status_update':
        effects.push(`Updates shipment status to ${String(step.input?.['newStatus'] ?? 'new status')}`);
        break;
      case 'tool:sms.send':
        effects.push('Sends 1 SMS via Twilio (estimated cost: $0.0075)');
        break;
      case 'tool:memory.write':
        effects.push(`Writes ${(step.memoryWrites ?? []).length} entry(s) to benji_memory`);
        break;
      case 'tool:chat.respond':
        effects.push('Generates 1 LLM response (estimated: ~300–800 tokens)');
        break;
      case 'tool:document.extract':
        effects.push('Calls GPT-4o vision API (estimated: 800–2000 tokens)');
        effects.push('May queue document for admin review if confidence < 0.85');
        break;
      default:
        break;
    }
  }
  return effects;
}

// ─── SimulationEngine class ───────────────────────────────────────────────────

export class SimulationEngine {
  /**
   * Dry-run a plan.
   * The only async operation is a background read to refresh the failure rate cache
   * (fires the refresh if stale, but does NOT wait for it — uses the last known cache).
   */
  async simulate(
    plan:    BenjiPlan,
    request: OrchestratorRequest,
    memory:  MemoryContext,
  ): Promise<SimulationResult> {
    // Refresh failure rate cache in background if stale
    if (Date.now() - _failureRateCachedAt > FAILURE_RATE_TTL_MS) {
      void _refreshFailureRateCache();
    }

    const { score, factors } = this._computeRiskScore(plan, request, memory);
    const sideEffects         = _predictSideEffects(plan);
    const failurePoint        = this._predictFailurePoint(plan);
    const waves               = _estimateWaveCount(plan.steps);
    const costUsd             = plan.steps.reduce((sum, s) => sum + (ESTIMATED_COST_USD[s.action] ?? 0), 0);
    const latencyMs           = _computeCriticalPath(plan.steps, ESTIMATED_LATENCY_MS);
    const gate                = this._determineExecutionGate(score, sideEffects);

    return {
      planId:             plan.planId,
      requestId:          request.requestId,
      predictedSteps:     plan.steps.length,
      predictedWaves:     waves,
      estimatedCostUsd:   costUsd,
      estimatedLatencyMs: latencyMs,
      riskScore:          score,
      riskFactors:        factors,
      sideEffects,
      ...(failurePoint.stepId    !== undefined ? { wouldFailAt:     failurePoint.stepId    } : {}),
      ...(failurePoint.reason    !== undefined ? { wouldFailReason: failurePoint.reason    } : {}),
      executionGate:      gate,
      simulatedAt:        new Date().toISOString(),
    };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _computeRiskScore(
    plan:    BenjiPlan,
    request: OrchestratorRequest,
    memory:  MemoryContext,
  ): { score: number; factors: RiskFactor[] } {
    // Factor 1: Missing required fields
    const requiredFields  = _getRequiredFields(plan);
    const presentFields   = _extractPresentFields(request, memory);
    const missingCount    = requiredFields.filter(f => !presentFields.includes(f)).length;
    const f1              = Math.min(1.0, missingCount / Math.max(requiredFields.length, 1));

    // Factor 2: External communication count
    const smsCount = plan.steps.filter(s => s.action === 'tool:sms.send').length;
    const f2       = Math.min(1.0, smsCount / 5);

    // Factor 3: Financial impact
    const f3 = plan.steps.reduce(
      (max, s) => Math.max(max, FINANCIAL_TOOL_WEIGHTS[s.action] ?? 0),
      0,
    );

    // Factor 4: DAG complexity
    const waves = _estimateWaveCount(plan.steps);
    const f4    = Math.min(1.0, (waves - 1) / 8);

    // Factor 5: Memory uncertainty
    const position        = memory.lastKnownPosition;
    const ageHours        = position !== undefined ? position.ageHours : Infinity;
    const memCount        = memory.memories.length;
    const posUncertainty  = ageHours > 48 ? 1.0 : ageHours > 24 ? 0.6 : ageHours > 8 ? 0.3 : 0.0;
    const memUncertainty  = memCount === 0 ? 1.0 : memCount < 3 ? 0.5 : 0.0;
    const f5              = (posUncertainty * 0.6) + (memUncertainty * 0.4);

    const score = Math.min(1.0,
      f1 * RISK_WEIGHTS.missingFields         +
      f2 * RISK_WEIGHTS.externalCommunication +
      f3 * RISK_WEIGHTS.financialImpact       +
      f4 * RISK_WEIGHTS.dagComplexity         +
      f5 * RISK_WEIGHTS.memoryUncertainty,
    );

    const factors: RiskFactor[] = [
      {
        name:        'missing_fields',
        score:       f1,
        weight:      RISK_WEIGHTS.missingFields,
        explanation: `${missingCount}/${requiredFields.length} required fields missing`,
      },
      {
        name:        'external_communication',
        score:       f2,
        weight:      RISK_WEIGHTS.externalCommunication,
        explanation: `${smsCount} SMS step(s) in plan`,
      },
      {
        name:        'financial_impact',
        score:       f3,
        weight:      RISK_WEIGHTS.financialImpact,
        explanation: `Highest-impact financial tool: ${_getHighestImpactTool(plan)}`,
      },
      {
        name:        'dag_complexity',
        score:       f4,
        weight:      RISK_WEIGHTS.dagComplexity,
        explanation: `${waves} execution wave(s), ${plan.steps.length} total steps`,
      },
      {
        name:        'memory_uncertainty',
        score:       f5,
        weight:      RISK_WEIGHTS.memoryUncertainty,
        explanation: ageHours > 48
          ? `Position data is ${ageHours === Infinity ? 'absent' : `${ageHours}h old`}`
          : `${memCount} memory entries available`,
      },
    ];

    return { score, factors };
  }

  private _predictFailurePoint(
    plan: BenjiPlan,
  ): { stepId?: string; reason?: string } {
    // Use live cache if warmed; fall back to static baseline on cold start (5.1-3)
    const rates: Readonly<Record<string, number>> =
      _failureRateCachedAt > 0 ? _failureRateCache : BASELINE_FAILURE_RATES;

    let highestRate = 0;
    let wouldFailAt: string | undefined;

    for (const step of plan.steps) {
      const rate = rates[step.action] ?? 0;
      if (rate > highestRate) {
        highestRate = rate;
        wouldFailAt = step.stepId;
      }
    }

    if (highestRate > 0.15 && wouldFailAt !== undefined) {
      const step = plan.steps.find(s => s.stepId === wouldFailAt);
      return {
        stepId: wouldFailAt,
        reason: `${step?.action ?? wouldFailAt} fails ${(highestRate * 100).toFixed(0)}% historically`,
      };
    }
    return {};
  }

  private _determineExecutionGate(
    riskScore:   number,
    sideEffects: string[],
  ): SimulationGate {
    // P9 override: unapproved learning update + financial assignment → always block
    if (
      globalPolicyCache.get('unapproved_weight_update_active') === true &&
      sideEffects.some(e => e.includes('Assigns'))
    ) {
      return 'block';
    }

    if (riskScore > 0.85) return 'block';
    if (riskScore > 0.70) return 'confirm';
    return 'proceed';
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const simulationEngine = new SimulationEngine();
