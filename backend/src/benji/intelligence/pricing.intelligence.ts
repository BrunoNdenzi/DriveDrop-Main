/**
 * Benji Operational Intelligence — Pricing Domain
 * Phase 2: Knowledge Layer Foundation
 * 
 * Purpose: Benji's first operational intelligence capability
 * Pattern: Observe → Analyze → Explain
 * 
 * ARCHITECTURAL BOUNDARIES:
 * - Benji observes, analyzes, explains, and provides evidence-based insights
 * - Benji does NOT apply business rules or make pricing decisions
 * - Benji does NOT enforce thresholds or policies
 * 
 * The Decision Layer is responsible for:
 * - Receiving Benji's insights
 * - Applying business policies and rules
 * - Enforcing approval thresholds
 * - Making final pricing decisions
 * 
 * Design Principles:
 * - Intelligence ≠ Machine Learning (ML comes in Phase 4+)
 * - Intelligence ≠ Decision Making (Decision Layer owns business policies)
 * - Every insight includes confidence level and evidence
 * - All observations are auditable (logged to pricing_events)
 * - Reusable reasoning cycle pattern for future domains (dispatch, routing, etc.)
 */

import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';
import {
  pricingLiveEvidenceService,
  type PricingLiveEvidence,
} from '@services/pricingLiveEvidence.service';
import type { VehicleType } from '@services/pricing.service';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface LoadBoardOfferRow {
  suggested_carrier_payout: number | string | null;
}

interface CarrierBidRow {
  carrier_payout: number | string | null;
  bid_status: string | null;
}

/**
 * Input to operational intelligence analysis
 * Mirrors pricing request but focuses on intelligence aspects
 */
export interface PricingIntelligenceRequest {
  // Route Context
  routeOrigin: string;
  routeDestination: string;
  distanceMiles: number;
  
  // Vehicle Context
  vehicleType: VehicleType;
  vehicleCount?: number;
  isAccidentRecovery?: boolean;
  
  // Timing Context
  pickupDate?: Date;
  deliveryDate?: Date;
  
  // Customer Context
  userId?: string;
  isRepeatCustomer?: boolean;
  
  // Baseline Calculation (from Pricing Engine)
  baselinePrice: number;
  baselineBreakdown: {
    baseRatePerMile: number;
    distanceBand: string;
    surgeMultiplier: number;
    deliveryTypeMultiplier: number;
  };
}

/**
 * Operational intelligence observation data
 * What Benji "sees" when analyzing a pricing request
 */
export interface PricingObservation {
  // Historical Route Performance
  historicalQuotes: {
    count: number;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    conversionRate: number;
  };
  
  // Recent Activity (last 7 days)
  recentActivity: {
    quotesGenerated: number;
    quotesBooked: number;
    avgTimeToBooking: number; // milliseconds
  };
  
  // Customer Behavior (if known customer)
  customerProfile?: {
    totalQuotesSeen: number;
    totalBookings: number;
    priceRejectionRate: number;
    preferredPriceRange: [number, number]; // [min, max]
  };
  
  // Operational Context
  currentDemand: 'low' | 'medium' | 'high';  // Based on active shipments
  internalMarket: {
    scope: 'network_wide';
    observedAt: string;
    verifiedDriverCount: number | null;
    pendingUnassignedLoadCount: number | null;
    activeOfferCount: number | null;
    medianSuggestedCarrierPayout: number | null;
    recentBidCount: number | null;
    acceptedBidCount: number | null;
    medianRecentBidCarrierPayout: number | null;
    medianAcceptedCarrierPayout: number | null;
    status: 'available' | 'partial' | 'unavailable';
    unavailableSources: string[];
  };
  liveEvidence: PricingLiveEvidence;
  dataQuality: 'insufficient' | 'limited' | 'good' | 'excellent';
  sampleSize: number;
}

/**
 * Structured analysis result from Benji
 * What Benji "thinks" after observation
 */
export interface PricingAnalysis {
  // Price Position Analysis
  baselinePricePosition: 'below_market' | 'at_market' | 'above_market';
  historicalPriceDeviation: number; // % difference from historical average
  
  // Conversion Probability Analysis
  estimatedConversionProbability: number; // 0-100
  priceElasticity: 'low' | 'medium' | 'high'; // How price-sensitive is this route?
  
  // Risk Assessment
  riskFactors: string[]; // e.g., ['no_historical_data', 'long_distance', 'accident_recovery']
  confidenceLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  
  // Opportunity Analysis
  opportunities: string[]; // e.g., ['repeat_customer', 'high_demand', 'flexible_timing']
}

/**
 * Benji's intelligence output: Insights and evidence, NOT decisions
 * Benji provides factors that the Decision Layer can use to apply business policies
 */
export interface PricingIntelligence {
  // Insights: Evidence-based factors for decision making
  insights: PricingInsight[];
  
