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
const DEV_API_URL = 'http://192.168.1.66:3000'; // <--- YOUR IP HERE

const getEnvironment = (): Environment => {
  // Use type assertion to access releaseChannel since it's available at runtime
  // but not properly typed in the ExpoConfig type
  const expoConfig = Constants.expoConfig as any;
  const releaseChannel = expoConfig?.releaseChannel;
  
  // Default to development if no release channel
  if (!releaseChannel || releaseChannel === 'default') {
    return {
      apiUrl: DEV_API_URL,
      supabaseUrl: expoConfig?.extra?.supabaseUrl || '',
      supabaseAnonKey: expoConfig?.extra?.supabaseAnonKey || '',
      googleMapsApiKey: expoConfig?.extra?.googleMapsApiKey || '',
      stripePublishableKey: expoConfig?.extra?.stripePublishableKey || '',
    };
  }
  
  // Production environment
  if (releaseChannel.indexOf('prod') !== -1) {
    return {
      apiUrl: 'https://api.drivedrop.com',
      supabaseUrl: expoConfig?.extra?.supabaseUrl || '',
      supabaseAnonKey: expoConfig?.extra?.supabaseAnonKey || '',
      googleMapsApiKey: expoConfig?.extra?.googleMapsApiKey || '',
      stripePublishableKey: expoConfig?.extra?.stripePublishableKey || '',
    };
  }
  
  // Staging environment
  if (releaseChannel.indexOf('staging') !== -1) {
    return {
      apiUrl: 'https://staging-api.drivedrop.com',
      supabaseUrl: expoConfig?.extra?.supabaseUrl || '',
      supabaseAnonKey: expoConfig?.extra?.supabaseAnonKey || '',
      googleMapsApiKey: expoConfig?.extra?.googleMapsApiKey || '',
      stripePublishableKey: expoConfig?.extra?.stripePublishableKey || '',
    };
  }
  
  // Default to development if no match
  return {
    apiUrl: DEV_API_URL,
    supabaseUrl: expoConfig?.extra?.supabaseUrl || '',
    supabaseAnonKey: expoConfig?.extra?.supabaseAnonKey || '',
    googleMapsApiKey: expoConfig?.extra?.googleMapsApiKey || '',
    stripePublishableKey: expoConfig?.extra?.stripePublishableKey || '',
  };
};

const environment = getEnvironment();

export const getApiUrl = (): string => environment.apiUrl;
export const getSupabaseUrl = (): string => environment.supabaseUrl;
export const getSupabaseAnonKey = (): string => environment.supabaseAnonKey;
export const getGoogleMapsApiKey = (): string => environment.googleMapsApiKey;
export const getStripePublishableKey = (): string => environment.stripePublishableKey;

export default environment;