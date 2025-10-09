import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import VehicleDropdown from './VehicleDropdown';

// Types for saved vehicles
interface SavedVehicle {
  id: string;
  vehicle_type: 'car' | 'van' | 'truck' | 'motorcycle';
  make: string;
  model: string;
  year: number;
  color: string | null;
  license_plate: string | null;
  nickname: string | null;
  is_primary: boolean;
}

interface VehicleSelection {
  id?: string; // ID if using saved vehicle
  vehicle_type: 'car' | 'van' | 'truck' | 'motorcycle';
  make: string;
  model: string;
  year: number;
  color?: string;
  license_plate?: string;
  nickname?: string;
  is_saved: boolean;
}

interface SavedVehicleSelectorProps {
  label: string;
  value?: VehicleSelection;
  onSelect: (vehicle: VehicleSelection) => void;
  onNavigateToVehicleManager?: () => void;
  required?: boolean;
  disabled?: boolean;
}

export default function SavedVehicleSelector({
  label,
  value,
  onSelect,
  onNavigateToVehicleManager,
  required = false,
  disabled = false,
}: SavedVehicleSelectorProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [savedVehicles, setSavedVehicles] = useState<SavedVehicle[]>([]);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [loading, setLoading] = useState(false);

  // Manual entry form state
  const [vehicleType, setVehicleType] = useState<'car' | 'van' | 'truck' | 'motorcycle'>('car');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [saveForFuture, setSaveForFuture] = useState(false);

  // Mock API call - replace with actual API integration
  const fetchSavedVehicles = async () => {
    try {
      setLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock data
      const mockVehicles: SavedVehicle[] = [
        {
          id: '1',
          vehicle_type: 'car',
          make: 'Honda',
          model: 'Civic',
          year: 2020,
          color: 'Silver',
          license_plate: 'ABC123',
          nickname: 'My Daily Driver',
          is_primary: true,
        },
        {
          id: '2',
          vehicle_type: 'truck',
          make: 'Ford',
          model: 'F-150',
          year: 2019,
          color: 'Blue',
          license_plate: 'XYZ789',
          nickname: 'Work Truck',
          is_primary: false,
        },
      ];
      
      setSavedVehicles(mockVehicles);
    } catch (error) {
      console.error('Error fetching saved vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isModalVisible) {
      fetchSavedVehicles();
    }
  }, [isModalVisible]);

  const handleSavedVehicleSelect = (vehicle: SavedVehicle) => {
    const selection: VehicleSelection = {
      id: vehicle.id,
      vehicle_type: vehicle.vehicle_type,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color || undefined,
      license_plate: vehicle.license_plate || undefined,
      nickname: vehicle.nickname || undefined,
      is_saved: true,
    };
    onSelect(selection);
    setIsModalVisible(false);
  };

  const handleManualVehicleSelect = () => {
    if (!make || !model || !year) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const yearNum = parseInt(year);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 2) {
      Alert.alert('Error', 'Please enter a valid year');
      return;
    }

    const selection: VehicleSelection = {
      vehicle_type: vehicleType,
      make: make.trim(),
      model: model.trim(),
      year: yearNum,
      color: color.trim() || undefined,
      license_plate: licensePlate.trim() || undefined,
      is_saved: false,
    };

    // If user wants to save for future, we could trigger a save operation here
    if (saveForFuture) {
      console.log('Would save vehicle for future use:', selection);
      // TODO: Call API to save vehicle
    }

    onSelect(selection);
    setIsModalVisible(false);
    resetManualForm();
  };

  const resetManualForm = () => {
    setVehicleType('car');
    setMake('');
    setModel('');
    setYear('');
    setColor('');
    setLicensePlate('');
    setSaveForFuture(false);
    setShowManualEntry(false);
  };

  const getVehicleTypeIcon = (type: string) => {
    switch (type) {
      case 'car': return 'directions-car';
      case 'truck': return 'local-shipping';
      case 'van': return 'airport-shuttle';
      case 'motorcycle': return 'motorcycle';
      default: return 'directions-car';
    }
  };

  const formatVehicleDisplay = (vehicle: VehicleSelection | SavedVehicle) => {
    if ('nickname' in vehicle && vehicle.nickname) {
      return vehicle.nickname;
    }
    return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  };

  const formatVehicleSubtitle = (vehicle: VehicleSelection | SavedVehicle) => {
    const parts = [];
    if (vehicle.color) parts.push(vehicle.color);
    if ('nickname' in vehicle && vehicle.nickname) {
      parts.push(`${vehicle.year} ${vehicle.make} ${vehicle.model}`);
    }
    if (vehicle.license_plate) parts.push(vehicle.license_plate);
    return parts.join(' ΓÇó ');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>

      <TouchableOpacity
        style={[styles.selector, disabled && styles.selectorDisabled]}
        onPress={() => !disabled && setIsModalVisible(true)}
        disabled={disabled}
      >
        {value ? (
          <View style={styles.selectedVehicle}>
            <View style={styles.vehicleIconContainer}>
              <MaterialIcons
                name={getVehicleTypeIcon(value.vehicle_type) as any}
                size={24}
                color={Colors.primary}
              />
            </View>
            <View style={styles.vehicleInfo}>
              <Text style={styles.vehicleName}>{formatVehicleDisplay(value)}</Text>
              <Text style={styles.vehicleDetails}>{formatVehicleSubtitle(value)}</Text>
            </View>
            {value.is_saved && (
              <View style={styles.savedBadge}>
                <MaterialIcons name="bookmark" size={16} color={Colors.success} />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.placeholder}>
            <MaterialIcons name="directions-car" size={24} color={Colors.text.secondary} />
            <Text style={styles.placeholderText}>Select a vehicle</Text>
          </View>
        )}
        <MaterialIcons name="keyboard-arrow-down" size={24} color={Colors.text.secondary} />
      </TouchableOpacity>

      {/* Vehicle Selection Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modal}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setIsModalVisible(false)}
            >
              <MaterialIcons name="close" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Vehicle</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Saved Vehicles Section */}
            {savedVehicles.length > 0 && !showManualEntry && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Saved Vehicles</Text>
                {savedVehicles.map((vehicle) => (
                  <TouchableOpacity
                    key={vehicle.id}
                    style={styles.vehicleOption}
                    onPress={() => handleSavedVehicleSelect(vehicle)}
                  >
                    <View style={styles.vehicleIconContainer}>
                      <MaterialIcons
                        name={getVehicleTypeIcon(vehicle.vehicle_type) as any}
                        size={24}
                        color={Colors.primary}
                      />
                    </View>
                    <View style={styles.vehicleInfo}>
                      <View style={styles.vehicleNameRow}>
                        <Text style={styles.vehicleName}>{formatVehicleDisplay(vehicle)}</Text>
                        {vehicle.is_primary && (
                          <View style={styles.primaryBadge}>
                            <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.vehicleDetails}>{formatVehicleSubtitle(vehicle)}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color={Colors.text.secondary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Action Buttons */}
            {!showManualEntry && (
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setShowManualEntry(true)}
                >
                  <MaterialIcons name="add" size={24} color={Colors.primary} />
                  <Text style={styles.actionButtonText}>Enter Vehicle Manually</Text>
                </TouchableOpacity>

                {onNavigateToVehicleManager && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      setIsModalVisible(false);
                      onNavigateToVehicleManager();
                    }}
                  >
                    <MaterialIcons name="settings" size={24} color={Colors.primary} />
                    <Text style={styles.actionButtonText}>Manage Saved Vehicles</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Manual Entry Form */}
            {showManualEntry && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Enter Vehicle Details</Text>
                  <TouchableOpacity
                    style={styles.backToSavedButton}
                    onPress={() => setShowManualEntry(false)}
                  >
                    <Text style={styles.backToSavedButtonText}>Back to Saved</Text>
                  </TouchableOpacity>
                </View>

                {/* Vehicle Type Selection */}
                <Text style={styles.fieldLabel}>Vehicle Type *</Text>
                <View style={styles.vehicleTypeContainer}>
                  {(['car', 'van', 'truck', 'motorcycle'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.vehicleTypeButton,
                        vehicleType === type && styles.vehicleTypeButtonSelected,
                      ]}
                      onPress={() => setVehicleType(type)}
                    >
                      <Text
                        style={[
                          styles.vehicleTypeText,
                          vehicleType === type && styles.vehicleTypeTextSelected,
                        ]}
                      >
                        {type.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Make and Model */}
                <VehicleDropdown
                  label="Make"
                  placeholder="Select vehicle make"
                  value={make}
                  onSelect={setMake}
                  type="make"
                  required
                />

                <VehicleDropdown
                  label="Model"
                  placeholder="Select vehicle model"
                  value={model}
                  onSelect={setModel}
                  type="model"
                  selectedMake={make}
                  required
                />

                {/* Additional fields can be added here */}

                {/* Save for Future Option */}
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setSaveForFuture(!saveForFuture)}
                >
                  <View style={[styles.checkbox, saveForFuture && styles.checkboxChecked]}>
                    {saveForFuture && (
                      <MaterialIcons name="check" size={16} color={Colors.text.inverse} />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>Save this vehicle for future use</Text>
                </TouchableOpacity>

                {/* Submit Button */}
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleManualVehicleSelect}
                >
                  <Text style={styles.submitButtonText}>Use This Vehicle</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  required: {
    color: Colors.error,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
  },
  selectorDisabled: {
    opacity: 0.5,
  },
  selectedVehicle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  vehicleDetails: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  savedBadge: {
    marginLeft: 8,
  },
  placeholder: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  placeholderText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  modal: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  modalCloseButton: {
    padding: 8,
    marginLeft: -8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    paddingVertical: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  backToSavedButton: {
    padding: 8,
  },
  backToSavedButtonText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  vehicleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  vehicleNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  primaryBadge: {
    backgroundColor: Colors.success,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    gap: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  vehicleTypeButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  vehicleTypeButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  vehicleTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  vehicleTypeTextSelected: {
    color: Colors.text.inverse,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxLabel: {
    fontSize: 14,
    color: Colors.text.primary,
    flex: 1,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    color: Colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
});
