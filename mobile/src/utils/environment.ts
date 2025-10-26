import Constants from 'expo-constants';

/**
 * Environment configuration for DriveDrop mobile app
 */

interface Environment {
  apiUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  googleMapsApiKey: string;
  stripePublishableKey: string;
}

// Change this to your computer's LAN IP when testing on a real device!
const DEV_API_URL = 'https://drivedrop-main-production.up.railway.app';

const getEnvironment = (): Environment => {
  // Use type assertion to access releaseChannel since it's available at runtime
  // but not properly typed in the ExpoConfig type
  const expoConfig = Constants.expoConfig as any;
  const releaseChannel = expoConfig?.releaseChannel;
  
  // Try to get from process.env first (works in production builds)
  const envGoogleMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const envSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const envSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const envStripeKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  
  // Fallback to expoConfig.extra
  const googleMapsApiKey = envGoogleMapsKey || expoConfig?.extra?.googleMapsApiKey || '';
  const supabaseUrl = envSupabaseUrl || expoConfig?.extra?.supabaseUrl || '';
  const supabaseAnonKey = envSupabaseAnonKey || expoConfig?.extra?.supabaseAnonKey || '';
  const stripePublishableKey = envStripeKey || expoConfig?.extra?.stripePublishableKey || '';
  
  // Log for debugging in production (remove in final version)
  if (__DEV__) {
    console.log('Environment loaded:', {
      hasGoogleMapsKey: !!googleMapsApiKey,
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseAnonKey,
      releaseChannel: releaseChannel || 'default'
    });
  }
  
  // Default to development if no release channel
  if (!releaseChannel || releaseChannel === 'default') {
    return {
      apiUrl: DEV_API_URL,
      supabaseUrl,
      supabaseAnonKey,
      googleMapsApiKey,
      stripePublishableKey,
    };
  }
  
  // Production environment
  if (releaseChannel.indexOf('prod') !== -1) {
    return {
      apiUrl: 'https://drivedrop-main-production.up.railway.app',
      supabaseUrl,
      supabaseAnonKey,
      googleMapsApiKey,
      stripePublishableKey,
    };
  }
  
  // Staging environment
  if (releaseChannel.indexOf('staging') !== -1) {
    return {
      apiUrl: 'https://drivedrop-main-production.up.railway.app',
      supabaseUrl,
      supabaseAnonKey,
      googleMapsApiKey,
      stripePublishableKey,
    };
  }
  
  // Default to development if no match
  return {
    apiUrl: DEV_API_URL,
    supabaseUrl,
    supabaseAnonKey,
    googleMapsApiKey,
    stripePublishableKey,
  };
};

const environment = getEnvironment();

export const getApiUrl = (): string => environment.apiUrl;
export const getSupabaseUrl = (): string => environment.supabaseUrl;
export const getSupabaseAnonKey = (): string => environment.supabaseAnonKey;
export const getGoogleMapsApiKey = (): string => environment.googleMapsApiKey;
export const getStripePublishableKey = (): string => environment.stripePublishableKey;

export default environment;