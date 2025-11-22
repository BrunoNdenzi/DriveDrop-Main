// src/services/LocationTrackingService.ts
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { ShipmentStatus } from '../types/shipment';

/**
 * Statuses that require GPS tracking (privacy-aware)
 * Tracking ONLY active after pickup verification to protect driver privacy
 */
export const TRACKABLE_STATUSES: ShipmentStatus[] = [
  'pickup_verified',  // Driver has verified vehicle at pickup
  'picked_up',        // Vehicle is loaded and secured
  'in_transit',       // Actively delivering to destination
];

/**
 * Check if tracking should be enabled for a given shipment status
 */
export function isTrackingAllowed(status: ShipmentStatus): boolean {
  return TRACKABLE_STATUSES.includes(status);
}

interface LocationUpdateConfig {
  /** Update interval in milliseconds (default: 30000 = 30 seconds) */
  updateInterval?: number;
  /** Minimum distance in meters to trigger update (default: 50m) */
  minDistance?: number;
  /** Location accuracy (default: High) */
  accuracy?: Location.Accuracy;
}

export interface DriverLocationData {
  shipment_id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  location_timestamp: string;
}

/**
 * LocationTrackingService
 * 
 * Privacy-first GPS tracking service for drivers during shipment delivery.
 * 
 * Key Features:
 * - Only tracks after pickup verification (protects driver privacy)
 * - Auto-starts when status changes to trackable state
 * - Auto-stops when shipment is delivered
 * - Battery-optimized with configurable intervals
 * - Handles permissions gracefully
 */
export class LocationTrackingService {
  private static instance: LocationTrackingService;
  
