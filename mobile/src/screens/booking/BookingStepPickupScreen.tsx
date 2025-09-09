import React, { useEffect, useState } from 'react';
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
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Colors, Typography, Spacing } from '../../constants/DesignSystem';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { RootStackParamList } from '../../navigation/types';
import { useBooking } from '../../context/BookingContext';

type BookingStepPickupProps = NativeStackScreenProps<RootStackParamList, 'BookingStepPickup'>;

export default function BookingStepPickupScreen({ navigation }: BookingStepPickupProps) {
  const { state, updateFormData, setStepValidity, goToNextStep } = useBooking();
  const { pickupDetails, customerDetails } = state.formData;
  const [formattedPhone, setFormattedPhone] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Time slots for pickup
  const timeSlots = [
    { value: 'morning', label: 'Morning (8AM - 12PM)', time: '8:00 AM - 12:00 PM' },
    { value: 'afternoon', label: 'Afternoon (12PM - 5PM)', time: '12:00 PM - 5:00 PM' },
    { value: 'evening', label: 'Evening (5PM - 8PM)', time: '5:00 PM - 8:00 PM' },
    { value: 'flexible', label: 'Flexible (Any time)', time: 'Flexible timing' },
  ];

  // Format phone number to US format
  const formatPhoneNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const match = cleaned.substring(0, 10).match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    
    if (match) {
      const formatted = !match[2] 
        ? match[1] 
        : `(${match[1]}) ${match[2]}${match[3] ? `-${match[3]}` : ''}`;
      return formatted;
    }
    return text;
  };

  const isValidPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10;
  };

  // Auto-fill from quote data and customer details
  useEffect(() => {
    if (customerDetails && !pickupDetails.address && !pickupDetails.contactPerson) {
      const quoteData = customerDetails as any;
      
      // Auto-fill pickup date from quote
      if (quoteData.pickupDate) {
        const quotedDate = new Date(quoteData.pickupDate);
        setSelectedDate(quotedDate);
        updateFormData('pickup', {
          ...pickupDetails,
          date: format(quotedDate, 'MMM dd, yyyy'),
          contactPerson: quoteData.fullName || '',
          contactPhone: quoteData.phone || '',
        });
        
        if (quoteData.phone) {
          setFormattedPhone(formatPhoneNumber(quoteData.phone));
        }
      }
      
      // Auto-fill pickup ZIP from quote data to suggest address completion
      if (quoteData.pickupZip) {
        updateFormData('pickup', {
          ...pickupDetails,
          address: `ZIP: ${quoteData.pickupZip} Address : `,
        });
      }
    }
  }, [customerDetails, pickupDetails.address, pickupDetails.contactPerson, updateFormData]);

  // Initialize formatted phone if already exists
  useEffect(() => {
    if (pickupDetails.contactPhone && !formattedPhone) {
      setFormattedPhone(formatPhoneNumber(pickupDetails.contactPhone));
    }
  }, [pickupDetails.contactPhone, formattedPhone]);

  // Validate form data
  useEffect(() => {
    const isValid = !!(
      pickupDetails.address &&
      pickupDetails.date &&
      pickupDetails.contactPerson &&
      pickupDetails.contactPhone &&
      pickupDetails.address.trim().length > 10 && // More than just ZIP code
      isValidPhoneNumber(pickupDetails.contactPhone) &&
      pickupDetails.contactPerson.trim().length > 0
    );
    setStepValidity('pickup', isValid);
  }, [pickupDetails, setStepValidity]);

  const handleInputChange = (field: string, value: string) => {
    if (field === 'contactPhone') {
      // Remove all non-digits for storage
      const cleaned = value.replace(/\D/g, '');
      const limitedCleaned = cleaned.substring(0, 10);
      const formatted = formatPhoneNumber(limitedCleaned);
      
      setFormattedPhone(formatted);
      
      const updatedData = { 
        ...pickupDetails,
        [field]: limitedCleaned
      };
      updateFormData('pickup', updatedData);
    } else {
      const updatedData = { 
        ...pickupDetails,
        [field]: value 
      };
      updateFormData('pickup', updatedData);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const today = startOfDay(new Date());
      if (isBefore(selectedDate, today)) {
        alert('Pickup date cannot be in the past');
        return;
      }
      setSelectedDate(selectedDate);
      handleInputChange('date', format(selectedDate, 'MMM dd, yyyy'));
    }
  };

  const handleTimeSlotSelect = (timeSlot: typeof timeSlots[0]) => {
    handleInputChange('time', timeSlot.time);
    setShowTimePicker(false);
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
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
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
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        bounces={false}
      >
        <View style={styles.scrollContent}>
          <Card variant="default" padding="lg" style={styles.formCard}>
            <Text style={styles.sectionTitle}>Pickup Information</Text>
            <Text style={styles.sectionSubtitle}>
              Where and when should we pick up your vehicle?
            </Text>

            <Input
              label="Pickup Address"
              placeholder="Enter pickup full address"
              value={pickupDetails.address || ''}
              onChangeText={(value) => handleInputChange('address', value)}
              leftIcon="location-on"
              multiline
              numberOfLines={3}
              required
              helper={customerDetails && (customerDetails as any).pickupZip ? "✓ ZIP auto-filled from quote - please complete full address" : "Include street address, city, state, and ZIP code"}
            />

            {/* Date Picker */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                Pickup Date <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity 
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <MaterialIcons name="calendar-today" size={20} color={Colors.text.secondary} style={styles.dateIcon} />
                <Text style={[styles.datePickerText, !pickupDetails.date && styles.placeholderText]}>
                  {pickupDetails.date || 'Select pickup date'}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
              
              {showDatePicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange}
                  minimumDate={new Date()}
                />
              )}
              
              <Text style={styles.helper}>
                {customerDetails && (customerDetails as any).pickupDate ? "✓ Auto-filled from quote - flexible dates may reduce cost" : "Preferred pickup date (flexible dates may reduce cost)"}
              </Text>
            </View>

            {/* Time Picker */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Pickup Time</Text>
              <TouchableOpacity 
                style={styles.timePickerButton}
                onPress={() => setShowTimePicker(true)}
              >
                <MaterialIcons name="access-time" size={20} color={Colors.text.secondary} style={styles.timeIcon} />
                <Text style={[styles.timePickerText, !pickupDetails.time && styles.placeholderText]}>
                  {pickupDetails.time || 'Select preferred time window'}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
              
              {showTimePicker && (
                <View style={styles.timePickerContainer}>
                  {timeSlots.map((slot) => (
                    <TouchableOpacity
                      key={slot.value}
                      style={[
                        styles.timeSlotOption,
                        pickupDetails.time === slot.time && styles.selectedTimeSlot
                      ]}
                      onPress={() => handleTimeSlotSelect(slot)}
                    >
                      <Text style={[
                        styles.timeSlotText,
                        pickupDetails.time === slot.time && styles.selectedTimeSlotText
                      ]}>
                        {slot.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity 
                    style={styles.closeTimePicker}
                    onPress={() => setShowTimePicker(false)}
                  >
                    <Text style={styles.closeTimePickerText}>Close</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              <Text style={styles.helper}>
                Choose your preferred time window for pickup
              </Text>
            </View>

            <Input
              label="Contact Person"
              placeholder="Name of person available at pickup"
              value={pickupDetails.contactPerson || ''}
              onChangeText={(value) => handleInputChange('contactPerson', value)}
              leftIcon="person"
              required
              helper={customerDetails && (customerDetails as any).fullName ? "✓ Auto-filled from customer details" : "Person who will be available during pickup"}
            />

            <Input
              label="Contact Phone"
              placeholder="(555) 123-4567"
              value={formattedPhone}
              onChangeText={(value) => handleInputChange('contactPhone', value)}
              leftIcon="phone"
              keyboardType="phone-pad"
              required
              helper={isValidPhoneNumber(pickupDetails.contactPhone || '') ? "✓ Valid US phone number" : "10-digit phone number for pickup coordination"}
              maxLength={14}
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
  datePickerButton: {
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
  timePickerButton: {
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
  dateIcon: {
    marginRight: Spacing[3],
  },
  timeIcon: {
    marginRight: Spacing[3],
  },
  datePickerText: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    color: Colors.text.primary,
  },
  timePickerText: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    color: Colors.text.primary,
  },
  placeholderText: {
    color: Colors.text.disabled,
  },
  timePickerContainer: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    maxHeight: 250,
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
  timeSlotOption: {
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  selectedTimeSlot: {
    backgroundColor: Colors.primary,
  },
  timeSlotText: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  selectedTimeSlotText: {
    color: Colors.surface,
    fontWeight: Typography.fontWeight.semibold,
  },
  closeTimePicker: {
    paddingVertical: Spacing[3],
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  closeTimePickerText: {
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
