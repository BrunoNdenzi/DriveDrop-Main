import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';

import { Colors } from '../constants/Colors';
import VehiclePhotosStep from '../components/completion/VehiclePhotosStep';
import ProofOfOwnershipStep from '../components/completion/ProofOfOwnershipStep';
import TermsAndConditionsStep from '../components/completion/TermsAndConditionsStep';
import InvoicePaymentStep from '../components/completion/InvoicePaymentStepRefactored';

interface Props {
  navigation: any;
  route: {
    params: {
      shipmentData: any;
    };
  };
}

interface CompletionData {
  vehiclePhotos: string[];
  ownershipDocuments: string[];
  termsAccepted: boolean;
  paymentCompleted: boolean;
  stripePaymentIntentId?: string;
}

const STEPS = [
  { id: 1, title: 'Vehicle Photos', icon: 'camera-alt', description: 'Document vehicle condition' },
  { id: 2, title: 'Proof of Ownership', icon: 'description', description: 'Upload ownership documents' },
  { id: 3, title: 'Terms & Conditions', icon: 'gavel', description: 'Review and accept terms' },
  { id: 4, title: 'Payment', icon: 'payment', description: 'Confirm and pay invoice' },
];

const ShipmentCompletionScreen: React.FC<Props> = ({ navigation, route }) => {
  const { shipmentData } = route.params;
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completionData, setCompletionData] = useState<CompletionData>({
    vehiclePhotos: [],
    ownershipDocuments: [],
    termsAccepted: false,
    paymentCompleted: false,
  });

  const updateCompletionData = (stepData: Partial<CompletionData>) => {
    setCompletionData(prev => ({ ...prev, ...stepData }));
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(current => current + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(current => current - 1);
    } else {
      navigation.goBack();
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return completionData.vehiclePhotos.length >= 4; // Minimum 4 exterior photos
      case 2:
        return completionData.ownershipDocuments.length >= 1;
      case 3:
        return completionData.termsAccepted;
      case 4:
        return true; // Payment step handles its own validation
      default:
        return false;
    }
  };

  const handleComplete = async () => {
    // Payment already created the shipment! Just show success and navigate
    // No need to check paymentCompleted - we're in step 4, payment is done
    Alert.alert(
      'Thank you for shipping with Drivedrop!',
      'Your shipment has been confirmed and payment processed. You will be notified once a driver is assigned to your shipment.',
      [
        {
          text: 'View My Shipments',
          onPress: () => {
            // Navigate back to tabs, then to Shipments screen
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [
                  {
                    name: 'ClientTabs',
                    state: {
                      routes: [
                        { name: 'Home' },
                        { name: 'Messages' },
                        { name: 'Shipments' },
                        { name: 'Profile' },
                      ],
                      index: 2, // Shipments tab (0=Home, 1=Messages, 2=Shipments, 3=Profile)
                    },
                  },
                ],
              })
            );
          },
        },
        {
          text: 'OK',
          onPress: () => {
            // Navigate back to tabs, on Home screen
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [
                  {
                    name: 'ClientTabs',
                    state: {
                      routes: [
                        { name: 'Home' },
                        { name: 'Messages' },
                        { name: 'Shipments' },
                        { name: 'Profile' },
                      ],
                      index: 0, // Home tab
                    },
                  },
                ],
              })
            );
          },
        },
      ]
    );
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((step, index) => (
        <View key={step.id} style={styles.stepContainer}>
          <View style={[
            styles.stepCircle,
            currentStep >= step.id && styles.stepCircleActive,
            currentStep > step.id && styles.stepCircleCompleted
          ]}>
            {currentStep > step.id ? (
              <MaterialIcons name="check" size={16} color="white" />
            ) : (
              <Text style={[
                styles.stepNumber,
                currentStep >= step.id && styles.stepNumberActive
              ]}>
                {step.id}
              </Text>
            )}
          </View>
          {index < STEPS.length - 1 && (
            <View style={[
              styles.stepLine,
              currentStep > step.id && styles.stepLineCompleted
            ]} />
          )}
        </View>
      ))}
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <VehiclePhotosStep
            shipmentData={shipmentData}
            photos={completionData.vehiclePhotos}
            onPhotosUpdate={(photos) => updateCompletionData({ vehiclePhotos: photos })}
          />
        );
      case 2:
        return (
          <ProofOfOwnershipStep
            shipmentData={shipmentData}
            documents={completionData.ownershipDocuments}
            onDocumentsUpdate={(documents) => updateCompletionData({ ownershipDocuments: documents })}
          />
        );
      case 3:
        return (
          <TermsAndConditionsStep
            shipmentData={shipmentData}
            accepted={completionData.termsAccepted}
            onAcceptanceUpdate={(accepted) => updateCompletionData({ termsAccepted: accepted })}
          />
        );
      case 4:
        return (
          <InvoicePaymentStep
            shipmentData={shipmentData}
            completionData={completionData}
            onPaymentComplete={(paymentIntentId, shipmentId) => {
              console.log('Payment completed:', paymentIntentId, 'Shipment:', shipmentId);
              updateCompletionData({ 
                paymentCompleted: true,
                stripePaymentIntentId: paymentIntentId
              });
            }}
            onFinalSubmit={handleComplete}
          />
        );
      default:
        return null;
    }
  };

  if (isSubmitting) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Finalizing your shipment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{STEPS[currentStep - 1].title}</Text>
        <View style={styles.stepCounter}>
          <Text style={styles.stepCounterText}>{currentStep}/{STEPS.length}</Text>
        </View>
      </View>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Step Title and Description */}
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>{STEPS[currentStep - 1].title}</Text>
        <Text style={styles.stepDescription}>{STEPS[currentStep - 1].description}</Text>
      </View>

      {/* Current Step Content */}
      <View style={styles.stepContent}>
        {renderCurrentStep()}
      </View>

      {/* Navigation Buttons */}
      <View style={styles.navigation}>
        {currentStep < STEPS.length ? (
          <TouchableOpacity
            style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={!canProceed()}
          >
            <Text style={[styles.nextButtonText, !canProceed() && styles.nextButtonTextDisabled]}>
              Continue
            </Text>
            <MaterialIcons 
              name="arrow-forward" 
              size={20} 
              color={canProceed() ? 'white' : Colors.text.secondary} 
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.completeButton, !completionData.paymentCompleted && styles.completeButtonDisabled]}
            onPress={handleComplete}
            disabled={!completionData.paymentCompleted}
          >
            <Text style={[styles.completeButtonText, !completionData.paymentCompleted && styles.completeButtonTextDisabled]}>
              Shipment Complete
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  stepCounter: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stepCounterText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  stepCircleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepCircleCompleted: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  stepNumberActive: {
    color: 'white',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
  stepLineCompleted: {
    backgroundColor: '#4CAF50',
  },
  stepHeader: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  navigation: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  nextButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#f0f0f0',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginRight: 8,
  },
  nextButtonTextDisabled: {
    color: Colors.text.secondary,
  },
  completeButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonDisabled: {
    backgroundColor: '#f0f0f0',
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  completeButtonTextDisabled: {
    color: Colors.text.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: 16,
  },
});

export default ShipmentCompletionScreen;
