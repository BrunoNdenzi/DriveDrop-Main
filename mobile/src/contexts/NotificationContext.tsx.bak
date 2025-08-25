// src/contexts/NotificationContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import {
  NotificationService,
  NotificationPreferences,
  defaultPreferences,
} from '../services/NotificationService';
import { useAuth } from '../context/AuthContext';

// Create a singleton instance
export const notificationService = NotificationService.getInstance();

interface NotificationContextType {
  isInitialized: boolean;
  pushToken: string | null;
  hasPermission: boolean;
  preferences: NotificationPreferences;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  sendTestNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider'
    );
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { session } = useAuth(); // Add access to auth session
  const [isInitialized, setIsInitialized] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(defaultPreferences);

  // Initialize the notification service
  useEffect(() => {
    const initNotifications = async () => {
      try {
        // Safely check if the notification service is properly initialized
        if (!notificationService) {
          console.error('NotificationService is not properly initialized');
          setIsInitialized(true); // Mark as initialized to prevent infinite loading
          return;
        }

        await notificationService.initialize();

        // Update state with the current token
        setPushToken(notificationService.expoPushToken);

        // Check if we have permission
        const enabled = await notificationService.areNotificationsEnabled();
        setHasPermission(enabled);

        // Load preferences
        const prefs = await notificationService.getNotificationPreferences();
        setPreferences(prefs);

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize notifications:', error);

        // Show alert about the error for better debugging
        if (__DEV__) {
          Alert.alert(
            'Notification Error',
            `Failed to initialize notifications: ${error instanceof Error ? error.message : String(error)}`,
            [{ text: 'OK' }]
          );
        }

        setIsInitialized(true); // Still mark as initialized even if there was an error
      }
    };

    initNotifications();

    // Clean up when unmounting
    return () => {
      notificationService.cleanup();
    };
  }, [session]); // Add session as a dependency to reinitialize when auth state changes

  // Request notification permissions
  const requestPermissions = async (): Promise<boolean> => {
    try {
      await notificationService.initialize();
      const enabled = await notificationService.areNotificationsEnabled();
      setHasPermission(enabled);

      if (!enabled) {
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications in your device settings to receive important updates about your shipments.',
          [{ text: 'OK' }]
        );
      }

      return enabled;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  };

  // Update notification preferences
  const updatePreferences = async (
    prefs: Partial<NotificationPreferences>
  ): Promise<void> => {
    try {
      const updatedPrefs = { ...preferences, ...prefs };
      setPreferences(updatedPrefs);
      await notificationService.saveNotificationPreferences(updatedPrefs);
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      // Revert to previous state if there was an error
      const currentPrefs =
        await notificationService.getNotificationPreferences();
      setPreferences(currentPrefs);
    }
  };

  // Send a test notification
  const sendTestNotification = () => {
    notificationService.sendLocalNotification(
      'Test Notification',
      'This is a test notification from DriveDrop',
      { type: 'test' }
    );
  };

  return (
    <NotificationContext.Provider
      value={{
        isInitialized,
        pushToken,
        hasPermission,
        preferences,
        updatePreferences,
        requestPermissions,
        sendTestNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
