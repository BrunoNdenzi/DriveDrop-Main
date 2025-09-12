import Constants from 'expo-constants';

export const getGoogleMapsApiKey = (): string => {
  // Try to get from Expo config
  const apiKey = Constants.expoConfig?.extra?.googleMapsApiKey || 
                 process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.warn('Google Maps API key not found. Please ensure EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is set.');
    return '';
  }
  
  return apiKey;
};

export const validateGoogleMapsApiKey = (): boolean => {
  const apiKey = getGoogleMapsApiKey();
  return apiKey.length > 0;
};
