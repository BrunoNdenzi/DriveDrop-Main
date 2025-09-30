import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  emergencyContact: string;
  emergencyPhone: string;
  address: string;
  dateOfBirth: string;
}

export default function EditProfileScreen({ navigation }: any) {
  const { userProfile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    emergencyContact: '',
    emergencyPhone: '',
    address: '',
    dateOfBirth: '',
  });

  useEffect(() => {
    if (userProfile) {
      setFormData({
        firstName: userProfile.first_name || '',
        lastName: userProfile.last_name || '',
        email: userProfile.email || '',
        phoneNumber: userProfile.phone || '', // Use phone instead of phone_number
        emergencyContact: '', // These properties don't exist in UserProfile yet
        emergencyPhone: '',
        address: '',
        dateOfBirth: '',
      });
    }
  }, [userProfile]);

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert(
          'Permission Required',
          'Permission to access photo library is required to update your profile picture.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadImage = async (imageUri: string) => {
    if (!userProfile) return;

    try {
      setUploadingImage(true);

      // Create a unique filename with user folder structure
      const fileName = `${userProfile.id}/avatar_${Date.now()}.jpg`;
      
      // Read the image as array buffer for React Native compatibility
      const response = await fetch(imageUri);
      const arrayBuffer = await response.arrayBuffer();

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true, // Allow overwriting existing files
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      // Update user profile with the new avatar URL
      const { error: updateError } = await (supabase as any)
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', userProfile.id);

      if (updateError) throw updateError;

      // Refresh the profile to get updated data
      await refreshProfile();

      Alert.alert('Success', 'Profile picture updated successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', `Failed to upload image: ${(error as any)?.message || 'Please try again.'}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.firstName.trim()) {
      Alert.alert('Validation Error', 'First name is required.');
      return false;
    }
    if (!formData.lastName.trim()) {
      Alert.alert('Validation Error', 'Last name is required.');
      return false;
    }
    if (!formData.email.trim()) {
      Alert.alert('Validation Error', 'Email is required.');
      return false;
    }
    if (!formData.phoneNumber.trim()) {
      Alert.alert('Validation Error', 'Phone number is required.');
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return false;
    }

    // Phone number validation (basic)
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    if (!phoneRegex.test(formData.phoneNumber)) {
      Alert.alert('Validation Error', 'Please enter a valid phone number.');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!userProfile || !validateForm()) return;

    try {
      setSaving(true);

      // Update only the fields that exist in the profiles table
      const { error } = await (supabase as any)
        .from('profiles')
        .update({
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          phone: formData.phoneNumber.trim(), // Use 'phone' field from profiles table
          updated_at: new Date().toISOString(),
        })
        .eq('id', userProfile.id);

      if (error) throw error;

      // Refresh the profile to get updated data
      await refreshProfile();

      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text.inverse} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.text.inverse} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Picture Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            {userProfile?.avatar_url ? (
              <Image source={{ uri: userProfile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {userProfile?.first_name?.charAt(0)?.toUpperCase() || 'D'}
                </Text>
              </View>
            )}
            {uploadingImage && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="small" color={Colors.text.inverse} />
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.changePhotoButton} onPress={pickImage} disabled={uploadingImage}>
            <MaterialIcons name="camera-alt" size={16} color={Colors.primary} />
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>First Name</Text>
            <TextInput
              style={styles.input}
              value={formData.firstName}
              onChangeText={(text) => setFormData(prev => ({ ...prev, firstName: text }))}
              placeholder="Enter your first name"
              placeholderTextColor={Colors.text.disabled}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={formData.lastName}
              onChangeText={(text) => setFormData(prev => ({ ...prev, lastName: text }))}
              placeholder="Enter your last name"
              placeholderTextColor={Colors.text.disabled}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={[styles.input, { color: Colors.text.disabled }]}
              value={formData.email}
              placeholder="Email address"
              placeholderTextColor={Colors.text.disabled}
              editable={false}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.inputNote}>Email cannot be changed</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={formData.phoneNumber}
              onChangeText={(text) => setFormData(prev => ({ ...prev, phoneNumber: text }))}
              placeholder="Enter your phone number"
              placeholderTextColor={Colors.text.disabled}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Date of Birth</Text>
            <TextInput
              style={styles.input}
              value={formData.dateOfBirth}
              onChangeText={(text) => setFormData(prev => ({ ...prev, dateOfBirth: text }))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.text.disabled}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.address}
              onChangeText={(text) => setFormData(prev => ({ ...prev, address: text }))}
              placeholder="Enter your address"
              placeholderTextColor={Colors.text.disabled}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Emergency Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Contact Name</Text>
            <TextInput
              style={styles.input}
              value={formData.emergencyContact}
              onChangeText={(text) => setFormData(prev => ({ ...prev, emergencyContact: text }))}
              placeholder="Emergency contact name"
              placeholderTextColor={Colors.text.disabled}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Contact Phone</Text>
            <TextInput
              style={styles.input}
              value={formData.emergencyPhone}
              onChangeText={(text) => setFormData(prev => ({ ...prev, emergencyPhone: text }))}
              placeholder="Emergency contact phone"
              placeholderTextColor={Colors.text.disabled}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Bottom padding */}
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
    backgroundColor: Colors.secondary,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.inverse,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.primary,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonText: {
    color: Colors.text.inverse,
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  changePhotoText: {
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputNote: {
    fontSize: 12,
    color: Colors.text.disabled,
    marginTop: 4,
  },
});