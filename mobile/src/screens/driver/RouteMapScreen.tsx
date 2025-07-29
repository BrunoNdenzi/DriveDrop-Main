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
      
      setShipment(data);
      
      // Get current location
      const location = await getCurrentLocation();
      if (location) {
        setCurrentLocation(location);
        
        // Generate route if we have pickup/delivery coordinates
        if (data.pickup_location && data.delivery_location) {
          // Extract coordinates from location objects
          const pickupCoords = extractCoordinates(data.pickup_location);
          const deliveryCoords = extractCoordinates(data.delivery_location);
          
          if (pickupCoords && deliveryCoords) {
            // For shipments that are already picked up, route from current location to delivery
            if (data.status === 'picked_up' || data.status === 'in_transit') {
              calculateRoute(
                location.coords.latitude,
                location.coords.longitude,
                deliveryCoords.latitude,
                deliveryCoords.longitude
              );
            } else {
              // For shipments not yet picked up, route from current location to pickup
              calculateRoute(
                location.coords.latitude,
                location.coords.longitude,
                pickupCoords.latitude,
                pickupCoords.longitude
              );
            }
          }
        }
      }
      
      // Auto-enable location tracking for in-transit shipments
      if ((data.status === 'picked_up' || data.status === 'in_transit') && 
          data.driver_id === userProfile?.id) {
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
        // Try to parse JSON string
        const parsed = JSON.parse(locationObject);
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
      console.error('Error parsing location:', e);
    }
    
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
        (newLocation) => {
          setCurrentLocation(newLocation);
          
          // Update route if needed
          if (shipment && (shipment.status === 'picked_up' || shipment.status === 'in_transit')) {
            if (shipment.delivery_lat !== undefined && shipment.delivery_lng !== undefined) {
              calculateRoute(
                newLocation.coords.latitude,
                newLocation.coords.longitude,
                shipment.delivery_lat,
                shipment.delivery_lng
              );
            } else if (shipment.delivery_location) {
              const deliveryCoords = extractCoordinates(shipment.delivery_location);
              if (deliveryCoords) {
                calculateRoute(
                  newLocation.coords.latitude,
                  newLocation.coords.longitude,
                  deliveryCoords.latitude,
                  deliveryCoords.longitude
                );
              }
            }
          } else if (shipment) {
            if (shipment.pickup_lat !== undefined && shipment.pickup_lng !== undefined) {
              calculateRoute(
                newLocation.coords.latitude,
                newLocation.coords.longitude,
                shipment.pickup_lat,
                shipment.pickup_lng
              );
            } else if (shipment.pickup_location) {
              const pickupCoords = extractCoordinates(shipment.pickup_location);
              if (pickupCoords) {
                calculateRoute(
                  newLocation.coords.latitude,
                  newLocation.coords.longitude,
                  pickupCoords.latitude,
                  pickupCoords.longitude
                );
              }
            }
          }
        }
      );
    } catch (error) {
      console.error('Error tracking location:', error);
    }
  };

  const calculateRoute = async (startLat: number, startLng: number, endLat: number, endLng: number) => {
    try {
      const routeData = await getRoute(startLat, startLng, endLat, endLng);
      
      // Generate a simple route for now
      const steps = routeData.steps || [];
      const coords = [];
      
      // Add starting point
      coords.push({
        latitude: startLat,
        longitude: startLng,
      });
      
      // Add intermediate points
      for (const step of steps) {
        if (step.end_location) {
          coords.push({
            latitude: step.end_location.lat,
            longitude: step.end_location.lng,
          });
        }
      }
      
      // Add ending point
      coords.push({
        latitude: endLat,
        longitude: endLng,
      });
      
      setRouteCoordinates(coords);
      
      // Set route info
      setRouteInfo({
        distance: routeData.distance?.text || 'Unknown',
        duration: routeData.duration?.text || 'Unknown',
      });
      
      // Fit map to show all coordinates
      if (mapRef.current && coords.length > 0) {
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      Alert.alert('Route Error', 'Failed to calculate route.');
    }
  };

  const renderDestinationMarker = () => {
    if (!shipment) return null;
    
    // For shipments that are already picked up, show delivery location
    if (shipment.status === 'picked_up' || shipment.status === 'in_transit') {
      // Try to get delivery coordinates either from direct lat/lng fields or from location object
      let deliveryCoords;
      
      if (shipment.delivery_lat !== undefined && shipment.delivery_lng !== undefined) {
        deliveryCoords = {
          latitude: shipment.delivery_lat,
          longitude: shipment.delivery_lng
        };
      } else if (shipment.delivery_location) {
        deliveryCoords = extractCoordinates(shipment.delivery_location);
      }
      
      if (deliveryCoords) {
        return (
          <Marker
            coordinate={deliveryCoords}
            title="Delivery Location"
            description={shipment.delivery_address}
          >
            <MaterialIcons name="flag" size={30} color={Colors.secondary} />
          </Marker>
        );
      }
    } else {
      // For shipments not yet picked up, show pickup location
      let pickupCoords;
      
      if (shipment.pickup_lat !== undefined && shipment.pickup_lng !== undefined) {
        pickupCoords = {
          latitude: shipment.pickup_lat,
          longitude: shipment.pickup_lng
        };
      } else if (shipment.pickup_location) {
        pickupCoords = extractCoordinates(shipment.pickup_location);
      }
      
      if (pickupCoords) {
        return (
          <Marker
            coordinate={pickupCoords}
            title="Pickup Location"
            description={shipment.pickup_address}
          >
            <MaterialIcons name="location-on" size={30} color={Colors.primary} />
          </Marker>
        );
      }
    }
    
    return null;
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