  // Overall Assessment
  overallConfidence: number; // 0-100: Confidence in the quality of observations
  dataQuality: 'insufficient' | 'limited' | 'good' | 'excellent';
  
  // Reasoning & Explanation
  summary: string;       // Human-readable summary of observations
  reasoningComponents: {
    historicalInsight: string;
    demandInsight: string;
    customerInsight: string;
    riskInsight: string;
  };
  
  // Suggested Considerations (NOT rules, just observations)
  suggestedFactors: string[];  // e.g., ['historical_deviation_noted', 'high_demand_observed']
}

/**
 * Individual insight: A specific observation with evidence and confidence
 */
export interface PricingInsight {
  type: PricingInsightType;
  value: any;              // The observed value (could be number, string, boolean)
  confidence: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  evidence: string;        // Human-readable evidence for this insight
  weight: number;          // 0-1: How important is this insight? (for Decision Layer to use)
}

/**
 * Types of insights Benji can provide
 */
export type PricingInsightType =
  // Historical Insights
  | 'historical_price_deviation'      // % deviation from historical average
  | 'historical_conversion_rate'      // Historical booking rate for this route
  | 'historical_sample_size'          // Number of historical quotes available
  
  // Demand Insights
  | 'current_demand_level'            // Current demand: low/medium/high
  | 'recent_booking_momentum'         // Recent booking trend
  
  // Customer Insights
  | 'customer_loyalty'                // Is this a repeat customer?
  | 'customer_price_sensitivity'      // Customer's historical price sensitivity
  
  // Risk Insights
  | 'data_sufficiency'                // Do we have enough data to be confident?
  | 'route_complexity'                // Route complexity factors (distance, type)
  | 'price_elasticity';               // How price-sensitive is this route?

/**
 * Complete operational intelligence output
 * Full cycle: Observe → Analyze → Explain
 */
export interface PricingIntelligenceOutput {
  observation: PricingObservation;
  analysis: PricingAnalysis;
  intelligence: PricingIntelligence;  // Changed from "recommendation"
  
  // Metadata
  generatedAt: Date;
  processingTimeMs: number;
}

// ============================================================================
// BENJI OPERATIONAL INTELLIGENCE SERVICE
// ============================================================================

export class BenjiPricingIntelligence {
  /**
   * Main entry point: Analyze pricing request and generate intelligence insights
   * Follows: Observe → Analyze → Explain pattern
   */
  async analyzePricingRequest(
    request: PricingIntelligenceRequest
  ): Promise<PricingIntelligenceOutput> {
    const startTime = Date.now();
    
    try {
      // Step 1: OBSERVE — Gather all relevant data
      const observation = await this.observe(request);
      
      // Step 2: ANALYZE — Process observations into insights
      const analysis = this.analyze(observation, request);
      
      // Step 3: EXPLAIN — Generate intelligence insights with reasoning
      const intelligence = this.generateIntelligence(observation, analysis, request);
      
      const processingTimeMs = Date.now() - startTime;
      
      logger.info('📊 Benji Pricing Intelligence Analysis Complete', {
        route: `${request.routeOrigin} → ${request.routeDestination}`,
        baselinePrice: request.baselinePrice,
        overallConfidence: intelligence.overallConfidence,
        insightCount: intelligence.insights.length,
        processingTimeMs,
      });
      
      return {
        observation,
        analysis,
        intelligence,
        generatedAt: new Date(),
        processingTimeMs,
      };
    } catch (error) {
      logger.error('❌ Benji Pricing Intelligence Analysis Failed', {
        error: error instanceof Error ? error.message : String(error),
        route: `${request.routeOrigin} → ${request.routeDestination}`,
      });
      
      // Return fallback with minimal intelligence
      const processingTimeMs = Date.now() - startTime;
      return this.createFallbackOutput(request, processingTimeMs);
    }
  }
  
  // ==========================================================================
  // STEP 1: OBSERVE
  // ==========================================================================
  
  /**
   * Observe: Gather historical data and context
   * Query Knowledge Layer for relevant intelligence
   */
  private async observe(
    request: PricingIntelligenceRequest
  ): Promise<PricingObservation> {
    const routeKey = this.buildRouteKey(
      request.routeOrigin,
      request.routeDestination,
      request.vehicleType
    );
    
    // Query 1: Historical route performance
    const [historicalData, recentActivity, liveEvidence, internalMarket] = await Promise.all([
      this.getHistoricalRouteData(routeKey),
      this.getRecentActivity(routeKey),
      pricingLiveEvidenceService.collect(request.routeOrigin, request.routeDestination),
      this.getInternalMarketEvidence(),
    ]);
    
    // Query 3: Customer profile (if available)
    const customerProfile = request.userId
      ? await this.getCustomerProfile(request.userId)
      : undefined;
    
    // Query 4: Current demand level (simple heuristic for now)
    const currentDemand = await this.assessCurrentDemand(
      request.routeOrigin,
      request.routeDestination
    );
    
    // Assess data quality
    const dataQuality = this.assessDataQuality(
      historicalData.count,
      recentActivity.quotesGenerated
    );
    
    const observation: PricingObservation = {
      historicalQuotes: historicalData,
      recentActivity,
      currentDemand,
      internalMarket,
      liveEvidence,
      dataQuality,
      sampleSize: historicalData.count,
    };
    
    if (customerProfile) {
      observation.customerProfile = customerProfile;
    }
    
    return observation;
  }

