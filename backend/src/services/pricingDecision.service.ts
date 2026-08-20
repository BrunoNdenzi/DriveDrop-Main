/**
 * Pricing Decision Service
 * Phase 2: Knowledge Layer Foundation
 * 
 * ARCHITECTURAL BOUNDARIES:
 * - This service is the Decision Layer - it owns business policies and thresholds
 * - Benji (Intelligence Layer) provides observations and insights
 * - This service applies business rules based on those insights
 * - This service makes final pricing decisions
 * 
 * Orchestrates the complete pricing flow:
 * 1. Pricing Engine (deterministic calculation) - pricing.service.ts
 * 2. Benji Operational Intelligence (observations & insights) - benjiPricingIntelligence
 * 3. Decision Layer (THIS SERVICE - policy enforcement & final decision)
 * 4. Event Logging (audit trail) - pricingEventService
 * 5. Quote History (persistence) - quote_history table
 * 
 * Design Principles:
 * - Backward compatible: Can be called with or without intelligence
 * - Feature flagged: Intelligence can be enabled/disabled
 * - Event sourcing: All decisions are logged
 * - Graceful degradation: Falls back to baseline if intelligence fails
 */

import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';
import { calculateQuoteWithDynamicConfig, type PricingInput } from './pricing.service';
import { benjiPricingIntelligence } from '@benji/intelligence';
import { pricingEventService } from '@benji/intelligence';
import { pricingPolicyService, type PricingPolicies } from './pricingPolicy.service';
import type {
  PricingIntelligenceRequest,
  PricingIntelligenceOutput,
} from '@benji/intelligence';
import type {
  QuoteRequestedEvent,
  IntelligenceAnalyzedEvent,
  PricingDecisionMadeEvent,
  QuoteGeneratedEvent,
} from '@benji/intelligence';
import { randomUUID } from 'crypto';

// ============================================================================
// POLICY PROVIDER PATTERN
// ============================================================================

/**
 * Decision Layer consumes policies from Policy Provider
 * Policies are database-backed and admin-configurable (pricing_config table)
 * Policy Provider handles caching, fallback defaults, and data transformation
 * 
 * This architectural pattern ensures:
 * - Business policies are treated as data, not implementation logic
 * - Policy values can be adjusted without code changes
 * - Decision Layer focuses on orchestration, not policy definition
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Enhanced pricing request with optional intelligence features
 */
export interface EnhancedPricingRequest extends PricingInput {
  // Request Context
  userId?: string;
  sessionId?: string;
  requestId?: string;
  traceId?: string;  // If called from Benji conversation
  
  // Route Context (for intelligence)
  routeOrigin?: string;
  routeDestination?: string;
  
  // Feature Flags
  enableIntelligence?: boolean;  // Legacy flag; true maps to shadow mode
  intelligenceMode?: 'off' | 'shadow' | 'recommend';
  logToHistory?: boolean;        // Default: true
  
  // Client Context
  ipAddress?: string;
  userAgent?: string;
  requestSource?: 'website' | 'mobile' | 'benji' | 'admin';
}

/**
 * Complete pricing result with intelligence insights
 */
export interface PricingDecisionResult {
  // Quote Identification
  quoteId: string;
  quoteKey: string;
  
  // Pricing Results
  total: number;
  breakdown: {
    baseRatePerMile: number;
    distanceBand: string;
    surgeMultiplier: number;
    deliveryTypeMultiplier: number;
    deliveryType: string;
    transportTypeMultiplier: number;
    transportType: 'open' | 'enclosed';
    operatingCostTotal: number;
    profitMarginPercent: number;
    profitAmount: number;
    targetContributionMarginPercent: number;
    economicFloor: number;
    economicFloorGap: number;
    economicFloorMode: 'shadow' | 'enforce';
    economicFloorApplied: boolean;
    costSource: 'configured_priors' | 'live_override' | 'fallback_priors';
    minimumApplied: boolean;
    rawBasePrice: number;
    bulkDiscountPercent: number;
    bulkDiscountAmount: number;
    fuelAdjustmentPercent: number;
  };
  
