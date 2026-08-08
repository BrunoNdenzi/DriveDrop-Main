/**
 * Pricing Feedback Recording Service
 * Phase 3: Operational Memory Infrastructure
 * 
 * Purpose: Record operational feedback events for future analysis
 * Pattern: Write-only event logging to pricing_events table
 * 
 * INFRASTRUCTURE ONLY (WRITE-ONLY):
 * - Records when quotes are accepted/rejected
 * - Records when shipments complete with actual costs
 * - Records periodic performance snapshots
 * - Does NOT analyze feedback or make decisions
 * - Does NOT modify policies or pricing behavior
 * - Pure event recording for operational memory
 */

import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';
import type { PerformanceMetrics } from './pricing-performance.service';

/**
 * Quote outcome event data
 */
export interface QuoteOutcome {
  quoteId: string;
  wasBooked: boolean;
  timeToBooking?: number;  // milliseconds
  bookingPrice?: number;
  shipmentId?: string;
}

/**
 * Shipment outcome event data
 */
export interface ShipmentOutcome {
  shipmentId: string;
  quoteId?: string;
  actualCost: number;
  actualRevenue: number;
  profitMargin: number;
  completedAt: Date;
}

/**
 * Performance snapshot event data
 */
export interface PerformanceSnapshot {
  snapshotDate: Date;
  timeWindowDays: number;
  metrics: PerformanceMetrics;
}

