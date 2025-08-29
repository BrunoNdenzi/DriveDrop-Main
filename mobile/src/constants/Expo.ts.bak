// src/constants/Expo.ts
import Constants from 'expo-constants';

export const ExpoConfig = {
  projectId:
    (Constants.expoConfig?.extra?.projectId as string) ||
    '00000000-0000-0000-0000-000000000000',
  env: (Constants.expoConfig?.extra?.env as string) || 'development',
  enablePushNotifications:
    (Constants.expoConfig?.extra?.enablePushNotifications as boolean) || false,
  enableAnalytics:
    (Constants.expoConfig?.extra?.enableAnalytics as boolean) || false,
  enableCrashReporting:
    (Constants.expoConfig?.extra?.enableCrashReporting as boolean) || false,
};
