// src/services/RealtimeService.ts
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { notificationService } from './NotificationService';
import { Database } from '../lib/database.types';

type ShipmentData = Database['public']['Tables']['shipments']['Row'];
type MessageData = Database['public']['Tables']['messages']['Row'];
type TrackingEventData = Database['public']['Tables']['tracking_events']['Row'];

export class RealtimeService {
  private static instance: RealtimeService;
  private shipmentChannels: Map<string, RealtimeChannel> = new Map();
  private profileChannel: RealtimeChannel | null = null;

  private constructor() {}

  public static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  /**
   * Subscribe to changes for a specific shipment
   */
  subscribeToShipment(
    shipmentId: string,
    onShipmentUpdate: (shipment: ShipmentData) => void,
    onNewMessage: (message: MessageData) => void,
    onTrackingEvent: (event: TrackingEventData) => void
  ): RealtimeChannel {
    // Check if we already have a channel for this shipment
    if (this.shipmentChannels.has(shipmentId)) {
      return this.shipmentChannels.get(shipmentId)!;
    }

    // Create a new channel for this shipment
    const channel = supabase.channel(`shipment:${shipmentId}`)
      // Listen for shipment updates
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shipments',
          filter: `id=eq.${shipmentId}`,
        },
        (payload) => {
          console.log('Shipment updated:', payload);
          onShipmentUpdate(payload.new as ShipmentData);
          
          // Check status changes to show notifications
          if (payload.old.status !== payload.new.status) {
            notificationService.sendLocalNotification(
              'Shipment Status Updated',
              `Your shipment is now ${payload.new.status}`,
              {
                type: 'shipment_update',
                shipmentId: shipmentId,
                status: payload.new.status,
              }
            );
          }
        }
      )
      // Listen for new messages
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `shipment_id=eq.${shipmentId}`,
        },
        (payload) => {
          console.log('New message:', payload);
          onNewMessage(payload.new as MessageData);
          
          // Show notification for new message
          notificationService.sendLocalNotification(
            'New Message',
            payload.new.content.substring(0, 100) + (payload.new.content.length > 100 ? '...' : ''),
            {
              type: 'new_message',
              shipmentId: shipmentId,
              messageId: payload.new.id,
            }
          );
        }
      )
      // Listen for tracking events
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tracking_events',
          filter: `shipment_id=eq.${shipmentId}`,
        },
        (payload) => {
          console.log('New tracking event:', payload);
          onTrackingEvent(payload.new as TrackingEventData);
          
          // Show notification for tracking events
          notificationService.sendLocalNotification(
            'Shipment Update',
            `Tracking update: ${payload.new.event_type}` + (payload.new.notes ? ` - ${payload.new.notes}` : ''),
            {
              type: 'tracking_event',
              shipmentId: shipmentId,
              eventId: payload.new.id,
              eventType: payload.new.event_type,
            }
          );
        }
      )
      .subscribe();

    // Store the channel for later reference
    this.shipmentChannels.set(shipmentId, channel);
    
    return channel;
  }

  /**
   * Unsubscribe from a shipment
   */
  unsubscribeFromShipment(shipmentId: string): void {
    const channel = this.shipmentChannels.get(shipmentId);
    if (channel) {
      supabase.removeChannel(channel);
      this.shipmentChannels.delete(shipmentId);
    }
  }

  /**
   * Subscribe to user profile changes
   */
  subscribeToProfile(
    userId: string,
    onProfileUpdate: (profile: any) => void
  ): RealtimeChannel {
    if (this.profileChannel) {
      supabase.removeChannel(this.profileChannel);
    }

    this.profileChannel = supabase.channel(`profile:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          console.log('Profile updated:', payload);
          onProfileUpdate(payload.new);
        }
      )
      .subscribe();

    return this.profileChannel;
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll(): void {
    // Remove all shipment channels
    this.shipmentChannels.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    this.shipmentChannels.clear();

    // Remove profile channel
    if (this.profileChannel) {
      supabase.removeChannel(this.profileChannel);
      this.profileChannel = null;
    }
  }
}

// Export singleton instance
export const realtimeService = RealtimeService.getInstance();
