/**
 * Pricing Event Service
 * Phase 2: Knowledge Layer Foundation
 * 
 * Responsible for logging all pricing events to pricing_events table
 * Enables event sourcing, audit trails, and continuous learning
 */

import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';
import type { PricingEvent } from './pricing.events';

export class PricingEventService {
  /**
   * Log a pricing event to the database
   * All pricing events flow through this method for consistency
   */
  async logEvent(event: PricingEvent): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('pricing_events')
        .insert({
          event_type: event.eventType,
          event_version: 1,
          aggregate_id: event.aggregateId,
          aggregate_type: event.aggregateType,
          trace_id: event.traceId,
          user_id: event.userId,
          event_payload: event.payload,
          occurred_at: event.occurredAt.toISOString(),
          recorded_at: new Date().toISOString(),
          source_service: 'pricing_service',
        });
      
      if (error) {
        logger.error('❌ Failed to log pricing event', {
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          error: error.message,
        });
        // Don't throw - event logging failure shouldn't break pricing
        return;
      }
      
      logger.debug('📝 Pricing event logged', {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
      });
    } catch (error) {
      logger.error('❌ Error logging pricing event', {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Fail gracefully - don't break pricing flow
    }
  }
  
  /**
   * Batch log multiple events (for performance)
   * Useful when multiple events are generated in a single operation
   */
  async logEvents(events: PricingEvent[]): Promise<void> {
    if (events.length === 0) return;
    
    try {
      const rows = events.map(event => ({
        event_type: event.eventType,
        event_version: 1,
        aggregate_id: event.aggregateId,
        aggregate_type: event.aggregateType,
        trace_id: event.traceId,
        user_id: event.userId,
        event_payload: event.payload,
        occurred_at: event.occurredAt.toISOString(),
        recorded_at: new Date().toISOString(),
        source_service: 'pricing_service',
      }));
      
      const { error } = await supabaseAdmin
        .from('pricing_events')
        .insert(rows);
      
      if (error) {
        logger.error('❌ Failed to batch log pricing events', {
          count: events.length,
          error: error.message,
        });
        return;
      }
      
      logger.debug('📝 Batch pricing events logged', { count: events.length });
    } catch (error) {
      logger.error('❌ Error batch logging pricing events', {
        count: events.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  /**
   * Query events for a specific aggregate (e.g., all events for a quote)
   * Useful for debugging and audit trails
   */
  async getEventsByAggregate(
    aggregateId: string,
    aggregateType: 'quote' | 'shipment' | 'config'
  ): Promise<PricingEvent[]> {
    const { data, error } = await supabaseAdmin
      .from('pricing_events')
      .select('*')
      .eq('aggregate_id', aggregateId)
      .eq('aggregate_type', aggregateType)
      .order('occurred_at', { ascending: true });
    
    if (error) {
      logger.error('❌ Failed to query pricing events', {
        aggregateId,
        aggregateType,
        error: error.message,
      });
      return [];
    }
    
    interface EventRow {
      event_type: string;
      aggregate_id: string;
      aggregate_type: string;
      trace_id: string | null;
      user_id: string | null;
      occurred_at: string;
      event_payload: any;
    }
    
    return (data || []).map((row: EventRow) => ({
      eventType: row.event_type,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      traceId: row.trace_id,
      userId: row.user_id,
      occurredAt: new Date(row.occurred_at),
      payload: row.event_payload,
    })) as PricingEvent[];
  }
  
  /**
   * Query events by type within a time range
   * Useful for analytics and reporting
   */
  async getEventsByType(
    eventType: string,
    startDate: Date,
    endDate: Date,
    limit: number = 1000
  ): Promise<PricingEvent[]> {
    const { data, error } = await supabaseAdmin
      .from('pricing_events')
      .select('*')
      .eq('event_type', eventType)
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString())
      .order('occurred_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      logger.error('❌ Failed to query pricing events by type', {
        eventType,
        error: error.message,
      });
      return [];
    }
    
    interface EventRow {
      event_type: string;
      aggregate_id: string;
      aggregate_type: string;
      trace_id: string | null;
      user_id: string | null;
      occurred_at: string;
      event_payload: any;
    }
    
    return (data || []).map((row: EventRow) => ({
      eventType: row.event_type,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      traceId: row.trace_id,
      userId: row.user_id,
      occurredAt: new Date(row.occurred_at),
      payload: row.event_payload,
    })) as PricingEvent[];
  }
}

// Export singleton instance
export const pricingEventService = new PricingEventService();
