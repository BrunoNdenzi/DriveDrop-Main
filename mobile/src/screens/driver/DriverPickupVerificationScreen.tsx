import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';

const { width, height } = Dimensions.get('window');

type DriverPickupVerificationScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'DriverPickupVerification'
>;

interface Photo {
  id: string;
  angle: string;
  uri: string;
  timestamp: string;
}

interface ClientPhotos {
  front: string[];
  rear: string[];
  left: string[];
  right: string[];
  interior: string[];
  damage: string[];
}

const REQUIRED_ANGLES = [
  { value: 'front', label: 'Front', icon: 'directions-car', clientKey: 'front' },
  { value: 'back', label: 'Back', icon: 'directions-car', clientKey: 'rear' },
  { value: 'left_side', label: 'Left Side', icon: 'arrow-back', clientKey: 'left' },
  { value: 'right_side', label: 'Right Side', icon: 'arrow-forward', clientKey: 'right' },
  { value: 'interior', label: 'Interior', icon: 'event-seat', clientKey: 'interior' },
  { value: 'dashboard', label: 'Dashboard', icon: 'speed', clientKey: 'damage' },
];

export default function DriverPickupVerificationScreen({ route, navigation }: DriverPickupVerificationScreenProps) {
  const { shipmentId } = route.params;
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [selectedAngle, setSelectedAngle] = useState<string>('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [decision, setDecision] = useState<'matches' | 'minor_differences' | 'major_issues' | null>(null);
  const [driverNotes, setDriverNotes] = useState('');
  const [clientPhotos, setClientPhotos] = useState<ClientPhotos | null>(null);
  const [showClientPhoto, setShowClientPhoto] = useState(false);
  const [selectedClientPhotoUrl, setSelectedClientPhotoUrl] = useState<string>('');
  const cameraRef = useRef<CameraView>(null);
  const { userProfile } = useAuth();

  useEffect(() => {
    if (permission === null) {
      requestPermission();
    }
    fetchClientPhotos();
  }, [permission]);

  const fetchClientPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select('client_vehicle_photos')
        .eq('id', shipmentId)
        .single();

      if (error) throw error;

      if (data && (data as any).client_vehicle_photos) {
        setClientPhotos((data as any).client_vehicle_photos as ClientPhotos);
        console.log('✅ Client photos loaded:', Object.keys((data as any).client_vehicle_photos));
      }
    } catch (error) {
      console.error('Error fetching client photos:', error);
      // Don't alert - not critical if client didn't upload photos
    }
  };

  const getClientPhotoForAngle = (angleValue: string): string | null => {
    if (!clientPhotos) return null;
    
    const angle = REQUIRED_ANGLES.find(a => a.value === angleValue);
    if (!angle) return null;
    
    const clientKey = angle.clientKey as keyof ClientPhotos;
    const photoArray = clientPhotos[clientKey];
    
    return photoArray && photoArray.length > 0 ? photoArray[0] : null;
  };

  const viewClientPhoto = (angleValue: string) => {
    const photoUrl = getClientPhotoForAngle(angleValue);
    if (photoUrl) {
      setSelectedClientPhotoUrl(photoUrl);
      setShowClientPhoto(true);
    } else {
      Alert.alert('No Reference Photo', 'Client did not upload a photo for this angle.');
    }
  };

  const openCamera = (angle: string) => {
    setSelectedAngle(angle);
    setCameraReady(false); // Reset camera ready state when opening
    setShowCamera(true);
  };

  const takePicture = async () => {
    if (!cameraRef.current) {
      console.error('Camera ref is null');
      Alert.alert('Error', 'Camera not initialized. Please close and reopen the camera.');
      return;
    }

    if (!cameraReady) {
      console.error('Camera not ready');
      Alert.alert('Error', 'Camera is still loading. Please wait a moment and try again.');
      return;
    }

    try {
      console.log('Taking picture for angle:', selectedAngle);
      
      // Add a small delay to ensure camera is fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });
      
      if (!photo || !photo.uri) {
        throw new Error('Photo capture returned invalid data');
      }
      
      console.log('Photo captured:', photo.uri);
      
      const newPhoto: Photo = {
        id: `${Date.now()}`,
        angle: selectedAngle,
        uri: photo.uri,
        timestamp: new Date().toISOString(),
      };
      
      // Replace existing photo for this angle or add new
      setPhotos(prev => {
        const filtered = prev.filter(p => p.angle !== selectedAngle);
        return [...filtered, newPhoto];
      });
      
      setShowCamera(false);
      setSelectedAngle('');
      setCameraReady(false); // Reset camera ready state
      
      Alert.alert('Success', 'Photo captured successfully!');
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert(
        'Camera Error', 
        'Failed to capture photo. This may happen if:\n\n• Camera permissions are limited\n• Camera is in use by another app\n• Device storage is full\n\nPlease close the camera and try again.'
      );
    }
  };

  const pickImageFromGallery = async (angle: string) => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library access to upload images.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newPhoto: Photo = {
          id: `${Date.now()}`,
          angle: angle,
          uri: result.assets[0].uri,
          timestamp: new Date().toISOString(),
        };

        // Replace existing photo for this angle or add new
        setPhotos(prev => {
          const filtered = prev.filter(p => p.angle !== angle);
          return [...filtered, newPhoto];
        });

        Alert.alert('Success', 'Photo added successfully!');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const deletePhoto = (photoId: string) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => setPhotos(prev => prev.filter(p => p.id !== photoId)),
        },
      ]
    );
  };

  const getAngleStatus = (angleValue: string) => {
    return photos.some(p => p.angle === angleValue);
  };

  const getRemainingAngles = () => {
    return REQUIRED_ANGLES.filter(angle => !getAngleStatus(angle.value));
  };

  const canSubmit = () => {
    return photos.length >= 6 && decision !== null;
  };

  const handleSubmit = async () => {
    if (!canSubmit()) {
      Alert.alert('Incomplete', 'Please capture all 6 photos and select a decision.');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to submit verification.');
      return;
    }

    try {
      setUploading(true);

      // Get current location
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      if (locationStatus !== 'granted') {
        Alert.alert('Error', 'Location permission is required for verification.');
        setUploading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Get auth token
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        Alert.alert('Error', 'Authentication required. Please login again.');
        setUploading(false);
        return;
      }

      // Step 1: Start verification
      const startResponse = await fetch(
        `https://drivedrop-main-production.up.railway.app/api/v1/shipments/${shipmentId}/start-verification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            location: {
              lat: location.coords.latitude,
              lng: location.coords.longitude,
              accuracy: location.coords.accuracy || 0,
            },
          }),
        }
      );

      if (!startResponse.ok) {
        const errorData = await startResponse.json();
        throw new Error(errorData.message || 'Failed to start verification');
      }

      const responseData = await startResponse.json();
      const verificationId = responseData.data?.verification?.id || responseData.verificationId;

      if (!verificationId) {
        throw new Error('Verification ID not received from server');
      }

      console.log('Verification started with ID:', verificationId);

      // Step 2: Upload photos in parallel for faster processing
      console.log('Uploading all photos in parallel...');
      
      await Promise.all(photos.map(async (photo) => {
        console.log(`Uploading photo: ${photo.angle}`);
        
        // Upload to Supabase Storage
        const filename = `${shipmentId}/${verificationId}/${photo.angle}_${Date.now()}.jpg`;
        const fileUri = photo.uri;
        
        // Read file as base64 using FileSystem
        const base64 = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Convert base64 to byte array
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const uint8Array = new Uint8Array(byteNumbers);

        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('verification-photos')
          .upload(filename, uint8Array, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          throw new Error(`Failed to upload photo ${photo.angle}: ${uploadError.message}`);
        }

        // Get public URL
        const { data: { publicUrl } } = supabase
          .storage
          .from('verification-photos')
          .getPublicUrl(filename);

        console.log('Photo uploaded to storage:', publicUrl);

        // Register photo with backend
        const registerResponse = await fetch(
          `https://drivedrop-main-production.up.railway.app/api/v1/shipments/${shipmentId}/verification-photos`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              verificationId,
              angle: photo.angle,
              photoUrl: publicUrl,
              location: {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
              },
            }),
          }
        );

        if (!registerResponse.ok) {
          const errorData = await registerResponse.json();
          throw new Error(`Failed to register photo ${photo.angle}: ${errorData.message}`);
        }

        console.log(`Photo ${photo.angle} registered successfully`);
      }));
      
      console.log('✅ All photos uploaded successfully');

      // Small delay to ensure database has been updated
      // (Parallel uploads can cause race conditions with array updates)
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('✅ Proceeding to submit verification');

      // Step 3: Submit verification with decision
      const submitResponse = await fetch(
        `https://drivedrop-main-production.up.railway.app/api/v1/shipments/${shipmentId}/submit-verification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            verificationId,
            decision,
            driverNotes: driverNotes || undefined,
            differences: decision === 'minor_differences' ? (driverNotes || 'Minor differences noted') : undefined,
            location: {
              lat: location.coords.latitude,
              lng: location.coords.longitude,
            },
          }),
        }
      );

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json();
        throw new Error(errorData.message || 'Failed to submit verification');
      }
      
      // Navigate back immediately with success flag
      // This will trigger a refresh in the details screen
      navigation.navigate('ShipmentDetails', { 
        shipmentId, 
        refreshTrigger: Date.now() // Force refresh
      });
      
      // Show success message after navigation
      setTimeout(() => {
        Alert.alert('Success', 'Verification submitted successfully!');
      }, 300);
    } catch (error) {
      console.error('Error submitting verification:', error);
      Alert.alert('Error', 'Failed to submit verification. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <MaterialIcons name="no-photography" size={64} color={Colors.text.secondary} />
        <Text style={styles.errorText}>Camera permission is required</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={requestPermission}
        >
          <Text style={styles.primaryButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { marginTop: 12, backgroundColor: Colors.text.secondary }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <StatusBar style="light" />
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          onCameraReady={() => setCameraReady(true)}
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowCamera(false);
                  setSelectedAngle('');
                }}
              >
                <MaterialIcons name="close" size={28} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.cameraTitle}>
                {REQUIRED_ANGLES.find(a => a.value === selectedAngle)?.label}
              </Text>
              <View style={{ width: 28 }} />
            </View>

            <View style={styles.cameraControls}>
              {!cameraReady && (
                <View style={styles.cameraLoadingContainer}>
                  <ActivityIndicator size="large" color="#FFF" />
                  <Text style={styles.cameraLoadingText}>Initializing camera...</Text>
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.captureButton,
                  !cameraReady && styles.captureButtonDisabled
                ]}
                onPress={takePicture}
                disabled={!cameraReady}
              >
                <View style={[
                  styles.captureButtonInner,
                  !cameraReady && styles.captureButtonInnerDisabled
                ]} />
              </TouchableOpacity>
              {cameraReady && (
                <Text style={styles.captureHint}>Tap to capture</Text>
              )}
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  const remaining = getRemainingAngles();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Client Photo Modal */}
      <Modal
        visible={showClientPhoto}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowClientPhoto(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Client's Reference Photo</Text>
              <TouchableOpacity onPress={() => setShowClientPhoto(false)}>
                <MaterialIcons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            <Image 
              source={{ uri: selectedClientPhotoUrl }} 
              style={styles.modalImage}
              resizeMode="contain"
            />
            <Text style={styles.modalHint}>
              Compare this with the actual vehicle before taking your photo
            </Text>
          </View>
        </View>
      </Modal>
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pickup Verification</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Progress */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <MaterialIcons name="camera-alt" size={24} color={Colors.primary} />
            <Text style={styles.progressTitle}>Photo Progress</Text>
          </View>
          <Text style={styles.progressText}>
            {photos.length} of 6 required photos
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(photos.length / 6) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* Photo Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Required Photos</Text>
          <View style={styles.photoGrid}>
            {REQUIRED_ANGLES.map((angle) => {
              const captured = getAngleStatus(angle.value);
              const photo = photos.find(p => p.angle === angle.value);
              
              return (
                <View
                  key={angle.value}
                  style={[
                    styles.photoCard,
                    captured && styles.photoCardCaptured,
                  ]}
                >
                  {photo ? (
                    <>
                      <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => deletePhoto(photo.id)}
                      >
                        <MaterialIcons name="delete" size={18} color="#FFF" />
                      </TouchableOpacity>
                      <Text style={styles.photoLabel}>{angle.label}</Text>
                      {captured && (
                        <View style={styles.checkBadge}>
                          <MaterialIcons name="check" size={16} color="#FFF" />
                        </View>
                      )}
                    </>
                  ) : (
                    <>
                      <MaterialIcons name={angle.icon as any} size={32} color={Colors.text.secondary} />
                      <Text style={styles.photoLabel}>{angle.label}</Text>
                      
                      {/* View Client's Reference Photo Button */}
                      {getClientPhotoForAngle(angle.value) && (
                        <TouchableOpacity
                          style={styles.referenceButton}
                          onPress={() => viewClientPhoto(angle.value)}
                        >
                          <MaterialIcons name="image" size={16} color={Colors.info} />
                          <Text style={styles.referenceButtonText}>View Reference</Text>
                        </TouchableOpacity>
                      )}
                      
                      <View style={styles.photoActions}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => openCamera(angle.value)}
                        >
                          <MaterialIcons name="camera-alt" size={18} color={Colors.primary} />
                          <Text style={styles.actionButtonText}>Camera</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => pickImageFromGallery(angle.value)}
                        >
                          <MaterialIcons name="photo-library" size={18} color={Colors.primary} />
                          <Text style={styles.actionButtonText}>Upload</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Decision Selector */}
        {photos.length >= 6 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Verification Decision</Text>
            
            <TouchableOpacity
              style={[
                styles.decisionCard,
                decision === 'matches' && styles.decisionCardSelected,
              ]}
              onPress={() => setDecision('matches')}
            >
              <View style={styles.decisionIcon}>
                <MaterialIcons name="check-circle" size={28} color={Colors.success} />
              </View>
              <View style={styles.decisionContent}>
                <Text style={styles.decisionTitle}>Vehicle Matches</Text>
                <Text style={styles.decisionDescription}>
                  Vehicle condition matches the listing
                </Text>
              </View>
              {decision === 'matches' && (
                <MaterialIcons name="radio-button-checked" size={24} color={Colors.primary} />
              )}
              {decision !== 'matches' && (
                <MaterialIcons name="radio-button-unchecked" size={24} color={Colors.text.secondary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.decisionCard,
                decision === 'minor_differences' && styles.decisionCardSelected,
              ]}
              onPress={() => setDecision('minor_differences')}
            >
              <View style={styles.decisionIcon}>
                <MaterialIcons name="warning" size={28} color={Colors.warning} />
              </View>
              <View style={styles.decisionContent}>
                <Text style={styles.decisionTitle}>Minor Differences</Text>
                <Text style={styles.decisionDescription}>
                  Small issues that don't affect transport
                </Text>
              </View>
              {decision === 'minor_differences' && (
                <MaterialIcons name="radio-button-checked" size={24} color={Colors.primary} />
              )}
              {decision !== 'minor_differences' && (
                <MaterialIcons name="radio-button-unchecked" size={24} color={Colors.text.secondary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.decisionCard,
                decision === 'major_issues' && styles.decisionCardSelected,
              ]}
              onPress={() => setDecision('major_issues')}
            >
              <View style={styles.decisionIcon}>
                <MaterialIcons name="error" size={28} color={Colors.error} />
              </View>
              <View style={styles.decisionContent}>
                <Text style={styles.decisionTitle}>Major Issues</Text>
                <Text style={styles.decisionDescription}>
                  Cannot proceed with pickup
                </Text>
              </View>
              {decision === 'major_issues' && (
                <MaterialIcons name="radio-button-checked" size={24} color={Colors.primary} />
              )}
              {decision !== 'major_issues' && (
                <MaterialIcons name="radio-button-unchecked" size={24} color={Colors.text.secondary} />
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            !canSubmit() && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit() || uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <MaterialIcons name="check" size={20} color="#FFF" />
              <Text style={styles.submitButtonText}>Submit Verification</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  content: {
    flex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  progressCard: {
    margin: 20,
    padding: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 12,
  },
  progressText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  photoCard: {
    width: (width - 60) / 2,
    height: 140,
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  photoCardCaptured: {
    borderColor: Colors.success,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  photoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
    position: 'absolute',
    bottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  photoActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decisionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  decisionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F0F9FF',
  },
  decisionIcon: {
    marginRight: 12,
  },
  decisionContent: {
    flex: 1,
  },
  decisionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  decisionDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.text.secondary,
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  primaryButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  cameraControls: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  cameraLoadingContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  cameraLoadingText: {
    color: '#FFF',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '500',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF',
  },
  captureButtonInnerDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  captureHint: {
    color: '#FFF',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '500',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  modalImage: {
    width: '100%',
    height: height * 0.5,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  modalHint: {
    marginTop: 16,
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Reference button styles
  referenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.info + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  referenceButtonText: {
    fontSize: 12,
    color: Colors.info,
    fontWeight: '600',
    marginLeft: 4,
  },
});
