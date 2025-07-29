// src/hooks/useDriverLocation.ts
import { useEffect, useState } from 'react';
import { realtimeService, DriverLocation } from '../services/RealtimeService';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as Location from 'expo-location';

interface UseDriverLocationProps {
  shipmentId: string;
  isDriver?: boolean;
  driverId?: string;
}

/**
 * Hook for real-time driver location tracking
 * 
 * This hook handles both sending location updates (when used by a driver)
 * and receiving location updates (when used by a client)
 * 
 * @param props Object containing shipmentId, isDriver flag, and optional driverId
 * @returns Object containing location data and tracking status
 * 
 * @example
 * ```tsx
 * // For a driver to send their location:
 * const { 
 *   startTracking, 
 *   stopTracking, 
 *   isTracking 
 * } = useDriverLocation({
 *   shipmentId,
 *   isDriver: true,
 * });
 * 
 * // Start tracking when delivery begins
 * useEffect(() => {
 *   if (shipmentStatus === 'in_transit') {
 *     startTracking();
 *   } else {
 *     stopTracking();
 *   }
 * }, [shipmentStatus]);
 * 
 * // For a client to receive driver location:
 * const { 
 *   driverLocation, 
 *   error 
 * } = useDriverLocation({
 *   shipmentId,
 *   isDriver: false,
 * });
 * 
 * // Use driver location to update a map
 * useEffect(() => {
 *   if (driverLocation) {
 *     mapRef.current?.animateToRegion({
 *       latitude: driverLocation.latitude,
 *       longitude: driverLocation.longitude,
 *       latitudeDelta: 0.005,
 *       longitudeDelta: 0.005,
 *     });
 *   }
 * }, [driverLocation]);
 * ```
 */
export function useDriverLocation({ shipmentId, isDriver = false, driverId }: UseDriverLocationProps) {
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  
  // For clients: Subscribe to driver location updates
  useEffect(() => {
    if (isDriver || !shipmentId) return;
    
    const handleLocationUpdate = (location: DriverLocation) => {
      setDriverLocation(location);
    };
    
    // Get the most recent location first
    const fetchLatestLocation = async () => {
      try {
        const { data, error } = await supabase
          .rpc('get_latest_driver_location', { p_shipment_id: shipmentId });
          
        if (error) throw error;
        if (data && data.length > 0) {
          setDriverLocation(data[0] as unknown as DriverLocation);
        }
      } catch (err) {
        console.error('Error fetching latest driver location:', err);
      }
    };
    
    fetchLatestLocation();
    
    // Subscribe to real-time updates
    const newChannel = realtimeService.subscribeToDriverLocation(
      shipmentId,
      handleLocationUpdate
    );
    
    setChannel(newChannel);
    
    // Cleanup function
    return () => {
      realtimeService.unsubscribeFromDriverLocation();
    };
  }, [shipmentId, isDriver]);
  
  // For drivers: Start sending location updates
  const startTracking = async () => {
    if (!isDriver || !shipmentId || !driverId) {
      setError(new Error('Cannot start tracking: missing required parameters'));
      return false;
    }
    
    try {
      const success = await realtimeService.startLocationTracking(
        shipmentId,
        driverId,
        () => setError(new Error('Location permission denied'))
      );
      
      setIsTracking(success);
      return success;
    } catch (err) {
      console.error('Error starting location tracking:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  };
  
  // For drivers: Stop sending location updates
  const stopTracking = () => {
    if (isDriver) {
      realtimeService.stopLocationTracking();
      setIsTracking(false);
    }
  };
  
  // Clean up tracking when component unmounts
  useEffect(() => {
    return () => {
      if (isDriver && isTracking) {
        realtimeService.stopLocationTracking();
      }
    };
  }, [isDriver, isTracking]);
  
  return {
    driverLocation,
    isTracking,
    error,
    startTracking,
    stopTracking,
    channel
  };
}
