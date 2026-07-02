/**
 * Benji V2 — tool:validate.input
 * Phase 3
 *
 * Validates that all required fields for a planned action are present in the
 * assembled context data. Must run before any financial tool (GlobalPolicyGuard P2).
 *
 * NOT a mutation — no DB writes, no events. Source: 'deterministic' (pure JS logic).
 * _stepAction is 'tool:validate.input' — GlobalPolicyGuard P2 checks for this name.
 */

import type { ToolDefinition, ToolContext } from '@benji/core/types/tool.types';
import type { BenjiIntent } from '@benji/ai/classifier/intent.types';

// ─── I/O Types ────────────────────────────────────────────────────────────────

export interface ValidateInputParams {
  /** The classified intent this validation is guarding. */
  intent: BenjiIntent;
  /**
   * Assembled context data — typically the output of tool:shipment.parse plus
   * any user-provided values collected during clarification.
   */
  data:   Record<string, unknown>;
}

export interface ValidateInputOutput {
  valid:         boolean;
  missingFields: string[];   // dot-notation paths of missing required fields
  errors:        string[];   // human-readable messages, one per missing/invalid field
}

// ─── Validation Rules ─────────────────────────────────────────────────────────

interface FieldRule {
  /** Dot-notation path into the data record (e.g. 'vehicle.make'). */
  readonly path:    string;
  /** Human-readable field label used in error messages. */
  readonly label:   string;
  /** Custom validity check; defaults to isPresent() if omitted. */
  readonly check?:  (value: unknown) => boolean;
}

/** Required fields per intent.  Intents not listed have no required fields. */
const RULES: Partial<Record<BenjiIntent, ReadonlyArray<FieldRule>>> = {
  'shipment.create': [
    { path: 'pickup.location',   label: 'Pickup location' },
    { path: 'delivery.location', label: 'Delivery location' },
    { path: 'vehicle',           label: 'Vehicle information',
      check: (v: unknown): boolean => typeof v === 'object' && v !== null },
    { path: 'vehicle.make',      label: 'Vehicle make' },
  ],
  'dispatch.accept': [
    { path: 'loadId',            label: 'Load ID' },
  ],
  'dispatch.find_loads': [
    { path: 'location',          label: 'Driver location',
      check: (v: unknown): boolean => typeof v === 'string' && (v as string).trim().length > 0 },
  ],
  'shipment.track': [
    { path: 'shipmentId',        label: 'Shipment ID' },
  ],
  'shipment.quote': [
    { path: 'pickup.location',   label: 'Pickup location' },
    { path: 'delivery.location', label: 'Delivery location' },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve a dot-notation path into a nested Record. */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Default presence check: non-null, non-undefined, non-empty string. */
function isPresent(value: unknown): boolean {
  if (value === undefined || value === null)         return false;
  if (typeof value === 'string' && !value.trim())   return false;
  return true;
}

// ─── Validation Logic ─────────────────────────────────────────────────────────

function validate(intent: BenjiIntent, data: Record<string, unknown>): ValidateInputOutput {
  const rules = RULES[intent];

  // No rules defined for this intent — nothing to validate
  if (!rules || rules.length === 0) {
    return { valid: true, missingFields: [], errors: [] };
  }

  const missingFields: string[] = [];
  const errors:        string[] = [];

  for (const rule of rules) {
    const value  = getNestedValue(data, rule.path);
    const checkFn = rule.check ?? isPresent;

    if (!checkFn(value)) {
      missingFields.push(rule.path);
      errors.push(`${rule.label} is required but missing or invalid`);
    }
  }

  return {
    valid:         missingFields.length === 0,
    missingFields,
    errors,
  };
}

// ─── Type Guard ───────────────────────────────────────────────────────────────

function isValidateInputParams(input: unknown): input is ValidateInputParams {
  if (typeof input !== 'object' || input === null) return false;
  const obj = input as Record<string, unknown>;
  return typeof obj['intent'] === 'string' &&
         typeof obj['data']   === 'object' && obj['data'] !== null;
}

// ─── Tool Definition ──────────────────────────────────────────────────────────

export const validateInputTool: ToolDefinition<ValidateInputParams, ValidateInputOutput> = {
  name:        'tool:validate.input',
  description: 'Validate that all required fields for the planned intent are present in the assembled data. Must execute before any financial tool (P2).',
  isMutation:  false,
  validate:    isValidateInputParams,

  execute: async (input: ValidateInputParams, _context: ToolContext): Promise<ValidateInputOutput> => {
    return validate(input.intent, input.data);
  },
};
