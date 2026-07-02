/**
 * Benji V2 — Deterministic intent patterns
 * Phase 2C
 *
 * Each entry defines one or more RegExp patterns for an intent.
 * When ANY pattern matches, the entry's `confidence` is returned.
 * The classifier iterates in order and selects the highest-confidence match.
 *
 * Ordering principle: most-specific / highest-confidence patterns first
 * so that a strong match short-circuits weaker patterns below it.
 *
 * Governance: these patterns are the "deterministic-first" stage described in I-12.
 * They must be updated (and version-bumped in intent-classify.prompt.ts) before
 * a learning proposal can lower `intent.keywordConfidenceFloor` below 0.70.
 */

import type { BenjiIntent, IntentEntities } from './intent.types';

// ─── Pattern Table ────────────────────────────────────────────────────────────

export interface PatternEntry {
  readonly intent:      BenjiIntent;
  readonly patterns:    ReadonlyArray<RegExp>;
  /** Confidence score assigned when any pattern in this entry matches (0.0 – 1.0). */
  readonly confidence:  number;
}

export const INTENT_PATTERNS: ReadonlyArray<PatternEntry> = [

  // ── Greeting (must come before support.general to avoid false negatives) ──
  {
    intent:     'general.greeting',
    confidence: 0.95,
    patterns: [
      /^(hi|hey|hello|howdy|yo|sup)\b/i,
      /^(good\s+(morning|afternoon|evening))\b/i,
      /\bwhat\s+can\s+you\s+do\b/i,
      /\bhow\s+can\s+you\s+help\s+me\b/i,
    ],
  },

  // ── Shipment create ───────────────────────────────────────────────────────
  {
    intent:     'shipment.create',
    confidence: 0.90,
    patterns: [
      /\b(ship|transport|move|send)\b.{0,40}\b(car|vehicle|truck|suv|motorcycle|van|auto)\b/i,
      /\b(car|vehicle|truck|suv|motorcycle|van|auto)\b.{0,40}\b(ship|transport|move|send)\b/i,
      /\b(need|want|looking)\b.{0,20}\b(to\s+ship|a\s+shipment|shipping|transportation)\b/i,
      /\bfrom\b.{2,50}\bto\b.{2,50}\b(car|vehicle|auto)\b/i,
      /\bpick\s+up\b.{0,30}\b(car|vehicle|auto)\b/i,
    ],
  },

  // ── Shipment track ────────────────────────────────────────────────────────
  {
    intent:     'shipment.track',
    confidence: 0.90,
    patterns: [
      /\b(where|track|status|location)\b.{0,30}\b(car|vehicle|shipment|order|my)\b/i,
      /\b(car|vehicle|shipment|order)\b.{0,30}\b(where|track|status|location)\b/i,
      /\bwhere\s+is\b.{0,20}\b(my|the)\b/i,
      /\btracking\s+(number|update|info)\b/i,
    ],
  },

  // ── Shipment quote ────────────────────────────────────────────────────────
  {
    intent:     'shipment.quote',
    confidence: 0.90,
    patterns: [
      /\b(quote|price|cost|rate|how\s+much|estimate|pricing)\b.{0,30}\b(ship|transport|move|haul)\b/i,
      /\b(ship|transport|move|haul)\b.{0,30}\b(quote|price|cost|rate|how\s+much|estimate)\b/i,
      /\bhow\s+much\b.{0,40}\b(car|vehicle|auto|shipment)\b/i,
      /\bget\s+(a\s+)?quote\b/i,
    ],
  },

  // ── Dispatch: accept load ─────────────────────────────────────────────────
  // Must precede find_loads (more specific match)
  {
    intent:     'dispatch.accept',
    confidence: 0.92,
    patterns: [
      /\b(accept|take|i'?ll\s+take|grab|confirm)\b.{0,20}\b(load|job|pickup|haul)\b/i,
      /\bload\b.{0,20}\b(id|number|#)\b.{0,20}\b(accept|take|confirm)\b/i,
      /\baccept\b.{0,10}\b(this|that|the)\b.{0,10}\b(load|job)\b/i,
    ],
  },

  // ── Dispatch: find loads ──────────────────────────────────────────────────
  {
    intent:     'dispatch.find_loads',
    confidence: 0.90,
    patterns: [
      /\b(find|show|list|see|get)\b.{0,20}\b(load|loads|job|jobs|pickup|pickups|haul|hauls)\b/i,
      /\b(load|loads|job|jobs)\b.{0,20}\b(available|near|around|close|by|nearby)\b/i,
      /\bwhat\s+(load|job|pickup)\b/i,
      /\bany\s+(load|job|pickup|haul)s?\s+(available|near|today)?\b/i,
    ],
  },

  // ── Dispatch: route / daily plan ─────────────────────────────────────────
  {
    intent:     'dispatch.route',
    confidence: 0.88,
    patterns: [
      /\b(optimize|best\s+route|route\s+plan|multi.?stop)\b/i,
      /\b(plan\s+(my\s+)?day|daily\s+plan|schedule\s+(for\s+)?today)\b/i,
      /\b(shortest|fastest)\b.{0,20}\b(route|path|way)\b/i,
      /\b(route|directions)\b.{0,20}\b(optimize|plan|calculate|suggest)\b/i,
    ],
  },

  // ── Account / earnings query ──────────────────────────────────────────────
  {
    intent:     'account.query',
    confidence: 0.85,
    patterns: [
      /\bmy\s+(earning|earning|rating|review|stat|history|profile|account|payment|payout)\b/i,
      /\b(how\s+much\s+(have\s+i|did\s+i)\s+earn|what\s+is\s+my\s+rating)\b/i,
      /\b(payout|payment)\s+(history|status|pending|schedule)\b/i,
      /\b(view|check|see)\b.{0,15}\b(my\s+)?(rating|earning|stat|review|profile)\b/i,
    ],
  },

  // ── General support / help ─────────────────────────────────────────────────
  // Lowest confidence — catch-all for questions that don't fit above
  {
    intent:     'support.general',
    confidence: 0.65,
    patterns: [
      /\b(help|problem|issue|question|how\s+do|can\s+you|explain|tell\s+me)\b/i,
    ],
  },

];

// ─── Entity Extraction ────────────────────────────────────────────────────────

/**
 * Extract structured entities from a message using simple regex.
 * Called by the deterministic classifier after an intent is matched.
 * All capture groups are guarded against `noUncheckedIndexedAccess`.
 */
export function extractEntities(message: string): IntentEntities {
  const entities: IntentEntities = {};

  // "from <origin> to <destination>"
  const routeMatch = /\bfrom\s+([A-Za-z][A-Za-z\s,]{1,28}?)\s+to\s+([A-Za-z][A-Za-z\s,]{1,28})/i.exec(message);
  if (routeMatch) {
    const origin = routeMatch[1]?.trim();
    const dest   = routeMatch[2]?.trim();
    if (origin) entities.originCity      = origin;
    if (dest)   entities.destinationCity = dest;
  }

  // 4-digit model year (1950–2029)
  const yearMatch = /\b(19[5-9]\d|20[0-2]\d)\b/.exec(message);
  const yearStr = yearMatch?.[1];
  if (yearStr) entities.vehicleYear = parseInt(yearStr, 10);

  // Common vehicle makes (case-insensitive, full word)
  const makeMatch =
    /\b(Ford|Chevy|Chevrolet|Toyota|Honda|BMW|Mercedes|Dodge|Ram|GMC|Jeep|Nissan|Hyundai|Kia|Subaru|Mazda|Acura|Lexus|Infiniti|Cadillac|Buick|Lincoln|Tesla|Audi|Volkswagen|VW|Volvo|Porsche|Mitsubishi)\b/i
    .exec(message);
  if (makeMatch?.[0]) entities.vehicleMake = makeMatch[0];

  // Load ID  (e.g. "load ABC-123" or "load id 4X9-0")
  const loadIdMatch = /\bload\s+(?:id\s+)?([A-Z0-9][A-Z0-9-]{2,18})\b/i.exec(message);
  if (loadIdMatch?.[1]) entities.loadId = loadIdMatch[1];

  // Shipment ID
  const shipmentIdMatch = /\bshipment\s+(?:id\s+)?([A-Z0-9][A-Z0-9-]{2,18})\b/i.exec(message);
  if (shipmentIdMatch?.[1]) entities.shipmentId = shipmentIdMatch[1];

  // Date reference
  const dateMatch =
    /\b(today|tomorrow|next\s+\w+|this\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday|asap|urgent|right\s+away|immediately)\b/i
    .exec(message);
  if (dateMatch?.[0]) entities.rawDateRef = dateMatch[0];

  return entities;
}
