import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import * as FileSystem from 'expo-file-system';

import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../utils/environment';
import { supabase } from '../../lib/supabase';

interface Props {
  shipmentData: any;
  completionData: {
    vehiclePhotos: string[];
    ownershipDocuments: string[];
    termsAccepted: boolean;
    paymentCompleted: boolean;
  };
  onPaymentComplete: (paymentIntentId: string, shipmentId: string) => void;
  onFinalSubmit?: () => void;
}

const EnhancedPaymentStep: React.FC<Props> = ({ 
  shipmentData, 
  completionData, 
  onPaymentComplete, 
  onFinalSubmit 
}) => {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { user, session } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [shipmentId, setShipmentId] = useState<string | null>(null);

  // Calculate payment amounts
  const quotePriceDollars = shipmentData.estimatedPrice || 0;
  const quotePriceCents = Math.round(quotePriceDollars * 100);
  const upfrontAmount = Math.round(quotePriceCents * 0.20);
  const deliveryAmount = quotePriceCents - upfrontAmount;

  // Initialize payment sheet when component mounts
  useEffect(() => {
    initializePaymentSheet();
  }, []);

  const initializePaymentSheet = async () => {
    try {
      const apiUrl = getApiUrl();
      
      if (!user?.id || !session) {
        console.error('User not authenticated');
        return;
      }

      if (upfrontAmount < 50) {
        Alert.alert('Error', 'Payment amount must be at least $0.50');
        return;
      }

      console.log('Initializing payment sheet...');

      // Get user profile for billing details
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // Create payment intent
      const response = await fetch(`${apiUrl}/api/v1/payments/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          amount: upfrontAmount,
          totalAmount: quotePriceCents,
          customerEmail: user.email || profile?.email,
          customerName: `${profile?.first_name} ${profile?.last_name}`,
          metadata: {
            customerId: user.id,
            customerEmail: user.email,
            customerName: `${profile?.first_name} ${profile?.last_name}`,
            vehicle: `${shipmentData.vehicleYear} ${shipmentData.vehicleMake} ${shipmentData.vehicleModel}`,
            route: `${shipmentData.pickupAddress} → ${shipmentData.deliveryAddress}`,
          },
        }),
      });

      const { clientSecret, paymentIntentId, ephemeralKey, customer } = await response.json();

      if (!clientSecret) {
        throw new Error('Failed to create payment intent');
      }

      setPaymentIntentId(paymentIntentId);

      // Initialize the payment sheet with all payment methods
      const { error } = await initPaymentSheet({
        merchantDisplayName: 'DriveDrop',
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: clientSecret,
        allowsDelayedPaymentMethods: true,
        applePay: {
          merchantCountryCode: 'US',
        },
        googlePay: {
          merchantCountryCode: 'US',
          testEnv: __DEV__,
        },
        defaultBillingDetails: {
          name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
          email: user.email || profile?.email || undefined,
          phone: profile?.phone || undefined,
        },
        returnURL: 'drivedrop://payment-complete',
      });

      if (error) {
        console.error('Payment sheet initialization error:', error);
        Alert.alert('Error', error.message);
        return;
      }

      setIsReady(true);
      console.log('Payment sheet initialized successfully');
    } catch (error: any) {
      console.error('Payment initialization error:', error);
      Alert.alert('Error', error.message || 'Failed to initialize payment');
    }
  };

  const createShipmentInDatabase = async (paymentIntentId: string): Promise<string> => {
    try {
      console.log('Creating shipment in database...');

      const apiUrl = getApiUrl();

      if (!user?.id || !session) {
        throw new Error('User not authenticated');
      }

      // Upload photos to storage first
      const uploadedPhotoUrls = await uploadVehiclePhotos();

      // Create shipment
      const { data: shipment, error: shipmentError } = await supabase
        .from('shipments')
        .insert({
          client_id: user.id,
          title: `${shipmentData.vehicleYear} ${shipmentData.vehicleMake} ${shipmentData.vehicleModel}`,
          description: `${shipmentData.vehicleType} transport - ${shipmentData.isOperable ? 'Operable' : 'Non-Operable'}`,
          pickup_address: shipmentData.pickupAddress,
          delivery_address: shipmentData.deliveryAddress,
          pickup_date: shipmentData.pickupDate ? new Date(shipmentData.pickupDate).toISOString() : null,
          estimated_price: quotePriceDollars,
          status: 'pending',
          vehicle_type: shipmentData.vehicleType,
          vehicle_make: shipmentData.vehicleMake,
          vehicle_model: shipmentData.vehicleModel,
          vehicle_year: parseInt(shipmentData.vehicleYear),
          is_operable: shipmentData.isOperable,
          distance: shipmentData.distance,
          terms_accepted: true,
          payment_intent_id: paymentIntentId,
          payment_status: 'processing',
          client_vehicle_photos: JSON.stringify({
            front: uploadedPhotoUrls[0] || null,
            rear: uploadedPhotoUrls[1] || null,
            left: uploadedPhotoUrls[2] || null,
            right: uploadedPhotoUrls[3] || null,
            interior: uploadedPhotoUrls[4] || null,
            damage: uploadedPhotoUrls[5] || null,
          }),
        })
        .select()
        .single();

      if (shipmentError) throw shipmentError;

      console.log('Shipment created:', shipment.id);

      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          shipment_id: shipment.id,
          client_id: user.id,
          amount: quotePriceDollars,
          initial_amount: upfrontAmount,
          remaining_amount: deliveryAmount,
          status: 'completed',
          payment_method: 'stripe',
          payment_intent_id: paymentIntentId,
          metadata: {
            vehicle: `${shipmentData.vehicleYear} ${shipmentData.vehicleMake} ${shipmentData.vehicleModel}`,
            upfront_percentage: 20,
            delivery_percentage: 80,
          },
        });

      if (paymentError) throw paymentError;

      return shipment.id;
    } catch (error: any) {
      console.error('Error creating shipment:', error);
      throw error;
    }
  };

  const uploadVehiclePhotos = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const photoUri of completionData.vehiclePhotos) {
      if (!photoUri) {
        uploadedUrls.push('');
        continue;
      }

      try {
        const fileName = `${user?.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const base64 = await FileSystem.readAsStringAsync(photoUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { data, error } = await supabase.storage
          .from('vehicle-photos')
          .upload(fileName, decode(base64), {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from('vehicle-photos')
          .getPublicUrl(fileName);

        uploadedUrls.push(urlData.publicUrl);
      } catch (error) {
        console.error('Photo upload error:', error);
        uploadedUrls.push('');
      }
    }

    return uploadedUrls;
  };

  const handlePayment = async () => {
    if (!isReady) {
      Alert.alert('Please Wait', 'Payment is still initializing...');
      return;
    }

    try {
      setIsProcessing(true);

      // Present the payment sheet
      const { error } = await presentPaymentSheet();

      if (error) {
        if (error.code === 'Canceled') {
          console.log('User canceled payment');
          return;
        }
        throw new Error(error.message);
      }

      // Payment successful!
      console.log('Payment confirmed successfully');

      // Create shipment in database
      const newShipmentId = await createShipmentInDatabase(paymentIntentId!);
      setShipmentId(newShipmentId);

      // Notify parent
      onPaymentComplete(paymentIntentId!, newShipmentId);

      Alert.alert(
        'Payment Successful! 🎉',
        'Your shipment has been created. We\'ll notify you when a driver is assigned.',
        [
          {
            text: 'View Shipment',
            onPress: () => onFinalSubmit?.(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Payment error:', error);
      Alert.alert('Payment Failed', error.message || 'Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Payment Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Payment Summary</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Quote:</Text>
            <Text style={styles.summaryValue}>${quotePriceDollars.toFixed(2)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.highlightRow}>
            <View style={styles.highlightLeft}>
              <Text style={styles.highlightTitle}>Initial Payment (20%)</Text>
              <Text style={styles.highlightSubtitle}>Charged today</Text>
            </View>
            <Text style={styles.highlightAmount}>${(upfrontAmount / 100).toFixed(2)}</Text>
          </View>
        </View>

        {/* Remaining Payment Info */}
        <View style={styles.infoCard}>
          <MaterialIcons name="info-outline" size={20} color={Colors.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Remaining Payment:</Text>
            <Text style={styles.infoText}>
              The remaining <Text style={styles.bold}>${(deliveryAmount / 100).toFixed(2)} (80%)</Text> will be charged automatically upon successful delivery of your vehicle.
            </Text>
          </View>
        </View>

        {/* Payment Methods Info */}
        <View style={styles.methodsCard}>
          <Text style={styles.methodsTitle}>Accepted Payment Methods</Text>
          <View style={styles.methodsList}>
            <View style={styles.methodItem}>
              <MaterialIcons name="credit-card" size={24} color={Colors.text.primary} />
              <Text style={styles.methodText}>Credit/Debit Cards</Text>
            </View>
            <View style={styles.methodItem}>
              <MaterialIcons name="apple" size={24} color={Colors.text.primary} />
              <Text style={styles.methodText}>Apple Pay</Text>
            </View>
            <View style={styles.methodItem}>
              <MaterialIcons name="android" size={24} color={Colors.text.primary} />
              <Text style={styles.methodText}>Google Pay</Text>
            </View>
            <View style={styles.methodItem}>
              <MaterialIcons name="account-balance" size={24} color={Colors.text.primary} />
              <Text style={styles.methodText}>Bank Account</Text>
            </View>
          </View>
        </View>

        {/* Security Notice */}
        <View style={styles.securityCard}>
          <MaterialIcons name="lock" size={20} color={Colors.text.secondary} />
          <Text style={styles.securityText}>
            Your payment information is encrypted and secure. We never store your card details.
          </Text>
        </View>

        {/* Pay Button */}
        <TouchableOpacity
          style={[
            styles.payButton,
            (!isReady || isProcessing) && styles.payButtonDisabled,
          ]}
          onPress={handlePayment}
          disabled={!isReady || isProcessing}
        >
          {isProcessing ? (
            <>
              <ActivityIndicator color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.payButtonText}>Processing...</Text>
            </>
          ) : !isReady ? (
            <>
              <ActivityIndicator color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.payButtonText}>Initializing...</Text>
            </>
          ) : (
            <>
              <MaterialIcons name="payment" size={24} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.payButtonText}>
                Pay ${(upfrontAmount / 100).toFixed(2)} Now
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.termsText}>
          By completing this payment, you agree to our Terms of Service and confirm that the information provided is accurate.
        </Text>
      </ScrollView>
    </StripeProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  highlightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  highlightLeft: {
    flex: 1,
  },
  highlightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  highlightSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  highlightAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
  },
  infoCard: {
    backgroundColor: '#EBF8FF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BEE3F8',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#2C5282',
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
  },
  methodsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  methodsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  methodsList: {
    gap: 12,
  },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  methodText: {
    fontSize: 15,
    color: Colors.text.primary,
    marginLeft: 12,
  },
  securityCard: {
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  securityText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 12,
    lineHeight: 20,
  },
  payButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  payButtonDisabled: {
    backgroundColor: Colors.text.disabled,
  },
  buttonIcon: {
    marginRight: 8,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  termsText: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});

// Helper function to decode base64
function decode(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export default EnhancedPaymentStep;