export class PricingFeedbackService {
  /**
   * Record quote outcome (booked or rejected)
   * WRITE-ONLY: Logs event, does not analyze or act on it
   */
  async recordQuoteOutcome(outcome: QuoteOutcome): Promise<void> {
    try {
      // Update quote_history record
      const { error: updateError } = await supabaseAdmin
        .from('quote_history')
        .update({
          was_booked: outcome.wasBooked,
          ...(outcome.wasBooked && {
            booked_at: new Date().toISOString(),
            time_to_booking_ms: outcome.timeToBooking || null,
            booking_price: outcome.bookingPrice || null,
            shipment_id: outcome.shipmentId || null,
          }),
        })
        .eq('id', outcome.quoteId);
      
      if (updateError) {
        logger.error('Failed to update quote_history with outcome', {
          quoteId: outcome.quoteId,
          error: updateError.message,
        });
        throw updateError;
      }
      
      // Log event to pricing_events
      const { error: eventError } = await supabaseAdmin
        .from('pricing_events')
        .insert({
          event_type: outcome.wasBooked ? 'quote_accepted' : 'quote_rejected',
          aggregate_id: outcome.quoteId,
          aggregate_type: 'quote',
          event_payload: {
            was_booked: outcome.wasBooked,
            time_to_booking_ms: outcome.timeToBooking,
            booking_price: outcome.bookingPrice,
            shipment_id: outcome.shipmentId,
          },
          source_service: 'pricing_feedback_service',
        });
      
      if (eventError) {
        logger.error('Failed to log quote outcome event', {
          quoteId: outcome.quoteId,
          error: eventError.message,
        });
        // Don't throw - outcome was already recorded in quote_history
      }
      
      logger.info('📝 Quote outcome recorded', {
        quoteId: outcome.quoteId,
        wasBooked: outcome.wasBooked,
      });
    } catch (error) {
      logger.error('❌ Failed to record quote outcome', {
        quoteId: outcome.quoteId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  
  /**
   * Record shipment outcome (actual costs and revenue)
   * WRITE-ONLY: Logs event, does not analyze or act on it
   */
  async recordShipmentOutcome(outcome: ShipmentOutcome): Promise<void> {
    try {
      // Log event to pricing_events
      const { error } = await supabaseAdmin
        .from('pricing_events')
        .insert({
          event_type: 'shipment_completed',
          aggregate_id: outcome.shipmentId,
          aggregate_type: 'shipment',
          event_payload: {
            quote_id: outcome.quoteId,
            actual_cost: outcome.actualCost,
            actual_revenue: outcome.actualRevenue,
            profit_margin: outcome.profitMargin,
            completed_at: outcome.completedAt.toISOString(),
          },
          source_service: 'pricing_feedback_service',
        });
      
      if (error) {
        logger.error('Failed to log shipment outcome event', {
          shipmentId: outcome.shipmentId,
          error: error.message,
        });
        throw error;
      }
      
      logger.info('📝 Shipment outcome recorded', {
        shipmentId: outcome.shipmentId,
        profitMargin: outcome.profitMargin,
      });
    } catch (error) {
      logger.error('❌ Failed to record shipment outcome', {
        shipmentId: outcome.shipmentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  
  /**
   * Record performance snapshot (periodic aggregated metrics)
   * WRITE-ONLY: Logs snapshot, does not analyze or act on it
   */
  async recordPerformanceSnapshot(snapshot: PerformanceSnapshot): Promise<void> {
    try {
      // Insert into pricing_performance_snapshots table
      const { error: snapshotError } = await supabaseAdmin
        .from('pricing_performance_snapshots')
        .insert({
          snapshot_date: snapshot.snapshotDate.toISOString().split('T')[0],
          time_window_days: snapshot.timeWindowDays,
          total_quotes: snapshot.metrics.totalQuotes,
          baseline_quotes: snapshot.metrics.baseline.total,
          intelligent_quotes: snapshot.metrics.intelligent.total,
          total_bookings: snapshot.metrics.totalBookings,
          baseline_bookings: snapshot.metrics.baseline.booked,
          intelligent_bookings: snapshot.metrics.intelligent.booked,
          overall_conversion_rate: snapshot.metrics.overallConversionRate,
          baseline_conversion_rate: snapshot.metrics.baseline.conversionRate,
          intelligent_conversion_rate: snapshot.metrics.intelligent.conversionRate,
          total_revenue: snapshot.metrics.totalRevenue,
          avg_quote_value: snapshot.metrics.avgQuoteValue,
          baseline_avg_revenue: snapshot.metrics.baseline.avgRevenue,
          intelligent_avg_revenue: snapshot.metrics.intelligent.avgRevenue,
          high_confidence_accuracy: snapshot.metrics.confidenceCalibration.high.actual,
          medium_confidence_accuracy: snapshot.metrics.confidenceCalibration.medium.actual,
          low_confidence_accuracy: snapshot.metrics.confidenceCalibration.low.actual,
        });
      
      if (snapshotError) {
        logger.error('Failed to insert performance snapshot', {
          snapshotDate: snapshot.snapshotDate,
          error: snapshotError.message,
        });
        throw snapshotError;
      }
      
      // Log event to pricing_events
      const { error: eventError } = await supabaseAdmin
        .from('pricing_events')
        .insert({
          event_type: 'performance_snapshot_recorded',
          aggregate_id: crypto.randomUUID(),
          aggregate_type: 'system',
          event_payload: {
            snapshot_date: snapshot.snapshotDate.toISOString(),
            time_window_days: snapshot.timeWindowDays,
            total_quotes: snapshot.metrics.totalQuotes,
            overall_conversion_rate: snapshot.metrics.overallConversionRate,
            baseline_conversion_rate: snapshot.metrics.baseline.conversionRate,
            intelligent_conversion_rate: snapshot.metrics.intelligent.conversionRate,
            data_quality: snapshot.metrics.dataQuality,
          },
          source_service: 'pricing_feedback_service',
        });
      
      if (eventError) {
        logger.error('Failed to log performance snapshot event', {
          snapshotDate: snapshot.snapshotDate,
          error: eventError.message,
        });
        // Don't throw - snapshot was already recorded
      }
      
      logger.info('📝 Performance snapshot recorded', {
        snapshotDate: snapshot.snapshotDate,
        totalQuotes: snapshot.metrics.totalQuotes,
        overallConversionRate: snapshot.metrics.overallConversionRate,
      });
    } catch (error) {
      logger.error('❌ Failed to record performance snapshot', {
        snapshotDate: snapshot.snapshotDate,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  
  /**
   * Record config change event (when admin manually updates pricing_config)
   * WRITE-ONLY: Logs event for audit trail
   */
  async recordConfigChange(
    field: string,
    oldValue: any,
    newValue: any,
    changedBy?: string
  ): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('pricing_events')
        .insert({
          event_type: 'config_changed',
          aggregate_id: crypto.randomUUID(),
          aggregate_type: 'config',
          event_payload: {
            field,
            old_value: oldValue,
            new_value: newValue,
            changed_by: changedBy,
            change_type: 'manual_admin',
          },
          source_service: 'pricing_feedback_service',
          user_id: changedBy,
        });
      
      if (error) {
        logger.error('Failed to log config change event', {
          field,
          error: error.message,
        });
        throw error;
      }
      
      logger.info('📝 Config change recorded', {
        field,
        oldValue,
        newValue,
      });
    } catch (error) {
      logger.error('❌ Failed to record config change', {
        field,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  
  /**
   * Batch record multiple quote outcomes
   * WRITE-ONLY: Efficient bulk logging
   */
  async recordQuoteOutcomesBatch(outcomes: QuoteOutcome[]): Promise<void> {
    logger.info(`📝 Recording ${outcomes.length} quote outcomes in batch`);
    
    const results = {
      success: 0,
      failed: 0,
    };
    
    for (const outcome of outcomes) {
      try {
        await this.recordQuoteOutcome(outcome);
        results.success++;
      } catch (error) {
        results.failed++;
        logger.error('Failed to record quote outcome in batch', {
          quoteId: outcome.quoteId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next outcome
      }
    }
    
    logger.info('📝 Batch quote outcome recording complete', results);
  }
  
  /**
   * Record intelligence fallback event (when intelligence fails and baseline is used)
   * WRITE-ONLY: Logs event for reliability monitoring
   */
  async recordIntelligenceFallback(
    quoteId: string,
    reason: string,
    error?: string
  ): Promise<void> {
    try {
      const { error: eventError } = await supabaseAdmin
        .from('pricing_events')
        .insert({
          event_type: 'intelligence_fallback',
          aggregate_id: quoteId,
          aggregate_type: 'quote',
          event_payload: {
            reason,
            error,
            fallback_to: 'baseline',
          },
          source_service: 'pricing_feedback_service',
        });
      
      if (eventError) {
        logger.error('Failed to log intelligence fallback event', {
          quoteId,
          error: eventError.message,
        });
        // Don't throw - this is just logging
      }
      
      logger.warn('⚠️ Intelligence fallback recorded', {
        quoteId,
        reason,
      });
    } catch (error) {
      logger.error('❌ Failed to record intelligence fallback', {
        quoteId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - this is logging only
    }
  }
}

// Export singleton instance
export const pricingFeedbackService = new PricingFeedbackService();
