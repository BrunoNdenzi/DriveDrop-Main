// src/services/NotificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import Constants from 'expo-constants';
import { ExpoConfig } from '../constants/Expo';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  shipmentUpdates: boolean;
  driverAssigned: boolean;
  paymentUpdates: boolean;
  promotions: boolean;
}

const defaultPreferences: NotificationPreferences = {
  pushEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  shipmentUpdates: true,
  driverAssigned: true,
  paymentUpdates: true,
  promotions: false,
};

export class NotificationService {
  private static instance: NotificationService;
  private _expoPushToken: string | null = null;
  private _notificationListener: any = null;
  private _responseListener: any = null;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  get expoPushToken(): string | null {
    return this._expoPushToken;
  }

  /**
   * Initialize notification listeners and register for push notifications
   */
  async initialize(): Promise<void> {
    if (!Device.isDevice) {
      console.log('Push notifications are not supported in the simulator');
      return;
    }

    // Check if we have permission to send notifications
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // If we don't have permission, ask for it
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get permission for push notifications');
      return;
    }

    // Get the Expo push token
    try {
      const token = await this.registerForPushNotifications();
      
      // If we got a valid token, save it
      if (token !== 'INVALID_PROJECT_ID') {
        this._expoPushToken = token;
        console.log('Expo push token:', token);
        
        // Store the token in Supabase
        await this.savePushToken(token);
      } else {
        console.log('Skipping push token storage due to invalid project ID');
      }
    } catch (error) {
      console.error('Error getting push token:', error);
    }

    // Set up notification listeners
    this.setupNotificationListeners();
  }

  /**
   * Register for push notifications and return the token
   */
  private async registerForPushNotifications(): Promise<string> {
    try {
      // Check if we have a valid project ID
      if (!ExpoConfig.projectId || ExpoConfig.projectId === '00000000-0000-0000-0000-000000000000') {
        console.log('No valid Expo project ID configured. Push notifications will not work.');
        return 'INVALID_PROJECT_ID';
      }
      
      // Get the token
      console.log('Using project ID:', ExpoConfig.projectId);
      const { data: tokenData } = await Notifications.getExpoPushTokenAsync({
        projectId: ExpoConfig.projectId,
      });

      // Set up platform-specific notification channel (Android only)
      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#1E88E5', // Primary color
        });
      }

      return tokenData;
    } catch (error) {
      console.error('Error in registerForPushNotifications:', error);
      throw error;
    }
  }

  /**
   * Set up notification listeners
   */
  private setupNotificationListeners(): void {
    // This listener is fired whenever a notification is received while the app is foregrounded
    this._notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
      }
    );

    // This listener is fired whenever a user taps on or interacts with a notification
    this._responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification response:', response);
        // Handle notification tap
        this.handleNotificationInteraction(response.notification.request.content.data);
      }
    );
  }

  /**
   * Handle a notification interaction (tap)
   */
  private handleNotificationInteraction(data: any): void {
    // Handle different notification types
    if (data.type === 'shipment_update') {
      // Navigate to shipment details
      // This will be handled by the app navigation
    } else if (data.type === 'new_message') {
      // Navigate to chat
    }
  }

  /**
   * Cleanup notification listeners
   */
  cleanup(): void {
    if (this._notificationListener) {
      Notifications.removeNotificationSubscription(this._notificationListener);
    }
    if (this._responseListener) {
      Notifications.removeNotificationSubscription(this._responseListener);
    }
  }

  /**
   * Save push token to Supabase
   */
  async savePushToken(token: string): Promise<void> {
    try {
      const { data: user, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Error getting user:', userError);
        return;
      }

      // Check if token already exists
      const { data: existingTokens, error: queryError } = await supabase
        .from('push_tokens')
        .select('*')
        .eq('user_id', user.user.id)
        .eq('token', token);

      if (queryError) {
        console.error('Error querying push tokens:', queryError);
        return;
      }

      // If token doesn't exist, save it
      if (!existingTokens || existingTokens.length === 0) {
        const { error } = await supabase.from('push_tokens').insert({
          user_id: user.user.id,
          token,
          device_type: Platform.OS,
          is_active: true,
          created_at: new Date().toISOString(),
        });

        if (error) {
          console.error('Error saving push token:', error);
        }
      }
    } catch (error) {
      console.error('Error in savePushToken:', error);
    }
  }

  /**
   * Get notification preferences for the current user
   */
  async getNotificationPreferences(): Promise<NotificationPreferences> {
    try {
      const { data: user, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Error getting user:', userError);
        return defaultPreferences;
      }

      // Get preferences from Supabase
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.user.id)
        .single();

      if (error || !data) {
        // If no preferences found, return defaults
        return defaultPreferences;
      }

      return {
        pushEnabled: data.push_enabled,
        emailEnabled: data.email_enabled,
        smsEnabled: data.sms_enabled,
        shipmentUpdates: data.shipment_updates,
        driverAssigned: data.driver_assigned,
        paymentUpdates: data.payment_updates,
        promotions: data.promotions,
      };
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return defaultPreferences;
    }
  }

  /**
   * Save notification preferences for the current user
   */
  async saveNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
    try {
      const { data: user, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Error getting user:', userError);
        return;
      }

      // Check if preferences already exist
      const { data, error: queryError } = await supabase
        .from('notification_preferences')
        .select('id')
        .eq('user_id', user.user.id)
        .single();

      const prefsData = {
        user_id: user.user.id,
        push_enabled: preferences.pushEnabled,
        email_enabled: preferences.emailEnabled,
        sms_enabled: preferences.smsEnabled,
        shipment_updates: preferences.shipmentUpdates,
        driver_assigned: preferences.driverAssigned,
        payment_updates: preferences.paymentUpdates,
        promotions: preferences.promotions,
        updated_at: new Date().toISOString(),
      };

      let error;
      
      if (queryError || !data) {
        // Insert new preferences
        const result = await supabase
          .from('notification_preferences')
          .insert({
            ...prefsData,
            created_at: new Date().toISOString(),
          });
        error = result.error;
      } else {
        // Update existing preferences
        const result = await supabase
          .from('notification_preferences')
          .update(prefsData)
          .eq('id', data.id);
        error = result.error;
      }

      if (error) {
        console.error('Error saving notification preferences:', error);
      }
    } catch (error) {
      console.error('Error in saveNotificationPreferences:', error);
    }
  }

  /**
   * Send a local notification for testing
   */
  async sendLocalNotification(title: string, body: string, data: any = {}): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: null, // Immediately
    });
  }

  /**
   * Check if push notifications are enabled
   */
  async areNotificationsEnabled(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();
