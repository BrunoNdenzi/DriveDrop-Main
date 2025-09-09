import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as MediaLibrary from 'expo-media-library';

import { Colors, Typography, Spacing } from '../../constants/DesignSystem';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { RootStackParamList } from '../../navigation/types';
import { useBooking } from '../../context/BookingContext';

type BookingStepInsuranceProps = NativeStackScreenProps<RootStackParamList, 'BookingStepInsurance'>;

export default function BookingStepInsuranceScreen({ navigation }: BookingStepInsuranceProps) {
  const { state, updateFormData, setStepValidity, goToNextStep } = useBooking();
  const { insuranceDocumentation } = state.formData;
  const [uploading, setUploading] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  // Request permissions on component mount
  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      // Request camera permissions
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      
      // Request media library permissions
      const mediaLibraryPermission = await MediaLibrary.requestPermissionsAsync();
      
      if (cameraPermission.status === 'granted' && mediaLibraryPermission.status === 'granted') {
        setPermissionsGranted(true);
      } else {
        Alert.alert(
          'Permissions Required',
          'Camera and photo library access are required to upload documents.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Alert.alert('Please enable permissions in your device settings') }
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

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
    if (!permissionsGranted) {
      Alert.alert('Permissions Required', 'Please grant camera and photo permissions to upload documents.');
      return;
    }

    const docTypeInfo = documentTypes.find(d => d.key === documentType);
    Alert.alert(
      'Upload Document',
      `Upload ${docTypeInfo?.title}`,
      [
        { text: 'Take Photo', onPress: () => uploadDocument(documentType, 'camera') },
        { text: 'Choose from Gallery', onPress: () => uploadDocument(documentType, 'gallery') },
        { text: 'Choose File', onPress: () => uploadDocument(documentType, 'document') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const uploadDocument = async (documentType: string, source: 'camera' | 'gallery' | 'document') => {
    if (uploading) return;
    
    setUploading(true);
    
    try {
      let result: any = null;
      
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
          base64: false,
        });
      } else if (source === 'gallery') {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
          base64: false,
        });
      } else if (source === 'document') {
        result = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'image/*'],
          copyToCacheDirectory: true,
          multiple: false,
        });
      }

      if (result && !result.cancelled && (result.assets?.[0] || result.uri)) {
        const fileUri = result.assets?.[0]?.uri || result.uri;
        const fileName = result.assets?.[0]?.fileName || result.name || `document-${Date.now()}`;
        const fileType = result.assets?.[0]?.type || result.mimeType || 'image/jpeg';
        
        // Create document info object
        const documentInfo = {
          uri: fileUri,
          name: fileName,
          type: fileType,
          size: result.assets?.[0]?.fileSize || result.size || 0,
          uploadedAt: new Date().toISOString(),
        };

        // Update the form data
        const currentDocs = insuranceDocumentation[documentType as keyof typeof insuranceDocumentation] || [];
        const updatedData = {
          ...insuranceDocumentation,
          [documentType]: [...currentDocs, documentInfo],
        };
        
        updateFormData('insurance', updatedData);
        
        Alert.alert('Success', 'Document uploaded successfully!');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', 'There was an error uploading your document. Please try again.');
    } finally {
      setUploading(false);
    }
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
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
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
                        hasDocuments && styles.uploadButtonSuccess,
                        uploading && styles.uploadButtonDisabled
                      ]}
                      onPress={() => handleDocumentUpload(docType.key)}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <MaterialIcons 
                          name="hourglass-empty" 
                          size={20} 
                          color={Colors.text.disabled} 
                        />
                      ) : (
                        <MaterialIcons 
                          name={hasDocuments ? "check" : "add"} 
                          size={20} 
                          color={hasDocuments ? Colors.surface : Colors.primary} 
                        />
                      )}
                    </TouchableOpacity>
                  </View>

                  {hasDocuments && (
                    <View style={styles.documentList}>
                      {documents.map((doc: any, index) => {
                        const isImage = doc && typeof doc === 'object' && doc.type?.startsWith('image/');
                        const isPDF = doc && typeof doc === 'object' && doc.type === 'application/pdf';
                        const fileName = doc && typeof doc === 'object' ? doc.name : `Document ${index + 1}`;
                        const fileSize = doc && typeof doc === 'object' && doc.size ? `${Math.round(doc.size / 1024)}KB` : '';
                        
                        return (
                          <View key={index} style={styles.documentItem}>
                            <View style={styles.documentPreview}>
                              {isImage ? (
                                <Image 
                                  source={{ uri: doc.uri }} 
                                  style={styles.documentThumbnail}
                                  resizeMode="cover"
                                />
                              ) : (
                                <View style={styles.documentIcon}>
                                  <MaterialIcons 
                                    name={isPDF ? "picture-as-pdf" : "description"} 
                                    size={24} 
                                    color={isPDF ? Colors.error : Colors.text.secondary} 
                                  />
                                </View>
                              )}
                            </View>
                            <View style={styles.documentInfoContent}>
                              <Text style={styles.documentName} numberOfLines={1}>
                                {fileName}
                              </Text>
                              {fileSize && (
                                <Text style={styles.documentSize}>{fileSize}</Text>
                              )}
                            </View>
                            <TouchableOpacity
                              onPress={() => removeDocument(docType.key, index)}
                              style={styles.removeButton}
                            >
                              <MaterialIcons name="close" size={18} color={Colors.error} />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
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
  uploadButtonDisabled: {
    borderColor: Colors.text.disabled,
    backgroundColor: Colors.neutral.gray[100],
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
  documentPreview: {
    width: 40,
    height: 40,
    marginRight: Spacing[3],
  },
  documentThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: Colors.neutral.gray[100],
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: Colors.neutral.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfoContent: {
    flex: 1,
  },
  documentName: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.primary,
    fontWeight: Typography.fontWeight.medium,
  },
  documentSize: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.secondary,
    marginTop: 2,
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
    height: Spacing[6],
  },
});
