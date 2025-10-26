module.exports = ({ config }) => {
  require('dotenv').config();
  
  return {
    ...config,
    name: "DriveDrop",
    slug: "drivedrop",
    version: "1.7.0", // Updated version to match app.json
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
      package: "com.drivedrop.mobile",
      versionCode: 9
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
      projectId: "cee4610e-7236-4481-be20-707b4b147f19",
      eas: {
        projectId: "cee4610e-7236-4481-be20-707b4b147f19"
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
      ],
      [
        "./plugins/withGoogleMaps.js",
        {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''
        }
      ]
    ]
  };
};
