/**
 * Pricing Analytics Aggregation Service
 * Phase 3: Operational Memory Infrastructure
 * 
 * Purpose: Aggregate quote_history data into route_analytics table
 * Pattern: Read from quote_history → Calculate metrics → Write to route_analytics
 * 
 * INFRASTRUCTURE ONLY:
 * - Aggregates historical data for fast query access
 * - Populates route_analytics table with pre-calculated metrics
 * - Does NOT modify pricing behavior or business policies
 * - Read-only from quote_history, write-only to route_analytics
 * 
 * Update Strategy:
 * - Backfill: One-time historical aggregation on initial deploy
 * - Incremental: Update on new quote events (called by event handlers)
 * - Batch: Daily reconciliation job to ensure consistency
 */

import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';

/**
 * Route analytics data structure (matches route_analytics table)
 */
export interface RouteAnalytics {
  routeKey: string;
  routeOrigin: string;
  routeDestination: string;
  vehicleType: string;
  timePeriod: string;
  periodStart: Date;
  periodEnd: Date;
  
  // Volume Metrics
  totalQuotes: number;
  totalBookings: number;
  conversionRate: number;
  
  // Pricing Metrics
  avgQuotedPrice: number;
  minQuotedPrice: number;
  maxQuotedPrice: number;
  stdDevPrice: number;
  
  // Baseline vs Intelligent Split
  baselineQuotes: number;
  intelligentQuotes: number;
  avgBaselinePrice: number;
  avgIntelligentPrice: number;
  
  // Revenue Metrics
  totalRevenue: number;
  avgRevenuePerQuote: number;
  revenuePerBooking: number;
  
  // Timing Metrics
  avgTimeToBookingMs: number;
  
  // Data Quality
  sampleSize: number;
  dataQuality: 'insufficient' | 'limited' | 'good' | 'excellent';
}

/**
 * Time period types for aggregation
 */
export type TimePeriodType = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';



