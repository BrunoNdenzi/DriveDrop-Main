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
import EnhancedGooglePlacesInput from '../../components/EnhancedGooglePlacesInput';
import VehicleDropdown from '../../components/VehicleDropdown';
import SavedVehicleSelector from '../../components/SavedVehicleSelector';
import RealTimePricing from '../../components/RealTimePricing';
import { getGoogleMapsApiKey } from '../../utils/googleMaps';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useBooking } from '../../context/BookingContext';
import { AddressComponents } from '../../utils/addressUtils';

// Enhanced pricing types and configuration
interface PricingRequest {
  pickup_zip: string;
  delivery_zip: string;
  vehicle_type: string;
  distance_miles: number;
  delivery_type?: string;
  fuel_price?: number;
  vehicle_count?: number;
}

// Vehicle Selection interface
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

// Pricing rates based on DriveDropQuote Python model
const PRICING_RATES: Record<string, Record<string, number>> = {
  sedan: { short: 1.80, mid: 0.95, long: 0.60, accident: 2.50 },
  suv: { short: 2.00, mid: 1.05, long: 0.70, accident: 2.75 },
  pickup: { short: 2.20, mid: 1.15, long: 0.75, accident: 3.00 },
  luxury: { short: 3.00, mid: 1.80, long: 1.25, accident: 4.00 },
  motorcycle: { short: 1.50, mid: 0.85, long: 0.55, accident: 2.00 },
  heavy: { short: 3.50, mid: 2.25, long: 1.80, accident: 4.50 },
};

const PRICING_CONFIG = {
  MIN_MILES: 100,
  MIN_QUOTE: 150,
  ACCIDENT_MIN_QUOTE: 80,
  DEFAULT_FUEL_PRICE: 3.70,
  DISTANCE_TIERS: { SHORT_MAX: 500, MID_MAX: 1500 },
  DELIVERY_TYPE_MULTIPLIERS: {
    flexible: 0.95,
    standard: 1.00,
    expedited: 1.25,
    accident: 1.00
  }
};

// Sample ZIP coordinates for distance calculation
const ZIP_COORDINATES: Record<string, { lat: number; lng: number }> = {
  '10001': { lat: 40.7589, lng: -73.9851 }, // NYC
  '90210': { lat: 34.0901, lng: -118.4065 }, // Beverly Hills
  '60601': { lat: 41.8825, lng: -87.6441 }, // Chicago
  '33101': { lat: 25.7823, lng: -80.1918 }, // Miami
  '75201': { lat: 32.7767, lng: -96.7970 }, // Dallas
};

// Helper function to extract ZIP code from address
const extractZipFromAddress = (address: string): string | null => {
  const zipMatch = address.match(/\b\d{5}(-\d{4})?\b/);
  return zipMatch ? zipMatch[0].substr(0, 5) : null;
};

// Haversine distance calculation
const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3958.8; // Earth radius in miles
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) ** 2 + 
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Calculate distance between ZIP codes
const calculateDistance = (zip1: string, zip2: string): number => {
  const coord1 = ZIP_COORDINATES[zip1.padStart(5, '0')];
  const coord2 = ZIP_COORDINATES[zip2.padStart(5, '0')];

  if (!coord1 || !coord2) {
    // Fallback: estimate based on ZIP code proximity
    const zip1Num = parseInt(zip1);
    const zip2Num = parseInt(zip2);
    const zipDiff = Math.abs(zip1Num - zip2Num);
    return zipDiff * 50; // Rough estimate
  }

  return haversineDistance(coord1.lat, coord1.lng, coord2.lat, coord2.lng);
};

