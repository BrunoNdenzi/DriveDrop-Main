import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
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

type BookingStepTowingProps = NativeStackScreenProps<RootStackParamList, 'BookingStepTowing'>;

export default function BookingStepTowingScreen({ navigation }: BookingStepTowingProps) {
  const { state, updateFormData, setStepValidity, goToNextStep } = useBooking();
  const { towingTransport } = state.formData;

  const operabilityOptions = [
    { value: 'running', label: 'Running/Drivable', description: 'Vehicle starts and drives normally' },
    { value: 'not_running', label: 'Not Running', description: 'Vehicle does not start or run' },
    { value: 'partially_running', label: 'Partially Running', description: 'Vehicle has mechanical issues but may start' },
  ];

  const equipmentOptions = [
    'Flatbed Carrier',
    'Open Trailer',
    'Enclosed Trailer',
    'Wheel Lift Tow',
    'Dolly Transport',
    'Lowboy Trailer',
  ];

  // Validate form data
  useEffect(() => {
    const isValid = !!(towingTransport.operability);
    setStepValidity('towing', isValid);
  }, [towingTransport, setStepValidity]);

  const handleOperabilityChange = (value: string) => {
    const updatedData = { 
      ...towingTransport,
      operability: value as 'running' | 'not_running' | 'partially_running'
    };
    updateFormData('towing', updatedData);
  };

  const handleEquipmentToggle = (equipment: string) => {
    const currentEquipment = towingTransport.equipmentNeeds || [];
    const updatedEquipment = currentEquipment.includes(equipment)
      ? currentEquipment.filter(item => item !== equipment)
      : [...currentEquipment, equipment];
    
    const updatedData = { 
      ...towingTransport,
      equipmentNeeds: updatedEquipment
    };
    updateFormData('towing', updatedData);
  };

  const handleInputChange = (field: string, value: string) => {
    const updatedData = { 
      ...towingTransport,
      [field]: value 
    };
    updateFormData('towing', updatedData);
  };

  const handleNext = () => {
    if (state.isValid.towing) {
      goToNextStep();
      navigation.navigate('BookingStepInsurance');
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
        <Text style={styles.title}>Towing & Transport</Text>
        <Text style={styles.subtitle}>Step 5 of 8</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '62.5%' }]} />
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
            <Text style={styles.sectionTitle}>Vehicle Operability</Text>
            <Text style={styles.sectionSubtitle}>
              Is your vehicle currently drivable?
            </Text>

            {operabilityOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionCard,
                  towingTransport.operability === option.value && styles.optionCardSelected
                ]}
                onPress={() => handleOperabilityChange(option.value)}
              >
                <View style={styles.optionContent}>
                  <View style={styles.optionHeader}>
                    <Text style={[
                      styles.optionLabel,
                      towingTransport.operability === option.value && styles.optionLabelSelected
                    ]}>
                      {option.label}
                    </Text>
                    <View style={[
                      styles.radioButton,
                      towingTransport.operability === option.value && styles.radioButtonSelected
                    ]}>
                      {towingTransport.operability === option.value && (
                        <MaterialIcons name="check" size={16} color={Colors.surface} />
                      )}
                    </View>
                  </View>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </Card>

          <Card variant="default" padding="lg" style={styles.formCard}>
            <Text style={styles.sectionTitle}>Equipment Preferences</Text>
            <Text style={styles.sectionSubtitle}>
              Select preferred transport equipment (optional)
            </Text>

            <View style={styles.equipmentGrid}>
              {equipmentOptions.map((equipment) => (
                <TouchableOpacity
                  key={equipment}
                  style={[
                    styles.equipmentChip,
                    (towingTransport.equipmentNeeds || []).includes(equipment) && styles.equipmentChipSelected
                  ]}
                  onPress={() => handleEquipmentToggle(equipment)}
                >
                  <Text style={[
                    styles.equipmentText,
                    (towingTransport.equipmentNeeds || []).includes(equipment) && styles.equipmentTextSelected
                  ]}>
                    {equipment}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          <Card variant="default" padding="lg" style={styles.formCard}>
            <Input
              label="Special Requirements"
              placeholder="Any special towing or transport requirements"
              value={towingTransport.specialRequirements || ''}
              onChangeText={(value) => handleInputChange('specialRequirements', value)}
              leftIcon="build"
              multiline
              numberOfLines={3}
              helper="Oversized vehicle, modifications, accessibility needs, etc."
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
          disabled={!state.isValid.towing}
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
  optionCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing[4],
    marginBottom: Spacing[3],
  },
  optionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.brand.primary[50],
  },
  optionContent: {
    flex: 1,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[1],
  },
  optionLabel: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
  },
  optionLabelSelected: {
    color: Colors.primary,
  },
  optionDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
  },
  equipmentChip: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginBottom: Spacing[2],
  },
  equipmentChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  equipmentText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.primary,
  },
  equipmentTextSelected: {
    color: Colors.surface,
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
