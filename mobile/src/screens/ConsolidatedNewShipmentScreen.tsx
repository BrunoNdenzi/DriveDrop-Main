import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '../constants/Colors';
import ConsolidatedShipmentForm from '../components/ConsolidatedShipmentForm';

interface Props {
  navigation: any;
  route: any;
}

interface ShipmentData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupAddress: string;
  deliveryAddress: string;
  pickupDate: string;
  deliveryDate: string;
  vehicleType: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  isOperable: boolean;
  shipmentType: string;
  specialInstructions: string;
  estimatedPrice: number;
  distance: number;
}

const ConsolidatedNewShipmentScreen: React.FC<Props> = ({ navigation, route }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (shipmentData: ShipmentData) => {
    setIsSubmitting(true);

    try {
      // Basic validation - check required fields
      if (!shipmentData.pickupAddress || !shipmentData.deliveryAddress) {
        throw new Error('Pickup and delivery addresses are required');
      }

      if (!shipmentData.customerName || !shipmentData.customerEmail) {
        throw new Error('Customer name and email are required');
      }

      if (!shipmentData.vehicleType || !shipmentData.vehicleMake || !shipmentData.vehicleModel) {
        throw new Error('Vehicle information is required');
      }

      // Navigate to completion flow directly - no backend validation needed yet
      navigation.navigate('ShipmentCompletion', { shipmentData });
      
    } catch (error) {
      console.error('Error validating shipment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to validate shipment data. Please check your information and try again.';
      Alert.alert(
        'Validation Error',
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Validating your shipment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons 
            name="arrow-back" 
            size={24} 
            color={Colors.primary}
            onPress={() => navigation.goBack()}
          />
          <Text style={styles.headerTitle}>New Shipment</Text>
        </View>
      </View>

      {/* Consolidated Form */}
      <ConsolidatedShipmentForm 
        onSubmit={handleSubmit}
        initialData={route?.params?.initialData}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: 16,
    textAlign: 'center',
  },
});

export default ConsolidatedNewShipmentScreen;
