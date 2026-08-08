/**
 * Pricing Event Types for Event Sourcing
 * Phase 2: Knowledge Layer Foundation
 * 
 * Event types for pricing domain - enables audit trail and continuous learning
 * These events are stored in the pricing_events table
 */

export type PricingEventType =
  | 'quote_requested'           // User/system requests a price quote
  | 'intelligence_analyzed'      // Benji operational intelligence completed analysis
  | 'pricing_decision_made'      // Final pricing decision recorded
  | 'quote_generated'            // Quote successfully generated and returned
  | 'quote_viewed'               // Customer viewed the quote (frontend tracking)
  | 'quote_accepted'             // Customer accepted quote and booked
  | 'quote_rejected'             // Customer explicitly rejected quote
  | 'quote_expired'              // Quote validity window expired
  | 'config_changed'             // Admin changed pricing configuration
  | 'intelligence_fallback';     // Intelligence layer fell back to baseline

/**
 * Base event payload interface
 */
export interface PricingEventPayload {
  eventType: PricingEventType;
  aggregateId: string;    // quote_id, shipment_id, config_id
  aggregateType: 'quote' | 'shipment' | 'config';
  traceId?: string;       // Links to benji_traces
  userId?: string;
  occurredAt: Date;
}

/**
 * Quote Requested Event
 * Emitted when a pricing quote is requested (before calculation)
 */
export interface QuoteRequestedEvent extends PricingEventPayload {
  eventType: 'quote_requested';
  aggregateType: 'quote';
  payload: {
    routeOrigin: string;
    routeDestination: string;
    distanceMiles: number;
    vehicleType: string;
    vehicleCount?: number;
    pickupDate?: string;
    deliveryDate?: string;
    requestSource: 'website' | 'mobile' | 'benji' | 'admin';
  };
}

/**
 * Intelligence Analyzed Event
 * Emitted when Benji operational intelligence completes analysis
 */
export interface IntelligenceAnalyzedEvent extends PricingEventPayload {
  eventType: 'intelligence_analyzed';
  aggregateType: 'quote';
  payload: {
    quoteId: string;
    baselinePrice: number;
    recommendedPrice: number;
    priceAdjustment: number;
    confidenceScore: number;
    shouldOverride: boolean;
    fallbackToBaseline: boolean;
    reasoning: string;
    appliedRules: string[];
    dataQuality: string;
    sampleSize: number;
    processingTimeMs: number;
  };
}

/**
 * Pricing Decision Made Event
 * Emitted when final pricing decision is recorded
 */
export interface PricingDecisionMadeEvent extends PricingEventPayload {
  eventType: 'pricing_decision_made';
  aggregateType: 'quote';
  payload: {
    quoteId: string;
    baselinePrice: number;
    intelligentPrice?: number;
    finalPrice: number;
    decisionMaker: 'baseline' | 'benji_intelligence' | 'admin_override';
    benjiConfidence?: number;
    benjiReasoning?: string;
    overrideReason?: string;
    policyChecks: string[];  // e.g., ['minimum_enforced', 'surge_capped']
  };
}

/**
 * Quote Generated Event
 * Emitted when quote is successfully generated and ready to show customer
 */
export interface QuoteGeneratedEvent extends PricingEventPayload {
  eventType: 'quote_generated';
  aggregateType: 'quote';
  payload: {
    quoteId: string;
    quotedPrice: number;
    breakdown: {
      baseRatePerMile: number;
      distanceBand: string;
      surgeMultiplier: number;
      deliveryTypeMultiplier: number;
      minimumApplied: boolean;
    };
    expiresAt: Date;
    validityWindowHours: number;
  };
}

/**
 * Quote Accepted Event
 * Emitted when customer accepts quote and books shipment
 */
export interface QuoteAcceptedEvent extends PricingEventPayload {
  eventType: 'quote_accepted';
  aggregateType: 'quote';
  payload: {
    quoteId: string;
    quotedPrice: number;
    bookedPrice: number;
    shipmentId: string;
    timeToBookingMs: number;  // How long from quote to booking
    priceDeviation: number;   // If price changed between quote and booking
  };
}

/**
 * Quote Rejected Event
 * Emitted when customer explicitly rejects quote
 */
export interface QuoteRejectedEvent extends PricingEventPayload {
  eventType: 'quote_rejected';
  aggregateType: 'quote';
  payload: {
    quoteId: string;
    quotedPrice: number;
    rejectionReason?: string;  // If customer provides feedback
    competitorPrice?: number;  // If customer mentions competitor
  };
}

/**
 * Config Changed Event
 * Emitted when admin updates pricing configuration
 */
export interface ConfigChangedEvent extends PricingEventPayload {
  eventType: 'config_changed';
  aggregateType: 'config';
  payload: {
    configId: string;
    changedFields: string[];
    oldValues: Record<string, any>;
    newValues: Record<string, any>;
    changeReason?: string;
    changedBy: string;
  };
}

/**
 * Intelligence Fallback Event
 * Emitted when intelligence layer falls back to baseline due to error or low confidence
 */
export interface IntelligenceFallbackEvent extends PricingEventPayload {
  eventType: 'intelligence_fallback';
  aggregateType: 'quote';
  payload: {
    quoteId: string;
    fallbackReason: string;
    confidenceScore: number;
    errorMessage?: string;
  };
}

/**
 * Union type of all pricing events
 */
export type PricingEvent =
  | QuoteRequestedEvent
  | IntelligenceAnalyzedEvent
  | PricingDecisionMadeEvent
  | QuoteGeneratedEvent
  | QuoteAcceptedEvent
  | QuoteRejectedEvent
  | ConfigChangedEvent
  | IntelligenceFallbackEvent;
