# Firebase Crashlytics Setup Instructions

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select existing project
3. Follow the setup wizard

## Step 2: Add Android App

1. In Firebase Console, click "Add app" → Select Android
2. **Android package name**: `com.drivedrop.drivedrop`
3. **App nickname**: DriveDrop (optional)
4. **Debug signing certificate SHA-1**: Leave empty for now (optional)
5. Click "Register app"

## Step 3: Download google-services.json

1. Download the `google-services.json` file
2. Place it in: `mobile/android/app/google-services.json`
3. **IMPORTANT**: Replace the placeholder file with your actual file!

## Step 4: Enable Crashlytics

1. In Firebase Console, go to "Crashlytics" in the left menu
2. Click "Enable Crashlytics"
3. Follow any additional setup steps

## Step 5: Test Crashlytics

After building and installing the app, you can test crashlytics:

```javascript
import crashlytics from '@react-native-firebase/crashlytics';

// Test crash (only for testing!)
crashlytics().crash();

// Log custom errors
crashlytics().recordError(new Error('Test error'));

// Log custom events
crashlytics().log('User logged in');
```

## Step 6: View Crash Reports

1. Go to Firebase Console → Crashlytics
2. Wait a few minutes after a crash occurs
3. You'll see detailed crash reports with stack traces!

## What's Already Configured

✅ Firebase packages installed
✅ Android build.gradle files configured
✅ Crashlytics initialized in App.tsx
✅ Error logging added to initialization
⚠️ **NEED**: Real `google-services.json` file

## Current Status

A placeholder `google-services.json` is included so the build doesn't fail.
**You MUST replace it with your actual Firebase configuration file before deploying to production!**
