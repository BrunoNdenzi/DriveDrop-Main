import React, { useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, Text } from 'react-native';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Colors, Spacing, Typography } from '../../constants/DesignSystem';
import {
  paymentService,
  PaymentMethodRequest,
} from '../../services/paymentService';

interface StripePaymentFormProps {
  amount: number;
  shipmentId: string;
  onPaymentSuccess: () => void;
  onPaymentError: (error: string) => void;
}

export function StripePaymentForm({
  amount,
  shipmentId,
  onPaymentSuccess,
  onPaymentError,
}: StripePaymentFormProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [cardholderName, setCardholderName] = useState<string>('');
  const [cardNumber, setCardNumber] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [cvv, setCvv] = useState<string>('');
  const [billingAddress, setBillingAddress] = useState({
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
  });

  // This is already the 20% amount from the parent component

  const handleBillingAddressChange = (field: string, value: string) => {
    setBillingAddress(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, '');
    const formatted = cleaned.replace(/(.{4})/g, '$1 ').trim();
    return formatted;
  };

  const formatExpiryDate = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
    }
    return cleaned;
  };

  const isFormValid = () => {
    return (
      cardholderName.trim().length > 0 &&
      cardNumber.replace(/\s/g, '').length === 16 &&
      expiryDate.length === 5 &&
      cvv.length >= 3 &&
      billingAddress.street.trim().length > 0 &&
      billingAddress.city.trim().length > 0 &&
      billingAddress.state.trim().length > 0 &&
      billingAddress.zipCode.trim().length > 0
    );
  };

  const handlePayment = async () => {
    if (!isFormValid()) {
      Alert.alert(
        'Validation Error',
        'Please fill in all required fields correctly.'
      );
      return;
    }

    try {
      setIsLoading(true);

      // Test API connectivity first
      const isConnected = await paymentService.testApiConnectivity();
      if (!isConnected) {
        throw new Error(
          'Cannot connect to payment server. Please check your internet connection and try again.'
        );
      }

      console.log('Creating payment intent for shipment:', shipmentId);

      // Create a payment intent
      const paymentIntentResponse = await paymentService.createPaymentIntent(
        shipmentId,
        amount,
        `DriveDrop shipment payment for shipment ${shipmentId}`
      );

      if (!paymentIntentResponse || !paymentIntentResponse.id) {
        console.error(
          'Invalid payment intent response:',
          paymentIntentResponse
        );
        throw new Error('Failed to create payment intent: Missing ID');
      }

      console.log(
        'Payment intent created successfully with ID:',
        paymentIntentResponse.id
      );

      // Parse expiry date (MM/YY)
      const [expMonth, expYear] = expiryDate.split('/');

      // Prepare payment method data
      const paymentMethodData: PaymentMethodRequest = {
        type: 'card',
        card: {
          number: cardNumber.replace(/\s/g, ''),
          exp_month: expMonth,
          exp_year: expYear,
          cvc: cvv,
        },
        billing_details: {
          name: cardholderName,
          address: {
            line1: billingAddress.street,
            city: billingAddress.city,
            state: billingAddress.state,
            postal_code: billingAddress.zipCode,
            country: billingAddress.country,
          },
        },
      };

      // Confirm payment
      console.log('Confirming payment with payment method');
      const result = await paymentService.confirmPaymentIntent(
        paymentIntentResponse.id,
        paymentMethodData
      );

      if (result.success) {
        console.log('Payment confirmed successfully');
        onPaymentSuccess();
      } else {
        console.error('Payment confirmation failed:', result.error);
        onPaymentError(result.error || 'Payment failed');
      }
    } catch (error) {
      console.error('Payment processing error (detailed):', error);

      // Determine a user-friendly error message based on the error
      let errorMessage =
        'An unexpected error occurred during payment processing';

      if (error instanceof Error) {
        // Extract the most meaningful part of the error message
        if (error.message.includes('User not authenticated')) {
          errorMessage = 'Your session has expired. Please log in again.';
        } else if (error.message.includes('card')) {
          errorMessage = error.message; // Card errors are usually user-friendly
        } else if (error.message.includes('Failed to create payment intent')) {
          errorMessage =
            'Could not process payment. Please check your payment details and try again.';
        } else if (error.message.includes('connect')) {
          errorMessage =
            'Connection to payment service failed. Please check your internet connection.';
        } else {
          // If we have a specific error message, use it
          errorMessage = error.message;
        }
      }

      onPaymentError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card variant="default" padding="lg" style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Payment Details</Text>
        <Text style={styles.secureText}>Secure</Text>
      </View>

      <Text style={styles.amount}>Amount: ${(amount / 100).toFixed(2)}</Text>

      <View style={styles.stripeContainer}>
        <Text style={styles.stripeText}>Powered by</Text>
        <Text style={styles.stripeBrand}>Stripe</Text>
      </View>

      <View style={styles.legalContainer}>
        <Text style={styles.legalText}>
          Your payment information is securely processed by Stripe. DriveDrop
          does not store your credit card information. By proceeding with
          payment, you agree to Stripe's Terms of Service.
        </Text>
      </View>

      <Input
        label="Cardholder Name"
        value={cardholderName}
        onChangeText={setCardholderName}
        placeholder="John Doe"
        autoCapitalize="words"
      />

      <Input
        label="Card Number"
        value={cardNumber}
        onChangeText={value => {
          const formatted = formatCardNumber(value);
          if (formatted.replace(/\s/g, '').length <= 16) {
            setCardNumber(formatted);
          }
        }}
        placeholder="1234 5678 9012 3456"
        keyboardType="numeric"
        maxLength={19}
      />

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Input
            label="Expiry Date"
            value={expiryDate}
            onChangeText={value => {
              const formatted = formatExpiryDate(value);
              if (formatted.length <= 5) {
                setExpiryDate(formatted);
              }
            }}
            placeholder="MM/YY"
            keyboardType="numeric"
            maxLength={5}
          />
        </View>
        <View style={styles.halfInput}>
          <Input
            label="CVV"
            value={cvv}
            onChangeText={setCvv}
            placeholder="123"
            keyboardType="numeric"
            maxLength={4}
            secureTextEntry
          />
        </View>
      </View>

      <Text style={styles.billingTitle}>Billing Address</Text>

      <Input
        label="Street Address"
        value={billingAddress.street}
        onChangeText={value => handleBillingAddressChange('street', value)}
        placeholder="123 Main St"
      />

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Input
            label="City"
            value={billingAddress.city}
            onChangeText={value => handleBillingAddressChange('city', value)}
            placeholder="New York"
          />
        </View>
        <View style={styles.halfInput}>
          <Input
            label="State"
            value={billingAddress.state}
            onChangeText={value => handleBillingAddressChange('state', value)}
            placeholder="NY"
          />
        </View>
      </View>

      <Input
        label="Zip Code"
        value={billingAddress.zipCode}
        onChangeText={value => handleBillingAddressChange('zipCode', value)}
        placeholder="10001"
        keyboardType="numeric"
      />

      <Button
        title={isLoading ? 'Processing...' : 'Pay Now'}
        onPress={handlePayment}
        disabled={isLoading || !isFormValid()}
        style={styles.payButton}
      />

      {isLoading && (
        <ActivityIndicator
          size="large"
          color={Colors.primary}
          style={styles.loader}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing[8],
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[2],
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.medium,
  },
  secureText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.success,
    fontWeight: Typography.fontWeight.medium,
  },
  amount: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing[4],
  },
  stripeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing[4],
  },
  stripeText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginRight: 4,
  },
  stripeBrand: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: '#6772E5', // Stripe's brand color
  },
  legalContainer: {
    backgroundColor: Colors.background,
    padding: Spacing[3],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing[6],
  },
  legalText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.secondary,
    lineHeight: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing[2],
  },
  halfInput: {
    width: '48%',
  },
  billingTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
    marginTop: Spacing[4],
    marginBottom: Spacing[2],
  },
  payButton: {
    marginTop: Spacing[8],
  },
  loader: {
    marginTop: Spacing[4],
  },
});
