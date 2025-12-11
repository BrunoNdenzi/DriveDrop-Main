import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { RealtimeChannel } from '@supabase/supabase-js';
import * as Sentry from '@sentry/react-native';
//import * as Sentry from '@sentry/react-native';

import { Colors } from '../../constants/Colors';
import { RootStackParamList } from '../../navigation/types';
import { supabase } from '../../lib/supabase';
import { realtimeService, DriverLocation } from '../../services/RealtimeService';

type TrackShipmentScreenProps = NativeStackScreenProps<RootStackParamList, 'TrackShipment'>;

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.05;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

interface Shipment {
  id: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  pickup_location?: any; // PostGIS geometry type
  delivery_location?: any; // PostGIS geometry type
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | null;
  driver_id?: string | null;
  created_at: string;
  estimated_delivery_time?: string | null;
  [key: string]: any; // Allow other database fields
}

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  avatar_url?: string | null;
}

const TRACKABLE_STATUSES = ['pickup_verified', 'picked_up', 'in_transit'];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Shipment Created',
  assigned: 'Driver Assigned',
  accepted: 'Driver Accepted',
  driver_en_route: 'Driver En Route to Pickup',
  driver_arrived: 'Driver Arrived at Pickup',
  pickup_verification_pending: 'Verifying Vehicle',
  pickup_verified: 'Vehicle Verified',
  picked_up: 'Vehicle Picked Up',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  completed: 'Completed',
};

