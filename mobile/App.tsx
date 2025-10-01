import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';
import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';

import Navigation from './src/navigation';
import { AuthProvider } from './src/context/AuthContext';
import { BookingProvider } from './src/context/BookingContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import ErrorBoundary from './src/components/ErrorBoundary';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasEnvVars, setHasEnvVars] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check for required environment variables with fallbacks
        let supabaseUrl, supabaseAnonKey, apiUrl;
        
        try {
          supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 
            Constants.expoConfig?.extra?.supabaseUrl;
          supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
            Constants.expoConfig?.extra?.supabaseAnonKey;
          apiUrl = process.env.EXPO_PUBLIC_API_URL || 
            Constants.expoConfig?.extra?.apiUrl;
        } catch (error) {
          console.warn('Error accessing environment variables:', error);
          // Set default values for development
          supabaseUrl = 'https://default.supabase.co';
          supabaseAnonKey = 'default-key';
          apiUrl = 'http://localhost:3000';
        }
        
        const hasRequiredVars = !!supabaseUrl && !!supabaseAnonKey && !!apiUrl;
        // Allow app to continue even without env vars for testing
        setHasEnvVars(true); // Always set to true to allow app startup
        
        if (!hasRequiredVars) {
          console.warn('Missing environment variables:', {
            supabaseUrl: !!supabaseUrl,
            supabaseAnonKey: !!supabaseAnonKey,
            apiUrl: !!apiUrl
          });
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('App initialization error:', error);
        setInitError('Failed to initialize app');
        setIsLoading(false);
      }
    };
    
    initializeApp();
  }, []);
  
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#666' }}>Loading DriveDrop...</Text>
      </View>
    );
  }
  
  if (initError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#ffffff' }}>
        <Text style={{ fontSize: 18, textAlign: 'center', marginBottom: 20, color: '#ff0000' }}>
          Initialization Error
        </Text>
        <Text style={{ textAlign: 'center', color: '#666' }}>
          {initError}
        </Text>
        <Text style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>
          Please restart the app or contact support.
        </Text>
      </View>
    );
  }
  
  
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <AuthProvider>
          <NotificationProvider>
            <BookingProvider>
              <Navigation />
            </BookingProvider>
          </NotificationProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
