import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import { Colors } from '../../constants/Colors';

interface Props {
  shipmentData: any;
  photos: string[];
  onPhotosUpdate: (photos: string[]) => void;
}

const REQUIRED_PHOTOS = [
  { id: 1, title: 'Front View', description: 'Front of the vehicle including bumper, headlights', icon: 'directions-car' },
  { id: 2, title: 'Rear View', description: 'Back of the vehicle including bumper, taillights', icon: 'directions-car' },
  { id: 3, title: 'Driver Side', description: 'Left side of the vehicle, full profile', icon: 'directions-car' },
  { id: 4, title: 'Passenger Side', description: 'Right side of the vehicle, full profile', icon: 'directions-car' },
];

const OPTIONAL_PHOTOS = [
  { id: 5, title: 'Interior Front', description: 'Dashboard and front seats', icon: 'event-seat' },
  { id: 6, title: 'Interior Rear', description: 'Back seats and cargo area', icon: 'event-seat' },
  { id: 7, title: 'Engine Bay', description: 'Under the hood (if accessible)', icon: 'build' },
  { id: 8, title: 'Any Damage', description: 'Close-up of existing damage or wear', icon: 'report-problem' },
];

const VehiclePhotosStep: React.FC<Props> = ({ shipmentData, photos, onPhotosUpdate }) => {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Sorry, we need camera roll permissions to upload photos.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    return true;
  };

  const compressImage = async (uri: string): Promise<string> => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }], // Resize to max width of 1200px
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      return manipResult.uri;
    } catch (error) {
      console.error('Error compressing image:', error);
      return uri; // Return original if compression fails
    }
  };

  const uploadImage = async (photoIndex: number) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setUploadingIndex(photoIndex);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3], // Better aspect ratio for vehicle photos
        quality: 1,
        allowsMultipleSelection: false,
        selectionLimit: 1,
      });

      if (!result.canceled) {
        const compressedUri = await compressImage(result.assets[0].uri);
        
        // Create a copy of photos array and update the specific index
        const updatedPhotos = [...photos];
        updatedPhotos[photoIndex] = compressedUri;
        onPhotosUpdate(updatedPhotos);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    } finally {
      setUploadingIndex(null);
    }
  };

  const takePhoto = async (photoIndex: number) => {
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

    setUploadingIndex(photoIndex);

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3], // Better aspect ratio for vehicle photos
        quality: 1,
      });

      if (!result.canceled) {
        const compressedUri = await compressImage(result.assets[0].uri);
        
        // Create a copy of photos array and update the specific index
        const updatedPhotos = [...photos];
        updatedPhotos[photoIndex] = compressedUri;
        onPhotosUpdate(updatedPhotos);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setUploadingIndex(null);
    }
  };

  const showImageOptions = (photoIndex: number) => {
    Alert.alert(
      'Add Photo',
      'Choose how you would like to add this photo',
      [
        { text: 'Take Photo', onPress: () => takePhoto(photoIndex) },
        { text: 'Choose from Library', onPress: () => uploadImage(photoIndex) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const removePhoto = (photoIndex: number) => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updatedPhotos = [...photos];
            updatedPhotos[photoIndex] = '';
            onPhotosUpdate(updatedPhotos);
          },
        },
      ]
    );
  };

  const renderPhotoCard = (photoInfo: any, photoIndex: number, isRequired: boolean = false) => {
    const hasPhoto = photos[photoIndex];
    const isUploading = uploadingIndex === photoIndex;

    return (
      <View key={photoInfo.id} style={styles.photoCard}>
        <View style={styles.photoHeader}>
          <View style={styles.photoTitleContainer}>
            <MaterialIcons 
              name={photoInfo.icon} 
              size={20} 
              color={isRequired ? Colors.primary : Colors.text.secondary} 
            />
            <Text style={[styles.photoTitle, isRequired && styles.requiredPhotoTitle]}>
              {photoInfo.title}
              {isRequired && <Text style={styles.requiredAsterisk}> *</Text>}
            </Text>
          </View>
          {hasPhoto && !isUploading && (
            <TouchableOpacity
              onPress={() => removePhoto(photoIndex)}
              style={styles.removeButton}
            >
              <MaterialIcons name="close" size={20} color={Colors.error} />
            </TouchableOpacity>
          )}
        </View>
        
        <Text style={styles.photoDescription}>{photoInfo.description}</Text>
        
        <TouchableOpacity
          style={[styles.photoContainer, hasPhoto && styles.photoContainerFilled]}
          onPress={() => showImageOptions(photoIndex)}
          disabled={isUploading}
        >
          {isUploading ? (
            <View style={styles.uploadingContainer}>
              <MaterialIcons name="cloud-upload" size={40} color={Colors.primary} />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          ) : hasPhoto ? (
            <Image source={{ uri: hasPhoto }} style={styles.photo} />
          ) : (
            <View style={styles.placeholderContainer}>
              <MaterialIcons name="add-a-photo" size={40} color={Colors.text.secondary} />
              <Text style={styles.placeholderText}>Tap to add photo</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const requiredPhotosCompleted = REQUIRED_PHOTOS.every((_, index) => photos[index]);
  const totalRequiredPhotos = REQUIRED_PHOTOS.length;
  const completedRequiredPhotos = REQUIRED_PHOTOS.filter((_, index) => photos[index]).length;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Vehicle Info Header */}
      <View style={styles.vehicleInfo}>
        <Text style={styles.vehicleTitle}>
          {shipmentData.vehicleYear} {shipmentData.vehicleMake} {shipmentData.vehicleModel}
        </Text>
        <Text style={styles.vehicleType}>{shipmentData.vehicleType}</Text>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressTitle}>
          Required Photos: {completedRequiredPhotos}/{totalRequiredPhotos}
        </Text>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${(completedRequiredPhotos / totalRequiredPhotos) * 100}%` }
            ]} 
          />
        </View>
        {requiredPhotosCompleted && (
          <View style={styles.completedIndicator}>
            <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.completedText}>All required photos uploaded!</Text>
          </View>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <MaterialIcons name="info" size={20} color={Colors.primary} />
        <Text style={styles.instructionsText}>
          Take clear photos in good lighting. These photos will be used for damage assessment and insurance purposes.
        </Text>
      </View>

      {/* Required Photos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Required Photos</Text>
        {REQUIRED_PHOTOS.map((photoInfo, index) => 
          renderPhotoCard(photoInfo, index, true)
        )}
      </View>

      {/* Optional Photos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Additional Photos (Optional)</Text>
        <Text style={styles.sectionSubtitle}>
          Add extra photos to better document your vehicle's condition
        </Text>
        {OPTIONAL_PHOTOS.map((photoInfo, index) => 
          renderPhotoCard(photoInfo, index + REQUIRED_PHOTOS.length, false)
        )}
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
  vehicleType: {
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
  instructionsContainer: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
    marginLeft: 8,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  photoCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  photoTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  photoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  requiredPhotoTitle: {
    color: Colors.primary,
  },
  requiredAsterisk: {
    color: Colors.error,
  },
  removeButton: {
    padding: 4,
  },
  photoDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 12,
    marginLeft: 28,
  },
  photoContainer: {
    height: 200,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  photoContainerFilled: {
    borderStyle: 'solid',
    borderColor: Colors.primary,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  placeholderContainer: {
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 8,
  },
  uploadingContainer: {
    alignItems: 'center',
  },
  uploadingText: {
    fontSize: 14,
    color: Colors.primary,
    marginTop: 8,
    fontWeight: '600',
  },
});

export default VehiclePhotosStep;
