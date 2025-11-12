import { getSupabaseBrowserClient } from './supabase-client'

export interface LocationUpdate {
  latitude: number
  longitude: number
  accuracy: number
  speed: number | null
  heading: number | null
  timestamp: string
}

class LocationTracker {
  private watchId: number | null = null
  private shipmentId: string | null = null
  private driverId: string | null = null
  private isTracking = false
  private updateInterval = 30000 // 30 seconds
  private lastUpdateTime = 0

  startTracking(shipmentId: string, driverId: string) {
    if (this.isTracking) {
      console.log('Already tracking location')
      return
    }

    this.shipmentId = shipmentId
    this.driverId = driverId
    this.isTracking = true

    console.log(`Starting location tracking for shipment ${shipmentId}`)

    if ('geolocation' in navigator) {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => this.handleLocationUpdate(position),
        (error) => this.handleLocationError(error),
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 15000
        }
      )
    } else {
      console.error('Geolocation not supported')
      this.isTracking = false
    }
  }

  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }
    this.isTracking = false
    this.shipmentId = null
    this.driverId = null
    console.log('Stopped location tracking')
  }

  private async handleLocationUpdate(position: GeolocationPosition) {
    if (!this.shipmentId || !this.driverId) return

    const now = Date.now()
    // Throttle updates to every 30 seconds
    if (now - this.lastUpdateTime < this.updateInterval) {
      return
    }

    this.lastUpdateTime = now

    const locationData: LocationUpdate = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed,
      heading: position.coords.heading,
      timestamp: new Date(position.timestamp).toISOString()
    }

    try {
      const supabase = getSupabaseBrowserClient()

      // Insert location update into driver_locations table
      const { error } = await supabase
        .from('driver_locations')
        .insert({
          driver_id: this.driverId,
          shipment_id: this.shipmentId,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.accuracy,
          speed: locationData.speed,
          heading: locationData.heading,
          recorded_at: locationData.timestamp
        })

      if (error) {
        console.error('Error updating location:', error)
      } else {
        console.log('Location updated:', locationData)
      }

      // Also update the shipment's current location
      await supabase
        .from('shipments')
        .update({
          current_latitude: locationData.latitude,
          current_longitude: locationData.longitude,
          last_location_update: locationData.timestamp
        })
        .eq('id', this.shipmentId)

    } catch (error) {
      console.error('Error saving location:', error)
    }
  }

  private handleLocationError(error: GeolocationPositionError) {
    console.error('Location error:', error.message)
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        console.error('User denied location permission')
        this.stopTracking()
        break
      case error.POSITION_UNAVAILABLE:
        console.error('Location information unavailable')
        break
      case error.TIMEOUT:
        console.error('Location request timed out')
        break
    }
  }

  isCurrentlyTracking(): boolean {
    return this.isTracking
  }

  getCurrentShipmentId(): string | null {
    return this.shipmentId
  }
}

// Singleton instance
export const locationTracker = new LocationTracker()
