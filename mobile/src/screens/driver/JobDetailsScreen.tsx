import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface JobDetails {
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

export default function JobDetailsScreen({ route, navigation }: any) {
  const { jobId } = route.params;
  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const { userProfile } = useAuth();

  useEffect(() => {
    fetchJobDetails();
  }, [jobId]);

  const fetchJobDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          profiles:client_id(first_name, last_name, phone)
        `)
        .eq('id', jobId)
        .single();

      if (error) throw error;

      if (data) {
        setJob({
          id: data.id,
          title: `Shipment #${data.id.substring(0, 8)}`,
          status: data.status,
          client_id: data.client_id,
          client_name: (data as any).profiles ? `${(data as any).profiles.first_name} ${(data as any).profiles.last_name}` : 'Client',
          client_phone: (data as any).profiles?.phone || 'Not provided',
          pickup_address: data.pickup_address || 'Address not specified',
          pickup_city: data.pickup_city || '',
          pickup_state: data.pickup_state || '',
          pickup_zip: data.pickup_zip || '',
          pickup_date: data.pickup_date || new Date().toISOString(),
          pickup_notes: data.pickup_notes || 'No additional notes',
          delivery_address: data.delivery_address || 'Address not specified',
          delivery_city: data.delivery_city || '',
          delivery_state: data.delivery_state || '',
          delivery_zip: data.delivery_zip || '',
          delivery_date: data.delivery_date || '',
          delivery_notes: data.delivery_notes || 'No additional notes',
          distance: data.distance || 0,
          price: data.price || 0,
          vehicle_type: data.vehicle_type || 'Standard',
          cargo_type: data.cargo_type || 'General',
          weight: data.weight || 0,
          dimensions: data.dimensions || 'Not specified',
          created_at: data.created_at,
        });
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
      Alert.alert('Error', 'Failed to load job details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateJobStatus = async (newStatus: string) => {
    if (!job || !userProfile) return;

    try {
      setStatusUpdating(true);

      // For status transitions that require location
      let locationData = {};
      if (['in_transit', 'delivered'].includes(newStatus)) {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Location permission is required to update job status.');
            setStatusUpdating(false);
            return;
          }

          const location = await Location.getCurrentPositionAsync({});
          locationData = {
            [`${newStatus}_lat`]: location.coords.latitude,
            [`${newStatus}_lng`]: location.coords.longitude,
            [`${newStatus}_time`]: new Date().toISOString(),
          };
        } catch (err) {
          console.error('Error getting location:', err);
          Alert.alert('Location Error', 'Unable to get your current location. Please try again.');
          setStatusUpdating(false);
          return;
        }
      }

      // Update the shipment status
      const { error } = await supabase
        .from('shipments')
        .update({
          status: newStatus as 'pending' | 'completed' | 'draft' | 'accepted' | 'assigned' | 'in_transit' | 'in_progress' | 'delivered' | 'cancelled' | 'picked_up' | 'open',
          updated_at: new Date().toISOString(),
          ...locationData,
        })
        .eq('id', job.id);

      if (error) throw error;

      // Log the status change
      await supabase.from('shipment_status_history').insert([
        {
          shipment_id: job.id,
          status: newStatus as 'pending' | 'completed' | 'draft' | 'accepted' | 'assigned' | 'in_transit' | 'in_progress' | 'delivered' | 'cancelled' | 'picked_up' | 'open',
          changed_by: userProfile.id,
          changed_at: new Date().toISOString(),
          notes: `Status updated to ${newStatus} by driver`,
          location_lat: (locationData as Record<string, any>)[`${newStatus}_lat`] || null,
          location_lng: (locationData as Record<string, any>)[`${newStatus}_lng`] || null,
        },
      ]);

      Alert.alert('Success', `Job status updated to ${getStatusLabel(newStatus)}`);
      
      // Refresh job details
      fetchJobDetails();
    } catch (error) {
      console.error('Error updating job status:', error);
      Alert.alert('Error', 'Failed to update job status. Please try again.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'accepted':
        return 'Accepted';
      case 'in_transit':
        return 'In Transit';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getStatusColor = (status: string) => {
    return Colors.status[status as keyof typeof Colors.status] || Colors.text.secondary;
  };

  const getNextActionText = () => {
    if (!job) return '';
    
    switch (job.status) {
      case 'accepted':
        return 'Start Transit';
      case 'in_transit':
        return 'Mark as Delivered';
      default:
        return '';
    }
  };

  const handleNextAction = () => {
    if (!job) return;
    
    let nextStatus = '';
    let confirmMessage = '';
    
    switch (job.status) {
      case 'accepted':
        nextStatus = 'in_transit';
        confirmMessage = 'Start transit for this shipment?';
        break;
      case 'in_transit':
        nextStatus = 'delivered';
        confirmMessage = 'Confirm that you have delivered the shipment?';
        break;
      default:
        return;
    }
    
    Alert.alert(
      'Update Status',
      confirmMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => updateJobStatus(nextStatus) }
      ]
    );
  };

  const formatFullAddress = (address: string, city: string, state: string, zip: string) => {
    const parts = [address];
    
    if (city || state || zip) {
      const cityStateZip = [city, state, zip].filter(Boolean).join(', ');
      if (cityStateZip) parts.push(cityStateZip);
    }
    
    return parts.join('\n');
  };

  const openNavigationApp = (address: string) => {
    // Navigation functionality would be implemented here
    Alert.alert('Navigation', `Opening directions to: ${address}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading job details...</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={64} color={Colors.error} />
        <Text style={styles.errorTitle}>Job Not Found</Text>
        <Text style={styles.errorMessage}>The requested job could not be found.</Text>
        <TouchableOpacity 
          style={styles.errorButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color={Colors.text.inverse} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{job.title}</Text>
        </View>
        
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(job.status) }]}>
            {getStatusLabel(job.status)}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Earning Summary */}
        <View style={styles.earningSummary}>
          <Text style={styles.earningSummaryLabel}>Earnings</Text>
          <Text style={styles.earningSummaryValue}>${(job.price / 100).toFixed(2)}</Text>
        </View>
        
        {/* Client Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <MaterialIcons name="person" size={20} color={Colors.primary} />
              <Text style={styles.infoLabel}>Name:</Text>
              <Text style={styles.infoValue}>{job.client_name}</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="phone" size={20} color={Colors.primary} />
              <Text style={styles.infoLabel}>Phone:</Text>
              <Text style={styles.infoValue}>{job.client_phone}</Text>
            </View>
          </View>
        </View>
        
        {/* Pickup Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.locationHeader}>
              <MaterialIcons name="location-on" size={20} color={Colors.primary} />
              <Text style={styles.locationHeaderText}>Pickup Location</Text>
            </View>
            <Text style={styles.addressText}>
              {formatFullAddress(job.pickup_address, job.pickup_city, job.pickup_state, job.pickup_zip)}
            </Text>
            <TouchableOpacity 
              style={styles.navigationButton}
              onPress={() => openNavigationApp(job.pickup_address)}
            >
              <MaterialIcons name="directions" size={16} color={Colors.primary} />
              <Text style={styles.navigationButtonText}>Get Directions</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.navigationButton, { backgroundColor: Colors.secondary + '20' }]}
              onPress={() => navigation.navigate('RouteMap', { jobId: job.id })}
            >
              <MaterialIcons name="map" size={16} color={Colors.secondary} />
              <Text style={[styles.navigationButtonText, { color: Colors.secondary }]}>View Route Map</Text>
            </TouchableOpacity>
            
            <View style={styles.infoRow}>
              <MaterialIcons name="event" size={20} color={Colors.primary} />
              <Text style={styles.infoLabel}>Date:</Text>
              <Text style={styles.infoValue}>{new Date(job.pickup_date).toLocaleDateString()}</Text>
            </View>
            
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Notes:</Text>
              <Text style={styles.notesText}>{job.pickup_notes}</Text>
            </View>
          </View>
        </View>
        
        {/* Delivery Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.locationHeader}>
              <MaterialIcons name="flag" size={20} color={Colors.secondary} />
              <Text style={styles.locationHeaderText}>Delivery Location</Text>
            </View>
            <Text style={styles.addressText}>
              {formatFullAddress(job.delivery_address, job.delivery_city, job.delivery_state, job.delivery_zip)}
            </Text>
            <TouchableOpacity 
              style={styles.navigationButton}
              onPress={() => openNavigationApp(job.delivery_address)}
            >
              <MaterialIcons name="directions" size={16} color={Colors.secondary} />
              <Text style={styles.navigationButtonText}>Get Directions</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.navigationButton, { backgroundColor: Colors.secondary + '20' }]}
              onPress={() => navigation.navigate('RouteMap', { jobId: job.id })}
            >
              <MaterialIcons name="map" size={16} color={Colors.secondary} />
              <Text style={[styles.navigationButtonText, { color: Colors.secondary }]}>View Route Map</Text>
            </TouchableOpacity>
            
            {job.delivery_date && (
              <View style={styles.infoRow}>
                <MaterialIcons name="event" size={20} color={Colors.secondary} />
                <Text style={styles.infoLabel}>Expected Date:</Text>
                <Text style={styles.infoValue}>{new Date(job.delivery_date).toLocaleDateString()}</Text>
              </View>
            )}
            
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Notes:</Text>
              <Text style={styles.notesText}>{job.delivery_notes}</Text>
            </View>
          </View>
        </View>
        
        {/* Shipment Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipment Details</Text>
          <View style={styles.infoCard}>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <MaterialIcons name="straighten" size={20} color={Colors.text.secondary} />
                <Text style={styles.detailLabel}>Distance</Text>
                <Text style={styles.detailValue}>{job.distance} miles</Text>
              </View>
              <View style={styles.detailItem}>
                <MaterialIcons name="local-shipping" size={20} color={Colors.text.secondary} />
                <Text style={styles.detailLabel}>Vehicle Type</Text>
                <Text style={styles.detailValue}>{job.vehicle_type}</Text>
              </View>
              <View style={styles.detailItem}>
                <MaterialIcons name="category" size={20} color={Colors.text.secondary} />
                <Text style={styles.detailLabel}>Cargo Type</Text>
                <Text style={styles.detailValue}>{job.cargo_type}</Text>
              </View>
              <View style={styles.detailItem}>
                <MaterialIcons name="fitness-center" size={20} color={Colors.text.secondary} />
                <Text style={styles.detailLabel}>Weight</Text>
                <Text style={styles.detailValue}>{job.weight} lbs</Text>
              </View>
              <View style={styles.detailItem}>
                <MaterialIcons name="aspect-ratio" size={20} color={Colors.text.secondary} />
                <Text style={styles.detailLabel}>Dimensions</Text>
                <Text style={styles.detailValue}>{job.dimensions}</Text>
              </View>
              <View style={styles.detailItem}>
                <MaterialIcons name="today" size={20} color={Colors.text.secondary} />
                <Text style={styles.detailLabel}>Created On</Text>
                <Text style={styles.detailValue}>{new Date(job.created_at).toLocaleDateString()}</Text>
              </View>
            </View>
          </View>
        </View>
        
        {/* Message Client Button */}
        <TouchableOpacity 
          style={styles.messageButton}
          onPress={() => navigation.navigate('Messages', { contactId: job.client_id })}
        >
          <MaterialIcons name="chat" size={20} color={Colors.text.inverse} />
          <Text style={styles.messageButtonText}>Message Client</Text>
        </TouchableOpacity>
        
        {/* Spacer for bottom actions */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Next Action Button - Only show for certain statuses */}
      {['accepted', 'picked_up', 'in_transit'].includes(job.status) && (
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleNextAction}
            disabled={statusUpdating}
          >
            {statusUpdating ? (
              <ActivityIndicator color={Colors.text.inverse} />
            ) : (
              <>
                <Text style={styles.actionButtonText}>{getNextActionText()}</Text>
                <MaterialIcons name="arrow-forward" size={20} color={Colors.text.inverse} />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.secondary,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text.inverse,
    flex: 1,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusText: {
    fontWeight: '600',
    fontSize: 12,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  earningSummary: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  earningSummaryLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  earningSummaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 8,
    marginRight: 8,
    width: 60,
  },
  infoValue: {
    fontSize: 14,
    color: Colors.text.primary,
    flex: 1,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  addressText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginLeft: 28,
    marginBottom: 12,
  },
  navigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 28,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  navigationButtonText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: 4,
  },
  notesContainer: {
    marginTop: 8,
    marginLeft: 28,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailItem: {
    width: '48%',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
    marginTop: 2,
  },
  messageButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginBottom: 16,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  messageButtonText: {
    color: Colors.text.inverse,
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  actionButton: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    shadowColor: Colors.secondaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  actionButtonText: {
    color: Colors.text.inverse,
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
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
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
  },
  errorMessage: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  errorButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 24,
  },
  errorButtonText: {
    color: Colors.text.inverse,
    fontWeight: '600',
    fontSize: 14,
  },
});
