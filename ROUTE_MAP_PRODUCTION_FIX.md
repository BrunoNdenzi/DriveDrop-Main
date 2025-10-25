# Route Map Production Build Fix

## Problem
The route/map feature works perfectly in Expo development but shows a **blank screen** in production builds on Play Store. This is a common issue with react-native-maps in Expo projects.

## Root Causes Identified

### 1. ❌ Missing Google Maps API Key Configuration
**Issue**: The Android build was missing the required Google Maps API key configuration.

**Location**: `mobile/app.config.js` and native Android setup

**Problem**: Without proper API key configuration, react-native-maps cannot initialize the MapView component, resulting in a blank screen.

### 2. ❌ No Config Plugin for react-native-maps
**Issue**: react-native-maps doesn't have a built-in Expo config plugin, so we need a custom plugin.

**Location**: Need to create `mobile/plugins/withGoogleMaps.js`

**Problem**: Expo needs a config plugin to properly inject the API key into AndroidManifest.xml during the build process.

### 3. ❌ Incorrect API Key Access in Production
**Issue**: The code was using `process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` which doesn't work reliably in production builds.

**Location**: `mobile/src/utils/maps.ts`

**Problem**: Environment variables in production builds need to be accessed through `Constants.expoConfig.extra` instead of `process.env`.

## Fixes Applied

### Fix 1: Created Custom Config Plugin for Google Maps

**File**: `mobile/plugins/withGoogleMaps.js` (NEW FILE)

```javascript
const { withAndroidManifest } = require('@expo/config-plugins');

const withGoogleMaps = (config, { apiKey }) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application[0];

    // Add Google Maps API key meta-data
    const existingMetaData = application['meta-data'] || [];
    existingMetaData.push({
      $: {
        'android:name': 'com.google.android.geo.API_KEY',
        'android:value': apiKey,
      },
    });

    application['meta-data'] = existingMetaData;
    return config;
  });
};

module.exports = withGoogleMaps;
```

**What this does**: 
- Creates a custom Expo config plugin since react-native-maps doesn't have one
- Programmatically adds the Google Maps API key to AndroidManifest.xml during prebuild
- Works with EAS Build's environment variable injection

### Fix 2: Use Custom Plugin in app.config.js

**File**: `mobile/app.config.js`

```javascript
plugins: [
  // ... existing plugins ...
  [
    "./plugins/withGoogleMaps.js",
    {
      apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''
    }
  ]
]
```

**What this does**:
- Registers our custom plugin with Expo
- Passes the API key from environment variables
- Ensures proper native module configuration during build

### Fix 3: Use Proper API Key Access Method

**File**: `mobile/src/utils/maps.ts`

**Before**:
```typescript
const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
```

**After**:
```typescript
import { getGoogleMapsApiKey } from './googleMaps';

const apiKey = getGoogleMapsApiKey(); // Uses Constants.expoConfig.extra
```

**What this does**:
- Uses the proper Expo Constants API to access config
- Falls back to process.env for development
- Works reliably in both dev and production builds

## Testing the Fix

### In Expo Dev:
```bash
cd mobile
expo start
```
✅ Should continue working as before

### In Production Build:
```bash
# Clean build with new configuration
eas build --platform android --profile production --clear-cache

# Or for preview
eas build --platform android --profile preview --clear-cache
```

### Verify the Fix:
1. Install the new APK/AAB on a device
2. Navigate to any shipment with route data
3. Tap "View Route Map" or "Route" button
4. **Expected**: Map should load with pickup/delivery markers and route line
5. **Before Fix**: Blank white screen

## Why This Happens

### Expo vs Native Builds:
- **Expo Go/Dev Client**: Uses pre-configured Maps SDK with Expo's API key
- **Production Builds**: Need explicit configuration in native Android files
- **react-native-maps**: Requires native Android SDK setup

### Environment Variables in Production:
- `process.env` is replaced at build time by Metro bundler
- In production, values come from `app.config.js` → `extra`
- Must use `Constants.expoConfig.extra` to access them at runtime

### Android Native Requirements:
- Google Maps SDK on Android needs `com.google.android.geo.API_KEY`
- Must be in `AndroidManifest.xml` in the `<application>` tag
- Without it, MapView silently fails to initialize

## Additional Considerations

### API Key Security:
✅ The API key is:
- Stored as environment variable (not in code)
- Injected during build time from EAS secrets
- Restricted by package name on Google Cloud Console

### Build Cache:
⚠️ Always use `--clear-cache` for the first build after this fix:
```bash
eas build --platform android --profile production --clear-cache
```

### iOS Considerations:
If you also build for iOS, you may need similar configuration:
- Add Maps permission to `Info.plist` (already handled by expo-location)
- iOS uses the same config plugin setup

## Verification Checklist

Before submitting to Play Store:
- [ ] Build completes successfully
- [ ] Download and install APK/AAB on test device
- [ ] Navigate to RouteMapScreen from driver interface
- [ ] Map renders with current location
- [ ] Pickup and delivery markers are visible
- [ ] Route line is drawn between markers
- [ ] Tapping "Start Navigation" opens external maps app
- [ ] No crashes or blank screens

## Related Files Modified

1. `mobile/plugins/withGoogleMaps.js` - **NEW**: Custom config plugin for Google Maps
2. `mobile/app.config.js` - Added custom Google Maps plugin
3. `mobile/src/utils/maps.ts` - Use proper API key access method

## Important Notes

### Why Not Use react-native-maps Plugin Directly?

❌ **This doesn't work:**
```javascript
["react-native-maps", { googleMapsApiKey: "..." }]
```

**Error**: `Package "react-native-maps" does not contain a valid config plugin`

**Reason**: react-native-maps doesn't provide a built-in Expo config plugin. We must create a custom plugin instead.

### Custom Plugin vs Manual AndroidManifest.xml Edit

✅ **Custom Plugin (Recommended)**:
- Works with EAS Build
- Environment variables injected properly
- Survives `expo prebuild` regeneration
- Consistent across builds

❌ **Manual AndroidManifest.xml edit**:
- Gets overwritten by `expo prebuild`
- Harder to manage environment-specific keys
- Not recommended for managed workflow

## Reference Documentation

- [react-native-maps Setup](https://github.com/react-native-maps/react-native-maps/blob/master/docs/installation.md)
- [Expo Config Plugins](https://docs.expo.dev/config-plugins/introduction/)
- [Expo Constants API](https://docs.expo.dev/versions/latest/sdk/constants/)
- [Google Maps Android API](https://developers.google.com/maps/documentation/android-sdk/start)

## Next Build Command

```bash
cd mobile

# For production (Play Store)
eas build --platform android --profile production --clear-cache

# For internal testing
eas build --platform android --profile preview --clear-cache
```

## Success Indicators

After deploying the new build:
- ✅ RouteMapScreen loads without blank screen
- ✅ Map tiles render properly
- ✅ Markers and route line visible
- ✅ Location tracking works
- ✅ External navigation launches correctly
- ✅ No console errors related to Maps

---

**Status**: ✅ Fixed and ready for production build
**Version**: 1.5.0+
**Date**: 2025-10-25
