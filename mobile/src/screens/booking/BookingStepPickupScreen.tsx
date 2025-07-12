import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { Colors, Typography, Spacing } from '../../constants/DesignSystem';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { RootStackParamList } from '../../navigation/types';
import { useBooking } from '../../context/BookingContext';

type BookingStepPickupProps = NativeStackScreenProps<RootStackParamList, 'BookingStepPickup'>;

export default function BookingStepPickupScreen({ navigation }: BookingStepPickupProps) {
  const { state, updateFormData, setStepValidity, goToNextStep } = useBooking();
  const { pickupDetails } = state.formData;

  // Validate form data
  useEffect(() => {
    const isValid = !!(
      pickupDetails.address &&
      pickupDetails.date &&
      pickupDetails.contactPerson &&
      pickupDetails.contactPhone
    );
    setStepValidity('pickup', isValid);
  }, [pickupDetails, setStepValidity]);

  const handleInputChange = (field: string, value: string) => {
    const updatedData = { 
      ...pickupDetails,
      [field]: value 
    };
    updateFormData('pickup', updatedData);
  };

  const handleNext = () => {
    if (state.isValid.pickup) {
      goToNextStep();
      navigation.navigate('BookingStepDelivery');
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
        <Text style={styles.title}>Pickup Details</Text>
        <Text style={styles.subtitle}>Step 3 of 8</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '37.5%' }]} />
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
            <Text style={styles.sectionTitle}>Pickup Information</Text>
            <Text style={styles.sectionSubtitle}>
              Where and when should we pick up your vehicle?
            </Text>

            <Input
              label="Pickup Address"
              placeholder="Enter full pickup address"
              value={pickupDetails.address || ''}
              onChangeText={(value) => handleInputChange('address', value)}
              leftIcon="location-on"
              multiline
              numberOfLines={2}
              required
            />

            <Input
              label="Pickup Date"
              placeholder="Select pickup date"
              value={pickupDetails.date || ''}
              onChangeText={(value) => handleInputChange('date', value)}
              leftIcon="calendar-today"
              required
              helper="Preferred pickup date (flexible dates may reduce cost)"
            />

            <Input
              label="Pickup Time"
              placeholder="Preferred time window"
              value={pickupDetails.time || ''}
              onChangeText={(value) => handleInputChange('time', value)}
              leftIcon="access-time"
              helper="e.g., Morning (8AM-12PM), Afternoon (12PM-5PM)"
            />

            <Input
              label="Contact Person"
              placeholder="Name of person at pickup location"
              value={pickupDetails.contactPerson || ''}
              onChangeText={(value) => handleInputChange('contactPerson', value)}
              leftIcon="person"
              required
            />

            <Input
              label="Contact Phone"
              placeholder="Phone number for pickup coordination"
              value={pickupDetails.contactPhone || ''}
              onChangeText={(value) => handleInputChange('contactPhone', value)}
              leftIcon="phone"
              keyboardType="phone-pad"
              required
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
          disabled={!state.isValid.pickup}
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
