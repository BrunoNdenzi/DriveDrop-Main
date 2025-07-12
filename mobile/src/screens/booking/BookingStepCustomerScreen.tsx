import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { Colors, Typography, Spacing } from '../../constants/DesignSystem';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { RootStackParamList } from '../../navigation/types';
import { useBooking } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';

type BookingStepCustomerProps = NativeStackScreenProps<RootStackParamList, 'BookingStepCustomer'>;

export default function BookingStepCustomerScreen({ navigation }: BookingStepCustomerProps) {
  const { state, updateFormData, setStepValidity, goToNextStep } = useBooking();
  const { userProfile } = useAuth();
  const { customerDetails } = state.formData;

  // Pre-populate with user profile data
  useEffect(() => {
    if (userProfile && (!customerDetails.fullName && !customerDetails.email)) {
      updateFormData('customer', {
        fullName: `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim(),
        email: userProfile.email || '',
        phone: userProfile.phone || '',
        address: customerDetails.address || '', // Keep existing address if any
      });
    }
  }, [userProfile, updateFormData]);

  // Validate form data
  useEffect(() => {
    const isValid = !!(
      customerDetails.fullName &&
      customerDetails.email &&
      customerDetails.phone &&
      customerDetails.address &&
      customerDetails.fullName.trim().length > 0 &&
      customerDetails.email.includes('@') &&
      customerDetails.phone.trim().length >= 10 &&
      customerDetails.address.trim().length > 0
    );
    setStepValidity('customer', isValid);
  }, [customerDetails, setStepValidity]);

  const handleInputChange = (field: string, value: string) => {
    const updatedData = { 
      ...customerDetails,
      [field]: value 
    };
    updateFormData('customer', updatedData);
  };

  const handleNext = () => {
    if (state.isValid.customer) {
      goToNextStep();
      navigation.navigate('BookingStepVehicle');
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Customer Details</Text>
        <Text style={styles.subtitle}>Step 1 of 8</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '12.5%' }]} />
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
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <Text style={styles.sectionSubtitle}>
              Please provide your contact details for this shipment
            </Text>

            <Input
              label="Full Name"
              placeholder="Enter your full name"
              value={customerDetails.fullName}
              onChangeText={(value) => handleInputChange('fullName', value)}
              leftIcon="person"
              required
            />

            <Input
              label="Email Address"
              placeholder="Enter your email"
              value={customerDetails.email}
              onChangeText={(value) => handleInputChange('email', value)}
              leftIcon="email"
              keyboardType="email-address"
              autoCapitalize="none"
              required
            />

            <Input
              label="Phone Number"
              placeholder="Enter your phone number"
              value={customerDetails.phone}
              onChangeText={(value) => handleInputChange('phone', value)}
              leftIcon="phone"
              keyboardType="phone-pad"
              required
            />

            <Input
              label="Address"
              placeholder="Enter your full address"
              value={customerDetails.address}
              onChangeText={(value) => handleInputChange('address', value)}
              leftIcon="location-on"
              multiline
              numberOfLines={3}
              required
              helper="This will be used for billing and communication purposes"
            />
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
          title="Next"
          variant="primary"
          onPress={handleNext}
          disabled={!state.isValid.customer}
          style={styles.nextButton}
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
  nextButton: {
    flex: 2,
  },
  bottomSpacing: {
    height: Spacing[6],
  },
});
