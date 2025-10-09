import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { Colors } from '../../constants/Colors';

interface Props {
  shipmentData: any;
  documents: string[];
  onDocumentsUpdate: (documents: string[]) => void;
}

interface DocumentType {
  id: number;
  title: string;
  description: string;
  icon: string;
  required: boolean;
  acceptedFormats: string[];
}

const DOCUMENT_TYPES: DocumentType[] = [
  {
    id: 1,
    title: 'Vehicle Title',
    description: 'Original title or title certificate showing ownership',
    icon: 'description',
    required: true,
    acceptedFormats: ['PDF', 'JPG', 'PNG'],
  },
  {
    id: 2,
    title: 'Registration',
    description: 'Current vehicle registration document',
    icon: 'assignment',
    required: false,
    acceptedFormats: ['PDF', 'JPG', 'PNG'],
  },
  {
    id: 3,
    title: 'Driver\'s License',
    description: 'Valid government-issued photo identification',
    icon: 'credit-card',
    required: true,
    acceptedFormats: ['JPG', 'PNG'],
  },
  {
    id: 4,
    title: 'Insurance Card',
    description: 'Proof of current vehicle insurance (optional)',
    icon: 'security',
    required: false,
    acceptedFormats: ['PDF', 'JPG', 'PNG'],
  },
];

