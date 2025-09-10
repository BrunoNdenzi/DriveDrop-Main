module.exports = ({ config }) => {
  require('dotenv').config();
  
  return {
    ...config,
    name: "DriveDrop",
    slug: "drivedrop",
    version: "1.5.0", // Updated version for new release
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash_icon.png", // Matching app.json
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.drivedrop.mobile"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive_icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.drivedrop.mobile"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      env: process.env.EXPO_PUBLIC_ENV || 'development',
      enableAnalytics: process.env.EXPO_PUBLIC_ENABLE_ANALYTICS === 'true',
      enablePushNotifications: process.env.EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS === 'true',
      enableCrashReporting: process.env.EXPO_PUBLIC_ENABLE_CRASH_REPORTING === 'true',
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
      stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
      sentryDsn: process.env.SENTRY_DSN || '',
      projectId: "ce011283-21f8-4f0d-adb1-206f02d37e65", // This should be replaced with your actual Expo project ID
      eas: {
        projectId: "ce011283-21f8-4f0d-adb1-206f02d37e65" // This should be replaced with your actual EAS project ID
      }
    },
    plugins: [
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow DriveDrop to use your location to find nearby shipments and track deliveries."
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/notification_icon.png",
          color: "#1E88E5",
          sounds: [
            "./assets/notification_sound.wav"
          ]
        }
      ]
    ]
  };
};
