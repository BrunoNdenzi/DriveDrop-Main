/**
 * Benji Operational Intelligence Module
 * Phase 2: Knowledge Layer Foundation
 * 
 * Exports for the operational intelligence layer
 * Currently supports: Pricing intelligence
 * Future: Dispatch intelligence, routing intelligence, driver matching intelligence
 */

export { BenjiPricingIntelligence, benjiPricingIntelligence } from './pricing.intelligence';
export { PricingEventService, pricingEventService } from './pricing-event.service';

export type {
  PricingIntelligenceRequest,
  PricingObservation,
  PricingAnalysis,
  PricingInsight,
  PricingInsightType,
  PricingIntelligence,
  PricingIntelligenceOutput,
} from './pricing.intelligence';

export type {
  PricingEventType,
  PricingEvent,
  PricingEventPayload,
  QuoteRequestedEvent,
  IntelligenceAnalyzedEvent,
  PricingDecisionMadeEvent,
  QuoteGeneratedEvent,
  QuoteAcceptedEvent,
  QuoteRejectedEvent,
  ConfigChangedEvent,
  IntelligenceFallbackEvent,
} from './pricing.events';
