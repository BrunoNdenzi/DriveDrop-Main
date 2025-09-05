import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';
import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';
import { initSentry } from './src/lib/sentry';

import Navigation from './src/navigation';
import { AuthProvider } from './src/context/AuthContext';
import { BookingProvider } from './src/context/BookingContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import ErrorBoundary from './src/components/ErrorBoundary';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasEnvVars, setHasEnvVars] = useState(false);
  
  useEffect(() => {
    // Initialize Sentry as early as possible
    initSentry();
    
    // Check for required environment variables
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 
      Constants.expoConfig?.extra?.supabaseUrl;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
      Constants.expoConfig?.extra?.supabaseAnonKey;
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 
      Constants.expoConfig?.extra?.apiUrl;
    
    setHasEnvVars(!!supabaseUrl && !!supabaseAnonKey && !!apiUrl);
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }
  
  if (!hasEnvVars) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, textAlign: 'center', marginBottom: 20 }}>
          Configuration Error: Missing environment variables.
        </Text>
        <Text style={{ textAlign: 'center' }}>
          Please check your app configuration and ensure all required environment variables are set.
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
