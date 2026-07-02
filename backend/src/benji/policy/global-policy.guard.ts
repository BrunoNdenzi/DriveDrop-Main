/**
 * Benji V2 — GlobalPolicyGuard
 * Phase 5A
 *
 * Enforces P1–P10 policy rules at named checkpoints in the orchestration pipeline.
 * Rules are immutable source-code constructs — changing a rule requires a code deploy.
 *
 * Governance: I-7, I-8, I-11
 *
 * Design constraints:
 *   - check() is synchronous in rule evaluation (P1–P10 are pure functions)
 *   - logViolation() is fire-and-forget (async I/O; never blocks the pipeline)
 *   - No OpenAI, Twilio, or Google Maps imports (I-12)
 *   - globalPolicyCache is a module-level Map — updated externally by BenjiLearningService (P9)
 */

import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';
import type {
  PolicyCheckpoint,
  PolicyCheckState,
} from '@benji/core/types/orchestrator.types';
import type { ToolResult } from '@benji/core/types/tool.types';

// ─── Public cache (P9 reads from this) ───────────────────────────────────────

/**
 * Module-level cache for cross-cutting policy flags.
 * Keys:
 *   'unapproved_weight_update_active' → boolean
 * Set externally by BenjiLearningService (Phase 6+).
 */
export const globalPolicyCache = new Map<string, unknown>();

// ─── Internal types ───────────────────────────────────────────────────────────

interface PolicyRuleResult {
  passed:    boolean;
  ruleId:    string;
  reason?:   string;
  evidence:  string;
}

interface PolicyRule {
  id:          string;
  description: string;
  checkpoint:  PolicyCheckpoint[];
  severity:    'block' | 'warn';
  check:       (state: PolicyCheckState) => PolicyRuleResult;
}

export interface PolicyGuardResult {
  passed:     boolean;
  blockers:   PolicyRuleResult[];
  warnings:   PolicyRuleResult[];
  checkpoint: PolicyCheckpoint;
}

// ─── Financial + mutation constants ──────────────────────────────────────────

const FINANCIAL_TOOLS: ReadonlySet<string> = new Set([
  'tool:shipment.create',
  'tool:dispatch.assign',
  'tool:dispatch.accept',
]);

const MUTATION_TOOLS: ReadonlySet<string> = new Set([
  'tool:shipment.create',
  'tool:dispatch.assign',
  'tool:dispatch.accept',
  'tool:shipment.status_update',
  'tool:memory.write',
]);

const CLARIFICATION_THRESHOLD_FLOOR = 0.55;

// ─── P1–P10 Policy Rules ─────────────────────────────────────────────────────

