# Profile Enhancement - Navigation Setup Guide

## Overview
This guide explains how to integrate the enhanced profile screens and new settings screens into your existing navigation structure.

## Required Navigation Updates

### 1. Add Settings Stack Navigator

If you don't already have a settings navigator, add it to your navigation structure:

```typescript
// In your navigation file (e.g., AppNavigator.tsx or similar)

import SettingsScreen from '../screens/settings/SettingsScreen';
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';
import PrivacySettingsScreen from '../screens/settings/PrivacySettingsScreen';

// Add to your stack navigator
<Stack.Screen 
  name="Settings" 
  component={SettingsScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen 
  name="NotificationSettings" 
  component={NotificationSettingsScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen 
  name="PrivacySettings" 
  component={PrivacySettingsScreen}
  options={{ headerShown: false }}
/>
```

### 2. Update Navigation Types

Add the new screens to your navigation type definitions:

```typescript
// In your types file (e.g., navigation.types.ts)

export type RootStackParamList = {
  // ... existing screens
  Settings: undefined;
  NotificationSettings: undefined;
  PrivacySettings: undefined;
  // ... other screens
};
```

### 3. Verify Profile Screen Routes

Ensure these routes exist in your navigator:

```typescript
// Client profile
<Stack.Screen 
  name="Profile" 
  component={ProfileScreen}
  options={{ headerShown: false }}
/>

// Driver profile (if separate stack)
<Stack.Screen 
  name="DriverProfile" 
  component={DriverProfileScreen}
  options={{ headerShown: false }}
/>
```

## Navigation Flow

### From Profile Screens
```
ProfileScreen / DriverProfileScreen
    ├── Edit Profile (Modal - internal)
    ├── Settings → SettingsScreen
    ├── Payment Methods (TODO)
    ├── Saved Addresses (TODO)
    ├── Help Center (External URL)
    ├── Contact Support (Email)
    ├── Terms of Service (External URL)
    ├── Privacy Policy (External URL)
    ├── Admin Dashboard (if admin)
    └── Admin Assignment (if admin)
```

### From Settings Screen
```
SettingsScreen
    ├── Account Settings (TODO)
    ├── Privacy & Security → PrivacySettingsScreen
    ├── Notification Preferences → NotificationSettingsScreen
    ├── Language (TODO)
    ├── Theme (TODO)
    ├── Data Usage (TODO)
    ├── Vehicle Settings (if driver - TODO)
    └── Location Preferences (if driver - TODO)
```

## Required External Links

The profile screens use `Linking.openURL()` for external navigation. Ensure these URLs are configured:

### Client Profile URLs
```typescript
// Help Center
'https://drivedrop.com/help'

// Terms of Service
'https://drivedrop.com/terms'

// Privacy Policy
'https://drivedrop.com/privacy'
```

### Driver Profile URLs
```typescript
// Driver Help Center
'https://drivedrop.com/driver-help'

// Driver Terms
'https://drivedrop.com/driver-terms'
```

### Email Links
```typescript
// Client support
'mailto:support@drivedrop.com'

// Driver support
'mailto:driver-support@drivedrop.com'
```

**Update these URLs** in the respective screen files to match your actual domain and support email.

## Database Schema Requirements

### Required Tables

#### 1. driver_settings
```sql
CREATE TABLE driver_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  available_for_jobs BOOLEAN DEFAULT TRUE,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  preferred_radius INTEGER DEFAULT 50,
  allow_location_tracking BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_id)
);
```

#### 2. notification_preferences
```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shipment_updates BOOLEAN DEFAULT TRUE,
  messages BOOLEAN DEFAULT TRUE,
  promotions BOOLEAN DEFAULT FALSE,
  driver_assigned BOOLEAN DEFAULT TRUE,
  delivery_completed BOOLEAN DEFAULT TRUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  sms_notifications BOOLEAN DEFAULT FALSE,
  push_notifications BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

#### 3. privacy_settings
```sql
CREATE TABLE privacy_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_tracking BOOLEAN DEFAULT TRUE,
  share_profile BOOLEAN DEFAULT FALSE,
  show_online_status BOOLEAN DEFAULT TRUE,
  allow_analytics BOOLEAN DEFAULT TRUE,
  two_factor_auth BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

### Supabase Storage Bucket

Create a storage bucket for profile avatars:

```sql
-- In Supabase Dashboard → Storage
-- Create bucket: "profiles"
-- Public: true
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp
```

## RLS Policies

Add Row Level Security policies for the new tables:

