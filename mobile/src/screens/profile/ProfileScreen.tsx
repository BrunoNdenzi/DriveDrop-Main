import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  RefreshControl,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { Colors } from '../../constants/Colors';
import { RootStackParamList, ClientTabParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

type ProfileScreenProps = NativeStackScreenProps<ClientTabParamList, 'Profile'> & {
  navigation: NativeStackScreenProps<RootStackParamList>['navigation'];
};

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { userProfile, refreshProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    if (userProfile) {
      setEditForm({
        first_name: userProfile.first_name || '',
        last_name: userProfile.last_name || '',
        phone: userProfile.phone || '',
        email: userProfile.email || '',
      });
    }
  }, [userProfile]);

  const handleRefresh = () => {
    setRefreshing(true);
    refreshProfile().finally(() => setRefreshing(false));
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photos to upload a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!userProfile?.id) return;

    try {
      setUploadingAvatar(true);

      // Create form data for upload
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${userProfile.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // For React Native, we need to read the file as base64
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Create ArrayBuffer from blob using FileReader
      const reader = new FileReader();
      const arrayBufferPromise = new Promise<ArrayBuffer>((resolve, reject) => {
        reader.onloadend = () => {
          if (reader.result instanceof ArrayBuffer) {
            resolve(reader.result);
          } else {
            reject(new Error('Failed to read file'));
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      });

      const arrayBuffer = await arrayBufferPromise;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', userProfile.id);

      if (updateError) throw updateError;

      await refreshProfile();
      Alert.alert('Success', 'Profile picture updated successfully');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      Alert.alert('Error', error.message || 'Failed to upload profile picture');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!userProfile?.id) return;

    if (!editForm.first_name.trim() || !editForm.last_name.trim()) {
      Alert.alert('Validation Error', 'First name and last name are required');
      return;
    }

    try {
      setSavingProfile(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: editForm.first_name.trim(),
          last_name: editForm.last_name.trim(),
          phone: editForm.phone.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userProfile.id);

      if (error) throw error;

      await refreshProfile();
      setEditModalVisible(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const getUserInitial = () => {
    return userProfile?.first_name?.charAt(0).toUpperCase() || 'C';
  };

  const getUserName = () => {
    if (userProfile?.first_name && userProfile?.last_name) {
      return `${userProfile.first_name} ${userProfile.last_name}`;
    }
    return 'Not set';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => setEditModalVisible(true)}
        >
          <MaterialIcons name="edit" size={22} color={Colors.text.inverse} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={handlePickImage}
            disabled={uploadingAvatar}
          >
            {userProfile?.avatar_url ? (
              <Image source={{ uri: userProfile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{getUserInitial()}</Text>
              </View>
            )}
            <View style={styles.avatarEditButton}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={Colors.text.inverse} />
              ) : (
                <MaterialIcons name="camera-alt" size={16} color={Colors.text.inverse} />
              )}
            </View>
          </TouchableOpacity>

          <Text style={styles.profileName}>{getUserName()}</Text>
          <Text style={styles.profileEmail}>{userProfile?.email}</Text>

          <View style={styles.roleBadge}>
            <MaterialIcons name="person" size={14} color={Colors.primary} />
            <Text style={styles.roleBadgeText}>CLIENT</Text>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => setEditModalVisible(true)}
            >
              <MaterialIcons name="person" size={22} color={Colors.primary} />
              <Text style={styles.menuText}>Edit Profile</Text>
              <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation.navigate('Settings' as any)}
            >
              <MaterialIcons name="settings" size={22} color={Colors.primary} />
              <Text style={styles.menuText}>Settings</Text>
              <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                // Navigate to payment methods screen
                Alert.alert('Coming Soon', 'Payment methods management will be available soon');
              }}
            >
              <MaterialIcons name="payment" size={22} color={Colors.primary} />
              <Text style={styles.menuText}>Payment Methods</Text>
              <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support & Legal</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                Linking.openURL('https://drivedrop.com/help');
              }}
            >
              <MaterialIcons name="help-outline" size={22} color={Colors.primary} />
              <Text style={styles.menuText}>Help Center</Text>
              <MaterialIcons name="open-in-new" size={18} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                Linking.openURL('mailto:support@drivedrop.com');
              }}
            >
              <MaterialIcons name="email" size={22} color={Colors.primary} />
              <Text style={styles.menuText}>Contact Support</Text>
              <MaterialIcons name="open-in-new" size={18} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                Linking.openURL('https://drivedrop.com/terms');
              }}
            >
              <MaterialIcons name="description" size={22} color={Colors.primary} />
              <Text style={styles.menuText}>Terms of Service</Text>
              <MaterialIcons name="open-in-new" size={18} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                Linking.openURL('https://drivedrop.com/privacy');
              }}
            >
              <MaterialIcons name="privacy-tip" size={22} color={Colors.primary} />
              <Text style={styles.menuText}>Privacy Policy</Text>
              <MaterialIcons name="open-in-new" size={18} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Admin Section - Only for admins */}
        {userProfile?.role === 'admin' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin Functions</Text>
            <View style={styles.menuCard}>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => navigation.navigate('AdminDashboard' as any)}
              >
                <MaterialIcons name="dashboard" size={22} color={Colors.primary} />
                <Text style={styles.menuText}>Admin Dashboard</Text>
                <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => navigation.navigate('AdminAssignment' as any)}
              >
                <MaterialIcons name="assignment" size={22} color={Colors.primary} />
                <Text style={styles.menuText}>Driver Assignment</Text>
                <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <MaterialIcons name="logout" size={22} color={Colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.versionText}>DriveDrop v1.0.0</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setEditModalVisible(false)}
              disabled={savingProfile}
            >
              <Text style={[styles.modalCancelText, savingProfile && { opacity: 0.5 }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity 
              onPress={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.modalSaveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>First Name</Text>
              <TextInput
                style={styles.input}
                value={editForm.first_name}
                onChangeText={(text) => setEditForm({ ...editForm, first_name: text })}
                placeholder="Enter first name"
                placeholderTextColor={Colors.text.disabled}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={editForm.last_name}
                onChangeText={(text) => setEditForm({ ...editForm, last_name: text })}
                placeholder="Enter last name"
                placeholderTextColor={Colors.text.disabled}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={editForm.phone}
                onChangeText={(text) => setEditForm({ ...editForm, phone: text })}
                placeholder="Enter phone number"
                placeholderTextColor={Colors.text.disabled}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={editForm.email}
                editable={false}
                placeholder="Email cannot be changed"
                placeholderTextColor={Colors.text.disabled}
              />
              <Text style={styles.inputHint}>
                Email address cannot be changed. Contact support if you need to update it.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  headerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.border,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.surface,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  statsCard: {
    backgroundColor: Colors.surface,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 16,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
    marginLeft: 16,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
    marginLeft: 12,
  },
  versionText: {
    fontSize: 12,
    color: Colors.text.disabled,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  modalCancelText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text.primary,
  },
  inputDisabled: {
    backgroundColor: Colors.background,
    color: Colors.text.disabled,
  },
  inputHint: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 6,
  },
});
