import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { getCurrentLocation, getRoute } from '../../utils/maps';
import { realtimeService } from '../../services/RealtimeService';

const { width, height } = Dimensions.get('window');

// Define a type for shipment data
interface ShipmentData {
  id: string;
  title?: string;
  status: string;
  driver_id?: string;
  client_id?: string;
  pickup_address?: string;
  delivery_address?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  delivery_lat?: number;
  delivery_lng?: number;
  pickup_location?: any;
  delivery_location?: any;
  [key: string]: any; // For other properties
}

interface RouteMapScreenProps {
  route: {
    params: {
      shipmentId: string;
    };
  };
  navigation: any;
}

export default function RouteMapScreen({ route, navigation }: RouteMapScreenProps) {
  const { shipmentId } = route.params;
  const { userProfile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [shipment, setShipment] = useState<ShipmentData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(false);
  const [isLocationPermissionGranted, setIsLocationPermissionGranted] = useState(false);
  const [destinationCoordinates, setDestinationCoordinates] = useState<{latitude: number, longitude: number} | null>(null);
  
  const mapRef = useRef<MapView>(null);
  const locationWatchId = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    fetchShipmentDetails();
    checkLocationPermission();
    
    return () => {
      // Clean up location subscription
      if (locationWatchId.current) {
        locationWatchId.current.remove();
      }
      
      // Stop location tracking when component unmounts
      realtimeService.stopLocationTracking();
    };
  }, [shipmentId]);

  const checkLocationPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setIsLocationPermissionGranted(status === 'granted');
  };

  const fetchShipmentDetails = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', shipmentId)
        .single();
      
      if (error) throw error;
      
      const shipmentData = data as ShipmentData;
      setShipment(shipmentData);
      
      // Set destination coordinates for marker rendering
      if (shipmentData.status === 'picked_up' || shipmentData.status === 'in_transit') {
        const deliveryCoords = await getShipmentCoordinates(shipmentData, 'delivery');
        setDestinationCoordinates(deliveryCoords);
      } else {
        const pickupCoords = await getShipmentCoordinates(shipmentData, 'pickup');
        setDestinationCoordinates(pickupCoords);
      }
      
      // Get current location
      const location = await getCurrentLocation();
      if (location) {
        setCurrentLocation(location);
        
        // Generate route based on shipment status
        if (shipmentData.status === 'picked_up' || shipmentData.status === 'in_transit') {
          // Route from current location to delivery
          const deliveryCoords = await getShipmentCoordinates(shipmentData, 'delivery');
          if (deliveryCoords) {
            console.log('Calculating route to delivery location');
            calculateRoute(
              location.coords.latitude,
              location.coords.longitude,
              deliveryCoords.latitude,
              deliveryCoords.longitude
            );
          } else {
            Alert.alert('Route Error', 'Could not determine delivery location coordinates.');
          }
        } else {
          // Route from current location to pickup
          const pickupCoords = await getShipmentCoordinates(shipmentData, 'pickup');
          if (pickupCoords) {
            
            // PRODUCTION MODE: Use actual driver location for real-world routing
            console.log('Calculating route to pickup location');
            calculateRoute(
              location.coords.latitude,
              location.coords.longitude,
              pickupCoords.latitude,
              pickupCoords.longitude
            );
          } else {
            Alert.alert('Route Error', 'Could not determine pickup location coordinates.');
          }
        }
      }
      
      // Auto-enable location tracking for in-transit shipments
      if ((shipmentData.status === 'picked_up' || shipmentData.status === 'in_transit') && 
          shipmentData.driver_id === userProfile?.id) {
        toggleLocationTracking(true);
      }
    } catch (error) {
      console.error('Error fetching shipment details:', error);
      Alert.alert('Error', 'Failed to load shipment details.');
    } finally {
      setLoading(false);
    }
  };
  
  const toggleLocationTracking = async (enabled: boolean) => {
    setLocationTrackingEnabled(enabled);
    
    if (enabled) {
      // Start tracking location
      startLocationTracking();
      
      // Start sending location updates to database if we're the driver
      if (shipment && userProfile && shipment.driver_id === userProfile.id) {
        realtimeService.startLocationTracking(
          shipment.id,
          userProfile.id,
          () => {
            Alert.alert(
              'Permission Required',
              'Location permission is needed to track your position during delivery.'
            );
            setLocationTrackingEnabled(false);
          }
        );
      }
    } else {
      // Stop location tracking
      if (locationWatchId.current) {
        locationWatchId.current.remove();
        locationWatchId.current = null;
      }
      
      // Stop sending location updates
      realtimeService.stopLocationTracking();
    }
  };
  
  const extractCoordinates = (locationObject: any) => {
    if (!locationObject) return null;
    
    try {
      // Handle different possible formats of location data
      if (typeof locationObject === 'string') {
        // Check if it's PostGIS binary format (WKB)
        if (locationObject.startsWith('0101000020E6100000') && locationObject.length === 50) {
          const coords = parsePostGISBinary(locationObject);
          if (coords) {
            console.log('✅ PostGIS coordinates extracted:', coords);
            return coords;
          }
        } else if (locationObject.startsWith('0101000020E6100000')) {
          console.warn('⚠️ PostGIS format detected but invalid length:', locationObject.length);
        }
        
        // Clean the string - remove any non-JSON characters
        let cleanedLocation = locationObject.trim();
        
        // Check if it's already a coordinate string like "lat,lng"
        if (cleanedLocation.includes(',') && !cleanedLocation.includes('{')) {
          const coords = cleanedLocation.split(',');
          if (coords.length === 2) {
            const lat = parseFloat(coords[0].trim());
            const lng = parseFloat(coords[1].trim());
            if (!isNaN(lat) && !isNaN(lng)) {
              return { latitude: lat, longitude: lng };
            }
          }
        }
        
        // Try to parse as JSON
        const parsed = JSON.parse(cleanedLocation);
        if (parsed.lat !== undefined && parsed.lng !== undefined) {
          return { latitude: parsed.lat, longitude: parsed.lng };
        }
        if (parsed.latitude !== undefined && parsed.longitude !== undefined) {
          return { latitude: parsed.latitude, longitude: parsed.longitude };
        }
      } else if (typeof locationObject === 'object') {
        // Handle object format
        if (locationObject.lat !== undefined && locationObject.lng !== undefined) {
          return { latitude: locationObject.lat, longitude: locationObject.lng };
        }
        if (locationObject.latitude !== undefined && locationObject.longitude !== undefined) {
          return { latitude: locationObject.latitude, longitude: locationObject.longitude };
        }
        // Handle PostGIS point format (assuming it's stored in coordinates property)
        if (locationObject.coordinates && Array.isArray(locationObject.coordinates) && locationObject.coordinates.length === 2) {
          // PostGIS typically stores as [longitude, latitude]
          return { latitude: locationObject.coordinates[1], longitude: locationObject.coordinates[0] };
        }
      }
    } catch (e) {
      console.error('Error parsing location coordinates:', e);
    }
    
    return null;
  };

  const parsePostGISBinary = (wkb: string): {latitude: number, longitude: number} | null => {
    try {
      // PostGIS binary format: 0101000020E6100000 + longitude (8 bytes) + latitude (8 bytes)
      // Header is 18 characters: 0101000020E6100000
      const coords = wkb.substring(18);
      
      if (coords.length !== 32) {
        console.error('Invalid PostGIS binary length:', coords.length, 'expected 32');
        console.log('Full WKB:', wkb, 'length:', wkb.length);
        console.log('Coords part:', coords);
        return null;
      }
      
      // Extract longitude (first 16 hex chars) and latitude (next 16 hex chars)
      const lngHex = coords.substring(0, 16);
      const latHex = coords.substring(16, 32);
      
      // Convert little-endian hex to IEEE 754 double
      const longitude = hexToDouble(lngHex);
      const latitude = hexToDouble(latHex);
      
      if (isNaN(longitude) || isNaN(latitude)) {
        console.error('Failed to parse PostGIS coordinates');
        return null;
      }
      
      console.log('Parsed PostGIS coordinates:', { latitude, longitude });
      return { latitude, longitude };
    } catch (error) {
      console.error('Error parsing PostGIS binary:', error);
      return null;
    }
  };

  const hexToDouble = (hex: string): number => {
    try {
      // Convert little-endian hex string to IEEE 754 double
      // Reverse byte order for little-endian
      const hexBytes = hex.match(/../g);
      if (!hexBytes || hexBytes.length !== 8) {
        console.error('Invalid hex length for double conversion:', hex);
        return NaN;
      }
      
      const reversedHex = hexBytes.reverse().join('');
      
      // Convert to ArrayBuffer
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      
      for (let i = 0; i < 8; i++) {
        const byteStr = reversedHex.substring(i * 2, i * 2 + 2);
        const byte = parseInt(byteStr, 16);
        if (isNaN(byte)) {
          console.error('Invalid hex byte:', byteStr);
          return NaN;
        }
        view.setUint8(i, byte);
      }
      
      const result = view.getFloat64(0, false); // big-endian since we already reversed
      return result;
    } catch (error) {
      console.error('Error in hexToDouble:', error, 'Input:', hex);
      return NaN;
    }
  };

  const geocodeAddress = async (address: string): Promise<{latitude: number, longitude: number} | null> => {
    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        console.warn('Google Maps API key not found for geocoding');
        return null;
      }

      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        return {
          latitude: location.lat,
          longitude: location.lng
        };
      }
      
      console.warn('Geocoding failed for address:', address, 'Status:', data.status);
      return null;
    } catch (error) {
      console.error('Error geocoding address:', address, error);
      return null;
    }
  };

  const getShipmentCoordinates = async (shipment: any, locationType: 'pickup' | 'delivery') => {
    const isPickup = locationType === 'pickup';
    const latField = isPickup ? 'pickup_lat' : 'delivery_lat';
    const lngField = isPickup ? 'pickup_lng' : 'delivery_lng';
    const locationField = isPickup ? 'pickup_location' : 'delivery_location';
    const addressField = isPickup ? 'pickup_address' : 'delivery_address';
    
    // First try direct lat/lng fields
    if (shipment[latField] !== undefined && shipment[lngField] !== undefined) {
      const coords = {
        latitude: shipment[latField],
        longitude: shipment[lngField]
      };
      console.log(`${locationType} coordinates from direct fields:`, coords);
      return coords;
    }
    
    // Then try location object
    if (shipment[locationField]) {
      const coords = extractCoordinates(shipment[locationField]);
      if (coords) {
        console.log(`${locationType} coordinates extracted from location field:`, coords);
        return coords;
      }
    }
    
    // Finally, try geocoding the address
    if (shipment[addressField]) {
      console.log(`Geocoding ${locationType} address:`, shipment[addressField]);
      const geocodedCoords = await geocodeAddress(shipment[addressField]);
      if (geocodedCoords) {
        console.log(`${locationType} coordinates from geocoding:`, geocodedCoords);
        return geocodedCoords;
      }
    }
    
    console.warn(`Could not determine ${locationType} coordinates for shipment ${shipment.id}`);
    return null;
  };
      
  const startLocationTracking = async () => {
    try {
      // Request location permissions if not already granted
      if (!isLocationPermissionGranted) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Location permission is needed to track your position during delivery.'
          );
          setLocationTrackingEnabled(false);
          return;
        }
        setIsLocationPermissionGranted(true);
      }
      
      // Get initial location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      setCurrentLocation(location);
      
      // Set up location tracking
      locationWatchId.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10, // Update every 10 meters
        },
        (async (newLocation) => {
          setCurrentLocation(newLocation);
          
          // Update route if needed
          if (shipment && (shipment.status === 'picked_up' || shipment.status === 'in_transit')) {
            const deliveryCoords = await getShipmentCoordinates(shipment, 'delivery');
            if (deliveryCoords) {
              calculateRoute(
                newLocation.coords.latitude,
                newLocation.coords.longitude,
                deliveryCoords.latitude,
                deliveryCoords.longitude
              );
            }
          } else if (shipment) {
            const pickupCoords = await getShipmentCoordinates(shipment, 'pickup');
            if (pickupCoords) {
              calculateRoute(
                newLocation.coords.latitude,
                newLocation.coords.longitude,
                pickupCoords.latitude,
                pickupCoords.longitude
              );
            }
          }
        })
      );
    } catch (error) {
      console.error('Error tracking location:', error);
    }
  };

  const calculateRoute = async (startLat: number, startLng: number, endLat: number, endLng: number) => {
    try {
      const routeData = await getRoute(startLat, startLng, endLat, endLng);
      
      let coords = [];
      
      // If we have overview_polyline from Google Directions, decode it
      if (routeData.overview_polyline?.points) {
        coords = decodePolyline(routeData.overview_polyline.points);
        console.log('Route loaded with', coords.length, 'points');
      } else {
        // Fallback: Generate route from steps
        const steps = routeData.steps || [];
        
        // Add starting point
        coords.push({
          latitude: startLat,
          longitude: startLng,
        });
        
        // Add intermediate points from steps
        for (const step of steps) {
          if (step.end_location) {
            coords.push({
              latitude: step.end_location.lat,
              longitude: step.end_location.lng,
            });
          }
        }
        
        // Ensure ending point is included
        if (coords.length === 0 || 
            coords[coords.length - 1].latitude !== endLat || 
            coords[coords.length - 1].longitude !== endLng) {
          coords.push({
            latitude: endLat,
            longitude: endLng,
          });
        }
        
        console.log('Route generated with', coords.length, 'points');
      }
      
      setRouteCoordinates(coords);
      
      // Set route info with real data
      setRouteInfo({
        distance: routeData.distance?.text || 'Unknown',
        duration: routeData.duration?.text || 'Unknown',
      });
      
      console.log('Route calculated:', {
        distance: routeData.distance?.text,
        duration: routeData.duration?.text
      });
      
      // Fit map to show all coordinates
      if (mapRef.current && coords.length > 0) {
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
          animated: true,
        });
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      Alert.alert('Route Error', 'Failed to calculate route. Please try again.');
    }
  };

  // Decode Google Maps polyline algorithm
  const decodePolyline = (encoded: string) => {
    const poly = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      poly.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return poly;
  };

  const renderDestinationMarker = () => {
    if (!shipment || !destinationCoordinates) return null;
    
    // For shipments that are already picked up, show delivery location
    if (shipment.status === 'picked_up' || shipment.status === 'in_transit') {
      return (
        <Marker
          coordinate={destinationCoordinates}
          title="Delivery Location"
          description={shipment.delivery_address}
        >
          <MaterialIcons name="flag" size={30} color={Colors.secondary} />
        </Marker>
      );
    } else {
      // For shipments not yet picked up, show pickup location
      return (
        <Marker
          coordinate={destinationCoordinates}
          title="Pickup Location"
          description={shipment.pickup_address}
        >
          <MaterialIcons name="location-on" size={30} color={Colors.primary} />
        </Marker>
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading route map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        showsMyLocationButton
        followsUserLocation
        initialRegion={
          currentLocation
            ? {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }
            : undefined
        }
      >
        {/* Current Location Marker */}
        {currentLocation && (
          <Marker
            coordinate={{
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
            }}
            title="Current Location"
          >
            <View style={styles.currentLocationMarker}>
              <MaterialIcons name="my-location" size={20} color={Colors.text.inverse} />
            </View>
          </Marker>
        )}
        
        {/* Destination Marker */}
        {renderDestinationMarker()}
        
        {/* Route Line */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={Colors.primary}
            strokeWidth={4}
          />
        )}
      </MapView>
      
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text.inverse} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {shipment ? shipment.title || `Shipment #${shipment.id.substring(0, 8)}` : 'Route Map'}
        </Text>
      </View>
      
      {/* Location Tracking Toggle - Only show for drivers */}
      {shipment && userProfile && shipment.driver_id === userProfile.id && (
        <View style={styles.trackingToggleContainer}>
          <Text style={styles.trackingToggleLabel}>
            Location Tracking {locationTrackingEnabled ? 'On' : 'Off'}
          </Text>
          <Switch
            value={locationTrackingEnabled}
            onValueChange={toggleLocationTracking}
            trackColor={{ false: '#767577', true: Colors.primary + '80' }}
            thumbColor={locationTrackingEnabled ? Colors.primary : '#f4f3f4'}
          />
        </View>
      )}
      
      {/* Route Info Card */}
      {routeInfo && (
        <View style={styles.routeInfoCard}>
          <View style={styles.routeInfoHeader}>
            <MaterialIcons name="directions" size={24} color={Colors.primary} />
            <Text style={styles.routeInfoTitle}>Route Information</Text>
          </View>
          
          <View style={styles.routeDetails}>
            <View style={styles.routeDetailItem}>
              <MaterialIcons name="straighten" size={20} color={Colors.text.secondary} />
              <Text style={styles.routeDetailLabel}>Distance:</Text>
              <Text style={styles.routeDetailValue}>{routeInfo.distance}</Text>
            </View>
            
            <View style={styles.routeDetailItem}>
              <MaterialIcons name="schedule" size={20} color={Colors.text.secondary} />
              <Text style={styles.routeDetailLabel}>Estimated Time:</Text>
              <Text style={styles.routeDetailValue}>{routeInfo.duration}</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.startNavigationButton}
            onPress={() => {
              // This would typically open external navigation app
              Alert.alert('Navigation', 'Opening external navigation app...');
            }}
          >
            <MaterialIcons name="navigation" size={16} color={Colors.text.inverse} />
            <Text style={styles.startNavigationText}>Start Navigation</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width,
    height,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  routeInfoCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  routeInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  routeDetails: {
    marginBottom: 16,
  },
  routeDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeDetailLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 8,
    marginRight: 8,
    width: 100,
  },
  routeDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  startNavigationButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  startNavigationText: {
    color: Colors.text.inverse,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  currentLocationMarker: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: Colors.text.inverse,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.primary,
  },
  trackingToggleContainer: {
    position: 'absolute',
    top: 120,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    width: 200,
  },
  trackingToggleLabel: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
  },
});
