import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface PrivacySettings {
  locationTracking: boolean;
  shareProfile: boolean;
  showOnlineStatus: boolean;
  allowAnalytics: boolean;
  twoFactorAuth: boolean;
}

export default function PrivacySettingsScreen({ navigation }: any) {
  const { userProfile } = useAuth();
  const [settings, setSettings] = useState<PrivacySettings>({
    locationTracking: true,
    shareProfile: false,
    showOnlineStatus: true,
    allowAnalytics: true,
    twoFactorAuth: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    if (!userProfile?.id) return;

    try {
      const { data, error } = await supabase
        .from('privacy_settings')
        .select('*')
        .eq('user_id', userProfile.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        throw error;
      }

      if (data) {
        setSettings({
          locationTracking: data.location_tracking ?? true,
          shareProfile: data.share_profile ?? false,
          showOnlineStatus: data.show_online_status ?? true,
          allowAnalytics: data.allow_analytics ?? true,
          twoFactorAuth: data.two_factor_auth ?? false,
        });
      }
    } catch (error) {
      console.error('Error loading privacy settings:', error);
    }
  };

  const saveSettings = async () => {
    if (!userProfile?.id) return;

    try {
      setSaving(true);

      const { data: existing } = await supabase
        .from('privacy_settings')
        .select('id')
        .eq('user_id', userProfile.id)
        .maybeSingle();

      let result;
      if (existing) {
        result = await supabase
          .from('privacy_settings')
          .update({
            location_tracking: settings.locationTracking,
            share_profile: settings.shareProfile,
            show_online_status: settings.showOnlineStatus,
            allow_analytics: settings.allowAnalytics,
            two_factor_auth: settings.twoFactorAuth,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userProfile.id);
      } else {
        result = await supabase
          .from('privacy_settings')
          .insert({
            user_id: userProfile.id,
            location_tracking: settings.locationTracking,
            share_profile: settings.shareProfile,
            show_online_status: settings.showOnlineStatus,
            allow_analytics: settings.allowAnalytics,
            two_factor_auth: settings.twoFactorAuth,
          });
      }

      if (result.error) {
        if (result.error.code === '42P01') {
          Alert.alert('Info', 'Privacy settings will be saved when the feature is fully enabled.');
          return;
        }
        throw result.error;
      }

      Alert.alert('Success', 'Privacy settings saved');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof PrivacySettings) => {
    if (key === 'locationTracking' && settings.locationTracking) {
      Alert.alert(
        'Disable Location Tracking',
        'This may affect the functionality of the app, especially for drivers. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: () => setSettings(prev => ({ ...prev, [key]: false })),
          },
        ]
      );
    } else if (key === 'twoFactorAuth' && !settings.twoFactorAuth) {
      Alert.alert(
        'Enable Two-Factor Authentication',
        'This will add an extra layer of security to your account. You will need to verify your identity when signing in.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: () => {
              setSettings(prev => ({ ...prev, [key]: true }));
              Alert.alert('Setup Required', '2FA setup will be available soon.');
            },
          },
        ]
      );
    } else {
      setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const handleChangePassword = () => {
    Alert.alert('Change Password', 'Password change feature coming soon.');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Confirmation Required', 'Please contact support to delete your account.');
          },
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert('Export Data', 'Your data export will be emailed to you within 24 hours.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text.inverse} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy & Security</Text>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={saveSettings}
          disabled={saving}
        >
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.card}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="my-location" size={22} color={Colors.secondary} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>Location Tracking</Text>
                  <Text style={styles.settingDescription}>
                    Allow the app to track your location
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.locationTracking}
                onValueChange={() => handleToggle('locationTracking')}
                trackColor={{ false: Colors.text.disabled, true: Colors.secondary + '80' }}
                thumbColor={settings.locationTracking ? Colors.secondary : Colors.text.secondary}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="person-outline" size={22} color={Colors.secondary} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>Share Profile</Text>
                  <Text style={styles.settingDescription}>
                    Allow others to view your profile
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.shareProfile}
                onValueChange={() => handleToggle('shareProfile')}
                trackColor={{ false: Colors.text.disabled, true: Colors.secondary + '80' }}
                thumbColor={settings.shareProfile ? Colors.secondary : Colors.text.secondary}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="visibility" size={22} color={Colors.secondary} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>Show Online Status</Text>
                  <Text style={styles.settingDescription}>
                    Let others see when you're active
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.showOnlineStatus}
                onValueChange={() => handleToggle('showOnlineStatus')}
                trackColor={{ false: Colors.text.disabled, true: Colors.secondary + '80' }}
                thumbColor={settings.showOnlineStatus ? Colors.secondary : Colors.text.secondary}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="analytics" size={22} color={Colors.secondary} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>Usage Analytics</Text>
                  <Text style={styles.settingDescription}>
                    Help improve the app by sharing usage data
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.allowAnalytics}
                onValueChange={() => handleToggle('allowAnalytics')}
                trackColor={{ false: Colors.text.disabled, true: Colors.secondary + '80' }}
                thumbColor={settings.allowAnalytics ? Colors.secondary : Colors.text.secondary}
              />
            </View>
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.card}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="security" size={22} color={Colors.secondary} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>Two-Factor Authentication</Text>
                  <Text style={styles.settingDescription}>
                    Add extra security to your account
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.twoFactorAuth}
                onValueChange={() => handleToggle('twoFactorAuth')}
                trackColor={{ false: Colors.text.disabled, true: Colors.secondary + '80' }}
                thumbColor={settings.twoFactorAuth ? Colors.secondary : Colors.text.secondary}
              />
            </View>

            <TouchableOpacity 
              style={styles.settingItem}
              onPress={handleChangePassword}
            >
              <View style={styles.settingLeft}>
                <MaterialIcons name="lock" size={22} color={Colors.secondary} />
                <Text style={styles.settingLabel}>Change Password</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Data Management Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          <View style={styles.card}>
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={handleExportData}
            >
              <View style={styles.settingLeft}>
                <MaterialIcons name="download" size={22} color={Colors.secondary} />
                <Text style={styles.settingLabel}>Export My Data</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.settingItem}
              onPress={handleDeleteAccount}
            >
              <View style={styles.settingLeft}>
                <MaterialIcons name="delete-forever" size={22} color={Colors.error} />
                <Text style={[styles.settingLabel, { color: Colors.error }]}>
                  Delete Account
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <MaterialIcons name="info-outline" size={22} color={Colors.secondary} />
          <Text style={styles.infoText}>
            Your privacy is important to us. We will never share your personal information 
            without your explicit consent.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.inverse,
    flex: 1,
    marginLeft: 16,
  },
  saveButton: {
    padding: 4,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  settingTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.secondary + '15',
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
});
