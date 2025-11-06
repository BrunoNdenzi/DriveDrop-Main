import React, { useState, useEffect } from 'react';
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
  TextInput,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
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

// Development mode - skip real location checks
const SKIP_LOCATION_IN_DEV = __DEV__; // Change to false to test real GPS

type DriverPickupVerificationScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'DriverPickupVerification'
>;

interface ClientPhotos {
  front: string[];
  rear: string[];
  left: string[];
  right: string[];
  interior: string[];
  damage: string[];
}

interface IssuePhoto {
  id: string;
  uri: string;
  description: string;
  timestamp: string;
}

const CLIENT_PHOTO_ANGLES = [
  { key: 'front', label: 'Front View', icon: 'directions-car' },
  { key: 'rear', label: 'Rear View', icon: 'directions-car' },
  { key: 'left', label: 'Left Side', icon: 'arrow-back' },
  { key: 'right', label: 'Right Side', icon: 'arrow-forward' },
  { key: 'interior', label: 'Interior', icon: 'event-seat' },
  { key: 'damage', label: 'Damage/Details', icon: 'warning' },
];

export default function DriverPickupVerificationScreen({ route, navigation }: DriverPickupVerificationScreenProps) {
  const { shipmentId } = route.params;
  const { user, userProfile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [clientPhotos, setClientPhotos] = useState<ClientPhotos | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string>('');
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [usingMockLocation, setUsingMockLocation] = useState(false);
  
  // Issue reporting
  const [reportingIssues, setReportingIssues] = useState(false);
  const [issuePhotos, setIssuePhotos] = useState<IssuePhoto[]>([]);
  const [issueNotes, setIssueNotes] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = React.useRef<CameraView>(null);
  const verificationSubmittedRef = React.useRef(false);
  const hasNavigatedAwayRef = React.useRef(false);

  useEffect(() => {
    fetchClientPhotos();
    
    // Check shipment status - if already verified, navigate away immediately
    checkVerificationStatus();
  }, []);

  const checkVerificationStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select('status')
        .eq('id', shipmentId)
        .single();

      if (error) throw error;

      // If status is pickup_verified or beyond, this screen shouldn't be accessible
      if (data && (data.status === 'pickup_verified' || 
                   data.status === 'picked_up' || 
                   data.status === 'in_transit' || 
                   data.status === 'delivered' || 
                   data.status === 'completed')) {
        console.log('⚠️ Verification already complete, navigating away');
        // Verification already complete, navigate back immediately
        verificationSubmittedRef.current = true;
        hasNavigatedAwayRef.current = true;
        navigation.replace('ShipmentDetails_Driver', {
          shipmentId,
          refreshTrigger: Date.now(),
        });
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
    }
  };

  // Override hardware back button to navigate to ShipmentDetails with refresh
  // BUT allow normal navigation after verification is successfully submitted
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // If verification was successfully submitted, allow normal navigation
      if (verificationSubmittedRef.current || hasNavigatedAwayRef.current) {
        return;
      }
      
      // Otherwise, prevent default and navigate to ShipmentDetails with refresh
      e.preventDefault();
      navigation.navigate('ShipmentDetails_Driver', {
        shipmentId,
        refreshTrigger: Date.now(),
      });
    });

    return unsubscribe;
  }, [navigation, shipmentId]);

  const fetchClientPhotos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('shipments')
        .select('client_vehicle_photos')
        .eq('id', shipmentId)
        .single();

      if (error) throw error;

      console.log('📦 Fetched shipment data:', JSON.stringify(data, null, 2));
      console.log('🖼️ Client vehicle photos:', (data as any)?.client_vehicle_photos);

      if (data && (data as any).client_vehicle_photos) {
        const photos = (data as any).client_vehicle_photos as ClientPhotos;
        console.log('✅ Client photos loaded:', JSON.stringify(photos, null, 2));
        
        // Check if there are actually any photos
        const totalPhotos = Object.values(photos).reduce((sum: number, arr: any) => sum + (arr?.length || 0), 0);
        console.log('📊 Total photos count:', totalPhotos);
        
        if (totalPhotos === 0) {
          Alert.alert(
            'No Reference Photos',
            'Client has not uploaded any vehicle photos yet. Verification cannot be performed.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
        
        setClientPhotos(photos);
      } else {
        // No client photos - can't verify
        Alert.alert(
          'No Reference Photos',
          'Client did not upload vehicle photos. Verification cannot be performed.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.error('Error fetching client photos:', error);
      Alert.alert('Error', 'Failed to load client photos. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getAllClientPhotos = () => {
    if (!clientPhotos) return [];
    
    const photos: { url: string; label: string; key: string }[] = [];
    CLIENT_PHOTO_ANGLES.forEach(angle => {
      const photoArray = clientPhotos[angle.key as keyof ClientPhotos];
      if (photoArray && photoArray.length > 0) {
        photoArray.forEach(url => {
          photos.push({ url, label: angle.label, key: angle.key });
        });
      }
    });
    return photos;
  };

  const viewPhoto = (index: number) => {
    const photos = getAllClientPhotos();
    console.log('📸 viewPhoto called - index:', index, 'total photos:', photos.length);
    if (photos[index]) {
      console.log('✅ Photo found:', photos[index].label, photos[index].url);
      setCurrentPhotoIndex(index);
      setSelectedPhotoUrl(photos[index].url);
      setShowPhotoModal(true);
    } else {
      console.warn('⚠️ Photo not found at index:', index);
    }
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    const photos = getAllClientPhotos();
    let newIndex = direction === 'next' ? currentPhotoIndex + 1 : currentPhotoIndex - 1;
    
    if (newIndex < 0) newIndex = photos.length - 1;
    if (newIndex >= photos.length) newIndex = 0;
    
    setCurrentPhotoIndex(newIndex);
    setSelectedPhotoUrl(photos[newIndex].url);
  };

  const handleVehicleMatches = async () => {
    Alert.alert(
      'Confirm Vehicle Match',
      'The vehicle matches the client photos?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            await submitVerification('matches', null, []);
          },
        },
      ]
    );
  };

  const handleReportIssues = () => {
    setReportingIssues(true);
  };

  const openCameraForIssue = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to document issues.');
        return;
      }
    }
    setCameraReady(false);
    setShowCamera(true);
  };

  const takePicture = async () => {
    if (!cameraRef.current || !cameraReady) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      if (photo && photo.uri) {
        const newPhoto: IssuePhoto = {
          id: Date.now().toString(),
          uri: photo.uri,
          description: '',
          timestamp: new Date().toISOString(),
        };
        setIssuePhotos(prev => [...prev, newPhoto]);
        setShowCamera(false);
        
        // Prompt for description
        setTimeout(() => {
          Alert.prompt(
            'Describe Issue',
            'What problem do you see in this photo?',
            [
              { text: 'Skip', style: 'cancel' },
              {
                text: 'Save',
                onPress: (text) => {
                  if (text) {
                    setIssuePhotos(prev =>
                      prev.map(p => p.id === newPhoto.id ? { ...p, description: text } : p)
                    );
                  }
                },
              },
            ],
            'plain-text'
          );
        }, 300);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  const pickImageFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newPhoto: IssuePhoto = {
        id: Date.now().toString(),
        uri: result.assets[0].uri,
        description: '',
        timestamp: new Date().toISOString(),
      };
      setIssuePhotos(prev => [...prev, newPhoto]);
    }
  };

  const deleteIssuePhoto = (id: string) => {
    setIssuePhotos(prev => prev.filter(p => p.id !== id));
  };

  const submitVerification = async (
    decision: 'matches' | 'minor_differences' | 'major_issues',
    notes: string | null,
    evidencePhotos: IssuePhoto[]
  ) => {
    try {
      setSubmitting(true);

      // Get location (with development mode skip)
      let location;
      
      if (SKIP_LOCATION_IN_DEV) {
        console.log('🔧 DEV MODE: Skipping real GPS, using mock location');
        setUsingMockLocation(true);
        location = {
          coords: {
            latitude: 37.7749,
            longitude: -122.4194,
            accuracy: 10,
          },
        };
      } else {
        // Production: Try to get real location
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            console.warn('⚠️ Location permission denied, using mock location');
            setUsingMockLocation(true);
            location = {
              coords: {
                latitude: 37.7749,
                longitude: -122.4194,
                accuracy: 10,
              },
            };
          } else {
            location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 5000, // 5 second timeout
            });
            setUsingMockLocation(false);
          }
        } catch (locationError) {
          console.warn('⚠️ Location fetch failed, using mock location:', locationError);
          setUsingMockLocation(true);
          location = {
            coords: {
              latitude: 37.7749,
              longitude: -122.4194,
              accuracy: 10,
            },
          };
        }
      }

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error('No auth token');

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

      // Step 2: Upload issue photos if any
      if (evidencePhotos.length > 0) {
        await Promise.all(evidencePhotos.map(async (photo) => {
          const filename = `${shipmentId}/${verificationId}/issue_${Date.now()}.jpg`;
          const base64 = await FileSystem.readAsStringAsync(photo.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          const byteCharacters = atob(base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const uint8Array = new Uint8Array(byteNumbers);

          const { error: uploadError } = await supabase
            .storage
            .from('verification-photos')
            .upload(filename, uint8Array, {
              contentType: 'image/jpeg',
              upsert: false,
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase
            .storage
            .from('verification-photos')
            .getPublicUrl(filename);

          // Register photo with backend
          await fetch(
            `https://drivedrop-main-production.up.railway.app/api/v1/shipments/${shipmentId}/verification-photos`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                verificationId,
                angle: 'issue_evidence',
                photoUrl: publicUrl,
                location: {
                  lat: location.coords.latitude,
                  lng: location.coords.longitude,
                },
              }),
            }
          );
        }));
      }

      // Step 3: Submit verification
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
            driverNotes: notes || undefined,
            differences: decision !== 'matches' ? (notes || 'Issues reported') : undefined,
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

      console.log('✅ Verification submitted successfully');
      
      // Mark verification as submitted to allow normal navigation
      verificationSubmittedRef.current = true;
      hasNavigatedAwayRef.current = true;

      // Use replace instead of navigate to prevent going back to verification
      navigation.replace('ShipmentDetails_Driver', {
        shipmentId,
        refreshTrigger: Date.now(),
      });

      setTimeout(() => {
        Alert.alert(
          'Verification Complete',
          decision === 'matches'
            ? 'Vehicle verified successfully! You can now proceed with pickup.'
            : 'Issues reported. Client will be notified.',
          [{ 
            text: 'OK',
            onPress: () => {
              // This will ensure the ShipmentDetails screen updates
              console.log('✅ Verification alert dismissed');
            }
          }]
        );
      }, 300);
    } catch (error) {
      console.error('Error submitting verification:', error);
      Alert.alert('Error', 'Failed to submit verification. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitIssues = () => {
    if (issuePhotos.length === 0) {
      Alert.alert('No Evidence', 'Please take at least one photo of the issues.');
      return;
    }

    Alert.alert(
      'Submit Issues Report',
      'This will notify the client about vehicle condition issues.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report Minor Issues',
          onPress: () => submitVerification('minor_differences', issueNotes, issuePhotos),
        },
        {
          text: 'Report Major Issues',
          style: 'destructive',
          onPress: () => submitVerification('major_issues', issueNotes, issuePhotos),
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading verification...</Text>
      </View>
    );
  }

  if (showCamera) {
    return (
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          onCameraReady={() => setCameraReady(true)}
        >
          <View style={styles.cameraHeader}>
            <TouchableOpacity onPress={() => setShowCamera(false)} style={styles.cameraCloseButton}>
              <MaterialIcons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Document Issue</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.cameraControls}>
            {!cameraReady && (
              <View style={styles.cameraLoading}>
                <ActivityIndicator size="large" color="#FFF" />
                <Text style={styles.cameraLoadingText}>Initializing camera...</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.captureButton, !cameraReady && styles.captureButtonDisabled]}
              onPress={takePicture}
              disabled={!cameraReady}
            >
              <View style={[styles.captureButtonInner, !cameraReady && styles.captureButtonInnerDisabled]} />
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  if (reportingIssues) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setReportingIssues(false)}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report Issues</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Mock Location Warning */}
        {SKIP_LOCATION_IN_DEV && (
          <View style={styles.mockLocationBanner}>
            <MaterialIcons name="developer-mode" size={16} color="#FF9800" />
            <Text style={styles.mockLocationText}>
              🔧 DEV MODE: GPS Disabled
            </Text>
          </View>
        )}

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Document Issues</Text>
            <Text style={styles.sectionDescription}>
              Take photos of any damage or discrepancies you notice
            </Text>

            <View style={styles.photoActions}>
              <TouchableOpacity style={styles.actionButtonLarge} onPress={openCameraForIssue}>
                <MaterialIcons name="camera-alt" size={24} color={Colors.primary} />
                <Text style={styles.actionButtonText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButtonLarge} onPress={pickImageFromGallery}>
                <MaterialIcons name="photo-library" size={24} color={Colors.primary} />
                <Text style={styles.actionButtonText}>Upload Photo</Text>
              </TouchableOpacity>
            </View>

            {issuePhotos.length > 0 && (
              <View style={styles.issuePhotosGrid}>
                {issuePhotos.map(photo => (
                  <View key={photo.id} style={styles.issuePhotoCard}>
                    <Image source={{ uri: photo.uri }} style={styles.issuePhotoImage} />
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => deleteIssuePhoto(photo.id)}
                    >
                      <MaterialIcons name="delete" size={18} color="#FFF" />
                    </TouchableOpacity>
                    {photo.description && (
                      <Text style={styles.issuePhotoDescription} numberOfLines={2}>
                        {photo.description}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Issue Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Describe the issues you found..."
              multiline
              numberOfLines={4}
              value={issueNotes}
              onChangeText={setIssueNotes}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, (issuePhotos.length === 0 || submitting) && styles.submitButtonDisabled]}
            onPress={handleSubmitIssues}
            disabled={issuePhotos.length === 0 || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <MaterialIcons name="report-problem" size={24} color="#FFF" />
                <Text style={styles.submitButtonText}>Submit Issues Report</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  const allPhotos = getAllClientPhotos();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Photo Modal */}
      <Modal
        visible={showPhotoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalNavigation}>
                <TouchableOpacity onPress={() => navigatePhoto('prev')} style={styles.modalNavButton}>
                  <MaterialIcons name="chevron-left" size={36} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>
                  {allPhotos[currentPhotoIndex]?.label}
                </Text>
                <TouchableOpacity onPress={() => navigatePhoto('next')} style={styles.modalNavButton}>
                  <MaterialIcons name="chevron-right" size={36} color="#FFF" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity 
                onPress={() => setShowPhotoModal(false)}
                style={styles.modalCloseButton}
              >
                <MaterialIcons name="close" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>
            <Image
              source={{ uri: selectedPhotoUrl }}
              style={styles.modalImage}
              resizeMode="contain"
            />
            <Text style={styles.modalCounter}>
              {currentPhotoIndex + 1} of {allPhotos.length}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          // If verification was submitted or we've navigated away, use goBack
          // Otherwise, navigate to ShipmentDetails with refresh
          if (verificationSubmittedRef.current || hasNavigatedAwayRef.current) {
            navigation.goBack();
          } else {
            navigation.navigate('ShipmentDetails_Driver', {
              shipmentId,
              refreshTrigger: Date.now(),
            });
          }
        }}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Pickup</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Mock Location Warning */}
      {SKIP_LOCATION_IN_DEV && (
        <View style={styles.mockLocationBanner}>
          <MaterialIcons name="developer-mode" size={16} color="#FF9800" />
          <Text style={styles.mockLocationText}>
            🔧 DEV MODE: GPS Disabled (Using Mock Location)
          </Text>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Instructions */}
        <View style={styles.instructionCard}>
          <MaterialIcons name="info-outline" size={24} color={Colors.primary} />
          <View style={styles.instructionContent}>
            <Text style={styles.instructionTitle}>Quick Verification</Text>
            <Text style={styles.instructionText}>
              Review the client's photos and compare with the actual vehicle. Only report issues if you notice discrepancies.
            </Text>
          </View>
        </View>

        {/* Client Photos Gallery */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client's Vehicle Photos</Text>
          <Text style={styles.sectionDescription}>Tap to view full size</Text>
          
          <View style={styles.photoGrid}>
            {allPhotos.map((photo, index) => (
              <TouchableOpacity
                key={index}
                style={styles.photoCard}
                onPress={() => viewPhoto(index)}
              >
                <Image source={{ uri: photo.url }} style={styles.photoThumbnail} />
                <Text style={styles.photoLabel}>{photo.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.buttonDisabled]}
            onPress={handleVehicleMatches}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <MaterialIcons name="check-circle" size={24} color="#FFF" />
                <Text style={styles.primaryButtonText}>Vehicle Matches</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, submitting && styles.buttonDisabled]}
            onPress={handleReportIssues}
            disabled={submitting}
          >
            <MaterialIcons name="report-problem" size={24} color={Colors.error} />
            <Text style={styles.secondaryButtonText}>Report Issues</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#F7F9FC',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  mockLocationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  mockLocationText: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  instructionCard: {
    flexDirection: 'row',
    backgroundColor: Colors.primary + '15',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  instructionContent: {
    flex: 1,
    marginLeft: 12,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  photoCard: {
    width: (width - 64) / 2,
    margin: 8,
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  photoThumbnail: {
    width: '100%',
    height: 120,
    backgroundColor: '#F0F0F0',
  },
  photoLabel: {
    padding: 8,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  actionsSection: {
    padding: 16,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.error,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButtonLarge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  issuePhotosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  issuePhotoCard: {
    width: (width - 64) / 2,
    margin: 8,
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  issuePhotoImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#F0F0F0',
  },
  issuePhotoDescription: {
    padding: 8,
    fontSize: 12,
    color: Colors.text.secondary,
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.error,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesInput: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: Colors.text.primary,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error,
    padding: 16,
    borderRadius: 12,
    margin: 16,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width,
    height: height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeader: {
    width: '100%',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'absolute',
    top: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
  },
  modalNavButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 20,
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 20,
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 16,
  },
  modalImage: {
    width: width,
    height: height * 0.7,
  },
  modalCounter: {
    position: 'absolute',
    bottom: 40,
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  // Camera styles
  camera: {
    flex: 1,
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  cameraCloseButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 8,
    borderRadius: 20,
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  cameraControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 32,
    alignItems: 'center',
  },
  cameraLoading: {
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
});
