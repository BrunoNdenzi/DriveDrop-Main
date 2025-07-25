// src/screens/SettingsScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text, Switch, Divider, Button } from '@rneui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { NotificationPreferences } from '../services/NotificationService';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';

export default function SettingsScreen() {
  const { preferences, updatePreferences, hasPermission, requestPermissions, sendTestNotification } = useNotifications();
  const { user } = useAuth();
  const auth = useAuth(); // Get the full auth object
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [saving, setSaving] = useState(false);
  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences>({
    pushEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
    shipmentUpdates: true,
    driverAssigned: true,
    paymentUpdates: true,
    promotions: false,
  });

  // Load preferences
  useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  const handleToggle = (key: keyof NotificationPreferences) => {
    setLocalPrefs({
      ...localPrefs,
      [key]: !localPrefs[key],
    });
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      await updatePreferences(localPrefs);
      Alert.alert('Success', 'Your notification preferences have been saved.');
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'Failed to save notification preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              // The auth context will handle navigation
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text h4 style={styles.title}>Settings</Text>
        
        <View style={styles.section}>
          <Text h4 style={styles.sectionTitle}>Notification Preferences</Text>
          
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Push Notifications</Text>
              <Text style={styles.toggleSubtitle}>
                {hasPermission 
                  ? 'Receive notifications on this device' 
                  : 'Push notifications are disabled'
                }
              </Text>
            </View>
            <Switch
              value={hasPermission && localPrefs.pushEnabled}
              onValueChange={() => {
                if (!hasPermission) {
                  requestPermissions();
                } else {
                  handleToggle('pushEnabled');
                }
              }}
            />
          </View>
          
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Email Notifications</Text>
              <Text style={styles.toggleSubtitle}>Receive notifications via email</Text>
            </View>
            <Switch
              value={localPrefs.emailEnabled}
              onValueChange={() => handleToggle('emailEnabled')}
            />
          </View>
          
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>SMS Notifications</Text>
              <Text style={styles.toggleSubtitle}>Receive notifications via SMS</Text>
            </View>
            <Switch
              value={localPrefs.smsEnabled}
              onValueChange={() => handleToggle('smsEnabled')}
            />
          </View>
        </View>
        
        <Divider style={styles.divider} />
        
        <View style={styles.section}>
          <Text h4 style={styles.sectionTitle}>Notification Types</Text>
          
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Shipment Updates</Text>
              <Text style={styles.toggleSubtitle}>Status changes and tracking updates</Text>
            </View>
            <Switch
              value={localPrefs.shipmentUpdates}
              onValueChange={() => handleToggle('shipmentUpdates')}
            />
          </View>
          
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Driver Assigned</Text>
              <Text style={styles.toggleSubtitle}>When a driver accepts your shipment</Text>
            </View>
            <Switch
              value={localPrefs.driverAssigned}
              onValueChange={() => handleToggle('driverAssigned')}
            />
          </View>
          
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Payment Updates</Text>
              <Text style={styles.toggleSubtitle}>Payment confirmations and receipts</Text>
            </View>
            <Switch
              value={localPrefs.paymentUpdates}
              onValueChange={() => handleToggle('paymentUpdates')}
            />
          </View>
          
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Promotions</Text>
              <Text style={styles.toggleSubtitle}>Special offers and promotions</Text>
            </View>
            <Switch
              value={localPrefs.promotions}
              onValueChange={() => handleToggle('promotions')}
            />
          </View>
        </View>
        
        <Button
          title="Save Preferences"
          onPress={savePreferences}
          loading={saving}
          disabled={saving}
          buttonStyle={styles.saveButton}
        />
        
        <Divider style={styles.divider} />
        
        <View style={styles.section}>
          <Text h4 style={styles.sectionTitle}>Account</Text>
          
          <Text style={styles.infoText}>
            Signed in as: {user?.email}
          </Text>
          
          <Button
            title="Test Notification"
            type="outline"
            onPress={() => sendTestNotification()}
            buttonStyle={styles.testButton}
          />
          
          <Button
            title="Advanced Notification Testing"
            type="outline"
            onPress={() => navigation.navigate('NotificationTest')}
            buttonStyle={styles.testButton}
            containerStyle={{ marginTop: 8 }}
          />
          
          <Button
            title="Sign Out"
            type="outline"
            onPress={handleSignOut}
            buttonStyle={styles.signOutButton}
            titleStyle={styles.signOutButtonText}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  toggleSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    maxWidth: '80%',
  },
  divider: {
    marginVertical: 8,
  },
  saveButton: {
    marginHorizontal: 16,
    marginVertical: 16,
    backgroundColor: '#1E88E5',
  },
  testButton: {
    marginVertical: 8,
  },
  signOutButton: {
    marginVertical: 8,
    borderColor: '#f44336',
  },
  signOutButtonText: {
    color: '#f44336',
  },
  infoText: {
    fontSize: 16,
    marginVertical: 16,
  },
});
