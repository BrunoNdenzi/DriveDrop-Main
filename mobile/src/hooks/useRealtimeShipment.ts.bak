// src/hooks/useRealtimeShipment.ts
import { useEffect, useState } from 'react';
import { realtimeService } from '../services/RealtimeService';
import { Database } from '../lib/database.types';
import { RealtimeChannel } from '@supabase/supabase-js';

// Type definitions
type ShipmentData = Database['public']['Tables']['shipments']['Row'];
type MessageData = Database['public']['Tables']['messages']['Row'];
type TrackingEventData = Database['public']['Tables']['tracking_events']['Row'];
type DriverLocation = {
  shipment_id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  location_timestamp: string;
};

/**
 * Hook for subscribing to real-time shipment updates
 *
 * @param shipmentId The ID of the shipment to subscribe to
 * @returns Object containing the latest shipment data, messages, tracking events, and driver location
 *
 * @example
 * ```tsx
 * // In a shipment details component:
 * const {
 *   shipment,
 *   messages,
 *   trackingEvents,
 *   driverLocation
 * } = useRealtimeShipment(shipmentId);
 *
 * // shipment will update in real-time when the status changes
 * // messages will contain all messages in real-time
 * // trackingEvents will update with new events
 * // driverLocation will contain the latest driver location
 * ```
 */
export function useRealtimeShipment(shipmentId: string) {
  const [shipment, setShipment] = useState<ShipmentData | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEventData[]>([]);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(
    null
  );
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!shipmentId) return;

    // Handler functions
    const handleShipmentUpdate = (data: ShipmentData) => {
      setShipment(data);
    };

    const handleNewMessage = (message: MessageData) => {
      setMessages(prev => [...prev, message]);
    };

    const handleTrackingEvent = (event: TrackingEventData) => {
      setTrackingEvents(prev => [...prev, event]);
    };

    const handleDriverLocation = (location: DriverLocation) => {
      setDriverLocation(location);
    };

    // Subscribe to shipment updates
    const newChannel = realtimeService.subscribeToShipment(
      shipmentId,
      handleShipmentUpdate,
      handleNewMessage,
      handleTrackingEvent,
      handleDriverLocation
    );

    setChannel(newChannel);

    // Cleanup function
    return () => {
      realtimeService.unsubscribeFromShipment(shipmentId);
    };
  }, [shipmentId]);

  return {
    shipment,
    messages,
    trackingEvents,
    driverLocation,
    channel,
  };
}
