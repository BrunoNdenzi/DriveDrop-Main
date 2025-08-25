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

type ShipmentsScreenProps = NativeStackScreenProps<
  ClientTabParamList,
  'Shipments'
> & {
  navigation: NativeStackScreenProps<RootStackParamList>['navigation'];
};

type ShipmentFilter = 'pending' | 'active' | 'past';

interface Shipment {
  id: string;
  pickup_location: string;
  delivery_location: string;
  status: string;
  created_at: string;
  estimated_cost: number;
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
    try {
      setLoading(true);
      // TODO: Replace with actual API call to backend
      // For now, using mock data
      const mockShipments: Shipment[] = [];
      setShipments(mockShipments);
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

  const FilterButton = ({
    title,
    value,
  }: {
    title: string;
    value: ShipmentFilter;
  }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter === value && styles.filterButtonActive,
      ]}
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
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.shipmentCard}
                onPress={() => navigateToShipmentDetails(item.id)}
              >
                <Text style={styles.shipmentTitle}>
                  {item.pickup_location} → {item.delivery_location}
                </Text>
                <Text style={styles.shipmentStatus}>{item.status}</Text>
                <Text style={styles.shipmentCost}>${item.estimated_cost}</Text>
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
  shipmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  shipmentStatus: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  shipmentCost: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
});
