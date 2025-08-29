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
  TextInput,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/types';

interface DriverStats {
  completedJobs: number;
  activeJobs: number;
  totalEarnings: number;
  averageRating: number;
  onTimeRate: number;
}

interface DriverSettings {
  availableForJobs: boolean;
  notificationsEnabled: boolean;
  preferredRadius: number;
  allowLocationTracking: boolean;
  preferredJobTypes: string[];
}

export default function DriverProfileScreen({ navigation }: any) {
  const { userProfile, refreshProfile } = useAuth();
  const [stats, setStats] = useState<DriverStats>({
    completedJobs: 0,
    activeJobs: 0,
    totalEarnings: 0,
    averageRating: 0,
    onTimeRate: 0,
  });
  const [settings, setSettings] = useState<DriverSettings>({
    availableForJobs: true,
    notificationsEnabled: true,
    preferredRadius: 50,
    allowLocationTracking: true,
    preferredJobTypes: ['standard', 'express'],
  });
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (userProfile) {
      fetchDriverData();
      fetchDriverSettings();
    }
  }, [userProfile]);

  const fetchDriverData = async () => {
    try {
      setLoading(true);

      // Fetch completed jobs count
      const { count: completedJobs } = await supabase
        .from('shipments')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', userProfile?.id)
        .eq('status', 'delivered');

      // Fetch active jobs count
      const { count: activeJobs } = await supabase
        .from('shipments')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', userProfile?.id)
        .in('status', ['accepted', 'picked_up', 'in_transit']);

      // Fetch total earnings
      const { data: earnings } = await supabase
        .from('shipments')
        .select('price')
        .eq('driver_id', userProfile?.id)
        .eq('status', 'delivered');

      const totalEarnings =
        earnings?.reduce((sum, job) => sum + (job.price || 0), 0) || 0;

      // Fetch ratings
      const { data: ratings } = await supabase
        .from('driver_ratings')
        .select('rating')
        .eq('driver_id', userProfile?.id);

      const averageRating =
        ratings && ratings.length > 0
          ? ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length
          : 0;

      // Calculate on-time rate (simplified for now)
      const onTimeRate = 100; // This would be calculated based on delivery times vs. promised times

      setStats({
        completedJobs: completedJobs || 0,
        activeJobs: activeJobs || 0,
        totalEarnings,
        averageRating,
        onTimeRate,
      });
    } catch (error) {
      console.error('Error fetching driver data:', error);
      Alert.alert(
        'Error',
        'Failed to load your profile data. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchDriverSettings = async () => {
    try {
      // Check if driver_settings table exists by attempting to count records
      const { count, error: countError } = await supabase
        .from('driver_settings')
        .select('*', { count: 'exact', head: true });

      // If the table doesn't exist, we'll get a specific error
      if (countError && countError.code === '42P01') {
        console.log(
          'Driver settings table does not exist yet, using default settings'
        );
        // We'll continue with the default settings
        return;
      }

      // Fetch driver settings from driver_settings table
      const { data, error } = await supabase
        .from('driver_settings')
        .select('*')
        .eq('driver_id', userProfile?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          availableForJobs: data.available_for_jobs,
          notificationsEnabled: data.notifications_enabled,
          preferredRadius: data.preferred_radius || 50,
          allowLocationTracking: data.allow_location_tracking,
          preferredJobTypes: data.preferred_job_types || [
            'standard',
            'express',
          ],
        });
      }
    } catch (error) {
      console.error('Error fetching driver settings:', error);
      // Continue with default settings if there's an error
    }
  };

  const saveDriverSettings = async () => {
    if (!userProfile) return;

    try {
      setSavingSettings(true);

      // Check if settings exist first
      const { data: existingSettings, error: checkError } = await supabase
        .from('driver_settings')
        .select('id')
        .eq('driver_id', userProfile.id)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      let result;

      if (existingSettings) {
        // Update existing settings
        result = await supabase
          .from('driver_settings')
          .update({
            available_for_jobs: settings.availableForJobs,
            notifications_enabled: settings.notificationsEnabled,
            preferred_radius: settings.preferredRadius,
            allow_location_tracking: settings.allowLocationTracking,
            preferred_job_types: settings.preferredJobTypes,
            updated_at: new Date().toISOString(),
          })
          .eq('driver_id', userProfile.id);
      } else {
        // Insert new settings
        result = await supabase.from('driver_settings').insert({
          driver_id: userProfile.id,
          available_for_jobs: settings.availableForJobs,
          notifications_enabled: settings.notificationsEnabled,
          preferred_radius: settings.preferredRadius,
          allow_location_tracking: settings.allowLocationTracking,
          preferred_job_types: settings.preferredJobTypes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      const { error } = result;

      if (error) {
        // If the table doesn't exist, show a specific message
        if (error.code === '42P01') {
          Alert.alert(
            'Settings Not Available',
            'Driver settings are not yet available. Please contact support.',
            [{ text: 'OK' }]
          );
        } else {
          throw error;
        }
        return;
      }

      Alert.alert('Success', 'Your settings have been saved.');
    } catch (error) {
      console.error('Error saving driver settings:', error);
      Alert.alert('Error', 'Failed to save your settings. Please try again.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const handleToggleAvailability = (value: boolean) => {
    setSettings(prev => ({ ...prev, availableForJobs: value }));
    // Save immediately when toggling availability
    setTimeout(() => {
      saveDriverSettings();
    }, 100);
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    });
  };

  if (loading && !userProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Driver Profile</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {userProfile?.avatar_url ? (
              <Image
                source={{ uri: userProfile.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {userProfile?.first_name?.charAt(0)?.toUpperCase() || 'D'}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.editAvatarButton}>
              <MaterialIcons
                name="edit"
                size={16}
                color={Colors.text.inverse}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.profileName}>
            {userProfile?.first_name} {userProfile?.last_name}
          </Text>

          <View style={styles.profileBadge}>
            <MaterialIcons name="verified" size={16} color={Colors.secondary} />
            <Text style={styles.profileBadgeText}>Verified Driver</Text>
          </View>

          <View style={styles.profileStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.completedJobs}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {stats.averageRating.toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.onTimeRate}%</Text>
              <Text style={styles.statLabel}>On-time</Text>
            </View>
          </View>
        </View>

        {/* Availability Toggle */}
        <View style={styles.availabilityCard}>
          <View style={styles.availabilityHeader}>
            <MaterialIcons
              name={
                settings.availableForJobs ? 'check-circle' : 'do-not-disturb'
              }
              size={24}
              color={
                settings.availableForJobs
                  ? Colors.success
                  : Colors.text.disabled
              }
            />
            <Text style={styles.availabilityTitle}>
              {settings.availableForJobs
                ? 'Available for Jobs'
                : 'Not Available'}
            </Text>
          </View>
          <Text style={styles.availabilityDescription}>
            {settings.availableForJobs
              ? "You're currently visible to clients and can receive new job requests."
              : "You're currently not receiving any new job requests."}
          </Text>
          <Switch
            value={settings.availableForJobs}
            onValueChange={handleToggleAvailability}
            trackColor={{
              false: Colors.text.disabled,
              true: Colors.success + '80',
            }}
            thumbColor={
              settings.availableForJobs ? Colors.success : Colors.text.secondary
            }
            ios_backgroundColor={Colors.text.disabled}
            style={styles.availabilitySwitch}
          />
        </View>

        {/* Earnings Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earnings Summary</Text>
          <View style={styles.earningsCard}>
            <Text style={styles.earningsTotal}>
              {formatCurrency(stats.totalEarnings)}
            </Text>
            <Text style={styles.earningsLabel}>Total Earnings</Text>
            <TouchableOpacity style={styles.earningsButton}>
              <MaterialIcons
                name="account-balance-wallet"
                size={16}
                color={Colors.primary}
              />
              <Text style={styles.earningsButtonText}>
                View Earnings History
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Driver Settings</Text>

          <View style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingLabelContainer}>
                <MaterialIcons
                  name="notifications"
                  size={20}
                  color={Colors.primary}
                />
                <Text style={styles.settingLabel}>Push Notifications</Text>
              </View>
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={value =>
                  setSettings(prev => ({
                    ...prev,
                    notificationsEnabled: value,
                  }))
                }
                trackColor={{
                  false: Colors.text.disabled,
                  true: Colors.primary + '80',
                }}
                thumbColor={
                  settings.notificationsEnabled
                    ? Colors.primary
                    : Colors.text.secondary
                }
                ios_backgroundColor={Colors.text.disabled}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLabelContainer}>
                <MaterialIcons name="place" size={20} color={Colors.primary} />
                <Text style={styles.settingLabel}>Allow Location Tracking</Text>
              </View>
              <Switch
                value={settings.allowLocationTracking}
                onValueChange={value =>
                  setSettings(prev => ({
                    ...prev,
                    allowLocationTracking: value,
                  }))
                }
                trackColor={{
                  false: Colors.text.disabled,
                  true: Colors.primary + '80',
                }}
                thumbColor={
                  settings.allowLocationTracking
                    ? Colors.primary
                    : Colors.text.secondary
                }
                ios_backgroundColor={Colors.text.disabled}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLabelContainer}>
                <MaterialIcons
                  name="explore"
                  size={20}
                  color={Colors.primary}
                />
                <Text style={styles.settingLabel}>Preferred Job Radius</Text>
              </View>
              <View style={styles.radiusInputContainer}>
                <TextInput
                  style={styles.radiusInput}
                  value={settings.preferredRadius.toString()}
                  onChangeText={value => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                      setSettings(prev => ({ ...prev, preferredRadius: num }));
                    } else if (value === '') {
                      setSettings(prev => ({ ...prev, preferredRadius: 0 }));
                    }
                  }}
                  keyboardType="number-pad"
                />
                <Text style={styles.radiusUnit}>miles</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={saveDriverSettings}
              disabled={savingSettings}
            >
              {savingSettings ? (
                <ActivityIndicator size="small" color={Colors.text.inverse} />
              ) : (
                <Text style={styles.saveButtonText}>Save Settings</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <View style={styles.optionsCard}>
            <TouchableOpacity style={styles.optionItem}>
              <MaterialIcons name="person" size={20} color={Colors.primary} />
              <Text style={styles.optionText}>Edit Profile</Text>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={Colors.text.secondary}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem}>
              <MaterialIcons name="security" size={20} color={Colors.primary} />
              <Text style={styles.optionText}>Security & Privacy</Text>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={Colors.text.secondary}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem}>
              <MaterialIcons name="help" size={20} color={Colors.primary} />
              <Text style={styles.optionText}>Help & Support</Text>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={Colors.text.secondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => navigation.navigate('NetworkDiagnostic')}
            >
              <MaterialIcons
                name="wifi-tethering"
                size={20}
                color={Colors.primary}
              />
              <Text style={styles.optionText}>Network Diagnostics</Text>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={Colors.text.secondary}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem} onPress={handleSignOut}>
              <MaterialIcons name="logout" size={20} color={Colors.error} />
              <Text style={[styles.optionText, { color: Colors.error }]}>
                Sign Out
              </Text>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={Colors.text.secondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Admin Assignment Option - Only shown to admin users */}
        {userProfile?.role === 'admin' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin Functions</Text>
            <View style={styles.settingsCard}>
              <TouchableOpacity
                style={styles.adminButton}
                onPress={() => navigation.navigate('AdminDashboard')}
              >
                <MaterialIcons
                  name="dashboard"
                  size={20}
                  color={Colors.primary}
                />
                <Text style={styles.adminButtonText}>Admin Dashboard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.adminButton, { marginTop: 12 }]}
                onPress={() => navigation.navigate('AdminAssignment')}
              >
                <MaterialIcons
                  name="assignment"
                  size={20}
                  color={Colors.primary}
                />
                <Text style={styles.adminButtonText}>Driver Assignment</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Version */}
        <Text style={styles.versionText}>DriveDrop v1.0.0</Text>

        {/* Bottom padding for scroll */}
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
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text.inverse,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  profileBadge: {
    flexDirection: 'row',
    backgroundColor: Colors.secondary + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  profileBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondary,
    marginLeft: 4,
  },
  profileStats: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: Colors.border,
  },
  availabilityCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  availabilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  availabilityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 12,
  },
  availabilityDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 36,
    marginBottom: 12,
  },
  availabilitySwitch: {
    alignSelf: 'flex-start',
    marginLeft: 36,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  earningsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  earningsTotal: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  earningsLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  earningsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  earningsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 8,
  },
  settingsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 14,
    color: Colors.text.primary,
    marginLeft: 12,
  },
  radiusInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radiusInput: {
    backgroundColor: Colors.background,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    width: 60,
    textAlign: 'center',
  },
  radiusUnit: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: Colors.text.inverse,
    fontWeight: '600',
    fontSize: 14,
  },
  optionsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginLeft: 12,
    flex: 1,
  },
  adminButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  adminButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  versionText: {
    fontSize: 12,
    color: Colors.text.disabled,
    textAlign: 'center',
    marginTop: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.primary,
  },
});
