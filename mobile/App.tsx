import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';
import crashlytics from '@react-native-firebase/crashlytics';

import Navigation from './src/navigation';
import { AuthProvider } from './src/context/AuthContext';
import { BookingProvider } from './src/context/BookingContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import { initializeNativeModulePolyfills, waitForNativeModules } from './src/utils/nativeModulePolyfill';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('=== DriveDrop App Initialization Starting ===');
        console.log('Platform:', Platform.OS, Platform.Version);
        
        // CRITICAL: Initialize native module polyfills FIRST
        // This prevents crashes on Samsung devices where modules might not be ready
        initializeNativeModulePolyfills();
        
        // Wait for critical native modules to be ready
        // This is especially important for Samsung devices
        const criticalModules = ['PlatformConstants', 'DeviceInfo'];
        await waitForNativeModules(criticalModules, 2000);
        
        // Initialize Firebase Crashlytics
        await crashlytics().setCrashlyticsCollectionEnabled(true);
        console.log('Firebase Crashlytics initialized');
        
        // Additional delay for Samsung devices to ensure all modules are loaded
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Check for required environment variables with safe fallbacks
        let supabaseUrl, supabaseAnonKey, apiUrl;
        
        try {
          supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 
            Constants.expoConfig?.extra?.supabaseUrl || 'https://placeholder.supabase.co';
          supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
            Constants.expoConfig?.extra?.supabaseAnonKey || 'placeholder-key';
          apiUrl = process.env.EXPO_PUBLIC_API_URL || 
            Constants.expoConfig?.extra?.apiUrl || 'https://drivedrop-main-production.up.railway.app';
        } catch (error) {
          console.warn('Error accessing environment variables:', error);
          // Set safe default values
          supabaseUrl = 'https://placeholder.supabase.co';
          supabaseAnonKey = 'placeholder-key';
          apiUrl = 'https://drivedrop-main-production.up.railway.app';
        }
        
        console.log('Environment check complete:', {
          hasSupabaseUrl: !!supabaseUrl,
          hasSupabaseAnonKey: !!supabaseAnonKey,
          hasApiUrl: !!apiUrl
        });
        
        setIsLoading(false);
      } catch (error) {
        console.error('App initialization error:', error);
        // Log to Crashlytics
        if (error instanceof Error) {
          crashlytics().recordError(error);
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setInitError(`Failed to initialize app: ${errorMessage}`);
        setIsLoading(false);
      }
    };
    
    initializeApp();
  }, []);
  
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#666' }}>Loading DriveDrop...</Text>
      </View>
    );
  }
  
  if (initError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#ffffff' }}>
        <Text style={{ fontSize: 18, textAlign: 'center', marginBottom: 20, color: '#ff0000' }}>
          App Initialization Error
        </Text>
        <Text style={{ textAlign: 'center', color: '#666' }}>
          {initError}
        </Text>
        <Text style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>
          Please restart the app. If the problem persists, contact support.
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
