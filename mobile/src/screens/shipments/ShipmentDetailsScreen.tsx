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
import { realtimeService, DriverLocation } from '../../services/RealtimeService';
import ClientPickupAlertModal from '../../components/ClientPickupAlertModal';

type ShipmentDetailsScreenProps = NativeStackScreenProps<RootStackParamList, 'ShipmentDetails'>;

interface CancellationEligibility {
  eligible: boolean;
  reason?: string;
  refund_eligible?: boolean;
  refund_amount?: number;
  refund_percentage?: number;
  message?: string;
}

export default function ShipmentDetailsScreen({ route, navigation }: ShipmentDetailsScreenProps) {
  const { shipmentId } = route.params;
  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [pickupVerification, setPickupVerification] = useState<any>(null);
  const [showVerificationAlert, setShowVerificationAlert] = useState(false);
  const { user } = useAuth();
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const locationChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    loadShipmentDetails();
    loadPickupVerification();
    
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
      (updatedShipment) => {
        console.log('Received real-time shipment update:', updatedShipment);
        setShipment((current: any) => ({
          ...current,
          ...updatedShipment
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
        (location) => {
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

  async function loadPickupVerification() {
    try {
      const { data, error: fetchError } = await supabase
        .from('pickup_verifications')
        .select('*')
        .eq('shipment_id', shipmentId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching pickup verification:', fetchError);
        return;
      }

      if (data) {
        setPickupVerification(data);
        
        // Show alert modal if verification has minor differences and pending client response
        if (data.verification_status === 'minor_differences' && !data.client_response) {
          setShowVerificationAlert(true);
        }
      }
    } catch (err) {
      console.error('Error loading pickup verification:', err);
    }
  }

  async function handleCancelShipment() {
    try {
      // First, check cancellation eligibility
      const { data: eligibilityData, error: eligibilityError } = await supabase
        .rpc('check_cancellation_eligibility', { p_shipment_id: shipmentId } as any);

      if (eligibilityError) {
        console.error('Error checking cancellation eligibility:', eligibilityError);
        Alert.alert('Error', 'Failed to check cancellation eligibility');
        return;
      }

      const eligibility = eligibilityData as CancellationEligibility | null;

      if (!eligibility || !eligibility.eligible) {
        Alert.alert(
          'Cannot Cancel',
          eligibility?.reason || 'This shipment cannot be cancelled at this time'
        );
        return;
      }

      // Show confirmation with refund information
      const refundInfo = eligibility.refund_eligible
        ? `\n\n💰 Refund: $${(eligibility.refund_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${eligibility.refund_percentage}%)\n${eligibility.message}`
        : '\n\n⚠️ No refund available for this cancellation';

      Alert.alert(
        'Cancel Shipment',
        `Are you sure you want to cancel this shipment?${refundInfo}`,
        [
          {
            text: 'No, Keep Shipment',
            style: 'cancel',
          },
          {
            text: 'Yes, Cancel',
            style: 'destructive',
            onPress: async () => {
              try {
                // Update shipment status to cancelled
                const { error: updateError } = await supabase
                  .from('shipments')
                  .update({ 
                    status: 'cancelled' as const,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', shipmentId);
                
                if (updateError) {
                  console.error('Error cancelling shipment:', updateError);
                  Alert.alert('Error', 'Failed to cancel shipment. Please try again.');
                  return;
                }

                // Show success message with refund info
                const successMessage = eligibility.refund_eligible
                  ? `Your shipment has been cancelled and a refund of $${(eligibility.refund_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} will be processed within 5-10 business days.`
                  : 'Your shipment has been cancelled.';

                Alert.alert('Cancelled Successfully', successMessage, [
                  {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                  },
                ]);
              } catch (err) {
                console.error('Error cancelling shipment:', err);
                Alert.alert('Error', 'Failed to cancel shipment. Please try again.');
              }
            },
          },
        ]
      );
    } catch (err) {
      console.error('Error in handleCancelShipment:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return Colors.warning;
      case 'accepted':
      case 'assigned':
        return Colors.secondary;
      case 'driver_en_route':
        return Colors.secondary;
      case 'driver_arrived':
        return Colors.primary;
      case 'pickup_verification_pending':
        return Colors.warning;
      case 'pickup_verified':
        return Colors.success;
      case 'picked_up':
        return Colors.primary;
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
          {/* Tracking number temporarily hidden until feature finalized */}
          <View style={styles.trackingContainer}>
            <Text style={styles.trackingLabel}>Shipment</Text>
            <Text style={styles.trackingNumber}>#{(shipment.id || '').toString().slice(0,8)}</Text>
          </View>
          
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(shipment.status) },
            ]}
          >
            <Text style={styles.statusText}>
              {shipment.status?.charAt(0).toUpperCase() + shipment.status?.slice(1).replace('_', ' ')}
            </Text>
          </View>
        </View>

        {/* Pickup Verification Status */}
        {pickupVerification && (
          <View style={styles.verificationCard}>
            <View style={styles.verificationHeader}>
              <MaterialIcons 
                name={pickupVerification.verification_status === 'matches' ? 'check-circle' : 
                      pickupVerification.verification_status === 'minor_differences' ? 'warning' : 
                      'error'} 
                size={24} 
                color={pickupVerification.verification_status === 'matches' ? Colors.success : 
                       pickupVerification.verification_status === 'minor_differences' ? Colors.warning : 
                       Colors.error} 
              />
              <Text style={styles.verificationTitle}>Pickup Verification</Text>
            </View>
            
            <View style={styles.verificationStatus}>
              <Text style={styles.verificationLabel}>Status:</Text>
              <Text style={[
                styles.verificationValue,
                { color: pickupVerification.verification_status === 'matches' ? Colors.success : 
                         pickupVerification.verification_status === 'minor_differences' ? Colors.warning : 
                         Colors.error }
              ]}>
                {pickupVerification.verification_status === 'matches' ? 'Vehicle Matches' :
                 pickupVerification.verification_status === 'minor_differences' ? 'Minor Differences Found' :
                 'Major Issues Reported'}
              </Text>
            </View>
            
            {pickupVerification.verification_completed_at && (
              <View style={styles.verificationDetail}>
                <Text style={styles.verificationLabel}>Verified at:</Text>
                <Text style={styles.verificationValue}>
                  {formatDate(pickupVerification.verification_completed_at)}
                </Text>
              </View>
            )}
            
            {pickupVerification.verification_status === 'minor_differences' && !pickupVerification.client_response && (
              <View style={styles.verificationAlert}>
                <MaterialIcons name="access-time" size={16} color={Colors.warning} />
                <Text style={styles.verificationAlertText}>
                  Awaiting your response - Please review the verification photos
                </Text>
              </View>
            )}
            
            {pickupVerification.client_response && (
              <View style={styles.verificationDetail}>
                <Text style={styles.verificationLabel}>Your Response:</Text>
                <Text style={[
                  styles.verificationValue,
                  { color: pickupVerification.client_response === 'approved' ? Colors.success : Colors.error }
                ]}>
                  {pickupVerification.client_response === 'approved' ? 'Approved' : 'Disputed'}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipment Details</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Created</Text>
            <Text style={styles.detailValue}>{formatDate(shipment.created_at)}</Text>
          </View>
          
          {shipment.estimated_delivery && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Est. Delivery</Text>
              <Text style={styles.detailValue}>
                {formatDate(shipment.estimated_delivery)}
              </Text>
            </View>
          )}
          
          {shipment.delivered_at && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Delivered</Text>
              <Text style={styles.detailValue}>{formatDate(shipment.delivered_at)}</Text>
            </View>
          )}
          
      {(shipment.estimated_price) && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Price</Text>
        <Text style={styles.detailValue}>${Number(shipment.estimated_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
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
            <Text style={styles.addressValue}>{shipment.origin_address || shipment.pickup_address}</Text>
          </View>
          
          <View style={styles.addressContainer}>
            <Text style={styles.addressLabel}>To</Text>
            <Text style={styles.addressValue}>{shipment.destination_address || shipment.delivery_address}</Text>
          </View>
        </View>

        {shipment.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{shipment.notes}</Text>
          </View>
        )}

        {/* Only show cancel button for pending shipments with no driver assigned */}
        {shipment.status === 'pending' && !shipment.driver_id && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelShipment}
            >
              <Text style={styles.cancelButtonText}>Cancel Shipment</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Live Tracking for Active Shipments */}
        {(['pickup_verified', 'picked_up', 'in_transit'].includes(shipment.status)) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Live Tracking</Text>
            
            <TouchableOpacity
              style={styles.trackLiveButton}
              onPress={() => navigation.navigate('TrackShipment', { shipmentId: shipment.id })}
            >
              <MaterialIcons name="my-location" size={24} color="white" />
              <Text style={styles.trackLiveButtonText}>Track Live Location</Text>
            </TouchableOpacity>
            
            {driverLocation && (
              <View style={styles.lastLocationUpdate}>
                <MaterialIcons name="access-time" size={16} color={Colors.text.secondary} />
                <Text style={styles.lastLocationText}>
                  Last updated: {new Date(driverLocation.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      
      {/* Client Pickup Verification Alert Modal */}
      {pickupVerification && (
        <ClientPickupAlertModal
          visible={showVerificationAlert}
          onClose={() => {
            setShowVerificationAlert(false);
            loadPickupVerification(); // Reload to get updated status
          }}
          verification={pickupVerification}
          shipmentId={shipmentId}
        />
      )}
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
  verificationCard: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  verificationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 12,
  },
  verificationStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  verificationDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  verificationLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  verificationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  verificationAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '20',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  verificationAlertText: {
    fontSize: 14,
    color: Colors.warning,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  trackLiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  trackLiveButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
  },
  lastLocationUpdate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  lastLocationText: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
});
