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

type BookingStepVehicleProps = NativeStackScreenProps<RootStackParamList, 'BookingStepVehicle'>;

export default function BookingStepVehicleScreen({ navigation }: BookingStepVehicleProps) {
  const { state, updateFormData, setStepValidity, goToNextStep } = useBooking();
  const { vehicleInformation } = state.formData;

  // Validate form data
  useEffect(() => {
    const isValid = !!(
      vehicleInformation.make &&
      vehicleInformation.model &&
      vehicleInformation.year &&
      vehicleInformation.make.trim().length > 0 &&
      vehicleInformation.model.trim().length > 0 &&
      vehicleInformation.year.trim().length === 4
    );
    setStepValidity('vehicle', isValid);
  }, [vehicleInformation, setStepValidity]);

  const handleInputChange = (field: string, value: string) => {
    console.log('Vehicle input change:', field, value);
    const updatedData = { 
      ...vehicleInformation,
      [field]: value 
    };
    updateFormData('vehicle', updatedData);
  };

  const handleNext = () => {
    if (state.isValid.vehicle) {
      goToNextStep();
      navigation.navigate('BookingStepPickup');
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
        <Text style={styles.title}>Vehicle Information</Text>
        <Text style={styles.subtitle}>Step 2 of 8</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '25%' }]} />
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
            <Text style={styles.sectionTitle}>Vehicle Details</Text>
            <Text style={styles.sectionSubtitle}>
              Please provide details about the vehicle to be shipped
            </Text>

            <Input
              label="Make"
              placeholder="e.g., Ford, Toyota, BMW"
              value={vehicleInformation.make || ''}
              onChangeText={(value) => handleInputChange('make', value)}
              leftIcon="directions-car"
              required
            />

            <Input
              label="Model"
              placeholder="e.g., F-150, Camry, X5"
              value={vehicleInformation.model || ''}
              onChangeText={(value) => handleInputChange('model', value)}
              leftIcon="directions-car"
              required
            />

            <Input
              label="Year"
              placeholder="e.g., 2020"
              value={vehicleInformation.year || ''}
              onChangeText={(value) => handleInputChange('year', value)}
              leftIcon="calendar-today"
              keyboardType="numeric"
              maxLength={4}
              required
            />

            <Input
              label="VIN Number"
              placeholder="17-character VIN (optional)"
              value={vehicleInformation.vin || ''}
              onChangeText={(value) => handleInputChange('vin', value.toUpperCase())}
              leftIcon="confirmation-number"
              autoCapitalize="characters"
              maxLength={17}
              helper="Vehicle Identification Number helps with accurate quotes"
            />

            <Input
              label="License Plate"
              placeholder="License plate number (optional)"
              value={vehicleInformation.licensePlate || ''}
              onChangeText={(value) => handleInputChange('licensePlate', value.toUpperCase())}
              leftIcon="credit-card"
              autoCapitalize="characters"
            />

            <Input
              label="Condition Notes"
              placeholder="Any special conditions, modifications, or damage to note"
              value={vehicleInformation.conditionNotes || ''}
              onChangeText={(value) => handleInputChange('conditionNotes', value)}
              leftIcon="note"
              multiline
              numberOfLines={3}
              helper="This helps us prepare the right equipment and handling"
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
          disabled={!state.isValid.vehicle}
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
