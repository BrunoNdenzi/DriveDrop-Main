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
import GooglePlacesInput from '../../components/RobustGooglePlacesInput';
import PreciseLocationInput from '../../components/PreciseLocationInput';
import { RootStackParamList } from '../../navigation/types';
import { useBooking } from '../../context/BookingContext';

type BookingStepDeliveryProps = NativeStackScreenProps<RootStackParamList, 'BookingStepDelivery'>;

export default function BookingStepDeliveryScreen({ navigation }: BookingStepDeliveryProps) {
  const { state, updateFormData, setStepValidity, goToNextStep } = useBooking();
  const { deliveryDetails, customerDetails, pickupDetails } = state.formData;
  const [formattedPhone, setFormattedPhone] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Time slots for delivery
  const timeSlots = [
    { value: 'morning', label: 'Morning (8AM - 12PM)', time: '8:00 AM - 12:00 PM' },
    { value: 'afternoon', label: 'Afternoon (12PM - 5PM)', time: '12:00 PM - 5:00 PM' },
    { value: 'evening', label: 'Evening (5PM - 8PM)', time: '5:00 PM - 8:00 PM' },
    { value: 'flexible', label: 'Flexible (Any time)', time: 'Flexible timing' },
    { value: 'asap', label: 'ASAP', time: 'As soon as possible' },
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

  // Auto-fill delivery data from customer details and quote data on component mount
  useEffect(() => {
    if (customerDetails && (!deliveryDetails.address || !deliveryDetails.contactPerson || !deliveryDetails.contactPhone)) {
      const quoteData = customerDetails as any; // Quote data may be embedded in customer details
      
      const autoFillData = {
        address: deliveryDetails.address || '',
        contactPerson: deliveryDetails.contactPerson || customerDetails.fullName || '',
        contactPhone: deliveryDetails.contactPhone || customerDetails.phone || '',
        date: deliveryDetails.date || (quoteData.deliveryDate ? format(new Date(quoteData.deliveryDate), 'yyyy-MM-dd') : ''),
        time: deliveryDetails.time || '',
        specialInstructions: deliveryDetails.specialInstructions || '',
      };
      
      updateFormData('delivery', autoFillData);
      
      // Set formatted phone
      if (autoFillData.contactPhone) {
        setFormattedPhone(formatPhoneNumber(autoFillData.contactPhone));
      }
      
      // Set selected date for date picker
      if (quoteData.deliveryDate) {
        try {
          const deliveryDateObj = new Date(quoteData.deliveryDate);
          if (!isNaN(deliveryDateObj.getTime())) {
            setSelectedDate(deliveryDateObj);
          }
        } catch (error) {
          console.warn('Error parsing delivery date:', error);
        }
      }
    }
  }, [customerDetails, deliveryDetails.address, deliveryDetails.contactPerson, deliveryDetails.contactPhone]);

  // Initialize selected date when delivery date changes
  useEffect(() => {
    if (deliveryDetails.date) {
      try {
        const parsedDate = new Date(deliveryDetails.date);
        if (!isNaN(parsedDate.getTime())) {
          setSelectedDate(parsedDate);
        }
      } catch (error) {
        console.warn('Error parsing delivery date:', error);
      }
    }
  }, [deliveryDetails.date]);

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      try {
        // Business logic: delivery date should be after pickup date
        let minDeliveryDate = startOfDay(new Date()); // Default to today
        
        if (pickupDetails.date) {
          const pickupDate = new Date(pickupDetails.date);
          if (!isNaN(pickupDate.getTime())) {
            minDeliveryDate = startOfDay(pickupDate); // Same day or later
          }
        }
        
        if (isBefore(startOfDay(date), minDeliveryDate)) {
          // Don't allow delivery before pickup
          return;
        }
        
        setSelectedDate(date);
        const formattedDate = format(date, 'yyyy-MM-dd');
        handleInputChange('date', formattedDate);
      } catch (error) {
        console.warn('Error handling date change:', error);
      }
    }
  };

  const handleTimeSlotSelect = (timeSlot: any) => {
    handleInputChange('time', timeSlot.value);
    setShowTimePicker(false);
  };

  const getMinimumDate = () => {
    if (pickupDetails.date) {
      try {
        const pickupDate = new Date(pickupDetails.date);
        if (!isNaN(pickupDate.getTime())) {
          return pickupDate;
        }
      } catch (error) {
        console.warn('Error parsing pickup date:', error);
      }
    }
    return new Date(); // Today if no valid pickup date
  };

  // Validate form data
  useEffect(() => {
    const isValid = !!(
      deliveryDetails.address &&
      deliveryDetails.contactPerson &&
      deliveryDetails.contactPhone &&
      deliveryDetails.address.trim().length > 0 &&
      deliveryDetails.contactPerson.trim().length > 0 &&
      deliveryDetails.contactPhone.trim().length >= 10
    );
    setStepValidity('delivery', isValid);
  }, [deliveryDetails, setStepValidity]);

  const handleInputChange = (field: string, value: string) => {
    let processedValue = value;
    
    // Format phone number if it's the contactPhone field
    if (field === 'contactPhone') {
      processedValue = value.replace(/\D/g, '').substring(0, 10);
      setFormattedPhone(formatPhoneNumber(processedValue));
    }
    
    const updatedData = { 
      ...deliveryDetails,
      [field]: processedValue 
    };
    updateFormData('delivery', updatedData);
  };

  const handleNext = () => {
    if (state.isValid.delivery) {
      goToNextStep();
      navigation.navigate('BookingStepTowing');
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
        <Text style={styles.title}>Delivery Details</Text>
        <Text style={styles.subtitle}>Step 4 of 8</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '50%' }]} />
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
            <Text style={styles.sectionTitle}>Delivery Information</Text>
            <Text style={styles.sectionSubtitle}>
              Where should we deliver your vehicle?
            </Text>

            <PreciseLocationInput
              label="Delivery Address"
              placeholder="Enter precise delivery location for driver"
              value={deliveryDetails.address || ''}
              onLocationSelect={(address: string, coordinates?: { lat: number; lng: number }, details?: any) => {
                handleInputChange('address', address);
                // Store coordinates for driver navigation
                if (coordinates) {
                  updateFormData('delivery', {
                    ...deliveryDetails,
                    address: address,
                    coordinates: coordinates,
                    placeId: details?.place_id,
                  });
                }
                // Optional: Store additional place details if needed
                console.log('Delivery location:', { address, coordinates, details });
              }}
              required
              helper="Enter exact delivery location for accurate driver navigation"
            />

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                Delivery Date <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity 
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <MaterialIcons 
                  name="calendar-today" 
                  size={20} 
                  color={Colors.text.secondary} 
                  style={styles.dateIcon} 
                />
                <Text style={[
                  styles.datePickerText, 
                  !deliveryDetails.date && styles.placeholderText
                ]}>
                  {deliveryDetails.date 
                    ? (() => {
                        try {
                          const date = new Date(deliveryDetails.date);
                          return !isNaN(date.getTime()) ? format(date, 'MMMM d, yyyy') : 'Invalid date';
                        } catch {
                          return 'Invalid date';
                        }
                      })()
                    : 'Select delivery date'
                  }
                </Text>
              </TouchableOpacity>
              <Text style={styles.helper}>
                Delivery date must be after pickup date ({
                  pickupDetails.date ? 
                    (() => {
                      try {
                        const date = new Date(pickupDetails.date);
                        return !isNaN(date.getTime()) ? format(date, 'MMM d, yyyy') : 'Invalid date';
                      } catch {
                        return 'Invalid date';
                      }
                    })() 
                    : 'TBD'
                })
              </Text>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                minimumDate={getMinimumDate()}
              />
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Delivery Time</Text>
              <TouchableOpacity 
                style={styles.timePickerButton}
                onPress={() => setShowTimePicker(!showTimePicker)}
              >
                <MaterialIcons 
                  name="access-time" 
                  size={20} 
                  color={Colors.text.secondary} 
                  style={styles.timeIcon} 
                />
                <Text style={[
                  styles.timePickerText, 
                  !deliveryDetails.time && styles.placeholderText
                ]}>
                  {deliveryDetails.time 
                    ? timeSlots.find(slot => slot.value === deliveryDetails.time)?.time || deliveryDetails.time
                    : 'Select preferred time window'
                  }
                </Text>
              </TouchableOpacity>
              
              {showTimePicker && (
                <View style={styles.timePickerContainer}>
                  {timeSlots.map((slot) => (
                    <TouchableOpacity
                      key={slot.value}
                      style={[
                        styles.timeSlotOption,
                        deliveryDetails.time === slot.value && styles.selectedTimeSlot,
                      ]}
                      onPress={() => handleTimeSlotSelect(slot)}
                    >
                      <Text style={[
                        styles.timeSlotText,
                        deliveryDetails.time === slot.value && styles.selectedTimeSlotText,
                      ]}>
                        {slot.time}
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
              <Text style={styles.helper}>Leave blank for flexible timing</Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                Contact Person <Text style={styles.required}>*</Text>
              </Text>
              <Input
                placeholder="Name of person at delivery location"
                value={deliveryDetails.contactPerson || ''}
                onChangeText={(value) => handleInputChange('contactPerson', value)}
                leftIcon="person"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                Contact Phone <Text style={styles.required}>*</Text>
              </Text>
              <Input
                placeholder="Phone number for delivery coordination"
                value={formattedPhone}
                onChangeText={(value) => handleInputChange('contactPhone', value)}
                leftIcon="phone"
                keyboardType="phone-pad"
                maxLength={14}
              />
              <Text style={styles.helper}>US phone number format</Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Special Instructions</Text>
              <Input
                placeholder="Include specific street address, unit number, gate codes, parking details, and access instructions"
                value={deliveryDetails.specialInstructions || ''}
                onChangeText={(value) => handleInputChange('specialInstructions', value)}
                leftIcon="note"
                multiline
                numberOfLines={3}
              />
              <Text style={styles.helper}>Provide exact pickup/delivery locations, gate codes, parking instructions, etc.</Text>
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
          title="Next"
          variant="primary"
          onPress={handleNext}
          disabled={!state.isValid.delivery}
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