export default function TrackShipmentScreen({ route, navigation }: TrackShipmentScreenProps) {
  const { shipmentId } = route.params;

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const [distance, setDistance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapRef = useRef<MapView | null>(null);
  const locationChannelRef = useRef<RealtimeChannel | null>(null);
  const shipmentChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    fetchShipmentData();

    return () => {
      if (locationChannelRef.current) {
        realtimeService.unsubscribeFromDriverLocation();
        locationChannelRef.current = null;
      }
      if (shipmentChannelRef.current) {
        realtimeService.unsubscribeFromShipment(shipmentId);
        shipmentChannelRef.current = null;
      }
    };
  }, [shipmentId]);

  // Subscribe to location updates when shipment is trackable
  useEffect(() => {
    if (shipment && TRACKABLE_STATUSES.includes(shipment.status)) {
      subscribeToLocationUpdates();
    }

    return () => {
      if (locationChannelRef.current) {
        realtimeService.unsubscribeFromDriverLocation();
        locationChannelRef.current = null;
      }
    };
  }, [shipment]);

  async function fetchShipmentData() {
    try {
      setLoading(true);

      // Fetch shipment data
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', shipmentId)
        .single();

      if (shipmentError) throw shipmentError;

      setShipment(shipmentData);

      // Fetch driver if assigned
      if (shipmentData.driver_id) {
        const { data: driverData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, phone, avatar_url')
          .eq('id', shipmentData.driver_id)
          .single();

        if (driverData) {
          setDriver(driverData);
        }

        // Fetch latest location
        await fetchLatestLocation(shipmentData.driver_id);
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching shipment data:', err);
      Sentry.captureException(err, {
        tags: { screen: 'TrackShipment', action: 'fetchShipmentData' },
        contexts: { shipment: { shipmentId } },
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchLatestLocation(driverId: string) {
    const { data } = await supabase
      .from('driver_locations')
      .select('*')
      .eq('shipment_id', shipmentId)
      .eq('driver_id', driverId)
      .order('location_timestamp', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      const location: DriverLocation = {
        shipment_id: shipmentId,
        driver_id: driverId,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        accuracy: data.accuracy ? Number(data.accuracy) : null,
        speed: data.speed ? Number(data.speed) : null,
        heading: data.heading ? Number(data.heading) : null,
        location_timestamp: data.location_timestamp,
      };
      setDriverLocation(location);
      calculateETA(location);
    }
  }

  function subscribeToLocationUpdates() {
    locationChannelRef.current = realtimeService.subscribeToDriverLocation(
      shipmentId,
      (location) => {
        console.log('📍 Received driver location update:', location);
        setDriverLocation(location);
        calculateETA(location);
      }
    );

    // Also subscribe to shipment updates
    shipmentChannelRef.current = realtimeService.subscribeToShipment(
      shipmentId,
      (updatedShipment) => {
        console.log('📦 Received shipment update:', updatedShipment);
        setShipment((current) => ({
          ...current!,
          ...updatedShipment,
        }));
      },
      () => {},
      () => {}
    );
  }

  async function calculateETA(location: DriverLocation) {
    if (!shipment || !shipment.delivery_location) return;

    try {
      const deliveryLat = shipment.delivery_location.y;
      const deliveryLng = shipment.delivery_location.x;

      // Validate coordinates
      if (
        typeof deliveryLat !== 'number' ||
        typeof deliveryLng !== 'number' ||
        typeof location.latitude !== 'number' ||
        typeof location.longitude !== 'number'
      ) {
        console.warn('Invalid coordinates for ETA calculation');
        Sentry.captureMessage('Invalid coordinates in calculateETA', {
          level: 'warning',
          tags: { screen: 'TrackShipment', action: 'calculateETA' },
          contexts: {
            location: {
              driverLat: location.latitude,
              driverLng: location.longitude,
              deliveryLat,
              deliveryLng,
            },
          },
        });
        return;
      }

      // Calculate straight-line distance
      const R = 6371; // Earth's radius in km
      const dLat = ((deliveryLat - location.latitude) * Math.PI) / 180;
      const dLon = ((deliveryLng - location.longitude) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((location.latitude * Math.PI) / 180) *
          Math.cos((deliveryLat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanceKm = R * c;
      const distanceMiles = distanceKm * 0.621371;

      setDistance(`${distanceMiles.toFixed(1)} miles`);

      // Estimate ETA (assuming average speed of 55 mph)
      const averageSpeedMph = 55;
      const hoursToDestination = distanceMiles / averageSpeedMph;
      const minutesToDestination = Math.round(hoursToDestination * 60);

      if (minutesToDestination < 60) {
        setEta(`${minutesToDestination} min`);
      } else {
        const hours = Math.floor(minutesToDestination / 60);
        const minutes = minutesToDestination % 60;
        setEta(`${hours}h ${minutes}m`);
      }
    } catch (err: any) {
      console.error('Error calculating ETA:', err);
      Sentry.captureException(err, {
        tags: { screen: 'TrackShipment', action: 'calculateETA' },
      });
    }
  }

  function centerMapOnRoute() {
    if (!mapRef.current || !shipment || !driverLocation) return;

    try {
      const coordinates = [];

      // Add driver location with validation
      if (
        typeof driverLocation.latitude === 'number' && 
        typeof driverLocation.longitude === 'number'
      ) {
        coordinates.push({
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
        });
      }

      // Add delivery location with validation
      if (
        shipment.delivery_location &&
        typeof shipment.delivery_location.y === 'number' &&
        typeof shipment.delivery_location.x === 'number'
      ) {
        coordinates.push({
          latitude: shipment.delivery_location.y,
          longitude: shipment.delivery_location.x,
        });
      }

      if (coordinates.length > 0) {
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
          animated: true,
        });
      }
    } catch (err: any) {
      console.error('Error centering map:', err);
      Sentry.captureException(err, {
        tags: { screen: 'TrackShipment', action: 'centerMapOnRoute' },
      });
    }
  }

  function handleCallDriver() {
    if (driver?.phone) {
      Linking.openURL(`tel:${driver.phone}`);
    }
  }

  function handleMessageDriver() {
    if (!driver) return;
    navigation.navigate('ChatScreen', { 
      shipmentId, 
      otherUserId: driver.id,
      otherUserName: `${driver.first_name} ${driver.last_name}`,
      otherUserRole: 'driver'
    });
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading tracking information...</Text>
      </View>
    );
  }

  if (error || !shipment) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={64} color={Colors.error} />
        <Text style={styles.errorText}>{error || 'Failed to load tracking data'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchShipmentData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isTrackingActive = TRACKABLE_STATUSES.includes(shipment.status);

  if (!isTrackingActive) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="location-off" size={64} color={Colors.text.secondary} />
        <Text style={styles.infoTitle}>Tracking Not Available</Text>
        <Text style={styles.infoText}>
          Live tracking will be available once your vehicle is picked up.
        </Text>
        <Text style={styles.statusText}>
          Current Status: {STATUS_LABELS[shipment.status] || shipment.status}
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Back to Shipment Details</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pickupCoords = shipment.pickup_location && 
    typeof shipment.pickup_location.y === 'number' &&
    typeof shipment.pickup_location.x === 'number'
    ? {
        latitude: shipment.pickup_location.y,
        longitude: shipment.pickup_location.x,
      }
    : null;

  const deliveryCoords = shipment.delivery_location &&
    typeof shipment.delivery_location.y === 'number' &&
    typeof shipment.delivery_location.x === 'number'
    ? {
        latitude: shipment.delivery_location.y,
        longitude: shipment.delivery_location.x,
      }
    : null;

  const initialRegion = driverLocation
    ? {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      }
    : deliveryCoords
    ? {
        latitude: deliveryCoords.latitude,
        longitude: deliveryCoords.longitude,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      }
    : undefined;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Map */}
      <View style={styles.mapContainer}>
        {initialRegion ? (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={initialRegion}
            onMapReady={centerMapOnRoute}
          >
            {/* Pickup marker */}
            {pickupCoords && (
              <Marker coordinate={pickupCoords} title="Pickup Location" pinColor="blue" />
            )}

            {/* Delivery marker */}
            {deliveryCoords && (
              <Marker coordinate={deliveryCoords} title="Delivery Location" pinColor="red" />
            )}

            {/* Driver marker */}
            {driverLocation && 
             typeof driverLocation.latitude === 'number' &&
             typeof driverLocation.longitude === 'number' && (
              <Marker
                coordinate={{
                  latitude: driverLocation.latitude,
                  longitude: driverLocation.longitude,
                }}
                title={driver ? `${driver.first_name} ${driver.last_name}` : 'Driver'}
                description="Your driver's current location"
              >
                <View style={styles.driverMarker}>
                  <MaterialIcons name="local-shipping" size={24} color="white" />
                </View>
              </Marker>
            )}

            {/* Route polyline */}
            {driverLocation && 
             deliveryCoords &&
             typeof driverLocation.latitude === 'number' &&
             typeof driverLocation.longitude === 'number' && (
              <Polyline
                coordinates={[
                  {
                    latitude: driverLocation.latitude,
                    longitude: driverLocation.longitude,
                  },
                  deliveryCoords,
                ]}
                strokeColor={Colors.primary}
                strokeWidth={3}
                lineDashPattern={[10, 5]}
              />
            )}
          </MapView>
        ) : (
          <View style={styles.noMapContainer}>
            <MaterialIcons name="map" size={64} color={Colors.text.secondary} />
            <Text style={styles.noMapText}>Map loading...</Text>
          </View>
        )}

        {/* Center button */}
        <TouchableOpacity style={styles.centerButton} onPress={centerMapOnRoute}>
          <MaterialIcons name="my-location" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Info panel */}
      <View style={styles.infoPanel}>
        <ScrollView contentContainerStyle={styles.infoPanelContent}>
          {/* Status */}
          <View style={styles.statusContainer}>
            <View style={styles.statusHeader}>
              <MaterialIcons name="local-shipping" size={24} color={Colors.primary} />
              <Text style={styles.statusTitle}>
                {STATUS_LABELS[shipment.status] || shipment.status}
              </Text>
            </View>
            {eta && distance && (
              <View style={styles.etaContainer}>
                <View style={styles.etaItem}>
                  <MaterialIcons name="access-time" size={20} color={Colors.text.secondary} />
                  <Text style={styles.etaText}>{eta}</Text>
                </View>
                <View style={styles.etaDivider} />
                <View style={styles.etaItem}>
                  <MaterialIcons name="straighten" size={20} color={Colors.text.secondary} />
                  <Text style={styles.etaText}>{distance}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Driver info */}
          {driver && (
            <View style={styles.driverCard}>
              <View style={styles.driverHeader}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverInitials}>
                    {driver.first_name.charAt(0)}
                    {driver.last_name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>
                    {driver.first_name} {driver.last_name}
                  </Text>
                  <Text style={styles.driverLabel}>Your Driver</Text>
                </View>
              </View>

              <View style={styles.driverActions}>
                {driver.phone && (
                  <TouchableOpacity style={styles.actionButton} onPress={handleCallDriver}>
                    <MaterialIcons name="phone" size={20} color="white" />
                    <Text style={styles.actionButtonText}>Call</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, styles.messageButton]}
                  onPress={handleMessageDriver}
                >
                  <MaterialIcons name="message" size={20} color="white" />
                  <Text style={styles.actionButtonText}>Message</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Shipment details */}
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Shipment Details</Text>

            {shipment.vehicle_year && shipment.vehicle_make && shipment.vehicle_model && (
              <View style={styles.detailRow}>
                <MaterialIcons name="directions-car" size={20} color={Colors.text.secondary} />
                <Text style={styles.detailText}>
                  {shipment.vehicle_year} {shipment.vehicle_make} {shipment.vehicle_model}
                </Text>
              </View>
            )}

            <View style={styles.detailRow}>
              <MaterialIcons name="location-on" size={20} color={Colors.success} />
              <View style={styles.addressContainer}>
                <Text style={styles.addressLabel}>From</Text>
                <Text style={styles.addressText}>{shipment.pickup_address}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <MaterialIcons name="location-on" size={20} color={Colors.error} />
              <View style={styles.addressContainer}>
                <Text style={styles.addressLabel}>To</Text>
                <Text style={styles.addressText}>{shipment.delivery_address}</Text>
              </View>
            </View>
          </View>

          {/* Location update timestamp */}
          {driverLocation && (
            <View style={styles.updateInfo}>
              <MaterialIcons name="info-outline" size={16} color={Colors.text.secondary} />
              <Text style={styles.updateText}>
                Last updated: {new Date(driverLocation.location_timestamp).toLocaleTimeString()}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  infoText: {
    marginTop: 8,
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  statusText: {
    marginTop: 16,
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  mapContainer: {
    height: height * 0.5,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  noMapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.border,
  },
  noMapText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  driverMarker: {
    width: 40,
    height: 40,
    backgroundColor: Colors.primary,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  centerButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 48,
    height: 48,
    backgroundColor: 'white',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  infoPanel: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  infoPanelContent: {
    padding: 20,
  },
  statusContainer: {
    marginBottom: 20,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    marginLeft: 8,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
  },
  etaItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  etaText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  driverCard: {
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  driverInfo: {
    marginLeft: 12,
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  driverLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  driverActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  messageButton: {
    backgroundColor: Colors.secondary,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  detailsCard: {
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailText: {
    marginLeft: 12,
    fontSize: 15,
    color: Colors.text.primary,
  },
  addressContainer: {
    marginLeft: 12,
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 2,
    fontWeight: '500',
  },
  addressText: {
    fontSize: 15,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  updateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  updateText: {
    marginLeft: 6,
    fontSize: 13,
    color: Colors.text.secondary,
  },
});
