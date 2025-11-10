import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';
import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';
import { initSentry } from './src/lib/sentry';
import * as Linking from 'expo-linking';
import { supabase } from './src/lib/supabase';

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

    // Handle deep links for email verification
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      console.log('Deep link received:', url);
      
      // Handle Supabase auth callbacks
      if (url.includes('auth/callback') || url.includes('#access_token')) {
        try {
          // Extract URL parameters
          const urlParams = new URL(url);
          const accessToken = urlParams.searchParams.get('access_token') || 
                             urlParams.hash.split('access_token=')[1]?.split('&')[0];
          
          if (accessToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: urlParams.searchParams.get('refresh_token') || 
                           urlParams.hash.split('refresh_token=')[1]?.split('&')[0] || '',
            });
            
            if (error) {
              console.error('Error handling auth callback:', error);
            } else if (data?.session) {
              console.log('Email verified successfully!');
            }
          }
        } catch (err) {
          console.error('Error processing deep link:', err);
        }
      }
    };

    // Listen for deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened from a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
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
