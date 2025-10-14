import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StripeProvider, CardField, useStripe } from '@stripe/stripe-react-native';

import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../utils/environment';
import { paymentService } from '../../services/paymentService';

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

const InvoicePaymentStep: React.FC<Props> = ({ 
  shipmentData, 
  completionData, 
  onPaymentComplete, 
  onFinalSubmit 
}) => {
  const { confirmPayment } = useStripe();
  const { user, session } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState<any>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [shipmentId, setShipmentId] = useState<string | null>(null);
  const [manualOverride, setManualOverride] = useState(false); // For testing when CardField doesn't fire

  // Use the quote price from shipmentData - this is the price user was quoted
  // NOTE: estimatedPrice is in DOLLARS (not cents) from backend pricing service
  const quotePriceDollars = shipmentData.estimatedPrice || 0; // In dollars
  const quotePrice = Math.round(quotePriceDollars * 100); // Convert to cents for calculations
  
  // Calculate payment breakdown: 20% upfront, 80% on delivery
  const upfrontAmount = Math.round(quotePrice * 0.20);
  const deliveryAmount = quotePrice - upfrontAmount;

  // Initialize component - NO SHIPMENT OR PAYMENT INTENT CREATED YET
  // We'll create both when user clicks Pay button
  useEffect(() => {
    console.log('InvoicePaymentStep mounted');
    console.log('Quote price from shipmentData:', quotePrice, 'cents');
    console.log('User authenticated:', !!user, !!session);
    
    if (!user || !session || quotePrice <= 0) {
      console.error('Invalid initialization state:', {
        hasUser: !!user,
        hasSession: !!session,
        quotePrice
      });
      Alert.alert('Error', 'Unable to initialize payment. Please try again.');
    }
    
    // Just mark as ready - don't create anything yet
    setIsInitializing(false);
  }, []);

  /**
   * Create shipment in PENDING status for payment intent
   * Will be updated to PAID status after successful payment
   */
  const createPendingShipment = async (): Promise<string> => {
    try {
      const apiUrl = getApiUrl();
      
      if (!user?.id || !session) {
        throw new Error('User not authenticated');
      }

      // Get coordinates for the addresses
      let pickupCoords = shipmentData.pickupCoordinates;
      let deliveryCoords = shipmentData.deliveryCoordinates;

      // Geocode if coordinates not available
      if (!pickupCoords && shipmentData.pickupAddress) {
        pickupCoords = await geocodeAddress(shipmentData.pickupAddress);
      }
      if (!deliveryCoords && shipmentData.deliveryAddress) {
        deliveryCoords = await geocodeAddress(shipmentData.deliveryAddress);
      }

      // Use fallback coordinates if geocoding fails
      if (!pickupCoords) {
        pickupCoords = { lat: 32.7767, lng: -96.7970 }; // Dallas fallback
      }
      if (!deliveryCoords) {
        deliveryCoords = { lat: 38.9072, lng: -77.0369 }; // DC fallback
      }

      // Calculate distance
      const calculatedDistance = calculateDistance(
        pickupCoords.lat, pickupCoords.lng,
        deliveryCoords.lat, deliveryCoords.lng
      );

      // Create shipment with PENDING status (will update to PAID after successful payment)
      const shipmentPayload = {
        client_id: user.id,
        pickup_address: shipmentData.pickupAddress,
        pickup_location: `POINT(${pickupCoords.lng} ${pickupCoords.lat})`,
        delivery_address: shipmentData.deliveryAddress,
        delivery_location: `POINT(${deliveryCoords.lng} ${deliveryCoords.lat})`,
        description: `Transport of ${shipmentData.vehicleYear || 'Unknown Year'} ${shipmentData.vehicleMake} ${shipmentData.vehicleModel}`,
        vehicle_type: shipmentData.vehicleType?.toLowerCase() || 'sedan',
        vehicle_year: parseInt(shipmentData.vehicleYear) || new Date().getFullYear(),
        vehicle_make: shipmentData.vehicleMake || 'Unknown',
        vehicle_model: shipmentData.vehicleModel || 'Unknown',
        distance_miles: Math.round(calculatedDistance),
        estimated_price: quotePrice, // Quoted price in cents
        pickup_date: shipmentData.pickupDate || new Date().toISOString().split('T')[0],
        delivery_date: shipmentData.deliveryDate || null,
        is_accident_recovery: false,
        vehicle_count: 1,
        title: `Vehicle Transport - ${shipmentData.vehicleMake} ${shipmentData.vehicleModel}`,
        status: 'pending' // Start as pending, will update to paid after payment
      };

      console.log('Creating pending shipment for payment intent:', shipmentPayload);

      const response = await fetch(`${apiUrl}/api/v1/shipments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(shipmentPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Pending shipment creation failed:', errorText);
        throw new Error(`Failed to create pending shipment: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Pending shipment created successfully:', result);
      
      const shipmentId = result.data?.id || result.id;
      if (!shipmentId) {
        throw new Error('No shipment ID returned from shipment creation');
      }

      return shipmentId;
    } catch (error) {
      console.error('Error creating pending shipment:', error);
      throw error;
    }
  };

  /**
   * Geocoding helper - Converts address to coordinates
   */
  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const apiUrl = getApiUrl();
      
      if (!session) {
        console.warn('No session for geocoding, using fallback coordinates');
        return null;
      }
      
      const response = await fetch(`${apiUrl}/api/v1/maps/geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ address }),
      });
      
      if (!response.ok) {
        console.error('Geocoding failed:', await response.text());
        return null;
      }

      const data = await response.json();
      if (data.data?.latitude && data.data?.longitude) {
        return { lat: data.data.latitude, lng: data.data.longitude };
      }
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  // Calculate distance between two coordinates
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const toRadians = (degrees: number) => degrees * (Math.PI / 180);
    
    const R = 3959; // Earth's radius in miles
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
              
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in miles
  };

  const handlePayment = async () => {
    console.log('Payment button pressed', {
      cardComplete,
      manualOverride,
      userId: user?.id,
      sessionExists: !!session
    });

    // Check if card is complete OR manual override is active
    if (!cardComplete && !manualOverride) {
      Alert.alert('Payment Error', 'Please complete your card information.');
      return;
    }

    // Log if using manual override
    if (manualOverride && !cardComplete) {
      console.log('⚠️ PROCEEDING WITH MANUAL OVERRIDE - CardField validation bypassed');
      console.log('⚠️ Stripe will validate the card during payment processing');
    }

    if (!user?.id || !session) {
      Alert.alert('Authentication Error', 'Please log in to complete payment.');
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Create shipment with PENDING status
      console.log('Creating pending shipment...');
      const createdShipmentId = await createPendingShipment();
      console.log('Pending shipment created:', createdShipmentId);
      setShipmentId(createdShipmentId);

      // Step 2: Create payment intent
      console.log('Creating payment intent for quote price:', quotePriceDollars);
      const paymentIntentResponse = await paymentService.createPaymentIntent(
        createdShipmentId,
        quotePriceDollars,
        `Vehicle transport for ${shipmentData.vehicleYear} ${shipmentData.vehicleMake} ${shipmentData.vehicleModel}`
      );
      console.log('Payment intent created:', (paymentIntentResponse as any).paymentIntentId || paymentIntentResponse.id);

      // Step 3: Confirm payment with Stripe
      console.log('Confirming payment with Stripe...');
      const { error, paymentIntent: confirmedPaymentIntent } = await confirmPayment(
        paymentIntentResponse.client_secret,
        {
          paymentMethodType: 'Card',
        }
      );

      if (error) {
        console.error('Payment confirmation error:', error);
        throw new Error(error.message || 'Payment failed');
      }

      if (confirmedPaymentIntent?.status !== 'Succeeded') {
        throw new Error('Payment was not successful');
      }

      console.log('Payment confirmed successfully!', confirmedPaymentIntent.id);

      // Note: The backend webhook will automatically update shipment payment_status to 'paid'
      // We don't need to manually update it here - the webhook handler does this
      console.log('Shipment payment status will be updated automatically by webhook');

      // Step 4: Call success callback
      onPaymentComplete(confirmedPaymentIntent.id, createdShipmentId);

      Alert.alert(
        'Payment Successful!',
        `Your payment of $${(upfrontAmount / 100).toFixed(2)} has been processed. Shipment confirmed!`,
        [{ text: 'OK', onPress: onFinalSubmit }]
      );
    } catch (error) {
      console.error('Payment error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Payment failed. Please try again.';
      Alert.alert('Payment Failed', errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  if (completionData.paymentCompleted) {
    return (
      <View style={styles.completedContainer}>
        <MaterialIcons name="check-circle" size={64} color="#4CAF50" />
        <Text style={styles.completedTitle}>Payment Successful!</Text>
        <Text style={styles.completedSubtitle}>
          Your payment of ${(upfrontAmount / 100).toFixed(2)} has been processed.
          Remaining ${(deliveryAmount / 100).toFixed(2)} due on delivery.
        </Text>
        <View style={styles.completedDetails}>
          <Text style={styles.completedText}>✓ Payment confirmed</Text>
          <Text style={styles.completedText}>✓ Shipment created</Text>
          <Text style={styles.completedText}>✓ Awaiting for driver assignment</Text>
        </View>
      </View>
    );
  }

  return (
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Shipment Details */}
        <View style={styles.shipmentDetails}>
          <Text style={styles.sectionTitle}>Shipment Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vehicle:</Text>
            <Text style={styles.detailValue}>
              {shipmentData.vehicleYear} {shipmentData.vehicleMake} {shipmentData.vehicleModel}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Route:</Text>
            <Text style={styles.detailValue}>
              {shipmentData.pickupAddress} ? {shipmentData.deliveryAddress}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Distance:</Text>
            <Text style={styles.detailValue}>{shipmentData.distance} miles</Text>
          </View>
        </View>

        {/* Payment Method */}
        <View style={styles.paymentSection}>
          <Text style={styles.paymentTitle}>Payment Method</Text>
          <Text style={styles.paymentSubtitle}>
            Your payment is securely processed by Stripe
          </Text>
          
          <View style={styles.cardContainer}>
            <CardField
              postalCodeEnabled={false}
              placeholders={{
                number: '4242 4242 4242 4242',
              }}
              cardStyle={styles.cardField}
              style={styles.cardFieldContainer}
              onCardChange={(cardDetails) => {
                console.log('═══ CARD CHANGE EVENT ═══');
                console.log('1. Raw cardDetails object:', JSON.stringify(cardDetails, null, 2));
                console.log('2. Individual properties:');
                console.log('   - validNumber:', cardDetails.validNumber, `(type: ${typeof cardDetails.validNumber})`);
                console.log('   - validCVC:', cardDetails.validCVC, `(type: ${typeof cardDetails.validCVC})`);
                console.log('   - validExpiryDate:', cardDetails.validExpiryDate, `(type: ${typeof cardDetails.validExpiryDate})`);
                console.log('   - complete:', cardDetails.complete, `(type: ${typeof cardDetails.complete})`);
                console.log('   - completeType:', typeof cardDetails.complete);
                
                // Try both approaches for validation
                console.log('3. Validation approaches:');
                
                // Approach 1: Check for "Valid" string
                const isNumberValid = cardDetails.validNumber === 'Valid';
                const isCvcValid = cardDetails.validCVC === 'Valid';
                const isExpiryValid = cardDetails.validExpiryDate === 'Valid';
                const isCompleteStrings = isNumberValid && isCvcValid && isExpiryValid;
                console.log('   Approach 1 (Valid strings):', {
                  isNumberValid,
                  isCvcValid,
                  isExpiryValid,
                  result: isCompleteStrings
                });
                
                // Approach 2: Use complete property directly
                const isCompleteProperty = cardDetails.complete === true;
                console.log('   Approach 2 (complete property):', isCompleteProperty);
                
                // Approach 3: Check for non-Invalid states
                const noInvalidFields = 
                  cardDetails.validNumber !== 'Invalid' &&
                  cardDetails.validCVC !== 'Invalid' &&
                  cardDetails.validExpiryDate !== 'Invalid' &&
                  cardDetails.validNumber !== 'Incomplete' &&
                  cardDetails.validCVC !== 'Incomplete' &&
                  cardDetails.validExpiryDate !== 'Incomplete';
                console.log('   Approach 3 (no invalid/incomplete):', noInvalidFields);
                
                // Use the most reliable approach
                const finalIsComplete = isCompleteStrings || isCompleteProperty;
                console.log('4. FINAL DECISION: isComplete =', finalIsComplete);
                
                console.log('5. Updating state...');
                setCardComplete(finalIsComplete);
                setCardError(cardDetails.validNumber === 'Invalid' ? 'Invalid card number' : null);
                
                console.log('6. State update called. New cardComplete:', finalIsComplete);
                console.log('═══════════════════════════\n');
              }}
            />
            {cardError && (
              <View style={styles.errorContainer}>
                <MaterialIcons name="error" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{cardError}</Text>
              </View>
            )}
          </View>

          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <MaterialIcons name="lock" size={16} color={Colors.primary} />
            <Text style={styles.securityText}>
              Your payment information is encrypted and secure. We never store your card details.
            </Text>
          </View>
        </View>

        {/* Payment Summary */}
        <View style={styles.paymentSummary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Shipment Cost:</Text>
            <Text style={styles.summaryAmount}>${quotePriceDollars.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Amount to charge now (20%):</Text>
            <Text style={[styles.summaryAmount, { color: Colors.primary }]}>${(upfrontAmount / 100).toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Due on delivery (80%):</Text>
            <Text style={styles.summaryAmount}>${(deliveryAmount / 100).toFixed(2)}</Text>
          </View>
          <Text style={styles.summaryNote}>
            You will be charged ${(upfrontAmount / 100).toFixed(2)} immediately. The remaining ${(deliveryAmount / 100).toFixed(2)} will be charged upon successful delivery.
          </Text>
        </View>

        {/* Debug Status */}
        {!(cardComplete || manualOverride) && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugText}>
              ⚠️ Please enter complete card details (Number, Expiry, CVC)
            </Text>
            {/* Additional debug info */}
            <Text style={styles.debugTextSmall}>
              Card Complete: {cardComplete ? '✓' : '✗'} | Manual Override: {manualOverride ? '✓' : '✗'}
            </Text>
            
            {/* Manual Override Button - FOR DEBUGGING ONLY */}
            <TouchableOpacity
              style={[styles.debugButton, manualOverride && { backgroundColor: '#4CAF50' }]}
              onPress={() => {
                console.log('🔧 MANUAL OVERRIDE ACTIVATED - Bypassing CardField validation');
                console.log('WARNING: This is for debugging only. CardField onCardChange is not firing!');
                setManualOverride(!manualOverride);
              }}
            >
              <Text style={styles.debugButtonText}>
                {manualOverride ? '✓ Override Active' : '🔧 Enable Manual Override (Debug)'}
              </Text>
            </TouchableOpacity>
            
            <Text style={[styles.debugTextSmall, { marginTop: 8, color: '#FF9800' }]}>
              ⚠️ If CardField validation isn't working, use manual override above
            </Text>
          </View>
        )}

        {/* Payment Button */}
        <TouchableOpacity
          style={[
            styles.payButton,
            (!(cardComplete || manualOverride) || isProcessing) && styles.payButtonDisabled
          ]}
          onPress={handlePayment}
          disabled={!(cardComplete || manualOverride) || isProcessing}
          activeOpacity={0.7}
        >
          {isProcessing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.payButtonText}>Processing...</Text>
            </View>
          ) : (
            <>
              <MaterialIcons name="credit-card" size={24} color="#FFFFFF" />
              <Text style={styles.payButtonText}>
                Pay ${(upfrontAmount / 100).toFixed(2)} Now
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Terms Notice */}
        <Text style={styles.termsText}>
          By completing this payment, you agree to our Terms of Service and authorize this charge
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  completedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  completedSubtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  completedDetails: {
    width: '100%',
  },
  completedText: {
    fontSize: 16,
    color: Colors.text.primary,
    marginVertical: 8,
    textAlign: 'center',
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
  },
  debugContainer: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    margin: 16,
    marginTop: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  debugText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    marginBottom: 4,
  },
  debugTextSmall: {
    fontSize: 11,
    color: '#856404',
    textAlign: 'center',
  },
  debugButton: {
    backgroundColor: '#FF9800',
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
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
  },
});

export default InvoicePaymentStep;
