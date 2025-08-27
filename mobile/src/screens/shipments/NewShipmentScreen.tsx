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
            <TextInput
              style={styles.input}
              placeholder="Pickup ZIP Code"
              value={pickupZip}
              onChangeText={setPickupZip}
              keyboardType="numeric"
              maxLength={5}
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Jun 8, 2025"
              value={pickupDate}
              onChangeText={setPickupDate}
            />
          </View>

        </View>

        {/* Delivery Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Information</Text>
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Delivery ZIP Code"
              value={deliveryZip}
              onChangeText={setDeliveryZip}
              keyboardType="numeric"
              maxLength={5}
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Jun 15, 2025"
              value={deliveryDate}
              onChangeText={setDeliveryDate}
            />
          </View>
        </View>

        {/* Vehicle Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          
          {/* Vehicle Type Selection */}
          <View style={styles.vehicleTypeContainer}>
            {(['sedan', 'suv', 'truck'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.vehicleTypeButton,
                  vehicleType === type && styles.vehicleTypeButtonSelected
                ]}
                onPress={() => setVehicleType(type)}
              >
                <Text style={[
                  styles.vehicleTypeText,
                  vehicleType === type && styles.vehicleTypeTextSelected
                ]}>
                  {type.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Vehicle Make (e.g., Toyota, Honda)"
              value={vehicleMake}
              onChangeText={setVehicleMake}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Vehicle Model (e.g., Camry, Civic)"
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
            {loading ? 'Getting Quote...' : 'Get Quote'}
          </Text>
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
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: Colors.text.primary,
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
