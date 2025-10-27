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
import { getCurrentLocation, getRoute, decodePolyline, openExternalNavigation, openExternalNavigationWithWaypoints, parseLocationData, calculateDistance } from '../../utils/maps';
import { realtimeService } from '../../services/RealtimeService';
import { getGoogleMapsApiKey } from '../../utils/environment';
import { MapErrorBoundary } from '../../components/MapErrorBoundary';

const { width, height } = Dimensions.get('window');

// Define a type for shipment data
interface ShipmentData {
  id: string;
  title?: string;
  status: string;
  driver_id?: string | null;
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
  const [leg1Coordinates, setLeg1Coordinates] = useState<any[]>([]); // Current → Pickup
  const [leg2Coordinates, setLeg2Coordinates] = useState<any[]>([]); // Pickup → Delivery
  const [isMultiLegRoute, setIsMultiLegRoute] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(false);
  const [isLocationPermissionGranted, setIsLocationPermissionGranted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  
  const mapRef = useRef<MapView>(null);
  const locationWatchId = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    // Check if Google Maps API key is configured
    const apiKey = getGoogleMapsApiKey();
    console.log('Google Maps API Key check:', {
      hasKey: !!apiKey,
      keyLength: apiKey?.length || 0,
      keyPrefix: apiKey?.substring(0, 10) || 'none'
    });
    
    if (!apiKey) {
      console.error('CRITICAL: Google Maps API key is missing!');
      setMapError('Map configuration error. Please ensure Google Maps API key is set.');
      setLoading(false);
      Alert.alert(
        'Configuration Error',
        'Google Maps is not properly configured. Please contact support.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      return;
    }
    
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
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchShipmentDetails();
    setRefreshing(false);
  };

  const checkLocationPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setIsLocationPermissionGranted(status === 'granted');
  };

