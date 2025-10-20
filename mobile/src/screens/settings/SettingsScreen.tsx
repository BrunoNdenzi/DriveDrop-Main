import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';

export default function SettingsScreen({ navigation }: any) {
  const { userProfile } = useAuth();

  const handleNotificationSettings = () => {
    navigation.navigate('NotificationSettings');
  };

  const handlePrivacySettings = () => {
    navigation.navigate('PrivacySettings');
  };

  const handleAccountSettings = () => {
    Alert.alert('Account Settings', 'Account settings coming soon');
  };

  const handleLanguage = () => {
    Alert.alert('Language', 'Language selection coming soon');
  };

  const handleTheme = () => {
    Alert.alert('Theme', 'Theme customization coming soon');
  };

  const handleDataUsage = () => {
    Alert.alert('Data Usage', 'Data usage settings coming soon');
  };

  const handleAbout = () => {
    Alert.alert(
      'About DriveDrop',
      'Version 1.0.0\n\n© 2024 DriveDrop. All rights reserved.'
    );
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
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleAccountSettings}
            >
              <MaterialIcons name="person" size={22} color={Colors.secondary} />
              <Text style={styles.menuText}>Account Settings</Text>
              <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handlePrivacySettings}
            >
              <MaterialIcons name="security" size={22} color={Colors.secondary} />
              <Text style={styles.menuText}>Privacy & Security</Text>
              <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleNotificationSettings}
            >
              <MaterialIcons name="notifications" size={22} color={Colors.secondary} />
              <Text style={styles.menuText}>Notification Preferences</Text>
              <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* App Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Preferences</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleLanguage}
            >
              <MaterialIcons name="language" size={22} color={Colors.secondary} />
              <Text style={styles.menuText}>Language</Text>
              <View style={styles.menuRight}>
                <Text style={styles.menuSubtext}>English</Text>
                <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleTheme}
            >
              <MaterialIcons name="palette" size={22} color={Colors.secondary} />
              <Text style={styles.menuText}>Theme</Text>
              <View style={styles.menuRight}>
                <Text style={styles.menuSubtext}>Light</Text>
                <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleDataUsage}
            >
              <MaterialIcons name="data-usage" size={22} color={Colors.secondary} />
              <Text style={styles.menuText}>Data Usage</Text>
              <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Driver Settings (if driver) */}
        {userProfile?.role === 'driver' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Driver</Text>
            <View style={styles.menuCard}>
              <TouchableOpacity style={styles.menuItem}>
                <MaterialIcons name="directions-car" size={22} color={Colors.secondary} />
                <Text style={styles.menuText}>Vehicle Settings</Text>
                <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem}>
                <MaterialIcons name="my-location" size={22} color={Colors.secondary} />
                <Text style={styles.menuText}>Location Preferences</Text>
                <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleAbout}
            >
              <MaterialIcons name="info" size={22} color={Colors.secondary} />
              <Text style={styles.menuText}>About DriveDrop</Text>
              <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <MaterialIcons name="description" size={22} color={Colors.secondary} />
              <Text style={styles.menuText}>Terms of Service</Text>
              <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <MaterialIcons name="policy" size={22} color={Colors.secondary} />
              <Text style={styles.menuText}>Privacy Policy</Text>
              <MaterialIcons name="chevron-right" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>

            <View style={styles.menuItem}>
              <MaterialIcons name="verified" size={22} color={Colors.text.secondary} />
              <Text style={styles.menuText}>Version</Text>
              <Text style={styles.versionText}>1.0.0</Text>
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
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuSubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginRight: 8,
  },
  versionText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
});
