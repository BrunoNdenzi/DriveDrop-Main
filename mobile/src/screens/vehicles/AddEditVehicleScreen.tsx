import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '../../constants/Colors';
import { RootStackParamList } from '../../navigation/types';
import VehicleDropdown from '../../components/VehicleDropdown';

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

type AddEditVehicleNavigationProp = NativeStackScreenProps<
  RootStackParamList,
  'AddEditVehicle'
>['navigation'];

type AddEditVehicleRouteProp = NativeStackScreenProps<
  RootStackParamList,
  'AddEditVehicle'
>['route'];

interface AddEditVehicleScreenProps {
  navigation: AddEditVehicleNavigationProp;
  route: AddEditVehicleRouteProp;
}

export default function AddEditVehicleScreen({
  navigation,
  route,
}: AddEditVehicleScreenProps) {
  const existingVehicle = route.params?.vehicle;
  const isEditing = !!existingVehicle;

  const [vehicleType, setVehicleType] = useState<'car' | 'van' | 'truck' | 'motorcycle'>(
    existingVehicle?.vehicle_type || 'car'
  );
  const [make, setMake] = useState(existingVehicle?.make || '');
  const [model, setModel] = useState(existingVehicle?.model || '');
  const [year, setYear] = useState(existingVehicle?.year?.toString() || '');
  const [color, setColor] = useState(existingVehicle?.color || '');
  const [licensePlate, setLicensePlate] = useState(existingVehicle?.license_plate || '');
  const [nickname, setNickname] = useState(existingVehicle?.nickname || '');
  const [isPrimary, setIsPrimary] = useState(existingVehicle?.is_primary || false);
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    if (!make.trim()) {
      Alert.alert('Error', 'Please enter vehicle make');
      return false;
    }
    if (!model.trim()) {
      Alert.alert('Error', 'Please enter vehicle model');
      return false;
    }
    if (!year.trim()) {
      Alert.alert('Error', 'Please enter vehicle year');
      return false;
    }
    const yearNum = parseInt(year);
    const currentYear = new Date().getFullYear();
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear + 2) {
      Alert.alert('Error', 'Please enter a valid year');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const vehicleData = {
        vehicle_type: vehicleType,
        make: make.trim(),
        model: model.trim(),
        year: parseInt(year),
        color: color.trim() || null,
        license_plate: licensePlate.trim().toUpperCase() || null,
        nickname: nickname.trim() || null,
        is_primary: isPrimary,
      };

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log(isEditing ? 'Updating vehicle:' : 'Creating vehicle:', vehicleData);

      Alert.alert(
        'Success',
        isEditing ? 'Vehicle updated successfully' : 'Vehicle added successfully',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error saving vehicle:', error);
      Alert.alert('Error', 'Failed to save vehicle. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const vehicleTypeOptions = [
    { label: 'Car', value: 'car' as const },
    { label: 'Van', value: 'van' as const },
    { label: 'Truck', value: 'truck' as const },
    { label: 'Motorcycle', value: 'motorcycle' as const },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text.inverse} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {isEditing ? 'Edit Vehicle' : 'Add Vehicle'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Vehicle Type Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Type</Text>
          <View style={styles.vehicleTypeContainer}>
            {vehicleTypeOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.vehicleTypeButton,
                  vehicleType === option.value && styles.vehicleTypeButtonSelected,
                ]}
                onPress={() => setVehicleType(option.value)}
              >
                <Text
                  style={[
                    styles.vehicleTypeText,
                    vehicleType === option.value && styles.vehicleTypeTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Vehicle Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Details</Text>

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

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              Year <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={year}
              onChangeText={setYear}
              placeholder="Enter vehicle year"
              keyboardType="numeric"
              maxLength={4}
            />
          </View>
        </View>

        {/* Additional Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Details</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Color</Text>
            <TextInput
              style={styles.input}
              value={color}
              onChangeText={setColor}
              placeholder="Enter vehicle color"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>License Plate</Text>
            <TextInput
              style={styles.input}
              value={licensePlate}
              onChangeText={setLicensePlate}
              placeholder="Enter license plate"
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Nickname</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="Enter a nickname (e.g., 'My Car', 'Work Truck')"
              autoCapitalize="words"
            />
            <Text style={styles.inputHelper}>
              Optional: Give your vehicle a friendly name for easy identification
            </Text>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setIsPrimary(!isPrimary)}
          >
            <View style={[styles.checkbox, isPrimary && styles.checkboxChecked]}>
              {isPrimary && (
                <MaterialIcons name="check" size={16} color={Colors.text.inverse} />
              )}
            </View>
            <View style={styles.checkboxContent}>
              <Text style={styles.checkboxLabel}>Set as Primary Vehicle</Text>
              <Text style={styles.checkboxDescription}>
                This vehicle will be automatically selected when creating new shipments
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading
              ? isEditing
                ? 'Updating...'
                : 'Adding...'
              : isEditing
              ? 'Update Vehicle'
              : 'Add Vehicle'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  },
  placeholder: {
    width: 40, // Same width as back button for centering
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleTypeButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  vehicleTypeButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  vehicleTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  vehicleTypeTextSelected: {
    color: Colors.text.inverse,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  required: {
    color: Colors.error,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: Colors.text.primary,
  },
  inputHelper: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxContent: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  checkboxDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.primaryLight,
  },
  saveButtonText: {
    color: Colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
});