  const fetchShipmentDetails = async () => {
    try {
      setLoading(true);
      
      if (!shipmentId) {
        throw new Error('No shipment ID provided');
      }
      
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', shipmentId)
        .single();
      
      if (error) throw error;
      if (!data) throw new Error('Shipment not found');
      
      setShipment(data);
      
      // Get current location with error handling
      let location = null;
      try {
        location = await getCurrentLocation();
        if (location) {
          setCurrentLocation(location);
        }
      } catch (locationError) {
        console.error('Error getting current location:', locationError);
        // Continue anyway - we can still show the map
      }
      
      // Generate route if we have all required data
      if (data.pickup_location && data.delivery_location && location) {
        // Extract coordinates from location objects
        console.log('Raw location data:', {
          pickup_location: data.pickup_location,
          pickup_location_type: typeof data.pickup_location,
          delivery_location: data.delivery_location,
          delivery_location_type: typeof data.delivery_location
        });
        
        const pickupCoords = extractCoordinates(data.pickup_location);
        const deliveryCoords = extractCoordinates(data.delivery_location);
        
        console.log('Shipment coordinates:', {
          pickup: pickupCoords,
          delivery: deliveryCoords,
          status: data.status
        });
        
        if (pickupCoords && deliveryCoords) {
          // For shipments that are already picked up, route from current location to delivery only
          if (data.status === 'picked_up' || data.status === 'in_transit') {
            console.log('Calculating route to delivery location (already picked up)');
            calculateRoute(
              location.coords.latitude,
              location.coords.longitude,
              deliveryCoords.latitude,
              deliveryCoords.longitude
            );
          } else {
            // For shipments not yet picked up, show FULL route: current → pickup → delivery
            console.log('Calculating full route: current → pickup → delivery');
            calculateMultiLegRoute(
              location.coords.latitude,
              location.coords.longitude,
              pickupCoords.latitude,
              pickupCoords.longitude,
              deliveryCoords.latitude,
              deliveryCoords.longitude
            );
          }
        } else {
          console.warn('Could not extract valid coordinates');
        }
      } else {
        console.warn('Missing required data for route calculation');
      }
      
      // Auto-enable location tracking for in-transit shipments
      if ((data.status === 'picked_up' || data.status === 'in_transit') && 
          data.driver_id === userProfile?.id) {
        toggleLocationTracking(true);
      }
    } catch (error: any) {
      console.error('Error fetching shipment details:', error);
      const errorMessage = error?.message || 'Failed to load shipment details';
      Alert.alert('Error', errorMessage);
      setMapError(errorMessage);
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
    try {
      // Log what we're trying to parse
      console.log('Attempting to parse location:', JSON.stringify(locationObject));
      
      // Return null if locationObject is null/undefined
      if (!locationObject) {
        console.warn('Location object is null or undefined');
        return null;
      }
      
      // Use the centralized parseLocationData utility function
      const result = parseLocationData(locationObject);
      
      // Validate the result
      if (result && typeof result.latitude === 'number' && typeof result.longitude === 'number') {
        console.log('Parse result:', result);
        return result;
      } else {
        console.error('Invalid parse result:', result);
        return null;
      }
    } catch (error) {
      console.error('Error in extractCoordinates:', error);
      return null;
    }
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
            // Already picked up - route to delivery only
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
            // Not yet picked up - show full route: current → pickup → delivery
            const pickupCoords = shipment.pickup_lat !== undefined && shipment.pickup_lng !== undefined
              ? { latitude: shipment.pickup_lat, longitude: shipment.pickup_lng }
              : (shipment.pickup_location ? extractCoordinates(shipment.pickup_location) : null);
            
            const deliveryCoords = shipment.delivery_lat !== undefined && shipment.delivery_lng !== undefined
              ? { latitude: shipment.delivery_lat, longitude: shipment.delivery_lng }
              : (shipment.delivery_location ? extractCoordinates(shipment.delivery_location) : null);
            
            if (pickupCoords && deliveryCoords) {
              calculateMultiLegRoute(
                newLocation.coords.latitude,
                newLocation.coords.longitude,
                pickupCoords.latitude,
                pickupCoords.longitude,
                deliveryCoords.latitude,
                deliveryCoords.longitude
              );
            } else if (pickupCoords) {
              // Fallback to just pickup if delivery coords missing
              calculateRoute(
                newLocation.coords.latitude,
                newLocation.coords.longitude,
                pickupCoords.latitude,
                pickupCoords.longitude
              );
            }
          }
        }
      );
    } catch (error) {
      console.error('Error tracking location:', error);
    }
  };

  const calculateMultiLegRoute = async (
    currentLat: number, 
    currentLng: number,
    pickupLat: number,
    pickupLng: number,
    deliveryLat: number,
    deliveryLng: number
  ) => {
    try {
      console.log('Calculating multi-leg route:', {
        current: { lat: currentLat, lng: currentLng },
        pickup: { lat: pickupLat, lng: pickupLng },
        delivery: { lat: deliveryLat, lng: deliveryLng }
      });

      // Check if the route distance is reasonable
      const straightLineToPickup = calculateDistance(currentLat, currentLng, pickupLat, pickupLng);
      const straightLineToDelivery = calculateDistance(pickupLat, pickupLng, deliveryLat, deliveryLng);
      const straightLineTotal = straightLineToPickup + straightLineToDelivery;

      console.log('Route distances (straight line):', {
        toPickup: `${straightLineToPickup.toFixed(0)} km`,
        toDelivery: `${straightLineToDelivery.toFixed(0)} km`,
        total: `${straightLineTotal.toFixed(0)} km`
      });

      // Warn if the route seems impossibly long (intercontinental)
      if (straightLineTotal > 5000) {
        Alert.alert(
          'Location Mismatch',
          `The route distance (${straightLineTotal.toFixed(0)} km) suggests you and the shipment are on different continents.\n\n` +
          'This may be due to:\n' +
          '• Test/mock GPS data\n' +
          '• Incorrect shipment location data\n' +
          '• GPS signal issues\n\n' +
          'The map will show an estimated route, but actual navigation may not be possible.',
          [{ text: 'OK' }]
        );
      }

      // Calculate both legs of the journey
      const [leg1Data, leg2Data] = await Promise.all([
        getRoute(currentLat, currentLng, pickupLat, pickupLng),
        getRoute(pickupLat, pickupLng, deliveryLat, deliveryLng)
      ]);

      console.log('Multi-leg route data received:', { leg1Data, leg2Data });

      let leg1Coords: Array<{ latitude: number; longitude: number }> = [];
      let leg2Coords: Array<{ latitude: number; longitude: number }> = [];

      // Decode leg 1: current → pickup
      if (leg1Data.polyline) {
        try {
          leg1Coords = decodePolyline(leg1Data.polyline);
        } catch (decodeError) {
          console.error('Error decoding leg 1 polyline:', decodeError);
          leg1Coords = generateCoordsFromSteps(currentLat, currentLng, pickupLat, pickupLng, leg1Data.steps);
        }
      } else {
        leg1Coords = generateCoordsFromSteps(currentLat, currentLng, pickupLat, pickupLng, leg1Data.steps);
      }

      // Decode leg 2: pickup → delivery
      if (leg2Data.polyline) {
        try {
          leg2Coords = decodePolyline(leg2Data.polyline);
        } catch (decodeError) {
          console.error('Error decoding leg 2 polyline:', decodeError);
          leg2Coords = generateCoordsFromSteps(pickupLat, pickupLng, deliveryLat, deliveryLng, leg2Data.steps);
        }
      } else {
        leg2Coords = generateCoordsFromSteps(pickupLat, pickupLng, deliveryLat, deliveryLng, leg2Data.steps);
      }

      // Combine both legs into a single route for fitToCoordinates
      const allCoords = [...leg1Coords, ...leg2Coords];
      
      // Store separate leg coordinates for rendering with different colors
      setLeg1Coordinates(leg1Coords);
      setLeg2Coordinates(leg2Coords);
      setRouteCoordinates(allCoords);
      setIsMultiLegRoute(true);

      // Calculate total distance and duration
      const totalDistance = (leg1Data.distance?.value || 0) + (leg2Data.distance?.value || 0);
      const totalDuration = (leg1Data.duration?.value || 0) + (leg2Data.duration?.value || 0);

      // Format total distance (convert meters to miles/km)
      const distanceInMiles = (totalDistance / 1609.34).toFixed(1);
      const distanceInKm = (totalDistance / 1000).toFixed(1);
      const distanceText = `${distanceInMiles} mi (${distanceInKm} km)`;

      // Format total duration (convert seconds to hours/minutes)
      const hours = Math.floor(totalDuration / 3600);
      const minutes = Math.floor((totalDuration % 3600) / 60);
      const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;

      setRouteInfo({
        distance: distanceText,
        duration: durationText,
      });

      // Fit map to show all coordinates
      if (mapRef.current && allCoords.length > 0) {
        mapRef.current.fitToCoordinates(allCoords, {
          edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
          animated: true,
        });
      }
    } catch (error) {
      console.error('Error calculating multi-leg route:', error);
      Alert.alert('Route Error', 'Failed to calculate route. Please try again.');
    }
  };

  const calculateRoute = async (startLat: number, startLng: number, endLat: number, endLng: number) => {
    try {
      console.log('Calculating route from', { startLat, startLng }, 'to', { endLat, endLng });
      const routeData = await getRoute(startLat, startLng, endLat, endLng);
      console.log('Route data received:', routeData);
      
      let coords: Array<{ latitude: number; longitude: number }> = [];
      
      // If we have a polyline, decode it for smooth route display
      if (routeData.polyline) {
        try {
          coords = decodePolyline(routeData.polyline);
        } catch (decodeError) {
          console.error('Error decoding polyline:', decodeError);
          // Fall back to step-by-step coordinates
          coords = generateCoordsFromSteps(startLat, startLng, endLat, endLng, routeData.steps);
        }
      } else {
        // No polyline available, generate from steps
        coords = generateCoordsFromSteps(startLat, startLng, endLat, endLng, routeData.steps);
      }
      
      setRouteCoordinates(coords);
      setIsMultiLegRoute(false); // Single-leg route
      setLeg1Coordinates([]);
      setLeg2Coordinates([]);
      
      // Set route info
      setRouteInfo({
        distance: routeData.distance?.text || 'Unknown',
        duration: routeData.duration?.text || 'Unknown',
      });
      
      // Fit map to show all coordinates
      if (mapRef.current && coords.length > 0) {
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
          animated: true,
        });
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      Alert.alert('Route Error', 'Failed to calculate route. Please try again.');
    }
  };
  
  const generateCoordsFromSteps = (
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    steps: any[]
  ): Array<{ latitude: number; longitude: number }> => {
    const coords: Array<{ latitude: number; longitude: number }> = [];
    
    // Add starting point
    coords.push({
      latitude: startLat,
      longitude: startLng,
    });
    
    // Add intermediate points from steps
    for (const step of steps || []) {
      if (step.end_location) {
        coords.push({
          latitude: step.end_location.lat,
          longitude: step.end_location.lng,
        });
      }
    }
    
    // Add ending point if not already included
    const lastCoord = coords[coords.length - 1];
    if (!lastCoord || lastCoord.latitude !== endLat || lastCoord.longitude !== endLng) {
      coords.push({
        latitude: endLat,
        longitude: endLng,
      });
    }
    
    return coords;
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

  // Show error if Google Maps fails to load
  if (mapError) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color={Colors.error} />
          <Text style={styles.errorTitle}>Map Error</Text>
          <Text style={styles.errorText}>{mapError}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setMapError(null);
              fetchShipmentDetails();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.backButtonAlt}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonAltText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // If there's a critical error, show error screen instead of MapView
  if (mapError) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color={Colors.error} />
          <Text style={styles.errorTitle}>Map Unavailable</Text>
          <Text style={styles.errorText}>{mapError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setMapError(null);
              setLoading(true);
              fetchShipmentDetails();
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backButtonAlt}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonAltText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <MapErrorBoundary 
      onRetry={() => {
        setLoading(true);
        setMapError(null);
        fetchShipmentDetails();
      }}
      fallbackMessage="The route map could not be loaded. Please check your internet connection and try again."
    >
      <View style={styles.container}>
        <StatusBar style="light" />
      
      {!mapError && (
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={isLocationPermissionGranted}
        showsMyLocationButton={isLocationPermissionGranted}
        followsUserLocation={locationTrackingEnabled}
        showsTraffic={true}
        showsCompass={true}
        onMapReady={() => {
          console.log('Map is ready');
        }}
        initialRegion={
          currentLocation
            ? {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }
            : {
                // Default to USA center if no location
                latitude: 39.8283,
                longitude: -98.5795,
                latitudeDelta: 50,
                longitudeDelta: 50,
              }
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
        {isMultiLegRoute ? (
          <>
            {/* Leg 1: Current Location → Pickup (Orange/Amber) */}
            {leg1Coordinates.length > 1 && (
              <Polyline
                coordinates={leg1Coordinates}
                strokeColor="#FF9800" // Orange for "going to pickup"
                strokeWidth={4}
                lineDashPattern={[1]} // Solid line
              />
            )}
            {/* Leg 2: Pickup → Delivery (Blue/Primary) */}
            {leg2Coordinates.length > 1 && (
              <Polyline
                coordinates={leg2Coordinates}
                strokeColor={Colors.primary} // Primary blue for "delivery leg"
                strokeWidth={4}
                lineDashPattern={[1]} // Solid line
              />
            )}
          </>
        ) : (
          /* Single leg route */
          routeCoordinates.length > 1 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={Colors.primary}
              strokeWidth={4}
            />
          )
        )}
      </MapView>
      )}
      
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
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <MaterialIcons 
            name="refresh" 
            size={24} 
            color={refreshing ? Colors.text.disabled : Colors.text.inverse} 
          />
        </TouchableOpacity>
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
      
      {/* Route Info Card - Always show if shipment loaded */}
      {shipment && (
        <View style={styles.routeInfoCard}>
          <View style={styles.routeInfoHeader}>
            <MaterialIcons name="directions" size={24} color={Colors.primary} />
            <Text style={styles.routeInfoTitle}>Route Information</Text>
          </View>
          
          {routeInfo ? (
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
              
              {/* Route Legend for multi-leg routes */}
              {isMultiLegRoute && (
                <View style={styles.routeLegend}>
                  <Text style={styles.routeLegendTitle}>Route:</Text>
                  <View style={styles.routeLegendItem}>
                    <View style={[styles.routeLegendLine, { backgroundColor: '#FF9800' }]} />
                    <Text style={styles.routeLegendText}>To Pickup</Text>
                  </View>
                  <View style={styles.routeLegendItem}>
                    <View style={[styles.routeLegendLine, { backgroundColor: Colors.primary }]} />
                    <Text style={styles.routeLegendText}>To Delivery</Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.routeDetails}>
              <Text style={styles.calculatingText}>Calculating route...</Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.startNavigationButton}
            onPress={() => {
              // Check if we need multi-leg navigation (before pickup) or single destination
              const needsPickup = shipment?.status !== 'picked_up' && shipment?.status !== 'in_transit';
              
              if (needsPickup) {
                // Multi-leg route: Current → Pickup → Delivery
                const pickupCoords = shipment?.pickup_lat !== undefined && shipment?.pickup_lng !== undefined
                  ? { latitude: shipment.pickup_lat, longitude: shipment.pickup_lng }
                  : shipment?.pickup_location 
                    ? extractCoordinates(shipment.pickup_location)
                    : null;
                
                const deliveryCoords = shipment?.delivery_lat !== undefined && shipment?.delivery_lng !== undefined
                  ? { latitude: shipment.delivery_lat, longitude: shipment.delivery_lng }
                  : shipment?.delivery_location 
                    ? extractCoordinates(shipment.delivery_location)
                    : null;
                
                if (pickupCoords && deliveryCoords) {
                  // Use waypoint navigation: Current location → Pickup (waypoint) → Delivery (destination)
                  openExternalNavigationWithWaypoints(
                    currentLocation ? {
                      latitude: currentLocation.coords.latitude,
                      longitude: currentLocation.coords.longitude
                    } : null,
                    [{
                      latitude: pickupCoords.latitude,
                      longitude: pickupCoords.longitude,
                      label: shipment?.pickup_address || 'Pickup Location'
                    }],
                    {
                      latitude: deliveryCoords.latitude,
                      longitude: deliveryCoords.longitude,
                      label: shipment?.delivery_address || 'Delivery Location'
                    }
                  );
                } else {
                  Alert.alert('Error', 'Unable to open navigation. Pickup or delivery coordinates not available.');
                }
              } else {
                // Single destination: Current → Delivery
                let destCoords;
                let destLabel = 'Destination';
                
                if (shipment?.delivery_lat !== undefined && shipment?.delivery_lng !== undefined) {
                  destCoords = {
                    latitude: shipment.delivery_lat,
                    longitude: shipment.delivery_lng
                  };
                } else if (shipment?.delivery_location) {
                  destCoords = extractCoordinates(shipment.delivery_location);
                }
                destLabel = shipment?.delivery_address || 'Delivery Location';
                
                if (destCoords) {
                  openExternalNavigation(destCoords.latitude, destCoords.longitude, destLabel);
                } else {
                  Alert.alert('Error', 'Unable to open navigation. Delivery coordinates not available.');
                }
              }
            }}
          >
            <MaterialIcons name="navigation" size={20} color={Colors.text.inverse} />
            <Text style={styles.startNavigationText}>Start Navigation</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
    </MapErrorBoundary>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  refreshButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.inverse,
    textAlign: 'center',
    marginHorizontal: 8,
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
  calculatingText: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    marginBottom: 8,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: Colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  backButtonAlt: {
    paddingVertical: 12,
  },
  backButtonAltText: {
    color: Colors.primary,
    fontSize: 16,
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
  routeLegend: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  routeLegendTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  routeLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  routeLegendLine: {
    width: 30,
    height: 4,
    borderRadius: 2,
    marginRight: 8,
  },
  routeLegendText: {
    fontSize: 12,
    color: Colors.text.primary,
  },
});