export class PricingAnalyticsService {
  /**
   * Aggregate route performance for a specific route and time period
   * Updates or inserts into route_analytics table
   */
  async aggregateRoutePerformance(
    routeKey: string,
    timePeriod: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<void> {
    const [origin, destination, vehicleType] = routeKey.split(':');
    
    if (!origin || !destination || !vehicleType) {
      throw new Error(`Invalid routeKey format: ${routeKey}. Expected format: origin:destination:vehicleType`);
    }
    
    try {
      // Query quote_history for this route + time period
      const { data, error } = await supabaseAdmin
        .from('quote_history')
        .select('*')
        .eq('route_origin', origin)
        .eq('route_destination', destination)
        .eq('vehicle_type', vehicleType)
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString());
      
      if (error) {
        logger.error('Failed to query quote_history for aggregation', {
          routeKey,
          timePeriod,
          error: error.message,
        });
        throw error;
      }
      
      // If no data, insert empty analytics record
      if (!data || data.length === 0) {
        await this.upsertRouteAnalytics({
          routeKey,
          routeOrigin: origin,
          routeDestination: destination,
          vehicleType,
          timePeriod,
          periodStart,
          periodEnd,
          totalQuotes: 0,
          totalBookings: 0,
          conversionRate: 0,
          avgQuotedPrice: 0,
          minQuotedPrice: 0,
          maxQuotedPrice: 0,
          stdDevPrice: 0,
          baselineQuotes: 0,
          intelligentQuotes: 0,
          avgBaselinePrice: 0,
          avgIntelligentPrice: 0,
          totalRevenue: 0,
          avgRevenuePerQuote: 0,
          revenuePerBooking: 0,
          avgTimeToBookingMs: 0,
          sampleSize: 0,
          dataQuality: 'insufficient',
        });
        return;
      }
      
      // Calculate aggregated metrics
      const analytics = this.calculateAggregates(data, routeKey, timePeriod, periodStart, periodEnd);
      
      // Upsert into route_analytics table
      await this.upsertRouteAnalytics(analytics);
      
      logger.info('✅ Route analytics aggregated successfully', {
        routeKey,
        timePeriod,
        totalQuotes: analytics.totalQuotes,
        conversionRate: analytics.conversionRate,
      });
    } catch (error) {
      logger.error('❌ Failed to aggregate route analytics', {
        routeKey,
        timePeriod,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  
  /**
   * Calculate aggregated metrics from raw quote data
   */
  private calculateAggregates(
    quotes: any[],
    routeKey: string,
    timePeriod: string,
    periodStart: Date,
    periodEnd: Date
  ): RouteAnalytics {
    const [origin, destination, vehicleType] = routeKey.split(':');
    
    if (!origin || !destination || !vehicleType) {
      throw new Error(`Invalid routeKey format: ${routeKey}`);
    }
    
    // Basic counts
    const totalQuotes = quotes.length;
    const bookedQuotes = quotes.filter(q => q.was_booked);
    const totalBookings = bookedQuotes.length;
    const conversionRate = totalQuotes > 0 ? (totalBookings / totalQuotes) * 100 : 0;
    
    // Pricing metrics
    const prices = quotes.map(q => Number(q.quoted_price) || 0);
    const avgQuotedPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const minQuotedPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxQuotedPrice = prices.length > 0 ? Math.max(...prices) : 0;
    
    // Standard deviation
    const mean = avgQuotedPrice;
    const squareDiffs = prices.map(p => Math.pow(p - mean, 2));
    const avgSquareDiff = squareDiffs.length > 0 ? squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length : 0;
    const stdDevPrice = Math.sqrt(avgSquareDiff);
    
    // Baseline vs Intelligent split
    const baselineQuotes = quotes.filter(q => q.decision_maker === 'baseline');
    const intelligentQuotes = quotes.filter(q => q.decision_maker === 'benji_intelligence');
    
    const baselinePrices = baselineQuotes.map(q => Number(q.quoted_price) || 0);
    const intelligentPrices = intelligentQuotes.map(q => Number(q.quoted_price) || 0);
    
    const avgBaselinePrice = baselinePrices.length > 0
      ? baselinePrices.reduce((a, b) => a + b, 0) / baselinePrices.length
      : 0;
    
    const avgIntelligentPrice = intelligentPrices.length > 0
      ? intelligentPrices.reduce((a, b) => a + b, 0) / intelligentPrices.length
      : 0;
    
    // Revenue metrics
    const bookedPrices = bookedQuotes.map(q => Number(q.booking_price || q.quoted_price) || 0);
    const totalRevenue = bookedPrices.reduce((a, b) => a + b, 0);
    const avgRevenuePerQuote = totalQuotes > 0 ? totalRevenue / totalQuotes : 0;
    const revenuePerBooking = totalBookings > 0 ? totalRevenue / totalBookings : 0;
    
    // Timing metrics
    const timeToBookings = bookedQuotes
      .filter(q => q.time_to_booking_ms !== null)
      .map(q => Number(q.time_to_booking_ms) || 0);
    const avgTimeToBookingMs = timeToBookings.length > 0
      ? timeToBookings.reduce((a, b) => a + b, 0) / timeToBookings.length
      : 0;
    
    // Data quality assessment
    const dataQuality = this.assessDataQuality(totalQuotes);
    
    return {
      routeKey,
      routeOrigin: origin,
      routeDestination: destination,
      vehicleType,
      timePeriod,
      periodStart,
      periodEnd,
      totalQuotes,
      totalBookings,
      conversionRate,
      avgQuotedPrice,
      minQuotedPrice,
      maxQuotedPrice,
      stdDevPrice,
      baselineQuotes: baselineQuotes.length,
      intelligentQuotes: intelligentQuotes.length,
      avgBaselinePrice,
      avgIntelligentPrice,
      totalRevenue,
      avgRevenuePerQuote,
      revenuePerBooking,
      avgTimeToBookingMs,
      sampleSize: totalQuotes,
      dataQuality,
    };
  }
  
  /**
   * Assess data quality based on sample size
   */
  private assessDataQuality(sampleSize: number): 'insufficient' | 'limited' | 'good' | 'excellent' {
    if (sampleSize === 0) return 'insufficient';
    if (sampleSize < 10) return 'limited';
    if (sampleSize < 50) return 'good';
    return 'excellent';
  }
  
  /**
   * Upsert analytics into route_analytics table
   */
  private async upsertRouteAnalytics(analytics: RouteAnalytics): Promise<void> {
    const { error } = await supabaseAdmin
      .from('route_analytics')
      .upsert({
        route_key: analytics.routeKey,
        route_origin: analytics.routeOrigin,
        route_destination: analytics.routeDestination,
        vehicle_type: analytics.vehicleType,
        time_period: analytics.timePeriod,
        period_start: analytics.periodStart.toISOString().split('T')[0], // DATE format
        period_end: analytics.periodEnd.toISOString().split('T')[0],
        total_quotes: analytics.totalQuotes,
        total_bookings: analytics.totalBookings,
        conversion_rate: analytics.conversionRate,
        avg_quoted_price: analytics.avgQuotedPrice,
        min_quoted_price: analytics.minQuotedPrice,
        max_quoted_price: analytics.maxQuotedPrice,
        stddev_price: analytics.stdDevPrice,
        baseline_quotes: analytics.baselineQuotes,
        intelligent_quotes: analytics.intelligentQuotes,
        avg_baseline_price: analytics.avgBaselinePrice,
        avg_intelligent_price: analytics.avgIntelligentPrice,
        total_revenue: analytics.totalRevenue,
        avg_revenue_per_quote: analytics.avgRevenuePerQuote,
        revenue_per_booking: analytics.revenuePerBooking,
        avg_time_to_booking_ms: analytics.avgTimeToBookingMs,
        sample_size: analytics.sampleSize,
        data_quality: analytics.dataQuality,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'route_key,time_period',
      });
    
    if (error) {
      logger.error('Failed to upsert route_analytics', {
        routeKey: analytics.routeKey,
        error: error.message,
      });
      throw error;
    }
  }
  
  /**
   * Get route analytics for a specific route and time period
   * Reads from route_analytics table (fast cached aggregates)
   */
  async getRouteAnalytics(routeKey: string, timePeriod: string): Promise<RouteAnalytics | null> {
    const { data, error } = await supabaseAdmin
      .from('route_analytics')
      .select('*')
      .eq('route_key', routeKey)
      .eq('time_period', timePeriod)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No data found - return null (not an error)
        return null;
      }
      logger.error('Failed to retrieve route analytics', {
        routeKey,
        timePeriod,
        error: error.message,
      });
      throw error;
    }
    
    return this.mapDatabaseRowToAnalytics(data);
  }
  
  /**
   * Backfill all route analytics for a given time period
   * Run once on initial deploy or when recalculation needed
   */
  async backfillRouteAnalytics(periodStart: Date, periodEnd: Date, timePeriodType: TimePeriodType = 'month'): Promise<void> {
    logger.info('🔄 Starting route analytics backfill', {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      timePeriodType,
    });
    
    try {
      // Get distinct routes from quote_history
      const { data: routes, error } = await supabaseAdmin
        .from('quote_history')
        .select('route_origin, route_destination, vehicle_type')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString());
      
      if (error) throw error;
      
      if (!routes || routes.length === 0) {
        logger.warn('⚠️ No quote data found for backfill period');
        return;
      }
      
      // Get unique route keys
      const uniqueRoutes = new Set<string>();
      routes.forEach((r: any) => {
        const key = `${r.route_origin}:${r.route_destination}:${r.vehicle_type}`;
        uniqueRoutes.add(key);
      });
      
      logger.info(`📊 Found ${uniqueRoutes.size} unique routes to aggregate`);
      
      // Aggregate each route
      let successCount = 0;
      let failCount = 0;
      
      for (const routeKey of uniqueRoutes) {
        try {
          await this.aggregateRoutePerformance(
            routeKey,
            this.formatTimePeriod(periodStart, timePeriodType),
            periodStart,
            periodEnd
          );
          successCount++;
        } catch (error) {
          logger.error(`Failed to aggregate route: ${routeKey}`, {
            error: error instanceof Error ? error.message : String(error),
          });
          failCount++;
        }
      }
      
      logger.info('✅ Route analytics backfill complete', {
        total: uniqueRoutes.size,
        success: successCount,
        failed: failCount,
      });
    } catch (error) {
      logger.error('❌ Route analytics backfill failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  
  /**
   * Format time period string based on date and type
   */
  private formatTimePeriod(date: Date, type: TimePeriodType): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    switch (type) {
      case 'day':
        return `${year}-${month}-${day}`;
      case 'week':
        const weekNum = this.getWeekNumber(date);
        return `${year}-W${String(weekNum).padStart(2, '0')}`;
      case 'month':
        return `${year}-${month}`;
      case 'quarter':
        const quarter = Math.floor((date.getMonth() + 3) / 3);
        return `${year}-Q${quarter}`;
      case 'year':
        return `${year}`;
      case 'all':
        return 'all-time';
      default:
        return `${year}-${month}`;
    }
  }
  
  /**
   * Get ISO week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
  
  /**
   * Map database row to RouteAnalytics interface
   */
  private mapDatabaseRowToAnalytics(row: any): RouteAnalytics {
    return {
      routeKey: row.route_key,
      routeOrigin: row.route_origin,
      routeDestination: row.route_destination,
      vehicleType: row.vehicle_type,
      timePeriod: row.time_period,
      periodStart: new Date(row.period_start),
      periodEnd: new Date(row.period_end),
      totalQuotes: row.total_quotes,
      totalBookings: row.total_bookings,
      conversionRate: Number(row.conversion_rate),
      avgQuotedPrice: Number(row.avg_quoted_price),
      minQuotedPrice: Number(row.min_quoted_price),
      maxQuotedPrice: Number(row.max_quoted_price),
      stdDevPrice: Number(row.stddev_price),
      baselineQuotes: row.baseline_quotes,
      intelligentQuotes: row.intelligent_quotes,
      avgBaselinePrice: Number(row.avg_baseline_price),
      avgIntelligentPrice: Number(row.avg_intelligent_price),
      totalRevenue: Number(row.total_revenue),
      avgRevenuePerQuote: Number(row.avg_revenue_per_quote),
      revenuePerBooking: Number(row.revenue_per_booking),
      avgTimeToBookingMs: Number(row.avg_time_to_booking_ms),
      sampleSize: row.sample_size,
      dataQuality: row.data_quality,
    };
  }
}

// Export singleton instance
export const pricingAnalyticsService = new PricingAnalyticsService();