  // Intelligence Insights (if enabled)
  intelligence?: {
    overallConfidence: number;              // Benji's confidence in observations
    dataQuality: string;                    // Quality of data available
    summary: string;                        // Human-readable summary
    insightCount: number;                   // Number of insights provided
    suggestedFactors: string[];             // Factors Benji observed
  };
  
  // Decision Details (business rules applied)
  decision: {
    baselinePrice: number;                  // Original baseline from Pricing Engine
    intelligentPrice: number;               // Price calculated by applying business policies to insights
    finalPrice: number;                     // Actual quoted price (may include overrides)
    adjustment: number;                     // Dollar adjustment from baseline
    adjustmentPercent: number;              // % adjustment from baseline
    appliedPolicies: string[];              // Business policies that were applied
    policyViolations: string[];             // Any policy limits that were hit
  };
  
  // Decision Metadata
  decisionMaker: 'baseline' | 'benji_intelligence' | 'admin_override';
  
  // Expiration
  expiresAt: Date;
  validityWindowHours: number;
  
  // Performance
  processingTimeMs: number;
}

// ============================================================================
// PRICING DECISION SERVICE
// ============================================================================

export class PricingDecisionService {
  /**
   * Generate a complete pricing quote with optional intelligence
   * Main entry point for all pricing requests
   */
  async generateQuote(
    request: EnhancedPricingRequest
  ): Promise<PricingDecisionResult> {
    const startTime = Date.now();
    const quoteId = randomUUID();
    const quoteKey = this.buildQuoteKey(request, quoteId);
    
    // Set defaults
    const intelligenceMode = request.intelligenceMode
      ?? (request.enableIntelligence ? 'shadow' : 'off');
    const enableIntelligence = intelligenceMode !== 'off';
    const logToHistory = request.logToHistory ?? true;
    const requestSource = request.requestSource ?? 'website';
    
    logger.info('💰 Pricing Quote Request', {
      quoteId,
      route: request.routeOrigin ? `${request.routeOrigin} → ${request.routeDestination}` : 'unknown',
      vehicleType: request.vehicleType,
      distanceMiles: request.distanceMiles,
      enableIntelligence,
      intelligenceMode,
      requestSource,
    });
    
    try {
      // Step 1: Log quote requested event
      await this.logQuoteRequestedEvent(request, quoteId, requestSource);
      
      // Step 2: Calculate baseline price (Pricing Engine)
      const baselineResult = await calculateQuoteWithDynamicConfig(request);
      
      // Step 3: (Optional) Get intelligence recommendation
      let intelligenceOutput: PricingIntelligenceOutput | undefined;
      if (enableIntelligence && request.routeOrigin && request.routeDestination) {
        intelligenceOutput = await this.getIntelligenceRecommendation(
          request,
          baselineResult,
          quoteId
        );
        
        // Log intelligence analyzed event (only if intelligence succeeded)
        if (intelligenceOutput) {
          await this.logIntelligenceAnalyzedEvent(intelligenceOutput, quoteId, request.userId);
        }
      }
      
      // Step 4: Make final pricing decision (apply business policies)
      const decision = await this.makeFinalDecision(
        baselineResult,
        intelligenceOutput,
        request
      );
      
      // Log pricing decision made event
      await this.logPricingDecisionMadeEvent(
        decision,
        intelligenceOutput,
        quoteId,
        request.userId
      );
      
      // Step 5: Create result object
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      const processingTimeMs = Date.now() - startTime;
      
      const result: PricingDecisionResult = {
        quoteId,
        quoteKey,
        total: decision.finalPrice,
        breakdown: {
          baseRatePerMile: baselineResult.breakdown.baseRatePerMile,
          distanceBand: baselineResult.breakdown.distanceBand,
          surgeMultiplier: baselineResult.breakdown.surgeMultiplier,
          deliveryTypeMultiplier: baselineResult.breakdown.deliveryTypeMultiplier,
          deliveryType: baselineResult.breakdown.deliveryType,
          transportTypeMultiplier: baselineResult.breakdown.transportTypeMultiplier,
          transportType: baselineResult.breakdown.transportType,
          operatingCostTotal: baselineResult.breakdown.operatingCostTotal,
          profitMarginPercent: baselineResult.breakdown.profitMarginPercent,
          profitAmount: baselineResult.breakdown.profitAmount,
          targetContributionMarginPercent: baselineResult.breakdown.targetContributionMarginPercent,
          economicFloor: baselineResult.breakdown.economicFloor,
          economicFloorGap: baselineResult.breakdown.economicFloorGap,
          economicFloorMode: baselineResult.breakdown.economicFloorMode,
          economicFloorApplied: baselineResult.breakdown.economicFloorApplied,
          costSource: baselineResult.breakdown.costSource,
          minimumApplied: baselineResult.breakdown.minimumApplied,
          rawBasePrice: baselineResult.breakdown.rawBasePrice,
          bulkDiscountPercent: baselineResult.breakdown.bulkDiscountPercent,
          bulkDiscountAmount: baselineResult.breakdown.bulkDiscountAmount,
          fuelAdjustmentPercent: baselineResult.breakdown.fuelAdjustmentPercent,
        },
        ...(intelligenceOutput && {
          intelligence: {
            overallConfidence: intelligenceOutput.intelligence.overallConfidence,
            dataQuality: intelligenceOutput.intelligence.dataQuality,
            summary: intelligenceOutput.intelligence.summary,
            insightCount: intelligenceOutput.intelligence.insights.length,
            suggestedFactors: intelligenceOutput.intelligence.suggestedFactors,
          }
        }),
        decision: {
          baselinePrice: decision.baselinePrice,
          intelligentPrice: decision.intelligentPrice,
          finalPrice: decision.finalPrice,
          adjustment: decision.adjustment,
          adjustmentPercent: decision.adjustmentPercent,
          appliedPolicies: decision.appliedPolicies,
          policyViolations: decision.policyViolations,
        },
        decisionMaker: decision.decisionMaker,
        expiresAt,
        validityWindowHours: 24,
        processingTimeMs,
      };
      
      // Step 6: Log quote generated event
      await this.logQuoteGeneratedEvent(result, quoteId, request.userId);
      
      // Step 7: Persist to quote_history
      if (logToHistory) {
        await this.persistToQuoteHistory(request, result, intelligenceOutput);
      }
      
      logger.info('✅ Pricing Quote Generated', {
        quoteId,
        finalPrice: result.decision.finalPrice,
        decisionMaker: result.decisionMaker,
        processingTimeMs,
      });
      
      return result;
    } catch (error) {
      logger.error('❌ Error generating pricing quote', {
        quoteId,
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Fallback: Return baseline pricing without intelligence
      const baselineResult = await calculateQuoteWithDynamicConfig(request);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      return {
        quoteId,
        quoteKey,
        total: baselineResult.total,
        breakdown: {
          baseRatePerMile: baselineResult.breakdown.baseRatePerMile,
          distanceBand: baselineResult.breakdown.distanceBand,
          surgeMultiplier: baselineResult.breakdown.surgeMultiplier,
          deliveryTypeMultiplier: baselineResult.breakdown.deliveryTypeMultiplier,
          deliveryType: baselineResult.breakdown.deliveryType,
          transportTypeMultiplier: baselineResult.breakdown.transportTypeMultiplier,
          transportType: baselineResult.breakdown.transportType,
          operatingCostTotal: baselineResult.breakdown.operatingCostTotal,
          profitMarginPercent: baselineResult.breakdown.profitMarginPercent,
          profitAmount: baselineResult.breakdown.profitAmount,
          targetContributionMarginPercent: baselineResult.breakdown.targetContributionMarginPercent,
          economicFloor: baselineResult.breakdown.economicFloor,
          economicFloorGap: baselineResult.breakdown.economicFloorGap,
          economicFloorMode: baselineResult.breakdown.economicFloorMode,
          economicFloorApplied: baselineResult.breakdown.economicFloorApplied,
          costSource: baselineResult.breakdown.costSource,
          minimumApplied: baselineResult.breakdown.minimumApplied,
          rawBasePrice: baselineResult.breakdown.rawBasePrice,
          bulkDiscountPercent: baselineResult.breakdown.bulkDiscountPercent,
          bulkDiscountAmount: baselineResult.breakdown.bulkDiscountAmount,
          fuelAdjustmentPercent: baselineResult.breakdown.fuelAdjustmentPercent,
        },
        decision: {
          baselinePrice: baselineResult.total,
          intelligentPrice: baselineResult.total,
          finalPrice: baselineResult.total,
          adjustment: 0,
          adjustmentPercent: 0,
          appliedPolicies: [],
          policyViolations: [],
        },
        decisionMaker: 'baseline' as const,
        expiresAt,
        validityWindowHours: 24,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }
  
  // ==========================================================================
  // INTELLIGENCE INTEGRATION
  // ==========================================================================
  
  private async getIntelligenceRecommendation(
    request: EnhancedPricingRequest,
    baselineResult: { total: number; breakdown: any },
    quoteId: string
  ): Promise<PricingIntelligenceOutput | undefined> {
    try {
      const intelligenceRequest: PricingIntelligenceRequest = {
        routeOrigin: request.routeOrigin!,
        routeDestination: request.routeDestination!,
        distanceMiles: request.distanceMiles,
        vehicleType: request.vehicleType,
        ...(request.vehicleCount && { vehicleCount: request.vehicleCount }),
        ...(request.isAccidentRecovery && { isAccidentRecovery: request.isAccidentRecovery }),
        ...(request.pickupDate && { pickupDate: new Date(request.pickupDate) }),
        ...(request.deliveryDate && { deliveryDate: new Date(request.deliveryDate) }),
        ...(request.userId && { userId: request.userId }),
        baselinePrice: baselineResult.total,
        baselineBreakdown: {
          baseRatePerMile: baselineResult.breakdown.baseRatePerMile,
          distanceBand: baselineResult.breakdown.distanceBand,
          surgeMultiplier: baselineResult.breakdown.surgeMultiplier,
          deliveryTypeMultiplier: baselineResult.breakdown.deliveryTypeMultiplier,
        },
      };
      
      return await benjiPricingIntelligence.analyzePricingRequest(intelligenceRequest);
    } catch (error) {
      logger.error('❌ Intelligence recommendation failed, falling back to baseline', {
        quoteId,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }
  
  // ==========================================================================
  // DECISION LOGIC - Business Policy Application
  // ==========================================================================
  
  /**
   * Make final pricing decision by applying business policies to intelligence insights
   * This is where business rules are applied (NOT in Intelligence Layer)
   */
  private async makeFinalDecision(
    baselineResult: { total: number; breakdown: any },
    intelligenceOutput: PricingIntelligenceOutput | undefined,
    request: EnhancedPricingRequest
  ): Promise<{
    baselinePrice: number;
    intelligentPrice: number;
    finalPrice: number;
    adjustment: number;
    adjustmentPercent: number;
    appliedPolicies: string[];
    policyViolations: string[];
    decisionMaker: 'baseline' | 'benji_intelligence' | 'admin_override';
  }> {
    const baselinePrice = baselineResult.total;
    
    // Load active policies from Policy Provider
    const policies = await pricingPolicyService.getActivePolicies();
    
    // If no intelligence output, use baseline
    if (!intelligenceOutput) {
      return {
        baselinePrice,
        intelligentPrice: baselinePrice,
        finalPrice: baselinePrice,
        adjustment: 0,
        adjustmentPercent: 0,
        appliedPolicies: [],
        policyViolations: [],
        decisionMaker: 'baseline',
      };
    }
    
    // Check if we meet minimum requirements for intelligence-based pricing
    const meetsConfidenceThreshold = 
      intelligenceOutput.intelligence.overallConfidence >= policies.intelligenceMinConfidence;
    
    const meetsDataQualityThreshold = 
      this.compareDataQuality(intelligenceOutput.intelligence.dataQuality, policies.intelligenceMinDataQuality) >= 0;
    
    if (!meetsConfidenceThreshold || !meetsDataQualityThreshold) {
      // Intelligence not confident enough - use baseline
      return {
        baselinePrice,
        intelligentPrice: baselinePrice,
        finalPrice: baselinePrice,
        adjustment: 0,
        adjustmentPercent: 0,
        appliedPolicies: ['fallback_insufficient_confidence'],
        policyViolations: [],
        decisionMaker: 'baseline',
      };
    }
    
    // Apply business policies based on insights
    const { adjustedPrice, appliedPolicies, policyViolations } = this.applyBusinessPolicies(
      baselinePrice,
      intelligenceOutput,
      policies
    );
    
    const adjustment = adjustedPrice - baselinePrice;
    const adjustmentPercent = (adjustment / baselinePrice) * 100;
    const intelligenceMode = request.intelligenceMode
      ?? (request.enableIntelligence ? 'shadow' : 'off');
    const isShadow = intelligenceMode === 'shadow';
    
    return {
      baselinePrice,
      intelligentPrice: adjustedPrice,
      finalPrice: isShadow ? baselinePrice : adjustedPrice,
      adjustment,
      adjustmentPercent,
      appliedPolicies: isShadow ? [...appliedPolicies, 'shadow_observation'] : appliedPolicies,
      policyViolations,
      decisionMaker: isShadow || appliedPolicies.length === 0 ? 'baseline' : 'benji_intelligence',
    };
  }
  
  /**
   * Apply business policies based on intelligence insights
   * This is the Decision Layer's responsibility
   */
  private applyBusinessPolicies(
    baselinePrice: number,
    intelligenceOutput: PricingIntelligenceOutput,
    policies: PricingPolicies
  ): {
    adjustedPrice: number;
    appliedPolicies: string[];
    policyViolations: string[];
  } {
    let adjustedPrice = baselinePrice;
    const appliedPolicies: string[] = [];
    const policyViolations: string[] = [];
    
    const { intelligence, observation } = intelligenceOutput;
    
    // Policy 1: Historical Alignment
    // If baseline deviates significantly from historical average, blend them
    const historicalInsight = intelligence.insights.find(i => i.type === 'historical_price_deviation');
    if (
      historicalInsight && 
      Math.abs(historicalInsight.value) > policies.historicalDeviationThreshold &&
      observation.historicalQuotes.count >= policies.historicalMinSampleSize
    ) {
      const historicalPrice = observation.historicalQuotes.avgPrice;
      adjustedPrice = (adjustedPrice * (1 - policies.historicalAlignmentWeight)) + 
                      (historicalPrice * policies.historicalAlignmentWeight);
      appliedPolicies.push('historical_alignment');
    }
    
    // Policy 2: Demand-Based Adjustment
    if (intelligence.suggestedFactors.includes('high_demand_observed')) {
      adjustedPrice *= (1 + policies.demandPremiumPercent / 100);
      appliedPolicies.push('demand_premium');
    } else if (intelligence.suggestedFactors.includes('low_demand_observed')) {
      adjustedPrice *= (1 - policies.demandDiscountPercent / 100);
      appliedPolicies.push('demand_discount');
    }
    
    // Policy 3: Customer Loyalty Discount
    if (intelligence.suggestedFactors.includes('repeat_customer_detected')) {
      adjustedPrice *= (1 - policies.loyaltyDiscountPercent / 100);
      appliedPolicies.push('loyalty_discount');
    }
    
    // Policy 4: Conversion Optimization
    if (intelligence.suggestedFactors.includes('low_conversion_history')) {
      adjustedPrice *= (1 - policies.conversionBoostPercent / 100);
      appliedPolicies.push('conversion_boost');
    }
    
    // Policy 5: Momentum Premium
    if (intelligence.suggestedFactors.includes('strong_booking_momentum')) {
      adjustedPrice *= (1 + policies.momentumPremiumPercent / 100);
      appliedPolicies.push('momentum_premium');
    }
    
    // Safety Check: Enforce maximum adjustment limit
    const totalAdjustmentPercent = Math.abs((adjustedPrice - baselinePrice) / baselinePrice * 100);
    if (totalAdjustmentPercent > policies.maxPriceAdjustmentPercent) {
      // Cap the adjustment
      const cappedAdjustment = baselinePrice * (policies.maxPriceAdjustmentPercent / 100);
      adjustedPrice = baselinePrice + (adjustedPrice > baselinePrice ? cappedAdjustment : -cappedAdjustment);
      policyViolations.push(`adjustment_capped_at_${policies.maxPriceAdjustmentPercent}pct`);
    }
    
    // Round to cents
    adjustedPrice = Math.round(adjustedPrice * 100) / 100;
    
    return {
      adjustedPrice,
      appliedPolicies,
      policyViolations,
    };
  }
  
  /**
   * Compare data quality levels (-1: a < b, 0: a == b, 1: a > b)
   */
  private compareDataQuality(
    a: 'insufficient' | 'limited' | 'good' | 'excellent',
    b: 'insufficient' | 'limited' | 'good' | 'excellent'
  ): number {
    const levels = { insufficient: 0, limited: 1, good: 2, excellent: 3 };
    return levels[a] - levels[b];
  }
  
  // ==========================================================================
  // EVENT LOGGING
  // ==========================================================================
  
  private async logQuoteRequestedEvent(
    request: EnhancedPricingRequest,
    quoteId: string,
    requestSource: string
  ): Promise<void> {
    const event: QuoteRequestedEvent = {
      eventType: 'quote_requested',
      aggregateId: quoteId,
      aggregateType: 'quote',
      ...(request.traceId && { traceId: request.traceId }),
      ...(request.userId && { userId: request.userId }),
      occurredAt: new Date(),
      payload: {
        routeOrigin: request.routeOrigin || 'unknown',
        routeDestination: request.routeDestination || 'unknown',
        distanceMiles: request.distanceMiles,
        vehicleType: request.vehicleType,
        ...(request.vehicleCount && { vehicleCount: request.vehicleCount }),
        ...(request.pickupDate && { pickupDate: request.pickupDate }),
        ...(request.deliveryDate && { deliveryDate: request.deliveryDate }),
        requestSource: requestSource as any,
      },
    };
    
    await pricingEventService.logEvent(event);
  }
  
  private async logIntelligenceAnalyzedEvent(
    intelligence: PricingIntelligenceOutput,
    quoteId: string,
    userId?: string
  ): Promise<void> {
    const event: IntelligenceAnalyzedEvent = {
      eventType: 'intelligence_analyzed',
      aggregateId: quoteId,
      aggregateType: 'quote',
      ...(userId && { userId }),
      occurredAt: new Date(),
      payload: {
        quoteId,
        baselinePrice: 0, // Will be set by Decision Layer
        recommendedPrice: 0, // Will be set by Decision Layer
        priceAdjustment: 0, // Will be set by Decision Layer
        confidenceScore: intelligence.intelligence.overallConfidence,
        shouldOverride: false, // Decision Layer responsibility
        fallbackToBaseline: false, // Decision Layer responsibility
        reasoning: intelligence.intelligence.summary,
        appliedRules: intelligence.intelligence.suggestedFactors,
        dataQuality: intelligence.observation.dataQuality,
        sampleSize: intelligence.observation.sampleSize,
        processingTimeMs: intelligence.processingTimeMs,
      },
    };
    
    await pricingEventService.logEvent(event);
  }
  
  private async logPricingDecisionMadeEvent(
    decision: {
      baselinePrice: number;
      intelligentPrice: number;
      finalPrice: number;
      appliedPolicies: string[];
      decisionMaker: string;
    },
    intelligenceOutput: PricingIntelligenceOutput | undefined,
    quoteId: string,
    userId?: string
  ): Promise<void> {
    const event: PricingDecisionMadeEvent = {
      eventType: 'pricing_decision_made',
      aggregateId: quoteId,
      aggregateType: 'quote',
      ...(userId && { userId }),
      occurredAt: new Date(),
      payload: {
        quoteId,
        baselinePrice: decision.baselinePrice,
        ...(decision.intelligentPrice !== decision.baselinePrice && { intelligentPrice: decision.intelligentPrice }),
        finalPrice: decision.finalPrice,
        decisionMaker: decision.decisionMaker as any,
        ...(intelligenceOutput && { benjiConfidence: intelligenceOutput.intelligence.overallConfidence }),
        ...(intelligenceOutput && { benjiReasoning: intelligenceOutput.intelligence.summary }),
        policyChecks: decision.appliedPolicies, // Business policies applied by Decision Layer
      },
    };
    
    await pricingEventService.logEvent(event);
  }
  
  private async logQuoteGeneratedEvent(
    result: PricingDecisionResult,
    quoteId: string,
    userId?: string
  ): Promise<void> {
    const event: QuoteGeneratedEvent = {
      eventType: 'quote_generated',
      aggregateId: quoteId,
      aggregateType: 'quote',
      ...(userId && { userId }),
      occurredAt: new Date(),
      payload: {
        quoteId,
        quotedPrice: result.decision.finalPrice,
        breakdown: result.breakdown as any,
        expiresAt: result.expiresAt,
        validityWindowHours: result.validityWindowHours,
      },
    };
    
    await pricingEventService.logEvent(event);
  }
  
  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================
  
  private async persistToQuoteHistory(
    request: EnhancedPricingRequest,
    result: PricingDecisionResult,
    intelligenceOutput: PricingIntelligenceOutput | undefined
  ): Promise<void> {
    try {
      const intelligenceMode = request.intelligenceMode
        ?? (request.enableIntelligence ? 'shadow' : 'off');
      const { error } = await supabaseAdmin
        .from('quote_history')
        .insert({
          id: result.quoteId,
          quote_key: result.quoteKey,
          user_id: request.userId,
          request_id: request.requestId,
          session_id: request.sessionId,
          
          route_origin: request.routeOrigin || 'unknown',
          route_destination: request.routeDestination || 'unknown',
          distance_miles: request.distanceMiles,
          
          vehicle_type: request.vehicleType,
          vehicle_count: request.vehicleCount || 1,
          
          pickup_date: request.pickupDate,
          delivery_date: request.deliveryDate,
          delivery_type: result.breakdown.deliveryType,
          
          baseline_price: result.decision.baselinePrice,
          intelligent_price: result.decision.intelligentPrice,
          quoted_price: result.decision.finalPrice,
          
          base_rate_per_mile: result.breakdown.baseRatePerMile,
          distance_band: result.breakdown.distanceBand,
          surge_multiplier: result.breakdown.surgeMultiplier,
          delivery_type_multiplier: result.breakdown.deliveryTypeMultiplier,
          fuel_adjustment_percent: result.breakdown.fuelAdjustmentPercent,
          bulk_discount_percent: result.breakdown.bulkDiscountPercent,
          minimum_applied: result.breakdown.minimumApplied,
          estimated_operating_cost: result.breakdown.operatingCostTotal,
          target_contribution_margin_percent: result.breakdown.targetContributionMarginPercent,
          economic_floor: result.breakdown.economicFloor,
          economic_floor_gap: result.breakdown.economicFloorGap,
          economic_floor_mode: result.breakdown.economicFloorMode,
          economic_floor_applied: result.breakdown.economicFloorApplied,
          cost_source: result.breakdown.costSource,
          
          decision_maker: result.decisionMaker,
          benji_confidence_score: result.intelligence?.overallConfidence,
          benji_reasoning: result.intelligence?.summary,
          intelligence_mode: intelligenceMode,
          feature_snapshot: {
            route: {
              origin: request.routeOrigin || null,
              destination: request.routeDestination || null,
              distance_miles: request.distanceMiles,
            },
            vehicle: {
              type: request.vehicleType,
              count: request.vehicleCount || 1,
              transport_type: request.transportType || 'open',
              accident_recovery: Boolean(request.isAccidentRecovery),
            },
            timing: {
              pickup_date: request.pickupDate || null,
              delivery_date: request.deliveryDate || null,
              delivery_type: result.breakdown.deliveryType,
            },
            baseline: {
              price: result.decision.baselinePrice,
              base_rate_per_mile: result.breakdown.baseRatePerMile,
              distance_band: result.breakdown.distanceBand,
              operating_cost_total: result.breakdown.operatingCostTotal,
              economic_floor: result.breakdown.economicFloor,
              economic_floor_gap: result.breakdown.economicFloorGap,
              economic_floor_mode: result.breakdown.economicFloorMode,
              cost_source: result.breakdown.costSource,
            },
          },
          intelligence_snapshot: intelligenceOutput ? {
            observation: intelligenceOutput.observation,
            analysis: intelligenceOutput.analysis,
            intelligence: intelligenceOutput.intelligence,
            generated_at: intelligenceOutput.generatedAt.toISOString(),
            processing_time_ms: intelligenceOutput.processingTimeMs,
          } : null,
          recommendation_snapshot: intelligenceOutput ? {
            baseline_price: result.decision.baselinePrice,
            recommended_price: result.decision.intelligentPrice,
            customer_price: result.decision.finalPrice,
            adjustment: result.decision.adjustment,
            adjustment_percent: result.decision.adjustmentPercent,
            applied_policies: result.decision.appliedPolicies,
            policy_violations: result.decision.policyViolations,
            mode: intelligenceMode,
          } : null,
          source_health_snapshot: intelligenceOutput ? Object.fromEntries(
            Object.entries(intelligenceOutput.observation.liveEvidence).map(([source, evidence]) => [
              source,
              {
                provider: evidence.provider,
                status: evidence.status,
                observed_at: evidence.observedAt,
                fresh_until: evidence.freshUntil,
                latency_ms: evidence.latencyMs,
                error_code: evidence.errorCode || null,
              },
            ])
          ) : null,
          intelligence_generated_at: intelligenceOutput
            ? intelligenceOutput.generatedAt.toISOString()
            : null,
          
          was_booked: false,
          expires_at: result.expiresAt.toISOString(),
          ip_address: request.ipAddress,
          user_agent: request.userAgent,
          
          created_at: new Date().toISOString(),
        });
      
      if (error) {
        logger.error('❌ Failed to persist quote to history', {
          quoteId: result.quoteId,
          error: error.message,
        });
      }
    } catch (error) {
      logger.error('❌ Error persisting quote to history', {
        quoteId: result.quoteId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - this shouldn't break the quote generation
    }
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  private buildQuoteKey(request: EnhancedPricingRequest, _quoteId: string): string {
    const userId = request.userId || 'anonymous';
    const route = request.routeOrigin && request.routeDestination
      ? `${request.routeOrigin}-${request.routeDestination}`
      : 'unknown';
    const timestamp = Date.now();
    
    return `${userId}:${route}:${request.vehicleType}:${timestamp}`;
  }
  
  /**
   * Mark a quote as booked (called when shipment is created)
   */
  async markQuoteAsBookedForClient(
    quoteId: string,
    shipmentId: string,
    clientId: string
  ): Promise<boolean> {
    const { data: shipment, error } = await supabaseAdmin
      .from('shipments')
      .select('id, client_id, estimated_price')
      .eq('id', shipmentId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (error) {
      logger.error('Failed to verify shipment ownership for quote booking', {
        quoteId,
        shipmentId,
        clientId,
        error: error.message,
      });
      return false;
    }

    if (!shipment) {
      return false;
    }

    return this.markQuoteAsBooked(quoteId, shipment.id, clientId);
  }

  async markQuoteAsBooked(
    quoteId: string,
    shipmentId: string,
    clientId: string
  ): Promise<boolean> {
    try {
      const { data: quote, error: quoteError } = await supabaseAdmin
        .from('quote_history')
        .select('created_at, quoted_price, was_booked, shipment_id')
        .eq('id', quoteId)
        .eq('user_id', clientId)
        .maybeSingle();

      if (quoteError || !quote) {
        logger.warn('Owned quote not found while marking it as booked', {
          quoteId,
          shipmentId,
          clientId,
          error: quoteError?.message,
        });
        return false;
      }

      if (quote.was_booked) {
        if (quote.shipment_id !== shipmentId) {
          logger.warn('Booked quote cannot be linked to another shipment', {
            quoteId,
            existingShipmentId: quote.shipment_id,
            shipmentId,
          });
        }
        return quote.shipment_id === shipmentId;
      }
      
      const timeToBooking = Date.now() - new Date(quote.created_at).getTime();
      
      const { data: updatedQuote, error } = await supabaseAdmin
        .from('quote_history')
        .update({
          was_booked: true,
          booked_at: new Date().toISOString(),
          time_to_booking_ms: timeToBooking,
          shipment_id: shipmentId,
          booking_price: Number(quote.quoted_price),
        })
        .eq('id', quoteId)
        .eq('user_id', clientId)
        .eq('was_booked', false)
        .select('id')
        .maybeSingle();
      
      if (error) {
        logger.error('❌ Failed to mark quote as booked', {
          quoteId,
          shipmentId,
          error: error.message,
        });
        return false;
      }

      return Boolean(updatedQuote);
    } catch (error) {
      logger.error('❌ Error marking quote as booked', {
        quoteId,
        shipmentId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

// Export singleton instance
export const pricingDecisionService = new PricingDecisionService();
