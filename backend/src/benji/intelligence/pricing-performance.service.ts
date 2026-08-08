/**
 * Pricing Performance Tracking Service
 * Phase 3: Operational Memory Infrastructure
 * 
 * Purpose: Calculate and expose pricing performance metrics
 * Pattern: Read from quote_history → Calculate metrics → Return results
 * 
 * INFRASTRUCTURE ONLY (READ-ONLY):
 * - Tracks how baseline vs intelligent pricing performs
 * - Calculates conversion rates, revenue metrics, confidence calibration
 * - Does NOT make decisions or modify policies
 * - Does NOT change pricing behavior
 * - Output only - metrics for observation and analysis
 */

import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';

/**
 * Performance metrics for a cohort of quotes
 */
export interface CohortMetrics {
  total: number;
  booked: number;
  conversionRate: number;
  avgRevenue: number;
  totalRevenue: number;
  avgQuoteValue: number;
}

/**
 * Confidence calibration metrics (how accurate are confidence levels?)
 */
export interface ConfidenceCalibration {
  high: { predicted: number; actual: number; sampleSize: number };
  medium: { predicted: number; actual: number; sampleSize: number };
  low: { predicted: number; actual: number; sampleSize: number };
}

/**
 * Route-level performance breakdown
 */
export interface RoutePerformance {
  routeKey: string;
  routeOrigin: string;
  routeDestination: string;
  vehicleType: string;
  metrics: PerformanceMetrics;
}

/**
 * Complete performance metrics output
 */
export interface PerformanceMetrics {
  timeWindowDays: number;
  periodStart: Date;
  periodEnd: Date;
  
  // Overall Metrics
  totalQuotes: number;
  totalBookings: number;
  overallConversionRate: number;
  totalRevenue: number;
  avgQuoteValue: number;
  
  // Baseline Performance
  baseline: CohortMetrics;
  
  // Intelligent Performance
  intelligent: CohortMetrics;
  
  // Comparison
  conversionRateDiff: number;      // intelligent - baseline (percentage points)
  avgRevenueDiff: number;          // intelligent - baseline (dollars)
  performanceRatio: number;        // intelligent / baseline conversion rate
  
  // Confidence Calibration (intelligent quotes only)
  confidenceCalibration: ConfidenceCalibration;
  
  // Data Quality
  sampleSize: number;
  dataQuality: 'insufficient' | 'limited' | 'good' | 'excellent';
  hasIntelligentData: boolean;
}

/**
 * Quote data from database
 */
interface QuoteRow {
  id: string;
  decision_maker: string;
  was_booked: boolean;
  quoted_price: number;
  booking_price: number | null;
  benji_confidence_score: number | null;
  created_at: string;
  route_origin: string;
  route_destination: string;
  vehicle_type: string;
}

export class PricingPerformanceService {
  /**
   * Get overall performance metrics for a time window
   * READ-ONLY: Does not modify any data or policies
   */
  async getPerformanceMetrics(timeWindowDays: number): Promise<PerformanceMetrics> {
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - timeWindowDays);
    
    try {
      // Query all quotes in time window
      const { data: quotes, error } = await supabaseAdmin
        .from('quote_history')
        .select('*')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString());
      
      if (error) {
        logger.error('Failed to query quotes for performance metrics', {
          timeWindowDays,
          error: error.message,
        });
        throw error;
      }
      
      // Handle empty dataset
      if (!quotes || quotes.length === 0) {
        return this.createEmptyMetrics(timeWindowDays, periodStart, periodEnd);
      }
      
      // Calculate metrics
      const metrics = this.calculateMetrics(quotes, timeWindowDays, periodStart, periodEnd);
      
      logger.info('📊 Performance metrics calculated', {
        timeWindowDays,
        totalQuotes: metrics.totalQuotes,
        baselineConversion: metrics.baseline.conversionRate,
        intelligentConversion: metrics.intelligent.conversionRate,
      });
      
