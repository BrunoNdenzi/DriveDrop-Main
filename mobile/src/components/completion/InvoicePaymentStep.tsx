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
import { StripeProvider, CardField, useStripe, useConfirmPayment, PaymentIntent } from '@stripe/stripe-react-native';

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
  onPaymentComplete: (paymentIntentId: string) => void;
  onFinalSubmit?: () => void;
}

interface InvoiceLineItem {
  description: string;
  amount: number;
  type: 'base' | 'fee' | 'insurance' | 'tax';
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
  const [shipmentCreated, setShipmentCreated] = useState(false);
  const [shipmentId, setShipmentId] = useState<string | null>(null);

  // Calculate invoice line items
  const calculateInvoice = (): InvoiceLineItem[] => {
    const basePrice = shipmentData.estimatedPrice || 0;
    const insuranceFee = Math.round(basePrice * 0.02); // 2% insurance
    const processingFee = Math.round(basePrice * 0.029 + 30); // 2.9% + $0.30 Stripe fee
    const tax = Math.round((basePrice + insuranceFee + processingFee) * 0.08); // 8% tax
    
    return [
      {
        description: 'Vehicle Transport Service',
        amount: basePrice,
        type: 'base'
      },
      {
        description: 'Transport Insurance',
        amount: insuranceFee,
        type: 'insurance'
      },
      {
        description: 'Payment Processing Fee',
        amount: processingFee,
        type: 'fee'
      },
      {
        description: 'Tax',
        amount: tax,
        type: 'tax'
      }
    ];
  };

  const invoiceItems = calculateInvoice();
  const totalAmount = invoiceItems.reduce((sum, item) => sum + item.amount, 0);
  
  // Calculate payment breakdown: 20% upfront, 80% on delivery
  const upfrontAmount = Math.round(totalAmount * 0.20);
  const deliveryAmount = totalAmount - upfrontAmount;

  // Create payment intent when component mounts
  useEffect(() => {
    console.log('InvoicePaymentStep mounted, creating payment intent...');
    console.log('User authenticated:', !!user, !!session);
    console.log('Total amount:', totalAmount);
    createPaymentIntent();
  }, []);

  const createPaymentIntent = async () => {
    try {
      console.log('Starting payment intent creation...');
      if (!user?.id || !session) {
        console.error('User not authenticated:', { userId: user?.id, hasSession: !!session });
        throw new Error('User not authenticated');
      }

      // Create the full shipment with all proper data (backend RLS is now fixed)
      console.log('Creating shipment with details...');
      const shipment = await createShipmentWithAllDetails();
      console.log('Shipment created:', shipment.id);

      console.log('Creating payment intent for amount:', totalAmount);
      const response = await paymentService.createPaymentIntent(
        shipment.id,
        totalAmount, // Send full amount in dollars - backend calculates 20%
        `Vehicle transport for ${shipmentData.vehicleYear} ${shipmentData.vehicleMake} ${shipmentData.vehicleModel}`
      );

      console.log('Payment intent created:', response);
      setPaymentIntent(response);
      setShipmentId(shipment.id); // Store for later use
      console.log('Payment intent state updated successfully');
    } catch (error) {
      console.error('Error creating payment intent:', error);
      Alert.alert('Error', 'Failed to initialize payment. Please try again.');
    }
  };

  const createShipmentWithAllDetails = async () => {
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

      // Create comprehensive shipment payload with ALL required fields
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
        estimated_price: shipmentData.estimatedPrice || 0,
        pickup_date: shipmentData.pickupDate || new Date().toISOString().split('T')[0],
        delivery_date: shipmentData.deliveryDate || null,
        is_accident_recovery: false,
        vehicle_count: 1,
        title: `Vehicle Transport - ${shipmentData.vehicleMake} ${shipmentData.vehicleModel}`,
        status: 'pending'
      };