const ProofOfOwnershipStep: React.FC<Props> = ({ shipmentData, documents, onDocumentsUpdate }) => {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Sorry, we need camera roll permissions to upload documents.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    return true;
  };

  const uploadDocument = async (documentIndex: number) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setUploadingIndex(documentIndex);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        // Create a copy of documents array and update the specific index
        const updatedDocuments = [...documents];
        updatedDocuments[documentIndex] = result.assets[0].uri;
        onDocumentsUpdate(updatedDocuments);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to select document. Please try again.');
    } finally {
      setUploadingIndex(null);
    }
  };

  const takePhoto = async (documentIndex: number) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    // Request camera permissions
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraStatus !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Sorry, we need camera permissions to take photos.',
        [{ text: 'OK' }]
      );
      return;
    }

    setUploadingIndex(documentIndex);

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        // Create a copy of documents array and update the specific index
        const updatedDocuments = [...documents];
        updatedDocuments[documentIndex] = result.assets[0].uri;
        onDocumentsUpdate(updatedDocuments);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setUploadingIndex(null);
    }
  };

  const showDocumentOptions = (documentIndex: number, documentType: DocumentType) => {
    const options = [
      { text: 'Take Photo', onPress: () => takePhoto(documentIndex) },
      { text: 'Choose Document', onPress: () => uploadDocument(documentIndex) },
      { text: 'Cancel', style: 'cancel' as const },
    ];

    Alert.alert(
      `Add ${documentType.title}`,
      `Choose how you would like to add your ${documentType.title.toLowerCase()}`,
      options
    );
  };

  const removeDocument = (documentIndex: number, documentType: DocumentType) => {
    Alert.alert(
      'Remove Document',
      `Are you sure you want to remove this ${documentType.title.toLowerCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updatedDocuments = [...documents];
            updatedDocuments[documentIndex] = '';
            onDocumentsUpdate(updatedDocuments);
          },
        },
      ]
    );
  };

  const getDocumentName = (uri: string): string => {
    if (!uri) return '';
    const parts = uri.split('/');
    return parts[parts.length - 1] || 'Document';
  };

  const renderDocumentCard = (documentType: DocumentType, documentIndex: number) => {
    const hasDocument = documents[documentIndex];
    const isUploading = uploadingIndex === documentIndex;

    return (
      <View key={documentType.id} style={styles.documentCard}>
        <View style={styles.documentHeader}>
          <View style={styles.documentTitleContainer}>
            <MaterialIcons 
              name={documentType.icon as any} 
              size={24} 
              color={documentType.required ? Colors.primary : Colors.text.secondary} 
            />
            <View style={styles.titleInfo}>
              <Text style={[styles.documentTitle, documentType.required && styles.requiredDocumentTitle]}>
                {documentType.title}
                {documentType.required && <Text style={styles.requiredAsterisk}> *</Text>}
              </Text>
              <Text style={styles.documentDescription}>{documentType.description}</Text>
            </View>
          </View>
          {hasDocument && !isUploading && (
            <TouchableOpacity
              onPress={() => removeDocument(documentIndex, documentType)}
              style={styles.removeButton}
            >
              <MaterialIcons name="close" size={20} color={Colors.error} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.acceptedFormats}>
          <Text style={styles.acceptedFormatsText}>
            Accepted formats: {documentType.acceptedFormats.join(', ')}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.documentContainer, hasDocument && styles.documentContainerFilled]}
          onPress={() => showDocumentOptions(documentIndex, documentType)}
          disabled={isUploading}
        >
          {isUploading ? (
            <View style={styles.uploadingContainer}>
              <MaterialIcons name="cloud-upload" size={32} color={Colors.primary} />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          ) : hasDocument ? (
            <View style={styles.documentInfo}>
              <MaterialIcons name="insert-drive-file" size={32} color={Colors.primary} />
              <Text style={styles.documentName}>{getDocumentName(hasDocument)}</Text>
              <View style={styles.documentStatus}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <Text style={styles.statusText}>Uploaded</Text>
              </View>
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <MaterialIcons name="add" size={32} color={Colors.text.secondary} />
              <Text style={styles.placeholderText}>
                Tap to add {documentType.title.toLowerCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const requiredDocuments = DOCUMENT_TYPES.filter(doc => doc.required);
  const requiredDocumentsCompleted = requiredDocuments.every((_, index) => {
    const docType = DOCUMENT_TYPES.find(d => d.required && DOCUMENT_TYPES.indexOf(d) === index);
    if (!docType) return false;
    const actualIndex = DOCUMENT_TYPES.indexOf(docType);
    return documents[actualIndex];
  });

  const completedRequiredDocs = requiredDocuments.filter((_, index) => {
    const docType = DOCUMENT_TYPES.find(d => d.required && DOCUMENT_TYPES.indexOf(d) === index);
    if (!docType) return false;
    const actualIndex = DOCUMENT_TYPES.indexOf(docType);
    return documents[actualIndex];
  }).length;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Vehicle Info Header */}
      <View style={styles.vehicleInfo}>
        <Text style={styles.vehicleTitle}>
          {shipmentData.vehicleYear} {shipmentData.vehicleMake} {shipmentData.vehicleModel}
        </Text>
        <Text style={styles.customerName}>{shipmentData.customerName}</Text>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressTitle}>
          Required Documents: {completedRequiredDocs}/{requiredDocuments.length}
        </Text>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${(completedRequiredDocs / requiredDocuments.length) * 100}%` }
            ]} 
          />
        </View>
        {requiredDocumentsCompleted && (
          <View style={styles.completedIndicator}>
            <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.completedText}>All required documents uploaded!</Text>
          </View>
        )}
      </View>

      {/* Security Notice */}
      <View style={styles.securityNotice}>
        <MaterialIcons name="security" size={20} color={Colors.primary} />
        <Text style={styles.securityText}>
          Your documents are securely encrypted and will only be used for verification purposes. 
          We follow strict privacy guidelines to protect your information.
        </Text>
      </View>

      {/* Document Upload Section */}
      <View style={styles.documentsSection}>
        <Text style={styles.sectionTitle}>Required Documents</Text>
        {DOCUMENT_TYPES.filter(doc => doc.required).map((documentType, index) => 
          renderDocumentCard(documentType, DOCUMENT_TYPES.indexOf(documentType))
        )}

        <Text style={styles.sectionTitle}>Optional Documents</Text>
        <Text style={styles.sectionSubtitle}>
          Additional documents that may help expedite processing
        </Text>
        {DOCUMENT_TYPES.filter(doc => !doc.required).map((documentType, index) => 
          renderDocumentCard(documentType, DOCUMENT_TYPES.indexOf(documentType))
        )}
      </View>

      {/* Important Notes */}
      <View style={styles.notesSection}>
        <Text style={styles.notesTitle}>Important Notes:</Text>
        <View style={styles.notesList}>
          <Text style={styles.noteItem}>ΓÇó Documents must be clear and readable</Text>
          <Text style={styles.noteItem}>ΓÇó Ensure all text and details are visible</Text>
          <Text style={styles.noteItem}>ΓÇó Documents must be current and valid</Text>
          <Text style={styles.noteItem}>ΓÇó Name on documents must match the customer name</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  vehicleInfo: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  vehicleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  completedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  completedText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 4,
  },
  securityNotice: {
    flexDirection: 'row',
    backgroundColor: '#e8f5e8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.primary,
    marginLeft: 8,
    lineHeight: 18,
  },
  documentsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
    marginTop: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  documentCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  documentTitleContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  titleInfo: {
    marginLeft: 12,
    flex: 1,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  requiredDocumentTitle: {
    color: Colors.primary,
  },
  requiredAsterisk: {
    color: Colors.error,
  },
  documentDescription: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  removeButton: {
    padding: 4,
  },
  acceptedFormats: {
    marginBottom: 12,
  },
  acceptedFormatsText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  documentContainer: {
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  documentContainerFilled: {
    borderStyle: 'solid',
    borderColor: Colors.primary,
    backgroundColor: '#f0f9ff',
  },
  documentInfo: {
    alignItems: 'center',
    padding: 8,
  },
  documentName: {
    fontSize: 12,
    color: Colors.text.primary,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  documentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '600',
  },
  placeholderContainer: {
    alignItems: 'center',
    padding: 8,
  },
  placeholderText: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  uploadingContainer: {
    alignItems: 'center',
    padding: 8,
  },
  uploadingText: {
    fontSize: 13,
    color: Colors.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  notesSection: {
    backgroundColor: '#fff3cd',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  notesList: {
    marginLeft: 8,
  },
  noteItem: {
    fontSize: 13,
    color: Colors.text.primary,
    lineHeight: 20,
    marginBottom: 4,
  },
});

export default ProofOfOwnershipStep;
