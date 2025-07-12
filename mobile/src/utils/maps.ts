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
    // This would typically call a routing service like Google Directions API or Mapbox Directions API
    // For now, we'll just return a dummy response
    return {
      distance: { text: '10 km', value: 10000 },
      duration: { text: '15 mins', value: 900 },
      steps: [
        {
          distance: { text: '5 km', value: 5000 },
          duration: { text: '8 mins', value: 480 },
          start_location: { lat: startLat, lng: startLng },
          end_location: { lat: (startLat + endLat) / 2, lng: (startLng + endLng) / 2 },
        },
        {
          distance: { text: '5 km', value: 5000 },
          duration: { text: '7 mins', value: 420 },
          start_location: { lat: (startLat + endLat) / 2, lng: (startLng + endLng) / 2 },
          end_location: { lat: endLat, lng: endLng },
        },
      ],
    };
  } catch (error) {
    console.error('Error getting route:', error);
    throw error;
  }
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