  private watchSubscription: Location.LocationSubscription | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private currentShipmentId: string | null = null;
  private currentDriverId: string | null = null;
  private isTracking: boolean = false;
  private lastPosition: Location.LocationObject | null = null;
  private config: Required<LocationUpdateConfig> = {
    updateInterval: 30000, // 30 seconds
    minDistance: 50,       // 50 meters
    accuracy: Location.Accuracy.High,
  };

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): LocationTrackingService {
    if (!LocationTrackingService.instance) {
      LocationTrackingService.instance = new LocationTrackingService();
    }
    return LocationTrackingService.instance;
  }

  /**
   * Configure tracking parameters
   */
  public configure(config: Partial<LocationUpdateConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Start tracking driver location for a specific shipment
   * 
   * @param shipmentId - The ID of the shipment being delivered
   * @param driverId - The ID of the driver
   * @param shipmentStatus - Current shipment status (must be trackable)
   * @returns Promise<boolean> - True if tracking started successfully
   */
  public async startTracking(
    shipmentId: string,
    driverId: string,
    shipmentStatus: ShipmentStatus
  ): Promise<boolean> {
    try {
      // Privacy check: Only allow tracking for trackable statuses
      if (!isTrackingAllowed(shipmentStatus)) {
        console.log(`⚠️ Tracking not allowed for status: ${shipmentStatus}`);
        console.log('📍 Tracking only enabled after pickup verification');
        return false;
      }

      // Already tracking this shipment
      if (this.isTracking && this.currentShipmentId === shipmentId) {
        console.log('✅ Already tracking this shipment');
        return true;
      }

      // Stop any existing tracking
      if (this.isTracking) {
        await this.stopTracking();
      }

      // Request location permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        console.log('❌ Location permission denied');
        return false;
      }

      // Request background permissions (optional, for better tracking)
      try {
        await Location.requestBackgroundPermissionsAsync();
      } catch (error) {
        console.log('⚠️ Background permission request failed (optional)', error);
      }

      // Save tracking context
      this.currentShipmentId = shipmentId;
      this.currentDriverId = driverId;
      this.isTracking = true;

      console.log(`🚀 Starting location tracking for shipment: ${shipmentId}`);
      console.log(`📍 Driver: ${driverId}, Status: ${shipmentStatus}`);

      // Send initial location immediately
      await this.updateLocation();

      // Start watching position with continuous updates
      this.watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: this.config.accuracy,
          timeInterval: this.config.updateInterval,
          distanceInterval: this.config.minDistance,
        },
        (location) => {
          this.handleLocationUpdate(location);
        }
      );

      console.log('✅ Location tracking started successfully');
      return true;
    } catch (error) {
      console.error('❌ Error starting location tracking:', error);
      this.isTracking = false;
      return false;
    }
  }

  /**
   * Stop tracking driver location
   */
  public async stopTracking(): Promise<void> {
    console.log('🛑 Stopping location tracking');

    // Remove watch subscription
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }

    // Clear interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Reset state
    this.isTracking = false;
    this.currentShipmentId = null;
    this.currentDriverId = null;
    this.lastPosition = null;

    console.log('✅ Location tracking stopped');
  }

  /**
   * Handle location update from watchPosition
   */
  private handleLocationUpdate(location: Location.LocationObject): void {
    this.lastPosition = location;
    
    // Update location in database
    this.updateLocation(location).catch((error) => {
      console.error('Error updating location:', error);
    });
  }

  /**
   * Update driver location in database
   */
  private async updateLocation(location?: Location.LocationObject): Promise<void> {
    if (!this.currentShipmentId || !this.currentDriverId) {
      console.log('⚠️ No active shipment or driver');
      return;
    }

    try {
      // Get current location if not provided
      const currentLocation = location || await Location.getCurrentPositionAsync({
        accuracy: this.config.accuracy,
      });

      const locationData: DriverLocationData = {
        shipment_id: this.currentShipmentId,
        driver_id: this.currentDriverId,
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        heading: currentLocation.coords.heading || null,
        speed: currentLocation.coords.speed || null,
        accuracy: currentLocation.coords.accuracy || null,
        location_timestamp: new Date().toISOString(),
      };

      // Insert into database
      const { error } = await supabase
        .from('driver_locations')
        .insert(locationData);

      if (error) {
        console.error('❌ Error inserting location:', error);
      } else {
        console.log('📍 Location updated:', {
          lat: locationData.latitude.toFixed(6),
          lng: locationData.longitude.toFixed(6),
          speed: locationData.speed ? `${Math.round(locationData.speed * 2.237)} mph` : 'N/A',
        });
      }
    } catch (error) {
      console.error('❌ Error updating location:', error);
    }
  }

  /**
   * Check if currently tracking
   */
  public isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  /**
   * Get current tracking context
   */
  public getTrackingContext(): {
    shipmentId: string | null;
    driverId: string | null;
    isTracking: boolean;
  } {
    return {
      shipmentId: this.currentShipmentId,
      driverId: this.currentDriverId,
      isTracking: this.isTracking,
    };
  }

  /**
   * Get last known position
   */
  public getLastPosition(): Location.LocationObject | null {
    return this.lastPosition;
  }

  /**
   * Update tracking for status change
   * Auto-start tracking if status becomes trackable
   * Auto-stop tracking if status becomes non-trackable
   * 
   * @param newStatus - New shipment status
   * @param shipmentId - Shipment ID
   * @param driverId - Driver ID
   */
  public async handleStatusChange(
    newStatus: ShipmentStatus,
    shipmentId: string,
    driverId: string
  ): Promise<void> {
    const shouldTrack = isTrackingAllowed(newStatus);

    if (shouldTrack && !this.isTracking) {
      // Status changed to trackable - start tracking
      console.log(`✅ Status changed to ${newStatus} - starting tracking`);
      await this.startTracking(shipmentId, driverId, newStatus);
    } else if (!shouldTrack && this.isTracking) {
      // Status changed to non-trackable - stop tracking
      console.log(`⛔ Status changed to ${newStatus} - stopping tracking`);
      await this.stopTracking();
    }
  }
}

// Export singleton instance
export const locationTrackingService = LocationTrackingService.getInstance();
