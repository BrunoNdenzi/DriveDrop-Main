import React, { useEffect } from 'react';
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
import { RootStackParamList } from '../../navigation/types';
import { useBooking } from '../../context/BookingContext';

type BookingStepInsuranceProps = NativeStackScreenProps<RootStackParamList, 'BookingStepInsurance'>;

export default function BookingStepInsuranceScreen({ navigation }: BookingStepInsuranceProps) {
  const { state, updateFormData, setStepValidity, goToNextStep } = useBooking();
  const { insuranceDocumentation } = state.formData;

  const documentTypes = [
    {
      key: 'proofOfOwnership',
      title: 'Proof of Ownership',
      description: 'Vehicle title, registration, or bill of sale',
      required: true,
      icon: 'assignment',
    },
    {
      key: 'insurance',
      title: 'Insurance Documentation',
      description: 'Current vehicle insurance policy',
      required: true,
      icon: 'security',
    },
    {
      key: 'otherDocuments',
      title: 'Other Documents',
      description: 'Any additional relevant documents',
      required: false,
      icon: 'folder',
    },
  ];

  // Validate form data
  useEffect(() => {
    const hasOwnership = (insuranceDocumentation.proofOfOwnership || []).length > 0;
    const hasInsurance = (insuranceDocumentation.insurance || []).length > 0;
    const isValid = hasOwnership && hasInsurance;
    setStepValidity('insurance', isValid);
  }, [insuranceDocumentation, setStepValidity]);

  const handleDocumentUpload = (documentType: string) => {
    // Placeholder for document upload functionality
    Alert.alert(
      'Document Upload',
      `Would you like to upload ${documentTypes.find(d => d.key === documentType)?.title}?`,
      [
        { text: 'Camera', onPress: () => uploadDocument(documentType, 'camera') },
        { text: 'Gallery', onPress: () => uploadDocument(documentType, 'gallery') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const uploadDocument = (documentType: string, source: 'camera' | 'gallery') => {
    // Placeholder implementation - in real app, would use expo-image-picker
    const mockFileUri = `file://mock-${documentType}-${Date.now()}.jpg`;
    const currentDocs = insuranceDocumentation[documentType as keyof typeof insuranceDocumentation] || [];
    
    const updatedData = {
      ...insuranceDocumentation,
      [documentType]: [...currentDocs, mockFileUri],
    };
    
    updateFormData('insurance', updatedData);
    
    Alert.alert('Success', 'Document uploaded successfully!');
  };

  const removeDocument = (documentType: string, index: number) => {
    const currentDocs = insuranceDocumentation[documentType as keyof typeof insuranceDocumentation] || [];
    const updatedDocs = currentDocs.filter((_, i) => i !== index);
    
    const updatedData = {
      ...insuranceDocumentation,
      [documentType]: updatedDocs,
    };
    
    updateFormData('insurance', updatedData);
  };

  const handleNext = () => {
    if (state.isValid.insurance) {
      goToNextStep();
      navigation.navigate('BookingStepVisual');
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
        <Text style={styles.title}>Insurance & Documents</Text>
        <Text style={styles.subtitle}>Step 6 of 8</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '75%' }]} />
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
            <Text style={styles.sectionTitle}>Required Documentation</Text>
            <Text style={styles.sectionSubtitle}>
              Please upload the required documents for your vehicle shipment
            </Text>

            {documentTypes.map((docType) => {
              const documents = insuranceDocumentation[docType.key as keyof typeof insuranceDocumentation] || [];
              const hasDocuments = documents.length > 0;

              return (
                <View key={docType.key} style={styles.documentSection}>
                  <View style={styles.documentHeader}>
                    <View style={styles.documentInfo}>
                      <View style={styles.documentTitleRow}>
                        <MaterialIcons 
                          name={docType.icon as any} 
                          size={20} 
                          color={Colors.text.secondary} 
                        />
                        <Text style={styles.documentTitle}>
                          {docType.title}
                          {docType.required && <Text style={styles.required}> *</Text>}
                        </Text>
                      </View>
                      <Text style={styles.documentDescription}>
                        {docType.description}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.uploadButton,
                        hasDocuments && styles.uploadButtonSuccess
                      ]}
                      onPress={() => handleDocumentUpload(docType.key)}
                    >
                      <MaterialIcons 
                        name={hasDocuments ? "check" : "add"} 
                        size={20} 
                        color={hasDocuments ? Colors.success : Colors.primary} 
                      />
                    </TouchableOpacity>
                  </View>

                  {hasDocuments && (
                    <View style={styles.documentList}>
                      {documents.map((doc, index) => (
                        <View key={index} style={styles.documentItem}>
                          <MaterialIcons name="description" size={16} color={Colors.text.secondary} />
                          <Text style={styles.documentName}>
                            Document {index + 1}
                          </Text>
                          <TouchableOpacity
                            onPress={() => removeDocument(docType.key, index)}
                            style={styles.removeButton}
                          >
                            <MaterialIcons name="close" size={16} color={Colors.error} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </Card>

          <Card variant="default" padding="lg" style={styles.formCard}>
            <View style={styles.infoSection}>
              <MaterialIcons name="info" size={24} color={Colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Document Requirements</Text>
                <Text style={styles.infoText}>
                  • All documents must be clear and legible{'\n'}
                  • Accepted formats: JPG, PNG, PDF{'\n'}
                  • Maximum file size: 10MB per document{'\n'}
                  • Documents will be securely stored and only used for shipment processing
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
          title="Next"
          variant="primary"
          onPress={handleNext}
          disabled={!state.isValid.insurance}
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
  documentSection: {
    marginBottom: Spacing[6],
    paddingBottom: Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  documentInfo: {
    flex: 1,
    marginRight: Spacing[4],
  },
  documentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing[1],
  },
  documentTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    marginLeft: Spacing[2],
  },
  required: {
    color: Colors.error,
  },
  documentDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },
  uploadButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  uploadButtonSuccess: {
    borderColor: Colors.success,
    backgroundColor: Colors.success,
  },
  documentList: {
    marginTop: Spacing[4],
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing[3],
    backgroundColor: Colors.neutral.gray[50],
    borderRadius: 8,
    marginBottom: Spacing[2],
  },
  documentName: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Colors.text.primary,
    marginLeft: Spacing[2],
  },
  removeButton: {
    padding: Spacing[1],
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoContent: {
    flex: 1,
    marginLeft: Spacing[3],
  },
  infoTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    marginBottom: Spacing[2],
  },
  infoText: {
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
  nextButton: {
    flex: 2,
  },
  bottomSpacing: {
    height: Spacing[6],
  },
});