// Map vehicle types to pricing categories for RealTimePricing component (simplified)
const mapVehicleTypeForPricing = (vehicleType: string): 'sedan' | 'suv' | 'truck' => {
  const mapping: Record<string, 'sedan' | 'suv' | 'truck'> = {
    'car': 'sedan',
    'van': 'suv', 
    'truck': 'truck',
    'motorcycle': 'sedan', // Map to sedan for pricing simplicity
    'luxury': 'sedan', // Map to sedan for pricing simplicity
    'heavy': 'truck', // Map to truck for pricing simplicity
  };
  return mapping[vehicleType.toLowerCase()] || 'sedan';
};

// Map vehicle types to pricing categories for quote calculation
const getVehicleTypeForPricing = (vehicleType: string): string => {
  const mapping: Record<string, string> = {
    car: 'sedan',
    van: 'suv',
    truck: 'pickup',
    motorcycle: 'motorcycle',
  };
  return mapping[vehicleType.toLowerCase()] || 'sedan';
};

// Enhanced quote calculation using DriveDropQuote model
const calculateEnhancedQuote = (request: PricingRequest): number => {
  const {
    pickup_zip,
    delivery_zip,
    vehicle_type,
    delivery_type = 'standard',
    fuel_price = PRICING_CONFIG.DEFAULT_FUEL_PRICE,
    vehicle_count = 1
  } = request;

  const distance = calculateDistance(pickup_zip, delivery_zip);
  
  // Determine distance tier
  let tier: string;
  if (distance < PRICING_CONFIG.DISTANCE_TIERS.SHORT_MAX) {
    tier = 'short';
  } else if (distance <= PRICING_CONFIG.DISTANCE_TIERS.MID_MAX) {
    tier = 'mid';
  } else {
    tier = 'long';
  }

  // Get base rate
  const vehicleRates = PRICING_RATES[vehicle_type] || PRICING_RATES.sedan;
  let ratePerMile: number;
  
  if (delivery_type === 'accident') {
    ratePerMile = vehicleRates.accident;
  } else {
    ratePerMile = vehicleRates[tier];
  }

  // Calculate base cost
  let baseCost = distance * ratePerMile * vehicle_count;

  // Apply delivery type multiplier
  const deliveryMultiplier = PRICING_CONFIG.DELIVERY_TYPE_MULTIPLIERS[delivery_type as keyof typeof PRICING_CONFIG.DELIVERY_TYPE_MULTIPLIERS] || 1.0;
  if (delivery_type !== 'accident') {
    baseCost *= deliveryMultiplier;
  }

  // Apply fuel adjustment
  const fuelAdjustment = 1 + (fuel_price - PRICING_CONFIG.DEFAULT_FUEL_PRICE) * 0.05;
  let total = baseCost * fuelAdjustment;

  // Apply minimums
  if (delivery_type === 'accident') {
    if (total < PRICING_CONFIG.ACCIDENT_MIN_QUOTE) {
      total = PRICING_CONFIG.ACCIDENT_MIN_QUOTE;
    }
  } else if (distance < PRICING_CONFIG.MIN_MILES) {
    if (total < PRICING_CONFIG.MIN_QUOTE) {
      total = PRICING_CONFIG.MIN_QUOTE;
    }
  }

  return Math.round(total * 100) / 100;
};

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
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleSelection | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  
  // Enhanced address details storage
  const [pickupAddressDetails, setPickupAddressDetails] = useState<AddressComponents | null>(null);
  const [deliveryAddressDetails, setDeliveryAddressDetails] = useState<AddressComponents | null>(null);
  
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

    if (!selectedVehicle) {
      Alert.alert('Error', 'Please select a vehicle');
      return;
    }

    try {
      setLoading(true);

      // Enhanced pricing calculation using DriveDropQuote model
      const pickupZipCode = pickupZip || extractZipFromAddress(pickupAddress);
      const deliveryZipCode = deliveryZip || extractZipFromAddress(deliveryAddress);
      
      if (!pickupZipCode || !deliveryZipCode) {
        Alert.alert('Error', 'Could not determine ZIP codes for pricing calculation');
        return;
      }

      // Calculate quote using enhanced pricing model
      const distance = calculateDistance(pickupZipCode, deliveryZipCode);
      const vehicleTypeForPricing = getVehicleTypeForPricing(selectedVehicle.vehicle_type);
      const estimatedCost = calculateEnhancedQuote({
        pickup_zip: pickupZipCode,
        delivery_zip: deliveryZipCode,
        vehicle_type: vehicleTypeForPricing,
        distance_miles: distance,
        delivery_type: 'standard'
      });

      const fromLocation = pickupAddress || `ZIP: ${pickupZip}`;
      const toLocation = deliveryAddress || `ZIP: ${deliveryZip}`;
      
      Alert.alert(
        'Quote Generated',
        `Estimated cost: $${estimatedCost.toFixed(2)} for ${selectedVehicle.vehicle_type} transport from ${fromLocation} to ${toLocation}\n\nDistance: ${distance.toFixed(0)} miles\nRate: ${vehicleTypeForPricing} tier pricing`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Book Shipment', onPress: () => handleBookShipment(estimatedCost) },
        ]
      );
    } catch (error) {
      console.error('Error getting quote:', error);
      Alert.alert('Error', 'Failed to get quote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBookShipment = async (estimatedCost?: number) => {
    // Prepare quote data and store it in BookingContext
    const quoteData = {
      pickupZip,
      deliveryZip,
      pickupDate: selectedPickupDate.toISOString(),
      deliveryDate: selectedDeliveryDate.toISOString(),
      vehicle: selectedVehicle,
      pickupAddress,
      deliveryAddress,
      estimatedCost: estimatedCost || 250, // Fallback to default
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

          <EnhancedGooglePlacesInput
            label="Pickup Location"
            placeholder="Enter pickup address or ZIP code"
            value={pickupAddress}
            onAddressSelect={(address: string, details) => {
              setPickupAddress(address);
              setPickupAddressDetails(details.components);
              // Extract ZIP code from enhanced address details
              if (details.components.zipCode) {
                setPickupZip(details.components.zipCode);
              } else if (details.zipInfo?.zipCode) {
                setPickupZip(details.zipInfo.zipCode);
              }
            }}
            required
            helper="Enter a full address or just a ZIP code - we'll help you complete it"
            enableZipLookup={true}
            validateInput={true}
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

          <EnhancedGooglePlacesInput
            label="Delivery Location"
            placeholder="Enter delivery address or ZIP code"
            value={deliveryAddress}
            onAddressSelect={(address: string, details) => {
              setDeliveryAddress(address);
              setDeliveryAddressDetails(details.components);
              // Extract ZIP code from enhanced address details
              if (details.components.zipCode) {
                setDeliveryZip(details.components.zipCode);
              } else if (details.zipInfo?.zipCode) {
                setDeliveryZip(details.zipInfo.zipCode);
              }
            }}
            required
            helper="Enter a full address or just a ZIP code - we'll help you complete it"
            enableZipLookup={true}
            validateInput={true}
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

          <SavedVehicleSelector
            label="Select Vehicle"
            value={selectedVehicle}
            onSelect={setSelectedVehicle}
            onNavigateToVehicleManager={() => navigation.navigate('VehicleProfiles')}
            required
          />
        </View>

        {/* Real-Time Pricing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price Estimate</Text>
          <RealTimePricing
            pickupAddress={pickupAddress}
            deliveryAddress={deliveryAddress}
            pickupLocation={pickupAddressDetails?.coordinates}
            deliveryLocation={deliveryAddressDetails?.coordinates}
            pickupZip={pickupZip}
            deliveryZip={deliveryZip}
            pickupState={pickupAddressDetails?.state}
            deliveryState={deliveryAddressDetails?.state}
            vehicleType={selectedVehicle ? mapVehicleTypeForPricing(selectedVehicle.vehicle_type) : 'sedan'}
            vehicleCount={1}
            isAccidentRecovery={false}
            showDetailed={true}
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