      console.log('Creating shipment with full details:', shipmentPayload);

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
        console.error('Shipment creation failed:', errorText);
        throw new Error(`Failed to create shipment: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Shipment created successfully:', result);
      
      // Extract shipment ID
      const shipmentId = result.data?.id || result.id;
      if (!shipmentId) {
        throw new Error('No shipment ID returned from shipment creation');
      }

      return { id: shipmentId };
    } catch (error) {
      console.error('Error creating shipment with all details:', error);
      throw error;
    }
  };

  const createMinimalShipment = async () => {
    try {
      const apiUrl = getApiUrl();
      
      if (!user?.id || !session) {
        throw new Error('User not authenticated');
      }

      // Get coordinates for the addresses (required by backend validation)
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

      // Create minimal shipment with all required fields
      const minimalPayload = {
        client_id: user.id,
        pickup_address: shipmentData.pickupAddress || 'TBD',
        pickup_location: `POINT(${pickupCoords.lng} ${pickupCoords.lat})`, // Required by backend
        delivery_address: shipmentData.deliveryAddress || 'TBD',
        delivery_location: `POINT(${deliveryCoords.lng} ${deliveryCoords.lat})`, // Required by backend  
        description: `Draft - ${shipmentData.vehicleMake} ${shipmentData.vehicleModel}`,
        estimated_price: shipmentData.estimatedPrice || 0,
        title: 'Draft Shipment',
        status: 'draft'
      };

      console.log('Creating minimal shipment:', minimalPayload);

      const response = await fetch(`${apiUrl}/api/v1/shipments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(minimalPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Minimal shipment creation failed:', errorText);
        throw new Error(`Failed to create minimal shipment: ${response.status}`);
      }

      const result = await response.json();
      console.log('Minimal shipment created:', result);
      
      // Extract shipment ID
      const shipmentId = result.data?.id || result.id;
      if (!shipmentId) {
        throw new Error('No shipment ID returned from minimal shipment creation');
      }

      return { id: shipmentId };
    } catch (error) {
      console.error('Error creating minimal shipment:', error);
      throw error;
    }
  };

  const geocodeAddress = async (address: string): Promise<{lat: number, lng: number}> => {
    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        console.warn('Google Maps API key not found, using fallback coordinates');
        return getFallbackCoordinates(address);
      }

      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        return {
          lat: location.lat,
          lng: location.lng
        };
      }
      
      console.warn('Geocoding failed for address:', address, 'Status:', data.status);
      return getFallbackCoordinates(address);
    } catch (error) {
      console.error('Error geocoding address:', address, error);
      return getFallbackCoordinates(address);
    }
  };

  const getFallbackCoordinates = (address: string): {lat: number, lng: number} => {
    // Common US city coordinates as fallbacks
    const cityCoordinates: Record<string, {lat: number, lng: number}> = {
      'dallas': { lat: 32.7767, lng: -96.7970 },
      'san diego': { lat: 32.7157, lng: -117.1611 },
      'los angeles': { lat: 34.0522, lng: -118.2437 },
      'new york': { lat: 40.7128, lng: -74.0060 },
      'chicago': { lat: 41.8781, lng: -87.6298 },
      'houston': { lat: 29.7604, lng: -95.3698 },
      'phoenix': { lat: 33.4484, lng: -112.0740 },
      'miami': { lat: 25.7617, lng: -80.1918 },
      'seattle': { lat: 47.6062, lng: -122.3321 },
      'denver': { lat: 39.7392, lng: -104.9903 },
    };

    // Try to match city name from address
    const addressLower = address.toLowerCase();
    for (const [city, coords] of Object.entries(cityCoordinates)) {
      if (addressLower.includes(city)) {
        console.log(`Using fallback coordinates for ${city}: ${coords.lat}, ${coords.lng}`);
        return coords;
      }
    }

    // Extract state and provide state-level fallback
    const stateCoordinates: Record<string, {lat: number, lng: number}> = {
      'tx': { lat: 31.9686, lng: -99.9018 }, // Texas center
      'ca': { lat: 36.7783, lng: -119.4179 }, // California center
      'ny': { lat: 40.7128, lng: -74.0060 }, // New York center
      'fl': { lat: 27.7663, lng: -82.6404 }, // Florida center
    };

    for (const [state, coords] of Object.entries(stateCoordinates)) {
      if (addressLower.includes(state)) {
        console.log(`Using fallback state coordinates for ${state}: ${coords.lat}, ${coords.lng}`);
        return coords;
      }
    }

    // Ultimate fallback (geographic center of US)
    console.log('Using default US center coordinates');
    return { lat: 39.8283, lng: -98.5795 };
  };

  // Calculate distance between two coordinates using Haversine formula
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
      paymentIntent: !!paymentIntent,
      cardComplete,
      userId: user?.id,
      sessionExists: !!session
    });

    if (!paymentIntent || !cardComplete) {
      Alert.alert('Payment Error', 'Please complete your card information.');
      return;
    }

    if (!user?.id || !session) {
      Alert.alert('Authentication Error', 'Please log in to complete payment.');
      return;
    }

    setIsProcessing(true);

    try {
      const { error, paymentIntent: confirmedPaymentIntent } = await confirmPayment(
        paymentIntent.client_secret,
        {
          paymentMethodType: 'Card',
        }
      );

      if (error) {
        console.error('Payment confirmation error:', error);
        Alert.alert('Payment Failed', error.message || 'Payment could not be processed.');
        return;
      }

      if (confirmedPaymentIntent && confirmedPaymentIntent.status.toString() === 'Succeeded') {
        // Payment successful, now create the shipment with all completion data
        await createShipmentWithPayment(confirmedPaymentIntent.id);
        
        onPaymentComplete(confirmedPaymentIntent.id);
        setShipmentCreated(true);
        
        if (onFinalSubmit) {
          onFinalSubmit();
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Payment Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const createShipmentWithPayment = async (paymentIntentId: string) => {
    try {
      if (!shipmentId) {
        throw new Error('Shipment ID not found');
      }

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/v1/shipments/${shipmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          // Update the shipment with completion data
          vehicle_photos: completionData.vehiclePhotos,
          ownership_documents: completionData.ownershipDocuments,
          terms_accepted: completionData.termsAccepted,
          special_instructions: shipmentData.specialInstructions,
          
          // Payment information
          payment_intent_id: paymentIntentId,
          status: 'confirmed', // Change from pending to confirmed
          
          // Vehicle details
          vehicle_make: shipmentData.vehicleMake,
          vehicle_model: shipmentData.vehicleModel,
          vehicle_year: shipmentData.vehicleYear,
          is_operable: shipmentData.isOperable,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update shipment');
      }

      const result = await response.json();
      console.log('Shipment updated successfully:', result);
      
      return result.data;
    } catch (error) {
      console.error('Error updating shipment after payment:', error);
      throw error;
    }
  };

  const formatCurrency = (amount: number): string => {
    return `$${(amount / 100).toFixed(2)}`;
  };

  const getItemIcon = (type: string): string => {
    switch (type) {
      case 'base': return 'local-shipping';
      case 'insurance': return 'security';
      case 'fee': return 'credit-card';
      case 'tax': return 'account-balance';
      default: return 'attach-money';
    }
  };

  if (completionData.paymentCompleted) {
    return (
      <View style={styles.completedContainer}>
        <MaterialIcons name="check-circle" size={64} color="#4CAF50" />
        <Text style={styles.completedTitle}>Payment Successful!</Text>
        <Text style={styles.completedSubtitle}>
          Your payment of ${upfrontAmount.toFixed(2)} has been processed.
          Remaining ${deliveryAmount.toFixed(2)} due on delivery.
        </Text>
        <View style={styles.completedDetails}>
          <Text style={styles.completedText}>Γ£ô Payment confirmed</Text>
          <Text style={styles.completedText}>Γ£ô Invoice generated</Text>
          <Text style={styles.completedText}>Γ£ô Ready for shipment creation</Text>
        </View>
      </View>
    );
  }

  return (
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Invoice Header */}
        <View style={styles.invoiceHeader}>
          <Text style={styles.invoiceTitle}>Invoice</Text>
          <Text style={styles.invoiceNumber}>INV-{Date.now()}</Text>
        </View>

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
              {shipmentData.pickupAddress} ΓåÆ {shipmentData.deliveryAddress}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Distance:</Text>
            <Text style={styles.detailValue}>{shipmentData.distance} miles</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Customer:</Text>
            <Text style={styles.detailValue}>{shipmentData.customerName}</Text>
          </View>
        </View>

        {/* Payment Summary */}
        <View style={styles.paymentBreakdownSection}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Vehicle Transport Service</Text>
            <Text style={styles.totalAmount}>${totalAmount.toFixed(2)}</Text>
          </View>
          
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>Due Now (20%)</Text>
            <Text style={styles.breakdownAmount}>${upfrontAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>Due on Delivery (80%)</Text>
            <Text style={styles.breakdownAmount}>${deliveryAmount.toFixed(2)}</Text>
          </View>
          
          <Text style={styles.refundNotice}>
            * Upfront payment is refundable within 1 hour of booking
          </Text>
        </View>

        {/* Payment Method */}
        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
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
                console.log('Card details changed:', {
                  complete: cardDetails.complete,
                  validNumber: cardDetails.validNumber,
                  validCVC: cardDetails.validCVC,
                  validExpiryDate: cardDetails.validExpiryDate
                });
                setCardComplete(cardDetails.complete);
                setCardError(cardDetails.validNumber === 'Invalid' ? 'Invalid card number' : null);
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
            <Text style={styles.summaryLabel}>Amount to charge:</Text>
            <Text style={styles.summaryAmount}>${upfrontAmount.toFixed(2)}</Text>
          </View>
          <Text style={styles.summaryNote}>
            You will be charged immediately upon confirmation
          </Text>
        </View>

        {/* Debug Status - Remove in production */}
        {(!cardComplete || !paymentIntent) && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugText}>
              {!paymentIntent && '⚠️ Initializing payment...'}
              {paymentIntent && !cardComplete && '⚠️ Please enter complete card details'}
            </Text>
          </View>
        )}

        {/* Payment Button */}
        <TouchableOpacity
          style={[
            styles.payButton,
            (!cardComplete || isProcessing || !paymentIntent) && styles.payButtonDisabled
          ]}
          onPress={() => {
            console.log('Payment button state:', {
              cardComplete,
              isProcessing,
              hasPaymentIntent: !!paymentIntent,
              canPay: cardComplete && !isProcessing && !!paymentIntent
            });
            handlePayment();
          }}
          disabled={!cardComplete || isProcessing || !paymentIntent}
          activeOpacity={0.7}
        >
          {isProcessing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="small" color="white" />
              <Text style={styles.payButtonText}>Processing...</Text>
            </View>
          ) : (
            <>
              <MaterialIcons name="payment" size={20} color="white" />
              <Text style={styles.payButtonText}>
                Pay ${upfrontAmount.toFixed(2)} Now
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Terms Notice */}
        <Text style={styles.termsNotice}>
          By completing this payment, you agree to our Terms of Service and authorize this charge.
        </Text>
      </ScrollView>
    </StripeProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  completedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
    marginTop: 16,
    marginBottom: 8,
  },
  completedSubtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  completedDetails: {
    alignItems: 'flex-start',
  },
  completedText: {
    fontSize: 16,
    color: Colors.text.primary,
    marginBottom: 8,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  invoiceNumber: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontFamily: 'monospace',
  },
  shipmentDetails: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  invoiceItems: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemDescription: {
    fontSize: 14,
    color: Colors.text.primary,
    marginLeft: 8,
  },
  itemAmount: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 18,
    color: Colors.primary,
    fontWeight: '700',
  },
  paymentSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
  },
  cardField: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginLeft: 4,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 6,
  },
  securityText: {
    fontSize: 12,
    color: Colors.text.primary,
    marginLeft: 8,
    flex: 1,
  },
  paymentSummary: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  summaryAmount: {
    fontSize: 18,
    color: Colors.primary,
    fontWeight: '700',
  },
  summaryNote: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  payButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  payButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
  termsNotice: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
  },
  paymentBreakdownSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  breakdownAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  breakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 8,
    paddingTop: 12,
  },
  breakdownTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  breakdownTotalAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  refundNotice: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  debugContainer: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  debugText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
});

export default InvoicePaymentStep;
