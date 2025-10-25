import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '../../constants/Colors';
import { ClientTabParamList, RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { ShipmentService } from '../../services/shipmentService';

type ShipmentsScreenProps = NativeStackScreenProps<ClientTabParamList, 'Shipments'> & {
  navigation: NativeStackScreenProps<RootStackParamList>['navigation'];
};

type ShipmentFilter = 'pending' | 'active' | 'past';

interface Shipment {
  id: string;
  title: string;
  pickup_address: string;
  delivery_address: string;
  status: string;
  created_at: string;
  estimated_price: number;
  description?: string | null;
  driver_id?: string | null;
}

export default function ShipmentsScreen({ navigation }: ShipmentsScreenProps) {
  const { userProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [filter, setFilter] = useState<ShipmentFilter>('pending');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadShipments();
  }, [filter]);

  async function loadShipments() {
    if (!userProfile?.id) return;
    
    try {
      setLoading(true);
      
      // Determine status filter for query
      let statusFilter: string[] = [];
      switch (filter) {
        case 'pending':
          statusFilter = ['pending'];
          break;
        case 'active':
          // Include all in-progress lifecycle statuses visible to client
          statusFilter = ['assigned', 'picked_up', 'in_transit'];
          break;
        case 'past':
          // Completed lifecycle statuses
          statusFilter = ['delivered', 'completed', 'cancelled'];
          break;
      }

      const data = await ShipmentService.getClientShipments(userProfile.id, statusFilter);
      setShipments(data);
    } catch (err) {
      console.error('Error loading shipments:', err);
    } finally {
      setLoading(false);
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await loadShipments();
    setRefreshing(false);
  };

  const navigateToShipmentDetails = (shipmentId: string) => {
    navigation.navigate('ShipmentDetails', { shipmentId });
  };

  const FilterButton = ({ title, value }: { title: string; value: ShipmentFilter }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === value && styles.filterButtonActive]}
      onPress={() => setFilter(value)}
    >
      <Text
        style={[
          styles.filterButtonText,
          filter === value && styles.filterButtonTextActive,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="inventory" size={64} color={Colors.text.disabled} />
      <Text style={styles.emptyTitle}>No Shipments Found</Text>
      <Text style={styles.emptySubtitle}>
        You don't have any {filter} shipments
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Shipments</Text>
      </View>
      
      {/* Filter Tabs */}
      <View style={styles.filtersContainer}>
        <FilterButton title="Pending" value="pending" />
        <FilterButton title="Active" value="active" />
        <FilterButton title="Past" value="past" />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : shipments.length === 0 ? (
          <EmptyState />
        ) : (
          <FlatList
            data={shipments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.shipmentCard}
                onPress={() => navigateToShipmentDetails(item.id)}
              >
                <View style={styles.shipmentHeader}>
                  <Text style={styles.shipmentTitle}>
                    {item.title || `Shipment #${item.id.substring(0, 8)}`}
                  </Text>
                  <Text style={styles.shipmentCost}>${item.estimated_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
                <Text style={styles.shipmentRoute}>
                  {item.pickup_address} → {item.delivery_address}
                </Text>
                <View style={styles.shipmentFooter}>
                  <Text style={styles.shipmentStatus}>{item.status}</Text>
                  <Text style={styles.shipmentDate}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
                {item.description && (
                  <Text style={styles.shipmentDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
              </TouchableOpacity>
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
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
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  filtersContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  filterButtonTextActive: {
    color: Colors.text.inverse,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  shipmentCard: {
    backgroundColor: Colors.surface,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shipmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  shipmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  shipmentRoute: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  shipmentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  shipmentStatus: {
    fontSize: 14,
    color: Colors.text.secondary,
    textTransform: 'capitalize',
  },
  shipmentDate: {
    fontSize: 12,
    color: Colors.text.disabled,
  },
  shipmentDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  shipmentCost: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
});
