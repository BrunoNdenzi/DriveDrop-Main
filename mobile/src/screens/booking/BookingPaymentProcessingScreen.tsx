import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Alert, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Colors, Typography, Spacing } from '../../constants/DesignSystem';
import { RootStackParamList } from '../../navigation/types';
import { useBooking } from '../../context/BookingContext';
import { StripePaymentForm } from '../../components/payment/StripePaymentForm';
import { PaymentPolicyCard } from '../../components/payment/PaymentPolicyCard';
import { ShipmentService } from '../../services/shipmentService';
import { paymentService } from '../../services/paymentService';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';

type BookingPaymentProcessingProps = NativeStackScreenProps<RootStackParamList, 'BookingPaymentProcessing'>;

export default function BookingPaymentProcessingScreen({ navigation, route }: BookingPaymentProcessingProps) {
  const { state } = useBooking();
  const [shipmentId, setShipmentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Get amount and quote from route params
  const amount = route.params?.amount || 0;
  const quote = route.params?.quote || { service: 'Standard', price: 0, days: '7-10' };
  
  // Create shipment when the screen loads
  useEffect(() => {
    const createShipment = async () => {
      try {
        setIsSubmitting(true);
        
        // Get user profile and log for debugging
        const userResponse = await supabase.auth.getUser();
        console.log('Auth User Response:', JSON.stringify(userResponse));
        
        const { data: { user } } = userResponse;
        if (!user) {
          console.error('Authentication error: No user found in session');
          throw new Error('User not authenticated');
        }
        
        console.log('Authenticated User ID:', user.id);
        
        // Get session to verify authentication
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
          console.error('Session error:', sessionError);
          throw new Error('No active session. Please log in again.');
        }
        
        // Format shipment data from booking context
        const shipmentData = {
          // client_id will be set by ShipmentService based on the authenticated user
          title: `${state.formData.vehicleInformation.year} ${state.formData.vehicleInformation.make} ${state.formData.vehicleInformation.model}`,
          description: `Vehicle Transport: ${state.formData.vehicleInformation.year} ${state.formData.vehicleInformation.make} ${state.formData.vehicleInformation.model}`,
          pickup_address: state.formData.pickupDetails.address || 'No address provided',
          pickup_notes: `Contact: ${state.formData.pickupDetails.contactPerson}, Phone: ${state.formData.pickupDetails.contactPhone}, Date: ${state.formData.pickupDetails.date}`,
          delivery_address: state.formData.deliveryDetails.address || 'No address provided',
          delivery_notes: `Contact: ${state.formData.deliveryDetails.contactPerson}, Phone: ${state.formData.deliveryDetails.contactPhone}, Date: ${state.formData.deliveryDetails.date}`,
          status: 'pending', // Explicitly set status to match RLS policy expectations
          estimated_price: quote.price
        };
        
        // Log the complete shipment data being sent
        console.log('Shipment insert payload:', JSON.stringify(shipmentData));
        
        // Create shipment in database - passing the user ID
        console.log('Calling ShipmentService.createShipment with user ID:', user.id);
        const createdShipment = await ShipmentService.createShipment(shipmentData, user.id);
        
        console.log('Shipment created successfully:', JSON.stringify(createdShipment));
        setShipmentId(createdShipment.id);
        setIsSubmitting(false);
      } catch (error: any) { // Type as any to access error properties
        console.error('Error creating shipment (full error):', error);
        // Log more details about the error
        if (error && error.code) {
          console.error(`Error code: ${error.code}, Message: ${error.message || 'No message'}`);
          console.error('Error details:', error.details || 'No details');
        }
        setErrorMessage('Failed to create shipment. Please try again.');
        setIsSubmitting(false);
      }
    };
    
    createShipment();
  }, []);
  
  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
    Alert.alert(
      'Payment Successful!',
      'Your shipment request has been submitted. You will receive a confirmation email shortly.',
      [
        {
          text: 'View Confirmation',
          onPress: () => navigation.navigate('BookingConfirmation', { 
            shipmentId: shipmentId || '' 
          })
        }
      ]
    );
  };
  
  const handlePaymentError = (error: string) => {
    setErrorMessage(error);
    Alert.alert('Payment Failed', error, [
      {
        text: 'Try Again',
        onPress: () => setErrorMessage(null)
      },
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => navigation.goBack()
      }
    ]);
  };
  
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Secure Payment with Stripe</Text>
        <Text style={styles.subtitle}>Your payment is processed securely by Stripe</Text>
      </View>
      
      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        {isSubmitting ? (
          <Card variant="default" padding="lg">
            <Text style={styles.processingText}>Creating your shipment...</Text>
          </Card>
        ) : errorMessage && !shipmentId ? (
          <Card variant="default" padding="lg">
            <Text style={styles.errorTitle}>Payment Error</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <View style={styles.errorDetails}>
              <Text style={styles.errorDetailsText}>
                If this error persists, please contact support with the following details:
              </Text>
              <Text style={styles.errorCode}>Error: SHIPMENT_CREATION_FAILED</Text>
              <Text style={styles.errorTimestamp}>Time: {new Date().toISOString()}</Text>
            </View>
            <Button 
              title="Try Again" 
              onPress={() => navigation.goBack()} 
              style={styles.button}
            />
          </Card>
        ) : shipmentId && !paymentSuccess ? (
          <>
            {/* Payment Policy Card - Shows 20%/80% Split */}
            <PaymentPolicyCard
              totalAmount={amount}
              paymentType="initial"
              isRefundable={true}
              refundDeadline={new Date(Date.now() + 60 * 60 * 1000).toISOString()} // 1 hour from now
            />

            <Card variant="default" padding="lg" style={styles.stripeNoticeCard}>
              <Text style={styles.stripeNotice}>
                Your payment will be securely processed by Stripe. DriveDrop uses Stripe, a PCI-DSS compliant payment processor, to handle all payments securely. Your payment information is never stored on our servers.
              </Text>
              <Text style={styles.paymentAmountNotice}>
                You are making the initial 20% payment of ${(amount * 0.2/100).toFixed(2)}. The remaining 80% payment of ${(amount * 0.8/100).toFixed(2)} will be collected upon successful delivery.
              </Text>
            </Card>
            <StripePaymentForm
              amount={Math.round(amount * 0.2)} // Only charge 20% now
              shipmentId={shipmentId}
              onPaymentSuccess={handlePaymentSuccess}
              onPaymentError={handlePaymentError}
            />
            <View style={styles.securityInfoContainer}>
              <Text style={styles.securityInfoTitle}>Secure Payment Information</Text>
              <Text style={styles.securityInfoText}>
                • Your card details are encrypted and secure
              </Text>
              <Text style={styles.securityInfoText}>
                • Transactions are protected by Stripe's fraud prevention
              </Text>
              <Text style={styles.securityInfoText}>
                • View Stripe's <Text style={styles.securityInfoLink}>Terms of Service</Text> and <Text style={styles.securityInfoLink}>Privacy Policy</Text>
              </Text>
            </View>
          </>
        ) : null}
        
        {paymentSuccess && (
          <Card variant="default" padding="lg">
            <Text style={styles.successText}>Payment Successful!</Text>
            <Text style={styles.subText}>Your shipment has been booked successfully.</Text>
            <Button 
              title="View Shipment Details" 
              onPress={() => navigation.navigate('BookingConfirmation', { 
                shipmentId: shipmentId || '' 
              })} 
              style={styles.button}
            />
          </Card>
        )}
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
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 5,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40, // Extra padding at the bottom for better scrolling
  },
  stripeNoticeCard: {
    marginBottom: 15,
    backgroundColor: Colors.background,
    borderColor: Colors.primary,
    borderLeftWidth: 4,
  },
  stripeNotice: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  securityInfoContainer: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 15,
    marginTop: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  securityInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 10,
  },
  securityInfoText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  securityInfoLink: {
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  processingText: {
    fontSize: 16,
    textAlign: 'center',
    color: Colors.text.primary,
    marginVertical: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.error,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 5,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginVertical: 10,
  },
  errorDetails: {
    marginTop: 15,
    padding: 10,
    backgroundColor: Colors.background,
    borderRadius: 4,
    borderLeftWidth: 2,
    borderLeftColor: Colors.error,
  },
  errorDetailsText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  paymentAmountNotice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: 15,
    textAlign: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  errorCode: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  errorTimestamp: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: Colors.text.secondary,
  },
  successText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.success,
    textAlign: 'center',
    marginVertical: 10,
  },
  subText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    marginTop: 20,
  },
});
