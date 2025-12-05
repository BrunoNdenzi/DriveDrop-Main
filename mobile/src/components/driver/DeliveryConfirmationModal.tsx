import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';

interface DeliveryConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (photoUrls: string[]) => void;
  shipmentId: string;
  driverId: string;
}

const DeliveryConfirmationModal: React.FC<DeliveryConfirmationModalProps> = ({
  visible,
  onClose,
  onConfirm,
  shipmentId,
  driverId,
}) => {
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Camera roll permissions are needed to upload photos.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    return true;
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permissions are needed to take photos.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets[0]) {
        setPhotos([...photos, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const pickFromGallery = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        allowsEditing: false,
        // Ensure we get file URIs that can be read
        exif: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newPhotos = result.assets.map(asset => asset.uri);
        console.log('📸 Selected photos:', newPhotos);
        setPhotos([...photos, ...newPhotos]);
      }
    } catch (error) {
      console.error('Error picking photos:', error);
      Alert.alert('Error', 'Failed to select photos. Please try again.');
    }
  };

  const removePhoto = (index: number) => {
    const updatedPhotos = photos.filter((_, i) => i !== index);
    setPhotos(updatedPhotos);
  };

  const uploadPhotosAndConfirm = async () => {
    if (photos.length === 0) {
      // Allow skipping photos but show warning
      Alert.alert(
        'No Photos Taken',
        'Proceeding without delivery confirmation photos means you will have no evidence of delivery in case of disputes. Continue anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue Without Photos',
            style: 'destructive',
            onPress: () => onConfirm([]),
          },
        ]
      );
      return;
    }

    setUploading(true);

    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < photos.length; i++) {
        let photoUri = photos[i];
        const timestamp = Date.now();
        const filename = `delivery-photos/${driverId}/${shipmentId}/delivery_${i}_${timestamp}.jpg`;

        console.log(`📤 Uploading delivery photo ${i + 1}/${photos.length}`);

        // Handle Android content:// URIs by copying to cache first
        if (Platform.OS === 'android' && photoUri.startsWith('content://')) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(photoUri);
            if (!fileInfo.exists) {
              throw new Error('File does not exist');
            }

            // Copy to cache directory with file:// scheme
            const tempPath = `${FileSystem.cacheDirectory}delivery_temp_${timestamp}_${i}.jpg`;
            await FileSystem.copyAsync({
              from: photoUri,
              to: tempPath,
            });
            photoUri = tempPath;
            console.log('✅ Copied Android content URI to cache:', tempPath);
          } catch (copyError) {
            console.error('Error copying Android content URI:', copyError);
            throw new Error(`Failed to process photo ${i + 1}`);
          }
        }

        // Read file as base64
        const base64 = await FileSystem.readAsStringAsync(photoUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Convert base64 to Uint8Array
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let j = 0; j < byteCharacters.length; j++) {
          byteNumbers[j] = byteCharacters.charCodeAt(j);
        }
        const uint8Array = new Uint8Array(byteNumbers);

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('delivery-confirmation-photos')
          .upload(filename, uint8Array, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error(`Failed to upload photo ${i + 1}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('delivery-confirmation-photos')
          .getPublicUrl(filename);

        uploadedUrls.push(urlData.publicUrl);
        console.log(`✅ Uploaded delivery photo ${i + 1}/${photos.length}`);

        // Clean up temp file if we created one
        if (Platform.OS === 'android' && photoUri.startsWith(FileSystem.cacheDirectory || '')) {
          try {
            await FileSystem.deleteAsync(photoUri, { idempotent: true });
          } catch (deleteError) {
            console.log('Could not delete temp file:', deleteError);
          }
        }
      }

      console.log(`✅ All ${uploadedUrls.length} delivery photos uploaded successfully`);
      onConfirm(uploadedUrls);
    } catch (error) {
      console.error('Error uploading delivery photos:', error);
      Alert.alert('Upload Failed', 'Failed to upload photos. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (photos.length > 0) {
      Alert.alert(
        'Discard Photos?',
        'You have unsaved photos. Are you sure you want to cancel?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setPhotos([]);
              onClose();
            },
          },
        ]
      );
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delivery Confirmation</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Warning Banner */}
          <View style={styles.warningBanner}>
            <MaterialIcons name="info" size={24} color="#FF9800" />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>Important: Proof of Delivery</Text>
              <Text style={styles.warningText}>
                These photos serve as evidence of successful delivery. In case of disputes, 
                you will be held responsible if no delivery confirmation photos are provided.
              </Text>
              <Text style={styles.warningTextBold}>
                Recommended: Take photos of the vehicle at delivery location, odometer reading, 
                and any notable features.
              </Text>
            </View>
          </View>

          {/* Payment Info Banner */}
          <View style={styles.paymentBanner}>
            <MaterialIcons name="payment" size={24} color="#4CAF50" />
            <View style={styles.paymentContent}>
              <Text style={styles.paymentTitle}>💳 Payment Processing</Text>
              <Text style={styles.paymentText}>
                When you confirm delivery, the remaining 80% payment will be automatically 
                charged to the client's card on file. You'll be notified once payment is processed.
              </Text>
            </View>
          </View>

          {/* Photo Guidelines */}
          <View style={styles.guidelinesCard}>
            <Text style={styles.guidelinesTitle}>📸 Recommended Photos:</Text>
            <Text style={styles.guidelineItem}>✓ Vehicle at delivery location</Text>
            <Text style={styles.guidelineItem}>✓ Odometer reading</Text>
            <Text style={styles.guidelineItem}>✓ Recipient's signature/ID (if applicable)</Text>
            <Text style={styles.guidelineItem}>✓ Any damage or condition notes</Text>
          </View>

          {/* Photo Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
              <MaterialIcons name="camera-alt" size={32} color={Colors.primary} />
              <Text style={styles.actionText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={pickFromGallery}>
              <MaterialIcons name="photo-library" size={32} color={Colors.primary} />
              <Text style={styles.actionText}>Choose Photos</Text>
            </TouchableOpacity>
          </View>

          {/* Photos Grid */}
          {photos.length > 0 && (
            <View style={styles.photosSection}>
              <Text style={styles.photosSectionTitle}>
                Photos ({photos.length})
              </Text>
              <View style={styles.photosGrid}>
                {photos.map((uri, index) => (
                  <View key={index} style={styles.photoCard}>
                    <Image source={{ uri }} style={styles.photoImage} />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => removePhoto(index)}
                    >
                      <MaterialIcons name="close" size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Empty State */}
          {photos.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="add-photo-alternate" size={64} color={Colors.text.secondary} />
              <Text style={styles.emptyStateText}>No photos added yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Tap the buttons above to add delivery confirmation photos
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => uploadPhotosAndConfirm()}
            disabled={uploading}
          >
            <Text style={styles.skipButtonText}>
              {photos.length === 0 ? 'Skip Photos (Not Recommended)' : 'Continue Without More Photos'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.confirmButton,
              (uploading || photos.length === 0) && styles.confirmButtonDisabled,
            ]}
            onPress={uploadPhotosAndConfirm}
            disabled={uploading || photos.length === 0}
          >
            {uploading ? (
              <>
                <ActivityIndicator color="#FFF" size="small" style={{ marginRight: 8 }} />
                <Text style={styles.confirmButtonText}>Uploading...</Text>
              </>
            ) : (
              <>
                <MaterialIcons name="check-circle" size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.confirmButtonText}>
                  Confirm Delivery ({photos.length} photo{photos.length !== 1 ? 's' : ''})
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    paddingVertical: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: '#FFF',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  warningContent: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#5D4037',
    lineHeight: 20,
    marginBottom: 8,
  },
  warningTextBold: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
    lineHeight: 20,
  },
  paymentBanner: {
    flexDirection: 'row',
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  paymentContent: {
    flex: 1,
    marginLeft: 12,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 8,
  },
  paymentText: {
    fontSize: 14,
    color: '#1B5E20',
    lineHeight: 20,
  },
  guidelinesCard: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  guidelinesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  guidelineItem: {
    fontSize: 14,
    color: Colors.text.primary,
    marginBottom: 6,
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 24,
    borderRadius: 12,
    width: '45%',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  actionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  photosSection: {
    marginTop: 8,
  },
  photosSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  photoCard: {
    width: '31%',
    aspectRatio: 1,
    margin: 6,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  bottomActions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: '#FFF',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skipButtonText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  confirmButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: Colors.border,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});

export default DeliveryConfirmationModal;
