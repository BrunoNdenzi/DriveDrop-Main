// src/services/RealtimeService.ts
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { notificationService } from './NotificationService';
import { Database } from '../lib/database.types';
import * as Location from 'expo-location';

type ShipmentData = Database['public']['Tables']['shipments']['Row'];
type MessageData = Database['public']['Tables']['messages']['Row'];
type TrackingEventData = Database['public']['Tables']['tracking_events']['Row'];

// Driver location data structure
export interface DriverLocation {
  shipment_id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  location_timestamp: string;
}

export class RealtimeService {
  private static instance: RealtimeService;
  private shipmentChannels: Map<string, RealtimeChannel> = new Map();
  private profileChannel: RealtimeChannel | null = null;
  private locationChannel: RealtimeChannel | null = null;
  private locationUpdateInterval: NodeJS.Timeout | null = null;
  private currentShipmentId: string | null = null;

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
    onTrackingEvent: (event: TrackingEventData) => void,
    onDriverLocationUpdate?: (location: DriverLocation) => void
  ): RealtimeChannel {
    // Check if we already have a channel for this shipment
    if (this.shipmentChannels.has(shipmentId)) {
      return this.shipmentChannels.get(shipmentId)!;
    }

    // Create a new channel for this shipment
    const channel = supabase
      .channel(`shipment:${shipmentId}`)
      // Listen for shipment updates
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shipments',
          filter: `id=eq.${shipmentId}`,
        },
        payload => {
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
        payload => {
          console.log('New message:', payload);
          onNewMessage(payload.new as MessageData);

          // Show notification for new message
          notificationService.sendLocalNotification(
            'New Message',
            payload.new.content.substring(0, 100) +
              (payload.new.content.length > 100 ? '...' : ''),
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
        payload => {
          console.log('New tracking event:', payload);
          onTrackingEvent(payload.new as TrackingEventData);

          // Show notification for tracking events
          notificationService.sendLocalNotification(
            'Shipment Update',
            `Tracking update: ${payload.new.event_type}` +
              (payload.new.notes ? ` - ${payload.new.notes}` : ''),
            {
              type: 'tracking_event',
              shipmentId: shipmentId,
              eventId: payload.new.id,
              eventType: payload.new.event_type,
            }
          );
        }
      );

    // If driver location update callback is provided, listen for driver location updates
    if (onDriverLocationUpdate) {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_locations',
          filter: `shipment_id=eq.${shipmentId}`,
        },
        payload => {
          console.log('Driver location updated:', payload);
          onDriverLocationUpdate(payload.new as DriverLocation);
        }
      );
    }

    channel.subscribe();

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

    this.profileChannel = supabase
      .channel(`profile:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        payload => {
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
    this.shipmentChannels.forEach(channel => {
      supabase.removeChannel(channel);
    });
    this.shipmentChannels.clear();

    // Remove profile channel
    if (this.profileChannel) {
      supabase.removeChannel(this.profileChannel);
      this.profileChannel = null;
    }

    // Stop location tracking
    this.stopLocationTracking();

    // Remove location channel
    if (this.locationChannel) {
      supabase.removeChannel(this.locationChannel);
      this.locationChannel = null;
    }
  }

  /**
   * Start tracking driver location for a specific shipment
   * @param shipmentId The ID of the shipment being delivered
   * @param driverId The ID of the driver
   * @param onPermissionDenied Callback when location permissions are denied
   */
  async startLocationTracking(
    shipmentId: string,
    driverId: string,
    onPermissionDenied?: () => void
  ): Promise<boolean> {
    try {
      // Save the current shipment ID
      this.currentShipmentId = shipmentId;

      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        console.log('Location permission denied');
        if (onPermissionDenied) {
          onPermissionDenied();
        }
        return false;
      }

      // Start watching position
      this.locationUpdateInterval = setInterval(async () => {
        try {
          // Skip if no current shipment
          if (!this.currentShipmentId) return;

          // Get current location
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          // Send to Supabase
          await supabase.from('driver_locations').insert({
            shipment_id: this.currentShipmentId,
            driver_id: driverId,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading || null,
            speed: location.coords.speed || null,
            accuracy: location.coords.accuracy || null,
            location_timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error('Error updating location:', error);
        }
      }, 30000); // Update every 30 seconds

      return true;
    } catch (error) {
      console.error('Error setting up location tracking:', error);
      return false;
    }
  }

  /**
   * Stop tracking driver location
   */
  stopLocationTracking(): void {
    if (this.locationUpdateInterval) {
      clearInterval(this.locationUpdateInterval);
      this.locationUpdateInterval = null;
    }
    this.currentShipmentId = null;
  }

  /**
   * Subscribe to driver location updates for a specific shipment
   * This is used by clients to track the driver's location
   */
  subscribeToDriverLocation(
    shipmentId: string,
    onLocationUpdate: (location: DriverLocation) => void
  ): RealtimeChannel {
    if (this.locationChannel) {
      supabase.removeChannel(this.locationChannel);
    }

    this.locationChannel = supabase
      .channel(`driver-location:${shipmentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_locations',
          filter: `shipment_id=eq.${shipmentId}`,
        },
        payload => {
          console.log('Driver location update:', payload);
          onLocationUpdate(payload.new as DriverLocation);
        }
      )
      .subscribe();

    return this.locationChannel;
  }

  /**
   * Unsubscribe from driver location updates
   */
  unsubscribeFromDriverLocation(): void {
    if (this.locationChannel) {
      supabase.removeChannel(this.locationChannel);
      this.locationChannel = null;
    }
  }
}

// Export singleton instance
export const realtimeService = RealtimeService.getInstance();
