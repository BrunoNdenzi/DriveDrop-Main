import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';

interface NotificationSettings {
  email_notifications: boolean;
  push_notifications: boolean;
  sms_notifications: boolean;
  marketing_emails: boolean;
  quote_notifications: boolean;
  shipment_updates: boolean;
  promotional_offers: boolean;
  preferred_communication: 'email' | 'sms' | 'push';
}

export default function NotificationSettingsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>({
    email_notifications: true,
    push_notifications: true,
    sms_notifications: false,
    marketing_emails: false,
    quote_notifications: true,
    shipment_updates: true,
    promotional_offers: false,
    preferred_communication: 'email',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('client_settings')
        .select('*')
        .eq('client_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which is fine for new users
        throw error;
      }

      if (data) {
        setSettings({
          email_notifications: (data as any).email_notifications,
          push_notifications: (data as any).push_notifications,
          sms_notifications: (data as any).sms_notifications,
          marketing_emails: (data as any).marketing_emails,
          quote_notifications: (data as any).quote_notifications,
          shipment_updates: (data as any).shipment_updates,
          promotional_offers: (data as any).promotional_offers,
          preferred_communication: (data as any).preferred_communication,
        });
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      Alert.alert('Error', 'Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: NotificationSettings) => {
    if (!user?.id) return;
    
    setSaving(true);
    try {
      const settingsData = {
        ...newSettings,
        client_id: user.id,
      };

      const { error } = await (supabase as any)
        .from('client_settings')
        .upsert(settingsData, { onConflict: 'client_id' });

      if (error) throw error;

      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving notification settings:', error);
      Alert.alert('Error', 'Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof NotificationSettings, value: boolean | string) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  const SettingRow = ({
    icon,
    title,
    subtitle,
    value,
    onToggle,
    type = 'switch',
    options,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    value: boolean | string;
    onToggle: (value: boolean | string) => void;
    type?: 'switch' | 'select';
    options?: Array<{ label: string; value: string }>;
  }) => (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Ionicons name={icon as any} size={24} color="#007AFF" style={styles.settingIcon} />
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {type === 'switch' ? (
        <Switch
          value={value as boolean}
          onValueChange={onToggle}
          trackColor={{ false: '#e9ecef', true: '#007AFF' }}
          thumbColor="#fff"
          disabled={saving}
        />
      ) : (
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => {
            if (options) {
              Alert.alert(
                'Select Option',
                title,
                [
                  { text: 'Cancel', style: 'cancel' },
                  ...options.map((option) => ({
                    text: option.label,
                    onPress: () => onToggle(option.value),
                  })),
                ]
              );
            }
          }}
        >
          <Text style={styles.selectButtonText}>
            {options?.find((opt) => opt.value === value)?.label || value}
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading notification settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* General Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General Notifications</Text>
          
          <SettingRow
            icon="mail"
            title="Email Notifications"
            subtitle="Receive updates via email"
            value={settings.email_notifications}
            onToggle={(value) => updateSetting('email_notifications', value)}
          />
          
          <SettingRow
            icon="notifications"
            title="Push Notifications"
            subtitle="Receive push notifications on your device"
            value={settings.push_notifications}
            onToggle={(value) => updateSetting('push_notifications', value)}
          />
          
          <SettingRow
            icon="chatbubble"
            title="SMS Notifications"
            subtitle="Receive text messages for important updates"
            value={settings.sms_notifications}
            onToggle={(value) => updateSetting('sms_notifications', value)}
          />
        </View>

        {/* Shipment Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipment Notifications</Text>
          
          <SettingRow
            icon="document-text"
            title="Quote Notifications"
            subtitle="Get notified when you receive new quotes"
            value={settings.quote_notifications}
            onToggle={(value) => updateSetting('quote_notifications', value)}
          />
          
          <SettingRow
            icon="location"
            title="Shipment Updates"
            subtitle="Receive updates about your shipment status"
            value={settings.shipment_updates}
            onToggle={(value) => updateSetting('shipment_updates', value)}
          />
        </View>

        {/* Marketing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Marketing & Promotions</Text>
          
          <SettingRow
            icon="megaphone"
            title="Marketing Emails"
            subtitle="Receive newsletters and product updates"
            value={settings.marketing_emails}
            onToggle={(value) => updateSetting('marketing_emails', value)}
          />
          
          <SettingRow
            icon="gift"
            title="Promotional Offers"
            subtitle="Get notified about special deals and discounts"
            value={settings.promotional_offers}
            onToggle={(value) => updateSetting('promotional_offers', value)}
          />
        </View>

        {/* Communication Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Communication Preferences</Text>
          
          <SettingRow
            icon="settings"
            title="Preferred Communication"
            subtitle="How would you like to receive important updates?"
            value={settings.preferred_communication}
            onToggle={(value) => updateSetting('preferred_communication', value)}
            type="select"
            options={[
              { label: 'Email', value: 'email' },
              { label: 'SMS', value: 'sms' },
              { label: 'Push Notifications', value: 'push' },
            ]}
          />
        </View>

        {/* App Permissions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Permissions</Text>
          <TouchableOpacity style={styles.permissionButton}>
            <Ionicons name="settings-outline" size={24} color="#007AFF" />
            <View style={styles.permissionText}>
              <Text style={styles.permissionTitle}>Notification Permissions</Text>
              <Text style={styles.permissionSubtitle}>
                Manage app-level notification permissions
              </Text>
            </View>
            <Ionicons name="open-outline" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Help Text */}
        <View style={styles.helpSection}>
          <Ionicons name="information-circle" size={20} color="#666" />
          <Text style={styles.helpText}>
            You can customize how and when you receive notifications. Changes are saved automatically.
          </Text>
        </View>

        {saving && (
          <View style={styles.savingIndicator}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.savingText}>Saving...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  section: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginLeft: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 1,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
  },
  selectButtonText: {
    fontSize: 14,
    color: '#333',
    marginRight: 8,
    textTransform: 'capitalize',
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  permissionText: {
    flex: 1,
    marginLeft: 12,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  permissionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  helpSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
  savingIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  savingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
});