const GLOBAL_POLICIES: PolicyRule[] = [

  {
    id:          'P1',
    description: 'Safety constraints cannot be weakened by memory influence',
    checkpoint:  ['after_memory_influence'],
    severity:    'block',
    check({ influence }: PolicyCheckState): PolicyRuleResult {
      const threshold = influence?.clarificationThreshold;
      const passed    = threshold === undefined || threshold >= CLARIFICATION_THRESHOLD_FLOOR;
      return {
        passed,
        ruleId:   'P1',
        ...(passed ? {} : {
          reason: `clarificationThreshold ${threshold!} is below floor ${CLARIFICATION_THRESHOLD_FLOOR}`,
        }),
        evidence: `clarificationThreshold = ${threshold ?? 'not set'}`,
      };
    },
  },

  {
    id:          'P2',
    description: 'Financial actions require validated inputs before execution',
    checkpoint:  ['before_each_tool_call'],
    severity:    'block',
    check({ currentStep, priorOutputs }: PolicyCheckState): PolicyRuleResult {
      if (!currentStep || !FINANCIAL_TOOLS.has(currentStep.action)) {
        return { passed: true, ruleId: 'P2', evidence: 'non-financial step' };
      }
      const validateStepRan = Object.values(priorOutputs ?? {})
        .some(r => (r as ToolResult<unknown> & { _stepAction?: string })._stepAction === 'tool:validate.input' && r.success);
      return {
        passed:   validateStepRan,
        ruleId:   'P2',
        ...(validateStepRan ? {} : {
          reason: `Financial tool '${currentStep.action}' called without prior successful tool:validate.input step`,
        }),
        evidence: `tool = ${currentStep.action}; validate step ran = ${validateStepRan}`,
      };
    },
  },

  {
    id:          'P3',
    description: 'No tool execution allowed without a validated intent classification',
    checkpoint:  ['after_plan_creation'],
    severity:    'block',
    check({ plan, request }: PolicyCheckState): PolicyRuleResult {
      const hasMutation = plan?.steps.some(s => MUTATION_TOOLS.has(s.action)) ?? false;
      if (!hasMutation) {
        return { passed: true, ruleId: 'P3', evidence: 'no mutation tools in plan' };
      }
      const intentClassified = request._classifiedIntent !== undefined && request._classifiedIntent !== '';
      return {
        passed:   intentClassified,
        ruleId:   'P3',
        ...(intentClassified ? {} : {
          reason: 'Mutation tool planned but intent was not classified',
        }),
        evidence: `_classifiedIntent = ${request._classifiedIntent ?? 'UNSET'}`,
      };
    },
  },

  {
    id:          'P4',
    description: 'External communication (SMS) must be an explicit plan step — never implicit',
    checkpoint:  ['before_each_tool_call'],
    severity:    'block',
    check({ currentStep, plan }: PolicyCheckState): PolicyRuleResult {
      if (currentStep?.action !== 'tool:sms.send') {
        return { passed: true, ruleId: 'P4', evidence: 'non-SMS step' };
      }
      const inPlan = plan?.steps.some(s => s.stepId === currentStep.stepId) ?? false;
      return {
        passed:   inPlan,
        ruleId:   'P4',
        ...(inPlan ? {} : {
          reason: `SMS tool called from outside the plan (stepId ${currentStep.stepId} not in plan)`,
        }),
        evidence: `stepId ${currentStep.stepId} in plan: ${inPlan}`,
      };
    },
  },

  {
    id:          'P5',
    description: 'No silent state mutation — every DB write must be followed by an event',
    checkpoint:  ['before_each_tool_call'],
    severity:    'warn',
    check({ currentStep }: PolicyCheckState): PolicyRuleResult {
      if (!currentStep || !MUTATION_TOOLS.has(currentStep.action)) {
        return { passed: true, ruleId: 'P5', evidence: 'non-mutation step' };
      }
      const eventsEnabled = process.env['ENABLE_BENJI_EVENTS'] === 'true';
      return {
        passed:   eventsEnabled,
        ruleId:   'P5',
        ...(eventsEnabled ? {} : {
          reason: `ENABLE_BENJI_EVENTS is disabled but mutation tool '${currentStep.action}' is executing`,
        }),
        evidence: `ENABLE_BENJI_EVENTS = ${process.env['ENABLE_BENJI_EVENTS'] ?? 'undefined'}`,
      };
    },
  },

  {
    id:          'P6',
    description: 'Missing critical data MUST trigger clarification, not assumption',
    checkpoint:  ['after_plan_creation'],
    severity:    'block',
    check({ plan, priorOutputs }: PolicyCheckState): PolicyRuleResult {
      const parseEntry = Object.entries(priorOutputs ?? {})
        .find(([, r]) => {
          const typed = r as ToolResult<unknown> & { _stepAction?: string };
          return typed._stepAction === 'tool:shipment.parse';
        });
      if (!parseEntry) {
        return { passed: true, ruleId: 'P6', evidence: 'no shipment parse step yet' };
      }
      const missingFields: string[] = (parseEntry[1].data as { missingFields?: string[] })?.missingFields ?? [];
      const planHasCreateStep       = plan?.steps.some(s => s.action === 'tool:shipment.create') ?? false;
      if (planHasCreateStep && missingFields.length > 0) {
        return {
          passed:   false,
          ruleId:   'P6',
          reason:   `Plan attempts shipment create with missing required fields: ${missingFields.join(', ')}`,
          evidence: `missingFields = [${missingFields.join(', ')}]`,
        };
      }
      return { passed: true, ruleId: 'P6', evidence: `missingFields = [${missingFields.join(', ')}]` };
    },
  },

  {
    id:          'P7',
    description: 'Planner output MUST pass schema validation before execution',
    checkpoint:  ['after_plan_creation'],
    severity:    'block',
    check({ plan }: PolicyCheckState): PolicyRuleResult {
      if (!plan) {
        return { passed: false, ruleId: 'P7', reason: 'Plan is null', evidence: 'plan = null' };
      }
      const errors: string[] = [];
      if (!plan.planId)              errors.push('missing planId');
      if (!plan.intent)              errors.push('missing intent');
      if (!Array.isArray(plan.steps)) errors.push('steps is not an array');
      if (plan.steps.length === 0)   errors.push('steps array is empty');
      if (plan.steps.length > 20)    errors.push(`too many steps: ${plan.steps.length}`);
      for (const step of plan.steps) {
        if (!step.stepId)                      errors.push('step missing stepId');
        if (!step.action)                      errors.push(`step ${step.stepId} missing action`);
        if (typeof step.critical !== 'boolean') errors.push(`step ${step.stepId} critical is not boolean`);
        if (!Array.isArray(step.dependsOn))    errors.push(`step ${step.stepId} dependsOn is not array`);
      }
      return {
        passed:   errors.length === 0,
        ruleId:   'P7',
        ...(errors.length > 0 ? { reason: `Plan schema errors: ${errors.join('; ')}` } : {}),
        evidence: `steps = ${plan.steps.length}; errors = ${errors.length}`,
      };
    },
  },

  {
    id:          'P8',
    description: 'Execution engine MUST reject cyclic or incomplete DAGs',
    checkpoint:  ['after_plan_creation'],
    severity:    'block',
    check({ plan }: PolicyCheckState): PolicyRuleResult {
      if (!plan?.steps) {
        return { passed: false, ruleId: 'P8', reason: 'No steps', evidence: '' };
      }
      const stepIds = new Set(plan.steps.map(s => s.stepId));
      const errors: string[] = [];

      // Unknown dependsOn references
      for (const step of plan.steps) {
        for (const dep of step.dependsOn) {
          if (!stepIds.has(dep)) {
            errors.push(`step ${step.stepId} depends on unknown stepId: ${dep}`);
          }
        }
      }

      // Cycle detection via iterative DFS
      if (errors.length === 0) {
        const visited = new Set<string>();
        const inStack = new Set<string>();

        const hasCycle = (id: string): boolean => {
          if (inStack.has(id)) return true;
          if (visited.has(id)) return false;
          visited.add(id);
          inStack.add(id);
          const step = plan.steps.find(s => s.stepId === id);
          for (const dep of step?.dependsOn ?? []) {
            if (hasCycle(dep)) return true;
          }
          inStack.delete(id);
          return false;
        };

        if (plan.steps.some(s => hasCycle(s.stepId))) {
          errors.push('Cyclic dependency detected in plan DAG');
        }
      }

      return {
        passed:   errors.length === 0,
        ruleId:   'P8',
        ...(errors.length > 0 ? { reason: errors.join('; ') } : {}),
        evidence: `steps = ${plan.steps.length}; errors = ${errors.length}`,
      };
    },
  },

  {
    id:          'P9',
    description: 'No adaptive learning can modify core scoring weights without versioned approval',
    checkpoint:  ['after_request_intake'],
    severity:    'block',
    check(_state: PolicyCheckState): PolicyRuleResult {
      const unapprovedUpdateActive = globalPolicyCache.get('unapproved_weight_update_active') === true;
      return {
        passed:   !unapprovedUpdateActive,
        ruleId:   'P9',
        ...(unapprovedUpdateActive ? {
          reason: 'Unapproved learning update is active in scoring weights',
        } : {}),
        evidence: `unapproved_weight_update_active = ${unapprovedUpdateActive}`,
      };
    },
  },

  {
    id:          'P10',
    description: 'All decisions MUST be traceable via event log',
    checkpoint:  ['after_request_intake'],
    severity:    'block',
    check({ request }: PolicyCheckState): PolicyRuleResult {
      const eventsEnabled  = process.env['ENABLE_BENJI_EVENTS'] === 'true';
      const tracingEnabled = process.env['ENABLE_BENJI_TRACING'] === 'true';
      const hasRequestId   = request.requestId.length > 0;
      const passed         = eventsEnabled && tracingEnabled && hasRequestId;
      return {
        passed,
        ruleId:   'P10',
        ...(passed ? {} : {
          reason: `Tracing preconditions failed: events=${eventsEnabled}, tracing=${tracingEnabled}, requestId=${hasRequestId}`,
        }),
        evidence: `ENABLE_BENJI_EVENTS=${eventsEnabled}; ENABLE_BENJI_TRACING=${tracingEnabled}; requestId=${request.requestId}`,
      };
    },
  },

];

