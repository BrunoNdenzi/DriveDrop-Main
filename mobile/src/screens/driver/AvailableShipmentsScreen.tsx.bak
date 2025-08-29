import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { ShipmentService } from '../../services/shipmentService';
import { getApiUrl } from '../../utils/environment';

// Define the structure of a shipment object
interface AvailableShipment {
  id: string;
  title: string;
  pickup_location: string;
  delivery_location: string;
  distance: number;
  estimated_earnings: number;
  vehicle_type: string;
  pickup_date: string;
  status: string;
  created_at: string;
  hasApplied?: boolean; // Track if driver has applied
}

export default function AvailableShipmentsScreen({ navigation }: any) {
  const [availableShipments, setAvailableShipments] = useState<
    AvailableShipment[]
  >([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { userProfile, session } = useAuth();

  useEffect(() => {
    fetchAvailableShipments();
  }, []);

  const fetchAvailableShipments = async () => {
    setLoading(true);
    try {
      // Query available shipments that haven't been assigned yet
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get driver's applications to check which shipments they've applied for
      let appliedShipmentIds: string[] = [];
      if (userProfile?.id) {
        const { data: applications, error: appError } = await supabase
          .from('job_applications')
          .select('shipment_id')
          .eq('driver_id', userProfile.id);

        if (appError) {
          console.error('Error fetching applications:', appError);
        } else {
          appliedShipmentIds = applications.map(app => app.shipment_id);
        }
      }

      // Transform data and add application status
      const transformedShipments: AvailableShipment[] = data.map(
        (shipment: any) => ({
          id: shipment.id,
          title: shipment.title || 'Delivery Service',
          pickup_location: shipment.pickup_address || 'Unknown pickup',
          delivery_location: shipment.delivery_address || 'Unknown delivery',
          distance: shipment.distance || 0,
          estimated_earnings: shipment.estimated_price || 0,
          vehicle_type: shipment.vehicle_type || 'Any',
          pickup_date: shipment.pickup_date || shipment.created_at,
          status: shipment.status,
          created_at: shipment.created_at,
          hasApplied: appliedShipmentIds.includes(shipment.id),
        })
      );

      setAvailableShipments(transformedShipments);
    } catch (error) {
      console.error('Error fetching available shipments:', error);
      Alert.alert('Error', 'Failed to load available shipments.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAvailableShipments().finally(() => setRefreshing(false));
  };

  const applyForShipment = async (shipmentId: string) => {
    try {
      if (!userProfile?.id) {
        Alert.alert('Error', 'You must be logged in to apply for shipments.');
        return;
      }

      // Check if already applied
      const shipment = availableShipments.find(s => s.id === shipmentId);
      if (shipment?.hasApplied) {
        Alert.alert(
          'Already Applied',
          'You have already applied for this shipment.'
        );
        return;
      }

      // Use the backend API endpoint to apply for shipment
      const apiUrl = getApiUrl();
      const response = await fetch(
        `${apiUrl}/api/v1/shipments/${shipmentId}/apply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            notes: 'Application submitted via mobile app',
          }),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        Alert.alert('Success', 'Application submitted successfully!');

        // Update local state to reflect application
        setAvailableShipments(prev =>
          prev.map(s => (s.id === shipmentId ? { ...s, hasApplied: true } : s))
        );
      } else {
        throw new Error(
          result.error?.message || 'Failed to submit application'
        );
      }
    } catch (error) {
      console.error('Error applying for shipment:', error);
      Alert.alert('Error', 'Failed to submit application. Please try again.');
    }
  };

  const viewShipmentDetails = (shipmentId: string) => {
    navigation.navigate('ShipmentDetails_Driver', { shipmentId });
  };

  const renderShipmentItem = ({ item }: { item: AvailableShipment }) => (
    <TouchableOpacity
      style={styles.shipmentCard}
      onPress={() => viewShipmentDetails(item.id)}
    >
      <View style={styles.shipmentHeader}>
        <Text style={styles.shipmentTitle}>{item.title}</Text>
        <Text style={styles.earningsText}>${item.estimated_earnings}</Text>
      </View>

      <View style={styles.locationContainer}>
        <View style={styles.locationRow}>
          <MaterialIcons
            name="location-on"
            size={16}
            color={Colors.secondary}
          />
          <Text style={styles.locationText} numberOfLines={1}>
            From: {item.pickup_location}
          </Text>
        </View>
        <View style={styles.locationRow}>
          <MaterialIcons name="flag" size={16} color={Colors.primary} />
          <Text style={styles.locationText} numberOfLines={1}>
            To: {item.delivery_location}
          </Text>
        </View>
      </View>

      <View style={styles.detailsContainer}>
        <Text style={styles.detailText}>
          <MaterialIcons
            name="directions-car"
            size={14}
            color={Colors.text.secondary}
          />{' '}
          {item.vehicle_type}
        </Text>
        <Text style={styles.detailText}>
          <MaterialIcons
            name="schedule"
            size={14}
            color={Colors.text.secondary}
          />{' '}
          {new Date(item.pickup_date).toLocaleDateString()}
        </Text>
        {item.distance > 0 && (
          <Text style={styles.detailText}>
            <MaterialIcons
              name="straighten"
              size={14}
              color={Colors.text.secondary}
            />{' '}
            {item.distance.toFixed(1)} mi
          </Text>
        )}
      </View>

      <View style={styles.actionContainer}>
        {item.hasApplied ? (
          <View style={styles.appliedBadge}>
            <MaterialIcons
              name="check-circle"
              size={16}
              color={Colors.success}
            />
            <Text style={styles.appliedText}>Applied</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.applyButton}
            onPress={() => applyForShipment(item.id)}
          >
            <MaterialIcons name="send" size={16} color={Colors.background} />
            <Text style={styles.applyButtonText}>Apply for Job</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() => viewShipmentDetails(item.id)}
        >
          <Text style={styles.detailsButtonText}>View Details</Text>
          <MaterialIcons
            name="arrow-forward"
            size={16}
            color={Colors.primary}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Available Shipments</Text>
        <Text style={styles.headerSubtitle}>
          {availableShipments.length} shipments available
        </Text>
      </View>

      <FlatList
        data={availableShipments}
        renderItem={renderShipmentItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons
              name="search-off"
              size={64}
              color={Colors.text.secondary}
            />
            <Text style={styles.emptyTitle}>No Shipments Available</Text>
            <Text style={styles.emptyText}>
              Check back later for new delivery opportunities.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  listContainer: {
    padding: 16,
  },
  shipmentCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shipmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  shipmentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
  },
  earningsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.success,
  },
  locationContainer: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 8,
    flex: 1,
  },
  detailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailText: {
    fontSize: 12,
    color: Colors.text.secondary,
    flex: 1,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  applyButton: {
    backgroundColor: Colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  applyButtonText: {
    color: Colors.background,
    fontWeight: '600',
    marginLeft: 4,
  },
  appliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.success + '20',
    borderRadius: 16,
  },
  appliedText: {
    color: Colors.success,
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 12,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    marginRight: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
