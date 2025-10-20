import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  Switch,
  RefreshControl,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface DriverStats {
  completedJobs: number;
  activeJobs: number;
  totalEarnings: number;
  averageRating: number;
  onTimeRate: number;
  totalRatings: number;
}

interface DriverSettings {
  availableForJobs: boolean;
  notificationsEnabled: boolean;
  preferredRadius: number;
  allowLocationTracking: boolean;
}

export default function DriverProfileScreen({ navigation }: any) {
  const { userProfile, refreshProfile, signOut } = useAuth();
  const [stats, setStats] = useState<DriverStats>({
    completedJobs: 0,
    activeJobs: 0,
    totalEarnings: 0,
    averageRating: 0,
    onTimeRate: 100,
    totalRatings: 0,
  });
  const [settings, setSettings] = useState<DriverSettings>({
    availableForJobs: true,
    notificationsEnabled: true,
    preferredRadius: 50,
    allowLocationTracking: true,
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
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
      fetchDriverData();
      fetchDriverSettings();
      setEditForm({
        first_name: userProfile.first_name || '',
        last_name: userProfile.last_name || '',
        phone: userProfile.phone || '',
        email: userProfile.email || '',
      });
    }
  }, [userProfile]);

  const fetchDriverData = async () => {
    if (!userProfile?.id) return;

    try {
      setLoading(true);
      
      // Fetch completed jobs
      const { count: completedJobs } = await supabase
        .from('shipments')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', userProfile.id)
        .eq('status', 'delivered');
      
      // Fetch active jobs
      const { count: activeJobs } = await supabase
        .from('shipments')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', userProfile.id)
        .in('status', ['accepted', 'picked_up', 'in_transit']);
      
      // Fetch total earnings from completed shipments
      const { data: earnings } = await supabase
        .from('shipments')
        .select('estimated_price')
        .eq('driver_id', userProfile.id)
        .eq('status', 'delivered');
      
      const totalEarnings = earnings?.reduce((sum, job) => sum + (job.estimated_price || 0), 0) || 0;
      
      // Fetch ratings
      const { data: ratings } = await supabase
        .from('driver_ratings')
        .select('rating')
        .eq('driver_id', userProfile.id);
      
      const totalRatings = ratings?.length || 0;
      const averageRating = totalRatings > 0 && ratings
        ? ratings.reduce((sum, item) => sum + item.rating, 0) / totalRatings
        : 0;
      
      setStats({
        completedJobs: completedJobs || 0,
        activeJobs: activeJobs || 0,
        totalEarnings,
        averageRating,
        onTimeRate: 100,
        totalRatings,
      });
    } catch (error) {
      console.error('Error fetching driver data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchDriverSettings = async () => {
    if (!userProfile?.id) return;

    try {
      const { data, error } = await supabase
        .from('driver_settings')
        .select('*')
        .eq('driver_id', userProfile.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        throw error;
      }
      
      if (data) {
        setSettings({
          availableForJobs: data.available_for_jobs ?? true,
          notificationsEnabled: data.notifications_enabled ?? true,
          preferredRadius: data.preferred_radius || 50,
          allowLocationTracking: data.allow_location_tracking ?? true,
        });
      }
    } catch (error) {
      console.error('Error fetching driver settings:', error);
    }
  };

  const saveDriverSettings = async () => {
    if (!userProfile?.id) return;
    
    try {
      setSavingSettings(true);
      
      const { data: existing } = await supabase
        .from('driver_settings')
        .select('id')
        .eq('driver_id', userProfile.id)
        .maybeSingle();
      
      let result;
      if (existing) {
        result = await supabase
          .from('driver_settings')
          .update({
            available_for_jobs: settings.availableForJobs,
            notifications_enabled: settings.notificationsEnabled,
            preferred_radius: settings.preferredRadius,
            allow_location_tracking: settings.allowLocationTracking,
            updated_at: new Date().toISOString(),
          })
          .eq('driver_id', userProfile.id);
      } else {
        result = await supabase
          .from('driver_settings')
          .insert({
            driver_id: userProfile.id,
            available_for_jobs: settings.availableForJobs,
            notifications_enabled: settings.notificationsEnabled,
            preferred_radius: settings.preferredRadius,
            allow_location_tracking: settings.allowLocationTracking,
          });
      }
      
      if (result.error) {
        if (result.error.code === '42P01') {
          Alert.alert('Info', 'Driver settings feature is coming soon.');
          return;
        }
        throw result.error;
      }
      
      Alert.alert('Success', 'Settings saved successfully');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleAvailability = async (value: boolean) => {
    if (!userProfile?.id) return;
    
    setSettings(prev => ({ ...prev, availableForJobs: value }));
    
    // Auto-save availability
    try {
      const { data: existing } = await supabase
        .from('driver_settings')
        .select('id')
        .eq('driver_id', userProfile.id)
        .maybeSingle();
      
      if (existing) {
        await supabase
          .from('driver_settings')
          .update({ available_for_jobs: value })
          .eq('driver_id', userProfile.id);
      } else {
        await supabase
          .from('driver_settings')
          .insert({
            driver_id: userProfile.id,
            available_for_jobs: value,
            notifications_enabled: true,
            preferred_radius: 50,
            allow_location_tracking: true,
          });
      }
    } catch (error) {
      console.error('Error updating availability:', error);
    }
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photos.');
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

      const { data: urlData } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

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

  const handleRefresh = () => {
    setRefreshing(true);
    refreshProfile();
    fetchDriverData();
    fetchDriverSettings();
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

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    });
  };

  const getUserInitial = () => {
    return userProfile?.first_name?.charAt(0).toUpperCase() || 'D';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Driver Profile</Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.secondary} />
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

          <Text style={styles.profileName}>
            {userProfile?.first_name} {userProfile?.last_name}
          </Text>

          <View style={styles.verifiedBadge}>
            <MaterialIcons name="verified" size={16} color={Colors.secondary} />
            <Text style={styles.verifiedText}>Verified Driver</Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.completedJobs}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <View style={styles.ratingContainer}>
                <MaterialIcons name="star" size={20} color={Colors.warning} />
                <Text style={styles.statValue}>{stats.averageRating.toFixed(1)}</Text>
              </View>
              <Text style={styles.statLabel}>{stats.totalRatings} ratings</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.onTimeRate}%</Text>
              <Text style={styles.statLabel}>On-time</Text>
            </View>
          </View>
        </View>

        {/* Availability Toggle */}
        <View style={styles.availabilityCard}>
          <View style={styles.availabilityHeader}>
            <View style={styles.availabilityLeft}>
              <MaterialIcons 
                name={settings.availableForJobs ? "check-circle" : "do-not-disturb"}
                size={28} 
                color={settings.availableForJobs ? Colors.success : Colors.text.disabled} 
              />
              <View style={styles.availabilityTextContainer}>
                <Text style={styles.availabilityTitle}>
                  {settings.availableForJobs ? "Available for Jobs" : "Not Available"}
                </Text>
                <Text style={styles.availabilitySubtext}>
                  {settings.availableForJobs 
                    ? "You'll receive new job requests" 
                    : "Not receiving any new jobs"}
                </Text>
              </View>
            </View>
            <Switch
              value={settings.availableForJobs}
              onValueChange={handleToggleAvailability}
              trackColor={{ false: Colors.text.disabled, true: Colors.success + '80' }}
              thumbColor={settings.availableForJobs ? Colors.success : Colors.text.secondary}
              ios_backgroundColor={Colors.text.disabled}
            />
          </View>
        </View>

        {/* Earnings Card */}
        <View style={styles.earningsCard}>
          <View style={styles.earningsHeader}>
            <Text style={styles.sectionTitle}>Total Earnings</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.earningsAmount}>{formatCurrency(stats.totalEarnings)}</Text>
          <View style={styles.earningsDetails}>
            <View style={styles.earningsDetailItem}>
              <MaterialIcons name="local-shipping" size={18} color={Colors.text.secondary} />
              <Text style={styles.earningsDetailText}>{stats.activeJobs} Active Jobs</Text>
            </View>
            <View style={styles.earningsDetailItem}>
              <MaterialIcons name="account-balance-wallet" size={18} color={Colors.text.secondary} />
              <Text style={styles.earningsDetailText}>Payout every Friday</Text>
            </View>
          </View>
        </View>

        {/* Driver Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Driver Settings</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="notifications" size={22} color={Colors.secondary} />
                <Text style={styles.settingLabel}>Push Notifications</Text>
              </View>
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={(value) => setSettings(prev => ({ ...prev, notificationsEnabled: value }))}
                trackColor={{ false: Colors.text.disabled, true: Colors.secondary + '80' }}
                thumbColor={settings.notificationsEnabled ? Colors.secondary : Colors.text.secondary}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="my-location" size={22} color={Colors.secondary} />
                <Text style={styles.settingLabel}>Location Tracking</Text>
              </View>
              <Switch
                value={settings.allowLocationTracking}
                onValueChange={(value) => setSettings(prev => ({ ...prev, allowLocationTracking: value }))}
                trackColor={{ false: Colors.text.disabled, true: Colors.secondary + '80' }}
                thumbColor={settings.allowLocationTracking ? Colors.secondary : Colors.text.secondary}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="explore" size={22} color={Colors.secondary} />
                <Text style={styles.settingLabel}>Job Radius (miles)</Text>
              </View>
              <View style={styles.radiusControls}>
                <TextInput
                  style={styles.radiusInput}
                  value={settings.preferredRadius.toString()}
                  onChangeText={(value) => {
                    const num = parseInt(value) || 0;
                    setSettings(prev => ({ ...prev, preferredRadius: num }));
                  }}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={styles.radiusLabel}>mi</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.saveSettingsButton}
              onPress={saveDriverSettings}
              disabled={savingSettings}
            >
              {savingSettings ? (
                <ActivityIndicator size="small" color={Colors.text.inverse} />
              ) : (
                <>
                  <MaterialIcons name="save" size={20} color={Colors.text.inverse} />
                  <Text style={styles.saveSettingsText}>Save Settings</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem}>
              <MaterialIcons name="directions-car" size={22} color={Colors.secondary} />
              <Text style={styles.menuText}>Vehicle Information</Text>
              <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <MaterialIcons name="description" size={22} color={Colors.secondary} />
              <Text style={styles.menuText}>Documents & Licenses</Text>
              <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <MaterialIcons name="payment" size={22} color={Colors.secondary} />
              <Text style={styles.menuText}>Payout Methods</Text>
              <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation.navigate('Settings')}
            >
              <MaterialIcons name="settings" size={22} color={Colors.secondary} />
              <Text style={styles.menuText}>Settings</Text>
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
              onPress={() => Linking.openURL('https://drivedrop.com/driver-help')}
            >
              <MaterialIcons name="help-outline" size={22} color={Colors.secondary} />
              <Text style={styles.menuText}>Driver Help Center</Text>
              <MaterialIcons name="open-in-new" size={18} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => Linking.openURL('mailto:driver-support@drivedrop.com')}
            >
              <MaterialIcons name="email" size={22} color={Colors.secondary} />
              <Text style={styles.menuText}>Contact Support</Text>
              <MaterialIcons name="open-in-new" size={18} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => Linking.openURL('https://drivedrop.com/driver-terms')}
            >
              <MaterialIcons name="description" size={22} color={Colors.secondary} />
              <Text style={styles.menuText}>Driver Terms</Text>
              <MaterialIcons name="open-in-new" size={18} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Admin Section */}
        {userProfile?.role === 'admin' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin Functions</Text>
            <View style={styles.menuCard}>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => navigation.navigate('AdminDashboard')}
              >
                <MaterialIcons name="dashboard" size={22} color={Colors.primary} />
                <Text style={styles.menuText}>Admin Dashboard</Text>
                <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => navigation.navigate('AdminAssignment')}
              >
                <MaterialIcons name="assignment" size={22} color={Colors.primary} />
                <Text style={styles.menuText}>Driver Assignment</Text>
                <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <MaterialIcons name="logout" size={22} color={Colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

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
                <ActivityIndicator size="small" color={Colors.secondary} />
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
                placeholderTextColor={Colors.text.disabled}
              />
              <Text style={styles.inputHint}>
                Email cannot be changed. Contact support if needed.
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
    backgroundColor: Colors.secondary,
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
    backgroundColor: Colors.secondary,
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
    backgroundColor: Colors.secondary,
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
    marginBottom: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 20,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondary,
    marginLeft: 6,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginLeft: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  availabilityCard: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 16,
  },
  availabilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availabilityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  availabilityTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  availabilityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  availabilitySubtext: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  earningsCard: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 16,
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  earningsAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.secondary,
    marginBottom: 16,
  },
  earningsDetails: {
    gap: 12,
  },
  earningsDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  earningsDetailText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 12,
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
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.secondary,
  },
  settingsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    color: Colors.text.primary,
    marginLeft: 16,
  },
  radiusControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radiusInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: 60,
    textAlign: 'center',
    fontSize: 16,
    color: Colors.text.primary,
  },
  radiusLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 8,
  },
  saveSettingsButton: {
    backgroundColor: Colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 16,
  },
  saveSettingsText: {
    color: Colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
    color: Colors.secondary,
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
