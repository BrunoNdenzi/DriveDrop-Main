import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// Initialize Sentry
export const initSentry = () => {
  try {
    const dsn = process.env.SENTRY_DSN || Constants.expoConfig?.extra?.sentryDsn;
    const environment = process.env.EXPO_PUBLIC_ENV || Constants.expoConfig?.extra?.env || 'development';
    
    if (!dsn) {
      console.warn('Sentry DSN not found. Skipping Sentry initialization.');
      return false;
    }
    
    Sentry.init({
      dsn,
      environment,
      // Performance Monitoring
      tracesSampleRate: environment === 'production' ? 0.2 : 1.0, // Sample rate lower in production
      // Session Replay
      replaysSessionSampleRate: environment === 'production' ? 0.1 : 1.0, // Sample rate lower in production
      replaysOnErrorSampleRate: 1.0, // Always capture replays when errors occur
      // Enable debug in non-production
      debug: environment !== 'production',
      // Set app version from Constants
      release: Constants.expoConfig?.version || '1.0.0',
      // Automatically send errors that cause a crash
      enableAutoSessionTracking: true,
      // Close sessions when app is backgrounded
      sessionTrackingIntervalMillis: 60000,
      // Set up auto performance tracking
      enableAutoPerformanceTracing: true,
      enableNativeNagger: false,
    });
    
    // Log Sentry initialization
    console.log(`Sentry initialized in ${environment} environment`);
    return true;
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
    return false;
  }
};

// Export Sentry for direct use elsewhere in the app
export default Sentry;
