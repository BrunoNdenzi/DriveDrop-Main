/**
 * Google Maps service for geocoding, directions, and distance calculations
 */
import { Client, TravelMode } from '@googlemaps/google-maps-services-js';
import config from '@config/index';
import { createError } from '@utils/error';
import { logger } from '@utils/logger';

// Initialize Google Maps client
const mapsClient = new Client({});

export interface GeocodingResult {
  address: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  formattedAddress?: string;
  addressComponents?: {
    streetNumber?: string;
    route?: string;
    locality?: string;
    administrativeAreaLevel1?: string;
    administrativeAreaLevel2?: string;
    country?: string;
    postalCode?: string;
  };
}

export interface DirectionsResult {
  distance: {
    text: string;
    value: number; // in meters
  };
  duration: {
    text: string;
    value: number; // in seconds
  };
  startAddress: string;
  endAddress: string;
  polyline: string;
  steps?: Array<{
    instruction: string;
    distance: { text: string; value: number };
    duration: { text: string; value: number };
  }>;
}

export interface DistanceMatrixResult {
  originAddress: string;
  destinationAddress: string;
  distance: {
    text: string;
    value: number; // in meters
  };
  duration: {
    text: string;
    value: number; // in seconds
  };
  status: string;
}

/**
 * Google Maps service for location-based operations
 */
