import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import 'react-native-url-polyfill/auto';

import Navigation from './src/navigation';
import { AuthProvider } from './src/context/AuthContext';
import { BookingProvider } from './src/context/BookingContext';
import { NotificationProvider } from './src/contexts/NotificationContext';

export default function App() {
  return (
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
  );
}
