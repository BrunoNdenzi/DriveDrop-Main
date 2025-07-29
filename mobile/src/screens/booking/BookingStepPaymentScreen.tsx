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

// Import the entire design system and use it from there
import DesignSystem from '../../constants/DesignSystem';
const { Colors, Typography, Spacing } = DesignSystem;

import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PaymentPolicyCard } from '../../components/payment/PaymentPolicyCard';
import { RootStackParamList } from '../../navigation/types';
import { useBooking } from '../../context/BookingContext';

type BookingStepPaymentProps = NativeStackScreenProps<RootStackParamList, 'BookingStepPayment'>;

export default function BookingStepPaymentScreen({ navigation }: BookingStepPaymentProps) {
  const { state, updateFormData, setStepValidity } = useBooking();
  const [selectedQuote, setSelectedQuote] = useState<'standard' | 'express' | 'premium'>('standard');

  // Mock quote data - in real app this would come from API
  const quotes = {
    standard: { price: 1250, days: '7-10', title: 'Standard Shipping' },
    express: { price: 1650, days: '3-5', title: 'Express Shipping' },
    premium: { price: 2100, days: '1-2', title: 'Premium Shipping' }
  };

  // Validate form data - only check if quote is selected
  useEffect(() => {
    // Only require quote selection since we're using Stripe for payment
    const isValid = true;
    setStepValidity('payment', isValid);
  }, [selectedQuote, setStepValidity]);

  const handleQuoteSelection = (quote: 'standard' | 'express' | 'premium') => {
    setSelectedQuote(quote);
  };

  const handleSubmit = () => {
    const quotePrice = quotes[selectedQuote].price * 100; // Convert to cents for Stripe
    
    Alert.alert(
      'Confirm Booking',
      `You selected ${quotes[selectedQuote].title} for $${quotes[selectedQuote].price}. Continue to payment?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Continue to Payment', 
          onPress: () => navigation.navigate('BookingPaymentProcessing', {
            amount: quotePrice,
            quote: {
              service: quotes[selectedQuote].title,
              price: quotes[selectedQuote].price,
              days: quotes[selectedQuote].days
            }
          })
        },
      ]
    );
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Booking Summary</Text>
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

          {/* Payment Policy Card */}
          <PaymentPolicyCard
            totalAmount={quotes[selectedQuote].price * 100}
            paymentType="initial"
            isRefundable={true}
            refundDeadline={new Date(Date.now() + 60 * 60 * 1000).toISOString()}
          />

          {/* Order Total */}
          <Card variant="outlined" padding="lg" style={styles.totalCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Initial Payment (20%):</Text>
              <Text style={styles.totalAmount}>${(quotes[selectedQuote].price * 0.2).toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Shipment Value:</Text>
              <Text style={styles.totalValue}>${quotes[selectedQuote].price.toFixed(2)}</Text>
            </View>
            <Text style={styles.totalNote}>
              After confirming, you will be redirected to our secure payment processor to complete your booking.
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
          style={styles.submitButton}
          title={`Continue to Payment ($${quotes[selectedQuote].price})`}
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
    fontWeight: '500', // Use literal value instead of Typography.fontWeight.medium
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
  totalValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
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
