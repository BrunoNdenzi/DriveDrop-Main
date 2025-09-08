import React, { useState } from 'react';
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
import { useAuth } from '../../context/AuthContext';
import { useBooking } from '../../context/BookingContext';

type NewShipmentNavigationProp = NativeStackScreenProps<RootStackParamList, 'CreateShipment'>['navigation'];

type NewShipmentScreenProps = {
  navigation: NewShipmentNavigationProp;
};

export default function NewShipmentScreen({ navigation }: NewShipmentScreenProps) {
  const { userProfile, session } = useAuth();
  const { updateFormData } = useBooking();
  const [pickupZip, setPickupZip] = useState('');
  const [deliveryZip, setDeliveryZip] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [vehicleType, setVehicleType] = useState<'sedan' | 'suv' | 'truck'>('sedan');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGetQuote = async () => {
    // Validate inputs
    if (!pickupZip || !deliveryZip) {
      Alert.alert('Error', 'Please enter pickup and delivery ZIP codes');
      return;
    }

    if (!vehicleMake || !vehicleModel) {
      Alert.alert('Error', 'Please enter vehicle make and model');
      return;
    }

    try {
      setLoading(true);

      // Attempt distance approximation (placeholder). In future integrate maps service.
      // For now simple heuristic: difference in zip numeric values * 0.1 miles (fallback 100 miles).
      const distanceMiles = (() => {
        const a = parseInt(pickupZip, 10);
        const b = parseInt(deliveryZip, 10);
        if (!isNaN(a) && !isNaN(b)) {
          const diff = Math.abs(a - b);
            // clamp
          return Math.max(25, Math.min(2500, Math.round(diff * 0.1)));
        }
        return 100;
      })();

      const apiBase = require('../../utils/environment').getApiUrl();
      const url = `${apiBase}/api/v1/pricing/quote`;

      const body = {
        vehicle_type: vehicleType,
        distance_miles: distanceMiles,
        vehicle_count: 1,
      };

      const headers: any = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Quote API error', response.status, text);
        throw new Error('Failed to fetch quote');
      }

      const json = await response.json();
      // Expect shape { success: true, data: { total, breakdown } }
      const total = json?.data?.total ?? json?.data?.breakdown?.total ?? json?.data?.total_price ?? 0;
      if (!total) {
        console.warn('Unexpected quote response', json);
      }

      Alert.alert(
        'Quote Generated',
        `Estimated cost: $${Number(total).toFixed(2)} for ${vehicleType} transport (${distanceMiles} mi)` ,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Book Shipment', onPress: () => handleBookShipment(total, distanceMiles) }
        ]
      );
    } catch (error) {
      console.error('Error getting quote:', error);
      Alert.alert('Error', 'Failed to get quote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBookShipment = async (estimatedCost: number = 0, distanceMiles: number = 0) => {
    // Navigate to booking flow with the quote information
    // Persist quote price in booking context (using customer step bucket)
    updateFormData('customer', { quotePrice: estimatedCost });
    navigation.navigate('BookingStepCustomer', { 
      quoteId: `quote_${Date.now()}`
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>New Shipment</Text>
      </View>

  <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Pickup Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>ZIP Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 90210"
              placeholderTextColor={Colors.text.disabled}
              value={pickupZip}
              onChangeText={setPickupZip}
              keyboardType="numeric"
              maxLength={5}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Pickup Date</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Jun 8, 2025"
              placeholderTextColor={Colors.text.disabled}
              value={pickupDate}
              onChangeText={setPickupDate}
            />
          </View>

        </View>

        {/* Delivery Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>ZIP Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 10001"
              placeholderTextColor={Colors.text.disabled}
              value={deliveryZip}
              onChangeText={setDeliveryZip}
              keyboardType="numeric"
              maxLength={5}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Expected Delivery Date</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Jun 15, 2025"
              placeholderTextColor={Colors.text.disabled}
              value={deliveryDate}
              onChangeText={setDeliveryDate}
            />
          </View>
        </View>

        {/* Vehicle Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          
          {/* Vehicle Type Selection */}
          <Text style={styles.inputLabel}>Vehicle Type</Text>
          <View style={styles.vehicleTypeContainer}>
            {(['sedan', 'suv', 'truck'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.vehicleTypeButton,
                  vehicleType === type && styles.vehicleTypeButtonSelected
                ]}
                onPress={() => setVehicleType(type)}
                activeOpacity={0.7}
              >
                {vehicleType === type && (
                  <View style={styles.selectedIndicator}>
                    <MaterialIcons name="check" size={14} color="#FFFFFF" />
                  </View>
                )}
                <MaterialIcons 
                  name={
                    type === 'sedan' ? 'directions-car' : 
                    type === 'suv' ? 'time-to-leave' : 'local-shipping'
                  } 
                  size={32} 
                  color={vehicleType === type ? '#FFFFFF' : Colors.text.primary} 
                />
                <Text style={[
                  styles.vehicleTypeText,
                  vehicleType === type && styles.vehicleTypeTextSelected
                ]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Vehicle Make</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Toyota, Honda, Ford"
              placeholderTextColor={Colors.text.disabled}
              value={vehicleMake}
              onChangeText={setVehicleMake}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Vehicle Model</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Camry, Civic, F-150"
              placeholderTextColor={Colors.text.disabled}
              value={vehicleModel}
              onChangeText={setVehicleModel}
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* Get Quote Button */}
        <TouchableOpacity
          style={[styles.quoteButton, loading && styles.quoteButtonDisabled]}
          onPress={handleGetQuote}
          disabled={loading}
        >
          <Text style={styles.quoteButtonText}>
            {loading ? 'Getting Quote...' : 'Get Free Quote'}
          </Text>
          {!loading && <Text style={{color: Colors.text.inverse, marginTop: 4, fontSize: 12}}>
            No commitment required
          </Text>}
        </TouchableOpacity>
      </ScrollView>
  </View>
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
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 16,
    fontSize: 16,
    color: Colors.text.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  vehicleTypeButton: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  vehicleTypeButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    elevation: 8,
    transform: [{ scale: 1.03 }],
  },
  vehicleTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 10,
  },
  vehicleTypeTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#4CAF50', // Green for confirmation
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  quoteButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 32,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  quoteButtonDisabled: {
    backgroundColor: Colors.primaryLight,
    shadowOpacity: 0.1,
    elevation: 2,
  },
  quoteButtonText: {
    color: Colors.text.inverse,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
