import * as Location from 'expo-location';
import { Alert } from 'react-native';

/**
 * Request location permissions and get the current position
 * @returns {Promise<Location.LocationObject | null>} The current location or null if there was an error
 */
export const getCurrentLocation = async (): Promise<Location.LocationObject | null> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Location permission is required to use this feature.',
        [{ text: 'OK' }]
      );
      return null;
    }
    
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    
    return location;
  } catch (error) {
    console.error('Error getting location:', error);
    Alert.alert(
      'Location Error',
      'Unable to get your current location. Please try again.',
      [{ text: 'OK' }]
    );
    return null;
  }
};

/**
 * Calculate the route between two points
 * @param {number} startLat Starting latitude
 * @param {number} startLng Starting longitude
 * @param {number} endLat Ending latitude
 * @param {number} endLng Ending longitude
 * @returns {Promise<any>} Route information
 */
export const getRoute = async (
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<any> => {
  try {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    
    if (!apiKey) {
      console.warn('Google Maps API key not found, using fallback calculation');
      return getFallbackRoute(startLat, startLng, endLat, endLng);
    }

    const origin = `${startLat},${startLng}`;
    const destination = `${endLat},${endLng}`;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${apiKey}&mode=driving`;

    console.log('Fetching route from Google Directions API...');
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];
      
      console.log('Route calculated successfully:', {
        distance: leg.distance.text,
        duration: leg.duration.text
      });

      return {
        distance: leg.distance,
        duration: leg.duration,
        steps: leg.steps || [],
        overview_polyline: route.overview_polyline,
        bounds: route.bounds,
      };
    } else {
      console.warn('Google Directions API failed:', data.status, data.error_message);
      return getFallbackRoute(startLat, startLng, endLat, endLng);
    }
  } catch (error) {
    console.error('Error getting route from Google Directions API:', error);
    return getFallbackRoute(startLat, startLng, endLat, endLng);
  }
};

/**
 * Fallback route calculation using straight-line distance and estimated time
 */
const getFallbackRoute = (
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): any => {
  const distance = calculateDistance(startLat, startLng, endLat, endLng);
  const distanceInMeters = Math.round(distance * 1000);
  
  // Estimate driving time at average 40 km/h in city traffic
  const estimatedTimeMinutes = Math.round((distance / 40) * 60);
  const estimatedTimeSeconds = estimatedTimeMinutes * 60;
  
  return {
    distance: { 
      text: distance < 1 ? `${distanceInMeters} m` : `${distance.toFixed(1)} km`, 
      value: distanceInMeters 
    },
    duration: { 
      text: estimatedTimeMinutes < 60 
        ? `${estimatedTimeMinutes} min` 
        : `${Math.floor(estimatedTimeMinutes / 60)}h ${estimatedTimeMinutes % 60}m`,
      value: estimatedTimeSeconds 
    },
    steps: [
      {
        distance: { 
          text: distance < 1 ? `${distanceInMeters} m` : `${distance.toFixed(1)} km`, 
          value: distanceInMeters 
        },
        duration: { 
          text: estimatedTimeMinutes < 60 
            ? `${estimatedTimeMinutes} min` 
            : `${Math.floor(estimatedTimeMinutes / 60)}h ${estimatedTimeMinutes % 60}m`,
          value: estimatedTimeSeconds 
        },
        start_location: { lat: startLat, lng: startLng },
        end_location: { lat: endLat, lng: endLng },
      }
    ],
  };
};

/**
 * Generate a random location near a center point
 * @param {number} centerLat Center latitude
 * @param {number} centerLng Center longitude
 * @param {number} radiusInKm Radius in kilometers
 * @returns {Object} Random location
 */
export const getRandomLocation = (
  centerLat: number,
  centerLng: number,
  radiusInKm: number = 5
): { latitude: number; longitude: number } => {
  const y0 = centerLat;
  const x0 = centerLng;
  const rd = radiusInKm / 111.32; // Convert km to degrees
  
  const u = Math.random();
  const v = Math.random();
  
  const w = rd * Math.sqrt(u);
  const t = 2 * Math.PI * v;
  const x = w * Math.cos(t);
  const y = w * Math.sin(t);
  
  // Adjust the x-coordinate for the shrinking of the east-west distances
  const xp = x / Math.cos(y0);
  
  const newlat = y + y0;
  const newlon = xp + x0;
  
  return {
    latitude: newlat,
    longitude: newlon,
  };
};

/**
 * Formats coordinates for display
 * @param {number} coordinate Latitude or longitude
 * @returns {string} Formatted coordinate
 */
export const formatCoordinate = (coordinate: number): string => {
  return coordinate.toFixed(6);
};

/**
 * Calculate the distance between two points in kilometers
 * @param {number} lat1 First latitude
 * @param {number} lon1 First longitude
 * @param {number} lat2 Second latitude
 * @param {number} lon2 Second longitude
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

/**
 * Convert degrees to radians
 * @param {number} deg Degrees
 * @returns {number} Radians
 */
const deg2rad = (deg: number): number => {
  return deg * (Math.PI / 180);
};
