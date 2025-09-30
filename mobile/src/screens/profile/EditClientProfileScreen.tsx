import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';

type EditClientProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'EditClientProfile'>;

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

export default function EditClientProfileScreen({ navigation }: EditClientProfileScreenProps) {
  const { userProfile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
  });

  useEffect(() => {
    if (userProfile) {
      setFormData({
        firstName: userProfile.first_name || '',
        lastName: userProfile.last_name || '',
        email: userProfile.email || '',
        phone: userProfile.phone || '',
        company: (userProfile as any).company || '',
        address: (userProfile as any).address || '',
        city: (userProfile as any).city || '',
        state: (userProfile as any).state || '',
        zipCode: (userProfile as any).zip_code || '',
      });
    }
  }, [userProfile]);

  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadProfileImage = async (imageUri: string) => {
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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm() || !userProfile) return;

    try {
      setLoading(true);

      const { error } = await (supabase as any)
        .from('profiles')
        .update({
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          company: formData.company.trim(),
          address: formData.address.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          zip_code: formData.zipCode.trim(),
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
      setLoading(false);
    }
  };

  const getUserInitial = () => {
    if (userProfile?.first_name) {
      return userProfile.first_name.charAt(0).toUpperCase();
    }
    return 'C';
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
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.text.inverse} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Picture Section */}
        <View style={styles.imageSection}>
          <TouchableOpacity 
            style={styles.imageContainer}
            onPress={handleImagePicker}
            disabled={uploadingImage}
          >
            {userProfile?.avatar_url ? (
              <Image source={{ uri: userProfile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getUserInitial()}</Text>
              </View>
            )}
            <View style={styles.cameraIcon}>
              {uploadingImage ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <MaterialIcons name="camera-alt" size={20} color={Colors.primary} />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.imageHint}>Tap to change profile picture</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.row}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>First Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.firstName}
                onChangeText={(text) => setFormData(prev => ({ ...prev, firstName: text }))}
                placeholder="Enter first name"
                placeholderTextColor={Colors.text.disabled}
              />
            </View>
            <View style={[styles.inputContainer, { flex: 1, marginLeft: 10 }]}>
              <Text style={styles.label}>Last Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.lastName}
                onChangeText={(text) => setFormData(prev => ({ ...prev, lastName: text }))}
                placeholder="Enter last name"
                placeholderTextColor={Colors.text.disabled}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address *</Text>
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
              placeholder="Enter email address"
              placeholderTextColor={Colors.text.disabled}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
              placeholder="Enter phone number"
              placeholderTextColor={Colors.text.disabled}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Company</Text>
            <TextInput
              style={styles.input}
              value={formData.company}
              onChangeText={(text) => setFormData(prev => ({ ...prev, company: text }))}
              placeholder="Enter company name"
              placeholderTextColor={Colors.text.disabled}
            />
          </View>
        </View>

        {/* Address Section */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Address Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Street Address</Text>
            <TextInput
              style={styles.input}
              value={formData.address}
              onChangeText={(text) => setFormData(prev => ({ ...prev, address: text }))}
              placeholder="Enter street address"
              placeholderTextColor={Colors.text.disabled}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputContainer, { flex: 2, marginRight: 8 }]}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={formData.city}
                onChangeText={(text) => setFormData(prev => ({ ...prev, city: text }))}
                placeholder="Enter city"
                placeholderTextColor={Colors.text.disabled}
              />
            </View>
            <View style={[styles.inputContainer, { flex: 1, marginHorizontal: 6 }]}>
              <Text style={styles.label}>State</Text>
              <TextInput
                style={styles.input}
                value={formData.state}
                onChangeText={(text) => setFormData(prev => ({ ...prev, state: text }))}
                placeholder="State"
                placeholderTextColor={Colors.text.disabled}
              />
            </View>
            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>ZIP Code</Text>
              <TextInput
                style={styles.input}
                value={formData.zipCode}
                onChangeText={(text) => setFormData(prev => ({ ...prev, zipCode: text }))}
                placeholder="ZIP"
                placeholderTextColor={Colors.text.disabled}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>
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
    backgroundColor: Colors.primary,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.inverse,
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    padding: 8,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  content: {
    flex: 1,
  },
  imageSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: Colors.surface,
  },
  imageContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  imageHint: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.text.secondary,
  },
  formSection: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text.primary,
    backgroundColor: Colors.surface,
  },
});