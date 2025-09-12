import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { format, addDays } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Colors } from '../../constants/Colors';
import RobustGooglePlacesInput from '../../components/RobustGooglePlacesInput';
import VehicleDropdown from '../../components/VehicleDropdown';
import { getGoogleMapsApiKey } from '../../utils/googleMaps';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useBooking } from '../../context/BookingContext';

type NewShipmentNavigationProp = NativeStackScreenProps<
  RootStackParamList,
  'CreateShipment'
>['navigation'];

type NewShipmentScreenProps = {
  navigation: NewShipmentNavigationProp;
};

export default function NewShipmentScreen({
  navigation,
}: NewShipmentScreenProps) {
  const { userProfile } = useAuth();
  const { updateFormData } = useBooking();
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [pickupZip, setPickupZip] = useState('');
  const [deliveryZip, setDeliveryZip] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [vehicleType, setVehicleType] = useState<'sedan' | 'suv' | 'truck'>(
    'sedan'
  );
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Date picker states
  const [showPickupDatePicker, setShowPickupDatePicker] = useState(false);
  const [showDeliveryDatePicker, setShowDeliveryDatePicker] = useState(false);
  const [selectedPickupDate, setSelectedPickupDate] = useState(new Date());
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState(addDays(new Date(), 1));

  // Date change handlers
  const onPickupDateChange = (event: any, selectedDate?: Date) => {
    setShowPickupDatePicker(false);
    if (selectedDate) {
      setSelectedPickupDate(selectedDate);
      setPickupDate(format(selectedDate, 'MMM dd, yyyy'));
    }
  };

  const onDeliveryDateChange = (event: any, selectedDate?: Date) => {
    setShowDeliveryDatePicker(false);
    if (selectedDate) {
      setSelectedDeliveryDate(selectedDate);
      setDeliveryDate(format(selectedDate, 'MMM dd, yyyy'));
    }
  };

  const handleGetQuote = async () => {
    // Validate inputs
    if ((!pickupAddress && !pickupZip) || (!deliveryAddress && !deliveryZip)) {
      Alert.alert('Error', 'Please enter pickup and delivery locations');
      return;
    }

    if (!vehicleMake || !vehicleModel) {
      Alert.alert('Error', 'Please enter vehicle make and model');
      return;
    }

    try {
      setLoading(true);

      // TODO: Implement quote calculation with backend
      const fromLocation = pickupAddress || `ZIP: ${pickupZip}`;
      const toLocation = deliveryAddress || `ZIP: ${deliveryZip}`;
      Alert.alert(
        'Quote Generated',
        `Estimated cost: $250 for ${vehicleType} transport from ${fromLocation} to ${toLocation}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Book Shipment', onPress: () => handleBookShipment() },
        ]
      );
    } catch (error) {
      console.error('Error getting quote:', error);
      Alert.alert('Error', 'Failed to get quote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBookShipment = async () => {
    // Prepare quote data and store it in BookingContext
    const quoteData = {
      pickupZip,
      deliveryZip,
      pickupDate: selectedPickupDate.toISOString(),
      deliveryDate: selectedDeliveryDate.toISOString(),
      vehicleType,
      vehicleMake,
      vehicleModel,
      pickupAddress,
      deliveryAddress,
      estimatedCost: 250, // This would come from the actual quote API
    };

    // Store quote data in customer details for auto-fill across booking steps
    updateFormData('customer', {
      // Store quote data as part of customer details for auto-fill
      ...quoteData,
      fullName: userProfile?.first_name && userProfile?.last_name 
        ? `${userProfile.first_name} ${userProfile.last_name}` 
        : '',
      email: userProfile?.email || '',
      phone: userProfile?.phone || '',
    });

    // Navigate to the booking flow
    navigation.navigate('BookingStepCustomer', {
      quoteId: `quote_${Date.now()}`,
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>New Shipment</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Pickup Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup Information</Text>

          <RobustGooglePlacesInput
            label="Pickup Location"
            placeholder="Enter pickup address or ZIP code"
            value={pickupAddress}
            onAddressSelect={(address: string, details?: any) => {
              setPickupAddress(address);
              // Extract ZIP code for backward compatibility
              if (details?.address_components && Array.isArray(details.address_components)) {
                const zipComponent = details.address_components.find(
                  (component: any) => component.types && component.types.includes('postal_code')
                );
                if (zipComponent) {
                  setPickupZip(zipComponent.short_name);
                }
              }
            }}
            required
            helper="Enter a full address or just a ZIP code"
          />

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              Pickup Date <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => setShowPickupDatePicker(true)}
            >
              <MaterialIcons name="calendar-today" size={20} color={Colors.text.secondary} style={styles.dateIcon} />
              <Text style={[styles.datePickerText, !pickupDate && styles.placeholderText]}>
                {pickupDate || 'Select pickup date'}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
            
            {showPickupDatePicker && (
              <DateTimePicker
                value={selectedPickupDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onPickupDateChange}
                minimumDate={new Date()}
              />
            )}
          </View>
        </View>

        {/* Delivery Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Information</Text>

          <RobustGooglePlacesInput
            label="Delivery Location"
            placeholder="Enter delivery address or ZIP code"
            value={deliveryAddress}
            onAddressSelect={(address: string, details?: any) => {
              setDeliveryAddress(address);
              // Extract ZIP code for backward compatibility
              if (details?.address_components && Array.isArray(details.address_components)) {
                const zipComponent = details.address_components.find(
                  (component: any) => component.types && component.types.includes('postal_code')
                );
                if (zipComponent) {
                  setDeliveryZip(zipComponent.short_name);
                }
              }
            }}
            required
            helper="Enter a full address or just a ZIP code"
          />

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              Delivery Date <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => setShowDeliveryDatePicker(true)}
            >
              <MaterialIcons name="calendar-today" size={20} color={Colors.text.secondary} style={styles.dateIcon} />
              <Text style={[styles.datePickerText, !deliveryDate && styles.placeholderText]}>
                {deliveryDate || 'Select delivery date'}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
            
            {showDeliveryDatePicker && (
              <DateTimePicker
                value={selectedDeliveryDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDeliveryDateChange}
                minimumDate={selectedPickupDate}
              />
            )}
          </View>
        </View>

        {/* Vehicle Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>

          {/* Vehicle Type Selection */}
          <View style={styles.vehicleTypeContainer}>
            {(['sedan', 'suv', 'truck'] as const).map(type => (
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

          <VehicleDropdown
            label="Vehicle Make"
            placeholder="Select vehicle make"
            value={vehicleMake}
            onSelect={setVehicleMake}
            type="make"
            required
          />

          <VehicleDropdown
            label="Vehicle Model"
            placeholder="Select vehicle model"
            value={vehicleModel}
            onSelect={setVehicleModel}
            type="model"
            selectedMake={vehicleMake}
            required
          />
        </View>

        {/* Get Quote Button */}
        <TouchableOpacity
          style={[styles.quoteButton, loading && styles.quoteButtonDisabled]}
          onPress={handleGetQuote}
          disabled={loading}
        >
          <Text style={styles.quoteButtonText}>
            {loading ? 'Getting Quote...' : 'Get Quote'}
          </Text>
        </TouchableOpacity>
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
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.inverse,
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
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
  },
  dateIcon: {
    marginRight: 12,
  },
  datePickerText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
  },
  placeholderText: {
    color: Colors.text.secondary,
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  vehicleTypeButton: {
    flex: 1,
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
  quoteButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  quoteButtonDisabled: {
    backgroundColor: Colors.primaryLight,
  },
  quoteButtonText: {
    color: Colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
});
