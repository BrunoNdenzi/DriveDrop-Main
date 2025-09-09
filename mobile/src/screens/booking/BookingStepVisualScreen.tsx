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
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

import { Colors, Typography, Spacing } from '../../constants/DesignSystem';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { RootStackParamList } from '../../navigation/types';
import { useBooking } from '../../context/BookingContext';

type BookingStepVisualProps = NativeStackScreenProps<RootStackParamList, 'BookingStepVisual'>;

export default function BookingStepVisualScreen({ navigation }: BookingStepVisualProps) {
  const { state, updateFormData, setStepValidity, goToNextStep } = useBooking();
  const { visualDocumentation } = state.formData;
  const [capturing, setCapturing] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const screenWidth = Dimensions.get('window').width;

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
          'Camera and photo library access are required to take vehicle photos.',
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

  const photoCategories = [
    {
      key: 'frontView',
      title: 'Front View',
      description: 'Clear photo of vehicle front',
      required: true,
      icon: 'crop-landscape',
    },
    {
      key: 'rearView',
      title: 'Rear View',
      description: 'Clear photo of vehicle rear',
      required: true,
      icon: 'crop-landscape',
    },
    {
      key: 'leftSide',
      title: 'Left Side',
      description: 'Full side view from driver side',
      required: true,
      icon: 'crop-landscape',
    },
    {
      key: 'rightSide',
      title: 'Right Side',
      description: 'Full side view from passenger side',
      required: true,
      icon: 'crop-landscape',
    },
    {
      key: 'interior',
      title: 'Interior',
      description: 'Dashboard and interior condition',
      required: false,
      icon: 'airline-seat-recline-normal',
    },
    {
      key: 'damagePhotos',
      title: 'Damage Photos',
      description: 'Any existing damage or wear',
      required: false,
      icon: 'report-problem',
    },
  ];

  // Validate form data
  useEffect(() => {
    const requiredCategories = photoCategories.filter(cat => cat.required);
    const hasAllRequired = requiredCategories.every(category => {
      const photos = visualDocumentation[category.key as keyof typeof visualDocumentation] || [];
      return photos.length > 0;
    });
    setStepValidity('visual', hasAllRequired);
  }, [visualDocumentation, setStepValidity]);

  const handlePhotoCapture = (category: string) => {
    if (!permissionsGranted) {
      Alert.alert('Permissions Required', 'Please grant camera and photo permissions to take vehicle photos.');
      return;
    }

    const categoryInfo = photoCategories.find(c => c.key === category);
    setSelectedCategory(category);
    
    Alert.alert(
      'Add Photos',
      `Add photos for ${categoryInfo?.title}`,
      [
        { text: 'Take Photo', onPress: () => capturePhoto(category, 'camera') },
        { text: 'Choose from Gallery', onPress: () => capturePhoto(category, 'gallery') },
        { text: 'Cancel', style: 'cancel', onPress: () => setSelectedCategory(null) },
      ]
    );
  };

  const capturePhoto = async (category: string, source: 'camera' | 'gallery') => {
    if (capturing) return;
    
    setCapturing(true);
    
    try {
      let result: any = null;
      
      const imageOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3] as [number, number],
        quality: 0.8,
        base64: false,
      };
      
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync(imageOptions);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(imageOptions);
      }

      if (result && !result.cancelled && result.assets?.[0]) {
        const asset = result.assets[0];
        
        // Create photo info object
        const photoInfo = {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          type: asset.type || 'image/jpeg',
          fileSize: asset.fileSize || 0,
          capturedAt: new Date().toISOString(),
          category: category,
        };

        // Update the form data
        const currentPhotos = visualDocumentation[category as keyof typeof visualDocumentation] || [];
        const updatedData = {
          ...visualDocumentation,
          [category]: [...currentPhotos, photoInfo],
        };
        
        updateFormData('visual', updatedData);
        
        Alert.alert('Success', 'Photo added successfully!');
      }
    } catch (error) {
      console.error('Photo capture error:', error);
      Alert.alert('Capture Failed', 'There was an error capturing your photo. Please try again.');
    } finally {
      setCapturing(false);
      setSelectedCategory(null);
    }
  };

  const removePhoto = (category: string, index: number) => {
    const currentPhotos = visualDocumentation[category as keyof typeof visualDocumentation] || [];
    const updatedPhotos = currentPhotos.filter((_, i) => i !== index);
    
    const updatedData = {
      ...visualDocumentation,
      [category]: updatedPhotos,
    };
    
    updateFormData('visual', updatedData);
  };

  const handleNext = () => {
    if (state.isValid.visual) {
      goToNextStep();
      navigation.navigate('BookingStepTerms');
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
        <Text style={styles.title}>Visual Documentation</Text>
        <Text style={styles.subtitle}>Step 7 of 8</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '87.5%' }]} />
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
            <Text style={styles.sectionTitle}>Vehicle Photos</Text>
            <Text style={styles.sectionSubtitle}>
              Take clear photos of your vehicle from all angles. This helps us provide accurate service and document the vehicle's condition.
            </Text>

            <View style={styles.photoGrid}>
              {photoCategories.map((category) => {
                const photos = visualDocumentation[category.key as keyof typeof visualDocumentation] || [];
                const hasPhotos = photos.length > 0;

                return (
                  <View key={category.key} style={styles.photoCategory}>
                    <TouchableOpacity
                      style={[
                        styles.photoButton,
                        hasPhotos && styles.photoButtonComplete,
                        category.required && !hasPhotos && styles.photoButtonRequired,
                        capturing && selectedCategory === category.key && styles.photoButtonCapturing
                      ]}
                      onPress={() => handlePhotoCapture(category.key)}
                      disabled={capturing}
                    >
                      {capturing && selectedCategory === category.key ? (
                        <MaterialIcons 
                          name="hourglass-empty" 
                          size={32} 
                          color={Colors.text.disabled} 
                        />
                      ) : (
                        <MaterialIcons 
                          name={hasPhotos ? "check-circle" : category.icon as any} 
                          size={32} 
                          color={hasPhotos ? Colors.success : Colors.text.secondary} 
                        />
                      )}
                      <Text style={[
                        styles.photoButtonText,
                        hasPhotos && styles.photoButtonTextComplete
                      ]}>
                        {category.title}
                        {category.required && <Text style={styles.required}> *</Text>}
                      </Text>
                      <Text style={styles.photoButtonDescription}>
                        {category.description}
                      </Text>
                      {hasPhotos && (
                        <Text style={styles.photoCount}>
                          {photos.length} photo{photos.length !== 1 ? 's' : ''}
                        </Text>
                      )}
                    </TouchableOpacity>

                    {hasPhotos && (
                      <View style={styles.photoThumbnailGrid}>
                        {photos.map((photo: any, index) => (
                          <View key={index} style={styles.thumbnailContainer}>
                            <Image 
                              source={{ uri: photo.uri || photo }} 
                              style={styles.photoThumbnail}
                              resizeMode="cover"
                            />
                            <TouchableOpacity
                              onPress={() => removePhoto(category.key, index)}
                              style={styles.thumbnailRemoveButton}
                            >
                              <MaterialIcons name="close" size={16} color={Colors.surface} />
                            </TouchableOpacity>
                            <View style={styles.thumbnailInfo}>
                              <Text style={styles.thumbnailLabel}>
                                {index + 1}
                              </Text>
                            </View>
                          </View>
                        ))}
                        <TouchableOpacity 
                          style={styles.addMoreButton}
                          onPress={() => handlePhotoCapture(category.key)}
                        >
                          <MaterialIcons name="add" size={24} color={Colors.primary} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </Card>

          <Card variant="default" padding="lg" style={styles.formCard}>
            <View style={styles.tipsSection}>
              <MaterialIcons name="lightbulb" size={24} color={Colors.secondary} />
              <View style={styles.tipsContent}>
                <Text style={styles.tipsTitle}>Photo Tips</Text>
                <Text style={styles.tipsText}>
                  • Take photos in good lighting{'\n'}
                  • Ensure the entire vehicle is visible{'\n'}
                  • Capture any existing damage clearly{'\n'}
                  • Clean photos help with faster processing{'\n'}
                  • Multiple angles are welcome
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
          disabled={!state.isValid.visual}
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
  photoGrid: {
    gap: Spacing[4],
  },
  photoCategory: {
    marginBottom: Spacing[4],
  },
  photoButton: {
    padding: Spacing[4],
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderStyle: 'dashed',
  },
  photoButtonComplete: {
    borderColor: Colors.success,
    backgroundColor: Colors.brand.primary[50],
    borderStyle: 'solid',
  },
  photoButtonRequired: {
    borderColor: Colors.error,
  },
  photoButtonCapturing: {
    borderColor: Colors.text.disabled,
    backgroundColor: Colors.neutral.gray[50],
  },
  photoButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    marginTop: Spacing[2],
    textAlign: 'center',
  },
  photoButtonTextComplete: {
    color: Colors.success,
  },
  photoButtonDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing[1],
  },
  photoCount: {
    fontSize: Typography.fontSize.xs,
    color: Colors.success,
    marginTop: Spacing[1],
    fontWeight: Typography.fontWeight.medium,
  },
  required: {
    color: Colors.error,
  },
  photoList: {
    marginTop: Spacing[3],
    paddingLeft: Spacing[4],
  },
  photoThumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing[3],
    paddingLeft: Spacing[4],
    gap: Spacing[2],
  },
  thumbnailContainer: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.neutral.gray[100],
  },
  thumbnailRemoveButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.error,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  thumbnailInfo: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  thumbnailLabel: {
    color: Colors.surface,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  addMoreButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  photoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing[2],
    backgroundColor: Colors.neutral.gray[50],
    borderRadius: 6,
    marginBottom: Spacing[1],
  },
  photoName: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Colors.text.primary,
    marginLeft: Spacing[2],
  },
  removeButton: {
    padding: Spacing[1],
  },
  tipsSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipsContent: {
    flex: 1,
    marginLeft: Spacing[3],
  },
  tipsTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    marginBottom: Spacing[2],
  },
  tipsText: {
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
