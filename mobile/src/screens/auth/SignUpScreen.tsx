import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '../../constants/Colors';
import { auth, supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation/types';

type SignUpScreenProps = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

export default function SignUpScreen({ navigation }: SignUpScreenProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'client' | 'driver'>('client');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSignUp() {
    // Reset error state
    setErrorMsg(null);
    
    // Validate inputs
    if (!firstName || !lastName) {
      Alert.alert('Error', 'Please enter your first and last name');
      return;
    }
    
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    // ⚠️ DRIVER VERIFICATION REQUIRED
    if (role === 'driver') {
      Alert.alert(
        'Driver Application Required',
        'To become a driver, you need to complete our verification process including:\n\n• Background check\n• Driver\'s license verification\n• Insurance verification\n• Vehicle inspection\n\nThis must be completed on our website for security and compliance.\n\nWould you like to apply now?',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Apply on Website',
            onPress: async () => {
              const url = 'https://drivedrop.com/apply-driver';
              const canOpen = await Linking.canOpenURL(url);
              if (canOpen) {
                await Linking.openURL(url);
              } else {
                Alert.alert('Error', 'Cannot open website. Please visit drivedrop.com/apply-driver');
              }
            }
          },
          {
            text: 'Sign Up as Client',
            onPress: () => {
              setRole('client');
              Alert.alert('Role Changed', 'You can now sign up as a client. To become a driver later, visit our website.');
            }
          }
        ],
        { cancelable: true }
      );
      return;
    }

    try {
      setLoading(true);
      
      // Sign up with user metadata including role
      const { data, error } = await auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            role: role
          }
        }
      });

      if (error) throw error;

      // If signup was successful and we have a user
      if (data?.user) {
        // No need to manually create a profile record as Supabase should handle this 
        // via triggers or RLS policies, but we can confirm the user was created
        console.log('User created successfully:', data.user.id);
      }

      Alert.alert(
        'Verification Email Sent',
        'Please check your email for a verification link to complete your registration.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Login')
          }
        ]
      );
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      let errorMsg = 'An error occurred during sign up';
      
      // Improved error handling with specific messages
      if (error.message?.includes('Database error')) {
        errorMsg = 'Database error creating user. This might be due to an issue with our systems. Please try again later.';
      } else if (error.message?.includes('already registered')) {
        errorMsg = 'This email is already registered. Please use a different email or try to login.';
      } else if (error.message?.includes('invalid email')) {
        errorMsg = 'Please enter a valid email address.';
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setErrorMsg(errorMsg);
      Alert.alert('Sign Up Error', errorMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to get started with DriveDrop</Text>
        </View>

        {errorMsg && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.row}>
            <View style={[styles.inputContainer, styles.halfInput]}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                placeholder="First name"
                placeholderTextColor="#9E9E9E"
                value={firstName}
                onChangeText={setFirstName}
                autoCorrect={false}
                autoComplete="name-given"
                textContentType="givenName"
                testID="firstName-input"
              />
            </View>

            <View style={[styles.inputContainer, styles.halfInput]}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Last name"
                placeholderTextColor="#9E9E9E"
                value={lastName}
                onChangeText={setLastName}
                autoCorrect={false}
                autoComplete="name-family"
                textContentType="familyName"
                testID="lastName-input"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>I want to sign up as:</Text>
            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[styles.roleButton, role === 'client' && styles.roleButtonSelected]}
                onPress={() => setRole('client')}
                testID="client-role-button"
              >
                <Text style={[styles.roleButtonText, role === 'client' && styles.roleButtonTextSelected]}>
                  Client
                </Text>
                <Text style={[styles.roleSubtext, role === 'client' && styles.roleSubtextSelected]}>
                  Ship Your Car
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.roleButton, role === 'driver' && styles.roleButtonSelected]}
                onPress={() => setRole('driver')}
                testID="driver-role-button"
              >
                <Text style={[styles.roleButtonText, role === 'driver' && styles.roleButtonTextSelected]}>
                  Driver
                </Text>
                <Text style={[styles.roleSubtext, role === 'driver' && styles.roleSubtextSelected]}>
                  Deliver Cars
                </Text>
                <Text style={[styles.verificationNote, role === 'driver' && styles.verificationNoteSelected]}>
                  • Verification Required
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#9E9E9E"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              testID="email-input"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Create a password"
              placeholderTextColor="#9E9E9E"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password-new"
              textContentType="newPassword"
              testID="password-input"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm your password"
              placeholderTextColor="#9E9E9E"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password-new"
              textContentType="newPassword"
              testID="confirm-password-input"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
            activeOpacity={0.7}
            testID="signup-button"
          >
            <Text style={styles.buttonText}>{loading ? 'Creating Account...' : 'Create Account'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
            <Text style={styles.signInText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
  },
  form: {
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputContainer: {
    marginBottom: 16,
  },
  halfInput: {
    width: '48%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: Colors.text.primary,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  roleButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  roleButtonTextSelected: {
    color: Colors.primary,
  },
  roleSubtext: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  roleSubtextSelected: {
    color: Colors.primary,
  },
  verificationNote: {
    fontSize: 10,
    color: '#FFA500',
    marginTop: 4,
    fontWeight: '500',
  },
  verificationNoteSelected: {
    color: '#FF8C00',
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    backgroundColor: Colors.primaryLight,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 16,
  },
  footerText: {
    color: Colors.text.secondary,
    fontSize: 14,
  },
  signInText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
});