      return metrics;
    } catch (error) {
      logger.error('❌ Failed to calculate performance metrics', {
        timeWindowDays,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  
  /**
   * Get performance metrics for a specific route
   * READ-ONLY: Does not modify any data or policies
   */
  async getRoutePerformance(
    routeKey: string,
    timeWindowDays: number
  ): Promise<PerformanceMetrics> {
    const [origin, destination, vehicleType] = routeKey.split(':');
    
    if (!origin || !destination || !vehicleType) {
      throw new Error(`Invalid routeKey format: ${routeKey}`);
    }
    
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - timeWindowDays);
    
    try {
      // Query quotes for this specific route
      const { data: quotes, error } = await supabaseAdmin
        .from('quote_history')
        .select('*')
        .eq('route_origin', origin)
        .eq('route_destination', destination)
        .eq('vehicle_type', vehicleType)
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString());
      
      if (error) throw error;
      
      if (!quotes || quotes.length === 0) {
        return this.createEmptyMetrics(timeWindowDays, periodStart, periodEnd);
      }
      
      const metrics = this.calculateMetrics(quotes, timeWindowDays, periodStart, periodEnd);
      
      logger.info('📊 Route performance metrics calculated', {
        routeKey,
        timeWindowDays,
        totalQuotes: metrics.totalQuotes,
      });
      
      return metrics;
    } catch (error) {
      logger.error('❌ Failed to calculate route performance', {
        routeKey,
        timeWindowDays,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  
  /**
   * Calculate all performance metrics from quote data
   * Pure calculation - no side effects
   */
  private calculateMetrics(
    quotes: QuoteRow[],
    timeWindowDays: number,
    periodStart: Date,
    periodEnd: Date
  ): PerformanceMetrics {
    // Split by decision maker
    const baselineQuotes = quotes.filter(q => q.decision_maker === 'baseline');
    const intelligentQuotes = quotes.filter(q => q.decision_maker === 'benji_intelligence');
    
    // Calculate cohort metrics
    const baseline = this.calculateCohortMetrics(baselineQuotes);
    const intelligent = this.calculateCohortMetrics(intelligentQuotes);
    
    // Calculate confidence calibration (intelligent quotes only)
    const confidenceCalibration = this.calculateConfidenceCalibration(intelligentQuotes);
    
    // Overall metrics
    const totalQuotes = quotes.length;
    const totalBookings = quotes.filter(q => q.was_booked).length;
    const overallConversionRate = totalQuotes > 0 ? (totalBookings / totalQuotes) * 100 : 0;
    
    const allRevenue = quotes
      .filter(q => q.was_booked)
      .map(q => Number(q.booking_price || q.quoted_price) || 0);
    const totalRevenue = allRevenue.reduce((sum, val) => sum + val, 0);
    
    const allQuoteValues = quotes.map(q => Number(q.quoted_price) || 0);
    const avgQuoteValue = allQuoteValues.length > 0
      ? allQuoteValues.reduce((sum, val) => sum + val, 0) / allQuoteValues.length
      : 0;
    
    // Comparisons
    const conversionRateDiff = intelligent.conversionRate - baseline.conversionRate;
    const avgRevenueDiff = intelligent.avgRevenue - baseline.avgRevenue;
    const performanceRatio = baseline.conversionRate > 0
      ? intelligent.conversionRate / baseline.conversionRate
      : 1;
    
    // Data quality
    const dataQuality = this.assessDataQuality(totalQuotes, intelligentQuotes.length);
    
    return {
      timeWindowDays,
      periodStart,
      periodEnd,
      totalQuotes,
      totalBookings,
      overallConversionRate,
      totalRevenue,
      avgQuoteValue,
      baseline,
      intelligent,
      conversionRateDiff,
      avgRevenueDiff,
      performanceRatio,
      confidenceCalibration,
      sampleSize: totalQuotes,
      dataQuality,
      hasIntelligentData: intelligentQuotes.length > 0,
    };
  }
  
  /**
   * Calculate metrics for a cohort of quotes
   */
  private calculateCohortMetrics(quotes: QuoteRow[]): CohortMetrics {
    const total = quotes.length;
    const bookedQuotes = quotes.filter(q => q.was_booked);
    const booked = bookedQuotes.length;
    const conversionRate = total > 0 ? (booked / total) * 100 : 0;
    
    const revenues = bookedQuotes.map(q => Number(q.booking_price || q.quoted_price) || 0);
    const totalRevenue = revenues.reduce((sum, val) => sum + val, 0);
    const avgRevenue = booked > 0 ? totalRevenue / booked : 0;
    
    const quoteValues = quotes.map(q => Number(q.quoted_price) || 0);
    const avgQuoteValue = total > 0
      ? quoteValues.reduce((sum, val) => sum + val, 0) / total
      : 0;
    
    return {
      total,
      booked,
      conversionRate,
      avgRevenue,
      totalRevenue,
      avgQuoteValue,
    };
  }
  
  /**
   * Calculate confidence calibration (how accurate are confidence predictions?)
   */
  private calculateConfidenceCalibration(quotes: QuoteRow[]): ConfidenceCalibration {
    // Group by confidence level
    const high = quotes.filter(q => 
      q.benji_confidence_score !== null && q.benji_confidence_score >= 70
    );
    const medium = quotes.filter(q =>
      q.benji_confidence_score !== null && 
      q.benji_confidence_score >= 40 && 
      q.benji_confidence_score < 70
    );
    const low = quotes.filter(q =>
      q.benji_confidence_score !== null && q.benji_confidence_score < 40
    );
    
    // Calculate actual booking rates
    const highBooked = high.filter(q => q.was_booked).length;
    const mediumBooked = medium.filter(q => q.was_booked).length;
    const lowBooked = low.filter(q => q.was_booked).length;
    
    return {
      high: {
        predicted: 85,  // High confidence means ~85% expected
        actual: high.length > 0 ? (highBooked / high.length) * 100 : 0,
        sampleSize: high.length,
      },
      medium: {
        predicted: 55,  // Medium confidence means ~55% expected
        actual: medium.length > 0 ? (mediumBooked / medium.length) * 100 : 0,
        sampleSize: medium.length,
      },
      low: {
        predicted: 25,  // Low confidence means ~25% expected
        actual: low.length > 0 ? (lowBooked / low.length) * 100 : 0,
        sampleSize: low.length,
      },
    };
  }
  
  /**
   * Assess data quality based on sample sizes
   */
  private assessDataQuality(
    totalQuotes: number,
    intelligentQuotes: number
  ): 'insufficient' | 'limited' | 'good' | 'excellent' {
    if (totalQuotes === 0) return 'insufficient';
    if (totalQuotes < 20) return 'limited';
    if (totalQuotes < 100) return 'good';
    if (intelligentQuotes < 10) return 'good';  // Downgrade if no intelligent data
    return 'excellent';
  }
  
  /**
   * Create empty metrics response (no data available)
   */
  private createEmptyMetrics(
    timeWindowDays: number,
    periodStart: Date,
    periodEnd: Date
  ): PerformanceMetrics {
    const emptyCohort: CohortMetrics = {
      total: 0,
      booked: 0,
      conversionRate: 0,
      avgRevenue: 0,
      totalRevenue: 0,
      avgQuoteValue: 0,
    };
    
    return {
      timeWindowDays,
      periodStart,
      periodEnd,
      totalQuotes: 0,
      totalBookings: 0,
      overallConversionRate: 0,
      totalRevenue: 0,
      avgQuoteValue: 0,
      baseline: emptyCohort,
      intelligent: emptyCohort,
      conversionRateDiff: 0,
      avgRevenueDiff: 0,
      performanceRatio: 1,
      confidenceCalibration: {
        high: { predicted: 85, actual: 0, sampleSize: 0 },
        medium: { predicted: 55, actual: 0, sampleSize: 0 },
        low: { predicted: 25, actual: 0, sampleSize: 0 },
      },
      sampleSize: 0,
      dataQuality: 'insufficient',
      hasIntelligentData: false,
    };
  }
  
  /**
   * Get performance breakdown by route
   * READ-ONLY: Returns aggregated data for analysis
   */
  async getPerformanceByRoute(timeWindowDays: number): Promise<RoutePerformance[]> {
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - timeWindowDays);
    
    try {
      // Get all quotes
      const { data: quotes, error } = await supabaseAdmin
        .from('quote_history')
        .select('*')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString());
      
      if (error) throw error;
      
      if (!quotes || quotes.length === 0) {
        return [];
      }
      
      // Group by route
      const routeMap = new Map<string, QuoteRow[]>();
      quotes.forEach((quote: QuoteRow) => {
        const key = `${quote.route_origin}:${quote.route_destination}:${quote.vehicle_type}`;
        if (!routeMap.has(key)) {
          routeMap.set(key, []);
        }
        routeMap.get(key)!.push(quote);
      });
      
      // Calculate metrics for each route
      const routePerformances: RoutePerformance[] = [];
      for (const [routeKey, routeQuotes] of routeMap) {
        const [origin, destination, vehicleType] = routeKey.split(':');
        
        if (!origin || !destination || !vehicleType) {
          logger.warn('Skipping route with invalid key format', { routeKey });
          continue;
        }
        
        const metrics = this.calculateMetrics(routeQuotes, timeWindowDays, periodStart, periodEnd);
        
        routePerformances.push({
          routeKey,
          routeOrigin: origin,
          routeDestination: destination,
          vehicleType,
          metrics,
        });
      }
      
      // Sort by total quotes descending
      routePerformances.sort((a, b) => b.metrics.totalQuotes - a.metrics.totalQuotes);
      
      logger.info('📊 Performance by route calculated', {
        totalRoutes: routePerformances.length,
        timeWindowDays,
      });
      
      return routePerformances;
    } catch (error) {
      logger.error('❌ Failed to calculate performance by route', {
        timeWindowDays,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Export singleton instance
export const pricingPerformanceService = new PricingPerformanceService();
