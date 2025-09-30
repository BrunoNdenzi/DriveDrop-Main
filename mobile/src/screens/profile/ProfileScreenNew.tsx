import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ClientTabParamList } from '../../navigation/types';

type ClientProfileScreenProps = NativeStackScreenProps<ClientTabParamList, 'Profile'>;

interface ClientSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  autoQuotes: boolean;
}

export default function ClientProfileScreen({ navigation }: ClientProfileScreenProps) {
  const { userProfile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<ClientSettings>({
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    marketingEmails: false,
    autoQuotes: true,
  });

  useEffect(() => {
    fetchClientData();
  }, [userProfile]);

  const fetchClientData = async () => {
    if (!userProfile?.id) return;

    try {
      setLoading(true);

      // Fetch user settings
      const { data: settingsData, error: settingsError } = await (supabase as any)
        .from('client_settings')
        .select('*')
        .eq('client_id', userProfile.id)
        .maybeSingle();

      if (settingsError && settingsError.code !== '42P01' && settingsError.code !== 'PGRST116') {
        console.log('Error fetching settings:', settingsError.message);
      }

      if (settingsData) {
        setSettings({
          emailNotifications: settingsData.email_notifications ?? true,
          pushNotifications: settingsData.push_notifications ?? true,
          smsNotifications: settingsData.sms_notifications ?? false,
          marketingEmails: settingsData.marketing_emails ?? false,
          autoQuotes: settingsData.auto_quotes ?? true,
        });
      }

    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setLoading(false);
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
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
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
    if (userProfile?.first_name) {
      return userProfile.first_name.charAt(0).toUpperCase();
    }
    return 'C';
  };

  const getUserName = () => {
    if (userProfile?.first_name && userProfile?.last_name) {
      return `${userProfile.first_name} ${userProfile.last_name}`;
    }
    return 'Not set';
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
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
        <Text style={styles.title}>My Profile</Text>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => navigation.navigate('EditClientProfile' as any)}
        >
          <MaterialIcons name="edit" size={20} color={Colors.text.inverse} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {userProfile?.avatar_url ? (
              <Image source={{ uri: userProfile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getUserInitial()}</Text>
              </View>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{getUserName()}</Text>
            <Text style={styles.userRole}>Client Account</Text>
            <Text style={styles.joinedDate}>
              Member since {new Date(userProfile?.created_at || '').getFullYear() || 2024}
            </Text>
          </View>
        </View>

        {/* Account Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          
          <TouchableOpacity 
            style={styles.optionItem}
            onPress={() => navigation.navigate('EditClientProfile' as any)}
          >
            <MaterialIcons name="person" size={20} color={Colors.primary} />
            <Text style={styles.optionText}>Personal Information</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionItem}
            onPress={() => navigation.navigate('PaymentMethods' as any)}
          >
            <MaterialIcons name="payment" size={20} color={Colors.primary} />
            <Text style={styles.optionText}>Payment Methods</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionItem}
            onPress={() => navigation.navigate('AddressBook' as any)}
          >
            <MaterialIcons name="location-on" size={20} color={Colors.primary} />
            <Text style={styles.optionText}>Address Book</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
          <TouchableOpacity 
            style={styles.optionItem}
            onPress={() => navigation.navigate('NotificationSettings' as any)}
          >
            <MaterialIcons name="notifications" size={20} color={Colors.primary} />
            <Text style={styles.optionText}>Notifications</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionItem}
            onPress={() => navigation.navigate('PrivacySettings' as any)}
          >
            <MaterialIcons name="security" size={20} color={Colors.primary} />
            <Text style={styles.optionText}>Privacy & Security</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionItem}
            onPress={() => navigation.navigate('AppSettings' as any)}
          >
            <MaterialIcons name="settings" size={20} color={Colors.primary} />
            <Text style={styles.optionText}>App Settings</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          
          <TouchableOpacity 
            style={styles.optionItem}
            onPress={() => navigation.navigate('HelpCenter' as any)}
          >
            <MaterialIcons name="help" size={20} color={Colors.primary} />
            <Text style={styles.optionText}>Help Center</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionItem}
            onPress={() => navigation.navigate('ContactSupport' as any)}
          >
            <MaterialIcons name="support-agent" size={20} color={Colors.primary} />
            <Text style={styles.optionText}>Contact Support</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionItem}
            onPress={() => navigation.navigate('About' as any)}
          >
            <MaterialIcons name="info" size={20} color={Colors.primary} />
            <Text style={styles.optionText}>About DriveDrop</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <MaterialIcons name="logout" size={20} color={Colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.secondary,
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  editButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: Colors.surface,
    marginBottom: 16,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
    marginBottom: 2,
  },
  joinedDate: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  section: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    padding: 16,
    paddingBottom: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: 12,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
    marginLeft: 8,
  },
});