export const googleMapsService = {
  /**
   * Geocode an address to get coordinates
   */
  async geocodeAddress(address: string): Promise<GeocodingResult> {
    try {
      if (!config.googleMaps.apiKey) {
        throw createError('Google Maps API key not configured', 500, 'MAPS_CONFIG_ERROR');
      }

      const response = await mapsClient.geocode({
        params: {
          address,
          key: config.googleMaps.apiKey,
        },
      });

      if (response.data.status !== 'OK' || response.data.results.length === 0) {
        throw createError(`Geocoding failed: ${response.data.status}`, 400, 'GEOCODING_FAILED');
      }

      const result = response.data.results[0];
      if (!result) {
        throw createError('No geocoding results found', 400, 'GEOCODING_FAILED');
      }

      const location = result.geometry.location;

      // Parse address components
      const addressComponents: GeocodingResult['addressComponents'] = {};
      result.address_components?.forEach((component) => {
        if (component.types.includes('street_number' as any)) {
          addressComponents.streetNumber = component.long_name;
        } else if (component.types.includes('route' as any)) {
          addressComponents.route = component.long_name;
        } else if (component.types.includes('locality' as any)) {
          addressComponents.locality = component.long_name;
        } else if (component.types.includes('administrative_area_level_1' as any)) {
          addressComponents.administrativeAreaLevel1 = component.short_name;
        } else if (component.types.includes('administrative_area_level_2' as any)) {
          addressComponents.administrativeAreaLevel2 = component.long_name;
        } else if (component.types.includes('country' as any)) {
          addressComponents.country = component.long_name;
        } else if (component.types.includes('postal_code' as any)) {
          addressComponents.postalCode = component.long_name;
        }
      });

      const geocodingResult: GeocodingResult = {
        address,
        latitude: location.lat,
        longitude: location.lng,
        placeId: result.place_id,
        formattedAddress: result.formatted_address,
        addressComponents,
      };

      logger.info('Address geocoded successfully', {
        address,
        latitude: location.lat,
        longitude: location.lng,
      });

      return geocodingResult;
    } catch (error) {
      logger.error('Error geocoding address', { error, address });
      throw createError(
        error instanceof Error ? error.message : 'Geocoding failed',
        400,
        'GEOCODING_FAILED'
      );
    }
  },

  /**
   * Reverse geocode coordinates to get address
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodingResult> {
    try {
      if (!config.googleMaps.apiKey) {
        throw createError('Google Maps API key not configured', 500, 'MAPS_CONFIG_ERROR');
      }

      const response = await mapsClient.reverseGeocode({
        params: {
          latlng: { lat: latitude, lng: longitude },
          key: config.googleMaps.apiKey,
        },
      });

      if (response.data.status !== 'OK' || response.data.results.length === 0) {
        throw createError(`Reverse geocoding failed: ${response.data.status}`, 400, 'REVERSE_GEOCODING_FAILED');
      }

      const result = response.data.results[0];
      if (!result) {
        throw createError('No reverse geocoding results found', 400, 'REVERSE_GEOCODING_FAILED');
      }

      const geocodingResult: GeocodingResult = {
        address: result.formatted_address || '',
        latitude,
        longitude,
        placeId: result.place_id,
        formattedAddress: result.formatted_address,
      };

      logger.info('Coordinates reverse geocoded successfully', {
        latitude,
        longitude,
        address: result.formatted_address,
      });

      return geocodingResult;
    } catch (error) {
      logger.error('Error reverse geocoding coordinates', { error, latitude, longitude });
      throw createError(
        error instanceof Error ? error.message : 'Reverse geocoding failed',
        400,
        'REVERSE_GEOCODING_FAILED'
      );
    }
  },

  /**
   * Get directions between two locations
   */
  async getDirections(
    origin: string | { lat: number; lng: number },
    destination: string | { lat: number; lng: number },
    mode: TravelMode = TravelMode.driving
  ): Promise<DirectionsResult> {
    try {
      if (!config.googleMaps.apiKey) {
        throw createError('Google Maps API key not configured', 500, 'MAPS_CONFIG_ERROR');
      }

      const response = await mapsClient.directions({
        params: {
          origin,
          destination,
          mode,
          key: config.googleMaps.apiKey,
        },
      });

      if (response.data.status !== 'OK' || response.data.routes.length === 0) {
        throw createError(`Directions failed: ${response.data.status}`, 400, 'DIRECTIONS_FAILED');
      }

      const route = response.data.routes[0];
      if (!route || !route.legs || route.legs.length === 0) {
        throw createError('No route found', 400, 'DIRECTIONS_FAILED');
      }

      const leg = route.legs[0];
      if (!leg) {
        throw createError('No route leg found', 400, 'DIRECTIONS_FAILED');
      }

      const directionsResult: DirectionsResult = {
        distance: leg.distance,
        duration: leg.duration,
        startAddress: leg.start_address,
        endAddress: leg.end_address,
        polyline: route.overview_polyline.points,
        steps: leg.steps?.map((step) => ({
          instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
          distance: step.distance,
          duration: step.duration,
        })),
      };

      logger.info('Directions calculated successfully', {
        origin: typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`,
        destination: typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`,
        distance: leg.distance.text,
        duration: leg.duration.text,
      });

      return directionsResult;
    } catch (error) {
      logger.error('Error getting directions', { error, origin, destination });
      throw createError(
        error instanceof Error ? error.message : 'Directions calculation failed',
        400,
        'DIRECTIONS_FAILED'
      );
    }
  },

  /**
   * Calculate distance matrix between multiple origins and destinations
   */
  async getDistanceMatrix(
    origins: (string | { lat: number; lng: number })[],
    destinations: (string | { lat: number; lng: number })[],
    mode: TravelMode = TravelMode.driving
  ): Promise<DistanceMatrixResult[]> {
    try {
      if (!config.googleMaps.apiKey) {
        throw createError('Google Maps API key not configured', 500, 'MAPS_CONFIG_ERROR');
      }

      const response = await mapsClient.distancematrix({
        params: {
          origins,
          destinations,
          mode,
          key: config.googleMaps.apiKey,
        },
      });

      if (response.data.status !== 'OK') {
        throw createError(`Distance matrix failed: ${response.data.status}`, 400, 'DISTANCE_MATRIX_FAILED');
      }

      const results: DistanceMatrixResult[] = [];        response.data.rows.forEach((row, originIndex) => {
          row.elements.forEach((element, destinationIndex) => {
            results.push({
              originAddress: response.data.origin_addresses[originIndex] || 'Unknown',
              destinationAddress: response.data.destination_addresses[destinationIndex] || 'Unknown',
              distance: element.distance || { text: 'N/A', value: 0 },
              duration: element.duration || { text: 'N/A', value: 0 },
              status: element.status,
            });
          });
        });

      logger.info('Distance matrix calculated successfully', {
        originsCount: origins.length,
        destinationsCount: destinations.length,
        resultsCount: results.length,
      });

      return results;
    } catch (error) {
      logger.error('Error calculating distance matrix', { error, origins, destinations });
      throw createError(
        error instanceof Error ? error.message : 'Distance matrix calculation failed',
        400,
        'DISTANCE_MATRIX_FAILED'
      );
    }
  },

  /**
   * Calculate distance between two points (haversine formula)
   */
  calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): { distanceKm: number; distanceMiles: number } {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    return {
      distanceKm: Math.round(distanceKm * 100) / 100, // Round to 2 decimal places
      distanceMiles: Math.round(distanceKm * 0.621371 * 100) / 100, // Convert to miles
    };
  },

  /**
   * Convert degrees to radians
   */
  toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  },

  /**
   * Find nearby locations within a radius
   */
  async findNearbyPlaces(
    location: { lat: number; lng: number },
    radius: number,
    type?: string
  ): Promise<any[]> {
    try {
      if (!config.googleMaps.apiKey) {
        throw createError('Google Maps API key not configured', 500, 'MAPS_CONFIG_ERROR');
      }

      const params: any = {
        location,
        radius,
        key: config.googleMaps.apiKey,
      };

      if (type) {
        params.type = type;
      }

      const response = await mapsClient.placesNearby({
        params,
      });

      if (response.data.status !== 'OK') {
        throw createError(`Places search failed: ${response.data.status}`, 400, 'PLACES_SEARCH_FAILED');
      }

      logger.info('Nearby places found', {
        location,
        radius,
        type,
        resultsCount: response.data.results.length,
      });

      return response.data.results;
    } catch (error) {
      logger.error('Error finding nearby places', { error, location, radius, type });
      throw createError(
        error instanceof Error ? error.message : 'Places search failed',
        400,
        'PLACES_SEARCH_FAILED'
      );
    }
  },

  /**
   * Validate coordinates
   */
  isValidCoordinates(lat: number, lng: number): boolean {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  },

  /**
   * Format coordinates for display
   */
  formatCoordinates(lat: number, lng: number, precision = 6): string {
    return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
  },
};
