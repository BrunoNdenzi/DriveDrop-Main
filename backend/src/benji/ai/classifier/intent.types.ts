/**
 * Benji V2 — Intent classifier shared types
 * Phase 2C
 */

// ─── Intent Taxonomy ──────────────────────────────────────────────────────────

export type BenjiIntent =
  | 'shipment.create'      // user wants to ship a vehicle
  | 'shipment.track'       // user wants to track an existing shipment
  | 'shipment.quote'       // user wants a price estimate
  | 'dispatch.find_loads'  // driver looking for available loads
  | 'dispatch.accept'      // driver accepting a specific load
  | 'dispatch.route'       // driver wants route optimization / daily plan
  | 'account.query'        // earnings, ratings, history, profile
  | 'support.general'      // general Q&A / how-to
  | 'general.greeting'     // hello / what can you do
  | 'unknown';             // no confident match

// ─── Entities ─────────────────────────────────────────────────────────────────

/** Structured values extracted from the user's message during classification. */
export interface IntentEntities {
  originCity?:      string;   // departure city/location
  destinationCity?: string;   // destination city/location
  vehicleYear?:     number;   // 4-digit model year
  vehicleMake?:     string;   // manufacturer (Ford, Toyota …)
  vehicleModel?:    string;   // model name
  loadId?:          string;   // explicit load identifier
  shipmentId?:      string;   // explicit shipment identifier
  rawDateRef?:      string;   // raw date expression ("next Monday", "ASAP")
}

// ─── Classification Result ────────────────────────────────────────────────────

export interface IntentClassification {
  intent:       BenjiIntent;
  confidence:   number;                              // 0.0 – 1.0
  entities:     IntentEntities;
  source:       'deterministic' | 'llm' | 'fallback'; // how the result was produced
  processingMs: number;
  /**
   * Gap between the top two matched intent scores (only set when two or more patterns matched).
   * Low delta → the message is ambiguous between two intents.
   */
  scoreDelta?:  number;
  /** True when scoreDelta is below AMBIGUITY_DELTA_THRESHOLD (0.10). */
  ambiguous?:   boolean;
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface IntentClassifyInput {
  message:   string;
  userType?: 'client' | 'driver' | 'admin' | 'broker';
  userId?:   string;
}
