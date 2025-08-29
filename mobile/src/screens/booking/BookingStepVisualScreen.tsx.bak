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

type BookingStepVisualProps = NativeStackScreenProps<
  RootStackParamList,
  'BookingStepVisual'
>;

export default function BookingStepVisualScreen({
  navigation,
}: BookingStepVisualProps) {
  const { state, updateFormData, setStepValidity, goToNextStep } = useBooking();
  const { visualDocumentation } = state.formData;

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
      const photos =
        visualDocumentation[category.key as keyof typeof visualDocumentation] ||
        [];
      return photos.length > 0;
    });
    setStepValidity('visual', hasAllRequired);
  }, [visualDocumentation, setStepValidity]);

  const handlePhotoCapture = (category: string) => {
    Alert.alert(
      'Add Photos',
      `Add photos for ${photoCategories.find(c => c.key === category)?.title}`,
      [
        { text: 'Camera', onPress: () => capturePhoto(category, 'camera') },
        { text: 'Gallery', onPress: () => capturePhoto(category, 'gallery') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const capturePhoto = (category: string, source: 'camera' | 'gallery') => {
    // Placeholder implementation - in real app, would use expo-image-picker
    const mockPhotoUri = `file://mock-${category}-${Date.now()}.jpg`;
    const currentPhotos =
      visualDocumentation[category as keyof typeof visualDocumentation] || [];

    const updatedData = {
      ...visualDocumentation,
      [category]: [...currentPhotos, mockPhotoUri],
    };

    updateFormData('visual', updatedData);

    Alert.alert('Success', 'Photo added successfully!');
  };

  const removePhoto = (category: string, index: number) => {
    const currentPhotos =
      visualDocumentation[category as keyof typeof visualDocumentation] || [];
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
    <View style={styles.container}>
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
              Take clear photos of your vehicle from all angles. This helps us
              provide accurate service and document the vehicle's condition.
            </Text>

            <View style={styles.photoGrid}>
              {photoCategories.map(category => {
                const photos =
                  visualDocumentation[
                    category.key as keyof typeof visualDocumentation
                  ] || [];
                const hasPhotos = photos.length > 0;

                return (
                  <View key={category.key} style={styles.photoCategory}>
                    <TouchableOpacity
                      style={[
                        styles.photoButton,
                        hasPhotos && styles.photoButtonComplete,
                        category.required &&
                          !hasPhotos &&
                          styles.photoButtonRequired,
                      ]}
                      onPress={() => handlePhotoCapture(category.key)}
                    >
                      <MaterialIcons
                        name={
                          hasPhotos ? 'check-circle' : (category.icon as any)
                        }
                        size={32}
                        color={
                          hasPhotos ? Colors.success : Colors.text.secondary
                        }
                      />
                      <Text
                        style={[
                          styles.photoButtonText,
                          hasPhotos && styles.photoButtonTextComplete,
                        ]}
                      >
                        {category.title}
                        {category.required && (
                          <Text style={styles.required}> *</Text>
                        )}
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
                      <View style={styles.photoList}>
                        {photos.map((photo, index) => (
                          <View key={index} style={styles.photoItem}>
                            <MaterialIcons
                              name="photo"
                              size={16}
                              color={Colors.text.secondary}
                            />
                            <Text style={styles.photoName}>
                              Photo {index + 1}
                            </Text>
                            <TouchableOpacity
                              onPress={() => removePhoto(category.key, index)}
                              style={styles.removeButton}
                            >
                              <MaterialIcons
                                name="close"
                                size={16}
                                color={Colors.error}
                              />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </Card>

          <Card variant="default" padding="lg" style={styles.formCard}>
            <View style={styles.tipsSection}>
              <MaterialIcons
                name="lightbulb"
                size={24}
                color={Colors.secondary}
              />
              <View style={styles.tipsContent}>
                <Text style={styles.tipsTitle}>Photo Tips</Text>
                <Text style={styles.tipsText}>
                  • Take photos in good lighting{'\n'}• Ensure the entire
                  vehicle is visible{'\n'}• Capture any existing damage clearly
                  {'\n'}• Clean photos help with faster processing{'\n'}•
                  Multiple angles are welcome
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
