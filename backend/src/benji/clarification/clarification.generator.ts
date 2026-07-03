/**
 * Benji V2 — Clarification Question Generator
 * Phase 9.3
 *
 * Converts a list of missing-field dot-notation paths from
 * tool:validate.input into a single, conversational follow-up question.
 *
 * Design principles:
 *   - Combine related missing fields into one natural sentence
 *   - Never surface raw validation errors to the user
 *   - Prefer compound questions over multiple short ones
 *   - Fall back gracefully for unknown field paths
 *
 * Governance: I-14 (deterministic — no LLM call, fully testable)
 */

// ─── Field label map ──────────────────────────────────────────────────────────

/** Human-readable label for each dot-notation field path. */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  'pickup.location':    'pickup location',
  'delivery.location':  'delivery location',
  'vehicle':            'vehicle details (make, model, year)',
  'vehicle.make':       'vehicle make',
  'vehicle.model':      'vehicle model',
  'vehicle.year':       'vehicle year',
  'loadId':             'load ID',
  'shipmentId':         'shipment ID',
  'location':           'your current location',
};

// ─── Question builder ─────────────────────────────────────────────────────────

/**
 * Generate a single natural-language clarification question from
 * a list of missing field paths.
 *
 * @param missingFields  Dot-notation paths returned by tool:validate.input
 * @returns              A conversational question string ready to send to the user
 */
export function generateClarificationQuestion(missingFields: string[]): string {
  if (missingFields.length === 0) {
    return "Could you provide a bit more detail?";
  }

  const needsPickup   = missingFields.includes('pickup.location');
  const needsDelivery = missingFields.includes('delivery.location');
  const needsVehicle  = missingFields.some(f => f === 'vehicle' || f === 'vehicle.make');

  // ── Combined questions for common multi-field scenarios ──────────────────

  if (needsPickup && needsDelivery && needsVehicle) {
    return "I need a few more details — what vehicle are we shipping, and where are we picking it up from and delivering it to?";
  }

  if (needsPickup && needsDelivery) {
    return "Where should I pick up the vehicle, and where is it going?";
  }

  if (needsPickup) {
    return "Where should I pick up the vehicle?";
  }

  if (needsDelivery) {
    return "Where should the vehicle be delivered?";
  }

  if (needsVehicle) {
    return "Which vehicle are we shipping? Please share the make, model, and year.";
  }

  // ── Special single-field cases ───────────────────────────────────────────

  if (missingFields.includes('loadId')) {
    return "Which load ID would you like to accept?";
  }

  if (missingFields.includes('shipmentId')) {
    return "Which shipment ID would you like to track?";
  }

  if (missingFields.includes('location')) {
    return "What is your current location?";
  }

  // ── Generic fallback for 1–3 unknown fields ───────────────────────────────

  const labels = missingFields
    .slice(0, 3)
    .map(f => FIELD_LABELS[f] ?? f.replace(/\./g, ' ').replace(/_/g, ' '))
    .join(', ');

  return `Could you provide the following: ${labels}?`;
}
