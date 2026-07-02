/**
 * Route-fit strategy constants for Benji V2.
 *
 * The two dispatcher services use intentionally different route-fit scoring
 * formulas (audited in Phase 1). This enum provides a single, typed way to
 * select the correct formula without raw string literals at call sites.
 *
 * If a third scoring variant is needed in future phases (e.g. broker routing,
 * multi-modal), add it here first — then extend calculateRouteFit in geo.ts.
 */

export const ROUTE_FIT_STRATEGY = {
  DISPATCH:       'dispatch',
  RECOMMENDATION: 'recommendation',
} as const;

export type RouteFitStrategy = (typeof ROUTE_FIT_STRATEGY)[keyof typeof ROUTE_FIT_STRATEGY];
