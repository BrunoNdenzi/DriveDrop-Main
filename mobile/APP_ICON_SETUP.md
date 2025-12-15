# DriveDrop App Icon Setup Guide

## Issue
The app shows an icon in Google Play Store but appears without an icon when downloaded/installed on devices.

## Root Cause
For Android apps, there are **two different types of icons**:
1. **Play Store Icon** - Shows in the store listing (512x512 PNG)
2. **Adaptive Icon** - Shows on device home screens (must have foreground + background layers)

Your app is missing properly configured adaptive icons.

## Current Configuration

### Files in `mobile/assets/`:
- `icon.png` - General app icon (1024x1024)
- `adaptive_icon.png` - Android adaptive icon foreground
- `logo-icon-only.png` - Truck logo (this is what you want to use!)
- `splash_icon.png` - Splash screen icon

### Current app.json Settings:
```json
{
  "icon": "./assets/icon.png",  // General icon
  "android": {
    "adaptiveIcon": {
      "foregroundImage": "./assets/adaptive_icon.png",
      "backgroundColor": "#00B8A9"
    }
  }
}
```

## Solution: Use Your Truck Logo as App Icon

### Step 1: Prepare Icon Images

You need **three versions** of your truck logo:

1. **App Icon (1024x1024)** - General purpose
   - Square image with your truck logo centered
   - Transparent or white background
   - Save as: `assets/icon.png`

2. **Adaptive Icon Foreground (1024x1024)** - For Android devices
   - Your truck logo centered with **transparent background**
   - Logo should fit within a **432x432 safe zone** (center area)
   - The outer edges may be cropped by device manufacturers
   - Save as: `assets/adaptive-icon.png`

3. **Play Store Icon (512x512)** - For Google Play listing
   - Same as app icon but 512x512 resolution
   - Upload this directly in Play Console, NOT in the app bundle

### Step 2: Update Icon Files

**Option A: Use logo-icon-only.png as base**
```bash
cd mobile/assets

# Resize logo-icon-only.png to proper dimensions
# Use online tool like https://imageresizer.com/ or:

# For app icon (1024x1024)
# - Open logo-icon-only.png in image editor
# - Resize canvas to 1024x1024
# - Center the logo
# - Save as icon.png

# For adaptive icon (1024x1024)
# - Resize to 1024x1024
# - Ensure transparent background
# - Center logo in 432x432 safe zone
# - Save as adaptive-icon.png
```

**Option B: Generate Icons Online (Recommended)**
1. Go to https://icon.kitchen/
2. Upload your `logo-icon-only.png`
3. Choose "Simple" style
4. Set background color to `#00B8A9` (your brand teal)
5. Download the generated icon pack
6. Replace `icon.png` and `adaptive-icon.png`

### Step 3: Update app.json

Your current configuration is **already correct**! Just ensure the files exist:

```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#00B8A9"
      }
    }
  }
}
```

### Step 4: Rebuild the App

```bash
cd mobile

# Clean build
rm -rf node_modules
yarn install

# Build new APK/AAB for Play Store
eas build --platform android --profile production
```

### Step 5: Update Play Store Listing

1. Go to Google Play Console
2. Navigate to **Store presence > Main store listing**
3. Scroll to **App icon** section
4. Upload a **512x512 PNG** version of your truck logo
5. Click **Save**

## Understanding Adaptive Icons

Android adaptive icons have **two layers**:
- **Foreground**: Your logo (transparent background)
- **Background**: Solid color or image

Different devices crop these layers into different shapes:
- Circle (Google Pixel)
- Squircle (Samsung)
- Rounded square (OnePlus)
- Square with rounded corners (others)

**Safe Zone**: Keep your important logo elements within the **center 66%** of the image (432x432 pixels of the 1024x1024 canvas).

## Icon Specifications

| Type | Dimensions | Format | Background |
|------|------------|--------|------------|
| App Icon | 1024x1024 | PNG | Any |
| Adaptive Foreground | 1024x1024 | PNG | Transparent |
| Adaptive Background | Color code | N/A | `#00B8A9` |
| Play Store Icon | 512x512 | PNG-32 | Any |

## Testing Icons

### Before Submitting to Play Store:
```bash
# Install on test device
eas build --platform android --profile preview
# Install the APK
# Check home screen icon appears correctly
```

### After Play Store Upload:
1. Wait for review approval
2. Install from Play Store
3. Icon should now appear on home screen

## Common Issues

### Issue: Icon appears with white background
**Solution**: Ensure adaptive-icon.png has transparent background

### Issue: Icon is cropped too much
**Solution**: Make logo smaller, keep it within 432x432 safe zone

### Issue: Icon looks different on different devices
**Solution**: This is normal for adaptive icons. Test on multiple devices.

## Quick Fix Checklist

- [ ] Replace `assets/icon.png` with 1024x1024 truck logo
- [ ] Replace `assets/adaptive-icon.png` with 1024x1024 truck logo (transparent background)
- [ ] Verify `app.json` has correct paths
- [ ] Build new version with `eas build`
- [ ] Upload 512x512 icon to Play Console
- [ ] Test on device before submitting

## Resources

- [Expo Icon Guide](https://docs.expo.dev/develop/user-interface/app-icons/)
- [Android Adaptive Icons](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)
- [Icon Kitchen Generator](https://icon.kitchen/)
- [Play Store Asset Guidelines](https://support.google.com/googleplay/android-developer/answer/9866151)

---

**Next Steps:**
1. Use `logo-icon-only.png` as base for your icons
2. Generate proper sizes using Icon Kitchen or image editor
3. Rebuild app with `eas build`
4. Upload to Play Store with updated 512x512 icon
