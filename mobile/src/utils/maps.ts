import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { getGoogleMapsApiKey } from './googleMaps';

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
 * Calculate the route between two points using Google Directions API
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
    // Get Google Maps API key using the proper utility function
    const apiKey = getGoogleMapsApiKey();
    
    if (!apiKey) {
      console.warn('Google Maps API key not configured. Using fallback route calculation.');
      return getFallbackRoute(startLat, startLng, endLat, endLng);
    }

    // Call Google Directions API
    const origin = `${startLat},${startLng}`;
    const destination = `${endLat},${endLng}`;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];
      
      // Decode the polyline to get coordinates
      const steps = leg.steps || [];
      
      return {
        distance: leg.distance,
        duration: leg.duration,
        steps: steps,
        polyline: route.overview_polyline?.points,
      };
    } else {
      console.warn('Google Directions API returned no routes. Using fallback.');
      return getFallbackRoute(startLat, startLng, endLat, endLng);
    }
  } catch (error) {
    console.error('Error getting route from Google:', error);
    // Fallback to simple route calculation
    return getFallbackRoute(startLat, startLng, endLat, endLng);
  }
};

/**
 * Fallback route calculation when Google API is unavailable
 * Creates a simple straight-line route with estimated distance and duration
 */
const getFallbackRoute = (
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): any => {
  // Calculate straight-line distance
  const distance = calculateDistance(startLat, startLng, endLat, endLng);
  
  // Estimate duration (assuming average speed of 60 km/h)
  const durationInSeconds = (distance / 60) * 3600;
  const durationInMinutes = Math.round(durationInSeconds / 60);
  
  return {
    distance: { 
      text: `${distance.toFixed(1)} km`, 
      value: Math.round(distance * 1000) 
    },
    duration: { 
      text: `${durationInMinutes} mins`, 
      value: durationInSeconds 
    },
    steps: [
      {
        distance: { 
          text: `${(distance / 2).toFixed(1)} km`, 
          value: Math.round((distance / 2) * 1000) 
        },
        duration: { 
          text: `${Math.round(durationInMinutes / 2)} mins`, 
          value: durationInSeconds / 2 
        },
        start_location: { lat: startLat, lng: startLng },
        end_location: { 
          lat: (startLat + endLat) / 2, 
          lng: (startLng + endLng) / 2 
        },
      },
      {
        distance: { 
          text: `${(distance / 2).toFixed(1)} km`, 
          value: Math.round((distance / 2) * 1000) 
        },
        duration: { 
          text: `${Math.round(durationInMinutes / 2)} mins`, 
          value: durationInSeconds / 2 
        },
        start_location: { 
          lat: (startLat + endLat) / 2, 
          lng: (startLng + endLng) / 2 
        },
        end_location: { lat: endLat, lng: endLng },
      },
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

/**
 * Decode a Google Maps encoded polyline string into coordinates
 * @param {string} encoded Encoded polyline string
 * @returns {Array<{latitude: number, longitude: number}>} Array of coordinates
 */
export const decodePolyline = (encoded: string): Array<{ latitude: number; longitude: number }> => {
  const points: Array<{ latitude: number; longitude: number }> = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
};

/**
 * Open external navigation app (Google Maps or Apple Maps)
 * @param {number} destLat Destination latitude
 * @param {number} destLng Destination longitude
 * @param {string} destLabel Destination label
 */
export const openExternalNavigation = (
  destLat: number,
  destLng: number,
  destLabel: string = 'Destination'
): void => {
  const { Linking, Platform } = require('react-native');
  
  const scheme = Platform.select({
    ios: 'maps:0,0?q=',
    android: 'geo:0,0?q=',
  });
  
  const latLng = `${destLat},${destLng}`;
  const label = encodeURIComponent(destLabel);
  const url = Platform.select({
    ios: `${scheme}${label}@${latLng}`,
    android: `${scheme}${latLng}(${label})`,
  });

  Linking.openURL(url);
};

/**
 * Parse WKB (Well-Known Binary) hexadecimal string from PostGIS
 * Format: 0101000020E6100000[longitude as hex][latitude as hex]
 * @param {string} wkbHex WKB hexadecimal string
 * @returns {{latitude: number, longitude: number} | null} Parsed coordinates or null
 */
const parseWKB = (wkbHex: string): { latitude: number; longitude: number } | null => {
  try {
    // WKB format for POINT with SRID:
    // 01 - byte order (01 = little endian)
    // 01000020 - geometry type (POINT with SRID)
    // E6100000 - SRID (4326 in little endian)
    // Next 8 bytes - longitude as double
    // Next 8 bytes - latitude as double
    
    if (!wkbHex || wkbHex.length < 42) {
      return null;
    }
    
    // Extract longitude (bytes 18-33, which is characters 36-51 in hex string)
    const lonHex = wkbHex.substring(18, 34);
    // Extract latitude (bytes 34-49, which is characters 52-67 in hex string)
    const latHex = wkbHex.substring(34, 50);
    
    // Convert hex to IEEE 754 double (little endian)
    const longitude = hexToDouble(lonHex, true);
    const latitude = hexToDouble(latHex, true);
    
    if (isNaN(longitude) || isNaN(latitude)) {
      return null;
    }
    
    return { latitude, longitude };
  } catch (e) {
    console.error('Error parsing WKB:', e);
    return null;
  }
};

/**
 * Convert hexadecimal string to IEEE 754 double precision number
 * @param {string} hex Hexadecimal string (16 characters)
 * @param {boolean} littleEndian Whether the hex is in little endian format
 * @returns {number} The double precision number
 */
const hexToDouble = (hex: string, littleEndian: boolean = false): number => {
  try {
    // Create a buffer
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    
    // Parse hex string as bytes
    if (littleEndian) {
      // Little endian: read bytes in reverse order
      for (let i = 0; i < 8; i++) {
        const byteHex = hex.substr(i * 2, 2);
        view.setUint8(i, parseInt(byteHex, 16));
      }
    } else {
      // Big endian
      for (let i = 0; i < 8; i++) {
        const byteHex = hex.substr(i * 2, 2);
        view.setUint8(i, parseInt(byteHex, 16));
      }
    }
    
    // Read as double (little endian if original was little endian)
    return view.getFloat64(0, littleEndian);
  } catch (e) {
    console.error('Error in hexToDouble:', e);
    return NaN;
  }
};

/**
 * Parse location data from various formats (PostGIS, JSON, etc.)
 * Handles multiple formats including:
 * - PostGIS WKB hexadecimal: "0101000020E6100000..."
 * - PostGIS POINT format: "POINT(lng lat)"
 * - Simple parentheses: "(lng,lat)"
 * - JSON objects: {lat, lng} or {latitude, longitude}
 * - GeoJSON: {coordinates: [lng, lat]}
 * - Arrays: [lng, lat]
 * @param {any} locationObject Location data in any supported format
 * @returns {{latitude: number, longitude: number} | null} Parsed coordinates or null
 */
export const parseLocationData = (locationObject: any): { latitude: number; longitude: number } | null => {
  if (!locationObject) return null;
  
  try {
    // Handle string formats
    if (typeof locationObject === 'string') {
      // Check if it's a WKB hexadecimal format (PostGIS binary)
      if (/^0101000020E6100000[0-9A-F]+$/i.test(locationObject)) {
        const result = parseWKB(locationObject);
        if (result) return result;
      }
      
      // Check if it's a PostGIS Point format like "POINT(lng lat)"
      const pointMatch = locationObject.match(/POINT\s*\(\s*([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\s*\)/i);
      if (pointMatch) {
        const lng = parseFloat(pointMatch[1]);
        const lat = parseFloat(pointMatch[2]);
        if (!isNaN(lng) && !isNaN(lat)) {
          return { latitude: lat, longitude: lng };
        }
      }
      
      // Check for simple parentheses format "(lng,lat)"
      const simpleMatch = locationObject.match(/\(\s*([+-]?\d+\.?\d*)\s*,\s*([+-]?\d+\.?\d*)\s*\)/);
      if (simpleMatch) {
        const lng = parseFloat(simpleMatch[1]);
        const lat = parseFloat(simpleMatch[2]);
        if (!isNaN(lng) && !isNaN(lat)) {
          return { latitude: lat, longitude: lng };
        }
      }
      
      // Try to parse as JSON string
      const trimmed = locationObject.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          return parseLocationData(parsed); // Recursively parse the JSON object
        } catch (jsonError) {
          console.log('Not valid JSON format');
        }
      }
    } 
    // Handle object formats
    else if (typeof locationObject === 'object') {
      // Standard lat/lng format
      if (locationObject.lat !== undefined && locationObject.lng !== undefined) {
        return { latitude: locationObject.lat, longitude: locationObject.lng };
      }
      
      // Latitude/longitude format
      if (locationObject.latitude !== undefined && locationObject.longitude !== undefined) {
        return { latitude: locationObject.latitude, longitude: locationObject.longitude };
      }
      
      // GeoJSON/PostGIS coordinates array [lng, lat]
      if (locationObject.coordinates && Array.isArray(locationObject.coordinates) && locationObject.coordinates.length === 2) {
        const [lng, lat] = locationObject.coordinates;
        if (!isNaN(lng) && !isNaN(lat)) {
          return { latitude: lat, longitude: lng };
        }
      }
      
      // X/Y format
      if (locationObject.x !== undefined && locationObject.y !== undefined) {
        return { latitude: locationObject.y, longitude: locationObject.x };
      }
    }
    // Handle array format [lng, lat]
    else if (Array.isArray(locationObject) && locationObject.length === 2) {
      const [lng, lat] = locationObject;
      if (!isNaN(lng) && !isNaN(lat)) {
        return { latitude: lat, longitude: lng };
      }
    }
  } catch (e) {
    console.error('Error parsing location data:', e);
    console.log('Failed to parse location:', JSON.stringify(locationObject));
  }
  
  return null;
};
