import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import { realtimeService } from '../../services/RealtimeService';

interface ShipmentDetails {
  id: string;
  title: string;
  status: string;
  client_id: string;
  client_name: string;
  client_phone: string;
  pickup_address: string;
  pickup_city: string;
  pickup_state: string;
  pickup_zip: string;
  pickup_date: string;
  pickup_notes: string;
  delivery_address: string;
  delivery_city: string;
  delivery_state: string;
  delivery_zip: string;
  delivery_date: string;
  delivery_notes: string;
  distance: number;
  price: number;
  vehicle_type: string;
  cargo_type: string;
  weight: number;
  dimensions: string;
  created_at: string;
}

export default function ShipmentDetailsScreen({ route, navigation }: any) {
  const { shipmentId } = route.params;
  const [shipment, setShipment] = useState<ShipmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const { userProfile } = useAuth();
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    fetchShipmentDetails();
    
    // Set up real-time subscription
    if (shipmentId && userProfile) {
      setupRealtimeSubscription();
    }
    
    // Cleanup on unmount
    return () => {
      if (realtimeChannelRef.current) {
        realtimeService.unsubscribeFromShipment(shipmentId);
        realtimeChannelRef.current = null;
      }
    };
  }, [shipmentId, userProfile?.id]);

  const setupRealtimeSubscription = () => {
    // Subscribe to real-time updates for this shipment
    realtimeChannelRef.current = realtimeService.subscribeToShipment(
      shipmentId,
      // Shipment update handler
      (updatedShipment) => {
        console.log('Received real-time shipment update:', updatedShipment);
        
        // Transform data to match our expected format
        if (updatedShipment && shipment) {
          const transformedShipment: ShipmentDetails = {
            ...shipment,
            status: updatedShipment.status,
            // Update other fields as needed
          };
          
          setShipment(transformedShipment);
        } else {
          // If we don't have the shipment yet, fetch it
          fetchShipmentDetails();
        }
      },
      // New message handler (not needed in this screen)
      () => {},
      // Tracking event handler (not needed in this screen)
      () => {}
    );
  };

  const fetchShipmentDetails = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          profiles:client_id(first_name, last_name, phone)
        `)
        .eq('id', shipmentId)
        .single();

      if (error) throw error;

      // Transform data
      const transformedShipment: ShipmentDetails = {
        id: data.id,
        title: data.title || 'Delivery Service',
        status: data.status,
        client_id: data.client_id,
        client_name: (data as any).profiles 
          ? `${(data as any).profiles.first_name} ${(data as any).profiles.last_name}`
          : 'Unknown Customer',
        client_phone: (data as any).profiles?.phone || '',
        pickup_address: data.pickup_address || '',
        pickup_city: data.pickup_city || '',
        pickup_state: data.pickup_state || '',
        pickup_zip: data.pickup_zip || '',
        pickup_date: data.pickup_date || data.created_at,
        pickup_notes: data.pickup_notes || '',
        delivery_address: data.delivery_address || '',
        delivery_city: data.delivery_city || '',
        delivery_state: data.delivery_state || '',
        delivery_zip: data.delivery_zip || '',
        delivery_date: data.delivery_date || '',
        delivery_notes: data.delivery_notes || '',
        distance: data.distance || 0,
        price: data.estimated_price || 0,
        vehicle_type: data.vehicle_type || 'Any',
        cargo_type: data.cargo_type || 'General',
        weight: data.weight || 0,
        dimensions: data.dimensions || '',
        created_at: data.created_at,
      };

      setShipment(transformedShipment);
    } catch (error) {
      console.error('Error fetching shipment details:', error);
      Alert.alert('Error', 'Failed to load shipment details.');
    } finally {
      setLoading(false);
    }
  };

  const updateShipmentStatus = async (newStatus: string) => {
    if (!shipment) return;
    
    setStatusUpdating(true);
    try {
      // Import NetworkUtil on-demand
      const NetworkUtil = (await import('../../utils/NetworkUtil')).default;
      
      // Check for internet connection first
      const isConnected = await NetworkUtil.isConnected();
      if (!isConnected) {
        Alert.alert(
          'No Internet Connection',
          'Please check your internet connection and try again.'
        );
        setStatusUpdating(false);
        return;
      }
      
      // Validate status against schema
      const validStatuses = ['pending', 'accepted', 'assigned', 'in_transit', 'in_progress', 'delivered', 'completed', 'cancelled'];
      if (!validStatuses.includes(newStatus)) {
        Alert.alert('Error', `Invalid status: ${newStatus}. Please contact support.`);
        setStatusUpdating(false);
        return;
      }
      
      const { error } = await supabase
        .from('shipments')
        .update({ 
          status: newStatus as 'pending' | 'completed' | 'draft' | 'accepted' | 'assigned' | 'in_transit' | 'in_progress' | 'delivered' | 'cancelled' | 'picked_up' | 'open',
          updated_at: new Date().toISOString()
        })
        .eq('id', shipment.id);

      if (error) {
        if (error.message.includes('invalid input value for enum')) {
          Alert.alert(
            'Error', 
            'The status value is not valid. Please contact support about this database issue.',
            [{ text: 'OK' }]
          );
        } else {
          throw error;
        }
        return;
      }

      // Start location tracking if status is in_transit
      if (newStatus === 'in_transit' && userProfile) {
        realtimeService.startLocationTracking(
          shipment.id,
          userProfile.id,
          () => Alert.alert('Location Permission', 'Location permission is required to track delivery progress.')
        );
      }
      
      // Stop location tracking if delivered
      if (newStatus === 'delivered' || newStatus === 'completed' || newStatus === 'cancelled') {
        realtimeService.stopLocationTracking();
      }
      
      // Local state will be updated via real-time subscription
      Alert.alert('Success', `Shipment status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating shipment status:', error);
      Alert.alert('Error', 'Failed to update shipment status. Please check your connection and try again.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const openNavigationApp = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.google.com/maps?q=${encodedAddress}`;
    Linking.openURL(url);
  };

  const callCustomer = () => {
    if (shipment?.client_phone) {
      Linking.openURL(`tel:${shipment.client_phone}`);
    } else {
      Alert.alert('No Phone Number', 'Customer phone number is not available.');
    }
  };

  const openRouteMap = () => {
    if (shipment) {
      navigation.navigate('RouteMap', { shipmentId: shipment.id });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return Colors.warning;
      case 'assigned': return Colors.info;
      case 'picked_up': return Colors.secondary;
      case 'in_transit': return Colors.primary;
      case 'delivered': return Colors.success;
      case 'completed': return Colors.success;
      default: return Colors.text.secondary;
    }
  };

  const getNextStatusAction = () => {
    if (!shipment) return null;
    
    switch (shipment.status) {
      case 'assigned':
        return {
          label: 'Mark as Picked Up',
          status: 'picked_up',
          icon: 'check-circle',
          color: Colors.success
        };
      case 'picked_up':
        return {
          label: 'Start Transit',
          status: 'in_transit',
          icon: 'local-shipping',
          color: Colors.secondary
        };
      case 'in_transit':
        return {
          label: 'Mark as Delivered',
          status: 'delivered',
          icon: 'flag',
          color: Colors.primary
        };
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading shipment details...</Text>
      </View>
    );
  }

  if (!shipment) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={64} color={Colors.error} />
        <Text style={styles.errorTitle}>Shipment Not Found</Text>
        <Text style={styles.errorText}>The requested shipment could not be loaded.</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={fetchShipmentDetails}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const nextAction = getNextStatusAction();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.shipmentTitle}>{shipment.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(shipment.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(shipment.status) }]}>
              {shipment.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Customer Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.infoRow}>
            <MaterialIcons name="person" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>{shipment.client_name}</Text>
          </View>
          {shipment.client_phone && (
            <TouchableOpacity style={styles.infoRow} onPress={callCustomer}>
              <MaterialIcons name="phone" size={20} color={Colors.success} />
              <Text style={[styles.infoText, styles.phoneText]}>{shipment.client_phone}</Text>
              <MaterialIcons name="call" size={16} color={Colors.success} />
            </TouchableOpacity>
          )}
        </View>

        {/* Pickup Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup Details</Text>
          <TouchableOpacity 
            style={styles.addressContainer}
            onPress={() => openNavigationApp(shipment.pickup_address)}
          >
            <View style={styles.addressHeader}>
              <MaterialIcons name="location-on" size={20} color={Colors.secondary} />
              <Text style={styles.addressTitle}>Pickup Location</Text>
              <MaterialIcons name="directions" size={16} color={Colors.primary} />
            </View>
            <Text style={styles.addressText}>{shipment.pickup_address}</Text>
            {(shipment.pickup_city || shipment.pickup_state || shipment.pickup_zip) && (
              <Text style={styles.addressText}>
                {`${shipment.pickup_city}, ${shipment.pickup_state} ${shipment.pickup_zip}`.trim()}
              </Text>
            )}
          </TouchableOpacity>
          
          <View style={styles.infoRow}>
            <MaterialIcons name="schedule" size={20} color={Colors.warning} />
            <Text style={styles.infoText}>
              {new Date(shipment.pickup_date).toLocaleDateString()} at{' '}
              {new Date(shipment.pickup_date).toLocaleTimeString()}
            </Text>
          </View>
          
          {shipment.pickup_notes && (
            <View style={styles.notesContainer}>
              <MaterialIcons name="note" size={16} color={Colors.text.secondary} />
              <Text style={styles.notesText}>{shipment.pickup_notes}</Text>
            </View>
          )}
        </View>

        {/* Delivery Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Details</Text>
          <TouchableOpacity 
            style={styles.addressContainer}
            onPress={() => openNavigationApp(shipment.delivery_address)}
          >
            <View style={styles.addressHeader}>
              <MaterialIcons name="flag" size={20} color={Colors.primary} />
              <Text style={styles.addressTitle}>Delivery Location</Text>
              <MaterialIcons name="directions" size={16} color={Colors.primary} />
            </View>
            <Text style={styles.addressText}>{shipment.delivery_address}</Text>
            {(shipment.delivery_city || shipment.delivery_state || shipment.delivery_zip) && (
              <Text style={styles.addressText}>
                {`${shipment.delivery_city}, ${shipment.delivery_state} ${shipment.delivery_zip}`.trim()}
              </Text>
            )}
          </TouchableOpacity>
          
          {shipment.delivery_date && (
            <View style={styles.infoRow}>
              <MaterialIcons name="schedule" size={20} color={Colors.warning} />
              <Text style={styles.infoText}>
                Expected: {new Date(shipment.delivery_date).toLocaleDateString()} at{' '}
                {new Date(shipment.delivery_date).toLocaleTimeString()}
              </Text>
            </View>
          )}
          
          {shipment.delivery_notes && (
            <View style={styles.notesContainer}>
              <MaterialIcons name="note" size={16} color={Colors.text.secondary} />
              <Text style={styles.notesText}>{shipment.delivery_notes}</Text>
            </View>
          )}
        </View>

        {/* Shipment Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipment Details</Text>
          
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <MaterialIcons name="attach-money" size={20} color={Colors.success} />
              <Text style={styles.detailLabel}>Price</Text>
              <Text style={styles.detailValue}>${(shipment.price / 100).toFixed(2)}</Text>
            </View>
            
            {shipment.distance > 0 && (
              <View style={styles.detailItem}>
                <MaterialIcons name="straighten" size={20} color={Colors.info} />
                <Text style={styles.detailLabel}>Distance</Text>
                <Text style={styles.detailValue}>{shipment.distance.toFixed(1)} mi</Text>
              </View>
            )}
            
            <View style={styles.detailItem}>
              <MaterialIcons name="directions-car" size={20} color={Colors.secondary} />
              <Text style={styles.detailLabel}>Vehicle</Text>
              <Text style={styles.detailValue}>{shipment.vehicle_type}</Text>
            </View>
            
            {/* Cargo removed per requirements */}
          </View>
          
          {shipment.weight > 0 && (
            <View style={styles.infoRow}>
              <MaterialIcons name="fitness-center" size={20} color={Colors.text.secondary} />
              <Text style={styles.infoText}>Weight: {shipment.weight} lbs</Text>
            </View>
          )}
          
          {shipment.dimensions && (
            <View style={styles.infoRow}>
              <MaterialIcons name="square-foot" size={20} color={Colors.text.secondary} />
              <Text style={styles.infoText}>Dimensions: {shipment.dimensions}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.mapButton}
          onPress={openRouteMap}
        >
          <MaterialIcons name="map" size={20} color={Colors.primary} />
          <Text style={styles.mapButtonText}>View Route</Text>
        </TouchableOpacity>

        {nextAction && (
          <TouchableOpacity
            style={[styles.statusButton, { backgroundColor: nextAction.color }]}
            onPress={() => updateShipmentStatus(nextAction.status)}
            disabled={statusUpdating}
          >
            {statusUpdating ? (
              <ActivityIndicator size="small" color={Colors.background} />
            ) : (
              <>
                <MaterialIcons name={nextAction.icon as any} size={20} color={Colors.background} />
                <Text style={styles.statusButtonText}>{nextAction.label}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
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
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.background,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  shipmentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: 12,
    flex: 1,
  },
  phoneText: {
    color: Colors.success,
  },
  addressContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
    flex: 1,
  },
  addressText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  notesText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 8,
    flex: 1,
    fontStyle: 'italic',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailItem: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  actionContainer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  mapButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  mapButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: 8,
  },
  statusButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 8,
  },
  statusButtonText: {
    color: Colors.background,
    fontWeight: '600',
    marginLeft: 8,
  },
});