  private async getInternalMarketEvidence(): Promise<PricingObservation['internalMarket']> {
    const observedAt = new Date().toISOString();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const unavailableSources: string[] = [];

    const [driversResult, loadsResult, offersResult, bidsResult] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'driver')
        .eq('is_verified', true),
      supabaseAdmin
        .from('shipments')
        .select('*', { count: 'exact', head: true })
        .is('driver_id', null)
        .eq('status', 'pending'),
      supabaseAdmin
        .from('load_board')
        .select('suggested_carrier_payout')
        .eq('load_status', 'available')
        .eq('bidding_enabled', true)
        .or(`expires_at.is.null,expires_at.gte.${observedAt}`),
      supabaseAdmin
        .from('load_board_bids')
        .select('carrier_payout, bid_status')
        .neq('bid_status', 'withdrawn')
        .gte('created_at', since),
    ]);

    if (driversResult.error) unavailableSources.push('verified_drivers');
    if (loadsResult.error) unavailableSources.push('pending_loads');
    if (offersResult.error) unavailableSources.push('load_board_offers');
    if (bidsResult.error) unavailableSources.push('carrier_bids');

    const offers = (offersResult.data || []) as LoadBoardOfferRow[];
    const recentBids = (bidsResult.data || []) as CarrierBidRow[];
    const suggestedPayouts = offers
      .map(row => Number(row.suggested_carrier_payout))
      .filter(Number.isFinite);
    const bidPayouts = recentBids
      .map(row => Number(row.carrier_payout))
      .filter(Number.isFinite);
    const acceptedBidPayouts = recentBids
      .filter(row => row.bid_status === 'accepted')
      .map(row => Number(row.carrier_payout))
      .filter(Number.isFinite);

    return {
      scope: 'network_wide',
      observedAt,
      verifiedDriverCount: driversResult.error ? null : driversResult.count,
      pendingUnassignedLoadCount: loadsResult.error ? null : loadsResult.count,
      activeOfferCount: offersResult.error ? null : offers.length,
      medianSuggestedCarrierPayout: this.median(suggestedPayouts),
      recentBidCount: bidsResult.error ? null : recentBids.length,
      acceptedBidCount: bidsResult.error
        ? null
        : recentBids.filter(row => row.bid_status === 'accepted').length,
      medianRecentBidCarrierPayout: this.median(bidPayouts),
      medianAcceptedCarrierPayout: this.median(acceptedBidPayouts),
      status: unavailableSources.length === 0
        ? 'available'
        : unavailableSources.length === 4 ? 'unavailable' : 'partial',
      unavailableSources,
    };
  }

  private median(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    const middleValue = sorted[middle];
    if (middleValue === undefined) return null;
    if (sorted.length % 2 === 1) return middleValue;
    const lowerValue = sorted[middle - 1];
    return lowerValue === undefined ? middleValue : (lowerValue + middleValue) / 2;
  }
  
  /**
   * Query historical route performance from quote_history table
   */
  private async getHistoricalRouteData(routeKey: string): Promise<{
    count: number;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    conversionRate: number;
  }> {
    const [origin, destination, vehicleType] = routeKey.split(':');
    
    const { data, error } = await supabaseAdmin
      .from('quote_history')
      .select('quoted_price, was_booked')
      .eq('route_origin', origin)
      .eq('route_destination', destination)
      .eq('vehicle_type', vehicleType)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // Last 90 days
      .limit(1000);
    
    if (error || !data || data.length === 0) {
      return {
        count: 0,
        avgPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        conversionRate: 0,
      };
    }
    
    interface QuoteRow {
      quoted_price: number;
      was_booked: boolean;
    }
    
    const prices = data.map((q: QuoteRow) => q.quoted_price);
    const bookedCount = data.filter((q: QuoteRow) => q.was_booked).length;
    
    return {
      count: data.length,
      avgPrice: prices.reduce((a: number, b: number) => a + b, 0) / prices.length,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      conversionRate: (bookedCount / data.length) * 100,
    };
  }
  
  /**
   * Query recent activity (last 7 days)
   */
  private async getRecentActivity(routeKey: string): Promise<{
    quotesGenerated: number;
    quotesBooked: number;
    avgTimeToBooking: number;
  }> {
    const [origin, destination, vehicleType] = routeKey.split(':');
    
    const { data, error } = await supabaseAdmin
      .from('quote_history')
      .select('was_booked, time_to_booking_ms')
      .eq('route_origin', origin)
      .eq('route_destination', destination)
      .eq('vehicle_type', vehicleType)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    
    if (error || !data || data.length === 0) {
      return { quotesGenerated: 0, quotesBooked: 0, avgTimeToBooking: 0 };
    }
    
    interface ActivityRow {
      was_booked: boolean;
      time_to_booking_ms: number | null;
    }
    
    const bookedQuotes = data.filter((q: ActivityRow) => q.was_booked && q.time_to_booking_ms);
    const avgTimeToBooking = bookedQuotes.length > 0
      ? bookedQuotes.reduce((sum: number, q: ActivityRow) => sum + (q.time_to_booking_ms || 0), 0) / bookedQuotes.length
      : 0;
    
    return {
      quotesGenerated: data.length,
      quotesBooked: bookedQuotes.length,
      avgTimeToBooking,
    };
  }
  
  /**
   * Get customer pricing profile (if repeat customer)
   */
  private async getCustomerProfile(userId: string): Promise<{
    totalQuotesSeen: number;
    totalBookings: number;
    priceRejectionRate: number;
    preferredPriceRange: [number, number];
  } | undefined> {
    const { data, error } = await supabaseAdmin
      .from('quote_history')
      .select('quoted_price, was_booked')
      .eq('user_id', userId)
      .limit(100);
    
    if (error || !data || data.length === 0) {
      return undefined;
    }
    
    interface CustomerRow {
      was_booked: boolean;
      quoted_price: number;
    }
    
    const bookedQuotes = data.filter((q: CustomerRow) => q.was_booked);
    const bookedPrices = bookedQuotes.map((q: CustomerRow) => q.quoted_price);
    
    return {
      totalQuotesSeen: data.length,
      totalBookings: bookedQuotes.length,
      priceRejectionRate: ((data.length - bookedQuotes.length) / data.length) * 100,
      preferredPriceRange: bookedPrices.length > 0
        ? [Math.min(...bookedPrices), Math.max(...bookedPrices)]
        : [0, 0],
    };
  }
  
  /**
   * Assess current demand (simple heuristic: count active shipments in region)
   * Phase 2: Simple rule-based. Phase 4+: Real-time metrics
   */
  private async assessCurrentDemand(
    origin: string,
    destination: string
  ): Promise<'low' | 'medium' | 'high'> {
    // Simple heuristic: Count pending/in-transit shipments
    const { count, error } = await supabaseAdmin
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'accepted', 'in_transit'])
      .or(`pickup_address.ilike.%${origin}%,delivery_address.ilike.%${destination}%`);
    
    if (error || count === null) return 'medium';
    
    if (count < 5) return 'low';
    if (count < 15) return 'medium';
    return 'high';
  }
  
  /**
   * Assess quality of available data
   */
  private assessDataQuality(
    historicalCount: number,
    recentCount: number
  ): 'insufficient' | 'limited' | 'good' | 'excellent' {
    if (historicalCount === 0 && recentCount === 0) return 'insufficient';
    if (historicalCount < 10) return 'limited';
    if (historicalCount < 50) return 'good';
    return 'excellent';
  }
  
  // ==========================================================================
  // STEP 2: ANALYZE
  // ==========================================================================
  
  /**
   * Analyze: Process observations into structured insights
   * Apply business logic to understand what the data means
   */
  private analyze(
    observation: PricingObservation,
    request: PricingIntelligenceRequest
  ): PricingAnalysis {
    // Analysis 1: Price position vs historical
    const baselinePricePosition = this.analyzePricePosition(
      request.baselinePrice,
      observation.historicalQuotes.avgPrice
    );
    
    const historicalPriceDeviation = observation.historicalQuotes.avgPrice > 0
      ? ((request.baselinePrice - observation.historicalQuotes.avgPrice) / observation.historicalQuotes.avgPrice) * 100
      : 0;
    
    // Analysis 2: Conversion probability estimation
    const estimatedConversionProbability = this.estimateConversionProbability(
      observation,
      request.baselinePrice
    );
    
    // Analysis 3: Price elasticity (how sensitive is this route to price?)
    const priceElasticity = this.assessPriceElasticity(observation);
    
    // Analysis 4: Risk assessment
    const riskFactors = this.identifyRiskFactors(observation, request);
    const confidenceLevel = this.determineConfidenceLevel(observation, riskFactors);
    
    // Analysis 5: Opportunity identification
    const opportunities = this.identifyOpportunities(observation, request);
    
    return {
      baselinePricePosition,
      historicalPriceDeviation,
      estimatedConversionProbability,
      priceElasticity,
      riskFactors,
      confidenceLevel,
      opportunities,
    };
  }
  
  private analyzePricePosition(
    baselinePrice: number,
    avgHistoricalPrice: number
  ): 'below_market' | 'at_market' | 'above_market' {
    if (avgHistoricalPrice === 0) return 'at_market';
    
    const deviation = ((baselinePrice - avgHistoricalPrice) / avgHistoricalPrice) * 100;
    
    if (deviation < -10) return 'below_market';
    if (deviation > 10) return 'above_market';
    return 'at_market';
  }
  
  private estimateConversionProbability(
    observation: PricingObservation,
    _baselinePrice: number
  ): number {
    // If no historical data, use conservative estimate
    if (observation.dataQuality === 'insufficient') return 50;
    
    // Use historical conversion rate as baseline
    let probability = observation.historicalQuotes.conversionRate;
    
    // Adjust for current demand
    if (observation.currentDemand === 'high') probability += 10;
    if (observation.currentDemand === 'low') probability -= 10;
    
    // Adjust for repeat customer behavior
    if (observation.customerProfile) {
      const customerConversionRate = 
        (observation.customerProfile.totalBookings / observation.customerProfile.totalQuotesSeen) * 100;
      probability = (probability + customerConversionRate) / 2; // Average with customer's pattern
    }
    
    // Clamp to 0-100
    return Math.max(0, Math.min(100, probability));
  }
  
  private assessPriceElasticity(
    observation: PricingObservation
  ): 'low' | 'medium' | 'high' {
    // High data variance = high elasticity (price-sensitive)
    if (observation.historicalQuotes.count < 10) return 'medium';
    
    const priceRange = observation.historicalQuotes.maxPrice - observation.historicalQuotes.minPrice;
    const avgPrice = observation.historicalQuotes.avgPrice;
    
    if (avgPrice === 0) return 'medium';
    
    const variability = (priceRange / avgPrice) * 100;
    
    if (variability > 30) return 'high';
    if (variability < 15) return 'low';
    return 'medium';
  }
  
  private identifyRiskFactors(
    observation: PricingObservation,
    request: PricingIntelligenceRequest
  ): string[] {
    const risks: string[] = [];
    
    if (observation.dataQuality === 'insufficient') {
      risks.push('no_historical_data');
    }
    
    if (request.distanceMiles > 1500) {
      risks.push('long_distance_route');
    }
    
    if (request.isAccidentRecovery) {
      risks.push('accident_recovery_premium');
    }
    
    if (observation.historicalQuotes.conversionRate < 30) {
      risks.push('low_historical_conversion');
    }
    
    if (observation.currentDemand === 'low') {
      risks.push('low_current_demand');
    }
    
    return risks;
  }
  
  private determineConfidenceLevel(
    observation: PricingObservation,
    riskFactors: string[]
  ): 'very_low' | 'low' | 'medium' | 'high' | 'very_high' {
    // Start with data quality
    let confidence = 50;
    
    if (observation.dataQuality === 'excellent') confidence += 30;
    else if (observation.dataQuality === 'good') confidence += 15;
    else if (observation.dataQuality === 'limited') confidence -= 15;
    else confidence -= 30;
    
    // Adjust for risk factors
    confidence -= riskFactors.length * 5;
    
    // Adjust for sample size
    if (observation.sampleSize > 100) confidence += 10;
    else if (observation.sampleSize < 10) confidence -= 10;
    
    // Map to level
    if (confidence < 20) return 'very_low';
    if (confidence < 40) return 'low';
    if (confidence < 60) return 'medium';
    if (confidence < 80) return 'high';
    return 'very_high';
  }
  
  private identifyOpportunities(
    observation: PricingObservation,
    request: PricingIntelligenceRequest
  ): string[] {
    const opportunities: string[] = [];
    
    if (observation.customerProfile && observation.customerProfile.totalBookings > 2) {
      opportunities.push('repeat_customer_loyalty');
    }
    
    if (observation.currentDemand === 'high') {
      opportunities.push('high_demand_premium');
    }
    
    if (request.pickupDate && request.deliveryDate) {
      const daysDiff = Math.ceil((request.deliveryDate.getTime() - request.pickupDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 7) {
        opportunities.push('flexible_timing_discount');
      }
    }
    
    if (observation.recentActivity.quotesBooked > observation.recentActivity.quotesGenerated * 0.7) {
      opportunities.push('hot_route_momentum');
    }
    
    return opportunities;
  }
  
  // ==========================================================================
  // STEP 3: GENERATE INTELLIGENCE
  // ==========================================================================
  
  /**
   * Generate Intelligence: Produce insights and evidence WITHOUT applying business rules
   * Benji observes, analyzes, and explains — but does not decide or apply policies
   */
  private generateIntelligence(
    observation: PricingObservation,
    analysis: PricingAnalysis,
    request: PricingIntelligenceRequest
  ): PricingIntelligence {
    // Build structured insights from observations
    const insights = this.buildInsights(observation, analysis, request);
    
    // Calculate overall confidence in observations (data quality assessment)
    const overallConfidence = this.calculateObservationConfidence(analysis, observation);
    
    // Generate human-readable summary
    const summary = this.generateSummary(observation, analysis, insights);
    
    // Generate detailed reasoning components
    const reasoningComponents = this.generateReasoningComponents(
      observation,
      analysis,
      request
    );
    
    // Identify factors for Decision Layer to consider
    const suggestedFactors = this.identifySuggestedFactors(observation, analysis);
    
    return {
      insights,
      overallConfidence,
      dataQuality: observation.dataQuality,
      summary,
      reasoningComponents,
      suggestedFactors,
    };
  }
  
  /**
   * Build structured insights: Evidence-based factors WITHOUT business rule application
   */
  private buildInsights(
    observation: PricingObservation,
    analysis: PricingAnalysis,
    request: PricingIntelligenceRequest
  ): PricingInsight[] {
    const insights: PricingInsight[] = [];
    
    // Insight: Historical price deviation
    if (observation.historicalQuotes.count > 0) {
      insights.push({
        type: 'historical_price_deviation',
        value: analysis.historicalPriceDeviation,
        confidence: observation.dataQuality === 'excellent' ? 'high' : 
                   observation.dataQuality === 'good' ? 'medium' : 'low',
        evidence: `Baseline price is ${Math.abs(analysis.historicalPriceDeviation).toFixed(1)}% ${
          analysis.historicalPriceDeviation > 0 ? 'above' : 'below'
        } historical average of $${observation.historicalQuotes.avgPrice.toFixed(2)} (based on ${
          observation.historicalQuotes.count
        } quotes)`,
        weight: observation.historicalQuotes.count > 20 ? 0.8 : 0.5,
      });
    }
    
    // Insight: Historical conversion rate
    if (observation.historicalQuotes.count > 0) {
      insights.push({
        type: 'historical_conversion_rate',
        value: observation.historicalQuotes.conversionRate,
        confidence: observation.historicalQuotes.count >= 50 ? 'high' :
                   observation.historicalQuotes.count >= 20 ? 'medium' : 'low',
        evidence: `Historical conversion rate for this route is ${
          observation.historicalQuotes.conversionRate.toFixed(1)
        }% (${observation.historicalQuotes.count} quotes)`,
        weight: 0.7,
      });
    }
    
    // Insight: Sample size
    insights.push({
      type: 'historical_sample_size',
      value: observation.sampleSize,
      confidence: observation.sampleSize >= 50 ? 'high' :
                 observation.sampleSize >= 20 ? 'medium' :
                 observation.sampleSize >= 10 ? 'low' : 'very_low',
      evidence: `${observation.sampleSize} historical quotes available for this route`,
      weight: 0.6,
    });
    
    // Insight: Current demand level
    insights.push({
      type: 'current_demand_level',
      value: observation.currentDemand,
      confidence: 'medium', // Simple heuristic for now
      evidence: `Current demand is ${observation.currentDemand} based on active shipment volume`,
      weight: observation.currentDemand === 'high' ? 0.7 : 0.5,
    });
    
    // Insight: Recent booking momentum
    if (observation.recentActivity.quotesGenerated > 0) {
      const recentConversionRate = 
        (observation.recentActivity.quotesBooked / observation.recentActivity.quotesGenerated) * 100;
      insights.push({
        type: 'recent_booking_momentum',
        value: recentConversionRate,
        confidence: observation.recentActivity.quotesGenerated >= 10 ? 'medium' : 'low',
        evidence: `Recent 7-day activity: ${observation.recentActivity.quotesBooked}/${
          observation.recentActivity.quotesGenerated
        } quotes booked (${recentConversionRate.toFixed(1)}%)`,
        weight: recentConversionRate > 70 ? 0.6 : 0.4,
      });
    }
    
    // Insight: Customer loyalty
    if (observation.customerProfile) {
      const isLoyal = observation.customerProfile.totalBookings >= 3;
      insights.push({
        type: 'customer_loyalty',
        value: isLoyal,
        confidence: 'high',
        evidence: `Customer has ${observation.customerProfile.totalBookings} previous bookings`,
        weight: isLoyal ? 0.7 : 0.3,
      });
    }
    
    // Insight: Customer price sensitivity
    if (observation.customerProfile) {
      insights.push({
        type: 'customer_price_sensitivity',
        value: observation.customerProfile.priceRejectionRate,
        confidence: observation.customerProfile.totalQuotesSeen >= 5 ? 'medium' : 'low',
        evidence: `Customer has rejected ${observation.customerProfile.priceRejectionRate.toFixed(1)}% of quotes`,
        weight: 0.5,
      });
    }
    
    // Insight: Data sufficiency
    insights.push({
      type: 'data_sufficiency',
      value: observation.dataQuality,
      confidence: 'high', // We're confident about our data quality assessment
      evidence: `Data quality: ${observation.dataQuality} (${observation.sampleSize} samples)`,
      weight: 1.0, // Always important
    });
    
    // Insight: Route complexity
    const isComplexRoute = request.distanceMiles > 1500 || request.isAccidentRecovery;
    insights.push({
      type: 'route_complexity',
      value: isComplexRoute,
      confidence: 'high',
      evidence: isComplexRoute 
        ? `Complex route: ${request.distanceMiles} miles${request.isAccidentRecovery ? ', accident recovery' : ''}`
        : `Standard route: ${request.distanceMiles} miles`,
      weight: isComplexRoute ? 0.6 : 0.3,
    });
    
    // Insight: Price elasticity
    insights.push({
      type: 'price_elasticity',
      value: analysis.priceElasticity,
      confidence: observation.historicalQuotes.count >= 20 ? 'medium' : 'low',
      evidence: `Price elasticity is ${analysis.priceElasticity} for this route`,
      weight: 0.5,
    });
    
    return insights;
  }
  
  /**
   * Calculate confidence in observations (data quality assessment, NOT business decision)
   */
  private calculateObservationConfidence(
    analysis: PricingAnalysis,
    observation: PricingObservation
  ): number {
    let score = 50; // Start at medium
    
    // Boost for data quality
    if (observation.dataQuality === 'excellent') score += 30;
    else if (observation.dataQuality === 'good') score += 15;
    else if (observation.dataQuality === 'limited') score -= 15;
    else score -= 30;
    
    // Boost for confidence level in analysis
    if (analysis.confidenceLevel === 'very_high') score += 20;
    else if (analysis.confidenceLevel === 'high') score += 10;
    else if (analysis.confidenceLevel === 'low') score -= 10;
    else if (analysis.confidenceLevel === 'very_low') score -= 20;
    
    // Reduce for risks (indicates uncertainty)
    score -= analysis.riskFactors.length * 5;
    
    // Boost for opportunities (indicates strong signal)
    score += analysis.opportunities.length * 3;
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Generate human-readable summary of observations
   */
  private generateSummary(
    observation: PricingObservation,
    analysis: PricingAnalysis,
    _insights: PricingInsight[]
  ): string {
    const parts: string[] = [];
    
    // Data quality statement
    parts.push(`Data quality: ${observation.dataQuality} (${observation.sampleSize} samples).`);
    
    // Historical context
    if (observation.historicalQuotes.count > 0) {
      parts.push(
        `Historical data shows ${observation.historicalQuotes.count} quotes ` +
        `averaging $${observation.historicalQuotes.avgPrice.toFixed(2)} ` +
        `with ${observation.historicalQuotes.conversionRate.toFixed(0)}% conversion.`
      );
    } else {
      parts.push(`This is a new route with no historical data.`);
    }
    
    // Price position
    if (Math.abs(analysis.historicalPriceDeviation) > 5) {
      parts.push(
        `Baseline price is ${Math.abs(analysis.historicalPriceDeviation).toFixed(1)}% ${
          analysis.historicalPriceDeviation > 0 ? 'above' : 'below'
        } historical average.`
      );
    }
    
    // Current conditions
    parts.push(`Current demand: ${observation.currentDemand}.`);
    
    // Key observations
    if (analysis.opportunities.length > 0) {
      parts.push(`Opportunities observed: ${analysis.opportunities.join(', ')}.`);
    }
    
    if (analysis.riskFactors.length > 0) {
      parts.push(`Risk factors: ${analysis.riskFactors.join(', ')}.`);
    }
    
    return parts.join(' ');
  }
  
  /**
   * Identify factors for Decision Layer to consider (NOT business rules)
   */
  private identifySuggestedFactors(
    observation: PricingObservation,
    analysis: PricingAnalysis
  ): string[] {
    const factors: string[] = [];
    
    // Historical deviation factor
    if (Math.abs(analysis.historicalPriceDeviation) > 15 && observation.historicalQuotes.count > 20) {
      factors.push('significant_historical_deviation');
    }
    
    // Demand factors
    if (observation.currentDemand === 'high') {
      factors.push('high_demand_observed');
    } else if (observation.currentDemand === 'low') {
      factors.push('low_demand_observed');
    }
    
    // Customer factors
    if (observation.customerProfile && observation.customerProfile.totalBookings >= 3) {
      factors.push('repeat_customer_detected');
    }
    
    // Conversion factors
    if (observation.historicalQuotes.conversionRate < 30) {
      factors.push('low_conversion_history');
    } else if (observation.historicalQuotes.conversionRate > 70) {
      factors.push('high_conversion_history');
    }
    
    // Momentum factors
    if (observation.recentActivity.quotesBooked > observation.recentActivity.quotesGenerated * 0.7) {
      factors.push('strong_booking_momentum');
    }
    
    // Data quality factors
    if (observation.dataQuality === 'insufficient' || observation.dataQuality === 'limited') {
      factors.push('insufficient_data');
    }
    
    // Risk factors
    if (analysis.riskFactors.length >= 3) {
      factors.push('multiple_risk_factors');
    }
    
    return factors;
  }
  
  // ==========================================================================
  // STEP 4: EXPLAIN (Reasoning Components)
  // ==========================================================================
  
  private generateReasoningComponents(
    observation: PricingObservation,
    analysis: PricingAnalysis,
    _request: PricingIntelligenceRequest
  ): {
    historicalInsight: string;
    demandInsight: string;
    customerInsight: string;
    riskInsight: string;
  } {
    return {
      historicalInsight: observation.historicalQuotes.count > 0
        ? `${observation.historicalQuotes.count} historical quotes averaging $${observation.historicalQuotes.avgPrice.toFixed(2)}`
        : 'No historical data for this route',
      
      demandInsight: `Current demand is ${observation.currentDemand}`,
      
      customerInsight: observation.customerProfile
        ? `Repeat customer with ${observation.customerProfile.totalBookings} bookings`
        : 'New customer',
      
      riskInsight: analysis.riskFactors.length > 0
        ? `${analysis.riskFactors.length} risk factor(s) identified`
        : 'No significant risks',
    };
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  private buildRouteKey(origin: string, destination: string, vehicleType: string): string {
    return `${origin}:${destination}:${vehicleType}`;
  }
  
  private createFallbackOutput(
    _request: PricingIntelligenceRequest,
    processingTimeMs: number
  ): PricingIntelligenceOutput {
    return {
      observation: {
        historicalQuotes: { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, conversionRate: 0 },
        recentActivity: { quotesGenerated: 0, quotesBooked: 0, avgTimeToBooking: 0 },
        currentDemand: 'medium',
        internalMarket: {
          scope: 'network_wide',
          observedAt: new Date().toISOString(),
          verifiedDriverCount: null,
          pendingUnassignedLoadCount: null,
          activeOfferCount: null,
          medianSuggestedCarrierPayout: null,
          recentBidCount: null,
          acceptedBidCount: null,
          medianRecentBidCarrierPayout: null,
          medianAcceptedCarrierPayout: null,
          status: 'unavailable',
          unavailableSources: ['analysis_failed'],
        },
        liveEvidence: {
          traffic: {
            provider: 'google_maps', status: 'error', observedAt: new Date().toISOString(),
            freshUntil: new Date().toISOString(), latencyMs: 0, errorCode: 'ANALYSIS_FAILED',
          },
          tolls: {
            provider: 'here', status: 'error', observedAt: new Date().toISOString(),
            freshUntil: new Date().toISOString(), latencyMs: 0, errorCode: 'ANALYSIS_FAILED',
          },
          weather: {
            provider: 'openweather', status: 'error', observedAt: new Date().toISOString(),
            freshUntil: new Date().toISOString(), latencyMs: 0, errorCode: 'ANALYSIS_FAILED',
          },
          fuel: {
            provider: 'opis', status: 'unavailable', observedAt: new Date().toISOString(),
            freshUntil: new Date().toISOString(), latencyMs: 0, errorCode: 'PROVIDER_NOT_ENABLED',
          },
        },
        dataQuality: 'insufficient',
        sampleSize: 0,
      },
      analysis: {
        baselinePricePosition: 'at_market',
        historicalPriceDeviation: 0,
        estimatedConversionProbability: 50,
        priceElasticity: 'medium',
        riskFactors: ['error_during_analysis'],
        confidenceLevel: 'very_low',
        opportunities: [],
      },
      intelligence: {
        insights: [
          {
            type: 'data_sufficiency',
            value: 'insufficient',
            confidence: 'high',
            evidence: 'Error occurred during analysis',
            weight: 1.0,
          },
        ],
        overallConfidence: 0,
        dataQuality: 'insufficient',
        summary: 'Analysis error occurred. No historical data available.',
        reasoningComponents: {
          historicalInsight: 'Error retrieving data',
          demandInsight: 'Error retrieving data',
          customerInsight: 'Error retrieving data',
          riskInsight: 'Error during analysis',
        },
        suggestedFactors: ['insufficient_data', 'error_occurred'],
      },
      generatedAt: new Date(),
      processingTimeMs,
    };
  }
}

// Export singleton instance
export const benjiPricingIntelligence = new BenjiPricingIntelligence();