### driver_settings
```sql
-- Enable RLS
ALTER TABLE driver_settings ENABLE ROW LEVEL SECURITY;

-- Drivers can view their own settings
CREATE POLICY "Drivers can view own settings"
ON driver_settings FOR SELECT
USING (auth.uid() = driver_id);

-- Drivers can insert their own settings
CREATE POLICY "Drivers can insert own settings"
ON driver_settings FOR INSERT
WITH CHECK (auth.uid() = driver_id);

-- Drivers can update their own settings
CREATE POLICY "Drivers can update own settings"
ON driver_settings FOR UPDATE
USING (auth.uid() = driver_id);

-- Admins can view all settings
CREATE POLICY "Admins can view all driver settings"
ON driver_settings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
```

### notification_preferences
```sql
-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can manage their own preferences
CREATE POLICY "Users can manage own notification preferences"
ON notification_preferences FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### privacy_settings
```sql
-- Enable RLS
ALTER TABLE privacy_settings ENABLE ROW LEVEL SECURITY;

-- Users can manage their own privacy settings
CREATE POLICY "Users can manage own privacy settings"
ON privacy_settings FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### Storage Bucket Policies
```sql
-- Users can upload their own avatars
CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profiles'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own avatars
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profiles'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Anyone can view avatars (public bucket)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'profiles');
```

## Testing Checklist

### Navigation Testing
- [ ] Settings button on client profile navigates to SettingsScreen
- [ ] Settings button on driver profile navigates to SettingsScreen
- [ ] Back buttons work correctly on all settings screens
- [ ] Notification Preferences navigation works
- [ ] Privacy & Security navigation works

### Profile Features Testing
- [ ] Avatar upload works for clients
- [ ] Avatar upload works for drivers
- [ ] Edit profile modal opens and saves correctly
- [ ] Stats display accurate data
- [ ] Pull-to-refresh updates stats
- [ ] Driver availability toggle works
- [ ] Driver settings save correctly

### Settings Features Testing
- [ ] All toggle switches respond correctly
- [ ] Save buttons persist changes to database
- [ ] Settings load correctly from database
- [ ] Missing tables handled gracefully
- [ ] External links open correctly
- [ ] Email links open mail client

### Database Testing
- [ ] Tables created successfully
- [ ] RLS policies allow proper access
- [ ] Storage bucket created and accessible
- [ ] Avatar uploads reach storage
- [ ] Profile updates persist
- [ ] Settings updates persist

## Troubleshooting

### "Table does not exist" Errors
- Run the SQL scripts above to create tables
- Check Supabase dashboard for table creation
- Verify database connection

### Avatar Upload Fails
- Ensure 'profiles' storage bucket exists
- Check bucket is public
- Verify RLS policies on storage.objects
- Check file size < 5MB
- Verify MIME type is allowed

### Navigation Not Working
- Check screen names match exactly
- Verify screens are registered in navigator
- Check navigation types are updated
- Ensure headerShown: false is set

### Settings Not Saving
- Check RLS policies are created
- Verify user authentication
- Check user_id / driver_id matches auth.uid()
- Look for errors in Supabase logs

## Migration from Old Profiles

If you have existing users, you may want to migrate:

### Copy Old Avatar URLs
```sql
-- If avatar_url column exists in profiles
-- No migration needed - screens use existing column
```

### Create Default Settings
```sql
-- Create default driver settings for existing drivers
INSERT INTO driver_settings (driver_id, available_for_jobs, notifications_enabled, preferred_radius, allow_location_tracking)
SELECT id, TRUE, TRUE, 50, TRUE
FROM profiles
WHERE role = 'driver'
ON CONFLICT (driver_id) DO NOTHING;

-- Create default notification preferences for all users
INSERT INTO notification_preferences (user_id, shipment_updates, messages, promotions, driver_assigned, delivery_completed, email_notifications, sms_notifications, push_notifications)
SELECT id, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE
FROM profiles
ON CONFLICT (user_id) DO NOTHING;

-- Create default privacy settings for all users
INSERT INTO privacy_settings (user_id, location_tracking, share_profile, show_online_status, allow_analytics, two_factor_auth)
SELECT id, TRUE, FALSE, TRUE, TRUE, FALSE
FROM profiles
ON CONFLICT (user_id) DO NOTHING;
```

## Notes

- All screens handle missing database tables gracefully
- External URLs need to be updated to your actual domain
- Email addresses need to be updated to your support emails
- TypeScript errors about missing tables are benign until tables are created
- All screens are fully responsive and use SafeAreaView
- All async operations have proper loading states
- All destructive actions have confirmation dialogs

---

**Status**: Ready for integration  
**Prerequisites**: Database tables, storage bucket, navigation setup  
**Next Steps**: Create database schema, update URLs, test navigation
