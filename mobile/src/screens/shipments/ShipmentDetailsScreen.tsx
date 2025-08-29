import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { RealtimeChannel } from '@supabase/supabase-js';

import { Colors } from '../../constants/Colors';
import { RootStackParamList } from '../../navigation/types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  realtimeService,
  DriverLocation,
} from '../../services/RealtimeService';
import { Shipment } from '../../types/shipment';

type ShipmentDetailsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ShipmentDetails'
>;

export default function ShipmentDetailsScreen({
  route,
  navigation,
}: ShipmentDetailsScreenProps) {
  const { shipmentId } = route.params;
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(
    null
  );
  const { user: _user } = useAuth(); // TODO: Will be used for permission checks
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const locationChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    loadShipmentDetails();

    // Set up real-time subscription
    if (shipmentId) {
      setupRealtimeSubscription();
    }

    // Clean up on unmount
    return () => {
      if (realtimeChannelRef.current) {
        realtimeService.unsubscribeFromShipment(shipmentId);
        realtimeChannelRef.current = null;
      }

      if (locationChannelRef.current) {
        realtimeService.unsubscribeFromDriverLocation();
        locationChannelRef.current = null;
      }
    };
  }, [shipmentId]);

  const setupRealtimeSubscription = () => {
    // Subscribe to real-time updates for this shipment
    realtimeChannelRef.current = realtimeService.subscribeToShipment(
      shipmentId,
      // Shipment update handler
      updatedShipment => {
        console.log('Received real-time shipment update:', updatedShipment);
        setShipment((current: Shipment | null) => ({
          ...current,
          ...updatedShipment,
        }));
      },
      // New message handler (not used in this screen)
      () => {},
      // Tracking event handler (not used in this screen)
      () => {}
    );

    // Subscribe to driver location updates if shipment is in progress
    if (shipment && ['picked_up', 'in_transit'].includes(shipment.status)) {
      locationChannelRef.current = realtimeService.subscribeToDriverLocation(
        shipmentId,
        location => {
          console.log('Received driver location update:', location);
          setDriverLocation(location);
        }
      );
    }
  };

  async function loadShipmentDetails() {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', shipmentId)
        .single();

      if (fetchError) {
        console.error('Error fetching shipment:', fetchError);
        setError(fetchError.message);
        return;
      }

      setShipment(data);
    } catch (err) {
      console.error('Error loading shipment details:', err);
      setError('Failed to load shipment details');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelShipment() {
    Alert.alert(
      'Cancel Shipment',
      'Are you sure you want to cancel this shipment?',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error: updateError } = await supabase
                .from('shipments')
                .update({
                  status: 'cancelled',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', shipmentId);

              if (updateError) {
                console.error('Error cancelling shipment:', updateError);
                Alert.alert('Error', 'Failed to cancel shipment');
                return;
              }

              // Local state will be updated by real-time subscription
              Alert.alert('Success', 'Shipment cancelled successfully');
            } catch (err) {
              console.error('Error cancelling shipment:', err);
              Alert.alert('Error', 'Failed to cancel shipment');
            }
          },
        },
      ]
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return Colors.warning;
      case 'in_transit':
        return Colors.primary;
      case 'delivered':
        return Colors.success;
      case 'cancelled':
        return Colors.error;
      default:
        return Colors.text.secondary;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading shipment details...</Text>
      </View>
    );
  }

  if (error || !shipment) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          {error || 'Failed to load shipment details'}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadShipmentDetails}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.trackingContainer}>
            <Text style={styles.trackingLabel}>Tracking Number</Text>
            <Text style={styles.trackingNumber}>
              #{shipment.tracking_number}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(shipment.status) },
            ]}
          >
            <Text style={styles.statusText}>
              {shipment.status?.charAt(0).toUpperCase() +
                shipment.status?.slice(1).replace('_', ' ')}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipment Details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Created</Text>
            <Text style={styles.detailValue}>
              {formatDate(shipment.created_at)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Est. Delivery</Text>
            <Text style={styles.detailValue}>
              {formatDate(shipment.estimated_delivery)}
            </Text>
          </View>

          {shipment.delivered_at && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Delivered</Text>
              <Text style={styles.detailValue}>
                {formatDate(shipment.delivered_at)}
              </Text>
            </View>
          )}

          {shipment.price && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Price</Text>
              <Text style={styles.detailValue}>
                ${shipment.price.toFixed(2)}
              </Text>
            </View>
          )}

          {shipment.weight && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Weight</Text>
              <Text style={styles.detailValue}>{shipment.weight} kg</Text>
            </View>
          )}

          {shipment.dimensions && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Dimensions</Text>
              <Text style={styles.detailValue}>{shipment.dimensions}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Addresses</Text>

          <View style={styles.addressContainer}>
            <Text style={styles.addressLabel}>From</Text>
            <Text style={styles.addressValue}>{shipment.origin_address}</Text>
          </View>

          <View style={styles.addressContainer}>
            <Text style={styles.addressLabel}>To</Text>
            <Text style={styles.addressValue}>
              {shipment.destination_address}
            </Text>
          </View>
        </View>

        {shipment.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{shipment.notes}</Text>
          </View>
        )}

        {shipment.status !== 'delivered' && shipment.status !== 'cancelled' && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelShipment}
            >
              <Text style={styles.cancelButtonText}>Cancel Shipment</Text>
            </TouchableOpacity>
          </View>
        )}

        {shipment.status === 'in_transit' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Track Delivery</Text>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                navigation.navigate('RouteMap', { shipmentId: shipment.id })
              }
            >
              <MaterialIcons name="map" size={20} color={Colors.background} />
              <Text style={styles.actionButtonText}>Track on Map</Text>
            </TouchableOpacity>

            {driverLocation && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Last updated</Text>
                <Text style={styles.detailValue}>
                  {formatDate(driverLocation.location_timestamp)}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.text.inverse,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  trackingContainer: {
    flex: 1,
  },
  trackingLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  trackingNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  addressContainer: {
    marginBottom: 16,
  },
  addressLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  addressValue: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  notes: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  actionsContainer: {
    marginBottom: 24,
  },
  cancelButton: {
    backgroundColor: Colors.error,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 12,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
});
