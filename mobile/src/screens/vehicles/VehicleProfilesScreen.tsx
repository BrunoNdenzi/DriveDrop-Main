import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '../../constants/Colors';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';

// Types for vehicle management
interface UserVehicle {
  id: string;
  user_id: string;
  vehicle_type: 'car' | 'van' | 'truck' | 'motorcycle';
  make: string;
  model: string;
  year: number;
  color: string | null;
  license_plate: string | null;
  nickname: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type VehicleProfilesNavigationProp = NativeStackScreenProps<
  RootStackParamList,
  'VehicleProfiles'
>['navigation'];

interface VehicleProfilesScreenProps {
  navigation: VehicleProfilesNavigationProp;
}

export default function VehicleProfilesScreen({
  navigation,
}: VehicleProfilesScreenProps) {
  const { userProfile } = useAuth();
  const [vehicles, setVehicles] = useState<UserVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Mock API call - replace with actual API integration
  const fetchVehicles = async () => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock data for demonstration
      const mockVehicles: UserVehicle[] = [
        {
          id: '1',
          user_id: userProfile?.id || '',
          vehicle_type: 'car',
          make: 'Honda',
          model: 'Civic',
          year: 2020,
          color: 'Silver',
          license_plate: 'ABC123',
          nickname: 'My Daily Driver',
          is_primary: true,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '2',
          user_id: userProfile?.id || '',
          vehicle_type: 'truck',
          make: 'Ford',
          model: 'F-150',
          year: 2019,
          color: 'Blue',
          license_plate: 'XYZ789',
          nickname: 'Work Truck',
          is_primary: false,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      setVehicles(mockVehicles);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      Alert.alert('Error', 'Failed to load vehicles');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchVehicles();
  };

  const handleAddVehicle = () => {
    navigation.navigate('AddEditVehicle');
  };

  const handleEditVehicle = (vehicle: UserVehicle) => {
    navigation.navigate('AddEditVehicle', { vehicle });
  };

  const handleDeleteVehicle = (vehicle: UserVehicle) => {
    Alert.alert(
      'Delete Vehicle',
      `Are you sure you want to delete ${vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteVehicle(vehicle.id),
        },
      ]
    );
  };

  const deleteVehicle = async (vehicleId: string) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      setVehicles(prev => prev.filter(v => v.id !== vehicleId));
      Alert.alert('Success', 'Vehicle deleted successfully');
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      Alert.alert('Error', 'Failed to delete vehicle');
    }
  };

  const handleSetPrimary = async (vehicle: UserVehicle) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      setVehicles(prev =>
        prev.map(v => ({
          ...v,
          is_primary: v.id === vehicle.id,
        }))
      );

      Alert.alert('Success', `${vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`} set as primary vehicle`);
    } catch (error) {
      console.error('Error setting primary vehicle:', error);
      Alert.alert('Error', 'Failed to set primary vehicle');
    }
  };

  const getVehicleTypeIcon = (type: string) => {
    switch (type) {
      case 'car':
        return 'directions-car';
      case 'truck':
        return 'local-shipping';
      case 'van':
        return 'airport-shuttle';
      case 'motorcycle':
        return 'motorcycle';
      default:
        return 'directions-car';
    }
  };

  const formatVehicleTitle = (vehicle: UserVehicle) => {
    return vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  };

  const formatVehicleSubtitle = (vehicle: UserVehicle) => {
    const parts = [];
    if (vehicle.color) parts.push(vehicle.color);
    if (!vehicle.nickname) {
      parts.push(`${vehicle.make} ${vehicle.model}`);
    } else {
      parts.push(`${vehicle.year} ${vehicle.make} ${vehicle.model}`);
    }
    if (vehicle.license_plate) parts.push(vehicle.license_plate);
    return parts.join(' • ');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color={Colors.text.inverse} />
          </TouchableOpacity>
          <Text style={styles.title}>My Vehicles</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading vehicles...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text.inverse} />
        </TouchableOpacity>
        <Text style={styles.title}>My Vehicles</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddVehicle}
        >
          <MaterialIcons name="add" size={24} color={Colors.text.inverse} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {vehicles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons
              name="directions-car"
              size={64}
              color={Colors.text.secondary}
            />
            <Text style={styles.emptyTitle}>No Vehicles Added</Text>
            <Text style={styles.emptyDescription}>
              Add your vehicles to make shipment booking faster and easier.
            </Text>
            <TouchableOpacity
              style={styles.addVehicleButton}
              onPress={handleAddVehicle}
            >
              <MaterialIcons name="add" size={24} color={Colors.text.inverse} />
              <Text style={styles.addVehicleButtonText}>Add Your First Vehicle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          vehicles.map((vehicle) => (
            <View key={vehicle.id} style={styles.vehicleCard}>
              <View style={styles.vehicleHeader}>
                <View style={styles.vehicleIconContainer}>
                  <MaterialIcons
                    name={getVehicleTypeIcon(vehicle.vehicle_type) as any}
                    size={32}
                    color={Colors.primary}
                  />
                </View>
                <View style={styles.vehicleInfo}>
                  <View style={styles.vehicleTitleRow}>
                    <Text style={styles.vehicleTitle}>
                      {formatVehicleTitle(vehicle)}
                    </Text>
                    {vehicle.is_primary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.vehicleSubtitle}>
                    {formatVehicleSubtitle(vehicle)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={() => {
                    // Show action sheet or menu
                    Alert.alert(
                      'Vehicle Options',
                      `Options for ${formatVehicleTitle(vehicle)}`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Edit', onPress: () => handleEditVehicle(vehicle) },
                        ...(vehicle.is_primary ? [] : [
                          { text: 'Set as Primary', onPress: () => handleSetPrimary(vehicle) }
                        ]),
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => handleDeleteVehicle(vehicle)
                        },
                      ]
                    );
                  }}
                >
                  <MaterialIcons name="more-vert" size={24} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.vehicleActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleEditVehicle(vehicle)}
                >
                  <MaterialIcons name="edit" size={20} color={Colors.primary} />
                  <Text style={styles.actionButtonText}>Edit</Text>
                </TouchableOpacity>

                {!vehicle.is_primary && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleSetPrimary(vehicle)}
                  >
                    <MaterialIcons name="star-border" size={20} color={Colors.primary} />
                    <Text style={styles.actionButtonText}>Set Primary</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}

        {vehicles.length > 0 && (
          <TouchableOpacity
            style={styles.addAnotherButton}
            onPress={handleAddVehicle}
          >
            <MaterialIcons name="add" size={24} color={Colors.primary} />
            <Text style={styles.addAnotherButtonText}>Add Another Vehicle</Text>
          </TouchableOpacity>
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
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.inverse,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  addButton: {
    padding: 8,
    marginRight: -8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  addVehicleButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addVehicleButtonText: {
    color: Colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  vehicleCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  vehicleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  vehicleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginRight: 8,
  },
  primaryBadge: {
    backgroundColor: Colors.success,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  vehicleSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  menuButton: {
    padding: 8,
    marginTop: -8,
    marginRight: -8,
  },
  vehicleActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
  },
  addAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    marginBottom: 32,
    gap: 8,
  },
  addAnotherButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.primary,
  },
});
