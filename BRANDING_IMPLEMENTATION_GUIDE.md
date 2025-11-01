# DriveDrop Branding & App Icon Guide

**Status:** Ready to implement
**Date:** October 29, 2025

---

## Overview

This guide covers how to:
1. Add your Looka logos to the mobile app
2. Create Play Store-ready app icons
3. Use logos throughout the app

---

## Part 1: Download & Prepare Logo Files

### From Looka Dashboard

1. **Go to:** https://looka.com/brandkit/230936529/logo-files

2. **Download These Versions:**

   ✅ **Full Color with Padding** (PNG)
   - Click "Download" → Choose "PNG"
   - Select size: **800px width** (recommended)
   - Save as: `logo-primary.png`
   - **Use for:** Light backgrounds in app

   ✅ **White on Transparent** (PNG)
   - Click the "White on transparent" option
   - Select size: **800px width**
   - Save as: `logo-white.png`
   - **Use for:** Dark backgrounds, splash screen

   ✅ **Primary on Transparent** (PNG)
   - The teal colored version
   - Select size: **800px width**
   - Save as: `logo-primary.png` (if not already downloaded)

   ✅ **Icon Only** (Square version, just the truck)
   - Select size: **1024x1024** (maximum quality)
   - Save as: `logo-icon-only.png`
   - **Use for:** App icon, favicon, small spaces

---

## Part 2: App Icon Specifications

### Google Play Store Requirements

#### **1. High-Res Icon (Required)**
- **Size:** 512x512 pixels
- **Format:** PNG (32-bit, with alpha channel)
- **File name:** `icon.png`
- **Notes:** Must be a square, no rounded corners needed

#### **2. Feature Graphic (Recommended)**
- **Size:** 1024x500 pixels
- **Format:** PNG or JPG
- **File name:** `feature-graphic.png`
- **Content:** Can include logo + tagline like "The Complete Shipping Solution"

#### **3. Adaptive Icon (Android 8.0+)**
- **Size:** 512x512 pixels
- **Format:** PNG (with transparent background)
- **File name:** `adaptive_icon.png`
- **Important:** 
  - Only the icon/truck part (no text)
  - Center safe zone: 264x264px (will never be cropped)
  - Outer area may be cropped to different shapes (circle, squircle, etc.)

### Icon Design Recommendations

Based on your Looka logo (teal truck icon):

```
✅ DO:
- Use just the truck icon (no text) for app icon
- Keep it simple and recognizable at small sizes
- Use a solid background color (white or teal)
- Ensure good contrast
- Test at different sizes (48px, 72px, 96px, 192px)

❌ DON'T:
- Include "drivedrop" text in icon (too small to read)
- Use gradients (hard to see at small sizes)
- Make it too detailed
- Use very thin lines
```

---

## Part 3: File Placement

### Place Downloaded Files Here:

```
mobile/
  assets/
    logo/
      logo-primary.png          ← Full color logo with text
      logo-white.png            ← White version for dark backgrounds
      logo-icon-only.png        ← Just the truck (for small spaces)
      
    icon.png                    ← Replace with 512x512 truck icon
    adaptive_icon.png           ← Replace with 512x512 truck icon (no text)
    favicon.png                 ← Replace with 48x48 truck icon
    splash_icon.png             ← Replace with logo-white.png or logo-primary.png
```

---

## Part 4: Using Logos in Code

### Import the Logo Component

```tsx
import Logo from '../../components/common/Logo';
```

### Usage Examples

#### **1. Primary Logo (Default)**
```tsx
<Logo variant="primary" size="medium" />
```

#### **2. White Logo (Dark Backgrounds)**
```tsx
<Logo variant="white" size="medium" />
```

#### **3. Icon Only**
```tsx
<Logo variant="icon" size="small" />
```

#### **4. Custom Size**
```tsx
<Logo 
  variant="primary" 
  size="large" 
  style={{ marginVertical: 20 }} 
/>
```

### Size Options

| Size    | Logo Dimensions | Icon Dimensions | Use Case                    |
|---------|----------------|-----------------|----------------------------|
| small   | 120x36         | 40x40          | Headers, small spaces      |
| medium  | 160x48         | 60x60          | Default, most common       |
| large   | 200x60         | 80x80          | Login, splash, hero areas  |
| xlarge  | 280x84         | 120x120        | Onboarding, empty states   |

---

## Part 5: Where Logos Should Appear

### ✅ Already Implemented

- [x] **Login Screen** - Shows logo at top
- [x] **App Icon** - (Ready to replace)
- [x] **Splash Screen** - (Ready to replace)

### 🔲 Recommended Additions

