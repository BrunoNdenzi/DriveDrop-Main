import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { getCurrentLocation, getRoute } from '../../utils/maps';

const { width, height } = Dimensions.get('window');

interface RouteMapScreenProps {
  route: {
    params: {
      jobId: string;
    };
  };
  navigation: any;
}

export default function RouteMapScreen({ route, navigation }: RouteMapScreenProps) {
  const { jobId } = route.params;
  const { userProfile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    fetchJobDetails();
    startLocationTracking();
    
    return () => {
      // Clean up location subscription if needed
    };
  }, [jobId]);

  const fetchJobDetails = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', jobId)
        .single();
      
      if (error) throw error;
      
      setJob(data);
      
      // Get current location
      const location = await getCurrentLocation();
      if (location) {
        setCurrentLocation(location);
        
        // Generate route if we have pickup/delivery coordinates
        if (data.pickup_lat && data.pickup_lng && data.delivery_lat && data.delivery_lng) {
          // For jobs that are already picked up, route from current location to delivery
          if (data.status === 'picked_up' || data.status === 'in_transit') {
            calculateRoute(
              location.coords.latitude,
              location.coords.longitude,
              data.delivery_lat,
              data.delivery_lng
            );
          } else {
            // For jobs not yet picked up, route from current location to pickup
            calculateRoute(
              location.coords.latitude,
              location.coords.longitude,
              data.pickup_lat,
              data.pickup_lng
            );
          }
        }
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
      Alert.alert('Error', 'Failed to load job details.');
    } finally {
      setLoading(false);
    }
  };

  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for route tracking.');
        return;
      }
      
      // Get initial location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      setCurrentLocation(location);
      
      // Set up location tracking
      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10, // Update every 10 meters
        },
        (newLocation) => {
          setCurrentLocation(newLocation);
          
          // Update route if needed
          if (job && (job.status === 'picked_up' || job.status === 'in_transit')) {
            calculateRoute(
              newLocation.coords.latitude,
              newLocation.coords.longitude,
              job.delivery_lat,
              job.delivery_lng
            );
          } else if (job) {
            calculateRoute(
              newLocation.coords.latitude,
              newLocation.coords.longitude,
              job.pickup_lat,
              job.pickup_lng
            );
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
    if (!job) return null;
    
    // For jobs that are already picked up, show delivery location
    if (job.status === 'picked_up' || job.status === 'in_transit') {
      if (job.delivery_lat && job.delivery_lng) {
        return (
          <Marker
            coordinate={{
              latitude: job.delivery_lat,
              longitude: job.delivery_lng,
            }}
            title="Delivery Location"
            description={job.delivery_address}
          >
            <MaterialIcons name="flag" size={30} color={Colors.secondary} />
          </Marker>
        );
      }
    } else {
      // For jobs not yet picked up, show pickup location
      if (job.pickup_lat && job.pickup_lng) {
        return (
          <Marker
            coordinate={{
              latitude: job.pickup_lat,
              longitude: job.pickup_lng,
            }}
            title="Pickup Location"
            description={job.pickup_address}
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
          {job ? job.title || `Job #${job.id.substring(0, 8)}` : 'Route Map'}
        </Text>
      </View>
      
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
});
