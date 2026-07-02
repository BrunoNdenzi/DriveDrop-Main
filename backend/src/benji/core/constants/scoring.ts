/**
 * Scoring constants for Benji AI dispatch and load recommendation.
 *
 * Extracted from hardcoded inline literals in:
 *   - BenjiDispatcherService (proximity 0.40, routeFit 0.25, earnings 0.20, …)
 *   - BenjiLoadRecommendationService (proximity 0.35, routeFit 0.30, earnings 0.25, …)
 *
 * These values are the current defaults. In Benji V2 they will be read from the
 * benji_config table at runtime (see BENJI_V2_IMPLEMENTATION_PLAN.md §Database).
 * Until that migration is complete, this file is the single source of truth.
 */

// ─── Dispatch scoring weights (used by BenjiDispatcherService) ────────────────
// Weights must sum to 1.0
export const DISPATCH_WEIGHTS = {
  proximity:   0.40,
  routeFit:    0.25,
  earnings:    0.20,
  experience:  0.10,
  rating:      0.05,
} as const;

// ─── Load recommendation weights (used by BenjiLoadRecommendationService) ─────
// Weights must sum to 1.0
export const RECOMMENDATION_WEIGHTS = {
  proximity:      0.35,
  routeFit:       0.30,
  earnings:       0.25,
  timing:         0.05,
  compatibility:  0.05,
} as const;

// ─── Shared thresholds ────────────────────────────────────────────────────────

/** Driver keeps 80% of the shipment price (platform fee = 20%). Immutable. */
export const DRIVER_EARNINGS_SPLIT = 0.80;

/** Minimum confidence score (0–100) required for a match to be considered in batch dispatch */
export const MIN_MATCH_CONFIDENCE = 60;

/** Match score threshold for 'best' priority in load recommendations */
export const BEST_MATCH_THRESHOLD = 85;

/** Match score threshold for 'good' priority in load recommendations */
export const GOOD_MATCH_THRESHOLD = 70;

/** Match score threshold for 'consider' priority (anything below is excluded) */
export const CONSIDER_THRESHOLD = 50;