- [ ] **Sign Up Screen** - Add logo like login screen
- [ ] **Forgot Password Screen** - Brand consistency
- [ ] **Profile Header** - Small logo or icon
- [ ] **About/Settings Screen** - Company branding
- [ ] **Empty States** - When no shipments/messages
- [ ] **Loading States** - Branded loading indicators

---

## Part 6: Enable Logos in Code

### After Adding Logo Files

Once you've added the PNG files to `mobile/assets/logo/`:

1. **Open:** `mobile/src/components/common/Logo.tsx`

2. **Uncomment these lines:**

```tsx
// BEFORE (commented out):
// switch (variant) {
//   case 'primary':
//     return require('../../assets/logo/logo-primary.png');
//   ...
// }

// AFTER (uncommented):
switch (variant) {
  case 'primary':
    return require('../../assets/logo/logo-primary.png');
  case 'white':
    return require('../../assets/logo/logo-white.png');
  case 'icon':
    return require('../../assets/logo/logo-icon-only.png');
  default:
    return require('../../assets/logo/logo-primary.png');
}
```

3. **Remove the placeholder return:**

```tsx
// DELETE THIS LINE:
return null;
```

---

## Part 7: Generate All Required Icon Sizes

### Option 1: Using Online Tools

**Recommended:** https://easyappicon.com/
1. Upload your 1024x1024 icon
2. Select "Android"
3. Download all sizes
4. Place in respective folders

### Option 2: Manual (if needed)

Generate these sizes:

```
android/app/src/main/res/
  mipmap-mdpi/ic_launcher.png       (48x48)
  mipmap-hdpi/ic_launcher.png       (72x72)
  mipmap-xhdpi/ic_launcher.png      (96x96)
  mipmap-xxhdpi/ic_launcher.png     (144x144)
  mipmap-xxxhdpi/ic_launcher.png    (192x192)
```

---

## Part 8: Testing

### After Adding Files

1. **Clear Metro cache:**
```bash
cd mobile
npx expo start -c
```

2. **Test on device:**
```bash
npx expo start
# Scan QR code with Expo Go app
```

3. **Verify logos appear:**
- ✅ Login screen shows logo
- ✅ No placeholder boxes
- ✅ Logo is clear and not pixelated

---

## Part 9: Building for Play Store

### Update App Icon

1. **Replace files:**
   - `mobile/assets/icon.png` → Your 512x512 icon
   - `mobile/assets/adaptive_icon.png` → Your 512x512 icon (foreground only)

2. **Test locally:**
```bash
npx expo prebuild --clean
npx expo run:android
```

3. **Build for production:**
```bash
eas build --platform android --profile production
```

### Play Store Console

When uploading to Play Store:

1. **App Icon** - Auto-generated from `icon.png`
2. **Feature Graphic** - Upload manually (1024x500)
3. **Screenshots** - 2-8 screenshots required
4. **Promo Video** - Optional YouTube link

---

## Part 10: Your Brand Colors

From your Looka design, match these in the app:

```tsx
// mobile/src/constants/Colors.ts

export const Colors = {
  primary: '#1E88E5',      // ← Should match your Looka teal
  secondary: '#FF9800',    // ← Your accent color
  
  // Verify these match your brand:
  // If Looka uses different colors, update here
};
```

**Action:** Check if `#1E88E5` matches your Looka teal. If not, update it.

---

## Quick Checklist

### Immediate Tasks

- [ ] Download 4 logo files from Looka
- [ ] Place in `mobile/assets/logo/` folder
- [ ] Replace `icon.png` with 512x512 app icon
- [ ] Replace `adaptive_icon.png` with icon-only version
- [ ] Uncomment logo require() statements in `Logo.tsx`
- [ ] Test in Expo Go app
- [ ] Verify colors match brand

### Before Play Store Submission

- [ ] Generate all icon sizes (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
- [ ] Create feature graphic (1024x500)
- [ ] Take screenshots on real device
- [ ] Update app name/description with branding
- [ ] Verify all logos display correctly
- [ ] Test on multiple screen sizes

---

## Color Matching

Your Looka logo uses this teal: **approximately #1FA499** or similar.

**Current app color:** `#1E88E5` (blue)

### Update Colors to Match Your Brand

```tsx
// In mobile/src/constants/Colors.ts
export const Colors = {
  primary: '#1FA499',      // ← Match your Looka teal
  primaryDark: '#1A8B82',  // ← Darker shade
  primaryLight: '#5EC4BC', // ← Lighter shade
  // ... rest stays same
};
```

---

## Support & Next Steps

Once you've added the logo files:
1. I can help verify they're working correctly
2. We can add logos to more screens
3. We can create branded empty states
4. We can design custom loading indicators

**Questions?** Let me know which part you'd like help with first!
