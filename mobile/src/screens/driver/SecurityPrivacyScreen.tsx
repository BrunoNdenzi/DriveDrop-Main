import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';

interface SecuritySettings {
  twoFactorEnabled: boolean;
  biometricEnabled: boolean;
  locationSharingEnabled: boolean;
  dataAnalyticsEnabled: boolean;
  marketingEmailsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  emergencyContactsEnabled: boolean;
  tripHistoryVisibility: 'private' | 'limited' | 'public';
  profileVisibility: 'private' | 'limited' | 'public';
}

interface PrivacyPreferences {
  shareLocationWithCustomers: boolean;
  sharePhoneWithCustomers: boolean;
  allowRatingAndReviews: boolean;
  dataRetentionPeriod: '1year' | '2years' | '5years' | 'indefinite';
}

export default function SecurityPrivacyScreen({ navigation }: any) {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    biometricEnabled: false,
    locationSharingEnabled: true,
    dataAnalyticsEnabled: true,
    marketingEmailsEnabled: false,
    pushNotificationsEnabled: true,
    emergencyContactsEnabled: true,
    tripHistoryVisibility: 'limited',
    profileVisibility: 'limited',
  });

  const [privacyPreferences, setPrivacyPreferences] = useState<PrivacyPreferences>({
    shareLocationWithCustomers: true,
    sharePhoneWithCustomers: false,
    allowRatingAndReviews: true,
    dataRetentionPeriod: '2years',
  });

  useEffect(() => {
    fetchSecuritySettings();
  }, []);

  const fetchSecuritySettings = async () => {
    if (!userProfile) return;

    try {
      setLoading(true);

      // Fetch driver security settings
      const { data: securityData, error: securityError } = await (supabase as any)
        .from('driver_security_settings')
        .select('*')
        .eq('driver_id', userProfile.id)
        .maybeSingle();

      if (securityError && securityError.code !== 'PGRST116' && securityError.code !== '42P01') {
        throw securityError;
      }

      if (securityData) {
        setSecuritySettings({
          twoFactorEnabled: (securityData as any).two_factor_enabled || false,
          biometricEnabled: (securityData as any).biometric_enabled || false,
          locationSharingEnabled: (securityData as any).location_sharing_enabled !== false,
          dataAnalyticsEnabled: (securityData as any).data_analytics_enabled !== false,
          marketingEmailsEnabled: (securityData as any).marketing_emails_enabled || false,
          pushNotificationsEnabled: (securityData as any).push_notifications_enabled !== false,
          emergencyContactsEnabled: (securityData as any).emergency_contacts_enabled !== false,
          tripHistoryVisibility: (securityData as any).trip_history_visibility || 'limited',
          profileVisibility: (securityData as any).profile_visibility || 'limited',
        });
      }

      // Fetch privacy preferences
      const { data: privacyData, error: privacyError } = await (supabase as any)
        .from('driver_privacy_preferences')
        .select('*')
        .eq('driver_id', userProfile.id)
        .maybeSingle();

      if (privacyError && privacyError.code !== 'PGRST116' && privacyError.code !== '42P01') {
        throw privacyError;
      }

      if (privacyData) {
        setPrivacyPreferences({
          shareLocationWithCustomers: (privacyData as any).share_location_with_customers !== false,
          sharePhoneWithCustomers: (privacyData as any).share_phone_with_customers || false,
          allowRatingAndReviews: (privacyData as any).allow_rating_and_reviews !== false,
          dataRetentionPeriod: (privacyData as any).data_retention_period || '2years',
        });
      }

    } catch (error) {
      console.error('Error fetching security settings:', error);
      // Don't show error if tables don't exist yet
      if ((error as any)?.code !== '42P01') {
        Alert.alert('Info', 'Security settings will be available after database setup is complete.');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveSecuritySettings = async () => {
    if (!userProfile) return;

    try {
      setSaving(true);

      // Save security settings
      const { error: securityError } = await (supabase as any)
        .from('driver_security_settings')
        .upsert({
          driver_id: userProfile.id,
          two_factor_enabled: securitySettings.twoFactorEnabled,
          biometric_enabled: securitySettings.biometricEnabled,
          location_sharing_enabled: securitySettings.locationSharingEnabled,
          data_analytics_enabled: securitySettings.dataAnalyticsEnabled,
          marketing_emails_enabled: securitySettings.marketingEmailsEnabled,
          push_notifications_enabled: securitySettings.pushNotificationsEnabled,
          emergency_contacts_enabled: securitySettings.emergencyContactsEnabled,
          trip_history_visibility: securitySettings.tripHistoryVisibility,
          profile_visibility: securitySettings.profileVisibility,
          updated_at: new Date().toISOString(),
        });

      if (securityError && securityError.code !== '42P01') {
        throw securityError;
      }

      // Save privacy preferences
      const { error: privacyError } = await (supabase as any)
        .from('driver_privacy_preferences')
        .upsert({
          driver_id: userProfile.id,
          share_location_with_customers: privacyPreferences.shareLocationWithCustomers,
          share_phone_with_customers: privacyPreferences.sharePhoneWithCustomers,
          allow_rating_and_reviews: privacyPreferences.allowRatingAndReviews,
          data_retention_period: privacyPreferences.dataRetentionPeriod,
          updated_at: new Date().toISOString(),
        });

      if (privacyError && privacyError.code !== '42P01') {
        throw privacyError;
      }

      Alert.alert('Success', 'Your security and privacy settings have been saved.');

    } catch (error) {
      console.error('Error saving security settings:', error);
      Alert.alert('Error', 'Failed to save settings. Some features may not be available yet.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters long.');
      return;
    }

    try {
      setChangingPassword(true);

      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) throw error;

      Alert.alert('Success', 'Your password has been updated successfully.', [
        { text: 'OK', onPress: () => setShowPasswordModal(false) }
      ]);

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

    } catch (error) {
      console.error('Error changing password:', error);
      Alert.alert('Error', 'Failed to update password. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and will permanently remove all your data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Account Deletion',
              'Please contact support to proceed with account deletion. This ensures proper handling of any pending deliveries and earnings.',
              [
                { text: 'OK' }
              ]
            );
          }
        }
      ]
    );
  };

  const updateSecuritySetting = (key: keyof SecuritySettings, value: any) => {
    setSecuritySettings(prev => ({ ...prev, [key]: value }));
  };

  const updatePrivacySetting = (key: keyof PrivacyPreferences, value: any) => {
    setPrivacyPreferences(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading security settings...</Text>
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>Security & Privacy</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={saveSecuritySettings}
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
        {/* Account Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Security</Text>
          
          <TouchableOpacity style={styles.settingItem} onPress={() => setShowPasswordModal(true)}>
            <View style={styles.settingLabelContainer}>
              <MaterialIcons name="lock" size={20} color={Colors.primary} />
              <Text style={styles.settingLabel}>Change Password</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>

          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <MaterialIcons name="security" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.settingLabel}>Two-Factor Authentication</Text>
                <Text style={styles.settingDescription}>Add extra security to your account</Text>
              </View>
            </View>
            <Switch
              value={securitySettings.twoFactorEnabled}
              onValueChange={(value) => updateSecuritySetting('twoFactorEnabled', value)}
              trackColor={{ false: Colors.text.disabled, true: Colors.primary + '80' }}
              thumbColor={securitySettings.twoFactorEnabled ? Colors.primary : Colors.text.secondary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <MaterialIcons name="fingerprint" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.settingLabel}>Biometric Login</Text>
                <Text style={styles.settingDescription}>Use fingerprint or face ID</Text>
              </View>
            </View>
            <Switch
              value={securitySettings.biometricEnabled}
              onValueChange={(value) => updateSecuritySetting('biometricEnabled', value)}
              trackColor={{ false: Colors.text.disabled, true: Colors.primary + '80' }}
              thumbColor={securitySettings.biometricEnabled ? Colors.primary : Colors.text.secondary}
            />
          </View>
        </View>

        {/* Privacy Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy Settings</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <MaterialIcons name="place" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.settingLabel}>Share Location with Customers</Text>
                <Text style={styles.settingDescription}>Allow customers to track delivery progress</Text>
              </View>
            </View>
            <Switch
              value={privacyPreferences.shareLocationWithCustomers}
              onValueChange={(value) => updatePrivacySetting('shareLocationWithCustomers', value)}
              trackColor={{ false: Colors.text.disabled, true: Colors.primary + '80' }}
              thumbColor={privacyPreferences.shareLocationWithCustomers ? Colors.primary : Colors.text.secondary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <MaterialIcons name="phone" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.settingLabel}>Share Phone with Customers</Text>
                <Text style={styles.settingDescription}>Allow customers to call you directly</Text>
              </View>
            </View>
            <Switch
              value={privacyPreferences.sharePhoneWithCustomers}
              onValueChange={(value) => updatePrivacySetting('sharePhoneWithCustomers', value)}
              trackColor={{ false: Colors.text.disabled, true: Colors.primary + '80' }}
              thumbColor={privacyPreferences.sharePhoneWithCustomers ? Colors.primary : Colors.text.secondary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <MaterialIcons name="star" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.settingLabel}>Allow Ratings & Reviews</Text>
                <Text style={styles.settingDescription}>Let customers rate and review your service</Text>
              </View>
            </View>
            <Switch
              value={privacyPreferences.allowRatingAndReviews}
              onValueChange={(value) => updatePrivacySetting('allowRatingAndReviews', value)}
              trackColor={{ false: Colors.text.disabled, true: Colors.primary + '80' }}
              thumbColor={privacyPreferences.allowRatingAndReviews ? Colors.primary : Colors.text.secondary}
            />
          </View>
        </View>

        {/* Data & Analytics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Analytics</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <MaterialIcons name="analytics" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.settingLabel}>Analytics & Performance Data</Text>
                <Text style={styles.settingDescription}>Help improve app performance</Text>
              </View>
            </View>
            <Switch
              value={securitySettings.dataAnalyticsEnabled}
              onValueChange={(value) => updateSecuritySetting('dataAnalyticsEnabled', value)}
              trackColor={{ false: Colors.text.disabled, true: Colors.primary + '80' }}
              thumbColor={securitySettings.dataAnalyticsEnabled ? Colors.primary : Colors.text.secondary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <MaterialIcons name="location-on" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.settingLabel}>Location Data Sharing</Text>
                <Text style={styles.settingDescription}>Share location data for service improvement</Text>
              </View>
            </View>
            <Switch
              value={securitySettings.locationSharingEnabled}
              onValueChange={(value) => updateSecuritySetting('locationSharingEnabled', value)}
              trackColor={{ false: Colors.text.disabled, true: Colors.primary + '80' }}
              thumbColor={securitySettings.locationSharingEnabled ? Colors.primary : Colors.text.secondary}
            />
          </View>
        </View>

        {/* Communication Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Communication</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <MaterialIcons name="notifications" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDescription}>Receive job alerts and updates</Text>
              </View>
            </View>
            <Switch
              value={securitySettings.pushNotificationsEnabled}
              onValueChange={(value) => updateSecuritySetting('pushNotificationsEnabled', value)}
              trackColor={{ false: Colors.text.disabled, true: Colors.primary + '80' }}
              thumbColor={securitySettings.pushNotificationsEnabled ? Colors.primary : Colors.text.secondary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <MaterialIcons name="email" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.settingLabel}>Marketing Emails</Text>
                <Text style={styles.settingDescription}>Receive promotional offers and updates</Text>
              </View>
            </View>
            <Switch
              value={securitySettings.marketingEmailsEnabled}
              onValueChange={(value) => updateSecuritySetting('marketingEmailsEnabled', value)}
              trackColor={{ false: Colors.text.disabled, true: Colors.primary + '80' }}
              thumbColor={securitySettings.marketingEmailsEnabled ? Colors.primary : Colors.text.secondary}
            />
          </View>
        </View>

        {/* Emergency */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency & Safety</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <MaterialIcons name="emergency" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.settingLabel}>Emergency Contacts</Text>
                <Text style={styles.settingDescription}>Allow emergency contact access</Text>
              </View>
            </View>
            <Switch
              value={securitySettings.emergencyContactsEnabled}
              onValueChange={(value) => updateSecuritySetting('emergencyContactsEnabled', value)}
              trackColor={{ false: Colors.text.disabled, true: Colors.primary + '80' }}
              thumbColor={securitySettings.emergencyContactsEnabled ? Colors.primary : Colors.text.secondary}
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerSection}>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          
          <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteAccount}>
            <MaterialIcons name="delete-forever" size={20} color={Colors.error} />
            <Text style={styles.dangerButtonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowPasswordModal(false)}
            >
              <MaterialIcons name="close" size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TouchableOpacity
              style={styles.modalSubmitButton}
              onPress={handleChangePassword}
              disabled={changingPassword}
            >
              {changingPassword ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.modalSubmitText}>Update</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Current Password</Text>
              <TextInput
                style={styles.formInput}
                value={passwordForm.currentPassword}
                onChangeText={(text) => setPasswordForm(prev => ({ ...prev, currentPassword: text }))}
                placeholder="Enter your current password"
                placeholderTextColor={Colors.text.disabled}
                secureTextEntry
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>New Password</Text>
              <TextInput
                style={styles.formInput}
                value={passwordForm.newPassword}
                onChangeText={(text) => setPasswordForm(prev => ({ ...prev, newPassword: text }))}
                placeholder="Enter your new password"
                placeholderTextColor={Colors.text.disabled}
                secureTextEntry
              />
              <Text style={styles.formHint}>Password must be at least 8 characters long</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.formInput}
                value={passwordForm.confirmPassword}
                onChangeText={(text) => setPasswordForm(prev => ({ ...prev, confirmPassword: text }))}
                placeholder="Confirm your new password"
                placeholderTextColor={Colors.text.disabled}
                secureTextEntry
              />
            </View>
          </View>
        </View>
      </Modal>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginLeft: 12,
  },
  settingDescription: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: 12,
    marginTop: 2,
  },
  dangerSection: {
    backgroundColor: Colors.error + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
    marginBottom: 12,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  dangerButtonText: {
    fontSize: 14,
    color: Colors.error,
    marginLeft: 8,
    fontWeight: '500',
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
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  modalSubmitButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  modalSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formHint: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
});