// ─── GlobalPolicyGuard class ──────────────────────────────────────────────────

export class GlobalPolicyGuard {
  /**
   * Evaluate all rules registered for `checkpoint`.
   * Returns synchronously computed result.
   * Violation logging is fire-and-forget.
   */
  async check(
    checkpoint: PolicyCheckpoint,
    state:      PolicyCheckState,
  ): Promise<PolicyGuardResult> {
    const applicable = GLOBAL_POLICIES.filter(r => r.checkpoint.includes(checkpoint));
    const results: Array<PolicyRuleResult & { severity: 'block' | 'warn' }> = [];

    for (const rule of applicable) {
      const result = rule.check(state);
      results.push({ ...result, severity: rule.severity });

      if (!result.passed) {
        this._logViolation(checkpoint, rule, result, state);
      }
    }

    const blockers = results.filter(r => !r.passed && r.severity === 'block');
    const warnings = results.filter(r => !r.passed && r.severity === 'warn');

    return {
      passed:     blockers.length === 0,
      blockers,
      warnings,
      checkpoint,
    };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /**
   * Fire-and-forget violation log.
   * Upserts to policy_violations (idempotency via request_id + rule_id + checkpoint).
   */
  private _logViolation(
    checkpoint: PolicyCheckpoint,
    rule:       PolicyRule,
    result:     PolicyRuleResult,
    state:      PolicyCheckState,
  ): void {
    void Promise.resolve()
      .then(async () => {
        const { error } = await supabaseAdmin
          .from('policy_violations')
          .upsert({
            rule_id:    rule.id,
            checkpoint,
            request_id: state.request.requestId,
            user_id:    state.request.userId,
            reason:     result.reason ?? null,
            evidence:   result.evidence,
            severity:   rule.severity,
            created_at: new Date().toISOString(),
          }, { onConflict: 'request_id,rule_id,checkpoint', ignoreDuplicates: true });

        if (error) {
          logger.warn('GlobalPolicyGuard: failed to persist violation', {
            ruleId:    rule.id,
            requestId: state.request.requestId,
            error:     String(error),
          });
        }
      })
      .catch((err: unknown) => {
        logger.warn('GlobalPolicyGuard: logViolation threw', {
          ruleId: rule.id,
          error:  err instanceof Error ? err.message : String(err),
        });
      });
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const globalPolicyGuard = new GlobalPolicyGuard();
