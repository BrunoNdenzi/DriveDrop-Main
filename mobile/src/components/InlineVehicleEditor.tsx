import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import SavedVehicleSelector from './SavedVehicleSelector';

interface VehicleData {
  type?: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  licensePlate?: string;
}

interface InlineVehicleEditorProps {
  vehicleType?: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  licensePlate?: string;
  onSave: (vehicleData: VehicleData) => Promise<void> | void;
  editable?: boolean;
}

export default function InlineVehicleEditor({
  vehicleType,
  make,
  model,
  year,
  color,
  licensePlate,
  onSave,
  editable = true,
}: InlineVehicleEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleStartEdit = () => {
    if (!editable) return;
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleVehicleSelect = async (vehicle: any) => {
    try {
      setSaving(true);
      await onSave({
        type: vehicle.vehicle_type,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        licensePlate: vehicle.license_plate,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving vehicle:', error);
      // Keep editing mode open on error
    } finally {
      setSaving(false);
    }
  };

  const formatDisplayVehicle = () => {
    if (!vehicleType && !make && !model) {
      return 'Select vehicle...';
    }

    const parts = [];
    if (year) parts.push(year.toString());
    if (make) parts.push(make);
    if (model) parts.push(model);
    
    const vehicleInfo = parts.join(' ') || 'Unknown Vehicle';
    
    if (color) {
      return `${vehicleInfo} (${color})`;
    }
    
    return vehicleInfo;
  };

  const getVehicleTypeDisplay = () => {
    if (!vehicleType) return null;
    
    const typeMap: Record<string, string> = {
      'car': 'Car',
      'van': 'Van',
      'truck': 'Truck',
      'motorcycle': 'Motorcycle',
      'sedan': 'Sedan',
      'suv': 'SUV',
    };
    
    return typeMap[vehicleType.toLowerCase()] || vehicleType;
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.container, !editable && styles.disabledContainer]}
        onPress={handleStartEdit}
        disabled={!editable}
        activeOpacity={0.7}
      >
        <View style={styles.displayContainer}>
          <Text style={styles.label}>Vehicle Information</Text>
          
          <View style={styles.vehicleInfo}>
            <View style={styles.vehicleHeader}>
              <Text
                style={[
                  styles.vehicleName,
                  !make && !model && styles.placeholderValue,
                ]}
              >
                {formatDisplayVehicle()}
              </Text>
              {editable && (
                <MaterialIcons
                  name="edit"
                  size={16}
                  color={Colors.text.secondary}
                />
              )}
            </View>
            
            <View style={styles.vehicleDetails}>
              {getVehicleTypeDisplay() && (
                <View style={styles.detailBadge}>
                  <MaterialIcons name="directions-car" size={14} color={Colors.primary} />
                  <Text style={styles.detailText}>{getVehicleTypeDisplay()}</Text>
                </View>
              )}
              
              {licensePlate && (
                <View style={styles.detailBadge}>
                  <MaterialIcons name="confirmation-number" size={14} color={Colors.primary} />
                  <Text style={styles.detailText}>{licensePlate}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Vehicle Selection Modal */}
      <Modal
        visible={isEditing}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleCancel}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Vehicle</Text>
            <View style={styles.modalButton} />
          </View>

          <ScrollView style={styles.modalContent}>
            <SavedVehicleSelector
              label="Choose Vehicle"
              value={vehicleType && make && model ? {
                vehicle_type: vehicleType as any,
                make,
                model,
                year: year || 2020,
                color,
                license_plate: licensePlate,
                is_saved: false,
              } : undefined}
              onSelect={handleVehicleSelect}
              onNavigateToVehicleManager={() => {
                // Could navigate to vehicle manager if needed
                console.log('Navigate to vehicle manager');
              }}
              required
            />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  disabledContainer: {
    opacity: 0.6,
  },
  displayContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background + '80',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vehicleName: {
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '500',
    flex: 1,
  },
  placeholderValue: {
    color: Colors.text.secondary,
    fontStyle: 'italic',
    fontWeight: 'normal',
  },
  vehicleDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary + '30',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  detailText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: 'white',
  },
  modalButton: {
    minWidth: 60,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  cancelButtonText: {
    fontSize: 16,
    color: Colors.primary,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
});
