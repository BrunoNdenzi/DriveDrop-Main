/**
 * Pricing Policy Provider Service
 * Phase 2: Knowledge Layer Foundation
 * 
 * Manages business intelligence policy configuration.
 * Policies control how the Decision Layer applies business rules based on Benji's insights.
 * 
 * Policy Provider Pattern:
 * - Decision Layer consumes policies, does not define them
 * - Policies are treated as configurable data, not implementation logic
 * - Policies are database-backed and admin-configurable
 * - 5-minute in-memory cache reduces database load
 * - Safe fallback defaults if database unavailable
 * 
 * Architecture:
 * - Intelligence Layer (Benji): Provides observations and insights
 * - Policy Provider (This Service): Provides business policy configuration
 * - Decision Layer: Consumes both to make final pricing decisions
 */

import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';

/**
 * Business Intelligence Policy Configuration
 * These policies control how business rules are applied based on intelligence insights
 */
export interface PricingPolicies {
  // Approval Thresholds
  intelligenceMinConfidence: number;              // 0-100: Minimum confidence to use intelligence
  intelligenceMinDataQuality: 'insufficient' | 'limited' | 'good' | 'excellent';
  
  // Historical Alignment Policy
  historicalAlignmentWeight: number;              // 0-1: How much to blend with historical (e.g., 0.3 = 30%)
  historicalDeviationThreshold: number;           // %: Minimum deviation to trigger alignment (e.g., 15)
  historicalMinSampleSize: number;                // Minimum quotes needed to trust historical data
  
  // Demand-Based Adjustment Policy
  demandPremiumPercent: number;                   // %: Premium for high demand (e.g., 5)
  demandDiscountPercent: number;                  // %: Discount for low demand (e.g., 3)
  
  // Customer Loyalty Policy
  loyaltyDiscountPercent: number;                 // %: Discount for repeat customers (e.g., 3)
  
  // Conversion Optimization Policy
  conversionBoostPercent: number;                 // %: Discount for low-conversion routes (e.g., 5)
  
  // Momentum Policy
  momentumPremiumPercent: number;                 // %: Premium for hot routes (e.g., 3)
  
  // Safety Limits
  maxPriceAdjustmentPercent: number;              // %: Max total adjustment from baseline (e.g., 20)
}

/**
 * Raw database row from pricing_config table (policy columns only)
 */
interface PricingConfigPolicyRow {
  intelligence_min_confidence: number;
  intelligence_min_data_quality: string;
  historical_alignment_weight: number;
  historical_deviation_threshold: number;
  historical_min_sample_size: number;
  demand_premium_percent: number;
  demand_discount_percent: number;
  loyalty_discount_percent: number;
  conversion_boost_percent: number;
  momentum_premium_percent: number;
  max_price_adjustment_percent: number;
}

class PricingPolicyService {
  private cachedPolicies: PricingPolicies | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes (matches pricingConfig.service.ts)

  /**
   * Get active pricing policies
   * Uses caching to reduce database calls
   */
  async getActivePolicies(): Promise<PricingPolicies> {
    try {
      // Check cache
      const now = Date.now();
      if (this.cachedPolicies && (now - this.cacheTimestamp) < this.CACHE_TTL) {
        logger.debug('💡 Returning cached pricing policies');
        return this.cachedPolicies;
      }

      // Fetch from database (policy columns from pricing_config table)
      const { data, error } = await supabaseAdmin
        .from('pricing_config')
        .select(`
          intelligence_min_confidence,
          intelligence_min_data_quality,
          historical_alignment_weight,
          historical_deviation_threshold,
          historical_min_sample_size,
          demand_premium_percent,
          demand_discount_percent,
          loyalty_discount_percent,
          conversion_boost_percent,
          momentum_premium_percent,
          max_price_adjustment_percent
        `)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        logger.error('❌ Error fetching pricing policies from database', { error });
        // Return safe defaults if database fails
        return this.getDefaultPolicies();
      }

      if (!data) {
        logger.warn('⚠️ No active pricing policies found, using defaults');
        return this.getDefaultPolicies();
      }

      // Transform database row to PricingPolicies
      const policies = this.transformDbRowToPolicies(data as PricingConfigPolicyRow);
      
      // Update cache
      this.cachedPolicies = policies;
      this.cacheTimestamp = now;
      
      logger.debug('✅ Fetched active pricing policies from database', {
        minConfidence: policies.intelligenceMinConfidence,
        maxAdjustment: policies.maxPriceAdjustmentPercent,
      });
      
      return policies;
    } catch (error) {
      logger.error('❌ Error in getActivePolicies', { error });
      return this.getDefaultPolicies();
    }
  }

  /**
   * Invalidate cache (call after policy updates)
   */
  invalidateCache(): void {
    this.cachedPolicies = null;
    this.cacheTimestamp = 0;
    logger.info('🔄 Pricing policy cache invalidated');
  }

  /**
   * Get default policies (fallback if database is unavailable)
   * These match the Phase 2 approved defaults
   */
  private getDefaultPolicies(): PricingPolicies {
    return {
      // Approval Thresholds
      intelligenceMinConfidence: 50,              // 50% confidence required
      intelligenceMinDataQuality: 'limited',      // At least 'limited' data quality
      
      // Historical Alignment Policy
      historicalAlignmentWeight: 0.3,             // 30% blend with historical
      historicalDeviationThreshold: 15,           // 15% deviation triggers alignment
      historicalMinSampleSize: 20,                // Need 20+ quotes
      
      // Demand-Based Adjustment Policy
      demandPremiumPercent: 5,                    // 5% premium for high demand
      demandDiscountPercent: 3,                   // 3% discount for low demand
      
      // Customer Loyalty Policy
      loyaltyDiscountPercent: 3,                  // 3% discount for loyal customers
      
      // Conversion Optimization Policy
      conversionBoostPercent: 5,                  // 5% discount for low-conversion routes
      
      // Momentum Policy
      momentumPremiumPercent: 3,                  // 3% premium for hot routes
      
      // Safety Limits
      maxPriceAdjustmentPercent: 20,              // Max 20% total adjustment
    };
  }

  /**
   * Transform database row (snake_case) to PricingPolicies (camelCase)
   */
  private transformDbRowToPolicies(row: PricingConfigPolicyRow): PricingPolicies {
    return {
      intelligenceMinConfidence: row.intelligence_min_confidence,
      intelligenceMinDataQuality: row.intelligence_min_data_quality as any,
      historicalAlignmentWeight: row.historical_alignment_weight,
      historicalDeviationThreshold: row.historical_deviation_threshold,
      historicalMinSampleSize: row.historical_min_sample_size,
      demandPremiumPercent: row.demand_premium_percent,
      demandDiscountPercent: row.demand_discount_percent,
      loyaltyDiscountPercent: row.loyalty_discount_percent,
      conversionBoostPercent: row.conversion_boost_percent,
      momentumPremiumPercent: row.momentum_premium_percent,
      maxPriceAdjustmentPercent: row.max_price_adjustment_percent,
    };
  }
}

// Export singleton instance (matches pattern in pricingConfig.service.ts)
export const pricingPolicyService = new PricingPolicyService();
export { PricingPolicyService };
