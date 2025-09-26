import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

import { Colors, ThemeColors } from '../../constants/Colors';
import { RootStackParamList } from '../../navigation/types';
import ProgressiveFormContainer from '../components/forms/ProgressiveFormContainer';
import { ProgressiveFormProvider, useProgressiveForm } from '../components/forms/ProgressiveFormProvider';
import { SHIPMENT_FORM_STEPS } from '../components/forms/ShipmentFormSteps';
import LoadingOverlay from '../components/LoadingOverlay';

type NewShipmentScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CreateShipment'>;
type NewShipmentScreenRouteProp = RouteProp<RootStackParamList, 'CreateShipment'>;

interface Props {
  navigation: NewShipmentScreenNavigationProp;
  route: NewShipmentScreenRouteProp;
}

// Header component for the progressive form
function ProgressiveFormHeader({ navigation }: { navigation: NewShipmentScreenNavigationProp }) {
  const { state, loadDraft, clearForm } = useProgressiveForm();
  const [showDraftOptions, setShowDraftOptions] = useState(false);

  const handleBackPress = () => {
    if (state.hasUnsavedChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. What would you like to do?',
        [
          {
            text: 'Discard Changes',
            style: 'destructive',
            onPress: () => navigation.goBack(),
          },
          {
            text: 'Save Draft',
            onPress: async () => {
              try {
                // Save draft logic would be implemented here
                await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated save
                navigation.goBack();
              } catch (error) {
                Alert.alert('Error', 'Failed to save draft');
              }
            },
          },
          {
            text: 'Continue Editing',
            style: 'cancel',
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const handleLoadDraft = async () => {
    try {
      // For now, use a default draft ID - this should be replaced with actual draft management
      await loadDraft('default-draft');
      setShowDraftOptions(false);
      Alert.alert('Success', 'Draft loaded successfully!');
    } catch (error) {
      Alert.alert('Error', 'No draft found or failed to load');
    }
  };

  const handleClearForm = () => {
    Alert.alert(
      'Clear Form',
      'Are you sure you want to clear all form data? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearForm();
            setShowDraftOptions(false);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.headerContainer}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleBackPress}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.light.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>New Shipment</Text>
          <Text style={styles.headerSubtitle}>
            Step {state.currentStepIndex + 1} of {state.steps.length}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setShowDraftOptions(!showDraftOptions)}
        >
          <MaterialIcons name="more-vert" size={24} color={Colors.light.text} />
        </TouchableOpacity>
      </View>

      {showDraftOptions && (
        <View style={styles.dropdownMenu}>
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={handleLoadDraft}
          >
            <MaterialIcons name="folder-open" size={20} color={Colors.light.text} />
            <Text style={styles.dropdownText}>Load Draft</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={handleClearForm}
          >
            <MaterialIcons name="clear" size={20} color={Colors.light.danger} />
            <Text style={[styles.dropdownText, { color: Colors.light.danger }]}>Clear Form</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => setShowDraftOptions(false)}
          >
            <MaterialIcons name="close" size={20} color={Colors.light.textSecondary} />
            <Text style={[styles.dropdownText, { color: Colors.light.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// Quick form toggle component
function QuickFormToggle() {
  const [useQuickForm, setUseQuickForm] = useState(false);

  const handleToggle = () => {
    Alert.alert(
      'Switch Form Mode',
      useQuickForm 
        ? 'Switch to guided step-by-step form? This provides better guidance and validation.'
        : 'Switch to quick single-page form? This is faster but less guided.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Switch', 
          onPress: () => setUseQuickForm(!useQuickForm)
        },
      ]
    );
  };

  if (useQuickForm) {
    return (
      <View style={styles.quickFormContainer}>
        <View style={styles.quickFormHeader}>
          <MaterialIcons name="speed" size={24} color={Colors.light.primary} />
          <Text style={styles.quickFormTitle}>Quick Form Mode</Text>
          <TouchableOpacity onPress={handleToggle}>
            <Text style={styles.switchModeText}>Switch to Guided</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.quickFormContent}>
          {/* This would render the traditional single-page form */}
          <Text style={styles.quickFormPlaceholder}>
            Quick single-page form would be rendered here...
            {'\n\n'}
            This mode includes all fields on one screen for experienced users
            who prefer speed over guidance.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.guidedFormContainer}>
      <View style={styles.guidedFormHeader}>
        <MaterialIcons name="assistant" size={24} color={Colors.light.primary} />
        <Text style={styles.guidedFormTitle}>Guided Form Mode</Text>
        <TouchableOpacity onPress={handleToggle}>
          <Text style={styles.switchModeText}>Switch to Quick</Text>
        </TouchableOpacity>
      </View>
      
      <ProgressiveFormContainer />
    </View>
  );
}

// Main component that provides form submission logic
function EnhancedNewShipmentScreen({ navigation, route }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom form submission handler
  const handleFormSubmission = async (formData: any) => {
    setIsSubmitting(true);
    
    try {
      // Validate all required fields
      const requiredFields = [
        'customerName', 'customerEmail', 'customerPhone',
        'pickupAddress', 'pickupDate',
        'deliveryAddress',
        'vehicleYear', 'vehicleMake', 'vehicleModel',
        'transportType', 'serviceSpeed', 'insuranceValue',
        'paymentMethod', 'agreementAccepted'
      ];

      const missingFields = requiredFields.filter(field => !formData[field]);
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Format data for API submission
      const shipmentData = {
        customer: {
          name: formData.customerName,
          email: formData.customerEmail,
          phone: formData.customerPhone,
        },
        pickup: {
          address: formData.pickupAddress,
          date: formData.pickupDate,
          timePreference: formData.pickupTimePreference,
          instructions: formData.pickupInstructions,
          contact: formData.contactAtPickup,
          contactPhone: formData.contactPhoneAtPickup,
        },
        delivery: {
          address: formData.deliveryAddress,
          date: formData.deliveryDate,
          timePreference: formData.deliveryTimePreference,
          instructions: formData.deliveryInstructions,
          contact: formData.contactAtDelivery,
          contactPhone: formData.contactPhoneAtDelivery,
        },
        vehicle: {
          year: formData.vehicleYear,
          make: formData.vehicleMake,
          model: formData.vehicleModel,
          color: formData.vehicleColor,
          vin: formData.vehicleVin,
          condition: formData.vehicleCondition,
          isRunning: formData.vehicleRunning,
          notes: formData.vehicleNotes,
        },
        shipment: {
          type: formData.shipmentType,
          transportType: formData.transportType,
          serviceSpeed: formData.serviceSpeed,
          insuranceValue: formData.insuranceValue,
          flexibleDates: formData.flexibleDates,
          additionalServices: formData.additionalServices,
        },
        pricing: {
          promotionalCode: formData.promotionalCode,
          paymentMethod: formData.paymentMethod,
        },
        metadata: {
          specialRequests: formData.specialRequests,
          agreementAccepted: formData.agreementAccepted,
          submittedAt: new Date().toISOString(),
        },
      };

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // On success, navigate to confirmation
      Alert.alert(
        'Success!',
        'Your shipment request has been submitted successfully. You will receive a confirmation email shortly.',
        [
          {
            text: 'View Details',
            onPress: () => navigation.navigate('ShipmentDetail', { 
              shipmentId: 'new-shipment-id',
              shipmentData 
            }),
          },
          {
            text: 'Create Another',
            onPress: () => {
              // Reset form and stay on current screen
              navigation.replace('NewShipment');
            },
          },
          {
            text: 'Go to Dashboard',
            onPress: () => navigation.navigate('Dashboard'),
          },
        ]
      );
      
    } catch (error) {
      Alert.alert(
        'Submission Error',
        error instanceof Error ? error.message : 'Failed to submit shipment request. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProgressiveFormProvider
      stepConfigs={SHIPMENT_FORM_STEPS}
      onSubmit={handleFormSubmission}
      autoSaveInterval={30000} // Auto-save every 30 seconds
    >
      <View style={styles.container}>
        <ProgressiveFormHeader navigation={navigation} />
        <QuickFormToggle />
        
        {isSubmitting && (
          <LoadingOverlay 
            message="Submitting your shipment request..."
            visible={isSubmitting}
          />
        )}
      </View>
    </ProgressiveFormProvider>
  );
}

export default EnhancedNewShipmentScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },

  // Header styles
  headerContainer: {
    backgroundColor: Colors.light.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },

  // Dropdown menu styles
  dropdownMenu: {
    backgroundColor: Colors.light.cardBackground,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingVertical: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  dropdownText: {
    fontSize: 16,
    color: Colors.light.text,
    marginLeft: 12,
  },

  // Form mode toggle styles
  quickFormContainer: {
    flex: 1,
  },
  quickFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: ThemeColors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: ThemeColors.border,
  },
  quickFormTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: ThemeColors.text,
    marginLeft: 12,
    flex: 1,
  },
  switchModeText: {
    fontSize: 14,
    color: ThemeColors.primary,
    textDecorationLine: 'underline',
  },
  quickFormContent: {
    flex: 1,
    padding: 24,
  },
  quickFormPlaceholder: {
    fontSize: 16,
    color: ThemeColors.textSecondary,
    textAlign: 'center',
    marginTop: 100,
    lineHeight: 24,
  },

  guidedFormContainer: {
    flex: 1,
  },
  guidedFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: ThemeColors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: ThemeColors.border,
  },
  guidedFormTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: ThemeColors.text,
    marginLeft: 12,
    flex: 1,
  },
});