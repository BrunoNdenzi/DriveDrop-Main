# Firebase Crashlytics Setup Checklist

## ✅ Completed Steps:

1. **Installed Firebase packages**
   - `@react-native-firebase/app`: ^23.4.0
   - `@react-native-firebase/crashlytics`: ^23.4.0

2. **Updated project-level build.gradle**
   - Added `com.google.gms:google-services:4.4.3`
   - Added `com.google.firebase:firebase-crashlytics-gradle:3.0.2`

3. **Updated app-level build.gradle**
   - Applied `com.google.gms.google-services` plugin
   - Applied `com.google.firebase.crashlytics` plugin
   - Added Firebase BoM: `platform('com.google.firebase:firebase-bom:34.3.0')`
   - Added Crashlytics and Analytics dependencies

4. **Initialized Crashlytics in App.tsx**
   - Crashlytics collection enabled
   - Error logging configured

5. **Fixed React version**
   - Downgraded from React 19.1.0 to 18.2.0 (compatible with RN 0.81.4)

## ⚠️ Remaining Step:

**You need to manually place the `google-services.json` file:**

1. Take your downloaded `google-services.json` file
2. Place it in: `f:\DD\DriveDrop-Main\mobile\android\app\google-services.json`

## 📝 Package Name Verification:

- Package name in your app: `com.drivedrop.mobile`
- This should match the package name in your Firebase project

## 🚀 Next Steps:

Once `google-services.json` is in place:

```bash
# Commit changes
git add .
git commit -m "feat: Add Firebase Crashlytics and fix React version compatibility"

# Build with EAS
cd mobile
npx eas build --platform android --profile production
```

## 📊 Viewing Crash Reports:

After the app is deployed:
1. Go to: https://console.firebase.google.com/
2. Select your project
3. Navigate to: **Crashlytics** in the left menu
4. You'll see real-time crash reports with full stack traces

## 🔍 Testing Crashlytics:

To test if Crashlytics is working, you can add this test crash button somewhere in your app:

```typescript
import crashlytics from '@react-native-firebase/crashlytics';

// Test crash
<Button 
  title="Test Crash" 
  onPress={() => crashlytics().crash()} 
/>
```

## 🎯 What This Fixes:

- **React 19 → 18.2.0**: Eliminates compatibility issues with RN 0.81.4
- **Firebase Crashlytics**: Provides real-time crash reporting to diagnose the current startup crash
- **Better debugging**: Full stack traces with line numbers instead of memory addresses
