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
import { MaterialIcons } from '@expo/vector-icons';

import { Colors, Typography, Spacing } from '../../constants/DesignSystem';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { RootStackParamList } from '../../navigation/types';
import { useBooking } from '../../context/BookingContext';

type BookingStepTermsProps = NativeStackScreenProps<RootStackParamList, 'BookingStepTerms'>;

export default function BookingStepTermsScreen({ navigation }: BookingStepTermsProps) {
  const { state, updateFormData, setStepValidity, goToNextStep } = useBooking();
  const { termsAuthorization } = state.formData;

  // Validate form data
  useEffect(() => {
    const isValid = !!(
      termsAuthorization.serviceAgreementAccepted &&
      termsAuthorization.cancellationPolicyAccepted &&
      termsAuthorization.digitalSignature &&
      termsAuthorization.digitalSignature.trim().length > 0
    );
    setStepValidity('terms', isValid);
  }, [termsAuthorization, setStepValidity]);

  const handleCheckboxToggle = (field: string, currentValue: boolean) => {
    const updatedData = {
      ...termsAuthorization,
      [field]: !currentValue,
    };
    updateFormData('terms', updatedData);
  };

  const handleSignatureChange = (value: string) => {
    const updatedData = {
      ...termsAuthorization,
      digitalSignature: value,
      signatureDate: new Date().toISOString(),
    };
    updateFormData('terms', updatedData);
  };

  const handleSubmit = () => {
    if (state.isValid.terms) {
      // Navigate to payment step
      goToNextStep();
      navigation.navigate('BookingStepPayment');
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const viewDocument = (documentType: 'service' | 'cancellation') => {
    const title = documentType === 'service' ? 'Service Agreement' : 'Cancellation Policy';
    Alert.alert(
      title,
      `This would show the full ${title.toLowerCase()} document. In a real app, this would open a detailed view or PDF.`,
      [{ text: 'Close' }]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Terms & Authorization</Text>
        <Text style={styles.subtitle}>Step 8 of 9</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '88.9%' }]} />
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={styles.scrollContent}>
          <Card variant="default" padding="lg" style={styles.formCard}>
            <Text style={styles.sectionTitle}>Service Agreement</Text>
            <Text style={styles.sectionSubtitle}>
              Please review and accept our terms of service
            </Text>

            <View style={styles.documentSection}>
              <View style={styles.documentPreview}>
                <Text style={styles.documentTitle}>DriveDrop Vehicle Shipping Service Agreement</Text>
                <Text style={styles.documentExcerpt}>
                  This agreement governs the vehicle shipping services provided by DriveDrop. Key points include:
                  {'\n\n'}• Professional handling and transport of your vehicle
                  {'\n'}• Insurance coverage during transport
                  {'\n'}• Delivery timeline estimates
                  {'\n'}• Payment terms and conditions
                  {'\n'}• Liability and damage policies
                  {'\n\n'}Please read the full agreement before accepting.
                </Text>
                <TouchableOpacity 
                  style={styles.viewDocumentButton}
                  onPress={() => viewDocument('service')}
                >
                  <Text style={styles.viewDocumentText}>View Full Agreement</Text>
                  <MaterialIcons name="open-in-new" size={16} color={Colors.primary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => handleCheckboxToggle('serviceAgreementAccepted', termsAuthorization.serviceAgreementAccepted || false)}
              >
                <View style={[
                  styles.checkbox,
                  termsAuthorization.serviceAgreementAccepted && styles.checkboxChecked
                ]}>
                  {termsAuthorization.serviceAgreementAccepted && (
                    <MaterialIcons name="check" size={16} color={Colors.surface} />
                  )}
                </View>
                <Text style={styles.checkboxText}>
                  I have read and agree to the Service Agreement
                  <Text style={styles.required}> *</Text>
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.documentSection}>
              <View style={styles.documentPreview}>
                <Text style={styles.documentTitle}>Cancellation Policy</Text>
                <Text style={styles.documentExcerpt}>
                  Our cancellation policy outlines:
                  {'\n\n'}• Free cancellation up to 24 hours before pickup
                  {'\n'}• Partial refund for cancellations within 24 hours
                  {'\n'}• Emergency cancellation procedures
                  {'\n'}• Rescheduling options and fees
                </Text>
                <TouchableOpacity 
                  style={styles.viewDocumentButton}
                  onPress={() => viewDocument('cancellation')}
                >
                  <Text style={styles.viewDocumentText}>View Full Policy</Text>
                  <MaterialIcons name="open-in-new" size={16} color={Colors.primary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => handleCheckboxToggle('cancellationPolicyAccepted', termsAuthorization.cancellationPolicyAccepted || false)}
              >
                <View style={[
                  styles.checkbox,
                  termsAuthorization.cancellationPolicyAccepted && styles.checkboxChecked
                ]}>
                  {termsAuthorization.cancellationPolicyAccepted && (
                    <MaterialIcons name="check" size={16} color={Colors.surface} />
                  )}
                </View>
                <Text style={styles.checkboxText}>
                  I understand and accept the Cancellation Policy
                  <Text style={styles.required}> *</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </Card>

          <Card variant="default" padding="lg" style={styles.formCard}>
            <Text style={styles.sectionTitle}>Digital Signature</Text>
            <Text style={styles.sectionSubtitle}>
              Please provide your digital signature to authorize this shipment request
            </Text>

            <Input
              label="Full Legal Name"
              placeholder="Type your full legal name as signature"
              value={termsAuthorization.digitalSignature || ''}
              onChangeText={handleSignatureChange}
              leftIcon="edit"
              required
              helper="This serves as your digital signature and legal authorization"
            />

            {termsAuthorization.signatureDate && (
              <View style={styles.signatureInfo}>
                <MaterialIcons name="schedule" size={16} color={Colors.text.secondary} />
                <Text style={styles.signatureDate}>
                  Signed on {new Date(termsAuthorization.signatureDate).toLocaleDateString()}
                </Text>
              </View>
            )}
          </Card>

          <Card variant="default" padding="lg" style={styles.formCard}>
            <View style={styles.summarySection}>
              <MaterialIcons name="info" size={24} color={Colors.primary} />
              <View style={styles.summaryContent}>
                <Text style={styles.summaryTitle}>Next Steps</Text>
                <Text style={styles.summaryText}>
                  After submitting your request:
                  {'\n\n'}1. You'll receive an email confirmation
                  {'\n'}2. Our team will review your submission
                  {'\n'}3. You'll get a detailed quote within 24 hours
                  {'\n'}4. Schedule pickup once quote is accepted
                  {'\n'}5. Track your shipment in real-time
                </Text>
              </View>
            </View>
          </Card>

          <View style={styles.bottomSpacing} />
        </View>
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.navigationContainer}>
        <Button
          title="Back"
          variant="outline"
          onPress={handleBack}
          style={styles.backButton}
        />
        <Button
          title="Continue to Payment"
          variant="primary"
          onPress={handleSubmit}
          disabled={!state.isValid.terms}
          style={styles.submitButton}
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
    paddingBottom: Spacing[6],
    paddingHorizontal: Spacing[6],
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing[1],
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing[4],
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.neutral.gray[200],
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
    flex: 1,
    paddingHorizontal: Spacing[6],
  },
  formCard: {
    marginTop: Spacing[6],
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing[2],
  },
  sectionSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing[6],
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.sm,
  },
  documentSection: {
    marginBottom: Spacing[6],
  },
  documentPreview: {
    backgroundColor: Colors.neutral.gray[50],
    padding: Spacing[4],
    borderRadius: 8,
    marginBottom: Spacing[4],
  },
  documentTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing[3],
  },
  documentExcerpt: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.sm,
    marginBottom: Spacing[3],
  },
  viewDocumentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  viewDocumentText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    marginRight: Spacing[1],
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[3],
    marginTop: 2,
  },
  checkboxChecked: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  checkboxText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Colors.text.primary,
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.sm,
  },
  required: {
    color: Colors.error,
  },
  signatureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing[2],
  },
  signatureDate: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.secondary,
    marginLeft: Spacing[1],
  },
  summarySection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  summaryContent: {
    flex: 1,
    marginLeft: Spacing[3],
  },
  summaryTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    marginBottom: Spacing[2],
  },
  summaryText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.sm,
  },
  navigationContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[4],
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  backButton: {
    flex: 1,
    marginRight: Spacing[3],
  },
  submitButton: {
    flex: 2,
  },
  bottomSpacing: {
    height: Spacing[6],
  },
});
