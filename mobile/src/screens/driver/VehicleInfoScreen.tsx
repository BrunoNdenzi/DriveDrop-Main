import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';

interface VehicleInfo {
  id?: string;
  make: string;
  model: string;
  year: string;
  color: string;
  licensePlate: string;
  vin: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  insuranceExpiryDate: string;
  registrationExpiryDate: string;
  inspectionExpiryDate: string;
  vehicleType: string;
}

const VEHICLE_TYPES = [
  'Sedan',
  'SUV',
  'Truck',
  'Van',
  'Hatchback',
  'Coupe',
  'Motorcycle',
  'Other',
];

export default function VehicleInfoScreen({ navigation }: any) {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showVehicleTypePicker, setShowVehicleTypePicker] = useState(false);
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo>({
    make: '',
    model: '',
    year: '',
    color: '',
    licensePlate: '',
    vin: '',
    insuranceProvider: '',
    insurancePolicyNumber: '',
    insuranceExpiryDate: '',
    registrationExpiryDate: '',
    inspectionExpiryDate: '',
    vehicleType: 'Sedan',
  });

  useEffect(() => {
    fetchVehicleInfo();
  }, []);

  const fetchVehicleInfo = async () => {
    if (!userProfile) return;

    try {
      setLoading(true);

      const { data, error } = await (supabase as any)
        .from('driver_vehicles')
        .select('*')
        .eq('driver_id', userProfile.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        throw error;
      }

      if (data) {
        const vehicleData = data as any; // Type assertion for unknown database structure
        setVehicleInfo({
          id: vehicleData.id,
          make: vehicleData.make || '',
          model: vehicleData.model || '',
          year: vehicleData.year || '',
          color: vehicleData.color || '',
          licensePlate: vehicleData.license_plate || '',
          vin: vehicleData.vin || '',
          insuranceProvider: vehicleData.insurance_provider || '',
          insurancePolicyNumber: vehicleData.insurance_policy_number || '',
          insuranceExpiryDate: vehicleData.insurance_expiry_date || '',
          registrationExpiryDate: vehicleData.registration_expiry_date || '',
          inspectionExpiryDate: vehicleData.inspection_expiry_date || '',
          vehicleType: vehicleData.vehicle_type || 'Sedan',
        });
      }
    } catch (error) {
      console.error('Error fetching vehicle info:', error);
      // Don't show error if table doesn't exist yet
      if ((error as any)?.code !== '42P01') {
        Alert.alert('Error', 'Failed to load vehicle information.');
      }
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    if (!vehicleInfo.make.trim()) {
      Alert.alert('Validation Error', 'Vehicle make is required.');
      return false;
    }
    if (!vehicleInfo.model.trim()) {
      Alert.alert('Validation Error', 'Vehicle model is required.');
      return false;
    }
    if (!vehicleInfo.year.trim()) {
      Alert.alert('Validation Error', 'Vehicle year is required.');
      return false;
    }
    if (!vehicleInfo.licensePlate.trim()) {
      Alert.alert('Validation Error', 'License plate is required.');
      return false;
    }

    // Year validation
    const currentYear = new Date().getFullYear();
    const year = parseInt(vehicleInfo.year);
    if (isNaN(year) || year < 1900 || year > currentYear + 1) {
      Alert.alert('Validation Error', 'Please enter a valid vehicle year.');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!userProfile || !validateForm()) return;

    try {
      setSaving(true);

      const vehicleData = {
        driver_id: userProfile.id,
        make: vehicleInfo.make.trim(),
        model: vehicleInfo.model.trim(),
        year: vehicleInfo.year.trim(),
        color: vehicleInfo.color.trim(),
        license_plate: vehicleInfo.licensePlate.trim(),
        vin: vehicleInfo.vin.trim(),
        insurance_provider: vehicleInfo.insuranceProvider.trim(),
        insurance_policy_number: vehicleInfo.insurancePolicyNumber.trim(),
        insurance_expiry_date: vehicleInfo.insuranceExpiryDate.trim(),
        registration_expiry_date: vehicleInfo.registrationExpiryDate.trim(),
        inspection_expiry_date: vehicleInfo.inspectionExpiryDate.trim(),
        vehicle_type: vehicleInfo.vehicleType,
        updated_at: new Date().toISOString(),
      };

      let result;

      if (vehicleInfo.id) {
        // Update existing vehicle
        result = await (supabase as any)
          .from('driver_vehicles')
          .update(vehicleData)
          .eq('id', vehicleInfo.id);
      } else {
        // Insert new vehicle
        result = await (supabase as any)
          .from('driver_vehicles')
          .insert({
            ...vehicleData,
            created_at: new Date().toISOString(),
          });
      }

      const { error } = result;

      if (error) {
        // If the table doesn't exist, show a specific message
        if (error.code === '42P01') {
          Alert.alert(
            'Feature Not Available',
            'Vehicle information management is not yet available. Please contact support.',
            [{ text: 'OK' }]
          );
        } else {
          throw error;
        }
        return;
      }

      Alert.alert('Success', 'Vehicle information saved successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error saving vehicle info:', error);
      Alert.alert('Error', 'Failed to save vehicle information. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof VehicleInfo, value: string) => {
    setVehicleInfo(prev => ({ ...prev, [field]: value }));
  };

  const isDateExpiringSoon = (dateString: string): boolean => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return date <= thirtyDaysFromNow && date >= now;
  };

  const isDateExpired = (dateString: string): boolean => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    return date < now;
  };

  const getDateInputStyle = (dateString: string) => {
    if (isDateExpired(dateString)) {
      return [styles.input, styles.expiredInput];
    }
    if (isDateExpiringSoon(dateString)) {
      return [styles.input, styles.warningSooningInput];
    }
    return styles.input;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading vehicle information...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text.inverse} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vehicle Information</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.text.inverse} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Vehicle Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Make</Text>
            <TextInput
              style={styles.input}
              value={vehicleInfo.make}
              onChangeText={(text) => updateField('make', text)}
              placeholder="e.g., Toyota, Honda, Ford"
              placeholderTextColor={Colors.text.disabled}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Model</Text>
            <TextInput
              style={styles.input}
              value={vehicleInfo.model}
              onChangeText={(text) => updateField('model', text)}
              placeholder="e.g., Camry, Civic, F-150"
              placeholderTextColor={Colors.text.disabled}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Year</Text>
            <TextInput
              style={styles.input}
              value={vehicleInfo.year}
              onChangeText={(text) => updateField('year', text)}
              placeholder="e.g., 2020"
              placeholderTextColor={Colors.text.disabled}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Color</Text>
            <TextInput
              style={styles.input}
              value={vehicleInfo.color}
              onChangeText={(text) => updateField('color', text)}
              placeholder="e.g., Black, White, Silver"
              placeholderTextColor={Colors.text.disabled}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Vehicle Type</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowVehicleTypePicker(true)}
            >
              <Text style={styles.pickerButtonText}>{vehicleInfo.vehicleType}</Text>
              <MaterialIcons name="expand-more" size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>License Plate</Text>
            <TextInput
              style={styles.input}
              value={vehicleInfo.licensePlate}
              onChangeText={(text) => updateField('licensePlate', text.toUpperCase())}
              placeholder="e.g., ABC123"
              placeholderTextColor={Colors.text.disabled}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>VIN (Optional)</Text>
            <TextInput
              style={styles.input}
              value={vehicleInfo.vin}
              onChangeText={(text) => updateField('vin', text.toUpperCase())}
              placeholder="Vehicle Identification Number"
              placeholderTextColor={Colors.text.disabled}
              autoCapitalize="characters"
              maxLength={17}
            />
          </View>
        </View>

        {/* Insurance Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insurance Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Insurance Provider</Text>
            <TextInput
              style={styles.input}
              value={vehicleInfo.insuranceProvider}
              onChangeText={(text) => updateField('insuranceProvider', text)}
              placeholder="e.g., State Farm, Geico, Allstate"
              placeholderTextColor={Colors.text.disabled}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Policy Number</Text>
            <TextInput
              style={styles.input}
              value={vehicleInfo.insurancePolicyNumber}
              onChangeText={(text) => updateField('insurancePolicyNumber', text)}
              placeholder="Insurance policy number"
              placeholderTextColor={Colors.text.disabled}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Insurance Expiry Date</Text>
            <TextInput
              style={getDateInputStyle(vehicleInfo.insuranceExpiryDate)}
              value={vehicleInfo.insuranceExpiryDate}
              onChangeText={(text) => updateField('insuranceExpiryDate', text)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.text.disabled}
            />
            {isDateExpired(vehicleInfo.insuranceExpiryDate) && (
              <Text style={styles.expiredText}>⚠️ Insurance has expired!</Text>
            )}
            {isDateExpiringSoon(vehicleInfo.insuranceExpiryDate) && !isDateExpired(vehicleInfo.insuranceExpiryDate) && (
              <Text style={styles.warningText}>⚠️ Insurance expires soon!</Text>
            )}
          </View>
        </View>

        {/* Registration & Inspection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registration & Inspection</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Registration Expiry Date</Text>
            <TextInput
              style={getDateInputStyle(vehicleInfo.registrationExpiryDate)}
              value={vehicleInfo.registrationExpiryDate}
              onChangeText={(text) => updateField('registrationExpiryDate', text)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.text.disabled}
            />
            {isDateExpired(vehicleInfo.registrationExpiryDate) && (
              <Text style={styles.expiredText}>⚠️ Registration has expired!</Text>
            )}
            {isDateExpiringSoon(vehicleInfo.registrationExpiryDate) && !isDateExpired(vehicleInfo.registrationExpiryDate) && (
              <Text style={styles.warningText}>⚠️ Registration expires soon!</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Inspection Expiry Date</Text>
            <TextInput
              style={getDateInputStyle(vehicleInfo.inspectionExpiryDate)}
              value={vehicleInfo.inspectionExpiryDate}
              onChangeText={(text) => updateField('inspectionExpiryDate', text)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.text.disabled}
            />
            {isDateExpired(vehicleInfo.inspectionExpiryDate) && (
              <Text style={styles.expiredText}>⚠️ Inspection has expired!</Text>
            )}
            {isDateExpiringSoon(vehicleInfo.inspectionExpiryDate) && !isDateExpired(vehicleInfo.inspectionExpiryDate) && (
              <Text style={styles.warningText}>⚠️ Inspection expires soon!</Text>
            )}
          </View>
        </View>

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Vehicle Type Picker Modal */}
      <Modal
        visible={showVehicleTypePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVehicleTypePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Vehicle Type</Text>
              <TouchableOpacity
                onPress={() => setShowVehicleTypePicker(false)}
                style={styles.modalCloseButton}
              >
                <MaterialIcons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {VEHICLE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.modalOption,
                    vehicleInfo.vehicleType === type && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    updateField('vehicleType', type);
                    setShowVehicleTypePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      vehicleInfo.vehicleType === type && styles.modalOptionTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                  {vehicleInfo.vehicleType === type && (
                    <MaterialIcons name="check" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.inverse,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.primary,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonText: {
    color: Colors.text.inverse,
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  expiredInput: {
    borderColor: Colors.error,
    backgroundColor: Colors.error + '10',
  },
  warningSooningInput: {
    borderColor: '#FFA500',
    backgroundColor: '#FFA50010',
  },
  expiredText: {
    color: Colors.error,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  warningText: {
    color: '#FFA500',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  pickerButton: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerButtonText: {
    fontSize: 16,
    color: Colors.text.primary,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalList: {
    maxHeight: 300,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalOptionSelected: {
    backgroundColor: Colors.primary + '10',
  },
  modalOptionText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  modalOptionTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
});