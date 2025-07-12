import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing } from '../../constants/DesignSystem';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { RootStackParamList } from '../../navigation/types';
import { useBooking } from '../../context/BookingContext';

type BookingStepPaymentProps = NativeStackScreenProps<RootStackParamList, 'BookingStepPayment'>;

export default function BookingStepPaymentScreen({ navigation }: BookingStepPaymentProps) {
  const { state, updateFormData, setStepValidity } = useBooking();
  const { paymentDetails } = state.formData;
  const [selectedQuote, setSelectedQuote] = useState<'standard' | 'express' | 'premium'>('standard');

  // Mock quote data - in real app this would come from API
  const quotes = {
    standard: { price: 1250, days: '7-10', title: 'Standard Shipping' },
    express: { price: 1650, days: '3-5', title: 'Express Shipping' },
    premium: { price: 2100, days: '1-2', title: 'Premium Shipping' }
  };

  // Validate form data
  useEffect(() => {
    const isValid = !!(
      paymentDetails.paymentMethod &&
      paymentDetails.cardNumber &&
      paymentDetails.expiryDate &&
      paymentDetails.cvv &&
      paymentDetails.cardholderName &&
      paymentDetails.billingAddress?.street &&
      paymentDetails.billingAddress?.city &&
      paymentDetails.billingAddress?.state &&
      paymentDetails.billingAddress?.zipCode
    );
    setStepValidity('payment', isValid);
  }, [paymentDetails, setStepValidity]);

  const handlePaymentMethodChange = (method: 'credit_card' | 'debit_card' | 'bank_transfer') => {
    const updatedData = {
      ...paymentDetails,
      paymentMethod: method,
    };
    updateFormData('payment', updatedData);
  };

  const handleCardDetailsChange = (field: string, value: string) => {
    const updatedData = {
      ...paymentDetails,
      [field]: value,
    };
    updateFormData('payment', updatedData);
  };

  const handleBillingAddressChange = (field: string, value: string) => {
    const updatedData = {
      ...paymentDetails,
      billingAddress: {
        ...paymentDetails.billingAddress,
        [field]: value,
      },
    };
    updateFormData('payment', updatedData);
  };

  const handleQuoteSelection = (quote: 'standard' | 'express' | 'premium') => {
    setSelectedQuote(quote);
  };

  const handleSubmit = () => {
    if (state.isValid.payment) {
      Alert.alert(
        'Confirm Payment',
        `You are about to pay $${quotes[selectedQuote].price} for ${quotes[selectedQuote].title}. This will submit your shipment request.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Pay Now', 
            onPress: () => {
              // Here would be the actual payment processing logic
              Alert.alert(
                'Payment Successful!',
                'Your shipment request has been submitted. You will receive a confirmation email shortly.',
                [
                  {
                    text: 'View Confirmation',
                    onPress: () => navigation.navigate('BookingConfirmation')
                  }
                ]
              );
            }
          },
        ]
      );
    }
  };

  const handleBack = () => {
    navigation.goBack();
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

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Payment & Booking Summary</Text>
        <Text style={styles.subtitle}>Step 9 of 9</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '100%' }]} />
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={styles.scrollContent}>
          {/* Booking Summary */}
          <Card variant="default" padding="lg" style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Booking Summary</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Vehicle:</Text>
              <Text style={styles.summaryValue}>
                {state.formData.vehicleInformation.year} {state.formData.vehicleInformation.make} {state.formData.vehicleInformation.model}
              </Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>From:</Text>
              <Text style={styles.summaryValue}>
                {state.formData.pickupDetails.address || 'Not specified'}
              </Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>To:</Text>
              <Text style={styles.summaryValue}>
                {state.formData.deliveryDetails.address || 'Not specified'}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Service Type:</Text>
              <Text style={styles.summaryValue}>
                Standard Transport
              </Text>
            </View>
          </Card>

          {/* Quote Selection */}
          <Card variant="default" padding="lg" style={styles.quoteCard}>
            <Text style={styles.sectionTitle}>Select Your Quote</Text>
            <Text style={styles.sectionSubtitle}>Choose your preferred shipping option</Text>

            {Object.entries(quotes).map(([key, quote]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.quoteOption,
                  selectedQuote === key && styles.selectedQuoteOption
                ]}
                onPress={() => handleQuoteSelection(key as 'standard' | 'express' | 'premium')}
              >
                <View style={styles.quoteHeader}>
                  <View style={styles.quoteInfo}>
                    <Text style={[
                      styles.quoteTitle,
                      selectedQuote === key && styles.selectedQuoteText
                    ]}>
                      {quote.title}
                    </Text>
                    <Text style={[
                      styles.quoteDays,
                      selectedQuote === key && styles.selectedQuoteText
                    ]}>
                      {quote.days} business days
                    </Text>
                  </View>
                  <Text style={[
                    styles.quotePrice,
                    selectedQuote === key && styles.selectedQuoteText
                  ]}>
                    ${quote.price}
                  </Text>
                </View>
                {selectedQuote === key && (
                  <Ionicons 
                    name="checkmark-circle" 
                    size={24} 
                    color={Colors.primary} 
                    style={styles.quoteCheckmark}
                  />
                )}
              </TouchableOpacity>
            ))}
          </Card>

          {/* Payment Method */}
          <Card variant="default" padding="lg" style={styles.paymentCard}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            
            <View style={styles.paymentMethods}>
              {[
                { key: 'credit_card', label: 'Credit Card', icon: 'credit-card' },
                { key: 'debit_card', label: 'Debit Card', icon: 'credit-card' },
                { key: 'bank_transfer', label: 'Bank Transfer', icon: 'payment' }
              ].map((method) => (
                <TouchableOpacity
                  key={method.key}
                  style={[
                    styles.paymentMethodOption,
                    paymentDetails.paymentMethod === method.key && styles.selectedPaymentMethod
                  ]}
                  onPress={() => handlePaymentMethodChange(method.key as 'credit_card' | 'debit_card' | 'bank_transfer')}
                >
                  <MaterialIcons 
                    name={method.icon as any} 
                    size={24} 
                    color={paymentDetails.paymentMethod === method.key ? Colors.primary : Colors.text.secondary}
                  />
                  <Text style={[
                    styles.paymentMethodText,
                    paymentDetails.paymentMethod === method.key && styles.selectedPaymentMethodText
                  ]}>
                    {method.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {paymentDetails.paymentMethod && paymentDetails.paymentMethod !== 'bank_transfer' && (
              <View style={styles.cardForm}>
                <Input
                  label="Cardholder Name"
                  value={paymentDetails.cardholderName || ''}
                  onChangeText={(value) => handleCardDetailsChange('cardholderName', value)}
                  placeholder="John Doe"
                  autoCapitalize="words"
                />

                <Input
                  label="Card Number"
                  value={paymentDetails.cardNumber || ''}
                  onChangeText={(value) => {
                    const formatted = formatCardNumber(value);
                    if (formatted.replace(/\s/g, '').length <= 16) {
                      handleCardDetailsChange('cardNumber', formatted);
                    }
                  }}
                  placeholder="1234 5678 9012 3456"
                  keyboardType="numeric"
                  maxLength={19}
                />

                <View style={styles.cardRow}>
                  <View style={styles.cardRowItem}>
                    <Input
                      label="Expiry Date"
                      value={paymentDetails.expiryDate || ''}
                      onChangeText={(value) => {
                        const formatted = formatExpiryDate(value);
                        if (formatted.length <= 5) {
                          handleCardDetailsChange('expiryDate', formatted);
                        }
                      }}
                      placeholder="MM/YY"
                      keyboardType="numeric"
                      maxLength={5}
                    />
                  </View>
                  <View style={styles.cardRowItem}>
                    <Input
                      label="CVV"
                      value={paymentDetails.cvv || ''}
                      onChangeText={(value) => {
                        if (value.length <= 4 && /^\d*$/.test(value)) {
                          handleCardDetailsChange('cvv', value);
                        }
                      }}
                      placeholder="123"
                      keyboardType="numeric"
                      maxLength={4}
                      secureTextEntry
                    />
                  </View>
                </View>
              </View>
            )}
          </Card>

          {/* Billing Address */}
          {paymentDetails.paymentMethod && paymentDetails.paymentMethod !== 'bank_transfer' && (
            <Card variant="default" padding="lg" style={styles.billingCard}>
              <Text style={styles.sectionTitle}>Billing Address</Text>
              
              <Input
                label="Street Address"
                value={paymentDetails.billingAddress?.street || ''}
                onChangeText={(value) => handleBillingAddressChange('street', value)}
                placeholder="123 Main Street"
              />

              <View style={styles.addressRow}>
                <View style={styles.addressRowItem}>
                  <Input
                    label="City"
                    value={paymentDetails.billingAddress?.city || ''}
                    onChangeText={(value) => handleBillingAddressChange('city', value)}
                    placeholder="Los Angeles"
                  />
                </View>
                <View style={styles.addressRowItemSmall}>
                  <Input
                    label="State"
                    value={paymentDetails.billingAddress?.state || ''}
                    onChangeText={(value) => handleBillingAddressChange('state', value)}
                    placeholder="CA"
                    autoCapitalize="characters"
                    maxLength={2}
                  />
                </View>
              </View>

              <Input
                label="ZIP Code"
                value={paymentDetails.billingAddress?.zipCode || ''}
                onChangeText={(value) => {
                  if (/^\d*$/.test(value) && value.length <= 5) {
                    handleBillingAddressChange('zipCode', value);
                  }
                }}
                placeholder="90210"
                keyboardType="numeric"
                maxLength={5}
              />
            </Card>
          )}

          {/* Order Total */}
          <Card variant="outlined" padding="lg" style={styles.totalCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount:</Text>
              <Text style={styles.totalAmount}>${quotes[selectedQuote].price}</Text>
            </View>
            <Text style={styles.totalNote}>
              Payment will be processed securely. You will receive a confirmation email after successful payment.
            </Text>
          </Card>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNavigation}>
        <Button
          variant="outline"
          onPress={handleBack}
          style={styles.backButton}
          title="Back"
        />
        <Button
          variant="primary"
          onPress={handleSubmit}
          disabled={!state.isValid.payment}
          style={styles.submitButton}
          title={`Pay $${quotes[selectedQuote].price}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.surface,
    paddingTop: 60,
    paddingHorizontal: Spacing[6],
    paddingBottom: Spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing[1],
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
    marginBottom: Spacing[4],
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing[6],
  },
  summaryCard: {
    marginBottom: Spacing[6],
  },
  quoteCard: {
    marginBottom: Spacing[6],
  },
  paymentCard: {
    marginBottom: Spacing[6],
  },
  billingCard: {
    marginBottom: Spacing[6],
  },
  totalCard: {
    marginBottom: Spacing[8],
    borderColor: Colors.primary,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing[1],
  },
  sectionSubtitle: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
    marginBottom: Spacing[6],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryLabel: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
    flex: 1,
  },
  summaryValue: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    flex: 2,
    textAlign: 'right',
  },
  quoteOption: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing[6],
    marginBottom: Spacing[4],
    position: 'relative',
  },
  selectedQuoteOption: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  quoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteInfo: {
    flex: 1,
  },
  quoteTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing[1],
  },
  quoteDays: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
  },
  quotePrice: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  selectedQuoteText: {
    color: Colors.primary,
  },
  quoteCheckmark: {
    position: 'absolute',
    top: Spacing[3],
    right: Spacing[3],
  },
  paymentMethods: {
    flexDirection: 'row',
    marginBottom: Spacing[6],
  },
  paymentMethodOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    marginRight: Spacing[3],
  },
  selectedPaymentMethod: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  paymentMethodText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.secondary,
    marginLeft: Spacing[3],
  },
  selectedPaymentMethodText: {
    color: Colors.primary,
  },
  cardForm: {
    marginTop: Spacing[6],
  },
  cardRow: {
    flexDirection: 'row',
    gap: Spacing[4],
  },
  cardRowItem: {
    flex: 1,
  },
  addressRow: {
    flexDirection: 'row',
    gap: Spacing[4],
  },
  addressRowItem: {
    flex: 2,
  },
  addressRowItemSmall: {
    flex: 1,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[3],
  },
  totalLabel: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
  },
  totalAmount: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  totalNote: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  bottomNavigation: {
    flexDirection: 'row',
    padding: Spacing[6],
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing[4],
  },
  backButton: {
    flex: 1,
  },
  submitButton: {
    flex: 2,
  },
});
