# Phase 3 Installation & Setup Guide

## Required Packages

The following Expo packages need to be installed for the pickup verification features to work:

### Installation Commands

```bash
cd mobile

# Install camera package for photo capture
npx expo install expo-camera

# Install location package for GPS verification (if not already installed)
npx expo install expo-location

# Install file system package for photo handling (if not already installed)
npx expo install expo-file-system
```

### Package Versions (Recommended)

```json
{
  "expo-camera": "~14.0.0",
  "expo-location": "~16.0.0",
  "expo-file-system": "~16.0.0"
}
```

---

## Permissions Setup

### iOS (ios/Podfile)

Camera and location permissions are automatically handled by Expo. You may need to add descriptions to `app.json`:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "DriveDrop needs access to your camera to capture vehicle verification photos.",
        "NSLocationWhenInUseUsageDescription": "DriveDrop needs your location to verify you're at the pickup location.",
        "NSLocationAlwaysUsageDescription": "DriveDrop needs your location to track shipment delivery progress."
      }
    }
  }
}
```

### Android (AndroidManifest.xml)

Expo handles these automatically, but you can verify in `app.json`:

```json
{
  "expo": {
    "android": {
      "permissions": [
        "CAMERA",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    }
  }
}
```

---

## Quick Start

### 1. Install Dependencies

```bash
cd mobile
npm install
npx expo install expo-camera expo-location expo-file-system
```

### 2. Start Development Server

```bash
npx expo start
```

### 3. Run on Device/Emulator

**iOS Simulator:**
```bash
npx expo start --ios
```

**Android Emulator:**
```bash
npx expo start --android
```

**Physical Device:**
- Scan QR code with Expo Go app (iOS/Android)
- Or use `npx expo start --tunnel` for remote testing

---

## Testing the Flow

### Driver Flow:
1. Login as driver
2. Navigate to "My Shipments" tab
3. Select an accepted shipment
4. Tap "Start Trip" (GPS location required)
5. Tap "I've Arrived" (must be within 100m of pickup)
6. Tap "Start Verification" (opens camera screen)
7. Capture 6 photos (front, back, left, right, interior, dashboard)
8. Select decision (matches/minor differences/major issues)
9. Tap "Submit Verification"
10. Wait for upload to complete

### Client Flow:
1. Login as client
2. Navigate to "Shipments" tab
3. Select the shipment being verified
4. See verification progress card
5. If minor differences:
   - Modal appears automatically
   - Review photos
   - Respond within 5 minutes
   - Tap "Approve & Continue" or "Dispute & Cancel"

---

## Troubleshooting

### "Cannot find module 'expo-camera'"
**Solution:** Run `npx expo install expo-camera`

### "Camera permission denied"
**Solution:** 
- iOS: Reset simulator or go to Settings → Privacy → Camera → Enable for Expo Go
- Android: Go to Settings → Apps → Expo Go → Permissions → Enable Camera

### "Location permission denied"
**Solution:**
- iOS: Settings → Privacy → Location Services → Enable for Expo Go
- Android: Settings → Apps → Expo Go → Permissions → Enable Location

### "Network request failed"
**Solution:**
- Verify backend is running: https://drivedrop-main-production.up.railway.app
- Check your internet connection
- Verify auth token is valid (try logging out and back in)

### Photos not uploading
**Solution:**
- Check network connection
- Verify backend storage is configured
- Check console logs for specific error messages
- Ensure file size is within limits

### GPS verification failing
**Solution:**
- Ensure location services are enabled
- Wait for GPS to acquire accurate location (< 50m accuracy)
- Test outside or near a window for better GPS signal
- For testing, you can temporarily disable proximity check in backend

---

## Development Notes

### Camera Testing:
- Camera won't work on iOS Simulator (hardware required)
- Use physical device or Android emulator with camera support
- For quick testing without camera: modify code to use photo picker instead

### GPS Testing:
- iOS Simulator: Debug → Location → Custom Location
- Android Emulator: Extended Controls → Location
- For testing, you can use a fixed location in code

### Backend Testing:
- All APIs are deployed to Railway
- Authentication uses Supabase JWT tokens
- Verify token in request headers if issues occur

---

## Production Build

### iOS:
```bash
eas build --platform ios --profile production
```

### Android:
```bash
eas build --platform android --profile production
```

### Submit to Stores:
```bash
# iOS App Store
eas submit --platform ios

# Google Play Store
eas submit --platform android
```

---

## Environment Variables

Create `.env` file in mobile directory:

```env
EXPO_PUBLIC_API_URL=https://drivedrop-main-production.up.railway.app
EXPO_PUBLIC_SUPABASE_URL=your-supabase-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

---

## Support

For issues or questions:
1. Check console logs in Expo Dev Tools
2. Review backend logs in Railway dashboard
3. Verify database records in Supabase dashboard
4. Check Phase 3 documentation: PHASE_3_MOBILE_UI_COMPLETE.md
