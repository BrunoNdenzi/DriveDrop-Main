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

interface NotificationPreferences {
  shipmentUpdates: boolean;
  messages: boolean;
  promotions: boolean;
  driverAssigned: boolean;
  deliveryCompleted: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
}

export default function NotificationSettingsScreen({ navigation }: any) {
  const { userProfile } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    shipmentUpdates: true,
    messages: true,
    promotions: false,
    driverAssigned: true,
    deliveryCompleted: true,
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    if (!userProfile?.id) return;

    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userProfile.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        throw error;
      }

      if (data) {
        setPreferences({
          shipmentUpdates: data.shipment_updates ?? true,
          messages: data.messages ?? true,
          promotions: data.promotions ?? false,
          driverAssigned: data.driver_assigned ?? true,
          deliveryCompleted: data.delivery_completed ?? true,
          emailNotifications: data.email_notifications ?? true,
          smsNotifications: data.sms_notifications ?? false,
          pushNotifications: data.push_notifications ?? true,
        });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const savePreferences = async () => {
    if (!userProfile?.id) return;

    try {
      setSaving(true);

      const { data: existing } = await supabase
        .from('notification_preferences')
        .select('id')
        .eq('user_id', userProfile.id)
        .maybeSingle();

      let result;
      if (existing) {
        result = await supabase
          .from('notification_preferences')
          .update({
            shipment_updates: preferences.shipmentUpdates,
            messages: preferences.messages,
            promotions: preferences.promotions,
            driver_assigned: preferences.driverAssigned,
            delivery_completed: preferences.deliveryCompleted,
            email_notifications: preferences.emailNotifications,
            sms_notifications: preferences.smsNotifications,
            push_notifications: preferences.pushNotifications,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userProfile.id);
      } else {
        result = await supabase
          .from('notification_preferences')
          .insert({
            user_id: userProfile.id,
            shipment_updates: preferences.shipmentUpdates,
            messages: preferences.messages,
            promotions: preferences.promotions,
            driver_assigned: preferences.driverAssigned,
            delivery_completed: preferences.deliveryCompleted,
            email_notifications: preferences.emailNotifications,
            sms_notifications: preferences.smsNotifications,
            push_notifications: preferences.pushNotifications,
          });
      }

      if (result.error) {
        if (result.error.code === '42P01') {
          Alert.alert('Info', 'Notification preferences will be saved when the feature is fully enabled.');
          return;
        }
        throw result.error;
      }

      Alert.alert('Success', 'Notification preferences saved');
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
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
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={savePreferences}
          disabled={saving}
        >
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Push Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Channels</Text>
          <View style={styles.card}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="notifications-active" size={22} color={Colors.secondary} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>Push Notifications</Text>
                  <Text style={styles.settingDescription}>
                    Receive notifications on your device
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.pushNotifications}
                onValueChange={() => handleToggle('pushNotifications')}
                trackColor={{ false: Colors.text.disabled, true: Colors.secondary + '80' }}
                thumbColor={preferences.pushNotifications ? Colors.secondary : Colors.text.secondary}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="email" size={22} color={Colors.secondary} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>Email Notifications</Text>
                  <Text style={styles.settingDescription}>
                    Receive updates via email
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.emailNotifications}
                onValueChange={() => handleToggle('emailNotifications')}
                trackColor={{ false: Colors.text.disabled, true: Colors.secondary + '80' }}
                thumbColor={preferences.emailNotifications ? Colors.secondary : Colors.text.secondary}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="sms" size={22} color={Colors.secondary} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>SMS Notifications</Text>
                  <Text style={styles.settingDescription}>
                    Receive text messages for important updates
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.smsNotifications}
                onValueChange={() => handleToggle('smsNotifications')}
                trackColor={{ false: Colors.text.disabled, true: Colors.secondary + '80' }}
                thumbColor={preferences.smsNotifications ? Colors.secondary : Colors.text.secondary}
              />
            </View>
          </View>
        </View>

        {/* Shipment Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipment Updates</Text>
          <View style={styles.card}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="local-shipping" size={22} color={Colors.secondary} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>Shipment Status Updates</Text>
                  <Text style={styles.settingDescription}>
                    Get notified when shipment status changes
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.shipmentUpdates}
                onValueChange={() => handleToggle('shipmentUpdates')}
                trackColor={{ false: Colors.text.disabled, true: Colors.secondary + '80' }}
                thumbColor={preferences.shipmentUpdates ? Colors.secondary : Colors.text.secondary}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="person" size={22} color={Colors.secondary} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>Driver Assigned</Text>
                  <Text style={styles.settingDescription}>
                    When a driver is assigned to your shipment
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.driverAssigned}
                onValueChange={() => handleToggle('driverAssigned')}
                trackColor={{ false: Colors.text.disabled, true: Colors.secondary + '80' }}
                thumbColor={preferences.driverAssigned ? Colors.secondary : Colors.text.secondary}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="check-circle" size={22} color={Colors.secondary} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>Delivery Completed</Text>
                  <Text style={styles.settingDescription}>
                    When your shipment is delivered
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.deliveryCompleted}
                onValueChange={() => handleToggle('deliveryCompleted')}
                trackColor={{ false: Colors.text.disabled, true: Colors.secondary + '80' }}
                thumbColor={preferences.deliveryCompleted ? Colors.secondary : Colors.text.secondary}
              />
            </View>
          </View>
        </View>

        {/* Communication Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Communication</Text>
          <View style={styles.card}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="message" size={22} color={Colors.secondary} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>New Messages</Text>
                  <Text style={styles.settingDescription}>
                    When you receive a new message
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.messages}
                onValueChange={() => handleToggle('messages')}
                trackColor={{ false: Colors.text.disabled, true: Colors.secondary + '80' }}
                thumbColor={preferences.messages ? Colors.secondary : Colors.text.secondary}
              />
            </View>
          </View>
        </View>

        {/* Marketing Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Marketing</Text>
          <View style={styles.card}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="local-offer" size={22} color={Colors.secondary} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>Promotions & Offers</Text>
                  <Text style={styles.settingDescription}>
                    Receive special offers and discounts
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.promotions}
                onValueChange={() => handleToggle('promotions')}
                trackColor={{ false: Colors.text.disabled, true: Colors.secondary + '80' }}
                thumbColor={preferences.promotions ? Colors.secondary : Colors.text.secondary}
              />
            </View>
          </View>
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
});
