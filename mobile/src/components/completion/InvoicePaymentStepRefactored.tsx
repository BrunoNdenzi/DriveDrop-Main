import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useStripe, StripeProvider, initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { paymentService } from '../../services/paymentService';
import { getApiUrl } from '../../utils/environment';
import * as Sentry from '@sentry/react-native';

const apiUrl = getApiUrl();

interface InvoicePaymentStepProps {
  totalPrice: number;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleVIN: string;
  pickupLocation: string;
  deliveryLocation: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  pickupLatitude: number;
  pickupLongitude: number;
  deliveryLatitude: number;
  deliveryLongitude: number;
  distance: number;
  clientPhotos: { uri: string; type: string }[];
  onComplete: (shipmentId: string) => void;
  stripePublishableKey: string;
}

interface ErrorDetails {
  code?: string;
  message: string;
  decline_code?: string;
}

const InvoicePaymentStepRefactored: React.FC<InvoicePaymentStepProps> = ({
  totalPrice,
  vehicleYear,
  vehicleMake,
  vehicleModel,
  vehicleVIN,
  pickupLocation,
  deliveryLocation,
  clientName,
  clientEmail,
  clientPhone,
  pickupLatitude,
  pickupLongitude,
  deliveryLatitude,
  deliveryLongitude,
  distance,
  clientPhotos,
  onComplete,
  stripePublishableKey,
}) => {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // Calculate payment amounts
  const upfrontAmount = totalPrice * 0.2;
  const remainingAmount = totalPrice * 0.8;

  useEffect(() => {
    // Create payment intent immediately when component mounts
    createPaymentIntent();
  }, []);

  useEffect(() => {
    // Initialize Payment Sheet when we have client secret
    if (clientSecret && stripePublishableKey) {
      initializePaymentSheet();
    }
  }, [clientSecret, stripePublishableKey]);

  /**
   * Step 1: Create Payment Intent WITHOUT shipment
   * This prevents orphaned shipments if payment fails
   */
  const createPaymentIntent = async () => {
    try {
      console.log('🔄 Creating payment intent for amount:', totalPrice);
      
      const response = await paymentService.createPaymentIntent(
        null, // No shipmentId yet!
        totalPrice,
        `${vehicleYear} ${vehicleMake} ${vehicleModel} - ${pickupLocation} to ${deliveryLocation}`,
        {
          // Rich metadata for analytics and support
          vehicle: `${vehicleYear} ${vehicleMake} ${vehicleModel}`,
          vin: vehicleVIN,
          pickup_location: pickupLocation,
          delivery_location: deliveryLocation,
          customer_name: clientName,
          customer_email: clientEmail,
          customer_phone: clientPhone,
          distance: distance.toString(),
          upfront_amount: upfrontAmount.toFixed(2),
          remaining_amount: remainingAmount.toFixed(2),
        }
      );

      setPaymentIntentId(response.id);
      setClientSecret(response.client_secret);
      
      console.log('✅ Payment intent created:', response.id);
      
      Sentry.addBreadcrumb({
        category: 'payment',
        message: 'Payment intent created',
        level: 'info',
        data: {
          paymentIntentId: response.id,
          amount: totalPrice,
        },
      });
    } catch (err: any) {
      console.error('❌ Payment intent creation failed:', err);
      
      Sentry.captureException(err, {
        tags: { flow: 'payment_intent_creation' },
        extra: {
          amount: totalPrice,
          vehicle: `${vehicleYear} ${vehicleMake} ${vehicleModel}`,
        },
      });
      
      setError(getErrorMessage(err));
      Alert.alert(
        'Payment Setup Failed',
        'Unable to initialize payment. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    }
  };

  /**
   * Initialize Payment Sheet (Supports Apple Pay, Google Pay, Cards)
   */
  const initializePaymentSheet = async () => {
    try {
      console.log('🔄 Initializing Payment Sheet...');

      const { error } = await initPaymentSheet({
        merchantDisplayName: 'DriveDrop',
        paymentIntentClientSecret: clientSecret!,
        applePay: {
          merchantCountryCode: 'US',
        },
        googlePay: {
          merchantCountryCode: 'US',
          testEnv: __DEV__,
        },
        allowsDelayedPaymentMethods: true,
        returnURL: 'drivedrop://payment-sheet',
      });

      if (error) {
        console.error('❌ Payment Sheet initialization failed:', error);
        setError('Failed to initialize payment. Please try again.');
        return;
      }

      setReady(true);
      console.log('✅ Payment Sheet initialized');
    } catch (err: any) {
      console.error('❌ Payment Sheet initialization error:', err);
      setError('Failed to initialize payment. Please try again.');
    }
  };

  /**
   * Step 2: Confirm Payment with Stripe
   */
  const handlePayment = async () => {
    if (!ready || !clientSecret) {
      Alert.alert('Payment Not Ready', 'Please wait for payment to initialize.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      console.log('🔄 Presenting Payment Sheet...');
      
      Sentry.addBreadcrumb({
        category: 'payment',
        message: 'Presenting Payment Sheet',
        level: 'info',
        data: { paymentIntentId },
      });

      const { error: paymentError } = await presentPaymentSheet();

      if (paymentError) {
        // User cancelled or error occurred
        if (paymentError.code === 'Canceled') {
          console.log('ℹ️ Payment cancelled by user');
          setProcessing(false);
          return;
        }
        throw paymentError;
      }

      console.log('✅ Payment confirmed successfully');
      
      Sentry.addBreadcrumb({
        category: 'payment',
        message: 'Payment confirmed successfully',
        level: 'info',
        data: { paymentIntentId },
      });

      // Step 3: Create shipment AFTER successful payment
      await createShipmentAfterPayment(paymentIntentId!);

    } catch (err: any) {
      console.error('❌ Payment failed:', err);
      
      Sentry.captureException(err, {
        tags: { flow: 'payment_confirmation' },
        extra: {
          paymentIntentId,
          errorCode: err.code,
        },
      });
      
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      
      Alert.alert(
        'Payment Failed',
        errorMessage,
        [{ text: 'Try Again', onPress: () => setError(null) }]
      );
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Step 3: Create Shipment AFTER successful payment
   * This prevents orphaned shipments!
   */
  const createShipmentAfterPayment = async (confirmedPaymentIntentId: string) => {
    try {
      console.log('🔄 Creating shipment after successful payment...');

      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) {
        throw new Error('User not authenticated');
      }

      // Create shipment with paid status
      const shipmentData = {
        client_id: user.user.id,
        title: `${vehicleYear} ${vehicleMake} ${vehicleModel}`,
        vehicle_year: vehicleYear ? parseInt(vehicleYear) : null,
        vehicle_make: vehicleMake,
        vehicle_model: vehicleModel,
        pickup_address: pickupLocation,
        delivery_address: deliveryLocation,
        distance,
        estimated_price: totalPrice,
        status: 'accepted' as const, // Payment confirmed, ready for driver assignment
        payment_status: 'completed' as const, // Payment successfully processed
      };

      const { data: shipments, error: shipmentError } = await supabase
        .from('shipments')
        .insert(shipmentData)
        .select();

      if (shipmentError || !shipments || shipments.length === 0) {
        throw new Error('Failed to create shipment: ' + shipmentError?.message);
      }

      const shipment = shipments[0];

      console.log('✅ Shipment created:', shipment.id);

      // Step 4: Update payment record with shipmentId
      await updatePaymentWithShipment(confirmedPaymentIntentId, shipment.id);

      // Step 5: Upload photos AFTER payment success
      await uploadClientPhotos(shipment.id);

      // Step 6: Trigger email notification
      await sendPaymentSuccessEmail(confirmedPaymentIntentId, shipment.id);

      // Success!
      Sentry.addBreadcrumb({
        category: 'shipment',
        message: 'Shipment created successfully after payment',
        level: 'info',
        data: { shipmentId: shipment.id },
      });

      onComplete(shipment.id);

    } catch (err: any) {
      console.error('❌ Shipment creation failed after payment:', err);
      
      Sentry.captureException(err, {
        tags: { flow: 'post_payment_shipment_creation' },
        extra: {
          paymentIntentId: confirmedPaymentIntentId,
          message: 'Payment succeeded but shipment creation failed - CRITICAL',
        },
      });

      // CRITICAL: Payment succeeded but shipment failed
      // This needs manual intervention
      Alert.alert(
        'Payment Successful - Action Required',
        'Your payment was processed successfully, but there was an issue creating your shipment. Please contact support with reference: ' + confirmedPaymentIntentId,
        [{ text: 'OK' }]
      );
    }
  };

  /**
   * Step 4: Update payment record with shipmentId
   */
  const updatePaymentWithShipment = async (paymentId: string, shipmentId: string) => {
    try {
      const { error } = await supabase
        .from('payments')
        .update({ shipment_id: shipmentId })
        .eq('payment_intent_id', paymentId);

      if (error) {
        console.error('⚠️ Failed to update payment with shipmentId:', error);
        // Don't throw - this is not critical enough to stop the flow
      } else {
        console.log('✅ Payment updated with shipmentId');
      }
    } catch (err) {
      console.error('⚠️ Error updating payment:', err);
      // Don't throw - this is not critical
    }
  };

  /**
   * Step 5: Upload photos AFTER payment success
   * Prevents wasted storage on failed payments
   */
  const uploadClientPhotos = async (shipmentId: string) => {
    if (!clientPhotos || clientPhotos.length === 0) {
      console.log('📸 No photos to upload');
      return;
    }

    try {
      console.log('🔄 Uploading', clientPhotos.length, 'photos...');

      const uploadPromises = clientPhotos.map(async (photo, index) => {
        const fileName = `${shipmentId}_${index}_${Date.now()}.jpg`;
        const filePath = `client-photos/${shipmentId}/${fileName}`;

        // Fetch the image as blob
        const response = await fetch(photo.uri);
        const blob = await response.blob();

        const { error } = await supabase.storage
          .from('shipment-photos')
          .upload(filePath, blob, {
            contentType: photo.type || 'image/jpeg',
            upsert: false,
          });

        if (error) throw error;

        return filePath;
      });

      await Promise.all(uploadPromises);
      console.log('✅ All photos uploaded successfully');

    } catch (err: any) {
      console.error('⚠️ Photo upload failed:', err);
      
      Sentry.captureException(err, {
        tags: { flow: 'photo_upload' },
        extra: { shipmentId, photoCount: clientPhotos.length },
      });
      
      // Don't throw - photos are not critical enough to fail the entire flow
    }
  };

  /**
   * Step 6: Send payment success email
   * Backup in case webhook fails
   */
  const sendPaymentSuccessEmail = async (paymentId: string, shipmentId: string) => {
    try {
      await fetch(`${apiUrl}/payments/notify-payment-success`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId: paymentId,
          shipmentId,
        }),
      });
      console.log('✅ Payment success email triggered');
    } catch (err) {
      console.error('⚠️ Email notification failed:', err);
      // Don't throw - webhook will handle email as backup
    }
  };

  /**
   * User-friendly error messages
   */
  const getErrorMessage = (error: ErrorDetails): string => {
    const errorMap: Record<string, string> = {
      // Card errors
      card_declined: 'Your card was declined. Please try a different payment method.',
      insufficient_funds: 'Insufficient funds. Please use a different card.',
      expired_card: 'Your card has expired. Please use a different card.',
      incorrect_cvc: 'Incorrect security code (CVC). Please check and try again.',
      incorrect_number: 'Invalid card number. Please check and try again.',
      invalid_expiry_month: 'Invalid expiration month. Please check your card details.',
      invalid_expiry_year: 'Invalid expiration year. Please check your card details.',
      invalid_cvc: 'Invalid security code (CVC). Please check your card details.',
      
      // Processing errors
      processing_error: 'An error occurred while processing your card. Please try again.',
      card_not_supported: 'This card is not supported. Please use a different card.',
      currency_not_supported: 'This currency is not supported for your card.',
      
      // Fraud prevention
      fraudulent: 'This transaction was flagged for review. Please contact your bank.',
      card_velocity_exceeded: 'You have exceeded the number of card attempts. Please try again later.',
      
      // Network errors
      network_error: 'Network error. Please check your connection and try again.',
      
      // Generic errors
      generic_decline: 'Your card was declined. Please contact your bank for more information.',
      
      // Decline codes
      do_not_honor: 'Your card was declined. Please contact your bank.',
      lost_card: 'This card has been reported lost. Please use a different card.',
      stolen_card: 'This card has been reported stolen. Please use a different card.',
      invalid_account: 'Invalid card account. Please use a different card.',
    };

    // Check error code
    if (error.code && errorMap[error.code]) {
      return errorMap[error.code];
    }

    // Check decline code
    if (error.decline_code && errorMap[error.decline_code]) {
      return errorMap[error.decline_code];
    }

    // Return original message or generic error
    return error.message || 'Payment failed. Please try again or contact support.';
  };

  return (
    <StripeProvider publishableKey={stripePublishableKey}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Shipment Details */}
        <View style={styles.shipmentDetails}>
          <Text style={styles.sectionTitle}>Shipment Details</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vehicle</Text>
            <Text style={styles.detailValue}>{vehicleYear} {vehicleMake} {vehicleModel}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>VIN</Text>
            <Text style={styles.detailValue}>{vehicleVIN}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>From</Text>
            <Text style={styles.detailValue}>{pickupLocation}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>To</Text>
            <Text style={styles.detailValue}>{deliveryLocation}</Text>
          </View>
          
          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.detailLabel}>Distance</Text>
            <Text style={styles.detailValue}>{distance.toFixed(1)} miles</Text>
          </View>
        </View>

        {/* Payment Summary */}
        <View style={styles.paymentSummary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Estimate</Text>
            <Text style={styles.summaryAmount}>${totalPrice.toFixed(2)}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Pay Now (20%)</Text>
            <Text style={[styles.summaryAmount, { color: Colors.primary }]}>
              ${upfrontAmount.toFixed(2)}
            </Text>
          </View>
          
          <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.summaryLabel}>Due at Delivery (80%)</Text>
            <Text style={styles.summaryAmount}>${remainingAmount.toFixed(2)}</Text>
          </View>
          
          <Text style={styles.summaryNote}>
            We'll hold the full amount (${totalPrice.toFixed(2)}) on your card. Only 20% (${upfrontAmount.toFixed(2)}) will be charged now. The remaining 80% will be charged upon delivery.
          </Text>
        </View>

        {/* Important Notice */}
        <View style={styles.importantNotice}>
          <MaterialIcons name="info-outline" size={24} color="#FF9800" />
          <View style={styles.noticeTextContainer}>
            <Text style={styles.noticeTitle}>Authorization Hold</Text>
            <Text style={styles.noticeText}>
              Your bank will show a temporary hold for the full amount. This is normal and protects both you and the driver. Only the upfront payment will be charged now.
            </Text>
          </View>
        </View>

        {/* Payment Section */}
        <View style={styles.paymentSection}>
          <Text style={styles.paymentTitle}>Payment Information</Text>
          <Text style={styles.paymentSubtitle}>
            Choose your preferred payment method
          </Text>

          {/* Payment Methods Available */}
          <View style={styles.paymentMethodsContainer}>
            <View style={styles.paymentMethodItem}>
              <MaterialIcons name="credit-card" size={24} color={Colors.primary} />
              <Text style={styles.paymentMethodText}>Credit/Debit Card</Text>
            </View>
            <View style={styles.paymentMethodItem}>
              <MaterialIcons name="apple" size={24} color={Colors.primary} />
              <Text style={styles.paymentMethodText}>Apple Pay</Text>
            </View>
            <View style={styles.paymentMethodItem}>
              <MaterialIcons name="android" size={24} color={Colors.primary} />
              <Text style={styles.paymentMethodText}>Google Pay</Text>
            </View>
          </View>

          {!ready && !error && (
            <View style={styles.loadingPayment}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.loadingText}>Setting up secure payment...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error-outline" size={20} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {ready && (
            <View style={styles.readyContainer}>
              <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
              <Text style={styles.readyText}>Payment ready - tap button below to continue</Text>
            </View>
          )}

          <View style={styles.securityNotice}>
            <MaterialIcons name="lock" size={20} color={Colors.primary} />
            <Text style={styles.securityText}>
              256-bit encrypted and PCI DSS compliant. Your payment information is secure.
            </Text>
          </View>
        </View>

        {/* Pay Button */}
        <TouchableOpacity
          style={[
            styles.payButton,
            (!ready || processing) && styles.payButtonDisabled,
          ]}
          onPress={handlePayment}
          disabled={!ready || processing}
        >
          {processing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.payButtonText}>Processing...</Text>
            </View>
          ) : (
            <>
              <MaterialIcons name="lock" size={24} color="#FFFFFF" />
              <Text style={styles.payButtonText}>
                Pay ${upfrontAmount.toFixed(2)} Now
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.termsText}>
          By completing this payment, you agree to our Terms of Service and Privacy Policy. The full amount will be authorized, but only 20% charged now.
        </Text>
      </ScrollView>
    </StripeProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  shipmentDetails: {
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  paymentSection: {
    padding: 16,
    margin: 16,
    marginTop: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  paymentTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  paymentSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  paymentMethodsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  paymentMethodItem: {
    alignItems: 'center',
    flex: 1,
  },
  paymentMethodText: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  loadingPayment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 12,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: Colors.text.secondary,
  },
  readyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    marginBottom: 12,
  },
  readyText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#2E7D32',
    flex: 1,
  },
  cardContainer: {
    marginBottom: 16,
  },
  cardFieldContainer: {
    height: 50,
    marginVertical: 8,
  },
  cardField: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    textColor: '#263238',
    placeholderColor: '#9E9E9E',
    textErrorColor: '#F44336',
  } as any,
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: Colors.primary,
    marginLeft: 8,
  },
  paymentSummary: {
    padding: 16,
    margin: 16,
    marginTop: 0,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  summaryNote: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 12,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  importantNotice: {
    flexDirection: 'row',
    backgroundColor: '#FFF9E6',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  noticeTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 12,
    color: '#5D4037',
    lineHeight: 18,
  },
  payButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    padding: 16,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  payButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  termsText: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 24,
    lineHeight: 18,
  },
});

export default InvoicePaymentStepRefactored;
