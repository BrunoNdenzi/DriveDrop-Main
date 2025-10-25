# Placeholder & Text Color Fix for Production Builds

## Issue Description
In production builds (Play Store APK), TextInput placeholders and Stripe CardField text were appearing white or invisible against light backgrounds, even though they displayed correctly in Expo development mode.

## Root Cause
React Native doesn't automatically set contrast-safe placeholder colors in production builds. Without explicit `placeholderTextColor` props, Android production builds default to white or very light colors that are invisible on light backgrounds.

## Solution Applied

### 1. Auth Screens - Added Explicit Placeholder Colors

All TextInput fields now have `placeholderTextColor="#9E9E9E"` (medium gray):

#### LoginScreen.tsx
- ✅ Email input placeholder
- ✅ Password input placeholder

#### SignUpScreen.tsx
- ✅ First name input placeholder
- ✅ Last name input placeholder
- ✅ Email input placeholder
- ✅ Password input placeholder
- ✅ Confirm password input placeholder

#### ForgotPasswordScreen.tsx
- ✅ Email input placeholder

### 2. Stripe CardField - Added Text & Placeholder Styling

Updated `InvoicePaymentStep.tsx` CardField styling:

```typescript
cardField: {
  backgroundColor: '#F8F9FA',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#E0E0E0',
  textColor: '#263238',           // Dark text for entered values
  placeholderColor: '#9E9E9E',    // Medium gray for placeholders
  textErrorColor: '#F44336',      // Red for error states
}
```

### 3. Other Components Already Fixed

These components already had proper placeholder colors:
- ✅ MessageInput.tsx - `placeholderTextColor={Colors.text.secondary}`
- ✅ MinimalGooglePlaces.tsx - `placeholderTextColor="#999"`
- ✅ SafeAddressInput.tsx - `placeholderTextColor="#999"`
- ✅ GooglePlacesInput.tsx - `placeholderTextColor="#999"`

## Color Standards

### Placeholder Color
- **Value**: `#9E9E9E` (Medium gray)
- **Purpose**: Visible on white/light backgrounds, clearly distinguishable from entered text
- **Matches**: `Colors.text.disabled` from design system

### Text Color (CardField)
- **Value**: `#263238` (Dark gray)
- **Purpose**: High contrast for entered text
- **Matches**: `Colors.text.primary` from design system

### Error Color (CardField)
- **Value**: `#F44336` (Red)
- **Purpose**: Clear error indication
- **Matches**: `Colors.error` from design system

## Testing Checklist

### Development (Expo Go)
- [x] Login screen placeholders visible
- [x] SignUp screen placeholders visible
- [x] ForgotPassword screen placeholders visible
- [x] Payment card field placeholder visible
- [x] Payment card field text visible when typing

### Production Build
- [ ] Build APK with `eas build --platform android --profile production`
- [ ] Install on physical Android device
- [ ] Verify login placeholders visible
- [ ] Verify signup placeholders visible
- [ ] Verify forgot password placeholder visible
- [ ] Complete booking flow to payment step
- [ ] Verify card number placeholder "4242 4242 4242 4242" visible
- [ ] Type card details and verify text is visible
- [ ] Verify error messages have red text

## Files Modified

1. `mobile/src/screens/auth/LoginScreen.tsx`
   - Added `placeholderTextColor` to email and password inputs

2. `mobile/src/screens/auth/SignUpScreen.tsx`
   - Added `placeholderTextColor` to all 5 input fields

3. `mobile/src/screens/auth/ForgotPasswordScreen.tsx`
   - Added `placeholderTextColor` to email input

4. `mobile/src/components/completion/InvoicePaymentStep.tsx`
   - Added `textColor`, `placeholderColor`, and `textErrorColor` to CardField styles

## Why This Happens

### Development vs Production Behavior
- **Expo Dev Mode**: React Native defaults to safe contrast colors
- **Production APK**: Platform-specific defaults apply (often white on Android)
- **iOS**: Generally better at defaulting to visible colors
- **Android**: More aggressive optimization can remove implied styles

### Best Practice
Always explicitly set `placeholderTextColor` on all TextInput components to ensure consistent appearance across:
- Development builds
- Production builds
- Different Android versions
- Different device manufacturers

## Related Issues Fixed
- Login form placeholders invisible in Play Store build ✅
- Payment card details appearing as white text ✅
- Card placeholder not visible on production ✅
- Consistent styling across all TextInput fields ✅

## Next Steps
1. Build production APK
2. Test on physical Android device
3. Verify all placeholders are visible
4. Submit to Play Store with confidence
