import React, { useEffect } from 'react';
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
import { PaymentPolicyCard } from '../../components/payment/PaymentPolicyCard';
import { RootStackParamList } from '../../navigation/types';
import { useBooking } from '../../context/BookingContext';

type BookingStepPaymentProps = NativeStackScreenProps<RootStackParamList, 'BookingStepPayment'>;

export default function BookingStepPaymentScreen({ navigation }: BookingStepPaymentProps) {
  const { state, setStepValidity } = useBooking();

  // Use quote price stored in customerDetails.estimatedCost (fallback 0)
  const quotePrice = state.formData.customerDetails?.estimatedCost || 0;
  const quoteMeta = { service: 'Standard Transport', days: '7-10' };

  // Debug log to help troubleshoot quote data flow
  useEffect(() => {
    console.log('BookingStepPaymentScreen - Quote data check:', {
      quotePrice,
      hasCustomerDetails: !!state.formData.customerDetails,
      estimatedCost: state.formData.customerDetails?.estimatedCost,
      customerDetails: state.formData.customerDetails
    });
  }, [quotePrice, state.formData.customerDetails]);

  // Validate form data - only check if quote is selected
  useEffect(() => {
    setStepValidity('payment', quotePrice > 0);
  }, [quotePrice, setStepValidity]);

  const handleSubmit = () => {
    if (!quotePrice) {
      Alert.alert('Quote Missing', 'No quote found. Please go back and generate a quote.');
      return;
    }
    const cents = quotePrice * 100;
    Alert.alert(
      'Confirm Booking',
      `You will be charged an initial payment based on quote $${quotePrice.toFixed(2)}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Continue to Payment', 
          onPress: () => navigation.navigate('BookingPaymentProcessing', {
            amount: cents,
            quote: { service: quoteMeta.service, price: quotePrice, days: quoteMeta.days }
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

          {/* Quote Display */}
          <Card variant="default" padding="lg" style={styles.quoteCard}>
            <Text style={styles.sectionTitle}>Shipment Quote</Text>
            <Text style={styles.sectionSubtitle}>Derived from your initial estimate</Text>
            
            {quotePrice > 0 ? (
              <View style={styles.quoteHeader}>
                <View style={styles.quoteInfo}>
                  <Text style={styles.quoteTitle}>{quoteMeta.service}</Text>
                  <Text style={styles.quoteDays}>{quoteMeta.days} business days</Text>
                </View>
                <Text style={styles.quotePrice}>${quotePrice.toFixed(2)}</Text>
              </View>
            ) : (
              <View style={styles.noQuoteContainer}>
                <MaterialIcons name="warning" size={24} color={Colors.warning} />
                <Text style={styles.noQuoteText}>No quote was generated yet</Text>
                <Text style={styles.noQuoteSubtext}>
                  Please go back to the quote screen to generate an estimate
                </Text>
                <TouchableOpacity 
                  style={styles.generateQuoteButton}
                  onPress={() => navigation.navigate('CreateShipment')}
                >
                  <Text style={styles.generateQuoteButtonText}>Generate Quote</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>

          {/* Payment Policy Card - Only show if quote exists */}
          {quotePrice > 0 && (
            <PaymentPolicyCard
              totalAmount={quotePrice * 100}
              paymentType="initial"
              isRefundable={true}
              refundDeadline={new Date(Date.now() + 60 * 60 * 1000).toISOString()}
            />
          )}

          {/* Order Total - Only show if quote exists */}
          {quotePrice > 0 && (
            <Card variant="outlined" padding="lg" style={styles.totalCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Initial Payment (20%):</Text>
                <Text style={styles.totalAmount}>${(quotePrice * 0.2).toFixed(2)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Shipment Value:</Text>
                <Text style={styles.totalValue}>${quotePrice.toFixed(2)}</Text>
              </View>
              <Text style={styles.totalNote}>
                After confirming, you will be redirected to our secure payment processor to complete your booking.
              </Text>
            </Card>
          )}
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
        {quotePrice > 0 ? (
          <Button
            variant="primary"
            onPress={handleSubmit}
            style={styles.submitButton}
            title={`Continue to Payment ($${quotePrice.toFixed(2)})`}
          />
        ) : (
          <Button
            variant="outline"
            onPress={() => navigation.navigate('CreateShipment')}
            style={styles.submitButton}
            title="Generate Quote First"
          />
        )}
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
  noQuoteContainer: {
    alignItems: 'center',
    paddingVertical: Spacing[6],
    paddingHorizontal: Spacing[4],
  },
  noQuoteText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginTop: Spacing[2],
    textAlign: 'center',
  },
  noQuoteSubtext: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginTop: Spacing[1],
    textAlign: 'center',
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.sm,
  },
  generateQuoteButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
    borderRadius: 8,
    marginTop: Spacing[4],
  },
  generateQuoteButtonText: {
    color: Colors.surface,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    textAlign: 'center',
  },
});
