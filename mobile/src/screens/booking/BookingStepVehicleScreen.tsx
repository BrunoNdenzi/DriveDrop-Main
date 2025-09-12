import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
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

type BookingStepVehicleProps = NativeStackScreenProps<RootStackParamList, 'BookingStepVehicle'>;

export default function BookingStepVehicleScreen({ navigation }: BookingStepVehicleProps) {
  const { state, updateFormData, setStepValidity, goToNextStep } = useBooking();
  const { vehicleInformation, customerDetails } = state.formData;
  const [showYearPicker, setShowYearPicker] = useState(false);
  const yearScrollViewRef = useRef<ScrollView>(null);
  
  // Generate years array (current year + 1 down to 1980)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1979 }, (_, i) => currentYear + 1 - i);

  // Auto-fill from quote data when component mounts
  useEffect(() => {
    // Check if we have quote data from customer details that was passed from NewShipmentScreen
    if (customerDetails && !vehicleInformation.make && !vehicleInformation.model) {
      const quoteData = customerDetails as any; // Quote data was stored in customer step
      
      if (quoteData.vehicleMake && quoteData.vehicleModel) {
        console.log('Auto-filling vehicle data from quote:', {
          make: quoteData.vehicleMake,
          model: quoteData.vehicleModel,
          type: quoteData.vehicleType
        });
        
        updateFormData('vehicle', {
          ...vehicleInformation,
          make: quoteData.vehicleMake,
          model: quoteData.vehicleModel,
        });
      }
    }
  }, [customerDetails, vehicleInformation.make, vehicleInformation.model, updateFormData]);

  // Validate form data
  useEffect(() => {
    const isValid = !!(
      vehicleInformation.make &&
      vehicleInformation.model &&
      vehicleInformation.year &&
      vehicleInformation.make.trim().length > 0 &&
      vehicleInformation.model.trim().length > 0 &&
      vehicleInformation.year.trim().length === 4 &&
      parseInt(vehicleInformation.year) >= 1980 &&
      parseInt(vehicleInformation.year) <= currentYear + 1
    );
    setStepValidity('vehicle', isValid);
  }, [vehicleInformation, setStepValidity, currentYear]);

  const handleInputChange = (field: string, value: string) => {
    console.log('Vehicle input change:', field, value);
    
    // Special handling for year field
    if (field === 'year') {
      // Only allow numbers and limit to 4 digits
      const numericValue = value.replace(/\D/g, '').substring(0, 4);
      const updatedData = { 
        ...vehicleInformation,
        [field]: numericValue 
      };
      updateFormData('vehicle', updatedData);
    } else if (field === 'licensePlate') {
      // Format license plate (uppercase, remove special chars except dashes and spaces)
      const formatted = value.toUpperCase().replace(/[^A-Z0-9\-\s]/g, '');
      const updatedData = { 
        ...vehicleInformation,
        [field]: formatted 
      };
      updateFormData('vehicle', updatedData);
    } else {
      const updatedData = { 
        ...vehicleInformation,
        [field]: value 
      };
      updateFormData('vehicle', updatedData);
    }
  };

  const handleYearSelect = (selectedYear: number) => {
    handleInputChange('year', selectedYear.toString());
    setShowYearPicker(false);
  };

  const openYearPicker = () => {
    setShowYearPicker(true);
    
    // Auto-scroll to current year or selected year
    setTimeout(() => {
      const targetYear = vehicleInformation.year ? parseInt(vehicleInformation.year) : currentYear;
      const yearIndex = years.findIndex(year => year === targetYear);
      
      if (yearIndex !== -1 && yearScrollViewRef.current) {
        const itemHeight = 52; // Height of each year option
        const offset = yearIndex * itemHeight;
        const maxOffset = Math.max(0, offset - 100); // Center the selected year
        
        yearScrollViewRef.current.scrollTo({
          y: maxOffset,
          animated: true,
        });
      }
    }, 100);
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
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
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
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        bounces={false}
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
              helper={vehicleInformation.make && customerDetails ? "✓ Auto-filled from quote" : ""}
            />

            <Input
              label="Model"
              placeholder="e.g., F-150, Camry, X5"
              value={vehicleInformation.model || ''}
              onChangeText={(value) => handleInputChange('model', value)}
              leftIcon="directions-car"
              required
              helper={vehicleInformation.model && customerDetails ? "✓ Auto-filled from quote" : ""}
            />

            {/* Year Picker */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                Year <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity 
                style={styles.yearPickerButton}
                onPress={openYearPicker}
              >
                <MaterialIcons name="calendar-today" size={20} color={Colors.text.secondary} style={styles.yearIcon} />
                <Text style={[styles.yearPickerText, !vehicleInformation.year && styles.placeholderText]}>
                  {vehicleInformation.year || 'Select vehicle year'}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
              
              {showYearPicker && (
                <View style={styles.yearPickerContainer}>
                  <ScrollView 
                    ref={yearScrollViewRef}
                    style={styles.yearsList} 
                    showsVerticalScrollIndicator={true}
                    bounces={true}
                    scrollEventThrottle={16}
                    removeClippedSubviews={true}
                    contentContainerStyle={styles.yearsListContent}
                  >
                    {years.map((year, index) => (
                      <TouchableOpacity
                        key={year}
                        style={[
                          styles.yearOption,
                          year.toString() === vehicleInformation.year && styles.selectedYearOption
                        ]}
                        onPress={() => handleYearSelect(year)}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.yearOptionText,
                          year.toString() === vehicleInformation.year && styles.selectedYearText
                        ]}>
                          {year}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TouchableOpacity 
                    style={styles.closeYearPicker}
                    onPress={() => setShowYearPicker(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.closeYearPickerText}>Close</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              <Text style={styles.helper}>
                Vehicle manufacturing year (1980-{currentYear + 1})
              </Text>
            </View>

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
              placeholder="e.g., ABC-1234, 123 ABC"
              value={vehicleInformation.licensePlate || ''}
              onChangeText={(value) => handleInputChange('licensePlate', value)}
              leftIcon="credit-card"
              autoCapitalize="characters"
              helper="Current license plate number (optional)"
            />

            <Input
              label="Condition Notes"
              placeholder="Describe any damage, modifications, or special conditions..."
              value={vehicleInformation.conditionNotes || ''}
              onChangeText={(value) => handleInputChange('conditionNotes', value)}
              leftIcon="note"
              multiline
              numberOfLines={4}
              helper="This helps us prepare the right equipment and handling procedures"
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.surface,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Spacing[6],
    paddingHorizontal: Spacing[6],
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
    paddingTop: Spacing[4],
  },
  formCard: {
    marginBottom: Spacing[4],
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
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
  inputContainer: {
    marginBottom: Spacing[4],
  },
  inputLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    marginBottom: Spacing[2],
  },
  required: {
    color: Colors.error,
  },
  yearPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    minHeight: 48,
  },
  yearIcon: {
    marginRight: Spacing[3],
  },
  yearPickerText: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    color: Colors.text.primary,
  },
  placeholderText: {
    color: Colors.text.disabled,
  },
  yearPickerContainer: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    maxHeight: 300,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 5.84,
    elevation: 8,
  },
  yearsList: {
    maxHeight: 250,
  },
  yearsListContent: {
    paddingBottom: 8,
  },
  yearOption: {
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    minHeight: 52,
    justifyContent: 'center',
  },
  selectedYearOption: {
    backgroundColor: Colors.primary,
  },
  yearOptionText: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  selectedYearText: {
    color: Colors.surface,
    fontWeight: Typography.fontWeight.semibold,
  },
  closeYearPicker: {
    paddingVertical: Spacing[3],
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  closeYearPickerText: {
    color: Colors.surface,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  helper: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.secondary,
    marginTop: Spacing[1],
  },
  navigationContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[4],
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: Platform.OS === 'ios' ? Spacing[8] : Spacing[4],
  },
  backButton: {
    flex: 1,
    marginRight: Spacing[3],
  },
  nextButton: {
    flex: 2,
  },
  bottomSpacing: {
    height: Spacing[8],
  },
});
